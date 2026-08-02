class User {
  final String id;
  final String name;
  final String email;
  final String role;
  final String? phone;
  final String? registerNumber;
  final String? collegeId;
  final String? canteenId;
  final String? subCanteenId;
  final String status;

  User({
    required this.id,
    required this.name,
    required this.email,
    required this.role,
    this.phone,
    this.registerNumber,
    this.collegeId,
    this.canteenId,
    this.subCanteenId,
    this.status = 'active',
  });

  bool get isCustomer => role == 'customer';
  bool get isStaff => role == 'staff';
  bool get isChef => role == 'chef';
  bool get isOwner => role == 'owner';
  bool get isAdmin => role == 'admin';
  bool get isSuperAdmin => role == 'superadmin';
  bool get isBlockedRole => isAdmin || isSuperAdmin || isOwner;

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      email: json['email'] ?? '',
      role: json['role'] ?? 'customer',
      phone: json['phone'],
      registerNumber: json['registerNumber'],
      collegeId: json['collegeId'],
      canteenId: json['canteenId'],
      subCanteenId: json['subCanteenId'],
      status: json['status'] ?? 'active',
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'email': email,
    'role': role,
    'phone': phone,
    'registerNumber': registerNumber,
    'collegeId': collegeId,
    'canteenId': canteenId,
    'subCanteenId': subCanteenId,
    'status': status,
  };
}
