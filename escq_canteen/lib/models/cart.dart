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
  // Superadmin-configured fee table of the shopper's college. Set once per
  // checkout from the college record; the fee below derives from it so the
  // bill shows the live configured fee instead of hardcoded charges.
  Map<String, dynamic>? _feeConfig;

  Map<String, CartItem> get items => Map.unmodifiable(_items);
  String? get canteenId => _canteenId;

  int get totalItems => _items.values.fold(0, (sum, item) => sum + item.quantity);

  double get subtotal => _items.values.fold(0.0, (sum, item) => sum + item.total);

  void setFeeConfig(Map<String, dynamic>? config) {
    _feeConfig = config;
  }

  /// The single customer fee: superadmin college platform fee.
  double get platformFee {
    final cfg = _feeConfig;
    if (cfg == null || subtotal <= 0) return 0;
    switch ((cfg['type'] ?? 'free').toString()) {
      case 'flat':
        return ((cfg['flatAmount'] as num?) ?? 0).toDouble();
      case 'percentage':
        final pct = ((cfg['percentage'] as num?) ?? 0).toDouble();
        return (subtotal * pct / 100).round().toDouble();
      case 'tiered':
        final tiers = cfg['tiers'];
        if (tiers is List) {
          for (final t in tiers) {
            if (t is Map) {
              final min = ((t['minAmount'] as num?) ?? 0).toDouble();
              final maxRaw = t['maxAmount'];
              final max = maxRaw == null
                  ? double.infinity
                  : ((maxRaw as num?) ?? double.infinity).toDouble();
              if (subtotal >= min && subtotal <= max) {
                return ((t['feeAmount'] as num?) ?? 0).toDouble();
              }
            }
          }
        }
        return 0;
      default:
        return 0;
    }
  }

  /// Legacy hardcoded charges — retired in the single-fee model.
  /// Kept (zero) so existing UI references keep compiling.
  double get convenienceFee => 0;

  double get pgCharge => 0;

  double get totalAmount => subtotal + platformFee;

  bool get isEmpty => _items.isEmpty;

  void addItem(MenuItem item, {int qty = 1}) {
    // Fail closed: an item without canteen attribution must never silently
    // mix into the cart (previously null ids bypassed the guard entirely).
    final incoming = item.canteenId?.trim() ?? '';
    if (incoming.isEmpty) {
      throw CartCanteenMismatchException(
        'This item is missing canteen info and can\'t be ordered. Please reload the menu.',
      );
    }
    if (_canteenId != null && _canteenId != incoming) {
      throw CartCanteenMismatchException(
        'Your cart has items from a different canteen. Please complete or clear that order first.',
      );
    }
    _canteenId = incoming;
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
    _feeConfig = null;
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
