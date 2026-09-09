import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../providers/chef_provider.dart';
import '../providers/theme_provider.dart';
import '../models/chef.dart';
import '../models/menu_item.dart';
import '../services/api_service.dart';

class OwnerScreen extends StatefulWidget {
  const OwnerScreen({super.key});

  @override
  State<OwnerScreen> createState() => _OwnerScreenState();
}

class _OwnerScreenState extends State<OwnerScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final ApiService _api = ApiService();
  Timer? _refreshTimer;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _loadData();
    _refreshTimer = Timer.periodic(const Duration(seconds: 10), (_) => _loadData());
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    final auth = context.read<AuthProvider>();
    final chefProv = context.read<ChefProvider>();
    final user = auth.user;
    if (user == null) return;

    try {
      final canteenId = user.canteenId ?? 'canteen_001';
      await Future.wait([
        chefProv.loadChefs(canteenId: canteenId),
        chefProv.loadKitchenTasks(canteenId: canteenId),
        chefProv.loadChefLeave(),
      ]);
      if (mounted) setState(() => _isLoading = false);
    } catch (e) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final chefProv = context.watch<ChefProvider>();
    final themeProv = context.watch<ThemeProvider>();
    final user = auth.user;
    final isDark = themeProv.isDark;

    if (_isLoading) {
      return Scaffold(
        backgroundColor: isDark ? const Color(0xFF111827) : const Color(0xFFFBFCFF),
        body: Center(child: CircularProgressIndicator(color: const Color(0xFFF59E0B))),
      );
    }

    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF111827) : const Color(0xFFFBFCFF),
      body: Column(
        children: [
          _buildHeader(user, isDark, chefProv, auth),
          _buildTabBar(isDark),
          Expanded(
            child: TabBarView(
              controller: _tabController,
              children: [
                _buildChefManagementTab(isDark, chefProv),
                _buildKitchenTasksTab(isDark, chefProv),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHeader(dynamic user, bool isDark, ChefProvider chefProv, AuthProvider auth) {
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
                child: const Icon(Icons.admin_panel_settings, color: Colors.white, size: 22),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Owner Panel', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: isDark ? Colors.white : const Color(0xFF1F2937))),
                    Text('${chefProv.activeChefs.length} active chefs · ${chefProv.kitchenTasks.length} kitchen tasks', style: TextStyle(fontSize: 11, color: Colors.green[500])),
                  ],
                ),
              ),
              IconButton(icon: Icon(Icons.refresh, color: isDark ? Colors.white : Colors.grey[700]), onPressed: _loadData),
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

  Widget _buildTabBar(bool isDark) {
    return Container(
      color: isDark ? const Color(0xFF1F2937) : Colors.white,
      child: TabBar(
        controller: _tabController,
        indicatorColor: const Color(0xFFF59E0B),
        indicatorWeight: 3,
        labelColor: const Color(0xFFF59E0B),
        unselectedLabelColor: isDark ? Colors.grey[400] : Colors.grey[600],
        labelStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
        tabs: const [
          Tab(icon: Icon(Icons.people, size: 18), text: 'Chefs'),
          Tab(icon: Icon(Icons.kitchen, size: 18), text: 'Kitchen'),
        ],
      ),
    );
  }

  Widget _buildChefManagementTab(bool isDark, ChefProvider chefProv) {
    final auth = context.read<AuthProvider>();
    return RefreshIndicator(
      onRefresh: _loadData,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _buildAddChefCard(isDark, chefProv, auth),
          const SizedBox(height: 16),
          _buildSectionHeader('Active Chefs', chefProv.activeChefs.length, Colors.green, isDark),
          ...chefProv.activeChefs.map((c) => _buildChefCard(c, isDark, chefProv, active: true)),
          const SizedBox(height: 16),
          _buildSectionHeader('On Leave', chefProv.onLeaveChefs.length, Colors.orange, isDark),
          ...chefProv.onLeaveChefs.map((c) => _buildChefCard(c, isDark, chefProv, onLeave: true)),
          const SizedBox(height: 16),
          _buildSectionHeader('Inactive', chefProv.inactiveChefs.length, Colors.red, isDark),
          ...chefProv.inactiveChefs.map((c) => _buildChefCard(c, isDark, chefProv, inactive: true)),
        ],
      ),
    );
  }

  Widget _buildAddChefCard(bool isDark, ChefProvider chefProv, AuthProvider auth) {
    final nameCtrl = TextEditingController();
    final phoneCtrl = TextEditingController();
    final emailCtrl = TextEditingController();
    String? selectedUserId;
    List<String> specialization = [];

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1F2937) : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFF59E0B).withOpacity(0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Icon(Icons.person_add, color: const Color(0xFFF59E0B), size: 20),
            const SizedBox(width: 8),
            Text('Add New Chef', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87)),
          ]),
          const SizedBox(height: 12),
          _inputField('Name', nameCtrl, isDark),
          const SizedBox(height: 8),
          _inputField('Phone', phoneCtrl, isDark, keyboard: TextInputType.phone),
          const SizedBox(height: 8),
          _inputField('Email (optional)', emailCtrl, isDark, keyboard: TextInputType.emailAddress),
          const SizedBox(height: 12),
          Row(children: [
            Expanded(
              child: ElevatedButton.icon(
                icon: const Icon(Icons.add, size: 16),
                label: const Text('Create Chef'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFF59E0B),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                onPressed: chefProv.loading ? null : () async {
                  final canteenId = auth.user?.canteenId ?? 'canteen_001';
                  final chef = await chefProv.createChef(
                    canteenId: canteenId,
                    name: nameCtrl.text.trim(),
                    phone: phoneCtrl.text.trim().isEmpty ? null : phoneCtrl.text.trim(),
                    email: emailCtrl.text.trim().isEmpty ? null : emailCtrl.text.trim(),
                    specialization: specialization,
                    userId: selectedUserId,
                  );
                  if (chef != null && mounted) {
                    nameCtrl.clear(); phoneCtrl.clear(); emailCtrl.clear();
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Chef created'), backgroundColor: Colors.green),
                    );
                  }
                },
              ),
            ),
          ]),
        ],
      ),
    );
  }

  Widget _inputField(String label, TextEditingController ctrl, bool isDark, {TextInputType keyboard = TextInputType.text}) {
    return TextField(
      controller: ctrl,
      keyboardType: keyboard,
      style: TextStyle(color: isDark ? Colors.white : Colors.black87),
      decoration: InputDecoration(
        labelText: label,
        labelStyle: TextStyle(color: isDark ? Colors.grey[400] : Colors.grey[600]),
        filled: true,
        fillColor: isDark ? const Color(0xFF2D2D2D) : Colors.grey[50],
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
      ),
    );
  }

  Widget _buildChefCard(Chef chef, bool isDark, ChefProvider chefProv, {bool active = false, bool onLeave = false, bool inactive = false}) {
    Color statusColor = active ? Colors.green : (onLeave ? Colors.orange : Colors.red);
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
            Expanded(child: Text(chef.name, style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87))),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(color: statusColor.withOpacity(0.15), borderRadius: BorderRadius.circular(8)),
              child: Text(chef.statusLabel, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: statusColor)),
            ),
          ]),
          const SizedBox(height: 4),
          if (chef.specialization.isNotEmpty)
            Wrap(
              spacing: 6,
              children: chef.specialization.map((s) => Chip(
                label: Text(s, style: const TextStyle(fontSize: 10)),
                backgroundColor: const Color(0xFFF59E0B).withOpacity(0.1),
                side: BorderSide(color: const Color(0xFFF59E0B).withOpacity(0.3)),
                materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                visualDensity: VisualDensity.compact,
              )).toList(),
            ),
          const SizedBox(height: 8),
          Row(children: [
            Expanded(
              child: OutlinedButton.icon(
                icon: Icon(active ? Icons.pause : Icons.play_arrow, size: 14),
                label: Text(active ? 'Set Unavailable' : 'Set Available', style: const TextStyle(fontSize: 11)),
                style: OutlinedButton.styleFrom(
                  foregroundColor: active ? Colors.orange : Colors.green,
                  side: BorderSide(color: active ? Colors.orange : Colors.green),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
                onPressed: () async {
                  await chefProv.updateChef(chefId: chef.id, status: active ? 'UNAVAILABLE' : 'AVAILABLE');
                },
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: OutlinedButton.icon(
                icon: const Icon(Icons.edit, size: 14),
                label: const Text('Leave', style: TextStyle(fontSize: 11)),
                style: OutlinedButton.styleFrom(
                  foregroundColor: const Color(0xFF8B5CF6),
                  side: BorderSide(color: const Color(0xFF8B5CF6)),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
                onPressed: () => _showLeaveDialog(chef, chefProv, isDark),
              ),
            ),
            const SizedBox(width: 8),
            IconButton(
              icon: Icon(Icons.delete, color: Colors.red, size: 18),
              onPressed: () => _confirmDelete(chef, chefProv),
            ),
          ]),
        ],
      ),
    );
  }

  void _showLeaveDialog(Chef chef, ChefProvider chefProv, bool isDark) {
    int startDate = DateTime.now().millisecondsSinceEpoch;
    int endDate = DateTime.now().add(const Duration(days: 1)).millisecondsSinceEpoch;
    final reasonCtrl = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(builder: (ctx, setState) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text('Set Leave for ${chef.name}', style: const TextStyle(fontWeight: FontWeight.bold)),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          ListTile(
            title: Text('Start: ${DateTime.fromMillisecondsSinceEpoch(startDate).toString().split(' ')[0]}'),
            trailing: IconButton(icon: const Icon(Icons.calendar_today), onPressed: () async {
              final d = await showDatePicker(context: ctx, initialDate: DateTime.fromMillisecondsSinceEpoch(startDate), firstDate: DateTime.now(), lastDate: DateTime.now().add(const Duration(days: 365)));
              if (d != null) setState(() => startDate = d.millisecondsSinceEpoch);
            }),
          ),
          ListTile(
            title: Text('End: ${DateTime.fromMillisecondsSinceEpoch(endDate).toString().split(' ')[0]}'),
            trailing: IconButton(icon: const Icon(Icons.calendar_today), onPressed: () async {
              final d = await showDatePicker(context: ctx, initialDate: DateTime.fromMillisecondsSinceEpoch(endDate), firstDate: DateTime.now(), lastDate: DateTime.now().add(const Duration(days: 365)));
              if (d != null) setState(() => endDate = d.millisecondsSinceEpoch);
            }),
          ),
          TextField(
            controller: reasonCtrl,
            decoration: const InputDecoration(labelText: 'Reason (optional)', border: OutlineInputBorder()),
            maxLines: 2,
          ),
        ]),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(ctx);
              await chefProv.setChefLeave(chefId: chef.id, startDate: startDate, endDate: endDate, reason: reasonCtrl.text);
            },
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF8B5CF6)),
            child: const Text('Set Leave'),
          ),
        ],
      )),
    );
  }

  void _confirmDelete(Chef chef, ChefProvider chefProv) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Delete Chef', style: TextStyle(fontWeight: FontWeight.bold)),
        content: Text('Delete ${chef.name}? This cannot be undone.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(ctx);
              await chefProv.deleteChef(chef.id);
            },
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('Delete'),
          ),
        ],
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

  Widget _buildKitchenTasksTab(bool isDark, ChefProvider chefProv) {
    final pendingTasks = chefProv.kitchenTasks.where((t) => (t['status'] as String?) == 'PENDING').toList();
    final preparingTasks = chefProv.kitchenTasks.where((t) => (t['status'] as String?) == 'PREPARING').toList();
    final readyTasks = chefProv.kitchenTasks.where((t) => (t['status'] as String?) == 'READY').toList();
    final completedTasks = chefProv.kitchenTasks.where((t) => (t['status'] as String?) == 'COMPLETED' || (t['status'] as String?) == 'CANCELLED').toList();

    return RefreshIndicator(
      onRefresh: _loadData,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _buildStatsRow(pendingTasks.length, preparingTasks.length, readyTasks.length, completedTasks.length, isDark),
          const SizedBox(height: 16),
          if (pendingTasks.isNotEmpty) ...[
            _buildSectionHeader('Pending', pendingTasks.length, const Color(0xFFF59E0B), isDark),
            ...pendingTasks.map((t) => _buildTaskCard(t, 'PENDING', isDark, chefProv)),
            const SizedBox(height: 12),
          ],
          if (preparingTasks.isNotEmpty) ...[
            _buildSectionHeader('Preparing', preparingTasks.length, const Color(0xFFEA580C), isDark),
            ...preparingTasks.map((t) => _buildTaskCard(t, 'PREPARING', isDark, chefProv)),
            const SizedBox(height: 12),
          ],
          if (readyTasks.isNotEmpty) ...[
            _buildSectionHeader('Ready', readyTasks.length, Colors.green, isDark),
            ...readyTasks.map((t) => _buildTaskCard(t, 'READY', isDark, chefProv)),
            const SizedBox(height: 12),
          ],
          if (completedTasks.isNotEmpty) ...[
            _buildSectionHeader('Done', completedTasks.length, Colors.grey, isDark),
            ...completedTasks.take(10).map((t) => _buildTaskCard(t, (t['status'] as String?) ?? '', isDark, chefProv)),
          ],
          if (chefProv.kitchenTasks.isEmpty)
            Center(child: Padding(
              padding: const EdgeInsets.all(40),
              child: Column(children: [
                Icon(Icons.kitchen, size: 64, color: isDark ? Colors.grey[600] : Colors.grey[300]),
                const SizedBox(height: 12),
                Text('No kitchen tasks', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: isDark ? Colors.grey[400] : Colors.grey[600])),
              ]),
            )),
        ],
      ),
    );
  }

  Widget _buildStatsRow(int pending, int preparing, int ready, int done, bool isDark) {
    return Row(children: [
      _statPill('$pending', 'Pending', const Color(0xFFF59E0B), Icons.schedule, isDark),
      const SizedBox(width: 8),
      _statPill('$preparing', 'Cooking', const Color(0xFFEA580C), Icons.local_fire_department, isDark),
      const SizedBox(width: 8),
      _statPill('$ready', 'Ready', Colors.green, Icons.check_circle, isDark),
      const SizedBox(width: 8),
      _statPill('$done', 'Done', Colors.grey, Icons.done_all, isDark),
    ]);
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
    final chefName = task['chefName']?.toString() ?? 'Unassigned';
    final orderId = task['orderId']?.toString() ?? '';

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
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(color: statusColor.withOpacity(0.15), borderRadius: BorderRadius.circular(8)),
              child: Text(status, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: statusColor)),
            ),
          ]),
          const SizedBox(height: 4),
          Text('Chef: $chefName', style: TextStyle(fontSize: 11, color: isDark ? Colors.grey[300] : Colors.grey[700])),
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
                  label: const Text('Ready', style: TextStyle(fontSize: 11)),
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