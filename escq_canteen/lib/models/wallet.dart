import 'dart:convert';

enum WalletTransactionType {
  TOPUP,
  PURCHASE,
  REFUND,
  REVERSAL,
  ADJUSTMENT,
}

enum WalletTransactionDirection {
  CREDIT,
  DEBIT,
}

enum WalletTransactionStatus {
  SUCCESS,
  PENDING,
  FAILED,
  REVERSED,
}

enum WalletStatus {
  ACTIVE,
  FROZEN,
  SUSPENDED,
  CLOSED,
}

enum WalletTopupProvider {
  RAZORPAY,
  VYAPAR,
  STRIPE,
  MOCK,
}

enum WalletTopupStatus {
  PENDING,
  SUCCESS,
  FAILED,
  CANCELLED,
  REFUNDED,
}

class WalletTransaction {
  final String id;
  final String walletId;
  final String type; // TOPUP, PURCHASE, REFUND, REVERSAL, ADJUSTMENT
  final int amount; // in paise
  final String direction; // CREDIT, DEBIT
  final String status; // SUCCESS, PENDING, FAILED, REVERSED
  final String? referenceType; // ORDER, TOPUP, REFUND, REVERSAL, ADJUSTMENT
  final String? referenceId;
  final String? idempotencyKey;
  final String description;
  final int createdAt;

  WalletTransaction({
    required this.id,
    required this.walletId,
    required this.type,
    required this.amount,
    required this.direction,
    required this.status,
    this.referenceType,
    this.referenceId,
    this.idempotencyKey,
    this.description = '',
    required this.createdAt,
  });

  factory WalletTransaction.fromJson(Map<String, dynamic> json) {
    return WalletTransaction(
      id: json['id']?.toString() ?? '',
      walletId: json['wallet_id']?.toString() ?? '',
      type: json['type']?.toString() ?? '',
      amount: (json['amount'] as num?)?.toInt() ?? 0,
      direction: json['direction']?.toString() ?? 'CREDIT',
      status: json['status']?.toString() ?? 'SUCCESS',
      referenceType: json['reference_type']?.toString(),
      referenceId: json['reference_id']?.toString(),
      idempotencyKey: json['idempotency_key']?.toString(),
      description: json['description']?.toString() ?? '',
      createdAt: (json['created_at'] as num?)?.toInt() ?? 0,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'wallet_id': walletId,
    'type': type,
    'amount': amount,
    'direction': direction,
    'status': status,
    'reference_type': referenceType,
    'reference_id': referenceId,
    'idempotency_key': idempotencyKey,
    'description': description,
    'created_at': createdAt,
  };

  String get formattedAmount {
    final rupees = amount / 100;
    return '₹${rupees.toStringAsFixed(2)}';
  }

  String get formattedAmountWithSign {
    final rupees = amount / 100;
    final sign = direction == 'CREDIT' ? '+' : '-';
    return '$sign₹${rupees.toStringAsFixed(2)}';
  }

  String get formattedDate {
    final dt = DateTime.fromMillisecondsSinceEpoch(createdAt);
    final months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return '${dt.day} ${months[dt.month - 1]} ${dt.year}';
  }

  String get formattedTime {
    final dt = DateTime.fromMillisecondsSinceEpoch(createdAt);
    final hour = dt.hour.toString().padLeft(2, '0');
    final minute = dt.minute.toString().padLeft(2, '0');
    return '$hour:$minute';
  }

  bool get isCredit => direction == 'CREDIT';
  bool get isDebit => direction == 'DEBIT';
  bool get isSuccess => status == 'SUCCESS';
  bool get isPending => status == 'PENDING';
  bool get isFailed => status == 'FAILED';
  bool get isRefundTxn => type == 'REFUND';
  bool get isTopup => type == 'TOPUP';
  bool get isPurchase => type == 'PURCHASE';
}

class WalletTopup {
  final String id;
  final String walletId;
  final int amount; // in paise
  final String provider; // RAZORPAY, VYAPAR, STRIPE, MOCK
  final String? providerOrderId;
  final String? providerPaymentId;
  final String status; // PENDING, SUCCESS, FAILED, CANCELLED, REFUNDED
  final String? idempotencyKey;
  final int createdAt;
  final int updatedAt;

