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

  static int _asInt(dynamic v, [int fallback = 0]) {
    if (v == null) return fallback;
    if (v is int) return v;
    if (v is num) return v.toInt();
    if (v is String) return int.tryParse(v) ?? fallback;
    return fallback;
  }

  static double _asDouble(dynamic v) {
    if (v == null) return 0;
    if (v is num) return v.toDouble();
    if (v is String) return double.tryParse(v) ?? 0;
    return 0;
  }

  factory OrderItem.fromJson(Map<String, dynamic> json) {
    return OrderItem(
      itemId: json['itemId'] ?? json['id'] ?? '',
      name: json['name'] ?? '',
      price: _asDouble(json['price']),
      quantity: _asInt(json['quantity'], 1),
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
      case 'pending': return '⏳';
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
      case 'pending': return 'Pending Payment';
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
      totalPrice: OrderItem._asDouble(json['totalPrice']),
      paymentStatus: json['paymentStatus'] ?? 'pending',
      paymentMethod: json['paymentMethod'] ?? '',
      qrCode: json['qrCode'] ?? '',
      qrPayload: json['qrPayload']?.toString(),
      status: json['status'] ?? 'scheduled',
      timestamp: json['timestamp']?.toString(),
      createdAt: OrderItem._asInt(json['createdAt']),
      pickupTimeText: json['pickupTimeText']?.toString(),
      pickupSlot: json['pickupSlot']?.toString(),
      prepStartTime: OrderItem._asInt(json['prepStartTime']),
      expiryTime: OrderItem._asInt(json['expiryTime']),
      canteenId: json['canteenId']?.toString(),
      subCanteenId: json['subCanteenId']?.toString(),
      collegeId: json['collegeId']?.toString(),
    );
  }
}

class SupportTicket {
  final String id;
  final String userId;
  final String userName;
  final String userEmail;
  final String category;
  final String subject;
  final String description;
  final String? orderId;
  final String status;
  final String priority;
  final int createdAt;
  final int updatedAt;
  final String? canteenId;
  final String? collegeId;
  final String? adminReply;
  final int? adminRepliedAt;

  SupportTicket({
    required this.id,
    required this.userId,
    required this.userName,
    required this.userEmail,
    required this.category,
    required this.subject,
    required this.description,
    this.orderId,
    required this.status,
    required this.priority,
    required this.createdAt,
    required this.updatedAt,
    this.canteenId,
    this.collegeId,
    this.adminReply,
    this.adminRepliedAt,
  });

  factory SupportTicket.fromJson(Map<String, dynamic> json) {
    return SupportTicket(
      id: json['id'] ?? '',
      userId: json['userId'] ?? '',
      userName: json['userName'] ?? '',
      userEmail: json['userEmail'] ?? '',
      category: json['category'] ?? '',
      subject: json['subject'] ?? '',
      description: json['description'] ?? '',
      orderId: json['orderId'],
      status: json['status'] ?? 'open',
      priority: json['priority'] ?? 'medium',
      createdAt: OrderItem._asInt(json['createdAt']),
      updatedAt: OrderItem._asInt(json['updatedAt']),
      canteenId: json['canteenId']?.toString(),
      collegeId: json['collegeId']?.toString(),
      adminReply: json['adminReply'],
      adminRepliedAt: OrderItem._asInt(json['adminRepliedAt']),
    );
  }

  String get statusLabel {
    switch (status) {
      case 'open': return 'Open';
      case 'in_progress': return 'In Progress';
      case 'resolved': return 'Resolved';
      case 'closed': return 'Closed';
      default: return status;
    }
  }
}
