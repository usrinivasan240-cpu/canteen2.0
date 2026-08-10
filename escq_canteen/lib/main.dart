import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'providers/auth_provider.dart';
import 'providers/menu_provider.dart';
import 'providers/cart_provider.dart';
import 'providers/order_provider.dart';
import 'providers/theme_provider.dart';
import 'screens/login_screen.dart';
import 'screens/home_screen.dart';
import 'screens/staff_home_screen.dart';

void main() {
  runApp(const EscqCanteenApp());
}

class EscqCanteenApp extends StatelessWidget {
  const EscqCanteenApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => MenuProvider()),
        ChangeNotifierProvider(create: (_) => CartProvider()),
        ChangeNotifierProvider(create: (_) => OrderProvider()),
        ChangeNotifierProvider(create: (_) => ThemeProvider()),
      ],
      child: Consumer<ThemeProvider>(
        builder: (ctx, themeProv, _) => MaterialApp(
          title: 'Esc(Q)',
          debugShowCheckedModeBanner: false,
          themeMode: themeProv.themeMode,
          theme: ThemeData(
            colorScheme: ColorScheme.fromSeed(
              seedColor: const Color(0xFFF59E0B),
              primary: const Color(0xFFF59E0B),
            ),
            fontFamily: 'Roboto',
            scaffoldBackgroundColor: const Color(0xFFFBFCFF),
          ),
          darkTheme: ThemeData(
            colorScheme: ColorScheme.fromSeed(
              seedColor: const Color(0xFFF59E0B),
              primary: const Color(0xFFF59E0B),
              brightness: Brightness.dark,
            ),
            fontFamily: 'Roboto',
            scaffoldBackgroundColor: const Color(0xFF111827),
          ),
          home: const AppEntryPoint(),
        ),
      ),
    );
  }
}

class AppEntryPoint extends StatefulWidget {
  const AppEntryPoint({super.key});

  @override
  State<AppEntryPoint> createState() => _AppEntryPointState();
}

class _AppEntryPointState extends State<AppEntryPoint> {
  bool _initialized = false;

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    final auth = context.read<AuthProvider>();
    await auth.init();
    setState(() => _initialized = true);
  }

  @override
  Widget build(BuildContext context) {
    if (!_initialized) {
      return const Scaffold(
        backgroundColor: Color(0xFF0D0D12),
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              _EscqSplashLogo(),
              SizedBox(height: 24),
              _EscqSplashText(),
              SizedBox(height: 32),
              SizedBox(
                height: 28,
                width: 28,
                child: CircularProgressIndicator(
                  color: Color(0xFFF59E0B),
                  strokeWidth: 2.5,
                ),
              ),
              SizedBox(height: 16),
              Text(
                'Connecting smart dining cloud network...',
                style: TextStyle(
                  fontSize: 11,
                  color: Color(0xFFF59E0B),
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      );
    }

    final auth = context.watch<AuthProvider>();

    if (!auth.isLoggedIn) {
      return const LoginScreen();
    }

    if (auth.isStaff || auth.isChef) {
      return const StaffHomeScreen();
    }

    return const HomeScreen();
  }
}

class _EscqSplashLogo extends StatelessWidget {
  const _EscqSplashLogo();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 120,
      height: 120,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: const LinearGradient(
          colors: [Color(0xFFF59E0B), Color(0xFFEA580C)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFFF59E0B).withOpacity(0.4),
            blurRadius: 30,
            spreadRadius: 5,
          ),
        ],
      ),
      child: Stack(
        alignment: Alignment.center,
        children: [
          Container(
            width: 108,
            height: 108,
            decoration: const BoxDecoration(
              shape: BoxShape.circle,
              color: Color(0xFF0D0D12),
            ),
          ),
          Container(
            width: 96,
            height: 96,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: LinearGradient(
                colors: [
                  const Color(0xFFF59E0B).withOpacity(0.2),
                  const Color(0xFFEA580C).withOpacity(0.1),
                ],
              ),
            ),
          ),
          Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                Icons.restaurant,
                color: Colors.white,
                size: 32,
              ),
              const SizedBox(height: 2),
              ShaderMask(
                shaderCallback: (bounds) => const LinearGradient(
                  colors: [Color(0xFFF59E0B), Color(0xFFEA580C)],
                ).createShader(bounds),
                child: const Text(
                  'esc(Q)',
                  style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w900,
                    color: Colors.white,
                    letterSpacing: -1,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _EscqSplashText extends StatelessWidget {
  const _EscqSplashText();

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(width: 24, height: 2, color: const Color(0xFFF59E0B)),
            const SizedBox(width: 8),
            const Text(
              'SKIP THE QUEUE',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w800,
                color: Color(0xFFF59E0B),
                letterSpacing: 3,
              ),
            ),
            const SizedBox(width: 8),
            Container(width: 24, height: 2, color: const Color(0xFFF59E0B)),
          ],
        ),
        const SizedBox(height: 8),
        const Text(
          'Booting Esc(Q)',
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.bold,
            color: Colors.white,
          ),
        ),
      ],
    );
  }
}
