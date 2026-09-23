import 'dart:convert';

dynamic _maybeJsonDecode(dynamic v) {
  if (v is String) {
    final t = v.trim();
    if ((t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']'))) {
      try { return jsonDecode(t); } catch (_) { return v; }
    }
  }
  return v;
}

class CollegeBranding {
  final String? heroTitle;
  final String? heroSubtitle;
  final String? heroTagline;
  final List<String>? featureBadges;
  final String? menuTitle;
  final String? menuSubtitle;
  final int? menuColumns;
  final bool? showCategoryTabs;
  final bool? showReviews;
  final bool? showSentiment;
  final String? contactPhone;
  final String? contactEmail;
  final String? contactAddress;
  final String? footerCopyright;
  final String? heroLayout;
  final String? heroBannerPosition;
  final int? heroLogoSize;
  final String? heroPadding;
  final String? menuCardSize;
  final String? menuGap;
  final String? menuAlignment;
  final String? footerLayout;
  final String? sectionSpacing;
  final String? headerStyle;

  CollegeBranding({
    this.heroTitle,
    this.heroSubtitle,
    this.heroTagline,
    this.featureBadges,
    this.menuTitle,
    this.menuSubtitle,
    this.menuColumns,
    this.showCategoryTabs,
    this.showReviews,
    this.showSentiment,
    this.contactPhone,
    this.contactEmail,
    this.contactAddress,
    this.footerCopyright,
    this.heroLayout,
    this.heroBannerPosition,
    this.heroLogoSize,
    this.heroPadding,
    this.menuCardSize,
    this.menuGap,
    this.menuAlignment,
    this.footerLayout,
    this.sectionSpacing,
    this.headerStyle,
  });

  factory CollegeBranding.fromJson(dynamic raw) {
    final decoded = _maybeJsonDecode(raw);
    final json = decoded is Map<String, dynamic>
        ? decoded
        : decoded is Map
            ? Map<String, dynamic>.from(decoded)
            : <String, dynamic>{};
    List<String>? badges;
    final fb = _maybeJsonDecode(json['featureBadges']);
    if (fb is List) badges = fb.map((e) => e.toString()).toList();
    return CollegeBranding(
      heroTitle: json['heroTitle']?.toString(),
      heroSubtitle: json['heroSubtitle']?.toString(),
      heroTagline: json['heroTagline']?.toString(),
      featureBadges: badges,
      menuTitle: json['menuTitle']?.toString(),
      menuSubtitle: json['menuSubtitle']?.toString(),
      menuColumns: json['menuColumns'] is int ? json['menuColumns'] : int.tryParse(json['menuColumns']?.toString() ?? ''),
      showCategoryTabs: json['showCategoryTabs'] is bool ? json['showCategoryTabs'] : null,
      showReviews: json['showReviews'] is bool ? json['showReviews'] : null,
      showSentiment: json['showSentiment'] is bool ? json['showSentiment'] : null,
      contactPhone: json['contactPhone']?.toString(),
      contactEmail: json['contactEmail']?.toString(),
      contactAddress: json['contactAddress']?.toString(),
      footerCopyright: json['footerCopyright']?.toString(),
      heroLayout: json['heroLayout']?.toString(),
      heroBannerPosition: json['heroBannerPosition']?.toString(),
      heroLogoSize: json['heroLogoSize'] is int ? json['heroLogoSize'] : int.tryParse(json['heroLogoSize']?.toString() ?? ''),
      heroPadding: json['heroPadding']?.toString(),
      menuCardSize: json['menuCardSize']?.toString(),
      menuGap: json['menuGap']?.toString(),
      menuAlignment: json['menuAlignment']?.toString(),
      footerLayout: json['footerLayout']?.toString(),
      sectionSpacing: json['sectionSpacing']?.toString(),
      headerStyle: json['headerStyle']?.toString(),
    );
  }
}

class College {
  final String id;
  final String name;
  final String location;
  final String? logoUrl;
  final String? bannerUrl;
  final String? bannerSubtitle;
  final List<String>? bannerFeatures;
  final CollegeBranding? branding;
  final Map<String, dynamic>? platformFees;
  final String status;

  College({
    required this.id,
    required this.name,
    required this.location,
    this.logoUrl,
    this.bannerUrl,
    this.bannerSubtitle,
    this.bannerFeatures,
    this.branding,
    this.platformFees,
    this.status = 'active',
  });

  factory College.fromJson(Map<String, dynamic> json) {
    List<String>? feats;
    final bf = _maybeJsonDecode(json['bannerFeatures']);
    if (bf is List) feats = bf.map((e) => e.toString()).toList();
    CollegeBranding? br;
    if (json['branding'] != null) {
      try { br = CollegeBranding.fromJson(json['branding']); } catch (_) { br = null; }
    }
    Map<String, dynamic>? pf;
    final rawPf = _maybeJsonDecode(json['platformFees']);
    if (rawPf is Map<String, dynamic>) {
      pf = rawPf;
    } else if (rawPf is Map) {
      try { pf = Map<String, dynamic>.from(rawPf); } catch (_) { pf = null; }
    }
    return College(
      id: (json['id'] ?? '').toString(),
      name: (json['name'] ?? '').toString(),
      location: (json['location'] ?? '').toString(),
      logoUrl: json['logoUrl']?.toString(),
      bannerUrl: json['bannerUrl']?.toString(),
      bannerSubtitle: json['bannerSubtitle']?.toString(),
      bannerFeatures: feats,
      branding: br,
      platformFees: pf,
      status: (json['status'] ?? 'active').toString(),
    );
  }

  /// Superadmin-configured platform fee for a cart amount (mirrors the
  /// server's calculatePlatformFee). Display estimate only — the server
  /// computes the charged fee authoritatively per order.
  double platformFeeFor(double amount) {
    final pf = platformFees;
    if (pf == null || amount <= 0) return 0;
    switch ((pf['type'] ?? 'free').toString()) {
      case 'flat':
        return ((pf['flatAmount'] as num?) ?? 0).toDouble();
      case 'percentage':
        final pct = ((pf['percentage'] as num?) ?? 0).toDouble();
        return (amount * pct / 100).round().toDouble();
      case 'tiered':
        final tiers = pf['tiers'];
        if (tiers is List) {
          for (final t in tiers) {
            if (t is Map) {
              final min = ((t['minAmount'] as num?) ?? 0).toDouble();
              final maxRaw = t['maxAmount'];
              final max = maxRaw == null ? double.infinity : ((maxRaw as num?) ?? double.infinity).toDouble();
              if (amount >= min && amount <= max) {
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
}

class Canteen {
  final String id;
  final String name;
  final String collegeId;
  final String? ownerId;
  final String status;

  Canteen({
    required this.id,
    required this.name,
    required this.collegeId,
    this.ownerId,
    this.status = 'active',
  });

  factory Canteen.fromJson(Map<String, dynamic> json) {
    return Canteen(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      collegeId: json['collegeId'] ?? '',
      ownerId: json['ownerId'],
      status: json['status'] ?? 'active',
    );
  }
}

class SubCanteen {
  final String id;
  final String name;
  final String canteenId;
  final String status;

  SubCanteen({
    required this.id,
    required this.name,
    required this.canteenId,
    this.status = 'active',
  });

  factory SubCanteen.fromJson(Map<String, dynamic> json) {
    return SubCanteen(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      canteenId: json['canteenId'] ?? '',
      status: json['status'] ?? 'active',
    );
  }
}
