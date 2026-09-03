class MenuItem {
  final String id;
  final String name;
  final double price;
  final int stock;
  final double rating;
  final int ratingCount;
  final bool available;
  final String category;
  final String description;
  final String? imageUrl;
  final List<String> tags;
  final int prepTime;
  final int dailyLimit;
  final int bookedToday;
  final bool isPaused;
  final String? canteenId;
  final String? subCanteenId;
  final String? collegeId;
  final bool requiresChef;

  MenuItem({
    required this.id,
    required this.name,
    required this.price,
    this.stock = 0,
    this.rating = 0,
    this.ratingCount = 0,
    this.available = true,
    this.category = '',
    this.description = '',
    this.imageUrl,
    this.tags = const [],
    this.prepTime = 15,
    this.dailyLimit = 50,
    this.bookedToday = 0,
    this.isPaused = false,
    this.canteenId,
    this.subCanteenId,
    this.collegeId,
    this.requiresChef = true,
  });

  bool get inStock => stock > 0 && bookedToday < dailyLimit && !isPaused;

  factory MenuItem.fromJson(Map<String, dynamic> json) {
    return MenuItem(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      price: (json['price'] ?? 0).toDouble(),
      stock: json['stock'] ?? 0,
      rating: (json['rating'] ?? 0).toDouble(),
      ratingCount: json['ratingCount'] ?? 0,
      available: json['available'] ?? true,
      category: json['category'] ?? '',
      description: json['description'] ?? '',
      imageUrl: json['imageUrl'],
      tags: (json['tags'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? [],
      prepTime: json['prepTime'] ?? 15,
      dailyLimit: json['dailyLimit'] ?? 50,
      bookedToday: json['bookedToday'] ?? 0,
      isPaused: json['isPaused'] ?? false,
      canteenId: json['canteenId'],
      subCanteenId: json['subCanteenId'],
      collegeId: json['collegeId'],
      requiresChef: json['requiresChef'] != false,
    );
  }
}
