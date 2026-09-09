import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../providers/chef_provider.dart';
import '../providers/theme_provider.dart';
import '../models/chef.dart';
import '../services/api_service.dart';

class MyTasksScreen extends StatefulWidget {
  const MyTasksScreen({super.key});

  @override
  State<MyTasksScreen> createState() => _MyTasksScreenState();
}

class _MyTasksScreenState extends State<MyTasksScreen> {
  final ApiService _api = ApiService();
  Timer? _refreshTimer;
  Timer? _tickTimer;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadTasks();
    _refreshTimer = Timer.periodic(const Duration(seconds: 5), (_) => _loadTasks());
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

  Future<void> _loadTasks() async {
    final auth = context.read<AuthProvider>();
    final chefProv = context.read<ChefProvider>();
    final user = auth.user;
    if (user == null) return;

    try {
      final canteenId = user.canteenId ?? 'canteen_001';
      await chefProv.loadChefs(canteenId: canteenId);
      await chefProv.loadKitchenTasks(canteenId: canteenId, chefId: user.id);
      if (mounted) setState(() => _isLoading = false);
    } catch (e) {
      if (mounted) setState(() => _isLoading = false);
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
    final chefProv = context.watch<ChefProvider>();
    final themeProv = context.watch<ThemeProvider>();
    final user = auth.user;
    final isDark = themeProv.isDark;

    final pendingTasks = chefProv.kitchenTasks.where((t) => (t['status'] as String?) == 'PENDING').toList();
    final preparingTasks = chefProv.kitchenTasks.where((t) => (t['status'] as String?) == 'PREPARING').toList();
    final readyTasks = chefProv.kitchenTasks.where((t) => (t['status'] as String?) == 'READY').toList();
    final completedTasks = chefProv.kitchenTasks.where((t) => (t['status'] as String?) == 'COMPLETED' || (t['status'] as String?) == 'CANCELLED').toList();

    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF111827) : const Color(0xFFFBFCFF),
      body: Column(
        children: [
          _buildHeader(user, isDark, auth),
          _buildStatsBar(pendingTasks.length, preparingTasks.length, readyTasks.length, completedTasks.length, isDark),
          Expanded(
            child: _isLoading
                ? Center(child: CircularProgressIndicator(color: const Color(0xFFF59E0B)))
                : RefreshIndicator(
                    onRefresh: _loadTasks,
                    child: ListView(
                      padding: const EdgeInsets.all(16),
                      children: [
                        if (pendingTasks.isNotEmpty) ...[
                          _buildSectionHeader('New Orders', pendingTasks.length, const Color(0xFFF59E0B), isDark),
                          ...pendingTasks.map((t) => _buildTaskCard(t, 'PENDING', isDark, chefProv)),
                          const SizedBox(height: 12),
                        ],
                        if (preparingTasks.isNotEmpty) ...[
                          _buildSectionHeader('Cooking Now', preparingTasks.length, const Color(0xFFEA580C), isDark),
                          ...preparingTasks.map((t) => _buildTaskCard(t, 'PREPARING', isDark, chefProv)),
                          const SizedBox(height: 12),
                        ],
                        if (readyTasks.isNotEmpty) ...[
                          _buildSectionHeader('Ready to Serve', readyTasks.length, Colors.green, isDark),
                          ...readyTasks.map((t) => _buildTaskCard(t, 'READY', isDark, chefProv)),
                          const SizedBox(height: 12),
                        ],
                        if (completedTasks.isNotEmpty) ...[
                          _buildSectionHeader('Completed', completedTasks.length, Colors.grey, isDark),
                          ...completedTasks.take(10).map((t) => _buildTaskCard(t, (t['status'] as String?) ?? '', isDark, chefProv)),
                        ],
                        if (chefProv.kitchenTasks.isEmpty)
                          Center(child: Padding(
                            padding: const EdgeInsets.all(40),
                            child: Column(children: [
                              Icon(Icons.kitchen, size: 64, color: isDark ? Colors.grey[600] : Colors.grey[300]),
                              const SizedBox(height: 12),
                              Text('No tasks assigned', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: isDark ? Colors.grey[400] : Colors.grey[600])),
                              const SizedBox(height: 4),
                              Text('New orders will appear here automatically.', style: TextStyle(fontSize: 13, color: isDark ? Colors.grey[500] : Colors.grey[500])),
                            ]),
                          )),
                      ],
                    ),
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildHeader(dynamic user, bool isDark, AuthProvider auth) {
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
                  color: const Color(0xFFF59E0B),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(Icons.restaurant_menu, color: Colors.white, size: 22),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('My Kitchen Tasks', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: isDark ? Colors.white : const Color(0xFF1F2937))),
                    Text('${user?.name ?? 'Chef'} · Live sync', style: TextStyle(fontSize: 11, color: Colors.green[500])),
                  ],
                ),
              ),
              IconButton(icon: Icon(Icons.refresh, color: isDark ? Colors.white : Colors.grey[700]), onPressed: _loadTasks),
              GestureDetector(
                onTap: () => auth.logout(),
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

  Widget _buildStatsBar(int pending, int preparing, int ready, int done, bool isDark) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      color: isDark ? const Color(0xFF1A2332) : const Color(0xFFFFF8F0),
      child: Row(
        children: [
          _statPill('$pending', 'New', const Color(0xFFF59E0B), Icons.schedule, isDark),
          const SizedBox(width: 8),
          _statPill('$preparing', 'Cooking', const Color(0xFFEA580C), Icons.local_fire_department, isDark),
          const SizedBox(width: 8),
          _statPill('$ready', 'Ready', Colors.green, Icons.check_circle, isDark),
          const SizedBox(width: 8),
          _statPill('$done', 'Done', Colors.grey, Icons.done_all, isDark),
        ],
      ),
    );
  }

