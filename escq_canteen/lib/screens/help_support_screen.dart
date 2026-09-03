import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:url_launcher/url_launcher.dart';
import '../config.dart';

class HelpSupportScreen extends StatefulWidget {
  const HelpSupportScreen({super.key});

  @override
  State<HelpSupportScreen> createState() => _HelpSupportScreenState();
}

class _HelpSupportScreenState extends State<HelpSupportScreen> {
  final _nameCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _subjectCtrl = TextEditingController();
  final _messageCtrl = TextEditingController();
  String _selectedCategory = 'General Inquiry';
  bool _submitted = false;
  bool _submitting = false;

  final _categories = [
    'General Inquiry',
    'Payment Issue',
    'Order Problem',
    'Account Help',
    'Bug Report',
    'Feature Request',
  ];

  final _faqItems = [
    {
      'q': 'How do I place an order?',
      'a': 'Browse the menu, add items to your cart, select a pickup slot, and complete payment. You\'ll receive a QR ticket to show at the counter.',
    },
    {
      'q': 'How do I track my order?',
      'a': 'Go to Order History tab to see real-time status updates: Scheduled → Preparing → Ready for Pickup.',
    },
    {
      'q': 'Can I cancel my order?',
      'a': 'You can cancel before the kitchen starts preparing. Contact support for assistance.',
    },
    {
      'q': 'How do I get a refund?',
      'a': 'Refunds are processed within 5-7 business days to the original payment method. Raise a ticket below.',
    },
    {
      'q': 'Payment failed but money was deducted?',
      'a': 'Don\'t worry. The amount will be auto-refunded within 24-48 hours. If not, raise a support ticket.',
    },
  ];

  @override
  void dispose() {
    _nameCtrl.dispose();
    _emailCtrl.dispose();
    _subjectCtrl.dispose();
    _messageCtrl.dispose();
    super.dispose();
  }

