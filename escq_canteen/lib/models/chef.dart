import 'dart:convert';

enum ChefStatus {
  AVAILABLE,
  UNAVAILABLE,
  ON_LEAVE,
  INACTIVE,
}

extension ChefStatusExtension on ChefStatus {
  String get value {
    switch (this) {
      case ChefStatus.AVAILABLE:
        return 'AVAILABLE';
      case ChefStatus.UNAVAILABLE:
        return 'UNAVAILABLE';
      case ChefStatus.ON_LEAVE:
        return 'ON_LEAVE';
      case ChefStatus.INACTIVE:
        return 'INACTIVE';
    }
  }
}

extension ChefStatusParse on String {
  ChefStatus toChefStatus() {
    switch (toUpperCase()) {
      case 'AVAILABLE':
        return ChefStatus.AVAILABLE;
      case 'UNAVAILABLE':
        return ChefStatus.UNAVAILABLE;
      case 'ON_LEAVE':
        return ChefStatus.ON_LEAVE;
      case 'INACTIVE':
        return ChefStatus.INACTIVE;
      default:
        return ChefStatus.INACTIVE;
    }
  }
}

class Chef {
  final String id;
  final String canteenId;
  final String? userId;
  final String name;
  final String phone;
  final String email;
  final List<String> specialization;
  final String status;
  final bool isAvailable;
  final int createdAt;
  final int updatedAt;
  final String? createdBy;

  Chef({
    required this.id,
    required this.canteenId,
    this.userId,
    required this.name,
    this.phone = '',
    this.email = '',
    this.specialization = const [],
    this.status = 'AVAILABLE',
    this.isAvailable = true,
    required this.createdAt,
    required this.updatedAt,
    this.createdBy,
  });

  factory Chef.fromJson(Map<String, dynamic> json) {
    return Chef(
      id: json['id']?.toString() ?? '',
      canteenId: json['canteen_id']?.toString() ?? '',
      userId: json['user_id']?.toString(),
      name: json['name']?.toString() ?? '',
      phone: json['phone']?.toString() ?? '',
      email: json['email']?.toString() ?? '',
      specialization: (json['specialization'] as List<dynamic>?)
          ?.map((e) => e.toString())
          .toList() ?? [],
      status: json['status']?.toString() ?? 'AVAILABLE',
      isAvailable: json['is_available'] ?? true,
      createdAt: (json['created_at'] as num?)?.toInt() ?? 0,
      updatedAt: (json['updated_at'] as num?)?.toInt() ?? 0,
      createdBy: json['created_by']?.toString(),
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'canteen_id': canteenId,
    'user_id': userId,
    'name': name,
    'phone': phone,
    'email': email,
    'specialization': specialization,
    'status': status,
    'is_available': isAvailable,
    'created_at': createdAt,
    'updated_at': updatedAt,
    'created_by': createdBy,
  };

  ChefStatus get statusEnum {
    switch (status) {
      case 'AVAILABLE':
        return ChefStatus.AVAILABLE;
      case 'UNAVAILABLE':
        return ChefStatus.UNAVAILABLE;
      case 'ON_LEAVE':
        return ChefStatus.ON_LEAVE;
      case 'INACTIVE':
        return ChefStatus.INACTIVE;
      default:
        return ChefStatus.INACTIVE;
    }
  }

  bool get isAvailableStatus => isAvailable && status == 'AVAILABLE';
  bool get isOnLeave => status == 'ON_LEAVE';
  bool get isInactive => status == 'INACTIVE' || status == 'UNAVAILABLE';

  String get statusLabel {
    switch (status) {
      case 'AVAILABLE':
        return 'Available';
      case 'UNAVAILABLE':
        return 'Unavailable';
      case 'ON_LEAVE':
        return 'On Leave';
      case 'INACTIVE':
        return 'Inactive';
      default:
        return status;
    }
  }
}

enum KitchenTaskStatus {
  PENDING,
  ACCEPTED,
  PREPARING,
  READY,
  CANCELLED,
  COMPLETED,
}

extension KitchenTaskStatusExtension on KitchenTaskStatus {
  String get value {
    switch (this) {
      case KitchenTaskStatus.PENDING:
        return 'PENDING';
      case KitchenTaskStatus.ACCEPTED:
        return 'ACCEPTED';
      case KitchenTaskStatus.PREPARING:
        return 'PREPARING';
      case KitchenTaskStatus.READY:
        return 'READY';
      case KitchenTaskStatus.CANCELLED:
        return 'CANCELLED';
      case KitchenTaskStatus.COMPLETED:
        return 'COMPLETED';
    }
  }
}

extension KitchenTaskStatusParse on String {
  KitchenTaskStatus toKitchenTaskStatus() {
    switch (toUpperCase()) {
      case 'PENDING':
        return KitchenTaskStatus.PENDING;
      case 'ACCEPTED':
        return KitchenTaskStatus.ACCEPTED;
      case 'PREPARING':
        return KitchenTaskStatus.PREPARING;
      case 'READY':
        return KitchenTaskStatus.READY;
      case 'CANCELLED':
        return KitchenTaskStatus.CANCELLED;
      case 'COMPLETED':
        return KitchenTaskStatus.COMPLETED;
      default:
        return KitchenTaskStatus.PENDING;
    }
  }
}

class KitchenTask {
  final String id;
  final String orderId;
  final String orderItemId;
  final String itemId;
  final String itemName;
  final int quantity;
  final String canteenId;
  final String? chefId;
  final String status;
  final int priority;
  final int assignedAt;
  final int startedAt;
  final int completedAt;
  final int createdAt;
  final int updatedAt;

