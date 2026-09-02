import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../providers/theme_provider.dart';
import '../models/order.dart';
import '../services/api_service.dart';
import 'login_screen.dart';

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
  String _viewMode = 'orders';

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

  List<Order> get _activeOrders => _allOrders.where((o) =>
    o.status == 'scheduled' || o.status == 'pending' || o.status == 'preparing' || o.status == 'ready'
  ).toList();

  List<Order> get _asapOrders => _activeOrders.where((o) =>
    o.pickupSlot == null || o.pickupSlot!.isEmpty || o.pickupSlot == 'ASAP (Instant)'
  ).toList();

  List<Order> get _prebookOrders => _activeOrders.where((o) =>
    o.pickupSlot != null && o.pickupSlot!.isNotEmpty && o.pickupSlot != 'ASAP (Instant)'
  ).toList();

  List<Order> get _completedOrders => _allOrders.where((o) =>
    o.status == 'collected' || o.status == 'delivered' || o.status == 'cancelled' || o.status == 'expired'
  ).toList();

  Map<String, int> _aggregateFoodItems(List<Order> orders) {
    final Map<String, int> aggregated = {};
    for (final order in orders) {
      for (final item in order.items) {
        final name = item.name;
        aggregated[name] = (aggregated[name] ?? 0) + item.quantity;
      }
    }
    return aggregated;
  }

  Map<String, List<Order>> _groupOrdersByTimeSlot(List<Order> orders) {
    final Map<String, List<Order>> groups = {};
    for (final order in orders) {
      final slot = order.pickupSlot ?? 'ASAP (Instant)';
      groups.putIfAbsent(slot, () => []).add(order);
    }
    return groups;
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

    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF111827) : const Color(0xFFFBFCFF),
      body: Column(
        children: [
          _buildHeader(user, isDark),
          _buildStatsBar(pendingOrders, preparingOrders, readyOrders, isDark),
          _buildViewToggle(isDark),
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator(color: Color(0xFFF59E0B)))
                : _error != null
                    ? _buildError()
                    : _buildMainContent(isDark),
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
                    Text('Chef Dashboard', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: isDark ? Colors.white : const Color(0xFF1F2937))),
                    Text('${_activeOrders.length} active · ${_completedOrders.length} done · Live', style: TextStyle(fontSize: 11, color: Colors.green[500])),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(color: Colors.green.withOpacity(0.1), borderRadius: BorderRadius.circular(8), border: Border.all(color: Colors.green.withOpacity(0.3))),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  Container(width: 6, height: 6, decoration: const BoxDecoration(color: Colors.green, shape: BoxShape.circle)),
                  const SizedBox(width: 4),
                  Text('5s', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.green[600])),
                ]),
              ),
              const SizedBox(width: 8),
              IconButton(icon: Icon(Icons.refresh, color: isDark ? Colors.white : Colors.grey[700]), onPressed: _loadOrders),
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
                            Navigator.of(context).pushAndRemoveUntil(
                              MaterialPageRoute(builder: (_) => LoginScreen(onNavigateLegal: (page) => Navigator.pushNamed(context, '/legal/$page'))),
                              (route) => false,
                            );
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
        decoration: BoxDecoration(color: color.withOpacity(0.08), borderRadius: BorderRadius.circular(10), border: Border.all(color: color.withOpacity(0.2))),
        child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          Icon(icon, color: color, size: 14),
          const SizedBox(width: 4),
          Column(children: [
            Text(count, style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: color)),
            Text(label, style: TextStyle(fontSize: 9, color: color, fontWeight: FontWeight.w600)),
          ]),
        ]),
      ),
    );
  }

  Widget _buildViewToggle(bool isDark) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      color: isDark ? const Color(0xFF111827) : const Color(0xFFFBFCFF),
      child: Row(
        children: [
          _toggleBtn('Orders', 'orders', isDark),
          const SizedBox(width: 8),
          _toggleBtn('Cook List', 'cooklist', isDark),
          const SizedBox(width: 8),
          _toggleBtn('Pre-book', 'prebook', isDark),
        ],
      ),
    );
  }

  Widget _toggleBtn(String label, String mode, bool isDark) {
    final selected = _viewMode == mode;
    return GestureDetector(
      onTap: () => setState(() => _viewMode = mode),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        decoration: BoxDecoration(
          color: selected ? const Color(0xFFEA580C) : (isDark ? const Color(0xFF1F2937) : Colors.grey[100]),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: selected ? const Color(0xFFEA580C) : Colors.grey[300]!),
        ),
        child: Text(label, style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: selected ? Colors.white : (isDark ? Colors.grey[300] : Colors.grey[700]))),
      ),
    );
  }

  Widget _buildMainContent(bool isDark) {
    switch (_viewMode) {
      case 'cooklist':
        return _buildCookList(isDark);
      case 'prebook':
        return _buildPrebookView(isDark);
      default:
        return _buildOrdersView(isDark);
    }
  }

  Widget _buildOrdersView(bool isDark) {
    final pending = _allOrders.where((o) => o.status == 'scheduled' || o.status == 'pending').toList();
    final preparing = _allOrders.where((o) => o.status == 'preparing').toList();
    final ready = _allOrders.where((o) => o.status == 'ready').toList();
    final completed = _completedOrders;
    final hasAny = pending.isNotEmpty || preparing.isNotEmpty || ready.isNotEmpty || completed.isNotEmpty;

    return RefreshIndicator(
      onRefresh: _loadOrders,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (pending.isNotEmpty) ...[
            _buildSectionHeader('Incoming Orders', pending.length, const Color(0xFF2563EB), isDark),
            ...pending.map((o) => _buildOrderCard(o, 'incoming', isDark)),
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
          if (!hasAny) _buildEmptyState(isDark),
        ],
      ),
    );
  }

  Widget _buildCookList(bool isDark) {
    final toCook = _activeOrders.where((o) => o.status == 'scheduled' || o.status == 'pending' || o.status == 'preparing').toList();
    final aggregated = _aggregateFoodItems(toCook);

    if (aggregated.isEmpty) {
      return Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
        Icon(Icons.restaurant_menu, size: 64, color: isDark ? Colors.grey[600] : Colors.grey[300]),
        const SizedBox(height: 12),
        Text('Nothing to cook!', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: isDark ? Colors.grey[400] : Colors.grey[600])),
        const SizedBox(height: 4),
        Text('All orders are ready or completed.', style: TextStyle(fontSize: 13, color: isDark ? Colors.grey[500] : Colors.grey[500])),
      ]));
    }

    final sorted = aggregated.entries.toList()..sort((a, b) => b.value.compareTo(a.value));

    return RefreshIndicator(
      onRefresh: _loadOrders,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _buildSectionHeader('Aggregated Cook List', sorted.length, const Color(0xFFEA580C), isDark),
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(color: const Color(0xFFEA580C).withOpacity(0.08), borderRadius: BorderRadius.circular(10)),
            child: Text('${toCook.length} orders · ${sorted.length} unique items', style: TextStyle(fontSize: 11, color: Colors.orange[700], fontWeight: FontWeight.w600)),
          ),
          const SizedBox(height: 8),
          ...sorted.map((entry) {
            final itemName = entry.key;
            final totalQty = entry.value;
            final ordersForItem = toCook.where((o) => o.items.any((i) => i.name == itemName)).toList();
            final orderCount = ordersForItem.length;

            return Container(
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF1F2937) : Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFEA580C).withOpacity(0.3)),
                boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 6, offset: const Offset(0, 2))],
              ),
              child: Row(
                children: [
                  Container(
                    width: 48, height: 48,
                    decoration: BoxDecoration(color: const Color(0xFFEA580C).withOpacity(0.1), borderRadius: BorderRadius.circular(12)),
                    child: Center(child: Text('x$totalQty', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFFEA580C)))),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(itemName, style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87)),
                        const SizedBox(height: 2),
                        Text('$orderCount order${orderCount > 1 ? 's' : ''} · $totalQty total needed', style: TextStyle(fontSize: 11, color: Colors.grey[500])),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(color: const Color(0xFFEA580C), borderRadius: BorderRadius.circular(8)),
                    child: Text('Cook $totalQty', style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold)),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }

  Widget _buildPrebookView(bool isDark) {
    final grouped = _groupOrdersByTimeSlot(_prebookOrders);

    if (grouped.isEmpty) {
      return Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
        Icon(Icons.schedule, size: 64, color: isDark ? Colors.grey[600] : Colors.grey[300]),
        const SizedBox(height: 12),
        Text('No pre-booked orders', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: isDark ? Colors.grey[400] : Colors.grey[600])),
        const SizedBox(height: 4),
        Text('Pre-booked orders will appear here.', style: TextStyle(fontSize: 13, color: isDark ? Colors.grey[500] : Colors.grey[500])),
      ]));
    }

    final sortedSlots = grouped.entries.toList()..sort((a, b) => a.key.compareTo(b.key));

    return RefreshIndicator(
      onRefresh: _loadOrders,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _buildSectionHeader('Pre-booked Orders', _prebookOrders.length, const Color(0xFF8B5CF6), isDark),
          ...sortedSlots.map((entry) {
            final slot = entry.key;
            final orders = entry.value;
            final aggregated = _aggregateFoodItems(orders);

            return Container(
              margin: const EdgeInsets.only(bottom: 12),
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF1F2937) : Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFF8B5CF6).withOpacity(0.3)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    decoration: BoxDecoration(color: const Color(0xFF8B5CF6).withOpacity(0.1), borderRadius: const BorderRadius.only(topLeft: Radius.circular(12), topRight: Radius.circular(12))),
                    child: Row(children: [
                      const Icon(Icons.access_time, size: 14, color: Color(0xFF8B5CF6)),
                      const SizedBox(width: 6),
                      Text(slot, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF8B5CF6))),
                      const SizedBox(width: 8),
                      Text('${orders.length} orders', style: TextStyle(fontSize: 11, color: Colors.grey[500])),
                    ]),
                  ),
                  ...orders.map((o) => _buildOrderCard(o, 'prebook', isDark)),
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(color: const Color(0xFFEA580C).withOpacity(0.06), borderRadius: const BorderRadius.only(bottomLeft: Radius.circular(12), bottomRight: Radius.circular(12))),
                    child: Wrap(
                      spacing: 8,
                      runSpacing: 4,
                      children: aggregated.entries.map((e) => Chip(
                        label: Text('${e.key} x${e.value}', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                        backgroundColor: const Color(0xFFEA580C).withOpacity(0.1),
                        side: const BorderSide(color: Color(0xFFEA580C), width: 0.5),
                        materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        visualDensity: VisualDensity.compact,
                      )).toList(),
                    ),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }

  Widget _buildSectionHeader(String title, int count, Color color, bool isDark) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(children: [
        Container(width: 4, height: 16, decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(2))),
        const SizedBox(width: 8),
        Text(title, style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87)),
        const SizedBox(width: 8),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
          decoration: BoxDecoration(color: color.withOpacity(0.15), borderRadius: BorderRadius.circular(10)),
          child: Text('$count', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: color)),
        ),
      ]),
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
        statusLabel = 'Ready';
        actions = [
          _actionButton('Served', Icons.check_circle, const Color(0xFF16A34A), () => _updateStatus(order.id, 'collected')),
        ];
        break;
      case 'preparing':
        statusColor = const Color(0xFFEA580C);
        statusLabel = 'Cooking';
        actions = [
          _actionButton('Done', Icons.check, const Color(0xFF16A34A), () => _updateStatus(order.id, 'ready')),
        ];
        break;
      default:
        statusColor = const Color(0xFF2563EB);
        statusLabel = order.pickupSlot != null && order.pickupSlot!.isNotEmpty && order.pickupSlot != 'ASAP (Instant)' ? 'Pre-book' : 'New';
        actions = [
          _actionButton('Cook', Icons.play_arrow, const Color(0xFFEA580C), () => _updateStatus(order.id, 'preparing')),
        ];
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1F2937) : Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border(left: BorderSide(color: statusColor, width: 3)),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 6, offset: const Offset(0, 2))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Expanded(child: Text(order.id, style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87))),
            if (liveTime.isNotEmpty)
              Padding(padding: const EdgeInsets.only(right: 8), child: Text(liveTime, style: TextStyle(fontSize: 10, color: Colors.grey[500], fontStyle: FontStyle.italic))),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(color: statusColor.withOpacity(0.15), borderRadius: BorderRadius.circular(8)),
              child: Text(statusLabel, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: statusColor)),
            ),
          ]),
          const SizedBox(height: 4),
          Text(order.userName.isNotEmpty ? order.userName : 'Customer', style: TextStyle(fontSize: 11, color: isDark ? Colors.grey[300] : Colors.grey[700])),
          const SizedBox(height: 4),
          ...order.items.map((item) => Padding(
            padding: const EdgeInsets.only(bottom: 2),
            child: Row(children: [
              Container(
                width: 20, height: 20,
                decoration: BoxDecoration(color: const Color(0xFFEA580C).withOpacity(0.1), borderRadius: BorderRadius.circular(4)),
                child: Center(child: Text('${item.quantity}', style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFFEA580C)))),
              ),
              const SizedBox(width: 6),
              Expanded(child: Text(item.name, style: TextStyle(fontSize: 12, color: isDark ? Colors.grey[300] : Colors.grey[700]))),
            ]),
          )),
          if (order.pickupSlot != null && order.pickupSlot!.isNotEmpty && order.pickupSlot != 'ASAP (Instant)') ...[
            const SizedBox(height: 4),
            Row(children: [
              const Icon(Icons.access_time, size: 12, color: Color(0xFF8B5CF6)),
              const SizedBox(width: 4),
              Text('Slot: ${order.pickupSlot}', style: const TextStyle(fontSize: 11, color: Color(0xFF8B5CF6), fontWeight: FontWeight.w600)),
            ]),
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
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(8)),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon, color: Colors.white, size: 16),
          const SizedBox(width: 4),
          Text(label, style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600)),
        ]),
      ),
    );
  }

  Widget _buildError() {
    return Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
      const Icon(Icons.error_outline, color: Colors.red, size: 48),
      const SizedBox(height: 12),
      Text(_error ?? 'Unknown error', style: const TextStyle(color: Colors.red)),
      const SizedBox(height: 12),
      ElevatedButton(onPressed: _loadOrders, child: const Text('Retry')),
    ]));
  }

  Widget _buildEmptyState(bool isDark) {
    return Container(
      padding: const EdgeInsets.all(40),
      child: Column(children: [
        Icon(Icons.kitchen, size: 64, color: isDark ? Colors.grey[600] : Colors.grey[300]),
        const SizedBox(height: 12),
        Text('All clear!', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: isDark ? Colors.grey[400] : Colors.grey[600])),
        const SizedBox(height: 4),
        Text('No orders in the queue right now.', style: TextStyle(fontSize: 13, color: isDark ? Colors.grey[500] : Colors.grey[500])),
      ]),
    );
  }
}
