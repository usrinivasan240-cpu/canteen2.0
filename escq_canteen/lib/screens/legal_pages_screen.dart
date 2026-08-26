import 'package:flutter/material.dart';

enum LegalPageType { privacy, terms, refund }

class LegalPagesScreen extends StatelessWidget {
  final LegalPageType page;

  const LegalPagesScreen({super.key, required this.page});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      appBar: AppBar(
        backgroundColor: const Color(0xFFF9FAFB),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Color(0xFF111827)),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          _getTitle(),
          style: const TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.w700,
            color: Color(0xFF111827),
          ),
        ),
        centerTitle: true,
        scrolledUnderElevation: 0,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Container(
          margin: const EdgeInsets.symmetric(horizontal: 16),
          padding: const EdgeInsets.all(32),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFE5E7EB)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.04),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                _getTitle(),
                style: const TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF111827),
                  letterSpacing: -0.5,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                _getSubtitle(),
                style: TextStyle(
                  fontSize: 14,
                  color: Colors.grey[600],
                  fontWeight: FontWeight.w500,
                ),
              ),
              const SizedBox(height: 28),
              ..._buildContent(),
            ],
          ),
        ),
      ),
    );
  }

  String _getTitle() {
    switch (page) {
      case LegalPageType.privacy:
        return 'Privacy Policy';
      case LegalPageType.terms:
        return 'Terms & Conditions';
      case LegalPageType.refund:
        return 'Refund & Cancellation Policy';
    }
  }

  String _getSubtitle() {
    switch (page) {
      case LegalPageType.privacy:
        return 'How we collect, use, and protect your data';
      case LegalPageType.terms:
        return 'Terms of service for using Esc(Q)';
      case LegalPageType.refund:
        return 'Our refund and cancellation policies';
    }
  }

  List<Widget> _buildContent() {
    switch (page) {
      case LegalPageType.privacy:
        return _buildPrivacyContent();
      case LegalPageType.terms:
        return _buildTermsContent();
      case LegalPageType.refund:
        return _buildRefundContent();
    }
  }

  List<Widget> _buildPrivacyContent() {
    return [
      _section('Information We Collect', [
        'We collect information you provide directly to us, such as when you create an account, place an order, or contact us for support.',
        'We automatically collect certain information when you use the App, including your IP address, device information, and usage data.',
        'We may collect location information when you use location-based features, such as finding nearby canteens.',
      ]),
      _section('How We Use Your Information', [
        'To provide, maintain, and improve our services.',
        'To process your orders and payments.',
        'To send you notifications about your orders and account activity.',
        'To communicate with you about promotions and updates (with your consent).',
        'To comply with legal obligations.',
      ]),
      _section('Data Sharing', [
        'We do not sell your personal information.',
        'We may share data with service providers who help us operate the App (e.g., payment processors, cloud hosting).',
        'We may disclose information if required by law or to protect our rights.',
      ]),
      _section('Data Security', [
        'We implement appropriate security measures to protect your information.',
        'All payment data is encrypted and processed by certified payment processors.',
        'We regularly review our security practices.',
      ]),
      _section('Your Rights', [
        'You can access, update, or delete your account information at any time.',
        'You can opt out of marketing communications.',
        'You can request deletion of your personal data (subject to legal obligations).',
      ]),
      _section('Contact Us', [
        'If you have questions about this Privacy Policy, contact us at privacy@escq.app',
      ]),
    ];
  }

  List<Widget> _buildTermsContent() {
    return [
      _section('Acceptance of Terms', [
        'By using the Esc(Q) app, you agree to these Terms & Conditions.',
        'If you do not agree, please do not use the App.',
      ]),
      _section('Account Registration', [
        'You must be at least 18 years old or have parental consent.',
        'You are responsible for maintaining the confidentiality of your account credentials.',
        'You must provide accurate and complete information.',
      ]),
      _section('Ordering & Payments', [
        'Orders are subject to availability and confirmation.',
        'Prices are subject to change without notice.',
        'Payments are processed securely through our payment partners.',
        'You are responsible for all charges incurred under your account.',
      ]),
      _section('Cancellations & Refunds', [
        'Cancellations are accepted within the time limits specified by each canteen.',
        'Refunds are processed according to our Refund & Cancellation Policy.',
        'We reserve the right to cancel orders due to unforeseen circumstances.',
      ]),
      _section('User Conduct', [
        'You agree not to misuse the App or interfere with its operation.',
        'You agree not to attempt unauthorized access to our systems.',
        'We may suspend or terminate accounts for violations.',
      ]),
      _section('Disclaimer', [
        'The App is provided "as is" without warranties.',
        'We are not liable for indirect or consequential damages.',
        'Canteen menus, prices, and availability are subject to change.',
      ]),
      _section('Contact Us', [
        'For questions about these Terms, contact us at legal@escq.app',
      ]),
    ];
  }

  List<Widget> _buildRefundContent() {
    return [
      _section('Cancellation Policy', [
        'Orders can be cancelled before the canteen begins preparation.',
        'Cancellation requests must be made through the App.',
        'Cancellations after preparation has started may not be eligible for refund.',
      ]),
      _section('Refund Eligibility', [
        'Full refund: If cancelled before preparation starts.',
        'Partial refund: If cancelled during preparation (canteen discretion).',
        'No refund: If order has been prepared and is ready for pickup.',
        'Full refund: If the canteen cancels your order.',
      ]),
      _section('Refund Process', [
        'Refunds are processed to the original payment method within 5-7 business days.',
        'You will receive a notification when the refund is initiated.',
        'Contact support if you do not see the refund after 10 business days.',
      ]),
      _section('Non-Refundable Cases', [
        'Orders collected by the customer.',
        'Orders cancelled after the preparation window.',
        'Disputes raised after 48 hours of order completion.',
      ]),
      _section('Contact Us', [
        'For refund inquiries, contact us at support@escq.app',
      ]),
    ];
  }

  Widget _section(String title, List<String> paragraphs) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(top: 24, bottom: 8),
          child: Text(
            title,
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: Color(0xFFDC2626),
            ),
          ),
        ),
        ...paragraphs.map((p) => Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Text(
            p,
            style: const TextStyle(
              fontSize: 15,
              height: 1.7,
              color: Color(0xFF374151),
            ),
          ),
        )),
      ],
    );
  }
}