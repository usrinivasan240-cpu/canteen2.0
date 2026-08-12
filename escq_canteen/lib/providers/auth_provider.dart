import 'package:flutter/material.dart';
import '../models/user.dart';
import '../services/api_service.dart';
import '../services/auth_service.dart';

class AuthProvider extends ChangeNotifier {
  final AuthService _auth = AuthService();
  final ApiService _api = ApiService();

  User? get user => _auth.currentUser;
  bool get isLoggedIn => _auth.isLoggedIn;
  bool get isCustomer => user?.isCustomer ?? false;
  bool get isStaff => user?.isStaff ?? false;
  bool get isChef => user?.isChef ?? false;

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
      if (data['success'] == true && data['user'] != null) {
        final u = User.fromJson(data['user']);
        if (u.isBlockedRole) {
          _error = 'This account is for web admin only. Please use the web portal.';
          _loading = false;
          notifyListeners();
          return false;
        }
        await _auth.saveUser(u);
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
    required String registerNumber,
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
        registerNumber: registerNumber,
        collegeId: collegeId,
      );
      if (data['success'] == true && data['user'] != null) {
        final u = User.fromJson(data['user']);
        await _auth.saveUser(u);
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

  Future<void> logout() async {
    await _auth.logout();
    notifyListeners();
  }
}
