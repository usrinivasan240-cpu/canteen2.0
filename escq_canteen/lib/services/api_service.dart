import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../config.dart';
import '../models/menu_item.dart';
import '../models/order.dart';
import '../models/college.dart';
import '../models/review.dart';
import 'auth_service.dart';

class ApiService {
  static final ApiService _instance = ApiService._();
  factory ApiService() => _instance;
  ApiService._();

  final String _baseUrl = AppConfig.apiBase;

  static const Duration _timeout = Duration(seconds: 90);

  Future<Map<String, dynamic>> _retryRequest(Future<Map<String, dynamic>> Function() request, {int maxRetries = 2}) async {
    for (int i = 0; i <= maxRetries; i++) {
      try {
        final result = await request();
        if (result['retryable'] != true || i == maxRetries) return result;
        await Future.delayed(Duration(seconds: 2 * (i + 1)));
      } catch (e) {
        if (i == maxRetries) rethrow;
        await Future.delayed(Duration(seconds: 2 * (i + 1)));
      }
    }
    return {'success': false, 'error': 'Server unavailable. Please try again.'};
  }

  /// Authenticated headers. Protected server routes 401 without
  /// `Authorization: Bearer <supabase-jwt>` (see server authMiddleware).
  Map<String, String> _headers() {
    final token = AuthService().accessToken;
    return _headersFor(token);
  }

  Map<String, String> _headersFor(String? token) {
    return {
      'Content-Type': 'application/json',
      if (token != null && token.isNotEmpty) 'Authorization': 'Bearer $token',
    };
  }

  /// Sends with a fresh token; on a mid-flight 401, refreshes once and
  /// retries. A final 401 for a logged-in user is flagged `sessionExpired`
  /// so screens can send the user to login instead of looping on errors.
  Future<http.Response> _authedSend(
      Future<http.Response> Function(Map<String, String>) send) async {
    var token = await AuthService().getValidToken();
    var resp = await send(_headersFor(token));
    if (resp.statusCode == 401) {
      final ok = await AuthService().refreshAccessToken();
      if (ok) {
        resp = await send(_headersFor(AuthService().accessToken));
      }
    }
    return resp;
  }

  /// Only genuine auth failures flag a dead session. The server also uses
  /// 401 for "parameter missing" cases (e.g. 'User ID required') — those
  /// must NEVER log the user out (that bug bounced wallet users to login).
  static const _authFailureMessages = {
    'Authentication required.',
    'Invalid or expired token.',
    'Invalid token.',
  };

  Map<String, dynamic> _withSessionFlag(
      Map<String, dynamic> data, int statusCode) {
    if (statusCode == 401 &&
        AuthService().currentUser != null &&
        data['success'] != true &&
        _authFailureMessages.contains(data['error'])) {
      return {
        ...data,
        'success': false,
        'error': 'Session expired. Please log in again.',
        'sessionExpired': true,
      };
    }
    return data;
  }

  /// Decodes a response body defensively. Error pages (502/HTML from the
  /// host) must not surface as a raw FormatException to the UI.
  Map<String, dynamic> _decode(http.Response resp) {
    dynamic data;
    try {
      data = jsonDecode(resp.body);
    } catch (_) {
      return {
        'success': false,
        'error': 'Server error (${resp.statusCode}). Please try again.',
      };
    }
    if (data is Map<String, dynamic>) return data;
    return {'success': false, 'error': 'Unexpected server response.'};
  }

  Future<Map<String, dynamic>> _post(String path, Map<String, dynamic> body,
      {bool allowRetry = true}) async {
    Future<Map<String, dynamic>> once() async {
      final resp = await _authedSend((h) => http
          .post(
            Uri.parse('$_baseUrl$path'),
            headers: h,
            body: jsonEncode(body),
          )
          .timeout(_timeout));
      final data = _withSessionFlag(_decode(resp), resp.statusCode);
      if (resp.statusCode >= 500 && data['error'] != null) {
        return {'success': false, 'error': data['error'], 'retryable': true};
      }
      return data;
    }
    // Non-idempotent writes (order creation) must never auto-retry: the
    // server mints a fresh order per POST, so one tap could create 3 orders.
    if (!allowRetry) return once();
    return _retryRequest(once);
  }

