import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../providers/auth_provider.dart';
import '../providers/theme_provider.dart';
import '../models/order.dart';
import '../services/api_service.dart';
import '../widgets/offline_indicator.dart';

class StaffHomeScreen extends StatefulWidget {
  const StaffHomeScreen({super.key});

  @override
  State<StaffHomeScreen> createState() => _StaffHomeScreenState();
}

class _StaffHomeScreenState extends State<StaffHomeScreen> {
  int currentTab = 0;
  final ApiService _api = ApiService();
  List<Order> _allOrders = [];
  bool _isLoading = false;
  String? _error;
  Timer? _autoRefreshTimer;

  // Scanner
  MobileScannerController? _scannerController;
  bool _isProcessing = false;

  @override
  void initState() {
    super.initState();
    _loadAllOrders();
    _autoRefreshTimer = Timer.periodic(const Duration(seconds: 60), (_) => _loadAllOrders());
  }

  @override
  void dispose() {
    _autoRefreshTimer?.cancel();
    _scannerController?.dispose();
    super.dispose();
  }

  Future<void> _loadAllOrders() async {
    final auth = context.read<AuthProvider>();
    final user = auth.user;
    if (user == null) return;

    try {
      final canteenId = user.canteenId ?? 'canteen_001';
      final data = await _api.getCanteenData(canteenId);
      final orders = _api.parseOrders(data);
      if (mounted) {
        setState(() {
          _allOrders = orders;
          _isLoading = false;
          _error = null;
        });
      }
    } catch (e) {
      if (mounted) setState(() { _error = e.toString(); _isLoading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final user = auth.user;
    final themeProv = context.watch<ThemeProvider>();

    return Scaffold(
      backgroundColor: themeProv.isDark ? const Color(0xFF111827) : const Color(0xFFFBFCFF),
      body: Column(
        children: [
          _buildHeader(auth, user),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            child: Row(
              children: [
                const Expanded(child: OfflineIndicator()),
              ],
            ),
          ),
          _buildTabBar(),
          Expanded(
            child: currentTab == 0
                ? _buildOrdersTab()
                : _buildScannerTab(),
          ),
        ],
      ),
    );
  }

  Widget _buildHeader(AuthProvider auth, user) {
    final themeProv = context.watch<ThemeProvider>();
    return Container(
      color: themeProv.isDark ? const Color(0xFF1F2937) : Colors.white,
      child: SafeArea(
        bottom: false,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          child: Row(
            children: [
              Container(
                width: 36, height: 36,
                decoration: BoxDecoration(color: const Color(0xFFF59E0B), borderRadius: BorderRadius.circular(10)),
                child: const Icon(Icons.local_cafe, color: Colors.white, size: 18),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Esc(Q)', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: themeProv.isDark ? Colors.white : Colors.black87)),
                    Text('Staff Panel · ${user?.role ?? ''}', style: TextStyle(fontSize: 10, color: themeProv.isDark ? Colors.grey[400] : Colors.grey)),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(color: Colors.grey[100], borderRadius: BorderRadius.circular(16)),
                child: Text(user?.email ?? '', style: const TextStyle(fontSize: 9, color: Colors.grey), overflow: TextOverflow.ellipsis),
              ),
              const SizedBox(width: 8),
              GestureDetector(
                onTap: () => auth.logout(),
                child: Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(color: Colors.grey[50], borderRadius: BorderRadius.circular(8)),
                  child: const Icon(Icons.logout, size: 14, color: Colors.grey),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTabBar() {
    final themeProv = context.watch<ThemeProvider>();
    return Container(
      color: themeProv.isDark ? const Color(0xFF1F2937) : Colors.white,
      child: Row(
        children: [
          _tabBtn(0, Icons.receipt_long, 'Orders'),
          _tabBtn(1, Icons.qr_code_scanner, 'Scanner'),
        ],
      ),
    );
  }

  Widget _tabBtn(int index, IconData icon, String label) {
    final isActive = currentTab == index;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() {
          currentTab = index;
          if (index == 1) _initScanner();
        }),
        behavior: HitTestBehavior.opaque,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            border: Border(bottom: BorderSide(color: isActive ? const Color(0xFFD97706) : Colors.transparent, width: 2)),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 16, color: isActive ? const Color(0xFFD97706) : Colors.grey),
              const SizedBox(width: 6),
              Text(label, style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: isActive ? const Color(0xFFD97706) : Colors.grey)),
            ],
          ),
        ),
      ),
    );
  }

