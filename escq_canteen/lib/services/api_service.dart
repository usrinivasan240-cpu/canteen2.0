import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../config.dart';
import '../models/menu_item.dart';
import '../models/order.dart';
import '../models/college.dart';
import '../models/review.dart';

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

  Future<Map<String, dynamic>> _post(String path, Map<String, dynamic> body) async {
    return _retryRequest(() async {
      final resp = await http.post(
        Uri.parse('$_baseUrl$path'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode(body),
      ).timeout(_timeout);
      final data = jsonDecode(resp.body);
      if (resp.statusCode >= 500 && data['error'] != null) {
        return {'success': false, 'error': data['error'], 'retryable': true};
      }
      return data;
    });
  }

  Future<Map<String, dynamic>> _get(String path, [Map<String, String>? params]) async {
    return _retryRequest(() async {
      var uri = Uri.parse('$_baseUrl$path');
      if (params != null && params.isNotEmpty) {
        uri = uri.replace(queryParameters: params);
      }
      final resp = await http.get(uri).timeout(_timeout);
      final data = jsonDecode(resp.body);
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

  // Colleges
  Future<List<College>> getColleges() async {
    final data = await _get('/api/colleges');
    if (data['success'] == true && data['colleges'] != null) {
      return (data['colleges'] as List).map((c) => College.fromJson(c)).toList();
    }
    return [];
  }

  // Canteens
  Future<List<Canteen>> getCanteens() async {
    final data = await _get('/api/canteens');
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
    String canteenId = 'canteen_001',
    String? subCanteenId,
    String? paymentMethod,
  }) async {
    return _post('/api/canteen/order', {
      'userId': userId,
      'userName': userName,
      'items': items,
      'paymentMethod': paymentMethod ?? 'Razorpay Gateway',
      'gateway': 'razorpay',
      'pickupSlot': pickupSlot,
      'canteenId': canteenId,
      if (subCanteenId != null) 'subCanteenId': subCanteenId,
    });
  }

  // User orders
  Future<List<Order>> getUserOrders(String userId, {String? canteenId}) async {
    final params = <String, String>{'userId': userId};
    if (canteenId != null) params['canteenId'] = canteenId;
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

  // Update order status
  Future<Map<String, dynamic>> updateOrderStatus(String orderId, String status) async {
    return _post('/api/canteen/order/status', {'id': orderId, 'status': status});
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
        final resp = await http.post(
          Uri.parse('$_baseUrl/api/razorpay/verify'),
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({
            'razorpay_order_id': razorpayOrderId,
            'razorpay_payment_id': razorpayPaymentId,
            'razorpay_signature': razorpaySignature,
          }),
        ).timeout(const Duration(seconds: 30));
        final data = jsonDecode(resp.body);
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
}