  Future<Map<String, dynamic>> _get(String path, [Map<String, String>? params]) async {
    return _retryRequest(() async {
      var uri = Uri.parse('$_baseUrl$path');
      if (params != null && params.isNotEmpty) {
        uri = uri.replace(queryParameters: params);
      }
      final resp =
          await _authedSend((h) => http.get(uri, headers: h).timeout(_timeout));
      final data = _withSessionFlag(_decode(resp), resp.statusCode);
      if (resp.statusCode >= 500 && data['error'] != null) {
        return {'success': false, 'error': data['error'], 'retryable': true};
      }
      return data;
    });
  }

  // Auth
  Future<Map<String, dynamic>> login(String email, String password) async {
    return _post('/api/auth/login', {'email': email, 'password': password});
  }

  Future<Map<String, dynamic>> register({
    required String name,
    required String email,
    required String password,
    required String phone,
    required String registerNumber,
    required String collegeId,
  }) async {
    return _post('/api/auth/register', {
      'name': name,
      'email': email,
      'password': password,
      'role': 'customer',
      'phone': phone,
      'registerNumber': registerNumber,
      'collegeId': collegeId,
    });
  }

  // Colleges — defensive: server may return branding/bannerFeatures as JSON strings
  // (pgSet JSON.stringify on write, toCamelCase leaves them as strings on read),
  // and in some edge cases `colleges` itself arrives double-encoded.
  Future<List<College>> getColleges() async {
    final data = await _get('/api/colleges');
    final rawColleges = data['colleges'];
    int? rawLen;
    String rawType = rawColleges == null ? 'null' : rawColleges.runtimeType.toString();
    try {
      if (rawColleges is List) rawLen = rawColleges.length;
      else if (rawColleges is String) rawLen = rawColleges.length;
    } catch (_) {}
    debugPrint('[ApiService] getColleges raw success=${data['success']} error=${data['error']} keys=${data.keys.toList()} collegesType=$rawType collegesLen=$rawLen');
    if (data['success'] == true && rawColleges != null) {
      try {
        dynamic list = rawColleges;
        // Defensive: if server double-encoded the list as a JSON string
        if (list is String) {
          list = jsonDecode(list);
        }
        if (list is! List) {
          throw Exception('Expected colleges to be a List but got ${list.runtimeType}');
        }
        return list.map((c) {
          var m = c;
          if (m is String) m = jsonDecode(m);
          return College.fromJson(m as Map<String, dynamic>);
        }).toList();
      } catch (e, st) {
        debugPrint('[ApiService] getColleges parse error: $e\n$st');
        throw Exception('Failed to parse colleges: $e');
      }
    }
    final err = data['error']?.toString() ?? 'Could not load colleges (${data['success']})';
    debugPrint('[ApiService] getColleges failure: $err full=$data');
    throw Exception(err);
  }

  // Canteens — only send collegeId when it is a real non-empty value.
  // An empty string must NOT be sent: Express treats `?collegeId=` as
  // falsy and returns ALL canteens (cross-college leak).
  Future<List<Canteen>> getCanteens({String? collegeId}) async {
    final params = <String, String>{};
    if (collegeId != null && collegeId.trim().isNotEmpty) {
      params['collegeId'] = collegeId.trim();
    }
    final data = await _get('/api/canteens', params);
    if (data['success'] == true && data['canteens'] != null) {
      return (data['canteens'] as List).map((c) => Canteen.fromJson(c)).toList();
    }
    return [];
  }

  // SubCanteens
  Future<List<SubCanteen>> getSubCanteens() async {
    final data = await _get('/api/subcanteens');
    if (data['success'] == true && data['subcanteens'] != null) {
      return (data['subcanteens'] as List).map((s) => SubCanteen.fromJson(s)).toList();
    }
    return [];
  }

  // Canteen data (menu items, reviews)
  Future<Map<String, dynamic>> getCanteenData(String canteenId) async {
    return _get('/api/canteen', {'canteenId': canteenId});
  }

  // Menu items
  List<MenuItem> parseMenuItems(Map<String, dynamic> data) {
    if (data['success'] == true && data['canteen'] != null && data['canteen']['items'] != null) {
      return (data['canteen']['items'] as List).map((m) => MenuItem.fromJson(m)).toList();
    }
    return [];
  }

  List<Review> parseReviews(Map<String, dynamic> data) {
    if (data['success'] == true && data['canteen'] != null && data['canteen']['reviews'] != null) {
      return (data['canteen']['reviews'] as List).map((r) => Review.fromJson(r)).toList();
    }
    return [];
  }

