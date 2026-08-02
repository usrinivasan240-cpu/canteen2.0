class OrderItem {
  final String itemId;
  final String name;
  final double price;
  final int quantity;

  OrderItem({
    required this.itemId,
    required this.name,
    required this.price,
    required this.quantity,
  });

  factory OrderItem.fromJson(Map<String, dynamic> json) {
    return OrderItem(
      itemId: json['itemId'] ?? '',
      name: json['name'] ?? '',
      price: (json['price'] ?? 0).toDouble(),
      quantity: json['quantity'] ?? 1,
    );
  }

  Map<String, dynamic> toJson() => {
    'itemId': itemId,
    'name': name,
    'price': price,
    'quantity': quantity,
  };

  double get total => price * quantity;
}

class Order {
  final String id;
  final String userId;
  final String userName;
  final List<OrderItem> items;
  final double totalPrice;
  final String paymentStatus;
  final String paymentMethod;
  final String qrCode;
  final String? qrPayload;
  final String status;
  final String? timestamp;
  final int? createdAt;
  final String? pickupTimeText;
  final String? pickupSlot;
  final int? prepStartTime;
  final int? expiryTime;
  final String? canteenId;
  final String? subCanteenId;
  final String? collegeId;

  Order({
    required this.id,
    required this.userId,
    required this.userName,
    required this.items,
    required this.totalPrice,
    this.paymentStatus = 'pending',
    this.paymentMethod = '',
    this.qrCode = '',
    this.qrPayload,
    this.status = 'scheduled',
    this.timestamp,
    this.createdAt,
    this.pickupTimeText,
    this.pickupSlot,
    this.prepStartTime,
    this.expiryTime,
    this.canteenId,
    this.subCanteenId,
    this.collegeId,
  });

  String get statusEmoji {
    switch (status) {
      case 'scheduled': return '📋';
      case 'preparing': return '👨‍🍳';
      case 'ready': return '✅';
      case 'collected': return '🎉';
      case 'delivered': return '🎉';
      case 'expired': return '⏰';
      case 'cancelled': return '❌';
      default: return '📋';
    }
  }

  String get statusLabel {
    switch (status) {
      case 'scheduled': return 'Scheduled';
      case 'preparing': return 'Preparing';
      case 'ready': return 'Ready';
      case 'collected': return 'Collected';
      case 'delivered': return 'Collected';
      case 'expired': return 'Expired';
      case 'cancelled': return 'Cancelled';
      default: return status;
    }
  }

  factory Order.fromJson(Map<String, dynamic> json) {
    return Order(
      id: json['id'] ?? '',
      userId: json['userId'] ?? '',
      userName: json['userName'] ?? '',
      items: (json['items'] as List<dynamic>?)
          ?.map((e) => OrderItem.fromJson(e as Map<String, dynamic>))
          .toList() ?? [],
      totalPrice: (json['totalPrice'] ?? 0).toDouble(),
      paymentStatus: json['paymentStatus'] ?? 'pending',
      paymentMethod: json['paymentMethod'] ?? '',
      qrCode: json['qrCode'] ?? '',
      qrPayload: json['qrPayload'],
      status: json['status'] ?? 'scheduled',
      timestamp: json['timestamp'],
      createdAt: json['createdAt'],
      pickupTimeText: json['pickupTimeText'],
      pickupSlot: json['pickupSlot'],
      prepStartTime: json['prepStartTime'],
      expiryTime: json['expiryTime'],
      canteenId: json['canteenId'],
      subCanteenId: json['subCanteenId'],
      collegeId: json['collegeId'],
    );
  }
}
