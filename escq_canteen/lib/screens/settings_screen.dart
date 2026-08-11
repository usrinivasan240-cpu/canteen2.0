import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../providers/theme_provider.dart';
import 'help_support_screen.dart';
import 'login_screen.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  bool _editingProfile = false;
  late TextEditingController _nameCtrl;
  late TextEditingController _phoneCtrl;
  late TextEditingController _regNoCtrl;

  @override
  void initState() {
    super.initState();
    final user = context.read<AuthProvider>().user;
    _nameCtrl = TextEditingController(text: user?.name ?? '');
    _phoneCtrl = TextEditingController(text: user?.phone ?? '');
    _regNoCtrl = TextEditingController(text: user?.registerNumber ?? '');
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _phoneCtrl.dispose();
    _regNoCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final themeProv = context.watch<ThemeProvider>();
    final user = auth.user;

    return Scaffold(
      backgroundColor: themeProv.isDark ? const Color(0xFF111827) : const Color(0xFFFBFCFF),
      appBar: AppBar(
        backgroundColor: themeProv.isDark ? const Color(0xFF1F2937) : Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: Icon(Icons.arrow_back_ios, size: 18, color: themeProv.isDark ? Colors.white : Colors.black87),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text('Settings', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: themeProv.isDark ? Colors.white : Colors.black87)),
        centerTitle: true,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _sectionTitle('PROFILE', themeProv),
            const SizedBox(height: 8),
            _profileCard(user, themeProv),
            const SizedBox(height: 24),
            _sectionTitle('PREFERENCES', themeProv),
            const SizedBox(height: 8),
            _themeTile(themeProv),
            const SizedBox(height: 24),
            _sectionTitle('LEGAL', themeProv),
            const SizedBox(height: 8),
            _legalTile('Privacy Policy', Icons.lock, themeProv),
            _legalTile('Terms & Conditions', Icons.description, themeProv),
            _legalTile('Refund Policy', Icons.replay, themeProv),
            _legalTile('About Us', Icons.info_outline, themeProv),
            _legalTile('Contact Us', Icons.mail_outline, themeProv),
            const SizedBox(height: 8),
            GestureDetector(
              onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const HelpSupportScreen())),
              child: Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                decoration: BoxDecoration(
                  color: const Color(0xFFF59E0B).withOpacity(0.1),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFF59E0B).withOpacity(0.3)),
                ),
                child: const Row(
                  children: [
                    Icon(Icons.headset_mic, size: 18, color: Color(0xFFF59E0B)),
                    SizedBox(width: 12),
                    Expanded(child: Text('Help & Support', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFFF59E0B)))),
                    Icon(Icons.chevron_right, size: 18, color: Color(0xFFF59E0B)),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 32),
            _logoutBtn(auth),
          ],
        ),
      ),
    );
  }

  Widget _sectionTitle(String title, ThemeProvider themeProv) {
    return Text(title, style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: themeProv.isDark ? Colors.grey[400] : Colors.grey[500], letterSpacing: 1.2));
  }

  Widget _profileCard(dynamic user, ThemeProvider themeProv) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: themeProv.isDark ? const Color(0xFF1F2937) : Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: themeProv.isDark ? const Color(0xFF374151) : const Color(0xFFFEE2E2)),
      ),
      child: Column(
        children: [
          Row(
            children: [
              CircleAvatar(
                radius: 24,
                backgroundColor: const Color(0xFFF59E0B),
                child: Text(
                  (user?.name ?? 'U').substring(0, 1).toUpperCase(),
                  style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.white),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(user?.name ?? 'User', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: themeProv.isDark ? Colors.white : Colors.black87)),
                    const SizedBox(height: 2),
                    Text(user?.email ?? '', style: TextStyle(fontSize: 11, color: themeProv.isDark ? Colors.grey[400] : Colors.grey)),
                  ],
                ),
              ),
              GestureDetector(
                onTap: () => setState(() => _editingProfile = !_editingProfile),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: _editingProfile ? const Color(0xFFF59E0B).withOpacity(0.1) : Colors.grey[100],
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(_editingProfile ? 'Cancel' : 'Edit', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: _editingProfile ? const Color(0xFFF59E0B) : Colors.grey[600])),
                ),
              ),
            ],
          ),
          if (_editingProfile) ...[
            const SizedBox(height: 16),
            _field('Name', _nameCtrl, themeProv),
            const SizedBox(height: 10),
            _field('Phone', _phoneCtrl, themeProv),
            const SizedBox(height: 10),
            _field('Register Number', _regNoCtrl, themeProv),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              height: 38,
              child: ElevatedButton(
                onPressed: () {
                  setState(() => _editingProfile = false);
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Profile updated locally. Server sync pending.'), backgroundColor: Color(0xFFF59E0B)),
                  );
                },
                style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFF59E0B), foregroundColor: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8))),
                child: const Text('Save Changes', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
              ),
            ),
          ],
          if (!_editingProfile) ...[
            const SizedBox(height: 12),
            _infoRow('Role', user?.role?.toUpperCase() ?? 'CUSTOMER', themeProv),
            _infoRow('College ID', user?.collegeId ?? 'N/A', themeProv),
            _infoRow('Phone', user?.phone ?? 'Not set', themeProv),
          ],
        ],
      ),
    );
  }

  Widget _field(String label, TextEditingController ctrl, ThemeProvider themeProv) {
    return TextField(
      controller: ctrl,
      decoration: InputDecoration(
        labelText: label,
        labelStyle: TextStyle(fontSize: 11, color: themeProv.isDark ? Colors.grey[400] : Colors.grey),
        filled: true,
        fillColor: themeProv.isDark ? const Color(0xFF111827) : Colors.grey[50],
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide(color: themeProv.isDark ? const Color(0xFF374151) : const Color(0xFFFEE2E2))),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide(color: themeProv.isDark ? const Color(0xFF374151) : const Color(0xFFFEE2E2))),
      ),
      style: TextStyle(fontSize: 12, color: themeProv.isDark ? Colors.white : Colors.black87),
    );
  }

  Widget _infoRow(String label, String value, ThemeProvider themeProv) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(fontSize: 11, color: themeProv.isDark ? Colors.grey[400] : Colors.grey)),
          Text(value, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: themeProv.isDark ? Colors.white : Colors.black87)),
        ],
      ),
    );
  }

  Widget _themeTile(ThemeProvider themeProv) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: themeProv.isDark ? const Color(0xFF1F2937) : Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: themeProv.isDark ? const Color(0xFF374151) : const Color(0xFFFEE2E2)),
      ),
      child: Row(
        children: [
          Icon(themeProv.isDark ? Icons.dark_mode : Icons.light_mode, size: 20, color: const Color(0xFFF59E0B)),
          const SizedBox(width: 12),
          Expanded(child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Theme', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: themeProv.isDark ? Colors.white : Colors.black87)),
              Text(themeProv.isDark ? 'Dark Mode' : 'Light Mode', style: TextStyle(fontSize: 10, color: themeProv.isDark ? Colors.grey[400] : Colors.grey)),
            ],
          )),
          Switch(
            value: themeProv.isDark,
            onChanged: (_) => themeProv.toggleTheme(),
            activeColor: const Color(0xFFF59E0B),
          ),
        ],
      ),
    );
  }

  Widget _legalTile(String title, IconData icon, ThemeProvider themeProv) {
    return GestureDetector(
      onTap: () => _showLegalPage(title),
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: themeProv.isDark ? const Color(0xFF1F2937) : Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: themeProv.isDark ? const Color(0xFF374151) : const Color(0xFFFEE2E2)),
        ),
        child: Row(
          children: [
            Icon(icon, size: 18, color: const Color(0xFFF59E0B)),
            const SizedBox(width: 12),
            Expanded(child: Text(title, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: themeProv.isDark ? Colors.white : Colors.black87))),
            Icon(Icons.chevron_right, size: 18, color: themeProv.isDark ? Colors.grey[500] : Colors.grey),
          ],
        ),
      ),
    );
  }

  Widget _logoutBtn(AuthProvider auth) {
    return SizedBox(
      width: double.infinity,
      height: 44,
      child: ElevatedButton(
        onPressed: () async {
          await auth.logout();
          if (mounted) Navigator.of(context).pushAndRemoveUntil(
            MaterialPageRoute(builder: (_) => const LoginScreen()),
            (route) => false,
          );
        },
        style: ElevatedButton.styleFrom(backgroundColor: Colors.amber[50], foregroundColor: Colors.amber[700], shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: BorderSide(color: Colors.amber[200]!))),
        child: const Text('Logout', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
      ),
    );
  }

  void _showLegalPage(String page) {
    String title = page;
    String content;
    switch (page) {
      case 'About Us':
        title = 'About Esc(Q)';
        content = 'Esc(Q) is a Smart Campus Canteen Platform developed and operated by AUTO HUB SOLUTION (AHS).\n\n'
            'The platform enables students, faculty members, educational institutions, and participating canteens to browse digital menus, place food orders, make secure online payments, receive real-time order updates, and collect food efficiently.\n\n'
            'Our Mission:\nModernize campus dining by reducing waiting time, improving operational efficiency, minimizing food wastage, and delivering a seamless digital food ordering experience.\n\n'
            'Parent Organization:\nAUTO HUB SOLUTION (AHS) is an MSME (Udyam) registered technology enterprise focused on developing software products, automation systems, AI-powered solutions, and digital platforms.';
        break;
      case 'Contact Us':
        title = 'Contact Us';
        content = 'Legal Entity: AUTO HUB SOLUTION (AHS)\n'
            'Support Email: escqsupportemail@gmail.com\n'
            'Business Email: ahsglobalservices@gmail.com\n'
            'Alternative Email: autohubsolution777@gmail.com\n'
            'Support Mobile: +91 9940918442\n'
            'Support Hours: Mon\u2013Sat, 9:00 AM \u2013 6:00 PM IST';
        break;
      case 'Privacy Policy':
        title = 'Privacy Policy';
        content = 'Effective Date: January 2026\n\n'
            'This Privacy Policy describes how AUTO HUB SOLUTION (AHS) ("we," "us," or "our") collects, uses, stores, and protects your personal information when you use the Esc(Q) platform.\n\n'
            '1. Information We Collect:\n\u2022 Account Information: Name, email, mobile number, college name, student/staff ID\n'
            '\u2022 Order Data: Food orders, cart items, payment confirmations, order history\n'
            '\u2022 Device & Usage Data: Browser type, device info, IP address, interaction logs\n\n'
            '2. How We Use Your Information:\nWe use your data to process orders, manage your account, communicate order updates, improve the platform, and ensure security.\n\n'
            '3. Data Sharing:\nWe do not sell your personal data. Information is shared only with participating canteens for order fulfillment, payment gateways, and government authorities when legally required.\n\n'
            '4. Data Security:\nWe implement industry-standard encryption, secure servers, and access controls.\n\n'
            '5. Your Rights:\nYou may request access, correction, or deletion of your personal data by contacting support.';
        break;
      case 'Terms & Conditions':
        title = 'Terms & Conditions';
        content = 'Effective Date: January 2026\n\n'
            'These Terms & Conditions govern your use of the Esc(Q) platform operated by AUTO HUB SOLUTION (AHS).\n\n'
            '1. Eligibility:\nEsc(Q) is intended for students, faculty, and staff of educational institutions with active canteen partnerships. Users must be at least 16 years of age.\n\n'
            '2. Account Responsibility:\nYou are responsible for maintaining the confidentiality of your account credentials.\n\n'
            '3. Orders & Payments:\nAll orders are subject to item availability. Payments are processed through secure third-party payment gateways.\n\n'
            '4. Order Cancellation:\nOrders may be cancelled before kitchen preparation begins.\n\n'
            '5. User Conduct:\nUsers shall not misuse the platform, attempt unauthorized access, or provide false information.\n\n'
            '6. Intellectual Property:\nAll content, logos, designs, and software on Esc(Q) are the property of AUTO HUB SOLUTION (AHS).\n\n'
            '7. Governing Law:\nThese terms are governed by the laws of India. Disputes subject to courts in Tamil Nadu.';
        break;
      case 'Refund Policy':
        title = 'Refund & Cancellation Policy';
        content = 'Effective Date: January 2026\n\n'
            '1. Order Cancellation by User:\nYou may cancel at no charge if the kitchen has not yet started preparation.\n\n'
            '2. Cancellation by Canteen:\nIf a canteen cannot fulfill an order, a full refund will be initiated within 5\u20137 business days.\n\n'
            '3. Refund Eligibility:\nRefunds apply for duplicate charges, orders not received, incorrect items, or canteen-cancelled orders. Requests must be raised within 24 hours.\n\n'
            '4. Refund Process:\nApproved refunds are processed to the original payment method within 5\u20137 business days.\n\n'
            '5. Non-Refundable Situations:\nRefunds do not apply for successfully delivered orders, change of mind, or taste/portion complaints.\n\n'
            '6. Dispute Resolution:\nContact escqsupportemail@gmail.com with your order ID and issue description.';
        break;
      default:
        content = '';
    }
    showDialog(
      context: context,
      builder: (ctx) => Dialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        backgroundColor: const Color(0xFF1F2937),
        child: Container(
          constraints: const BoxConstraints(maxWidth: 420, maxHeight: 500),
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 40, height: 40,
                    decoration: BoxDecoration(color: const Color(0xFFF59E0B), borderRadius: BorderRadius.circular(12)),
                    child: Icon(
                      page == 'About Us' ? Icons.info :
                      page == 'Contact Us' ? Icons.mail :
                      page == 'Privacy Policy' ? Icons.lock :
                      page == 'Terms & Conditions' ? Icons.description : Icons.replay,
                      color: Colors.white, size: 22,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(child: Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white))),
                  GestureDetector(onTap: () => Navigator.pop(ctx), child: const Icon(Icons.close, size: 20, color: Colors.grey)),
                ],
              ),
              const SizedBox(height: 16),
              const Divider(color: Color(0xFF374151)),
              const SizedBox(height: 8),
              Flexible(
                child: SingleChildScrollView(
                  child: Text(content, style: const TextStyle(fontSize: 13, height: 1.6, color: Color(0xFFD1D5DB))),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
