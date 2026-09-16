import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/user.dart';
import '../services/api_service.dart';
import '../services/auth_service.dart';
import '../services/notification_service.dart';
import 'cart_provider.dart';
import 'menu_provider.dart';
import 'order_provider.dart';
import 'wallet_provider.dart';

class AuthProvider extends ChangeNotifier {
  final AuthService _auth = AuthService();
  final ApiService _api = ApiService();

  User? get user => _auth.currentUser;
  bool get isLoggedIn => _auth.isLoggedIn;
  bool get isCustomer => user?.isCustomer ?? false;
  bool get isStaff => user?.isStaff ?? false;
  bool get isChef => user?.isChef ?? false;
  bool get isOwner => user?.isOwner ?? false;

  bool _loading = false;
  bool get loading => _loading;

  String? _error;
  String? get error => _error;

  Future<void> init() async {
    await _auth.init();
    notifyListeners();
  }

  Future<bool> login(String email, String password) async {
    _loading = true;
    _error = null;
    notifyListeners();

    try {
      final data = await _api.login(email, password);
      // Superadmin OTP step returns success WITHOUT tokens — not a login.
      if (data['pendingOtp'] == true) {
        _error = 'OTP verification required — please use the web portal.';
        _loading = false;
        notifyListeners();
        return false;
      }
      if (data['success'] == true && data['user'] != null) {
        final u = User.fromJson(data['user']);
        if (u.isBlockedRole) {
          _error = 'This account is for web admin only. Please use the web portal.';
          _loading = false;
          notifyListeners();
          return false;
        }
        await _auth.saveUser(u);
        await _auth.saveAuthTokens(
          data['token'] as String?,
          data['refreshToken'] as String?,
        );
        NotificationService().sendTokenToServer(u.id);
        _loading = false;
        notifyListeners();
        return true;
      } else {
        final err = data['error'] ?? 'Invalid email or password.';
        if (err.contains('Database') || err.contains('database')) {
          _error = 'Server is starting up. Please try again in a moment.';
        } else {
          _error = err;
        }
        _loading = false;
        notifyListeners();
        return false;
      }
    } catch (e) {
      _error = 'Connection failure. Please check your internet and try again.';
      _loading = false;
      notifyListeners();
      return false;
    }
  }

  Future<bool> register({
    required String name,
    required String email,
    required String password,
    required String phone,
    String? registerNumber,
    required String collegeId,
  }) async {
    _loading = true;
    _error = null;
    notifyListeners();

    try {
      final data = await _api.register(
        name: name,
        email: email,
        password: password,
        phone: phone,
        registerNumber: registerNumber ?? '',
        collegeId: collegeId,
      );
      if (data['success'] == true && data['user'] != null) {
        final u = User.fromJson(data['user']);
        await _auth.saveUser(u);
        await _auth.saveAuthTokens(
          data['token'] as String?,
          data['refreshToken'] as String?,
        );
        NotificationService().sendTokenToServer(u.id);
        _loading = false;
        notifyListeners();
        return true;
      } else {
        _error = data['error'] ?? 'Failed to create account.';
        _loading = false;
        notifyListeners();
        return false;
      }
    } catch (e) {
      _error = 'Connection failure to server.';
      _loading = false;
      notifyListeners();
      return false;
    }
  }

  /// Persist locally-edited profile fields (name/phone/register no.).
  /// There is no server profile-update endpoint (PUT /api/users/:id is
  /// role-only), so this updates the cached session; the next login
  /// re-syncs from the server.
  Future<void> updateLocalProfile({
    required String name,
    String? phone,
    String? registerNumber,
  }) async {
    final u = _auth.currentUser;
    if (u == null) return;
    await _auth.saveUser(User(
      id: u.id,
      name: name.trim().isEmpty ? u.name : name.trim(),
      email: u.email,
      role: u.role,
      phone: phone?.trim(),
      registerNumber: registerNumber?.trim(),
      collegeId: u.collegeId,
      canteenId: u.canteenId,
      subCanteenId: u.subCanteenId,
      status: u.status,
    ));
    notifyListeners();
  }

  Future<void> logout() async {
    await _auth.logout();
    notifyListeners();
  }

  /// Full session teardown for logout buttons: clears the persisted session
  /// AND every in-memory provider (cart, orders, wallet, menu scope) plus
  /// the wallet refresh timer, so the next account on this device starts
  /// clean. Use this instead of [logout] from UI code.
  Future<void> logoutEverywhere(BuildContext context) async {
    try {
      context.read<CartProvider>().clear();
    } catch (_) {}
    try {
      context.read<OrderProvider>().clear();
    } catch (_) {}
    try {
      context.read<WalletProvider>().clear();
    } catch (_) {}
    try {
      context.read<MenuProvider>().resetUserScope();
    } catch (_) {}
    await logout();
  }
}
