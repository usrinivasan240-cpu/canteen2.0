import 'menu_item.dart';

class CartItem {
  final MenuItem menuItem;
  int quantity;

  CartItem({required this.menuItem, this.quantity = 1});

  double get total => menuItem.price * quantity;
}

class Cart {
  final Map<String, CartItem> _items = {};
  String? _canteenId;

  Map<String, CartItem> get items => Map.unmodifiable(_items);
  String? get canteenId => _canteenId;

  int get totalItems => _items.values.fold(0, (sum, item) => sum + item.quantity);

  double get subtotal => _items.values.fold(0.0, (sum, item) => sum + item.total);

  double get convenienceFee {
    if (subtotal <= 0) return 0;
    return (subtotal / 100).ceil().toDouble();
  }

  double get pgCharge {
    if (subtotal <= 0) return 0;
    final base = subtotal + convenienceFee;
    return (base / 0.9764) - base;
  }

  double get totalAmount => subtotal + convenienceFee + pgCharge;

  bool get isEmpty => _items.isEmpty;

  void addItem(MenuItem item, {int qty = 1}) {
    if (_canteenId != null && _canteenId != item.canteenId) {
      throw CartCanteenMismatchException(
        'Your cart has items from a different canteen. Please complete or clear that order first.',
      );
    }
    _canteenId = item.canteenId;
    if (_items.containsKey(item.id)) {
      _items[item.id]!.quantity += qty;
    } else {
      _items[item.id] = CartItem(menuItem: item, quantity: qty);
    }
  }

  void updateQuantity(String itemId, int qty) {
    if (qty <= 0) {
      _items.remove(itemId);
    } else if (_items.containsKey(itemId)) {
      _items[itemId]!.quantity = qty;
    }
    if (_items.isEmpty) _canteenId = null;
  }

  void removeItem(String itemId) {
    _items.remove(itemId);
    if (_items.isEmpty) _canteenId = null;
  }

  void clear() {
    _items.clear();
    _canteenId = null;
  }

  List<Map<String, dynamic>> toOrderPayload() {
    return _items.entries.map((e) => {
      'itemId': e.key,
      'name': e.value.menuItem.name,
      'quantity': e.value.quantity,
    }).toList();
  }
}

class CartCanteenMismatchException implements Exception {
  final String message;
  CartCanteenMismatchException(this.message);
  @override
  String toString() => message;
}