  // Place order
  Future<Map<String, dynamic>> placeOrder({
    required String userId,
    required String userName,
    required List<Map<String, dynamic>> items,
    String pickupSlot = 'ASAP (Instant)',
    required String canteenId,
    String? subCanteenId,
    String? collegeId,
    String? offerId,
    String? paymentMethod,
    String gateway = 'razorpay',
  }) async {
    final gw = gateway == 'wallet' ? 'wallet' : 'razorpay';
    return _post('/api/canteen/order', {
      'userId': userId,
      'userName': userName,
      'items': items,
      'paymentMethod': paymentMethod ?? (gw == 'wallet' ? 'Wallet' : 'Razorpay Gateway'),
      'gateway': gw,
      'pickupSlot': pickupSlot,
      'canteenId': canteenId,
      if (subCanteenId != null) 'subCanteenId': subCanteenId,
      if (collegeId != null && collegeId.trim().isNotEmpty) 'collegeId': collegeId.trim(),
      if (offerId != null && offerId.isNotEmpty) 'offerId': offerId,
    }, allowRetry: false);
  }

  // User orders
  Future<List<Order>> getUserOrders(String userId, {String? canteenId}) async {
    final params = <String, String>{'userId': userId};
    // Never send `?canteenId=` — an empty value disables server-side scoping.
    final c = canteenId?.trim() ?? '';
    if (c.isNotEmpty) params['canteenId'] = c;
    final data = await _get('/api/user/orders', params);
    if (data['success'] == true && data['orders'] != null) {
      final List<Order> parsed = [];
      for (final o in (data['orders'] as List)) {
        try {
          parsed.add(Order.fromJson(o as Map<String, dynamic>));
        } catch (e) {
          debugPrint('[ApiService] Skipping unparseable order: $e');
        }
      }
      return parsed;
    }
    return [];
  }

  // Support tickets
  Future<List<SupportTicket>> getSupportTickets(String userId) async {
    final data = await _get('/api/support/user', {'userId': userId});
    if (data['success'] == true && data['tickets'] != null) {
      return (data['tickets'] as List).map((t) => SupportTicket.fromJson(t)).toList();
    }
    return [];
  }

  Future<Map<String, dynamic>> submitSupportTicket({
    required String userId,
    required String userName,
    required String userEmail,
    required String category,
    required String subject,
    required String message,
  }) async {
    return _post('/api/support/submit', {
      'userId': userId,
      'userName': userName,
      'userEmail': userEmail,
      'category': category,
      'subject': subject,
      'description': message,
    });
  }

  // Update order status
  Future<Map<String, dynamic>> updateOrderStatus(String orderId,
      String status) async {
    // Never auto-retry: the server pushes a customer notification per call,
    // so a retried POST would notify twice for one tap.
    return _post('/api/canteen/order/status', {'id': orderId, 'status': status},
        allowRetry: false);
  }
  // Add review
  Future<Map<String, dynamic>> addReview({
    required String userId,
    required String userName,
    required int rating,
    required String comment,
    String? menuItemId,
    String? menuItemName,
  }) async {
    return _post('/api/canteen/review', {
      'userId': userId,
      'userName': userName,
      'rating': rating,
      'comment': comment,
      if (menuItemId != null) 'menuItemId': menuItemId,
      if (menuItemName != null) 'menuItemName': menuItemName,
    });
  }

  // Parse all orders from canteen data (for staff)
  List<Order> parseOrders(Map<String, dynamic> data) {
    if (data['success'] == true && data['canteen'] != null && data['canteen']['orders'] != null) {
      return (data['canteen']['orders'] as List).map((o) => Order.fromJson(o)).toList();
    }
    return [];
  }

  // Razorpay verify with retry (server may be cold-starting)
  Future<Map<String, dynamic>> verifyRazorpayPayment({
    required String razorpayOrderId,
    required String razorpayPaymentId,
    required String razorpaySignature,
  }) async {
    for (int attempt = 0; attempt < 3; attempt++) {
      try {
        final resp = await _authedSend((h) => http
            .post(
              Uri.parse('$_baseUrl/api/razorpay/verify'),
              headers: h,
              body: jsonEncode({
                'razorpay_order_id': razorpayOrderId,
                'razorpay_payment_id': razorpayPaymentId,
                'razorpay_signature': razorpaySignature,
              }),
            )
            .timeout(const Duration(seconds: 30)));
        final data = _withSessionFlag(_decode(resp), resp.statusCode);
        if (data['success'] == true || data['alreadyVerified'] == true) return data;
        // Server may not have order yet (cold start) — retry
        if (data['retryable'] == true && attempt < 2) {
          await Future.delayed(Duration(seconds: 2 * (attempt + 1)));
          continue;
        }
        return data;
      } catch (e) {
        if (attempt < 2) {
          await Future.delayed(Duration(seconds: 2 * (attempt + 1)));
          continue;
        }
        return {'success': false, 'error': e.toString()};
      }
    }
    return {'success': false, 'error': 'Verify failed after retries'};
  }

