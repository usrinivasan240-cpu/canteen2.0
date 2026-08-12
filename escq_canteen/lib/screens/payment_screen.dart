import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';
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
    _razorpay.clear();
    super.dispose();
  }

  void _handlePaymentSuccess(PaymentSuccessResponse response) async {
    debugPrint('[Razorpay] Payment success: orderId=${response.orderId}, paymentId=${response.paymentId}');

    // Show success immediately — payment IS confirmed by Razorpay
    setState(() { waitingForPayment = false; isProcessing = false; isComplete = true; });

    // Verify in background (fire and forget)
    try {
      final api = ApiService();
      api.verifyRazorpayPayment(
        razorpayOrderId: response.orderId ?? '',
        razorpayPaymentId: response.paymentId ?? '',
        razorpaySignature: response.signature ?? '',
      ).then((verifyResult) {
        if (verifyResult['success'] == true && verifyResult['order'] != null) {
          final order = Order.fromJson(verifyResult['order']);
          context.read<OrderProvider>().setLastOrder(order);
        }
        final auth = context.read<AuthProvider>();
        context.read<OrderProvider>().loadOrders(auth.user?.id ?? '');
      }).catchError((e) {
        debugPrint('[Razorpay] Background verify failed: $e');
      });
    } catch (e) {
      debugPrint('[Razorpay] Verify setup failed: $e');
    }
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
        setState(() { waitingForPayment = false; isFailed = true; errorMessage = 'Payment timed out. Please check your orders.'; });
        return;
      }
      try {
        final api = ApiService();
        final auth = context.read<AuthProvider>();
        final orders = await api.getUserOrders(auth.user?.id ?? '');
        final match = orders.where((o) => o.id == orderId).toList();
        if (match.isNotEmpty) {
          final order = match.first;
          if (order.paymentStatus == 'paid' || order.status == 'scheduled' || order.status == 'ready') {
            _pollTimer?.cancel();
            context.read<OrderProvider>().setLastOrder(order);
            context.read<OrderProvider>().loadOrders(auth.user?.id ?? '');
            setState(() { waitingForPayment = false; isComplete = true; });
          } else if (order.status == 'cancelled' || order.status == 'expired') {
            _pollTimer?.cancel();
            setState(() { waitingForPayment = false; isFailed = true; errorMessage = 'Payment was not completed'; });
          }
        }
      } catch (_) {}
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

  Widget _buildSuccess() {
    final orderProv = context.read<OrderProvider>();
    final order = orderProv.lastOrder;

    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
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
            const SizedBox(height: 8),
            Text('Your order has been placed', style: TextStyle(fontSize: 14, color: Colors.grey[500])),
            if (order != null) ...[
              const SizedBox(height: 24),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFFFEE2E2)),
                ),
                child: Column(
                  children: [
                    Text('ORDER ID', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.grey[400])),
                    const SizedBox(height: 4),
                    Text(order.id, style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Colors.red[700])),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 32),
            SizedBox(
              width: double.infinity, height: 52,
              child: ElevatedButton(
                onPressed: () {
                  Navigator.pushAndRemoveUntil(context, MaterialPageRoute(builder: (_) => const HomeScreen()), (_) => false);
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFF59E0B),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
                child: const Text('Back to Menu', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800)),
              ),
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
}
