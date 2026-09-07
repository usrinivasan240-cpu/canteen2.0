import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../providers/theme_provider.dart';
import '../services/api_service.dart';
import '../models/order.dart';
import 'help_support_screen.dart';

class MySupportTicketsScreen extends StatefulWidget {
  const MySupportTicketsScreen({super.key});

  @override
  State<MySupportTicketsScreen> createState() => _MySupportTicketsScreenState();
}

class _MySupportTicketsScreenState extends State<MySupportTicketsScreen> {
  final ApiService _api = ApiService();
  List<SupportTicket> _tickets = [];
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadTickets();
  }

  Future<void> _loadTickets() async {
    final auth = context.read<AuthProvider>();
    final user = auth.user;
    if (user == null) return;

    try {
      final tickets = await _api.getSupportTickets(user.id);
      if (mounted) {
        setState(() {
          _tickets = tickets;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() { _error = e.toString(); _isLoading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final themeProv = context.watch<ThemeProvider>();
    final isDark = themeProv.isDark;

    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF0D0D12) : const Color(0xFFF9FAFB),
      appBar: AppBar(
        backgroundColor: isDark ? const Color(0xFF111827) : Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: Icon(Icons.arrow_back_ios, size: 18, color: isDark ? Colors.white : Colors.black),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text('My Support Tickets', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
        centerTitle: true,
      ),
      body: _isLoading
          ? Center(child: CircularProgressIndicator(color: const Color(0xFFF59E0B)))
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.error_outline, size: 48, color: Colors.red[400]),
                        const SizedBox(height: 16),
                        Text('Failed to load tickets', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black)),
                        const SizedBox(height: 8),
                        Text(_error!, style: TextStyle(fontSize: 12, color: Colors.grey[500]), textAlign: TextAlign.center),
                        const SizedBox(height: 16),
                        ElevatedButton.icon(
                          onPressed: () { setState(() { _isLoading = true; _error = null; _loadTickets(); }); },
                          icon: const Icon(Icons.refresh, size: 16),
                          label: const Text('Retry'),
                          style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFF59E0B), foregroundColor: Colors.white),
                        ),
                      ],
                    ),
                  ),
                )
              : _tickets.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.confirmation_number_outlined, size: 64, color: isDark ? Colors.grey[700] : Colors.grey[300]),
                          const SizedBox(height: 16),
                          Text('No Support Tickets', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black)),
                          const SizedBox(height: 8),
                          Text('Your submitted tickets will appear here', style: TextStyle(fontSize: 13, color: Colors.grey[500])),
                          const SizedBox(height: 16),
                          ElevatedButton.icon(
                            onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const HelpSupportScreen())),
                            icon: const Icon(Icons.add, size: 16),
                            label: const Text('Submit a Ticket', style: TextStyle(fontWeight: FontWeight.bold)),
                            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFF59E0B), foregroundColor: Colors.white, padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
                          ),
                        ],
                      ),
                    )
                  : RefreshIndicator(
                      onRefresh: _loadTickets,
                      color: const Color(0xFFF59E0B),
                      child: ListView.separated(
                        padding: const EdgeInsets.all(16),
                        itemCount: _tickets.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 12),
                        itemBuilder: (_, i) => _buildTicketCard(_tickets[i], isDark),
                      ),
                    ),
    );
  }

  Widget _buildTicketCard(SupportTicket ticket, bool isDark) {
    final hasReply = ticket.adminReply != null && ticket.adminReply!.isNotEmpty;

    Color statusColor;
    switch (ticket.status) {
      case 'open': statusColor = const Color(0xFF2563EB); break;
      case 'in_progress': statusColor = const Color(0xFFEA580C); break;
      case 'resolved': statusColor = const Color(0xFF16A34A); break;
      case 'closed': statusColor = Colors.grey; break;
      default: statusColor = Colors.grey;
    }

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1F2937) : Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: isDark ? const Color(0xFF374151) : const Color(0xFFE5E7EB)),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.03), blurRadius: 8, offset: const Offset(0, 2))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(color: statusColor.withOpacity(0.15), borderRadius: BorderRadius.circular(8)),
                child: Text(ticket.statusLabel, style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: statusColor)),
              ),
              const SizedBox(width: 8),
              Text(ticket.category, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: isDark ? Colors.grey[400] : Colors.grey[600])),
              const Spacer(),
              Text('#${ticket.id}', style: TextStyle(fontSize: 10, color: isDark ? Colors.grey[500] : Colors.grey[400], fontFamily: 'monospace')),
            ],
          ),
          const SizedBox(height: 10),
          Text(ticket.subject, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: isDark ? Colors.white : Colors.black)),
          const SizedBox(height: 6),
          Text(ticket.description, style: TextStyle(fontSize: 12, color: isDark ? Colors.grey[300] : Colors.grey[700])),
          const SizedBox(height: 8),
          Row(
            children: [
              Icon(Icons.access_time, size: 12, color: isDark ? Colors.grey[500] : Colors.grey[400]),
              const SizedBox(width: 4),
              Text(_formatDate(ticket.createdAt), style: TextStyle(fontSize: 10, color: isDark ? Colors.grey[500] : Colors.grey[400])),
            ],
          ),
          if (hasReply) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFF59E0B).withOpacity(0.1),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFFF59E0B).withOpacity(0.3)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(Icons.support_agent, size: 12, color: const Color(0xFFF59E0B)),
                      const SizedBox(width: 4),
                      Text('Admin Reply', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: const Color(0xFFF59E0B))),
                      const Spacer(),
                      if (ticket.adminRepliedAt != null)
                        Text(_formatDate(ticket.adminRepliedAt!), style: TextStyle(fontSize: 9, color: Colors.grey[500])),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(ticket.adminReply!, style: TextStyle(fontSize: 12, color: isDark ? Colors.grey[200] : Colors.grey[800])),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  String _formatDate(int ms) {
    final dt = DateTime.fromMillisecondsSinceEpoch(ms);
    return '${dt.day}/${dt.month}/${dt.year} ${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
  }
}