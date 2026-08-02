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

  factory CollegeBranding.fromJson(Map<String, dynamic> json) {
    return CollegeBranding(
      heroTitle: json['heroTitle'],
      heroSubtitle: json['heroSubtitle'],
      heroTagline: json['heroTagline'],
      featureBadges: (json['featureBadges'] as List<dynamic>?)?.map((e) => e.toString()).toList(),
      menuTitle: json['menuTitle'],
      menuSubtitle: json['menuSubtitle'],
      menuColumns: json['menuColumns'],
      showCategoryTabs: json['showCategoryTabs'],
      showReviews: json['showReviews'],
      showSentiment: json['showSentiment'],
      contactPhone: json['contactPhone'],
      contactEmail: json['contactEmail'],
      contactAddress: json['contactAddress'],
      footerCopyright: json['footerCopyright'],
      heroLayout: json['heroLayout'],
      heroBannerPosition: json['heroBannerPosition'],
      heroLogoSize: json['heroLogoSize'],
      heroPadding: json['heroPadding'],
      menuCardSize: json['menuCardSize'],
      menuGap: json['menuGap'],
      menuAlignment: json['menuAlignment'],
      footerLayout: json['footerLayout'],
      sectionSpacing: json['sectionSpacing'],
      headerStyle: json['headerStyle'],
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
    this.status = 'active',
  });

  factory College.fromJson(Map<String, dynamic> json) {
    return College(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      location: json['location'] ?? '',
      logoUrl: json['logoUrl'],
      bannerUrl: json['bannerUrl'],
      bannerSubtitle: json['bannerSubtitle'],
      bannerFeatures: (json['bannerFeatures'] as List<dynamic>?)?.map((e) => e.toString()).toList(),
      branding: json['branding'] != null ? CollegeBranding.fromJson(json['branding']) : null,
      status: json['status'] ?? 'active',
    );
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
