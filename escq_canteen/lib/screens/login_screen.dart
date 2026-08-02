import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../providers/menu_provider.dart';
import '../providers/order_provider.dart';
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

    return Scaffold(
      backgroundColor: Colors.grey[50],
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
                  color: Colors.black.withOpacity(0.08),
                  blurRadius: 24,
                  offset: const Offset(0, 8),
                ),
              ],
              border: Border.all(color: const Color(0xFFFEE2E2)),
            ),
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Logo
                Container(
                  width: 56,
                  height: 56,
                  decoration: BoxDecoration(
                    color: const Color(0xFFD97706),
                    borderRadius: BorderRadius.circular(16),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFFD97706).withOpacity(0.3),
                        blurRadius: 8,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: const Icon(Icons.local_cafe, color: Colors.white, size: 32),
                ),
                const SizedBox(height: 12),
                const Text(
                  'esc(Q)',
                  style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                    color: Colors.black87,
                  ),
                ),
                const SizedBox(height: 2),
                const Text(
                  'Your campus canteen, just a click away.',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFFD97706),
                  ),
                ),
                const SizedBox(height: 20),

                // Sign In / Sign Up toggle
                Container(
                  decoration: BoxDecoration(
                    color: const Color(0xFFFEE2E2),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0xFFFECACA).withOpacity(0.5)),
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
                              color: !isSignUp ? const Color(0xFFD97706) : Colors.transparent,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.login, size: 14, color: !isSignUp ? Colors.white : Colors.grey),
                                const SizedBox(width: 6),
                                Text(
                                  'Sign In',
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.bold,
                                    color: !isSignUp ? Colors.white : Colors.grey,
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
                              color: isSignUp ? const Color(0xFFD97706) : Colors.transparent,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.person_add, size: 14, color: isSignUp ? Colors.white : Colors.grey),
                                const SizedBox(width: 6),
                                Text(
                                  'Sign Up',
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.bold,
                                    color: isSignUp ? Colors.white : Colors.grey,
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
                const SizedBox(height: 20),

                // Title
                Align(
                  alignment: Alignment.centerLeft,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        isSignUp ? 'Create Account' : 'Welcome Back',
                        style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w600, color: Colors.black87),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        isSignUp
                            ? 'Register as a student to start ordering meals.'
                            : 'Enter your credentials to access your account.',
                        style: const TextStyle(fontSize: 11, color: Colors.grey),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),

                // Form fields
                if (isSignUp) ...[
                  _buildField(Icons.person, 'Full Name', nameCtrl, 'e.g. Raju Srinivasan'),
                  const SizedBox(height: 12),
                  _buildField(Icons.confirmation_number, 'Register Number', regNoCtrl, 'e.g. 21CS001'),
                  const SizedBox(height: 12),
                  _buildField(Icons.phone, 'Phone Number', phoneCtrl, 'e.g. 9940918442', isPhone: true),
                  const SizedBox(height: 12),
                  _buildCollegeDropdown(colleges),
                  const SizedBox(height: 12),
                ],

                _buildField(Icons.email, 'Email Address', emailCtrl, 'e.g. rajus@gmail.com', isEmail: true),
                const SizedBox(height: 12),
                _buildPasswordField(),
                const SizedBox(height: 12),

                // Agreement checkboxes (signup only)
                if (isSignUp) ...[
                  _buildCheckbox('I have read and agree to the Privacy Policy', agreePrivacy, (v) => setState(() => agreePrivacy = v)),
                  const SizedBox(height: 6),
                  _buildCheckbox('I have read and agree to the Terms & Conditions', agreeTerms, (v) => setState(() => agreeTerms = v)),
                  const SizedBox(height: 6),
                  _buildCheckbox('I have read and agree to the Refund & Cancellation Policy', agreeRefund, (v) => setState(() => agreeRefund = v)),
                  const SizedBox(height: 8),
                ],

                // Submit button
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: auth.loading ? null : _handleSubmit,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFD97706),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      elevation: 4,
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
                              Text(isSignUp ? 'Create Account' : 'Sign In', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                            ],
                          ),
                  ),
                ),

                if (!isSignUp) ...[
                  const SizedBox(height: 16),
                  const Text(
                    'Demo: watson777@gmail.com / password123',
                    style: TextStyle(fontSize: 10, color: Colors.grey),
                  ),
                ],
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
          style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.grey),
        ),
        const SizedBox(height: 4),
        TextField(
          controller: ctrl,
          keyboardType: isEmail ? TextInputType.emailAddress : (isPhone ? TextInputType.phone : TextInputType.text),
          decoration: InputDecoration(
            prefixIcon: Icon(icon, size: 16, color: Colors.grey),
            hintText: hint,
            hintStyle: const TextStyle(fontSize: 11),
            filled: true,
            fillColor: const Color(0xFFFEE2E2).withOpacity(0.3),
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: Color(0xFFFEE2E2)),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: Color(0xFFFEE2E2)),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: Color(0xFFD97706), width: 2),
            ),
          ),
          style: const TextStyle(fontSize: 12),
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
          style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.grey),
        ),
        const SizedBox(height: 4),
        TextField(
          controller: passwordCtrl,
          obscureText: !showPassword,
          decoration: InputDecoration(
            prefixIcon: const Icon(Icons.lock, size: 16, color: Colors.grey),
            suffixIcon: GestureDetector(
              onTap: () => setState(() => showPassword = !showPassword),
              child: Icon(showPassword ? Icons.visibility_off : Icons.visibility, size: 16, color: Colors.grey),
            ),
            hintText: isSignUp ? 'Create a password' : 'Enter your password',
            hintStyle: const TextStyle(fontSize: 11),
            filled: true,
            fillColor: const Color(0xFFFEE2E2).withOpacity(0.3),
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: Color(0xFFFEE2E2)),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: Color(0xFFFEE2E2)),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: Color(0xFFD97706), width: 2),
            ),
          ),
          style: const TextStyle(fontSize: 12),
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
          style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.grey),
        ),
        const SizedBox(height: 4),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          decoration: BoxDecoration(
            color: const Color(0xFFFEE2E2).withOpacity(0.3),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFFEE2E2)),
          ),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              value: selectedCollegeId.isNotEmpty ? selectedCollegeId : null,
              isExpanded: true,
              hint: const Text('-- Choose your college --', style: TextStyle(fontSize: 11)),
              items: colleges.map<DropdownMenuItem<String>>((c) {
                return DropdownMenuItem(value: c.id, child: Text(c.name, style: const TextStyle(fontSize: 11)));
              }).toList(),
              onChanged: (v) => setState(() => selectedCollegeId = v ?? ''),
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
              activeColor: const Color(0xFFD97706),
              side: const BorderSide(color: Color(0xFFFECACA)),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(label, style: const TextStyle(fontSize: 11, color: Colors.grey)),
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
