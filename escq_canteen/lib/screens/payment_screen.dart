import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';
import 'package:qr_flutter/qr_flutter.dart';
import '../providers/cart_provider.dart';
import '../providers/auth_provider.dart';
import '../providers/order_provider.dart';
import '../services/api_service.dart';
import '../config.dart';
import '../models/order.dart';
import 'home_screen.dart';

class PaymentScreen extends StatefulWidget {
  final double totalAmount;
  final String pickupSlot;

  const PaymentScreen({super.key, required this.totalAmount, required this.pickupSlot});

  @override
  State<PaymentScreen> createState() => _PaymentScreenState();
}

class _PaymentScreenState extends State<PaymentScreen> {
  bool isProcessing = true;
  bool isComplete = false;
  bool isFailed = false;
  bool waitingForPayment = false;
  String? errorMessage;
  String? orderId;
  Timer? _pollTimer;
  int _pollCount = 0;
  late Razorpay _razorpay;
  Timer? _recoveryTimer;
  int _recoverySeconds = 0;

  @override
  void initState() {
    super.initState();
    _razorpay = Razorpay();
    _razorpay.on(Razorpay.EVENT_PAYMENT_SUCCESS, _handlePaymentSuccess);
    _razorpay.on(Razorpay.EVENT_PAYMENT_ERROR, _handlePaymentError);
    _razorpay.on(Razorpay.EVENT_EXTERNAL_WALLET, _handleExternalWallet);
    _initiatePayment();
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _recoveryTimer?.cancel();
    _razorpay.clear();
    super.dispose();
  }

  void _handlePaymentSuccess(PaymentSuccessResponse response) async {
    debugPrint('[Razorpay] Payment success: orderId=${response.orderId}, paymentId=${response.paymentId}');
    _pollTimer?.cancel();

    if (!mounted) return;
    setState(() { waitingForPayment = false; isProcessing = false; isComplete = true; });

    final api = ApiService();
    final auth = context.read<AuthProvider>();
    final orderProv = context.read<OrderProvider>();
    final userId = auth.user?.id ?? '';

    for (int attempt = 0; attempt < 4; attempt++) {
      if (!mounted) return;
      try {
        debugPrint('[Razorpay] Verify attempt ${attempt + 1}/4');
        final verifyResult = await api.verifyRazorpayPayment(
          razorpayOrderId: response.orderId ?? '',
          razorpayPaymentId: response.paymentId ?? '',
          razorpaySignature: response.signature ?? '',
        );
        debugPrint('[Razorpay] Verify result: success=${verifyResult['success']}, hasOrder=${verifyResult['order'] != null}');
        if (verifyResult['success'] == true && verifyResult['order'] != null) {
          try {
            final order = Order.fromJson(verifyResult['order']);
            if (!mounted) return;
            orderProv.setLastOrder(order);
            debugPrint('[Razorpay] Order loaded from verify: ${order.id}');
            orderProv.loadOrders(userId);
            return;
          } catch (e) {
            debugPrint('[Razorpay] Order.fromJson failed: $e');
          }
        }
        if (verifyResult['alreadyVerified'] == true) {
          debugPrint('[Razorpay] Already verified, fetching from orders list');
          break;
        }
      } catch (e) {
        debugPrint('[Razorpay] Verify attempt $attempt failed: $e');
      }
      if (attempt < 3) await Future.delayed(Duration(seconds: 2 * (attempt + 1)));
    }

    debugPrint('[Razorpay] Falling back to orders-list poll');
    for (int i = 0; i < 30; i++) {
      if (!mounted) return;
      try {
        final orders = await api.getUserOrders(userId);
        final match = orders.where((o) => o.id == orderId).toList();
        if (match.isNotEmpty) {
          final order = match.first;
          if (order.paymentStatus == 'paid' || order.status == 'scheduled' || order.status == 'ready') {
            if (!mounted) return;
            orderProv.setLastOrder(order);
            orderProv.loadOrders(userId);
            debugPrint('[Razorpay] Order found via poll: ${order.id} status=${order.status}');
            return;
          }
        }
      } catch (e) {
        debugPrint('[Razorpay] Orders poll attempt $i failed: $e');
      }
      await Future.delayed(const Duration(seconds: 2));
    }
    debugPrint('[Razorpay] All recovery attempts exhausted — lastOrder still null');
  }

