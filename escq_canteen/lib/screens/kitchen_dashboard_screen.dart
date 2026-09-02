import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
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
  Timer? _tickTimer;
  bool _isLoading = true;
  String? _error;
  List<Order> _allOrders = [];
  int _lastRefreshEpoch = 0;

  @override
  void initState() {
    super.initState();
    _loadOrders();
    _refreshTimer = Timer.periodic(const Duration(seconds: 5), (_) => _loadOrders());
    _tickTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    _tickTimer?.cancel();
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
          _lastRefreshEpoch = DateTime.now().millisecondsSinceEpoch;
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
            SnackBar(
              content: Text('Order marked as $status'),
              backgroundColor: Colors.green,
              duration: const Duration(seconds: 1),
            ),
          );
        }
        _loadOrders();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed: $e'), backgroundColor: Colors.red, duration: const Duration(seconds: 1)),
        );
      }
    }
  }

  String _liveElapsed(int? createdAtMs) {
    if (createdAtMs == null || createdAtMs == 0) return '';
    final diff = DateTime.now().millisecondsSinceEpoch - createdAtMs;
    final mins = (diff ~/ 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return '${mins}m ago';
    final hrs = mins ~/ 60;
    return '${hrs}h ${mins % 60}m ago';
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final user = auth.user;
    final themeProv = context.watch<ThemeProvider>();
    final isDark = themeProv.isDark;

    final pendingOrders = _allOrders.where((o) => o.status == 'scheduled' || o.status == 'pending').toList();
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
          _buildStatsBar(pendingOrders, preparingOrders, readyOrders, isDark),
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator(color: Color(0xFFF59E0B)))
                : _error != null
                    ? _buildError()
                    : _buildContent(pendingOrders, preparingOrders, readyOrders, completedOrders, isDark),
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
                      '${_allOrders.length} orders today · Live',
                      style: TextStyle(
                        fontSize: 11,
                        color: Colors.green[500],
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.green.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.green.withOpacity(0.3)),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 6, height: 6,
                      decoration: const BoxDecoration(
                        color: Colors.green,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 4),
                    Text(
                      '5s',
                      style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.green[600]),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
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

  Widget _buildStatsBar(List<Order> pending, List<Order> preparing, List<Order> ready, bool isDark) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      color: isDark ? const Color(0xFF1A2332) : const Color(0xFFFFF8F0),
      child: Row(
        children: [
          _statPill('${pending.length}', 'Incoming', const Color(0xFF2563EB), Icons.inbox),
          const SizedBox(width: 8),
          _statPill('${preparing.length}', 'Cooking', const Color(0xFFEA580C), Icons.local_fire_department),
          const SizedBox(width: 8),
          _statPill('${ready.length}', 'Ready', const Color(0xFF16A34A), Icons.check_circle),
          const SizedBox(width: 8),
          _statPill('${pending.length + preparing.length + ready.length}', 'Active', const Color(0xFF8B5CF6), Icons.timeline),
        ],
      ),
    );
  }

  Widget _statPill(String count, String label, Color color, IconData icon) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 6),
        decoration: BoxDecoration(
          color: color.withOpacity(0.08),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: color.withOpacity(0.2)),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, color: color, size: 14),
            const SizedBox(width: 4),
            Column(
              children: [
                Text(count, style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: color)),
                Text(label, style: TextStyle(fontSize: 9, color: color, fontWeight: FontWeight.w600)),
              ],
            ),
          ],
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

  Widget _buildContent(List<Order> pending, List<Order> preparing, List<Order> ready, List<Order> completed, bool isDark) {
    final hasAnyOrders = pending.isNotEmpty || preparing.isNotEmpty || ready.isNotEmpty || completed.isNotEmpty;

    return RefreshIndicator(
      onRefresh: _loadOrders,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (pending.isNotEmpty) ...[
            _buildSectionHeader('Incoming Orders', pending.length, const Color(0xFF2563EB), isDark),
            ...pending.map((o) => _buildOrderCard(o, 'scheduled', isDark)),
            const SizedBox(height: 12),
          ],
          if (preparing.isNotEmpty) ...[
            _buildSectionHeader('Now Preparing', preparing.length, const Color(0xFFEA580C), isDark),
            ...preparing.map((o) => _buildOrderCard(o, 'preparing', isDark)),
            const SizedBox(height: 12),
          ],
          if (ready.isNotEmpty) ...[
            _buildSectionHeader('Ready to Serve', ready.length, const Color(0xFF16A34A), isDark),
            ...ready.map((o) => _buildOrderCard(o, 'ready', isDark)),
            const SizedBox(height: 12),
          ],
          if (completed.isNotEmpty) ...[
            _buildSectionHeader('Completed', completed.length, Colors.grey, isDark),
            ...completed.take(15).map((o) => _buildOrderCard(o, 'completed', isDark)),
          ],
          if (!hasAnyOrders) _buildEmptyState(isDark),
        ],
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
    final liveTime = _liveElapsed(order.createdAt);

    Color statusColor;
    String statusLabel;
    List<Widget> actions = [];

    switch (phase) {
      case 'completed':
        statusColor = Colors.grey;
        statusLabel = order.statusLabel;
        break;
      case 'ready':
        statusColor = const Color(0xFF16A34A);
        statusLabel = 'Ready for pickup';
        actions = [
          _actionButton('Served', Icons.check_circle, const Color(0xFF16A34A), () => _updateStatus(order.id, 'collected')),
        ];
        break;
      case 'preparing':
        statusColor = const Color(0xFFEA580C);
        statusLabel = 'Preparing';
        actions = [
          _actionButton('Mark Ready', Icons.check, const Color(0xFF16A34A), () => _updateStatus(order.id, 'ready')),
        ];
        break;
      default:
        statusColor = const Color(0xFF2563EB);
        statusLabel = 'Waiting';
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
              if (liveTime.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: Text(liveTime, style: TextStyle(fontSize: 10, color: Colors.grey[500], fontStyle: FontStyle.italic)),
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
          const SizedBox(height: 8),
          Text('Orders will appear here automatically.', style: TextStyle(fontSize: 11, color: isDark ? Colors.grey[600] : Colors.grey[400])),
        ],
      ),
    );
  }
}
