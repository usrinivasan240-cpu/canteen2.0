import 'menu_item.dart';

class CartItem {
  final MenuItem menuItem;
  int quantity;

  CartItem({required this.menuItem, this.quantity = 1});

  double get total => menuItem.price * quantity;
}

class Cart {
  final Map<String, CartItem> _items = {};

  Map<String, CartItem> get items => Map.unmodifiable(_items);

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

  void addItem(MenuItem item, {int qty = 1}) {
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
  }

  void removeItem(String itemId) {
    _items.remove(itemId);
  }

  void clear() {
    _items.clear();
  }

  List<Map<String, dynamic>> toOrderPayload() {
    return _items.entries.map((e) => {
      'itemId': e.key,
      'name': e.value.menuItem.name,
      'quantity': e.value.quantity,
    }).toList();
  }
}
