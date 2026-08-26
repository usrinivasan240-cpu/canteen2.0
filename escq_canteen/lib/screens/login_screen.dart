import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../providers/menu_provider.dart';
import '../providers/order_provider.dart';
import 'home_screen.dart';
import 'staff_home_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key, this.onNavigateLegal});

  final void Function(String)? onNavigateLegal;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  bool isSignUp = false;
  bool showPassword = false;

  final emailCtrl = TextEditingController();
  final passwordCtrl = TextEditingController();
  final nameCtrl = TextEditingController();
  final phoneCtrl = TextEditingController();
  String selectedCollegeId = '';

  bool agreePrivacy = false;
  bool agreeTerms = false;
  bool agreeRefund = false;

  @override
  void initState() {
    super.initState();
    _loadColleges();
  }

  Future<void> _loadColleges() async {
    final menuProv = context.read<MenuProvider>();
    await menuProv.loadData();
    if (menuProv.colleges.isNotEmpty && selectedCollegeId.isEmpty) {
      setState(() => selectedCollegeId = menuProv.colleges.first.id);
    }
  }

  void _resetForm() {
    nameCtrl.clear();
    emailCtrl.clear();
    passwordCtrl.clear();
    phoneCtrl.clear();
    setState(() {
      selectedCollegeId = '';
      agreePrivacy = false;
      agreeTerms = false;
      agreeRefund = false;
    });
  }

  Future<void> _handleSubmit() async {
    final auth = context.read<AuthProvider>();
    bool success;

    if (isSignUp) {
      if (nameCtrl.text.isEmpty || emailCtrl.text.isEmpty || passwordCtrl.text.isEmpty ||
          phoneCtrl.text.isEmpty || selectedCollegeId.isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('All fields are required for registration.')),
        );
        return;
      }
      if (!agreePrivacy || !agreeTerms || !agreeRefund) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Please read and agree to all policies before creating your account.'),
            backgroundColor: Colors.red,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.all(Radius.circular(10))),
          ),
        );
        return;
      }
      success = await auth.register(
        name: nameCtrl.text.trim(),
        email: emailCtrl.text.trim(),
        password: passwordCtrl.text,
        phone: phoneCtrl.text.trim(),
        collegeId: selectedCollegeId,
      );
    } else {
      success = await auth.login(emailCtrl.text.trim(), passwordCtrl.text);
    }

    if (success && mounted) {
      Navigator.of(context).pushReplacement(MaterialPageRoute(
        builder: (_) => const _AfterLogin(),
      ));
    } else if (auth.error != null && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(auth.error!)),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final colleges = context.watch<MenuProvider>().colleges;

    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Container(
            width: double.infinity,
            constraints: const BoxConstraints(maxWidth: 420),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(24),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.06),
                  blurRadius: 20,
                  offset: const Offset(0, 4),
                ),
              ],
              border: Border.all(color: const Color(0xFFFEE2E2)),
            ),
            padding: const EdgeInsets.all(28),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Logo
                Container(
                  width: 72,
                  height: 72,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(16),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFFF59E0B).withOpacity(0.3),
                        blurRadius: 12,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(16),
                    child: Image.asset(
                      'assets/images/escq_logo.png',
                      fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) => const Center(
                        child: Text(
                          'Esc(Q)',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w900,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                const Text(
                  'Esc(Q)',
                  style: TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.w900,
                    color: Color(0xFF111827),
                    letterSpacing: -0.5,
                  ),
                ),
                const SizedBox(height: 4),
                const Text(
                  'Your campus canteen, just a click away.',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                    color: Color(0xFFF59E0B),
                  ),
                ),
                const SizedBox(height: 24),

                // Sign In / Sign Up toggle
                Container(
                  decoration: BoxDecoration(
                    color: const Color(0xFFFEF2F2),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: const Color(0xFFFEE2E2).withOpacity(0.5)),
                  ),
                  padding: const EdgeInsets.all(4),
                  child: Row(
                    children: [
                      Expanded(
                        child: GestureDetector(
                          onTap: () => setState(() { isSignUp = false; _resetForm(); }),
                          child: Container(
                            padding: const EdgeInsets.symmetric(vertical: 10),
                            decoration: BoxDecoration(
                              color: !isSignUp ? const Color(0xFFF59E0B) : Colors.transparent,
                              borderRadius: BorderRadius.circular(10),
                              boxShadow: !isSignUp ? [BoxShadow(color: const Color(0xFFF59E0B).withOpacity(0.3), blurRadius: 6)] : null,
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.login, size: 14, color: !isSignUp ? Colors.white : const Color(0xFF6B7280)),
                                const SizedBox(width: 6),
                                Text(
                                  'Sign In',
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.bold,
                                    color: !isSignUp ? Colors.white : const Color(0xFF6B7280),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                      Expanded(
                        child: GestureDetector(
                          onTap: () => setState(() { isSignUp = true; _resetForm(); }),
                          child: Container(
                            padding: const EdgeInsets.symmetric(vertical: 10),
                            decoration: BoxDecoration(
                              color: isSignUp ? const Color(0xFFF59E0B) : Colors.transparent,
                              borderRadius: BorderRadius.circular(10),
                              boxShadow: isSignUp ? [BoxShadow(color: const Color(0xFFF59E0B).withOpacity(0.3), blurRadius: 6)] : null,
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.person_add, size: 14, color: isSignUp ? Colors.white : const Color(0xFF6B7280)),
                                const SizedBox(width: 6),
                                Text(
                                  'Sign Up',
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.bold,
                                    color: isSignUp ? Colors.white : const Color(0xFF6B7280),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),

                // Title
                Align(
                  alignment: Alignment.centerLeft,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        isSignUp ? 'Create Account' : 'Welcome Back',
                        style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: Color(0xFF111827)),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        isSignUp
                            ? 'Register as a student to start ordering meals.'
                            : 'Enter your credentials to access your account.',
                        style: const TextStyle(fontSize: 12, color: Color(0xFF6B7280)),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 18),

                // Form fields
                if (isSignUp) ...[
                  _buildField(Icons.person, 'Full Name', nameCtrl, 'e.g. watson'),
                  const SizedBox(height: 14),
                  _buildField(Icons.phone, 'Phone Number', phoneCtrl, 'e.g. 9876543210', isPhone: true),
                  const SizedBox(height: 14),
                  _buildCollegeDropdown(colleges),
                  const SizedBox(height: 14),
                ],

                _buildField(Icons.email, 'Email Address', emailCtrl, 'e.g. example@gmail.com', isEmail: true),
                const SizedBox(height: 14),
                _buildPasswordField(),
                const SizedBox(height: 14),

                // Agreement checkboxes (signup only)
                if (isSignUp) ...[
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFEFBF3),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFFDE68A)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Icon(Icons.info_outline, size: 14, color: Colors.amber[700]),
                            const SizedBox(width: 6),
                            const Expanded(
                              child: Text(
                                'Please read and agree to all policies before creating your account.',
                                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF92400E)),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        _buildPolicyCheckbox(
                          'Privacy Policy',
                          'privacy',
                          agreePrivacy,
                          (v) => setState(() => agreePrivacy = v),
                          () => widget.onNavigateLegal?.call('privacy'),
                        ),
                        const SizedBox(height: 8),
                        _buildPolicyCheckbox(
                          'Terms & Conditions',
                          'terms',
                          agreeTerms,
                          (v) => setState(() => agreeTerms = v),
                          () => widget.onNavigateLegal?.call('terms'),
                        ),
                        const SizedBox(height: 8),
                        _buildPolicyCheckbox(
                          'Refund & Cancellation Policy',
                          'refund',
                          agreeRefund,
                          (v) => setState(() => agreeRefund = v),
                          () => widget.onNavigateLegal?.call('refund'),
                        ),
                      ],
                    ),
                  ),
                ],

                // Submit button
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: auth.loading
                        ? null
                        : () {
                            if (isSignUp && (!agreePrivacy || !agreeTerms || !agreeRefund)) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text('Please read and agree to all policies before creating your account.'),
                                  backgroundColor: Colors.red,
                                  behavior: SnackBarBehavior.floating,
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.all(Radius.circular(10))),
                                ),
                              );
                              return;
                            }
                            _handleSubmit();
                          },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFF59E0B),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      elevation: 2,
                    ),
                    child: auth.loading
                        ? const SizedBox(
                            height: 16, width: 16,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                          )
                        : Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(isSignUp ? Icons.person_add : Icons.login, size: 16),
                              const SizedBox(width: 8),
                              Text(isSignUp ? 'Create Account' : 'Sign In', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                            ],
                          ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildField(IconData icon, String label, TextEditingController ctrl, String hint, {bool isEmail = false, bool isPhone = false}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label.toUpperCase(),
          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF374151)),
        ),
        const SizedBox(height: 6),
        TextField(
          controller: ctrl,
          keyboardType: isEmail ? TextInputType.emailAddress : (isPhone ? TextInputType.phone : TextInputType.text),
          decoration: InputDecoration(
            prefixIcon: Icon(icon, size: 18, color: const Color(0xFF6B7280)),
            hintText: hint,
            hintStyle: const TextStyle(fontSize: 12, color: Color(0xFF9CA3AF)),
            filled: true,
            fillColor: const Color(0xFFF9FAFB),
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: Color(0xFFE5E7EB)),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: Color(0xFFE5E7EB)),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: Color(0xFFF59E0B), width: 2),
            ),
          ),
          style: const TextStyle(fontSize: 13, color: Color(0xFF111827)),
        ),
      ],
    );
  }

  Widget _buildPasswordField() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'PASSWORD',
          style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF374151)),
        ),
        const SizedBox(height: 6),
        TextField(
          controller: passwordCtrl,
          obscureText: !showPassword,
          decoration: InputDecoration(
            prefixIcon: const Icon(Icons.lock, size: 18, color: Color(0xFF6B7280)),
            suffixIcon: GestureDetector(
              onTap: () => setState(() => showPassword = !showPassword),
              child: Icon(showPassword ? Icons.visibility_off : Icons.visibility, size: 18, color: const Color(0xFF6B7280)),
            ),
            hintText: isSignUp ? 'Create a password' : 'Enter your password',
            hintStyle: const TextStyle(fontSize: 12, color: Color(0xFF9CA3AF)),
            filled: true,
            fillColor: const Color(0xFFF9FAFB),
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: Color(0xFFE5E7EB)),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: Color(0xFFE5E7EB)),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: Color(0xFFF59E0B), width: 2),
            ),
          ),
          style: const TextStyle(fontSize: 13, color: Color(0xFF111827)),
        ),
      ],
    );
  }

  Widget _buildCollegeDropdown(List colleges) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'SELECT COLLEGE',
          style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF374151)),
        ),
        const SizedBox(height: 6),
        Container(
          width: double.infinity,
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFE5E7EB)),
            boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 4, offset: const Offset(0, 2))],
          ),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              value: selectedCollegeId.isNotEmpty ? selectedCollegeId : null,
              isExpanded: true,
              hint: const Text('-- Choose your college --', style: TextStyle(fontSize: 12, color: Color(0xFF9CA3AF))),
              items: colleges.map<DropdownMenuItem<String>>((c) {
                return DropdownMenuItem(
                  value: c.id,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    child: Text(c.name, style: const TextStyle(fontSize: 13, color: Color(0xFF111827))),
                  ),
                );
              }).toList(),
              onChanged: (v) => setState(() => selectedCollegeId = v ?? ''),
              dropdownColor: Colors.white,
              elevation: 4,
              borderRadius: BorderRadius.circular(12),
              menuMaxHeight: 300,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildCheckbox(String label, bool value, ValueChanged<bool> onChanged) {
    return GestureDetector(
      onTap: () => onChanged(!value),
      child: Row(
        children: [
          SizedBox(
            width: 18, height: 18,
            child: Checkbox(
              value: value,
              onChanged: (v) => onChanged(v ?? false),
              activeColor: const Color(0xFFF59E0B),
              side: const BorderSide(color: Color(0xFFD1D5DB)),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(label, style: const TextStyle(fontSize: 11, color: Color(0xFF6B7280))),
          ),
        ],
      ),
    );
  }

  Widget _buildPolicyCheckbox(String policyName, String pageKey, bool value, ValueChanged<bool> onChanged, VoidCallback? onNavigate) {
    return GestureDetector(
      onTap: () => onChanged(!value),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
        decoration: BoxDecoration(
          color: value ? const Color(0xFFFEFBF3) : Colors.transparent,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: value ? const Color(0xFFF59E0B) : const Color(0xFFE5E7EB),
            width: value ? 2 : 1,
          ),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              width: 22, height: 22,
              child: Checkbox(
                value: value,
                onChanged: (v) => onChanged(v ?? false),
                activeColor: const Color(0xFFF59E0B),
                side: const BorderSide(color: Color(0xFFD1D5DB), width: 1.5),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'I have read and agree to the ',
                    style: TextStyle(fontSize: 12, color: Colors.grey[700], height: 1.4),
                  ),
                  const SizedBox(height: 4),
                  GestureDetector(
                    onTap: onNavigate,
                    child: Text(
                      policyName,
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFFF59E0B),
                        decoration: TextDecoration.underline,
                        decorationColor: Color(0xFFF59E0B),
                        decorationThickness: 1.5,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Text(
              value ? '' : '(required)',
              style: TextStyle(fontSize: 10, color: Colors.grey[500]),
            ),
          ],
        ),
      ),
    );
  }
}

class _AfterLogin extends StatefulWidget {
  const _AfterLogin();
  @override
  State<_AfterLogin> createState() => _AfterLoginState();
}

class _AfterLoginState extends State<_AfterLogin> {
  @override
  void initState() {
    super.initState();
    _initData();
  }

  Future<void> _initData() async {
    final auth = context.read<AuthProvider>();
    final menu = context.read<MenuProvider>();
    final orderProv = context.read<OrderProvider>();
    final user = auth.user;

    if (user != null) {
      // Auto-select the user's canteen and load its menu
      if (user.canteenId != null && user.canteenId!.isNotEmpty) {
        await menu.loadData(userCollegeId: user.collegeId, userCanteenId: user.canteenId);
        // Auto-select the first sub-canteen if available
        final subs = menu.subCanteens.where((s) => s.canteenId == user.canteenId).toList();
        if (subs.isNotEmpty) {
          menu.setSubCanteen(subs.first.id);
        }
      } else {
        await menu.loadData(userCollegeId: user.collegeId, userCanteenId: user.canteenId);
      }
      await orderProv.loadOrders(user.id, canteenId: user.canteenId);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    if (auth.isStaff || auth.isChef) {
      return const StaffHomeScreen();
    }
    return const HomeScreen();
  }
}