  void _handlePaymentError(PaymentFailureResponse response) {
    setState(() { waitingForPayment = false; isFailed = true; errorMessage = response.message ?? 'Payment was cancelled or failed.'; });
  }

  void _handleExternalWallet(ExternalWalletResponse response) {
    // External wallet selected - payment flow continues via Razorpay
  }

  Future<void> _initiatePayment() async {
    final cart = context.read<CartProvider>();
    final auth = context.read<AuthProvider>();
    final user = auth.user;

    if (cart.isEmpty || user == null) {
      setState(() { isProcessing = false; isFailed = true; errorMessage = 'Cart is empty'; });
      return;
    }

    try {
      final api = ApiService();
      final result = await api.placeOrder(
        userId: user.id,
        userName: user.name,
        items: cart.toOrderPayload(),
        pickupSlot: widget.pickupSlot,
        canteenId: cart.canteenId ?? '',
      );

      if (result['success'] != true) {
        setState(() { isProcessing = false; isFailed = true; errorMessage = result['error'] ?? 'Order failed'; });
        return;
      }

      orderId = result['order']?['id'];
      cart.clear();

      // Handle VyaparGateway UPI payment
      if (result['useVyapar'] == true && result['upiQrUrl'] != null) {
        final upiQrUrl = result['upiQrUrl'] as String;
        final upiString = result['upiString'] as String? ?? '';

        setState(() { isProcessing = false; waitingForPayment = true; });

        // Show UPI QR modal and start polling
        _showUpiPaymentModal(upiQrUrl, upiString);
        _startPolling();
      }
      // Handle Razorpay payment
      else if (result['useRazorpay'] == true && result['razorpayOrderId'] != null) {
        final razorpayOrderId = result['razorpayOrderId'] as String;
        final amount = result['amount'] as num? ?? widget.totalAmount;

        setState(() { isProcessing = false; waitingForPayment = true; });

        // Show Razorpay payment info and start polling
        _showRazorpayModal(razorpayOrderId, amount);
        _startPolling();
      }
      // Direct order success (free items or already paid)
      else {
        context.read<OrderProvider>().setLastOrder(Order.fromJson(result['order']));
        setState(() { isProcessing = false; isComplete = true; });
      }
    } catch (e) {
      setState(() { isProcessing = false; isFailed = true; errorMessage = e.toString(); });
    }
  }

  void _startPolling() {
    _pollTimer?.cancel();
    _pollTimer = Timer.periodic(const Duration(seconds: 1), (_) async {
      _pollCount++;
      if (_pollCount > 60) {
        _pollTimer?.cancel();
        if (!mounted) return;
        setState(() { waitingForPayment = false; isFailed = true; errorMessage = 'Payment timed out. Please check your orders.'; });
        return;
      }
      if (!mounted) return;
      try {
        final api = ApiService();
        final auth = context.read<AuthProvider>();
        final orders = await api.getUserOrders(auth.user?.id ?? '');
        final match = orders.where((o) => o.id == orderId).toList();
        if (match.isNotEmpty) {
          final order = match.first;
          if (order.paymentStatus == 'paid' || order.status == 'scheduled' || order.status == 'ready') {
            _pollTimer?.cancel();
            if (!mounted) return;
            context.read<OrderProvider>().setLastOrder(order);
            context.read<OrderProvider>().loadOrders(auth.user?.id ?? '');
            setState(() { waitingForPayment = false; isComplete = true; });
          } else if (order.status == 'cancelled' || order.status == 'expired') {
            _pollTimer?.cancel();
            if (!mounted) return;
            setState(() { waitingForPayment = false; isFailed = true; errorMessage = 'Payment was not completed'; });
          }
        }
      } catch (e) {
        debugPrint('[Polling] Error: $e');
      }
    });
  }

