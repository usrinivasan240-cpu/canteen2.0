import 'package:flutter/material.dart';
import '../models/order.dart';
import '../models/review.dart';
import '../services/api_service.dart';

class OrderProvider extends ChangeNotifier {
  final ApiService _api = ApiService();

  List<Order> _orders = [];
  List<Order> get orders => _orders;

  List<Review> _reviews = [];
  List<Review> get reviews => _reviews;

  bool _loading = false;
  bool get loading => _loading;

  Order? _lastOrder;
  Order? get lastOrder => _lastOrder;

  void setLastOrder(Order? order) {
    _lastOrder = order;
    notifyListeners();
  }

  void setReviews(List<Review> reviews) {
    _reviews = reviews;
    notifyListeners();
  }

  Future<void> loadOrders(String userId, {String? canteenId}) async {
    try {
      _orders = await _api.getUserOrders(userId, canteenId: canteenId);
      notifyListeners();
    } catch (e) {
      print('Error loading orders: $e');
    }
  }

  Future<Map<String, dynamic>> placeOrder({
    required String userId,
    required String userName,
    required List<Map<String, dynamic>> items,
    String pickupSlot = 'ASAP (Instant)',
    String canteenId = 'canteen_001',
    String? subCanteenId,
  }) async {
    try {
      final result = await _api.placeOrder(
        userId: userId,
        userName: userName,
        items: items,
        pickupSlot: pickupSlot,
        canteenId: canteenId,
        subCanteenId: subCanteenId,
      );
      if (result['success'] == true) {
        _lastOrder = Order.fromJson(result['order']);
        await loadOrders(userId, canteenId: canteenId);
      }
      notifyListeners();
      return result;
    } catch (e) {
      return {'success': false, 'error': 'Network failure placing order'};
    }
  }

  Future<Map<String, dynamic>> addReview({
    required String userId,
    required String userName,
    required int rating,
    required String comment,
    String? menuItemId,
    String? menuItemName,
  }) async {
    try {
      return await _api.addReview(
        userId: userId,
        userName: userName,
        rating: rating,
        comment: comment,
        menuItemId: menuItemId,
        menuItemName: menuItemName,
      );
    } catch (e) {
      return {'success': false, 'error': 'Network failure posting review'};
    }
  }
}
