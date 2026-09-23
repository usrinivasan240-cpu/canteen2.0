import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../config.dart';
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

  int? _tokenExp(String token) {
    try {
      final parts = token.split('.');
      if (parts.length != 3) return null;
      final payload =
          utf8.decode(base64Url.decode(base64Url.normalize(parts[1])));
      final data = jsonDecode(payload);
      final exp = data['exp'];
      return exp is int ? exp : null;
    } catch (_) {
      return null;
    }
  }

  /// Supabase JWTs expire after ~1h. Without this, the app looks logged in
  /// (cached user) while every protected call 401s with "Authentication
  /// required." Refreshes via the stored refresh token; false = re-login.
  Future<bool> refreshAccessToken() async {
    final rt = _refreshToken;
    if (rt == null || rt.isEmpty) return false;
    try {
      final resp = await http
          .post(
            Uri.parse(
                '${AppConfig.supabaseUrl}/auth/v1/token?grant_type=refresh_token'),
            headers: {
              'Content-Type': 'application/json',
              'apikey': AppConfig.supabaseAnonKey,
            },
            body: jsonEncode({'refresh_token': rt}),
          )
          .timeout(const Duration(seconds: 15));
      if (resp.statusCode != 200) return false;
      final data = jsonDecode(resp.body);
      final nt = data['access_token'] as String?;
      if (nt == null || nt.isEmpty) return false;
      await saveAuthTokens(nt, (data['refresh_token'] as String?) ?? rt);
      return true;
    } catch (_) {
      return false;
    }
  }

  /// Valid Bearer token, refreshing proactively when <60s from expiry.
  /// Null = no session or unrecoverable (caller must send user to login).
  Future<String?> getValidToken() async {
    final t = _token;
    if (t == null || t.isEmpty) return null;
    final exp = _tokenExp(t);
    if (exp != null &&
        exp * 1000 - DateTime.now().millisecondsSinceEpoch > 60000) {
      return t;
    }
    if (await refreshAccessToken()) return _token;
    return null;
  }
}