  void _showUpiPaymentModal(String qrUrl, String upiString) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        height: MediaQuery.of(ctx).size.height * 0.6,
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(width: 40, height: 4, decoration: BoxDecoration(color: Colors.grey[300], borderRadius: BorderRadius.circular(2))),
            const SizedBox(height: 20),
            const Text('Scan UPI QR to Pay', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
            const SizedBox(height: 8),
            Text('Order ID: $orderId', style: TextStyle(fontSize: 11, color: Colors.grey[500])),
            const SizedBox(height: 16),
            Container(
              width: 200, height: 200,
              decoration: BoxDecoration(
                border: Border.all(color: const Color(0xFFF59E0B), width: 3),
                borderRadius: BorderRadius.circular(16),
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(13),
                child: Image.network(qrUrl, fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) => const Center(child: Icon(Icons.qr_code, size: 80, color: Colors.grey)),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: const Color(0xFFFEF9E7), borderRadius: BorderRadius.circular(10)),
              child: Row(
                children: [
                  const Icon(Icons.info_outline, size: 16, color: Color(0xFFD97706)),
                  const SizedBox(width: 8),
                  Expanded(child: Text('Scan the QR code with any UPI app. Payment will be confirmed automatically.',
                    style: TextStyle(fontSize: 11, color: Colors.grey[700]))),
                ],
              ),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton(
                onPressed: () { Navigator.pop(ctx); setState(() { waitingForPayment = false; isFailed = true; errorMessage = 'Payment cancelled'; }); },
                style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 12), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10))),
                child: const Text('Cancel Payment', style: TextStyle(fontSize: 12)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showRazorpayModal(String razorpayOrderId, num amount) {
    try {
      final auth = context.read<AuthProvider>();
      final user = auth.user;

      var options = {
        'key': AppConfig.razorpayKeyId,
        'amount': (amount * 100).toInt(),
        'currency': 'INR',
        'name': 'Esc(Q) Canteen',
        'description': 'Food Order Payment',
        'order_id': razorpayOrderId,
        'prefill': {
          'name': user?.name ?? '',
          'contact': user?.phone ?? '',
          'email': user?.email ?? '',
        },
        'theme': {
          'color': '#F59E0B',
        },
      };

      _razorpay.open(options);
    } catch (e) {
      setState(() {
        waitingForPayment = false;
        isFailed = true;
        errorMessage = 'Failed to open payment gateway: $e';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFBFCFF),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, size: 18, color: Color(0xFF111827)),
          onPressed: waitingForPayment ? null : () => Navigator.pop(context),
        ),
        title: const Text('Secure Payment', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Color(0xFF111827))),
        centerTitle: true,
      ),
      body: isComplete ? _buildSuccess() : (isFailed ? _buildFailed() : _buildBody()),
    );
  }

  Widget _buildBody() {
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 80, height: 80,
              decoration: BoxDecoration(
                gradient: const LinearGradient(colors: [Color(0xFFF59E0B), Color(0xFFEA580C)]),
                borderRadius: BorderRadius.circular(20),
                boxShadow: [BoxShadow(color: const Color(0xFFF59E0B).withOpacity(0.3), blurRadius: 20, offset: const Offset(0, 8))],
              ),
              child: const Center(child: Text('Esc(Q)', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: Colors.white))),
            ),
            const SizedBox(height: 24),
            if (waitingForPayment) ...[
              const SizedBox(height: 48, width: 48, child: CircularProgressIndicator(color: Color(0xFFF59E0B), strokeWidth: 3)),
              const SizedBox(height: 24),
              const Text('Waiting for Payment Confirmation', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: Color(0xFF111827))),
              const SizedBox(height: 8),
              Text('Complete payment in the payment gateway', style: TextStyle(fontSize: 13, color: Colors.grey[500])),
              const SizedBox(height: 8),
              Text('Order ID: $orderId', style: TextStyle(fontSize: 11, color: Colors.grey[400])),
              const SizedBox(height: 32),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFFFEF9E7),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFFDE68A)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.info_outline, size: 16, color: Color(0xFFD97706)),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Don\'t close this screen. We\'re checking for payment confirmation.',
                        style: TextStyle(fontSize: 11, color: Colors.grey[700]),
                      ),
                    ),
                  ],
                ),
              ),
            ] else ...[
              const SizedBox(height: 48, width: 48, child: CircularProgressIndicator(color: Color(0xFFF59E0B), strokeWidth: 3)),
              const SizedBox(height: 24),
              const Text('Initiating Payment...', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Color(0xFF111827))),
              const SizedBox(height: 8),
              Text('Connecting to payment gateway', style: TextStyle(fontSize: 13, color: Colors.grey[500])),
            ],
          ],
        ),
      ),
    );
  }

  void _startRecoveryTimer() {
    if (_recoveryTimer != null && _recoveryTimer!.isActive) return;
    _recoverySeconds = 0;
    _recoveryTimer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) { t.cancel(); return; }
      setState(() => _recoverySeconds++);
      if (_recoverySeconds >= 45) t.cancel();
    });
  }

  Future<void> _manualRecovery() async {
    try {
      final api = ApiService();
      final auth = context.read<AuthProvider>();
      final orders = await api.getUserOrders(auth.user?.id ?? '');
      final match = orders.where((o) => o.id == orderId).toList();
      if (match.isNotEmpty) {
        if (!mounted) return;
        context.read<OrderProvider>().setLastOrder(match.first);
        context.read<OrderProvider>().loadOrders(auth.user?.id ?? '');
      } else {
        if (!mounted) return;
        setState(() => _recoverySeconds = 0);
      }
    } catch (e) {
      debugPrint('[Recovery] Manual retry failed: $e');
    }
  }

  Widget _buildSuccess() {
    final order = context.watch<OrderProvider>().lastOrder;

    if (order == null) {
      _startRecoveryTimer();
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 80, height: 80,
              decoration: BoxDecoration(
                color: Colors.green,
                borderRadius: BorderRadius.circular(20),
                boxShadow: [BoxShadow(color: Colors.green.withOpacity(0.3), blurRadius: 20, offset: const Offset(0, 8))],
              ),
              child: const Icon(Icons.check_circle, color: Colors.white, size: 44),
            ),
            const SizedBox(height: 24),
            const Text('Payment Successful!', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w900, color: Color(0xFF111827))),
            const SizedBox(height: 20),
            if (_recoverySeconds < 20) ...[
              const SizedBox(height: 36, width: 36, child: CircularProgressIndicator(color: Color(0xFFF59E0B), strokeWidth: 3)),
              const SizedBox(height: 16),
              const Text('Generating your QR ticket...', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Color(0xFF111827))),
              const SizedBox(height: 6),
              Text('Confirming payment and preparing your bill', style: TextStyle(fontSize: 12, color: Colors.grey[500])),
            ],
            if (orderId != null) ...[
              const SizedBox(height: 8),
              Text('Order ID: $orderId', style: TextStyle(fontSize: 11, color: Colors.grey[400])),
            ],
            const SizedBox(height: 12),
            Text('Recovery attempt: ${_recoverySeconds}s', style: TextStyle(fontSize: 10, color: Colors.grey[400])),
            if (_recoverySeconds >= 20) ...[
              const SizedBox(height: 16),
              ElevatedButton.icon(
                onPressed: _manualRecovery,
                icon: const Icon(Icons.refresh, size: 16),
                label: const Text('Tap to Refresh', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFF59E0B),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
              ),
              const SizedBox(height: 8),
              TextButton(
                onPressed: () {
                  Navigator.pushAndRemoveUntil(context, MaterialPageRoute(builder: (_) => const HomeScreen()), (_) => false);
                },
                child: const Text('Go to My Orders', style: TextStyle(fontSize: 12, color: Color(0xFFD97706))),
              ),
            ],
          ],
        ),
      );
    }

    _recoveryTimer?.cancel();

    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 64, height: 64,
              decoration: BoxDecoration(
                color: Colors.green,
                borderRadius: BorderRadius.circular(20),
                boxShadow: [BoxShadow(color: Colors.green.withOpacity(0.3), blurRadius: 20, offset: const Offset(0, 8))],
              ),
              child: const Icon(Icons.check_circle, color: Colors.white, size: 36),
            ),
            const SizedBox(height: 16),
            const Text('Payment Successful!', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: Color(0xFF111827))),
            const SizedBox(height: 16),

            // QR Ticket
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: const Color(0xFFF59E0B), width: 2),
                boxShadow: [BoxShadow(color: const Color(0xFFF59E0B).withOpacity(0.15), blurRadius: 24, offset: const Offset(0, 8))],
              ),
              child: Column(
                children: [
                  Container(width: 60, height: 4, decoration: BoxDecoration(color: Colors.grey[300], borderRadius: BorderRadius.circular(2))),
                  const SizedBox(height: 14),
                  const Text('TICKET AUTHENTICATION LOCK', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 1.2, color: Color(0xFF111827))),
                  const SizedBox(height: 6),
                  Text('Show this QR at the counter to collect your order', textAlign: TextAlign.center, style: TextStyle(fontSize: 10, color: Colors.grey[500])),
                  const SizedBox(height: 14),
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(border: Border.all(color: Colors.grey.shade200), borderRadius: BorderRadius.circular(12)),
                    child: QrImageView(
                      data: order.qrPayload ?? order.id,
                      version: QrVersions.auto,
                      size: 190,
                      backgroundColor: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 14),
                  Text('ORDER ID', style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, letterSpacing: 1, color: Colors.grey[400])),
                  const SizedBox(height: 2),
                  Text(order.id, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFFDC2626))),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Bill
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.grey.shade200),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('BILL SUMMARY', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 1, color: Color(0xFF111827))),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(color: Colors.green.withOpacity(0.1), borderRadius: BorderRadius.circular(20)),
                        child: const Text('PAID', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: Color(0xFF16A34A))),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  ...order.items.map((it) => Padding(
                    padding: const EdgeInsets.only(bottom: 6),
                    child: Row(
                      children: [
                        Expanded(child: Text('${it.name}  × ${it.quantity}', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF111827)))),
                        Text('₹${(it.price * it.quantity).toStringAsFixed(2)}', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Colors.grey[700])),
                      ],
                    ),
                  )),
                  Divider(color: Colors.grey.shade200, height: 18),
                  if (order.pickupSlot != null && order.pickupSlot!.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 6),
                      child: Row(
                        children: [
                          const Icon(Icons.schedule, size: 13, color: Color(0xFFD97706)),
                          const SizedBox(width: 5),
                          Text('Pickup: ${order.pickupSlot}', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFFD97706))),
                        ],
                      ),
                    ),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Total Paid', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Color(0xFF111827))),
                      Text('₹${order.totalPrice.toStringAsFixed(2)}', style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: Color(0xFF16A34A))),
                    ],
                  ),
                  Divider(color: Colors.grey.shade200, height: 18),
                  // Timestamp
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('Order Date', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
                      Text(_formatOrderDate(order.createdAt), style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF111827))),
                    ],
                  ),
                  if (order.paymentStatus == 'paid') ...[
                    const SizedBox(height: 4),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('Payment Status', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
                        Text('Paid', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF16A34A))),
                      ],
                    ),
                  ],
                ],
              ),
            ),

            const SizedBox(height: 24),
            Row(
              children: [
                Expanded(
                  child: SizedBox(
                    width: double.infinity, height: 52,
                    child: OutlinedButton(
                      onPressed: () {
                        Navigator.pushAndRemoveUntil(context, MaterialPageRoute(builder: (_) => const HomeScreen()), (_) => false);
                      },
                      style: OutlinedButton.styleFrom(
                        side: BorderSide(color: const Color(0xFFF59E0B), width: 2),
                        foregroundColor: const Color(0xFFF59E0B),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                      child: const Text('View My Orders', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800)),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: SizedBox(
                    width: double.infinity, height: 52,
                    child: ElevatedButton(
                      onPressed: () {
                        Navigator.pushAndRemoveUntil(context, MaterialPageRoute(builder: (_) => const HomeScreen()), (_) => false);
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFF59E0B),
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                      child: const Text('Order More Food', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800)),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFailed() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 80, height: 80,
              decoration: BoxDecoration(color: Colors.red[50], borderRadius: BorderRadius.circular(20)),
              child: Icon(Icons.error_outline, color: Colors.red[600], size: 44),
            ),
            const SizedBox(height: 24),
            const Text('Payment Failed', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w900, color: Color(0xFF111827))),
            const SizedBox(height: 8),
            Text(errorMessage ?? 'Something went wrong', style: TextStyle(fontSize: 14, color: Colors.grey[500]), textAlign: TextAlign.center),
            const SizedBox(height: 32),
            SizedBox(
              width: double.infinity, height: 52,
              child: ElevatedButton(
                onPressed: () {
                  setState(() { isFailed = false; isProcessing = true; _pollCount = 0; _initiatePayment(); });
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFF59E0B),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
                child: const Text('Try Again', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800)),
              ),
            ),
            const SizedBox(height: 12),
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: Text('Go Back', style: TextStyle(fontSize: 13, color: Colors.grey[500])),
            ),
          ],
        ),
      ),
    );
  }

  String _formatOrderDate(dynamic timestamp) {
    try {
      if (timestamp == null) return '';
      int timestampMs;
      if (timestamp is int) {
        timestampMs = timestamp;
      } else if (timestamp is String) {
        timestampMs = int.tryParse(timestamp) ?? 0;
      } else {
        return '';
      }
      if (timestampMs == 0) return '';
      final dt = DateTime.fromMillisecondsSinceEpoch(timestampMs);
      final months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return '${dt.day} ${months[dt.month - 1]} ${dt.year}, ${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
    } catch (e) {
      return '';
    }
  }
}