  KitchenTask({
    required this.id,
    required this.orderId,
    required this.orderItemId,
    required this.itemId,
    required this.itemName,
    required this.quantity,
    required this.canteenId,
    this.chefId,
    required this.status,
    this.priority = 0,
    this.assignedAt = 0,
    this.startedAt = 0,
    this.completedAt = 0,
    required this.createdAt,
    required this.updatedAt,
  });

  factory KitchenTask.fromJson(Map<String, dynamic> json) {
    return KitchenTask(
      id: json['id']?.toString() ?? '',
      orderId: json['order_id']?.toString() ?? '',
      orderItemId: json['order_item_id']?.toString() ?? '',
      itemId: json['item_id']?.toString() ?? '',
      itemName: json['item_name']?.toString() ?? '',
      quantity: (json['quantity'] as num?)?.toInt() ?? 1,
      canteenId: json['canteen_id']?.toString() ?? '',
      chefId: json['chef_id']?.toString(),
      status: json['status']?.toString() ?? 'PENDING',
      priority: (json['priority'] as num?)?.toInt() ?? 0,
      assignedAt: (json['assigned_at'] as num?)?.toInt() ?? 0,
      startedAt: (json['started_at'] as num?)?.toInt() ?? 0,
      completedAt: (json['completed_at'] as num?)?.toInt() ?? 0,
      createdAt: (json['created_at'] as num?)?.toInt() ?? 0,
      updatedAt: (json['updated_at'] as num?)?.toInt() ?? 0,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'order_id': orderId,
    'order_item_id': orderItemId,
    'item_id': itemId,
    'item_name': itemName,
    'quantity': quantity,
    'canteen_id': canteenId,
    'chef_id': chefId,
    'status': status,
    'priority': priority,
    'assigned_at': assignedAt,
    'started_at': startedAt,
    'completed_at': completedAt,
    'created_at': createdAt,
    'updated_at': updatedAt,
  };

  KitchenTaskStatus get statusEnum {
    return status.toKitchenTaskStatus();
  }

  bool get isPending => status == 'PENDING';
  bool get isAccepted => status == 'ACCEPTED';
  bool get isPreparing => status == 'PREPARING';
  bool get isReady => status == 'READY';
  bool get isCancelled => status == 'CANCELLED';
  bool get isCompleted => status == 'COMPLETED';
  bool get isActive => isPending || isAccepted || isPreparing;

  String get statusLabel {
    switch (status) {
      case 'PENDING':
        return 'Pending';
      case 'ACCEPTED':
        return 'Accepted';
      case 'PREPARING':
        return 'Preparing';
      case 'READY':
        return 'Ready';
      case 'CANCELLED':
        return 'Cancelled';
      case 'COMPLETED':
        return 'Completed';
      default:
        return status;
    }
  }

  String get statusColor {
    switch (status) {
      case 'PENDING':
        return '#F59E0B';
      case 'ACCEPTED':
        return '#3B82F6';
      case 'PREPARING':
        return '#EA580C';
      case 'READY':
        return '#16A34A';
      case 'CANCELLED':
        return '#EF4444';
      case 'COMPLETED':
        return '#8B5CF6';
      default:
        return '#6B7280';
    }
  }
}

class ChefLeave {
  final String id;
  final String chefId;
  final int startDate;
  final int endDate;
  final String reason;
  final int createdAt;
  final String? createdBy;

