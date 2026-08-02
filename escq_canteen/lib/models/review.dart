class Review {
  final String id;
  final String userId;
  final String userName;
  final int rating;
  final String comment;
  final String sentiment;
  final String? timestamp;
  final String? menuItemId;
  final String? menuItemName;

  Review({
    required this.id,
    required this.userId,
    required this.userName,
    required this.rating,
    required this.comment,
    this.sentiment = 'neutral',
    this.timestamp,
    this.menuItemId,
    this.menuItemName,
  });

  factory Review.fromJson(Map<String, dynamic> json) {
    return Review(
      id: json['id'] ?? '',
      userId: json['userId'] ?? '',
      userName: json['userName'] ?? '',
      rating: json['rating'] ?? 0,
      comment: json['comment'] ?? '',
      sentiment: json['sentiment'] ?? 'neutral',
      timestamp: json['timestamp'],
      menuItemId: json['menuItemId'],
      menuItemName: json['menuItemName'],
    );
  }
}
