import 'package:flutter/material.dart';
import '../models/cart.dart';
import '../models/menu_item.dart';

export '../models/cart.dart' show CartItem, CartCanteenMismatchException;

class CartProvider extends ChangeNotifier {
  final Cart _cart = Cart();
  Cart get cart => _cart;

  Map<String, CartItem> get items => _cart.items;
  String? get canteenId => _cart.canteenId;

  int get totalItems => _cart.totalItems;
  double get subtotal => _cart.subtotal;
  double get convenienceFee => _cart.convenienceFee;
  double get pgCharge => _cart.pgCharge;
  double get totalAmount => _cart.totalAmount;
  bool get isEmpty => _cart.totalItems == 0;

  String? addItem(MenuItem item, {int qty = 1}) {
    try {
      _cart.addItem(item, qty: qty);
      notifyListeners();
      return null;
    } on CartCanteenMismatchException catch (e) {
      return e.message;
    }
  }

  void updateQuantity(String itemId, int qty) {
    _cart.updateQuantity(itemId, qty);
    notifyListeners();
  }

  void removeItem(String itemId) {
    _cart.removeItem(itemId);
    notifyListeners();
  }

  void clear() {
    _cart.clear();
    notifyListeners();
  }

  int getItemQty(String itemId) {
    return _cart.items[itemId]?.quantity ?? 0;
  }

  List<Map<String, dynamic>> toOrderPayload() {
    return _cart.toOrderPayload();
  }
}
