class Offer {
  final String id;
  final String title;
  final String description;
  final String offerType; // 'discount', 'flat', 'combo'
  final double discountPercent;
  final double discountAmount;
  final double comboPrice;
  final List<String> comboItemIds;
  final List<String> applicableItemIds;
  final double minOrderAmount;
  final int maxUses;
  final int usedCount;
  final int validFrom;
  final int validUntil;
  final bool isActive;
  final String canteenId;
  final int createdAt;

  Offer({
    required this.id,
    required this.title,
    this.description = '',
    required this.offerType,
    this.discountPercent = 0,
    this.discountAmount = 0,
    this.comboPrice = 0,
    this.comboItemIds = const [],
    this.applicableItemIds = const [],
    this.minOrderAmount = 0,
    this.maxUses = 0,
    this.usedCount = 0,
    this.validFrom = 0,
    this.validUntil = 0,
    this.isActive = true,
    this.canteenId = 'canteen_001',
    this.createdAt = 0,
  });

  factory Offer.fromJson(Map<String, dynamic> json) {
    return Offer(
      id: json['id'] ?? '',
      title: json['title'] ?? '',
      description: json['description'] ?? '',
      offerType: json['offerType'] ?? json['offer_type'] ?? 'discount',
      discountPercent: (json['discountPercent'] ?? json['discount_percent'] ?? 0).toDouble(),
      discountAmount: (json['discountAmount'] ?? json['discount_amount'] ?? 0).toDouble(),
      comboPrice: (json['comboPrice'] ?? json['combo_price'] ?? 0).toDouble(),
      comboItemIds: List<String>.from(json['comboItemIds'] ?? json['combo_item_ids'] ?? []),
      applicableItemIds: List<String>.from(json['applicableItemIds'] ?? json['applicable_item_ids'] ?? []),
      minOrderAmount: (json['minOrderAmount'] ?? json['min_order_amount'] ?? 0).toDouble(),
      maxUses: json['maxUses'] ?? json['max_uses'] ?? 0,
      usedCount: json['usedCount'] ?? json['used_count'] ?? 0,
      validFrom: json['validFrom'] ?? json['valid_from'] ?? 0,
      validUntil: json['validUntil'] ?? json['valid_until'] ?? 0,
      isActive: json['isActive'] ?? true,
      canteenId: json['canteenId'] ?? json['canteen_id'] ?? 'canteen_001',
      createdAt: json['createdAt'] ?? json['created_at'] ?? 0,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'title': title,
    'description': description,
    'offerType': offerType,
    'discountPercent': discountPercent,
    'discountAmount': discountAmount,
    'comboPrice': comboPrice,
    'comboItemIds': comboItemIds,
    'applicableItemIds': applicableItemIds,
    'minOrderAmount': minOrderAmount,
    'maxUses': maxUses,
    'usedCount': usedCount,
    'validFrom': validFrom,
    'validUntil': validUntil,
    'isActive': isActive,
    'canteenId': canteenId,
    'createdAt': createdAt,
  };

  bool get isValidNow {
    final now = DateTime.now().millisecondsSinceEpoch;
    if (validFrom > 0 && now < validFrom) return false;
    if (validUntil > 0 && now > validUntil) return false;
    if (maxUses > 0 && usedCount >= maxUses) return false;
    return isActive;
  }

  double calculateDiscount(double cartTotal, List<Map<String, dynamic>> cartItems) {
    if (offerType == 'discount') {
      if (discountPercent > 0) {
        return (cartTotal * discountPercent / 100).roundToDouble();
      } else if (discountAmount > 0) {
        return discountAmount < cartTotal ? discountAmount : cartTotal;
      }
    } else if (offerType == 'combo') {
      double comboOriginal = 0;
      for (var item in cartItems) {
        if (comboItemIds.contains(item['itemId'])) {
          comboOriginal += (item['price'] ?? 0).toDouble() * (item['quantity'] ?? 1);
        }
      }
      if (comboOriginal > comboPrice) {
        return comboOriginal - comboPrice;
      }
    } else if (offerType == 'flat') {
      return discountAmount < cartTotal ? discountAmount : cartTotal;
    }
    return 0;
  }

  String get displayText {
    if (offerType == 'discount') {
      return '${discountPercent.toInt()}% OFF';
    } else if (offerType == 'flat') {
      return '₹${discountAmount.toInt()} OFF';
    } else if (offerType == 'combo') {
      return 'Combo ₹${comboPrice.toInt()}';
    }
    return title;
  }

  String get typeLabel {
    switch (offerType) {
      case 'discount': return 'DISCOUNT';
      case 'flat': return 'FLAT OFF';
      case 'combo': return 'COMBO';
      default: return 'OFFER';
    }
  }
}