  ChefLeave({
    required this.id,
    required this.chefId,
    required this.startDate,
    required this.endDate,
    this.reason = '',
    required this.createdAt,
    this.createdBy,
  });

  factory ChefLeave.fromJson(Map<String, dynamic> json) {
    return ChefLeave(
      id: json['id']?.toString() ?? '',
      chefId: json['chef_id']?.toString() ?? '',
      startDate: (json['start_date'] as num?)?.toInt() ?? 0,
      endDate: (json['end_date'] as num?)?.toInt() ?? 0,
      reason: json['reason']?.toString() ?? '',
      createdAt: (json['created_at'] as num?)?.toInt() ?? 0,
      createdBy: json['created_by']?.toString(),
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'chef_id': chefId,
    'start_date': startDate,
    'end_date': endDate,
    'reason': reason,
    'created_at': createdAt,
    'created_by': createdBy,
  };

  bool get isActive {
    final now = DateTime.now().millisecondsSinceEpoch;
    return startDate <= DateTime.now().millisecondsSinceEpoch &&
        endDate >= DateTime.now().millisecondsSinceEpoch;
  }

  String get formattedStartDate {
    final dt = DateTime.fromMillisecondsSinceEpoch(startDate);
    return '${dt.day}/${dt.month}/${dt.year}';
  }

  String get formattedEndDate {
    final dt = DateTime.fromMillisecondsSinceEpoch(endDate);
    return '${dt.day}/${dt.month}/${dt.year}';
  }

  String get formattedRange {
    return '$formattedStartDate - $formattedEndDate';
  }
}

class ChefAvailability {
  final String id;
  final String chefId;
  final int dayOfWeek; // 0=Sunday, 6=Saturday
  final String startTime; // HH:MM
  final String endTime; // HH:MM
  final bool isActive;
  final int createdAt;

  ChefAvailability({
    required this.id,
    required this.chefId,
    required this.dayOfWeek,
    required this.startTime,
    required this.endTime,
    this.isActive = true,
    required this.createdAt,
  });

  factory ChefAvailability.fromJson(Map<String, dynamic> json) {
    return ChefAvailability(
      id: json['id']?.toString() ?? '',
      chefId: json['chef_id']?.toString() ?? '',
      dayOfWeek: (json['day_of_week'] as num?)?.toInt() ?? 0,
      startTime: json['start_time']?.toString() ?? '',
      endTime: json['end_time']?.toString() ?? '',
      isActive: json['is_active'] ?? true,
      createdAt: (json['created_at'] as num?)?.toInt() ?? 0,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'chef_id': chefId,
    'day_of_week': dayOfWeek,
    'start_time': startTime,
    'end_time': endTime,
    'is_active': isActive,
    'created_at': createdAt,
  };

  String get dayName {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dayOfWeek];
  }
}