  // ─── ORDERS TAB ──────────────────────────────────────────
  Widget _buildOrdersTab() {
    final activeOrders = _allOrders.where((o) =>
        o.status != 'collected' && o.status != 'cancelled' && o.status != 'expired' && o.status != 'delivered'
    ).toList();

    final completedOrders = _allOrders.where((o) =>
        o.status == 'collected' || o.status == 'delivered' || o.status == 'cancelled' || o.status == 'expired'
    ).toList();

    return Column(
      children: [
        // Refresh bar
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Active Orders (${activeOrders.length}) · Auto-refresh: 60s',
                style: TextStyle(fontSize: 10, color: Colors.grey[500]),
              ),
              GestureDetector(
                onTap: _loadAllOrders,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: const Color(0xFFD97706).withOpacity(0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.refresh, size: 14, color: Colors.amber[700]),
                      const SizedBox(width: 4),
                      Text('Refresh', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.amber[700])),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
        // Orders list
        Expanded(
          child: _isLoading
              ? Center(child: CircularProgressIndicator(color: Colors.amber[600]))
              : _error != null
                  ? Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.error_outline, size: 40, color: Colors.red[300]),
                          const SizedBox(height: 8),
                          Text('Error loading orders', style: TextStyle(fontSize: 12, color: Colors.grey[500])),
                          const SizedBox(height: 12),
                          ElevatedButton(onPressed: _loadAllOrders, child: const Text('Retry')),
                        ],
                      ),
                    )
                  : activeOrders.isEmpty && completedOrders.isEmpty
                      ? Center(
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.receipt_long, size: 48, color: Colors.red[100]),
                              const SizedBox(height: 12),
                              const Text('No orders yet', style: TextStyle(fontSize: 12, color: Colors.grey)),
                            ],
                          ),
                        )
                      : RefreshIndicator(
                          onRefresh: _loadAllOrders,
                          child: ListView(
                            padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                            children: [
                              if (activeOrders.isNotEmpty) ...[
                                ...activeOrders.map((order) => _orderCard(order, isActive: true)),
                              ],
                              if (completedOrders.isNotEmpty) ...[
                                const SizedBox(height: 16),
                                Text('COMPLETED', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.grey[400], letterSpacing: 1)),
                                const SizedBox(height: 8),
                                ...completedOrders.take(10).map((order) => _orderCard(order, isActive: false)),
                              ],
                            ],
                          ),
                        ),
        ),
      ],
    );
  }

  Widget _orderCard(Order order, {required bool isActive}) {
    final createdTime = order.timestamp != null ? _parseTimestamp(order.timestamp!) : null;
    final themeProv = context.watch<ThemeProvider>();

    Color statusColor;
    switch (order.status) {
      case 'scheduled': statusColor = Colors.blue; break;
      case 'preparing': statusColor = Colors.orange; break;
      case 'ready': statusColor = Colors.green; break;
      case 'collected': statusColor = Colors.green; break;
      case 'delivered': statusColor = Colors.green; break;
      case 'expired': statusColor = Colors.red; break;
      case 'cancelled': statusColor = Colors.red; break;
      default: statusColor = Colors.grey;
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: themeProv.isDark ? const Color(0xFF1F2937) : Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: isActive ? (themeProv.isDark ? const Color(0xFF374151) : const Color(0xFFFEE2E2)) : (themeProv.isDark ? const Color(0xFF374151) : Colors.grey.shade200)),
        boxShadow: isActive ? [BoxShadow(color: Colors.black.withOpacity(themeProv.isDark ? 0.1 : 0.03), blurRadius: 4)] : [],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header row
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(order.id, style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.amber[700])),
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(color: statusColor.withOpacity(0.1), borderRadius: BorderRadius.circular(4)),
                          child: Text(order.statusLabel, style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: statusColor)),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text('By: ${order.userName}', style: TextStyle(fontSize: 11, color: themeProv.isDark ? Colors.grey[400] : Colors.grey)),
                  ],
                ),
              ),
              if (createdTime != null)
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(createdTime['time']!, style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: themeProv.isDark ? Colors.white : Colors.black87)),
                    Text(createdTime['date']!, style: TextStyle(fontSize: 9, color: Colors.grey[400])),
                  ],
                ),
            ],
          ),
          const SizedBox(height: 10),

          // Items
          ...order.items.map((item) => Padding(
            padding: const EdgeInsets.only(bottom: 3),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(child: Text('${item.name} x${item.quantity}', style: const TextStyle(fontSize: 11), overflow: TextOverflow.ellipsis)),
                Text('₹${(item.price * item.quantity).toStringAsFixed(2)}', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ],
            ),
          )),

          const Divider(height: 12),

          // Pickup + price
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              if (order.pickupSlot != null)
                Row(
                  children: [
                    Icon(Icons.access_time, size: 12, color: Colors.grey[400]),
                    const SizedBox(width: 4),
                    Text('Pickup: ${order.pickupSlot}', style: TextStyle(fontSize: 10, color: Colors.grey[500])),
                  ],
                ),
              Text('₹${order.totalPrice.toStringAsFixed(2)}', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: themeProv.isDark ? Colors.white : Colors.black87)),
            ],
          ),

          // Status buttons
          if (isActive) ...[
            const SizedBox(height: 10),
            Row(
              children: [
                if (order.status == 'scheduled')
                  _actionBtn('Start Preparing', const Color(0xFFD97706), () => _updateStatus(order.id, 'preparing')),
                if (order.status == 'preparing')
                  _actionBtn('Mark Ready', Colors.green, () => _updateStatus(order.id, 'ready')),
                if (order.status == 'ready')
                  _actionBtn('Mark Collected', Colors.blue, () => _updateStatus(order.id, 'collected')),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _actionBtn(String label, Color color, VoidCallback onTap) {
    return Expanded(
      child: ElevatedButton(
        onPressed: onTap,
        style: ElevatedButton.styleFrom(
          backgroundColor: color,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(vertical: 10),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        ),
        child: Text(label, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
      ),
    );
  }

  Future<void> _updateStatus(String orderId, String status) async {
    final result = await _api.updateOrderStatus(orderId, status);
    if (result['success'] == true && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text('Order $status'),
        backgroundColor: status == 'ready' ? Colors.green : Colors.amber,
        duration: const Duration(seconds: 2),
      ));
      await _loadAllOrders();
    }
  }

  Map<String, String> _parseTimestamp(String ts) {
    try {
      final dt = DateTime.parse(ts);
      final hour = dt.hour % 12 == 0 ? 12 : dt.hour % 12;
      final min = dt.minute.toString().padLeft(2, '0');
      final ampm = dt.hour >= 12 ? 'PM' : 'AM';
      final months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return {
        'time': '$hour:$min $ampm',
        'date': '${dt.day} ${months[dt.month - 1]} ${dt.year}',
      };
    } catch (_) {
      return {'time': '--:--', 'date': ''};
    }
  }

  // ─── SCANNER TAB ─────────────────────────────────────────
  void _initScanner() {
    _scannerController?.dispose();
    _scannerController = MobileScannerController(
      detectionSpeed: DetectionSpeed.normal,
      facing: CameraFacing.back,
      torchEnabled: false,
    );
  }

  Widget _buildScannerTab() {
    return Column(
      children: [
        Expanded(
          flex: 4,
          child: Stack(
            children: [
              if (_scannerController != null)
                MobileScanner(
                  controller: _scannerController!,
                  onDetect: (capture) {
                    if (_isProcessing) return;
                    final barcodes = capture.barcodes;
                    if (barcodes.isNotEmpty) {
                      final code = barcodes.first.rawValue;
                      if (code != null && code.isNotEmpty) {
                        setState(() => _isProcessing = true);
                        _processScan(code);
                      }
                    }
                  },
                ),
              // Scanner overlay
              Center(
                child: Container(
                  width: 250, height: 250,
                  decoration: BoxDecoration(
                    border: Border.all(color: const Color(0xFFD97706), width: 3),
                    borderRadius: BorderRadius.circular(20),
                  ),
                ),
              ),
              Positioned(
                bottom: 16, left: 0, right: 0,
                child: Center(
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    decoration: BoxDecoration(color: Colors.black54, borderRadius: BorderRadius.circular(20)),
                    child: const Text('Scan QR Ticket', style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold)),
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Future<void> _processScan(String code) async {
    try {
      final result = await _api.verifyQr(code);
      if (mounted) {
        if (result['success'] == true && result['order'] != null) {
          final order = Order.fromJson(result['order']);
          final alreadyCollected = result['alreadyCollected'] == true;
          _showOrderDetailsDialog(order, code, alreadyCollected: alreadyCollected);
        } else {
          _showScanError(result['error'] ?? 'Order not found');
        }
      }
    } catch (e) {
      if (mounted) _showScanError('Network error: $e');
    }
  }

  void _showOrderDetailsDialog(Order order, String scannedCode, {bool alreadyCollected = false}) {
    final createdTime = order.timestamp != null ? _parseTimestamp(order.timestamp!) : null;

    showDialog(
      context: context,
      builder: (ctx) => Dialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        backgroundColor: Theme.of(context).brightness == Brightness.dark ? const Color(0xFF1F2937) : null,
        child: Container(
          constraints: const BoxConstraints(maxWidth: 380),
          padding: const EdgeInsets.all(24),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Header
                Row(
                  children: [
                    Container(
                      width: 40, height: 40,
                      decoration: BoxDecoration(
                        color: alreadyCollected ? Colors.red : Colors.green,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Icon(
                        alreadyCollected ? Icons.check_circle : Icons.check_circle,
                        color: Colors.white, size: 24,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        alreadyCollected ? 'Already Served' : 'Order Verified',
                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: alreadyCollected ? Colors.red : Colors.black87),
                      ),
                    ),
                  ],
                ),
                if (alreadyCollected) ...[
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(color: Colors.red[50], borderRadius: BorderRadius.circular(10), border: Border.all(color: Colors.red.shade200)),
                    child: Row(
                      children: [
                        Icon(Icons.info_outline, size: 18, color: Colors.red[700]),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'This order has already been collected/served. No further action needed.',
                            style: TextStyle(fontSize: 11, color: Colors.red[700], fontWeight: FontWeight.w600),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
                const SizedBox(height: 16),

                // Order ID
                _detailRow('Order ID', order.id, Colors.amber[700]!),
                _detailRow('Customer', order.userName, Colors.black87),
                if (createdTime != null)
                  _detailRow('Time', '${createdTime['time']} \u00b7 ${createdTime['date']}', Colors.black87),
                if (order.pickupSlot != null)
                  _detailRow('Pickup Slot', order.pickupSlot!, Colors.black87),

                // Status
                const SizedBox(height: 8),
                Row(
                  children: [
                    const Text('Status: ', style: TextStyle(fontSize: 11, color: Colors.grey)),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: alreadyCollected
                            ? Colors.red.withOpacity(0.1)
                            : order.status == 'ready'
                                ? Colors.green.withOpacity(0.1)
                                : Colors.orange.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        alreadyCollected ? '\u2718 Already Served' : '${order.statusEmoji} ${order.statusLabel}',
                        style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: alreadyCollected ? Colors.red : null),
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 16),
                const Divider(),
                const SizedBox(height: 8),

                // Items
                const Text('ORDER ITEMS', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.grey)),
                const SizedBox(height: 8),
                ...order.items.map((item) => Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(child: Text('${item.name} x${item.quantity}', style: const TextStyle(fontSize: 12))),
                      Text('\u20b9${(item.price * item.quantity).toStringAsFixed(2)}', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                    ],
                  ),
                )),

                const Divider(),
                // Total
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Total', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                    Text('\u20b9${order.totalPrice.toStringAsFixed(2)}', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.amber[700])),
                  ],
                ),

                const SizedBox(height: 20),
                // Action buttons
                Row(
                  children: [
                    if (!alreadyCollected && order.status != 'collected' && order.status != 'cancelled' && order.status != 'expired')
                      Expanded(
                        child: ElevatedButton.icon(
                          onPressed: () async {
                            final confirm = await showDialog<bool>(
                              context: ctx,
                              builder: (c) => AlertDialog(
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                                title: const Text('Confirm Serve', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                                content: Text('Mark ${order.id} as served? This QR code will be invalidated.', style: const TextStyle(fontSize: 12)),
                                actions: [
                                  TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Cancel')),
                                  ElevatedButton(
                                    onPressed: () => Navigator.pop(c, true),
                                    style: ElevatedButton.styleFrom(backgroundColor: Colors.green, foregroundColor: Colors.white),
                                    child: const Text('Serve'),
                                  ),
                                ],
                              ),
                            );
                            if (confirm == true && ctx.mounted) {
                              Navigator.pop(ctx);
                              try {
                                final result = await _api.collectOrder(scannedCode);
                                if (mounted) {
                                  final msg = result['alreadyCollected'] == true ? 'Already served!' : 'Order served! QR invalidated.';
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(content: Text(msg), backgroundColor: result['alreadyCollected'] == true ? Colors.orange : Colors.green),
                                  );
                                  await _loadAllOrders();
                                }
                              } catch (e) {
                                if (mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red),
                                  );
                                }
                              }
                            }
                          },
                          icon: const Icon(Icons.check_circle, size: 16),
                          label: const Text('Mark Served', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.green,
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          ),
                        ),
                      ),
                    if (!alreadyCollected && order.status != 'collected' && order.status != 'cancelled' && order.status != 'expired')
                      const SizedBox(width: 10),
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () => Navigator.pop(ctx),
                        style: OutlinedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                        child: const Text('Close', style: TextStyle(fontSize: 12)),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    ).then((_) => setState(() => _isProcessing = false));
  }

  Widget _detailRow(String label, String value, Color valueColor) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 80,
            child: Text(label, style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.grey[400])),
          ),
          Expanded(child: Text(value, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: valueColor))),
        ],
      ),
    );
  }

  void _showScanError(String message) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Scan Failed', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
        content: Text(message, style: const TextStyle(fontSize: 12)),
        actions: [
          TextButton(
            onPressed: () { Navigator.pop(ctx); setState(() => _isProcessing = false); },
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }
}