  Widget _statPill(String count, String label, Color color, IconData icon, bool isDark) {
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

  Widget _buildSectionHeader(String title, int count, Color color, bool isDark) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8, top: 8),
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

  Widget _buildTaskCard(Map<String, dynamic> task, String status, bool isDark, ChefProvider chefProv) {
    Color statusColor;
    switch (status) {
      case 'PENDING': statusColor = const Color(0xFFF59E0B); break;
      case 'PREPARING': statusColor = const Color(0xFFEA580C); break;
      case 'READY': statusColor = Colors.green; break;
      case 'COMPLETED': statusColor = Colors.purple; break;
      case 'CANCELLED': statusColor = Colors.red; break;
      default: statusColor = Colors.grey;
    }

    final items = (task['items'] as List?)?.map((i) => '${i['quantity']}x ${i['itemName']}').join(', ') ?? 'Unknown items';
    final orderId = task['orderId']?.toString() ?? '';
    final createdAt = (task['createdAt'] as num?)?.toInt();
    final liveTime = _liveElapsed(createdAt);

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1F2937) : Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border(left: BorderSide(color: statusColor, width: 3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Expanded(child: Text('Order: $orderId', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87))),
            if (liveTime.isNotEmpty)
              Padding(padding: const EdgeInsets.only(right: 8), child: Text(liveTime, style: TextStyle(fontSize: 10, color: Colors.grey[500], fontStyle: FontStyle.italic))),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(color: statusColor.withOpacity(0.15), borderRadius: BorderRadius.circular(8)),
              child: Text(status, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: statusColor)),
            ),
          ]),
          const SizedBox(height: 4),
          Text(items, style: TextStyle(fontSize: 12, color: isDark ? Colors.grey[300] : Colors.grey[700])),
          if (status != 'COMPLETED' && status != 'CANCELLED') ...[
            const SizedBox(height: 8),
            Row(children: [
              if (status == 'PENDING')
                Expanded(child: ElevatedButton.icon(
                  icon: const Icon(Icons.play_arrow, size: 14),
                  label: const Text('Start', style: TextStyle(fontSize: 11)),
                  style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFEA580C), foregroundColor: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8))),
                  onPressed: () => chefProv.updateKitchenTaskStatus(taskId: task['id'], status: 'PREPARING'),
                )),
              if (status == 'PREPARING') ...[
                Expanded(child: ElevatedButton.icon(
                  icon: const Icon(Icons.check, size: 14),
                  label: const Text('Mark Ready', style: TextStyle(fontSize: 11)),
                  style: ElevatedButton.styleFrom(backgroundColor: Colors.green, foregroundColor: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8))),
                  onPressed: () => chefProv.updateKitchenTaskStatus(taskId: task['id'], status: 'READY'),
                )),
                const SizedBox(width: 8),
                Expanded(child: OutlinedButton.icon(
                  icon: const Icon(Icons.cancel, size: 14),
                  label: const Text('Cancel', style: TextStyle(fontSize: 11)),
                  style: OutlinedButton.styleFrom(foregroundColor: Colors.red, side: BorderSide(color: Colors.red), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8))),
                  onPressed: () => chefProv.updateKitchenTaskStatus(taskId: task['id'], status: 'CANCELLED'),
                )),
              ],
            ]),
          ],
        ],
      ),
    );
  }
}