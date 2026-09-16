import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/user.dart';

class AuthService {
  static final AuthService _instance = AuthService._();
  factory AuthService() => _instance;
  AuthService._();

  User? _currentUser;
  String? _token;
  String? _refreshToken;

  User? get currentUser => _currentUser;
  bool get isLoggedIn => _currentUser != null;
  // Supabase JWT issued at login/register. Sent as `Authorization: Bearer`
  // on every API call — protected writes (orders, kitchen, chefs, …) 401
  // without it.
  String? get accessToken => _token;
  String? get refreshToken => _refreshToken;

  Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    final userJson = prefs.getString('bb_user');
    if (userJson != null) {
      try {
        _currentUser = User.fromJson(jsonDecode(userJson));
      } catch (e) {
        _currentUser = null;
      }
    }
    _token = prefs.getString('bb_token');
    _refreshToken = prefs.getString('bb_refresh_token');
  }

  Future<void> saveUser(User user) async {
    _currentUser = user;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('bb_user', jsonEncode(user.toJson()));
    await prefs.setBool('bb_loggedIn', true);
    await prefs.setString('bb_role', user.role);
  }

  Future<void> saveAuthTokens(String? token, String? refreshToken) async {
    _token = (token != null && token.isNotEmpty) ? token : null;
    _refreshToken =
        (refreshToken != null && refreshToken.isNotEmpty) ? refreshToken : null;
    final prefs = await SharedPreferences.getInstance();
    if (_token != null) {
      await prefs.setString('bb_token', _token!);
    } else {
      await prefs.remove('bb_token');
    }
    if (_refreshToken != null) {
      await prefs.setString('bb_refresh_token', _refreshToken!);
    } else {
      await prefs.remove('bb_refresh_token');
    }
  }

  Future<void> logout() async {
    _currentUser = null;
    _token = null;
    _refreshToken = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('bb_user');
    await prefs.remove('bb_loggedIn');
    await prefs.remove('bb_role');
    await prefs.remove('bb_orders');
    await prefs.remove('bb_token');
    await prefs.remove('bb_refresh_token');
  }
}