  Future<Map<String, dynamic>> verifyQr(String code) async {
    return _get('/api/canteen/qr/verify', {'code': code});
  }

  // Mark order collected via QR
  Future<Map<String, dynamic>> collectOrder(String code) async {
    return _post('/api/canteen/qr/verify', {'code': code, 'action': 'collect'});
  }

  // ── OFFERS ──
  Future<List<Map<String, dynamic>>> getActiveOffers(String canteenId) async {
    final data = await _get('/api/offers/active', {'canteenId': canteenId});
    if (data['success'] == true) {
      return List<Map<String, dynamic>>.from(data['offers'] ?? []);
    }
    return [];
  }

  Future<Map<String, dynamic>> applyOffer(String offerId, List<Map<String, dynamic>> cartItems, String canteenId) async {
    return _post('/api/offers/apply', {
      'offerId': offerId,
      'cartItems': cartItems,
      'canteenId': canteenId,
    });
  }

  Future<Map<String, dynamic>> saveCanteenSettings({
    required String canteenId,
    required int noShowMinutes,
    required int defaultSlotCapacity,
    required int slotDuration,
    required int prepBufferMinutes,
    required int orderCutoffMinutes,
    required int advanceBookingDays,
  }) async {
    return _post('/api/canteen/settings', {
      'canteenId': canteenId,
      'noShowMinutes': noShowMinutes,
      'defaultSlotCapacity': defaultSlotCapacity,
      'slotDuration': slotDuration,
      'prepBufferMinutes': prepBufferMinutes,
      'orderCutoffMinutes': orderCutoffMinutes,
      'advanceBookingDays': advanceBookingDays,
    });
  }

  // ── WALLET ──
  // Server wallet GETs resolve authUser (when middleware ran) else the
  // userId query param — always send both so reads never 401 for a
  // logged-in user even on routes without the auth middleware.
  Map<String, String> _walletScope([Map<String, String>? extra]) {
    final uid = AuthService().currentUser?.id;
    return {
      if (uid != null && uid.isNotEmpty) 'userId': uid,
      ...?extra,
    };
  }

  Future<Map<String, dynamic>> getWallet() async {
    return _get('/api/wallet', _walletScope());
  }

  Future<Map<String, dynamic>> getWalletBalance() async {
    return _get('/api/wallet/balance', _walletScope());
  }

  Future<Map<String, dynamic>> getWalletTransactions({int page = 1, int limit = 20}) async {
    return _get('/api/wallet/transactions',
        _walletScope({'page': page.toString(), 'limit': limit.toString()}));
  }

  Future<Map<String, dynamic>> getWalletTopups({int page = 1, int limit = 20}) async {
    // Server has no dedicated /api/wallet/topups route — topups are embedded
    // in GET /api/wallet. Fetch wallet and reshape for WalletProvider.
    final res = await _get('/api/wallet');
    if (res['success'] == true && res['topups'] != null) {
      return {'success': true, 'topups': res['topups']};
    }
    return res;
  }

  Future<Map<String, dynamic>> initiateWalletTopup({
    required int amount,
    required String provider,
  }) async {
    return _post('/api/wallet/topup', {
      'amount': amount,
      'provider': provider,
    });
  }

  Future<Map<String, dynamic>> confirmWalletTopup({
    required String topupId,
    required String provider,
    String? providerOrderId,
    String? providerPaymentId,
  }) async {
    return _post('/api/wallet/topup/confirm', {
      'topupId': topupId,
      'provider': provider,
      if (providerOrderId != null) 'providerOrderId': providerOrderId,
      if (providerPaymentId != null) 'providerPaymentId': providerPaymentId,
    });
  }