  Future<void> _submitTicket() async {
    if (_nameCtrl.text.isEmpty || _emailCtrl.text.isEmpty || _messageCtrl.text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please fill in all required fields'), backgroundColor: Color(0xFFF59E0B)),
      );
      return;
    }
    setState(() => _submitting = true);
    try {
      final resp = await http.post(
        Uri.parse('${AppConfig.apiBase}/api/support/submit'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'userId': '',
          'userName': _nameCtrl.text.trim(),
          'userEmail': _emailCtrl.text.trim(),
          'category': _selectedCategory.toLowerCase().replaceAll(' ', '_'),
          'subject': _subjectCtrl.text.trim().isEmpty ? _selectedCategory : _subjectCtrl.text.trim(),
          'description': _messageCtrl.text.trim(),
        }),
      );
      final data = jsonDecode(resp.body);
      if (data['success'] == true) {
        setState(() { _submitted = true; _submitting = false; });
      } else {
        setState(() => _submitting = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(data['error'] ?? 'Failed to submit ticket'), backgroundColor: Colors.red),
        );
      }
    } catch (e) {
      setState(() => _submitting = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Network error: $e'), backgroundColor: Colors.red),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0D0D12),
      body: Column(
        children: [
          _buildHeader(),
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: _submitted ? _buildSuccess() : _buildContent(),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHeader() {
    return Container(
      color: const Color(0xFF111827),
      child: SafeArea(
        bottom: false,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          child: Row(
            children: [
              GestureDetector(
                onTap: () => Navigator.pop(context),
                child: Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(color: const Color(0xFF1F2937), borderRadius: BorderRadius.circular(8)),
                  child: const Icon(Icons.arrow_back_ios, size: 16, color: Colors.white70),
                ),
              ),
              const SizedBox(width: 12),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Help & Support', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Colors.white)),
                    Text('We\'re here to help', style: TextStyle(fontSize: 10, color: Colors.white54)),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(color: const Color(0xFFF59E0B).withOpacity(0.15), borderRadius: BorderRadius.circular(8)),
                child: const Icon(Icons.headset_mic, size: 16, color: Color(0xFFF59E0B)),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildContent() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildQuickActions(),
        const SizedBox(height: 24),
        _buildFaqSection(),
        const SizedBox(height: 24),
        _buildTicketForm(),
      ],
    );
  }

  Widget _buildQuickActions() {
    return Row(
      children: [
        Expanded(child: _quickAction(Icons.phone, 'Call Us', '+91 9940918442', () => _launchPhone())),
        const SizedBox(width: 8),
        Expanded(child: _quickAction(Icons.email, 'Email Us', 'Support', () => _launchEmail())),
        const SizedBox(width: 8),
        Expanded(child: _quickAction(Icons.chat, 'WhatsApp', 'Chat', () => _launchWhatsApp())),
      ],
    );
  }

  Widget _quickAction(IconData icon, String title, String subtitle, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: const Color(0xFF1F2937),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xFF374151)),
        ),
        child: Column(
          children: [
            Container(
              width: 40, height: 40,
              decoration: BoxDecoration(
                color: const Color(0xFFF59E0B).withOpacity(0.15),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, size: 20, color: const Color(0xFFF59E0B)),
            ),
            const SizedBox(height: 8),
            Text(title, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.white)),
            const SizedBox(height: 2),
            Text(subtitle, style: TextStyle(fontSize: 10, color: Colors.grey[400])),
          ],
        ),
      ),
    );
  }

  Widget _buildFaqSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('FREQUENTLY ASKED QUESTIONS', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFFF59E0B), letterSpacing: 1.2)),
        const SizedBox(height: 12),
        ..._faqItems.map((faq) => _faqTile(faq['q']!, faq['a']!)),
      ],
    );
  }

  Widget _faqTile(String question, String answer) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: const Color(0xFF1F2937),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFF374151)),
      ),
      child: Theme(
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          tilePadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 0),
          childrenPadding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
          iconColor: const Color(0xFFF59E0B),
          collapsedIconColor: Colors.grey,
          title: Text(question, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Colors.white)),
          children: [
            Text(answer, style: TextStyle(fontSize: 12, color: Colors.grey[300], height: 1.5)),
          ],
        ),
      ),
    );
  }

  Widget _buildTicketForm() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFF1F2937),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFF374151)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('SUBMIT A SUPPORT TICKET', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFFF59E0B), letterSpacing: 1.2)),
          const SizedBox(height: 4),
          Text('We typically respond within 2-4 hours', style: TextStyle(fontSize: 11, color: Colors.grey[400])),
          const SizedBox(height: 16),
          _buildTextField('Your Name *', _nameCtrl, Icons.person),
          const SizedBox(height: 12),
          _buildTextField('Email Address *', _emailCtrl, Icons.email, keyboardType: TextInputType.emailAddress),
          const SizedBox(height: 12),
          _buildCategoryDropdown(),
          const SizedBox(height: 12),
          _buildTextField('Subject', _subjectCtrl, Icons.subject),
          const SizedBox(height: 12),
          _buildTextField('Describe your issue *', _messageCtrl, Icons.message, maxLines: 4),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            height: 48,
            child: ElevatedButton(
              onPressed: _submitting ? null : _submitTicket,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFF59E0B),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                elevation: 0,
              ),
              child: _submitting
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                  : const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.send, size: 16),
                        SizedBox(width: 8),
                        Text('Submit Ticket', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold)),
                      ],
                    ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTextField(String label, TextEditingController ctrl, IconData icon, {int maxLines = 1, TextInputType? keyboardType}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label.toUpperCase(), style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.grey[400], letterSpacing: 0.8)),
        const SizedBox(height: 6),
        TextField(
          controller: ctrl,
          maxLines: maxLines,
          keyboardType: keyboardType,
          style: const TextStyle(fontSize: 13, color: Colors.white),
          decoration: InputDecoration(
            prefixIcon: maxLines == 1 ? Icon(icon, size: 18, color: Colors.grey[500]) : null,
            hintText: 'Enter here...',
            hintStyle: TextStyle(fontSize: 12, color: Colors.grey[600]),
            filled: true,
            fillColor: const Color(0xFF111827),
            contentPadding: EdgeInsets.symmetric(horizontal: 14, vertical: maxLines > 1 ? 14 : 13),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: Color(0xFF374151)),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: Color(0xFF374151)),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: Color(0xFFF59E0B), width: 2),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildCategoryDropdown() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('CATEGORY', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.grey[400], letterSpacing: 0.8)),
        const SizedBox(height: 6),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          decoration: BoxDecoration(
            color: const Color(0xFF111827),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: const Color(0xFF374151)),
          ),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              value: _selectedCategory,
              isExpanded: true,
              dropdownColor: const Color(0xFF1F2937),
              style: const TextStyle(fontSize: 12, color: Colors.white),
              icon: const Icon(Icons.keyboard_arrow_down, color: Color(0xFFF59E0B), size: 20),
              items: _categories.map((c) => DropdownMenuItem(value: c, child: Text(c))).toList(),
              onChanged: (v) => setState(() => _selectedCategory = v ?? _selectedCategory),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildSuccess() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(40),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 80, height: 80,
              decoration: BoxDecoration(
                color: const Color(0xFFF59E0B).withOpacity(0.15),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.check_circle, color: Color(0xFFF59E0B), size: 44),
            ),
            const SizedBox(height: 24),
            const Text('Ticket Submitted!', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: Colors.white)),
            const SizedBox(height: 8),
            Text('Our support team will get back to you within 2-4 hours.', style: TextStyle(fontSize: 13, color: Colors.grey[400]), textAlign: TextAlign.center),
            const SizedBox(height: 32),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () => Navigator.pop(context),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFF59E0B),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: const Text('Back to Menu', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold)),
              ),
            ),
            const SizedBox(height: 12),
            TextButton(
              onPressed: () => setState(() {
                _submitted = false;
                _nameCtrl.clear();
                _emailCtrl.clear();
                _subjectCtrl.clear();
                _messageCtrl.clear();
              }),
              child: const Text('Submit Another Ticket', style: TextStyle(fontSize: 12, color: Color(0xFFF59E0B))),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _launchPhone() async {
    final uri = Uri.parse('tel:+919940918442');
    if (await canLaunchUrl(uri)) await launchUrl(uri);
  }

  Future<void> _launchEmail() async {
    final uri = Uri.parse('mailto:escqsupportemail@gmail.com?subject=Help Support Request');
    if (await canLaunchUrl(uri)) await launchUrl(uri);
  }

  Future<void> _launchWhatsApp() async {
    final uri = Uri.parse('https://wa.me/919940918442');
    if (await canLaunchUrl(uri)) await launchUrl(uri, mode: LaunchMode.externalApplication);
  }
}
