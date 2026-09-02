import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../providers/auth_provider.dart';
import '../providers/theme_provider.dart';
import '../models/order.dart';
import '../services/api_service.dart';

class KitchenDashboardScreen extends StatefulWidget {
  const KitchenDashboardScreen({super.key});

  @override
  State<KitchenDashboardScreen> createState() => _KitchenDashboardScreenState();
}

class _KitchenDashboardScreenState extends State<KitchenDashboardScreen> {
  final ApiService _api = ApiService();
  Timer? _refreshTimer;
  bool _isLoading = true;
  String? _error;
  List<Order> _allOrders = [];
  int _currentTab = 0;

  MobileScannerController? _scannerController;
  bool _isProcessing = false;

  @override
  void initState() {
    super.initState();
    _loadOrders();
    _refreshTimer = Timer.periodic(const Duration(seconds: 15), (_) => _loadOrders());
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    _scannerController?.dispose();
    super.dispose();
  }

  Future<void> _loadOrders() async {
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

  Future<void> _updateStatus(String orderId, String status) async {
    try {
      final result = await _api.updateOrderStatus(orderId, status);
      if (result['success'] == true) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Order marked as $status'), backgroundColor: Colors.green),
          );
        }
        _loadOrders();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed: $e'), backgroundColor: Colors.red),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final user = auth.user;
    final themeProv = context.watch<ThemeProvider>();
    final isDark = themeProv.isDark;

    final scheduledOrders = _allOrders.where((o) => o.status == 'scheduled' || o.status == 'pending').toList();
    final preparingOrders = _allOrders.where((o) => o.status == 'preparing').toList();
    final readyOrders = _allOrders.where((o) => o.status == 'ready').toList();
    final completedOrders = _allOrders.where((o) =>
        o.status == 'collected' || o.status == 'delivered' || o.status == 'cancelled' || o.status == 'expired'
    ).toList();

    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF111827) : const Color(0xFFFBFCFF),
      body: Column(
        children: [
          _buildHeader(user, isDark),
          _buildTabBar(isDark),
          Expanded(
            child: _currentTab == 0
                ? _isLoading
                    ? const Center(child: CircularProgressIndicator(color: Color(0xFFF59E0B)))
                    : _error != null
                        ? _buildError()
                        : _buildContent(scheduledOrders, preparingOrders, readyOrders, completedOrders, isDark)
                : _buildScannerTab(),
          ),
        ],
      ),
    );
  }

  Widget _buildHeader(dynamic user, bool isDark) {
    return Container(
      color: isDark ? const Color(0xFF1F2937) : Colors.white,
      child: SafeArea(
        bottom: false,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: Row(
            children: [
              Container(
                width: 40, height: 40,
                decoration: BoxDecoration(
                  color: const Color(0xFFEA580C),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(Icons.kitchen, color: Colors.white, size: 22),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Chef Dashboard',
                      style: TextStyle(
                        fontSize: 18, fontWeight: FontWeight.bold,
                        color: isDark ? Colors.white : const Color(0xFF1F2937),
                      ),
                    ),
                    Text(
                      '${_allOrders.length} orders today',
                      style: TextStyle(
                        fontSize: 12,
                        color: isDark ? Colors.grey[400] : Colors.grey[600],
                      ),
                    ),
                  ],
                ),
              ),
              IconButton(
                icon: Icon(Icons.refresh, color: isDark ? Colors.white : Colors.grey[700]),
                onPressed: _loadOrders,
              ),
              GestureDetector(
                onTap: () {
                  showDialog(
                    context: context,
                    builder: (ctx) => AlertDialog(
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                      title: const Text('Logout', style: TextStyle(fontWeight: FontWeight.bold)),
                      content: const Text('Are you sure you want to logout?'),
                      actions: [
                        TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
                        ElevatedButton(
                          onPressed: () {
                            Navigator.pop(ctx);
                            context.read<AuthProvider>().logout();
                          },
                          style: ElevatedButton.styleFrom(backgroundColor: Colors.red, foregroundColor: Colors.white),
                          child: const Text('Logout'),
                        ),
                      ],
                    ),
                  );
                },
                child: Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(color: Colors.grey[50], borderRadius: BorderRadius.circular(8)),
                  child: Icon(Icons.logout, size: 16, color: isDark ? Colors.grey[400] : Colors.grey[600]),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildError() {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.error_outline, color: Colors.red, size: 48),
          const SizedBox(height: 12),
          Text(_error ?? 'Unknown error', style: const TextStyle(color: Colors.red)),
          const SizedBox(height: 12),
          ElevatedButton(onPressed: _loadOrders, child: const Text('Retry')),
        ],
      ),
    );
  }

  Widget _buildContent(List<Order> scheduled, List<Order> preparing, List<Order> ready, List<Order> completed, bool isDark) {
    return RefreshIndicator(
      onRefresh: _loadOrders,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _buildStatsCards(scheduled, preparing, ready, isDark),
          const SizedBox(height: 16),
          _buildSectionHeader('Incoming Orders', scheduled.length, const Color(0xFF2563EB), isDark),
          ...scheduled.map((o) => _buildOrderCard(o, 'scheduled', isDark)),
          const SizedBox(height: 12),
          _buildSectionHeader('Now Preparing', preparing.length, const Color(0xFFEA580C), isDark),
          ...preparing.map((o) => _buildOrderCard(o, 'preparing', isDark)),
          const SizedBox(height: 12),
          _buildSectionHeader('Ready to Serve', ready.length, const Color(0xFF16A34A), isDark),
          ...ready.map((o) => _buildOrderCard(o, 'ready', isDark)),
          if (completed.isNotEmpty) ...[
            const SizedBox(height: 12),
            _buildSectionHeader('Completed', completed.length, Colors.grey, isDark),
            ...completed.take(10).map((o) => _buildOrderCard(o, 'completed', isDark)),
          ],
          if (scheduled.isEmpty && preparing.isEmpty && ready.isEmpty && completed.isEmpty)
            _buildEmptyState(isDark),
        ],
      ),
    );
  }

  Widget _buildStatsCards(List<Order> scheduled, List<Order> preparing, List<Order> ready, bool isDark) {
    return Row(
      children: [
        _statCard('Pending', scheduled.length, Icons.hourglass_empty, const Color(0xFF2563EB), isDark),
        const SizedBox(width: 8),
        _statCard('Cooking', preparing.length, Icons.local_fire_department, const Color(0xFFEA580C), isDark),
        const SizedBox(width: 8),
        _statCard('Ready', ready.length, Icons.check_circle, const Color(0xFF16A34A), isDark),
      ],
    );
  }

  Widget _statCard(String label, int count, IconData icon, Color color, bool isDark) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 8),
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF1F2937) : Colors.white,
          borderRadius: BorderRadius.circular(12),
          boxShadow: [
            BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 8, offset: const Offset(0, 2)),
          ],
        ),
        child: Column(
          children: [
            Icon(icon, color: color, size: 20),
            const SizedBox(height: 6),
            Text('$count', style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87)),
            Text(label, style: TextStyle(fontSize: 11, color: isDark ? Colors.grey[400] : Colors.grey[600])),
          ],
        ),
      ),
    );
  }

  Widget _buildSectionHeader(String title, int count, Color color, bool isDark) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Container(width: 4, height: 16, decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(2))),
          const SizedBox(width: 8),
          Text(title, style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87)),
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
            decoration: BoxDecoration(color: color.withOpacity(0.15), borderRadius: BorderRadius.circular(10)),
            child: Text('$count', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: color)),
          ),
        ],
      ),
    );
  }

  Widget _buildOrderCard(Order order, String phase, bool isDark) {
    final items = order.items.map((i) => '${i.quantity}x ${i.name}').join(', ');
    final elapsed = order.createdAt != null
        ? ((DateTime.now().millisecondsSinceEpoch - order.createdAt!) / 60000).round()
        : 0;

    Color statusColor;
    String statusLabel;
    List<Widget> actions = [];

    switch (phase) {
      case 'completed':
        statusColor = Colors.grey;
        statusLabel = order.status;
        break;
      case 'ready':
        statusColor = const Color(0xFF16A34A);
        statusLabel = 'Ready for pickup';
        break;
      case 'preparing':
        statusColor = const Color(0xFFEA580C);
        statusLabel = 'Preparing... ${elapsed}m';
        actions = [
          _actionButton('Mark Ready', Icons.check, const Color(0xFF16A34A), () => _updateStatus(order.id, 'ready')),
        ];
        break;
      default:
        statusColor = const Color(0xFF2563EB);
        statusLabel = 'Waiting... ${elapsed}m';
        actions = [
          _actionButton('Start Preparing', Icons.play_arrow, const Color(0xFFEA580C), () => _updateStatus(order.id, 'preparing')),
        ];
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1F2937) : Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border(left: BorderSide(color: statusColor, width: 3)),
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 6, offset: const Offset(0, 2)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(order.id, style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87)),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(color: statusColor.withOpacity(0.15), borderRadius: BorderRadius.circular(8)),
                child: Text(statusLabel, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: statusColor)),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(order.userName.isNotEmpty ? order.userName : 'Customer', style: TextStyle(fontSize: 12, color: isDark ? Colors.grey[300] : Colors.grey[700])),
          const SizedBox(height: 4),
          Text(items, style: TextStyle(fontSize: 12, color: isDark ? Colors.grey[400] : Colors.grey[600]), maxLines: 2, overflow: TextOverflow.ellipsis),
          if (order.pickupSlot != null && order.pickupSlot!.isNotEmpty) ...[
            const SizedBox(height: 4),
            Row(
              children: [
                Icon(Icons.access_time, size: 12, color: isDark ? Colors.grey[500] : Colors.grey[500]),
                const SizedBox(width: 4),
                Text('Slot: ${order.pickupSlot}', style: TextStyle(fontSize: 11, color: isDark ? Colors.grey[500] : Colors.grey[500])),
              ],
            ),
          ],
          if (actions.isNotEmpty) ...[
            const SizedBox(height: 8),
            Row(children: actions),
          ],
        ],
      ),
    );
  }

  Widget _actionButton(String label, IconData icon, Color color, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(8)),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: Colors.white, size: 16),
            const SizedBox(width: 4),
            Text(label, style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600)),
          ],
        ),
      ),
    );
  }

  Widget _buildTabBar(bool isDark) {
    return Container(
      color: isDark ? const Color(0xFF1F2937) : Colors.white,
      child: Row(
        children: [
          _tabBtn(0, Icons.receipt_long, 'Orders', isDark),
          _tabBtn(1, Icons.qr_code_scanner, 'Scanner', isDark),
        ],
      ),
    );
  }

  Widget _tabBtn(int index, IconData icon, String label, bool isDark) {
    final isActive = _currentTab == index;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() {
          _currentTab = index;
          if (index == 1) _initScanner();
        }),
        behavior: HitTestBehavior.opaque,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            border: Border(bottom: BorderSide(color: isActive ? const Color(0xFFF59E0B) : Colors.transparent, width: 2)),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 16, color: isActive ? const Color(0xFFF59E0B) : Colors.grey),
              const SizedBox(width: 6),
              Text(label, style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: isActive ? const Color(0xFFF59E0B) : Colors.grey)),
            ],
          ),
        ),
      ),
    );
  }

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
              Center(
                child: Container(
                  width: 250, height: 250,
                  decoration: BoxDecoration(
                    border: Border.all(color: const Color(0xFFF59E0B), width: 3),
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
          _showScanResult(result['error'] ?? 'Order not found', false);
        }
      }
    } catch (e) {
      if (mounted) _showScanResult('Network error: $e', false);
    } finally {
      if (mounted) setState(() => _isProcessing = false);
    }
  }

  void _showScanResult(String message, bool success) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: success ? Colors.green : Colors.red,
        duration: const Duration(seconds: 2),
      ),
    );
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
                Row(
                  children: [
                    Container(
                      width: 40, height: 40,
                      decoration: BoxDecoration(
                        color: alreadyCollected ? Colors.red : Colors.green,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Icon(
                        alreadyCollected ? Icons.warning : Icons.check_circle,
                        color: Colors.white, size: 24,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        alreadyCollected ? 'Already Served' : 'Order Verified',
                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: alreadyCollected ? Colors.red : null),
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
                          child: Text('This order has already been collected/served.', style: TextStyle(fontSize: 11, color: Colors.red[700], fontWeight: FontWeight.w600)),
                        ),
                      ],
                    ),
                  ),
                ],
                const SizedBox(height: 16),
                _detailRow('Order ID', order.id, Colors.amber[700]!),
                _detailRow('Customer', order.userName, null),
                if (createdTime != null)
                  _detailRow('Time', '${createdTime['time']} \u00b7 ${createdTime['date']}', null),
                if (order.pickupSlot != null)
                  _detailRow('Pickup Slot', order.pickupSlot!, null),
                const SizedBox(height: 8),
                Row(
                  children: [
                    const Text('Status: ', style: TextStyle(fontSize: 11, color: Colors.grey)),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: alreadyCollected ? Colors.red.withOpacity(0.1) : order.status == 'ready' ? Colors.green.withOpacity(0.1) : Colors.orange.withOpacity(0.1),
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
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Total', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                    Text('\u20b9${order.totalPrice.toStringAsFixed(2)}', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.amber[700])),
                  ],
                ),
                const SizedBox(height: 20),
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
                                content: Text('Mark ${order.id} as served?', style: const TextStyle(fontSize: 12)),
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
                                  _loadOrders();
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
                          style: ElevatedButton.styleFrom(backgroundColor: Colors.green, foregroundColor: Colors.white, padding: const EdgeInsets.symmetric(vertical: 12), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10))),
                        ),
                      ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () => Navigator.pop(ctx),
                        child: const Text('Close', style: TextStyle(fontSize: 12)),
                        style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 12), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10))),
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

  Map<String, String> _parseTimestamp(String ts) {
    try {
      final dt = DateTime.parse(ts).toLocal();
      final h = dt.hour.toString().padLeft(2, '0');
      final m = dt.minute.toString().padLeft(2, '0');
      final months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return {'time': '$h:$m', 'date': '${dt.day} ${months[dt.month - 1]}'};
    } catch (_) {
      return {'time': '--:--', 'date': ''};
    }
  }

  Widget _detailRow(String label, String value, Color? valueColor) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 85,
            child: Text(label, style: const TextStyle(fontSize: 11, color: Colors.grey)),
          ),
          Expanded(
            child: Text(value, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: valueColor)),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyState(bool isDark) {
    return Container(
      padding: const EdgeInsets.all(40),
      child: Column(
        children: [
          Icon(Icons.kitchen, size: 64, color: isDark ? Colors.grey[600] : Colors.grey[300]),
          const SizedBox(height: 12),
          Text('All clear!', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: isDark ? Colors.grey[400] : Colors.grey[600])),
          const SizedBox(height: 4),
          Text('No orders in the queue right now.', style: TextStyle(fontSize: 13, color: isDark ? Colors.grey[500] : Colors.grey[500])),
        ],
      ),
    );
  }
}