  Future<Map<String, dynamic>> payWithWallet({
    required String orderId,
    required int amount,
    required String idempotencyKey,
  }) async {
    try {
      return await _post('/api/wallet/pay', {
        'orderId': orderId,
        'amount': amount,
        'idempotencyKey': idempotencyKey,
      });
    } catch (e) {
      // Fallback: wallet orders are now placed via /api/canteen/order gateway=wallet.
      return {'success': false, 'error': e.toString()};
    }
  }

Future<Map<String, dynamic>> requestRefund({
    required String transactionId,
    required int amount,
    required String idempotencyKey,
  }) async {
    return _post('/api/wallet/refund', {
      'transactionId': transactionId,
      'amount': amount,
      'idempotencyKey': idempotencyKey,
    });
  }

  // ── CHEFS ──
  Future<Map<String, dynamic>> getChefs({String? canteenId}) async {
    final params = <String, String>{};
    final c = canteenId?.trim() ?? '';
    if (c.isNotEmpty) params['canteenId'] = c;
    return _get('/api/chefs', params);
  }

  Future<Map<String, dynamic>> createChef({
    required String canteenId,
    required String name,
    String? phone,
    String? email,
    List<String> specialization = const [],
    String? userId,
  }) async {
    return _post('/api/chefs', {
      'canteenId': canteenId,
      'name': name,
      if (phone != null) 'phone': phone,
      if (email != null) 'email': email,
      'specialization': specialization,
      if (userId != null) 'userId': userId,
    });
  }

  Future<Map<String, dynamic>> updateChef({
    required String chefId,
    String? name,
    String? phone,
    String? email,
    List<String>? specialization,
    String? status,
    bool? isAvailable,
  }) async {
    final body = <String, dynamic>{};
    if (name != null) body['name'] = name;
    if (phone != null) body['phone'] = phone;
    if (email != null) body['email'] = email;
    if (specialization != null) body['specialization'] = specialization;
    if (status != null) body['status'] = status;
    if (isAvailable != null) body['isAvailable'] = isAvailable;
    final resp = await _authedSend((h) => http
        .put(
          Uri.parse('$_baseUrl/api/chefs/$chefId'),
          headers: h,
          body: jsonEncode(body),
        )
        .timeout(_timeout));
    final data = _withSessionFlag(_decode(resp), resp.statusCode);
    if (resp.statusCode >= 500 && data['error'] != null) {
      return {'success': false, 'error': data['error'], 'retryable': true};
    }
    return data;
  }

  Future<Map<String, dynamic>> deleteChef({required String chefId}) async {
    final resp = await _authedSend((h) => http
        .delete(
          Uri.parse('$_baseUrl/api/chefs/$chefId'),
          headers: h,
        )
        .timeout(_timeout));
    final data = _withSessionFlag(_decode(resp), resp.statusCode);
    if (resp.statusCode >= 500 && data['error'] != null) {
      return {'success': false, 'error': data['error'], 'retryable': true};
    }
    return data;
  }

  Future<Map<String, dynamic>> setChefLeave({
    required String chefId,
    required int startDate,
    required int endDate,
    String? reason,
  }) async {
    return _post('/api/chefs/$chefId/leave', {
      'startDate': startDate,
      'endDate': endDate,
      if (reason != null) 'reason': reason,
    });
  }

  Future<Map<String, dynamic>> getChefLeave({String? chefId}) async {
    final params = <String, String>{};
    final ch = chefId?.trim() ?? '';
    if (ch.isNotEmpty) params['chefId'] = ch;
    return _get('/api/chefs/leaves', params);
  }

  // ── KITCHEN TASKS ──
  Future<Map<String, dynamic>> getKitchenTasks({String? canteenId, String? chefId}) async {
    final params = <String, String>{};
    final c = canteenId?.trim() ?? '';
    if (c.isNotEmpty) params['canteenId'] = c;
    final ch = chefId?.trim() ?? '';
    if (ch.isNotEmpty) params['chefId'] = ch;
    return _get('/api/kitchen/tasks', params);
  }

  Future<Map<String, dynamic>> updateKitchenTaskStatus({
    required String taskId,
    required String status,
  }) async {
    return _post('/api/kitchen/tasks/$taskId/status', {'status': status});
  }

  // ── ITEM CHEF ASSIGNMENT ──
  Future<Map<String, dynamic>> assignChefToItem({
    required String itemId,
    String? primaryChefId,
    String? backupChefId,
    String? preparationType,
  }) async {
    return _post('/api/items/$itemId/assign-chef', {
      if (primaryChefId != null) 'primaryChefId': primaryChefId,
      if (backupChefId != null) 'backupChefId': backupChefId,
      if (preparationType != null) 'preparationType': preparationType,
    });
  }

}
