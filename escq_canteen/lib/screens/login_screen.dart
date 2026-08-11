import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../providers/menu_provider.dart';
import '../providers/order_provider.dart';
import '../providers/theme_provider.dart';
import 'home_screen.dart';
import 'staff_home_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

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
  final regNoCtrl = TextEditingController();
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
    regNoCtrl.clear();
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
          phoneCtrl.text.isEmpty || regNoCtrl.text.isEmpty || selectedCollegeId.isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('All fields are required for registration.')),
        );
        return;
      }
      success = await auth.register(
        name: nameCtrl.text.trim(),
        email: emailCtrl.text.trim(),
        password: passwordCtrl.text,
        phone: phoneCtrl.text.trim(),
        registerNumber: regNoCtrl.text.trim(),
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
    final themeProv = context.watch<ThemeProvider>();

    return Scaffold(
      backgroundColor: themeProv.isDark ? const Color(0xFF111827) : const Color(0xFFF9FAFB),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Container(
            width: double.infinity,
            constraints: const BoxConstraints(maxWidth: 420),
            decoration: BoxDecoration(
              color: themeProv.isDark ? const Color(0xFF1F2937) : Colors.white,
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
                    color: const Color(0xFFF59E0B),
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
                      fit: BoxFit.contain,
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
                Text(
                  'Esc(Q)',
                  style: TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.w900,
                    color: themeProv.isDark ? Colors.white : const Color(0xFF111827),
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
                    color: themeProv.isDark ? const Color(0xFF1F2937) : Colors.white,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: themeProv.isDark ? const Color(0xFF374151) : const Color(0xFFFEE2E2).withOpacity(0.5)),
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
                              color: !isSignUp ? const Color(0xFFF59E0B) : themeProv.isDark ? const Color(0xFF374151) : const Color(0xFFF3F4F6),
                              borderRadius: BorderRadius.circular(10),
                              boxShadow: !isSignUp ? [BoxShadow(color: const Color(0xFFF59E0B).withOpacity(0.3), blurRadius: 6)] : null,
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.login, size: 14, color: !isSignUp ? Colors.white : (themeProv.isDark ? Colors.grey[400] : const Color(0xFF6B7280))),
                                const SizedBox(width: 6),
                                Text(
                                  'Sign In',
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.bold,
                                    color: !isSignUp ? Colors.white : (themeProv.isDark ? Colors.grey[400] : const Color(0xFF6B7280)),
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
                              color: isSignUp ? const Color(0xFFF59E0B) : themeProv.isDark ? const Color(0xFF374151) : const Color(0xFFF3F4F6),
                              borderRadius: BorderRadius.circular(10),
                              boxShadow: isSignUp ? [BoxShadow(color: const Color(0xFFF59E0B).withOpacity(0.3), blurRadius: 6)] : null,
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.person_add, size: 14, color: isSignUp ? Colors.white : (themeProv.isDark ? Colors.grey[400] : const Color(0xFF6B7280))),
                                const SizedBox(width: 6),
                                Text(
                                  'Sign Up',
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.bold,
                                    color: isSignUp ? Colors.white : (themeProv.isDark ? Colors.grey[400] : const Color(0xFF6B7280)),
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
                        style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: themeProv.isDark ? Colors.white : const Color(0xFF111827)),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        isSignUp
                            ? 'Register as a student to start ordering meals.'
                            : 'Enter your credentials to access your account.',
                        style: TextStyle(fontSize: 12, color: themeProv.isDark ? Colors.grey[400] : const Color(0xFF6B7280)),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 18),

                // Form fields
                if (isSignUp) ...[
                  _buildField(Icons.person, 'Full Name', nameCtrl, 'e.g. Raju Srinivasan', themeProv),
                  const SizedBox(height: 14),
                  _buildField(Icons.confirmation_number, 'Register Number', regNoCtrl, 'e.g. 21CS001', themeProv),
                  const SizedBox(height: 14),
                  _buildField(Icons.phone, 'Phone Number', phoneCtrl, 'e.g. 9940918442', themeProv, isPhone: true),
                  const SizedBox(height: 14),
                  _buildCollegeDropdown(colleges, themeProv),
                  const SizedBox(height: 14),
                ],

                _buildField(Icons.email, 'Email Address', emailCtrl, 'e.g. rajus@gmail.com', themeProv, isEmail: true),
                const SizedBox(height: 14),
                _buildPasswordField(themeProv),
                const SizedBox(height: 14),

                // Agreement checkboxes (signup only)
                if (isSignUp) ...[
                  _buildCheckbox('I have read and agree to the Privacy Policy', agreePrivacy, (v) => setState(() => agreePrivacy = v), themeProv),
                  const SizedBox(height: 6),
                  _buildCheckbox('I have read and agree to the Terms & Conditions', agreeTerms, (v) => setState(() => agreeTerms = v), themeProv),
                  const SizedBox(height: 6),
                  _buildCheckbox('I have read and agree to the Refund & Cancellation Policy', agreeRefund, (v) => setState(() => agreeRefund = v), themeProv),
                  const SizedBox(height: 10),
                ],

                // Submit button
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: auth.loading ? null : _handleSubmit,
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

                if (!isSignUp) ...[
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    decoration: BoxDecoration(
                      color: themeProv.isDark ? const Color(0xFF374151) : const Color(0xFFF9FAFB),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(
                      'Demo: watson777@gmail.com / password123',
                      style: TextStyle(fontSize: 11, color: themeProv.isDark ? Colors.grey[400] : const Color(0xFF6B7280), fontWeight: FontWeight.w500),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildField(IconData icon, String label, TextEditingController ctrl, String hint, ThemeProvider themeProv, {bool isEmail = false, bool isPhone = false}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label.toUpperCase(),
          style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: themeProv.isDark ? Colors.grey[300] : const Color(0xFF374151)),
        ),
        const SizedBox(height: 6),
        TextField(
          controller: ctrl,
          keyboardType: isEmail ? TextInputType.emailAddress : (isPhone ? TextInputType.phone : TextInputType.text),
          decoration: InputDecoration(
            prefixIcon: Icon(icon, size: 18, color: themeProv.isDark ? Colors.grey[400] : const Color(0xFF6B7280)),
            hintText: hint,
            hintStyle: TextStyle(fontSize: 12, color: themeProv.isDark ? Colors.grey[500] : const Color(0xFF9CA3AF)),
            filled: true,
            fillColor: themeProv.isDark ? const Color(0xFF374151) : const Color(0xFFF9FAFB),
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: themeProv.isDark ? const Color(0xFF4B5563) : const Color(0xFFE5E7EB)),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: themeProv.isDark ? const Color(0xFF4B5563) : const Color(0xFFE5E7EB)),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: Color(0xFFF59E0B), width: 2),
            ),
          ),
          style: TextStyle(fontSize: 13, color: themeProv.isDark ? Colors.white : const Color(0xFF111827)),
        ),
      ],
    );
  }

  Widget _buildPasswordField(ThemeProvider themeProv) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'PASSWORD',
          style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: themeProv.isDark ? Colors.grey[300] : const Color(0xFF374151)),
        ),
        const SizedBox(height: 6),
        TextField(
          controller: passwordCtrl,
          obscureText: !showPassword,
          decoration: InputDecoration(
            prefixIcon: Icon(Icons.lock, size: 18, color: themeProv.isDark ? Colors.grey[400] : const Color(0xFF6B7280)),
            suffixIcon: GestureDetector(
              onTap: () => setState(() => showPassword = !showPassword),
              child: Icon(showPassword ? Icons.visibility_off : Icons.visibility, size: 18, color: themeProv.isDark ? Colors.grey[400] : const Color(0xFF6B7280)),
            ),
            hintText: isSignUp ? 'Create a password' : 'Enter your password',
            hintStyle: TextStyle(fontSize: 12, color: themeProv.isDark ? Colors.grey[500] : const Color(0xFF9CA3AF)),
            filled: true,
            fillColor: themeProv.isDark ? const Color(0xFF374151) : const Color(0xFFF9FAFB),
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: themeProv.isDark ? const Color(0xFF4B5563) : const Color(0xFFE5E7EB)),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: themeProv.isDark ? const Color(0xFF4B5563) : const Color(0xFFE5E7EB)),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: Color(0xFFF59E0B), width: 2),
            ),
          ),
          style: TextStyle(fontSize: 13, color: themeProv.isDark ? Colors.white : const Color(0xFF111827)),
        ),
      ],
    );
  }

  Widget _buildCollegeDropdown(List colleges, ThemeProvider themeProv) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'SELECT COLLEGE',
          style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: themeProv.isDark ? Colors.grey[300] : const Color(0xFF374151)),
        ),
        const SizedBox(height: 6),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          decoration: BoxDecoration(
            color: themeProv.isDark ? const Color(0xFF374151) : const Color(0xFFF9FAFB),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: themeProv.isDark ? const Color(0xFF4B5563) : const Color(0xFFE5E7EB)),
          ),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              value: selectedCollegeId.isNotEmpty ? selectedCollegeId : null,
              isExpanded: true,
              dropdownColor: themeProv.isDark ? const Color(0xFF1F2937) : Colors.white,
              hint: Text('-- Choose your college --', style: TextStyle(fontSize: 12, color: themeProv.isDark ? Colors.grey[500] : const Color(0xFF9CA3AF))),
              items: colleges.map<DropdownMenuItem<String>>((c) {
                return DropdownMenuItem(value: c.id, child: Text(c.name, style: TextStyle(fontSize: 12, color: themeProv.isDark ? Colors.white : const Color(0xFF111827))));
              }).toList(),
              onChanged: (v) => setState(() => selectedCollegeId = v ?? ''),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildCheckbox(String label, bool value, ValueChanged<bool> onChanged, ThemeProvider themeProv) {
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
              side: BorderSide(color: themeProv.isDark ? Colors.grey[500]! : const Color(0xFFD1D5DB)),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(label, style: TextStyle(fontSize: 11, color: themeProv.isDark ? Colors.grey[400] : const Color(0xFF6B7280))),
          ),
        ],
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
      await menu.loadData(userCollegeId: user.collegeId, userCanteenId: user.canteenId);
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