  WalletTopup({
    required this.id,
    required this.walletId,
    required this.amount,
    required this.provider,
    this.providerOrderId,
    this.providerPaymentId,
    required this.status,
    this.idempotencyKey,
    required this.createdAt,
    required this.updatedAt,
  });

  factory WalletTopup.fromJson(Map<String, dynamic> json) {
    return WalletTopup(
      id: json['id']?.toString() ?? '',
      walletId: json['wallet_id']?.toString() ?? '',
      amount: (json['amount'] as num?)?.toInt() ?? 0,
      provider: json['provider']?.toString() ?? '',
      providerOrderId: json['provider_order_id']?.toString(),
      providerPaymentId: json['provider_payment_id']?.toString(),
      status: json['status']?.toString() ?? 'PENDING',
      idempotencyKey: json['idempotency_key']?.toString(),
      createdAt: (json['created_at'] as num?)?.toInt() ?? 0,
      updatedAt: (json['updated_at'] as num?)?.toInt() ?? 0,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'wallet_id': walletId,
    'amount': amount,
    'provider': provider,
    'provider_order_id': providerOrderId,
    'provider_payment_id': providerPaymentId,
    'status': status,
    'idempotency_key': idempotencyKey,
    'created_at': createdAt,
    'updated_at': updatedAt,
  };

  String get formattedAmount {
    final rupees = amount / 100;
    return '₹${rupees.toStringAsFixed(2)}';
  }

  bool get isSuccess => status == 'SUCCESS';
  bool get isPending => status == 'PENDING';
  bool get isFailed => status == 'FAILED';
  bool get isCancelled => status == 'CANCELLED';
  bool get isRefunded => status == 'REFUNDED';

  String get formattedDate {
    final dt = DateTime.fromMillisecondsSinceEpoch(createdAt);
    final months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return '${dt.day} ${months[dt.month - 1]} ${dt.year}';
  }
}

class Wallet {
  final String id;
  final String userId;
  final String currency;
  final String status;
  final int balance; // in paise
  final int createdAt;
  final int updatedAt;
  final List<WalletTransaction>? transactions;

  Wallet({
    required this.id,
    required this.userId,
    required this.currency,
    required this.status,
    required this.balance,
    required this.createdAt,
    required this.updatedAt,
    this.transactions,
  });

  factory Wallet.fromJson(Map<String, dynamic> json) {
    return Wallet(
      id: json['id']?.toString() ?? '',
      userId: json['user_id']?.toString() ?? '',
      currency: json['currency']?.toString() ?? 'INR',
      status: json['status']?.toString() ?? 'ACTIVE',
      balance: (json['balance'] as num?)?.toInt() ?? 0,
      createdAt: (json['created_at'] as num?)?.toInt() ?? 0,
      updatedAt: (json['updated_at'] as num?)?.toInt() ?? 0,
      transactions: (json['transactions'] as List<dynamic>?)
          ?.map((e) => WalletTransaction.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'user_id': userId,
    'currency': currency,
    'status': status,
    'balance': balance,
    'created_at': createdAt,
    'updated_at': updatedAt,
    'transactions': transactions?.map((e) => e.toJson()).toList(),
  };

  String get formattedBalance {
    final rupees = balance / 100;
    return '₹${rupees.toStringAsFixed(2)}';
  }

  String get formattedBalanceShort {
    final rupees = balance / 100;
    if (rupees >= 1000) {
      return '₹${(rupees / 1000).toStringAsFixed(1)}K';
    }
    return '₹${rupees.toStringAsFixed(0)}';
  }

  bool get isActive => status == 'ACTIVE';
  bool get isFrozen => status == 'FROZEN';
  bool get isSuspended => status == 'SUSPENDED';
  bool get isClosed => status == 'CLOSED';
}