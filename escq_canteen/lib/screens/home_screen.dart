import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:qr_flutter/qr_flutter.dart';
import '../providers/auth_provider.dart';
import '../providers/menu_provider.dart';
import '../providers/cart_provider.dart';
import '../providers/order_provider.dart';
import '../providers/theme_provider.dart';
import '../models/order.dart';
import '../models/menu_item.dart';
import '../models/college.dart';
import '../models/review.dart';
import '../services/api_service.dart';
import 'checkout_screen.dart';
import '../config.dart';
import 'settings_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  String selectedCategory = 'Meals';
  String customerTab = 'menu';
  Order? successOrder;
  bool _isLoading = true;
  String? _error;

  MenuItem? selectedReviewItem;
  int reviewRating = 5;
  String reviewComment = '';

  List<Order> _userOrders = [];
  List<Review> _reviews = [];

  List<College> _colleges = [];
  List<Canteen> _canteens = [];
  List<SubCanteen> _subCanteens = [];
  List<MenuItem> _menuItems = [];

  String _selectedCanteenId = 'canteen_001';
  String _selectedSubCanteenId = '';
  String _searchQuery = '';

  // Logo cache to prevent blinking on rebuilds
  final Map<String, Uint8List> _logoCache = {};

  @override
  void initState() {
    super.initState();
    _loadAll();
  }

  Future<void> _loadAll() async {
    setState(() { _isLoading = true; _error = null; });
    try {
      final api = ApiService();
      final auth = context.read<AuthProvider>();
      final user = auth.user;

      _selectedCanteenId = user?.canteenId ?? 'canteen_001';

      final results = await Future.wait([
        api.getColleges(),
        api.getCanteens(),
        api.getSubCanteens(),
        api.getCanteenData(_selectedCanteenId),
        api.getUserOrders(user?.id ?? ''),
      ]);

      _colleges = results[0] as List<College>;
      _canteens = results[1] as List<Canteen>;
      _subCanteens = results[2] as List<SubCanteen>;
      final canteenData = results[3] as Map<String, dynamic>;
      _userOrders = results[4] as List<Order>;

      _menuItems = api.parseMenuItems(canteenData);
      _reviews = api.parseReviews(canteenData);

      if (user?.collegeId != null) {
        try {
          _canteens.firstWhere((c) => c.id == _selectedCanteenId);
        } catch (_) {
          if (_canteens.isNotEmpty) _selectedCanteenId = _canteens.first.id;
        }
      } else if (_canteens.isNotEmpty) {
        _selectedCanteenId = _canteens.first.id;
      }

      if (_subCanteens.isNotEmpty) {
        try {
          final sub = _subCanteens.firstWhere((s) => s.canteenId == _selectedCanteenId);
          _selectedSubCanteenId = sub.id;
        } catch (_) {
          _selectedSubCanteenId = '';
        }
      }
    } catch (e) {
      _error = 'Failed to load data: $e';
    }
    if (mounted) setState(() => _isLoading = false);
  }

  College? get _userCollege {
    final user = context.read<AuthProvider>().user;
    if (user?.collegeId != null) {
      try { return _colleges.firstWhere((c) => c.id == user!.collegeId); } catch (_) {}
    }
    if (_canteens.isNotEmpty) {
      final cantId = _canteens.firstWhere(
        (c) => c.id == _selectedCanteenId,
        orElse: () => _canteens.first,
      );
      try { return _colleges.firstWhere((c) => c.id == cantId.collegeId); } catch (_) {}
    }
    return _colleges.isNotEmpty ? _colleges.first : null;
  }

  CollegeBranding get _branding => _userCollege?.branding ?? CollegeBranding();

  List<MenuItem> get _filteredItems {
    return _menuItems.where((item) {
      final catMatch = selectedCategory == 'All' ||
          item.category.toLowerCase().contains(selectedCategory.split(' ')[0].toLowerCase());
      final subMatch = _selectedSubCanteenId.isEmpty ||
          item.subCanteenId == null ||
          item.subCanteenId == _selectedSubCanteenId;
      final searchMatch = _searchQuery.isEmpty ||
          item.name.toLowerCase().contains(_searchQuery.toLowerCase()) ||
          item.category.toLowerCase().contains(_searchQuery.toLowerCase());
      return catMatch && subMatch && searchMatch;
    }).toList();
  }

  List<Canteen> get _collegeCanteens => _canteens.where((c) {
    final user = context.read<AuthProvider>().user;
    return c.collegeId == (user?.collegeId ?? _userCollege?.id);
  }).toList();

  // ─── HEADER ──────────────────────────────────────────────
  Widget _buildHeader(AuthProvider auth, user) {
    final cart = context.watch<CartProvider>();
    final themeProv = context.watch<ThemeProvider>();
    final cartCount = cart.totalItems;

    return Container(
      color: themeProv.isDark ? const Color(0xFF1F2937) : Colors.white,
      child: SafeArea(
        bottom: false,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          child: Row(
            children: [
              if (_userCollege?.logoUrl != null && _userCollege!.logoUrl!.isNotEmpty)
                ClipRRect(
                  borderRadius: BorderRadius.circular(10),
                  child: _buildLogoImage(_userCollege!.logoUrl!, 36, 36),
                )
              else
                _defaultLogo(),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _userCollege?.name ?? 'Esc(Q)',
                      style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: themeProv.isDark ? Colors.white : Colors.black87),
                      maxLines: 1, overflow: TextOverflow.ellipsis,
                    ),
                    Text('Esc(Q) Platform', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w500, color: themeProv.isDark ? Colors.grey[500] : Colors.grey)),
                  ],
                ),
              ),
              // Cart badge
              GestureDetector(
                onTap: () => setState(() => customerTab = 'menu'),
                child: Stack(
                  clipBehavior: Clip.none,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(6),
                      decoration: BoxDecoration(color: themeProv.isDark ? const Color(0xFF374151) : Colors.grey[100], borderRadius: BorderRadius.circular(8)),
                      child: Icon(Icons.shopping_cart_outlined, size: 16, color: themeProv.isDark ? Colors.grey[300] : Colors.grey[600]),
                    ),
                    if (cartCount > 0)
                      Positioned(
                        right: -4, top: -4,
                        child: Container(
                          padding: const EdgeInsets.all(4),
                          decoration: const BoxDecoration(color: Color(0xFFF59E0B), shape: BoxShape.circle),
                          child: Text('$cartCount', style: const TextStyle(fontSize: 8, fontWeight: FontWeight.bold, color: Colors.white)),
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              // Settings
              GestureDetector(
                onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const SettingsScreen())),
                child: Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(color: themeProv.isDark ? const Color(0xFF374151) : Colors.grey[50], borderRadius: BorderRadius.circular(8)),
                  child: Icon(Icons.settings, size: 14, color: themeProv.isDark ? Colors.grey[400] : Colors.grey),
                ),
              ),
              const SizedBox(width: 6),
              GestureDetector(
                onTap: () => auth.logout(),
                child: Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(color: themeProv.isDark ? const Color(0xFF374151) : Colors.grey[50], borderRadius: BorderRadius.circular(8)),
                  child: Icon(Icons.logout, size: 14, color: themeProv.isDark ? Colors.grey[400] : Colors.grey),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _defaultLogo() {
    return Container(
      width: 36, height: 36,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFFF59E0B).withOpacity(0.3)),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(10),
        child: Image.asset(
          'assets/images/escq_logo.png',
          fit: BoxFit.contain,
          errorBuilder: (_, __, ___) => _genericLogo((_userCollege?.name ?? 'Q').substring(0, 1).toUpperCase()),
        ),
      ),
    );
  }

  Widget _genericLogo(String initial) {
    return Container(
      width: 36, height: 36,
      decoration: BoxDecoration(
        gradient: const LinearGradient(colors: [Color(0xFFF59E0B), Color(0xFFEA580C)]),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Center(child: Text(initial, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: Colors.white))),
    );
  }

  Widget _buildLogoImage(String url, double width, double height) {
    if (url.startsWith('data:image')) {
      if (_logoCache.containsKey(url)) {
        return Image.memory(_logoCache[url]!, width: width, height: height, fit: BoxFit.contain, gaplessPlayback: true);
      }
      try {
        final base64Str = url.split(',').last;
        final bytes = base64Decode(base64Str);
        _logoCache[url] = bytes;
        return Image.memory(bytes, width: width, height: height, fit: BoxFit.contain, gaplessPlayback: true);
      } catch (_) {
        return _defaultLogo();
      }
    }
    return Image.network(url, width: width, height: height, fit: BoxFit.contain, gaplessPlayback: true,
      errorBuilder: (_, __, ___) => _defaultLogo(),
    );
  }

  Widget _buildHeroLogoImage(String url, double width, double height) {
    if (url.startsWith('data:image')) {
      if (_logoCache.containsKey(url)) {
        return Image.memory(_logoCache[url]!, width: width, height: height, fit: BoxFit.contain, gaplessPlayback: true);
      }
      try {
        final base64Str = url.split(',').last;
        final bytes = base64Decode(base64Str);
        _logoCache[url] = bytes;
        return Image.memory(bytes, width: width, height: height, fit: BoxFit.contain, gaplessPlayback: true);
      } catch (_) {
        return _heroLogoFallback();
      }
    }
    return Image.network(url, width: width, height: height, fit: BoxFit.contain, gaplessPlayback: true,
      errorBuilder: (_, __, ___) => _heroLogoFallback(),
    );
  }

  // ─── HERO (Logo + Text Only, No Banner) ─────────────────
  Widget _buildHero(bool isMobile) {
    final logoUrl = _userCollege?.logoUrl;
    final logoWidget = (logoUrl != null && logoUrl.isNotEmpty)
        ? ClipRRect(
            borderRadius: BorderRadius.circular(14),
            child: _buildHeroLogoImage(logoUrl, isMobile ? 64 : 100, isMobile ? 64 : 100),
          )
        : _heroLogoFallback();

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 16, 16, 0),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(colors: [Color(0xFFF59E0B), Color(0xFFEA580C)]),
        borderRadius: BorderRadius.circular(20),
        boxShadow: [BoxShadow(color: const Color(0xFFF59E0B).withOpacity(0.3), blurRadius: 12, offset: const Offset(0, 4))],
      ),
      child: Row(
        children: [
          logoWidget,
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'WELCOME TO',
                  style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: Colors.white.withOpacity(0.8), letterSpacing: 1.5),
                ),
                const SizedBox(height: 4),
                Text(
                  _decodeHtml(_branding.heroTitle ?? 'Esc(Q)'),
                  style: TextStyle(fontSize: isMobile ? 22 : 28, fontWeight: FontWeight.w900, color: Colors.white, height: 1.1),
                ),
                const SizedBox(height: 4),
                Text(_decodeHtml(_branding.heroSubtitle ?? 'Official Smart Canteen Platform'), style: TextStyle(fontSize: 13, color: Colors.white.withOpacity(0.85), height: 1.3)),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 6,
                  runSpacing: 4,
                  children: (_branding.featureBadges ?? ['Order Faster', 'Skip the Queue', 'Smart Pickup']).map((b) => Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.15),
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(color: Colors.white.withOpacity(0.3)),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.bolt, size: 10, color: Colors.white.withOpacity(0.9)),
                        const SizedBox(width: 3),
                        Text(b, style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: Colors.white.withOpacity(0.9))),
                      ],
                    ),
                  )).toList(),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _heroLogoFallback() {
    return Container(
      width: 64, height: 64,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFF59E0B).withOpacity(0.3)),
        boxShadow: [BoxShadow(color: const Color(0xFFF59E0B).withOpacity(0.1), blurRadius: 8)],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(14),
        child: Image.asset(
          'assets/images/escq_logo.png',
          fit: BoxFit.contain,
          errorBuilder: (_, __, ___) => _genericHeroLogo((_userCollege?.name ?? 'Esc(Q)').substring(0, 1).toUpperCase()),
        ),
      ),
    );
  }

  Widget _genericHeroLogo(String initial) {
    return Container(
      width: 64, height: 64,
      decoration: BoxDecoration(
        gradient: const LinearGradient(colors: [Color(0xFFF59E0B), Color(0xFFEA580C)]),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Center(child: Text(initial, style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w900, color: Colors.white))),
    );
  }

  // ─── CANTEEN + SEARCH ────────────────────────────────────
  Widget _buildCanteenAndSearch(bool isMobile) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildCanteenSelector(),
          const SizedBox(height: 8),
          _searchBar(),
        ],
      ),
    );
  }

  Widget _buildCanteenSelector() {
    final collegeCanteens = _collegeCanteens;
    if (collegeCanteens.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 4, bottom: 8),
          child: Text(
            'Select Canteen',
            style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Colors.grey[500]),
          ),
        ),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: collegeCanteens.map((c) {
              final isSelected = c.id == _selectedCanteenId;
              final subs = _subCanteens.where((s) => s.canteenId == c.id).toList();
              return GestureDetector(
                onTap: () async {
                  if (isSelected) return;
                  setState(() => _selectedCanteenId = c.id);
                  await _reloadMenuForCanteen(c.id);
                },
                child: Container(
                  margin: const EdgeInsets.only(right: 8),
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  decoration: BoxDecoration(
                    color: isSelected ? const Color(0xFFF59E0B) : Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: isSelected ? const Color(0xFFF59E0B) : const Color(0xFFE5E7EB),
                      width: isSelected ? 2 : 1,
                    ),
                    boxShadow: isSelected
                        ? [BoxShadow(color: const Color(0xFFF59E0B).withOpacity(0.25), blurRadius: 8, offset: const Offset(0, 2))]
                        : [BoxShadow(color: Colors.black.withOpacity(0.03), blurRadius: 4)],
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        isSelected ? Icons.store : Icons.store_outlined,
                        size: 14,
                        color: isSelected ? Colors.white : Colors.grey[600],
                      ),
                      const SizedBox(width: 6),
                      Text(
                        c.name,
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                          color: isSelected ? Colors.white : const Color(0xFF111827),
                        ),
                      ),
                      if (subs.isNotEmpty) ...[
                        const SizedBox(width: 4),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                          decoration: BoxDecoration(
                            color: isSelected ? Colors.white.withOpacity(0.25) : const Color(0xFFFEE2E2),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            '${subs.length}',
                            style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: isSelected ? Colors.white : Colors.amber[700]),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              );
            }).toList(),
          ),
        ),
        if (_collegeCanteens.length > 1) ...[
          const SizedBox(height: 6),
          _buildSubCanteenChips(),
        ],
      ],
    );
  }

  Widget _buildSubCanteenChips() {
    final subs = _subCanteens.where((s) => s.canteenId == _selectedCanteenId).toList();
    if (subs.isEmpty) return const SizedBox.shrink();

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          GestureDetector(
            onTap: () => setState(() => _selectedSubCanteenId = ''),
            child: Container(
              margin: const EdgeInsets.only(right: 6),
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: _selectedSubCanteenId.isEmpty ? const Color(0xFFFEF2F2) : Colors.white,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: _selectedSubCanteenId.isEmpty ? const Color(0xFFFECACA) : const Color(0xFFE5E7EB)),
              ),
              child: Text('All', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: _selectedSubCanteenId.isEmpty ? Colors.amber[700] : Colors.grey[600])),
            ),
          ),
          ...subs.map((sub) {
            final isActive = sub.id == _selectedSubCanteenId;
            return GestureDetector(
              onTap: () => setState(() => _selectedSubCanteenId = sub.id),
              child: Container(
                margin: const EdgeInsets.only(right: 6),
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: isActive ? const Color(0xFFFEF2F2) : Colors.white,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: isActive ? const Color(0xFFFECACA) : const Color(0xFFE5E7EB)),
                ),
                child: Text(sub.name, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: isActive ? Colors.amber[700] : Colors.grey[600])),
              ),
            );
          }),
        ],
      ),
    );
  }

  Future<void> _reloadMenuForCanteen(String canteenId) async {
    setState(() { _isLoading = true; _error = null; });
    try {
      final api = ApiService();
      final canteenData = await api.getCanteenData(canteenId);
      _menuItems = api.parseMenuItems(canteenData);
      _reviews = api.parseReviews(canteenData);
      _selectedSubCanteenId = '';
      selectedCategory = 'All';
    } catch (e) {
      _error = 'Failed to load canteen data: $e';
    }
    if (mounted) setState(() => _isLoading = false);
  }

  Widget _searchBar() {
    return TextField(
      onChanged: (v) => setState(() => _searchQuery = v),
      decoration: InputDecoration(
        hintText: 'Search menus, food items, categories...',
        hintStyle: const TextStyle(fontSize: 13, color: Color(0xFF9CA3AF)),
        prefixIcon: const Icon(Icons.search, size: 18, color: Color(0xFF6B7280)),
        filled: true,
        fillColor: Colors.white,
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFFE5E7EB)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFFE5E7EB)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFFF59E0B), width: 2),
        ),
      ),
      style: const TextStyle(fontSize: 12),
    );
  }

  // ─── TAB SWITCHER ────────────────────────────────────────
  Widget _buildTabSwitcher() {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 16, 16, 0),
      decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: Color(0xFFFEE2E2)))),
      child: Row(
        children: [
          _tabBtn('menu', 'MENU & ORDER'),
          _tabBtn('history', 'ORDER HISTORY & MILESTONES'),
        ],
      ),
    );
  }

  Widget _tabBtn(String id, String label) {
    final isActive = customerTab == id;
    return GestureDetector(
      onTap: () {
        setState(() => customerTab = id);
        // Refresh orders when switching to history tab
        if (id == 'history') {
          final user = context.read<AuthProvider>().user;
          if (user != null) _refreshOrders(user.id);
        }
      },
      behavior: HitTestBehavior.opaque,
      child: Container(
        padding: const EdgeInsets.only(bottom: 12, right: 20),
        decoration: BoxDecoration(
          border: Border(bottom: BorderSide(color: isActive ? const Color(0xFFF59E0B) : Colors.transparent, width: 2)),
        ),
          child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: isActive ? FontWeight.w900 : FontWeight.w700,
            color: isActive ? const Color(0xFFF59E0B) : Colors.grey,
            letterSpacing: 0.5,
          ),
        ),
      ),
    );
  }

  // ─── MENU GRID ───────────────────────────────────────────
  Widget _buildMenuGrid(bool isMobile, bool isTablet, String title, String subtitle) {
    final bShowCategoryTabs = _branding.showCategoryTabs ?? true;
    final crossCount = isMobile ? 2 : (isTablet ? 3 : 4);

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 16, 16, 0),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFFEE2E2)),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 4)],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: Colors.black87)),
                    const SizedBox(height: 2),
                    Text(subtitle, style: const TextStyle(fontSize: 12, color: Colors.grey)),
                  ],
                ),
              ),
              if (bShowCategoryTabs) _categoryTabs(),
            ],
          ),
          const SizedBox(height: 16),
          _filteredItems.isEmpty
              ? const Padding(
                  padding: EdgeInsets.all(32),
                  child: Center(child: Text('No menu items found', style: TextStyle(fontSize: 12, color: Colors.grey))),
                )
              : GridView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: crossCount,
                    crossAxisSpacing: 10,
                    mainAxisSpacing: 10,
                    childAspectRatio: 0.72,
                  ),
                  itemCount: _filteredItems.length,
                  itemBuilder: (ctx, i) => _menuCard(_filteredItems[i]),
                ),
        ],
      ),
    );
  }

  Widget _categoryTabs() {
    return Container(
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: const Color(0xFFFEE2E2).withOpacity(0.8),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFFFECACA).withOpacity(0.5)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: ['Meals', 'Snacks & Beverages'].map((cat) {
          final isActive = selectedCategory == cat;
          return GestureDetector(
            onTap: () => setState(() => selectedCategory = cat),
            behavior: HitTestBehavior.opaque,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: isActive ? Colors.white : Colors.transparent,
                borderRadius: BorderRadius.circular(8),
                boxShadow: isActive ? [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 4)] : null,
              ),
              child: Text(cat, style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: isActive ? Colors.amber[700] : Colors.grey)),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _menuCard(MenuItem item) {
    final cart = context.read<CartProvider>();
    final qty = cart.getItemQty(item.id);

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFFEE2E2)),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.03), blurRadius: 4)],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Image
          Expanded(
            flex: 4,
            child: Container(
              width: double.infinity,
              decoration: BoxDecoration(
                color: Colors.amber[50],
                borderRadius: const BorderRadius.vertical(top: Radius.circular(14)),
              ),
              child: ClipRRect(
                borderRadius: const BorderRadius.vertical(top: Radius.circular(14)),
                child: (item.imageUrl != null && item.imageUrl!.isNotEmpty)
                    ? Image.network(item.imageUrl!, fit: BoxFit.cover, width: double.infinity,
                        errorBuilder: (_, __, ___) => const Center(child: Text('🍲', style: TextStyle(fontSize: 28))),
                      )
                    : const Center(child: Text('🍲', style: TextStyle(fontSize: 28))),
              ),
            ),
          ),
          // Body
          Expanded(
            flex: 6,
            child: Padding(
              padding: const EdgeInsets.all(8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Text(item.name, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700), maxLines: 1, overflow: TextOverflow.ellipsis),
                      ),
                      Text('★ ${item.rating}', style: TextStyle(fontSize: 10, color: Colors.grey[400])),
                    ],
                  ),
                  const SizedBox(height: 2),
                  Row(
                    children: [
                      _miniTag('Prep: ${item.prepTime}m', Colors.amber[50]!, Colors.amber[800]!),
                      const SizedBox(width: 4),
                      _miniTag('Limit: ${item.dailyLimit}', Colors.grey[50]!, Colors.grey[500]!),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text('₹${item.price.toStringAsFixed(2)}', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Color(0xFFF59E0B))),
                  const Spacer(),
                  // BUTTON - always at bottom, full width, explicitly tappable
                  if (qty > 0)
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                          child: Container(
                            decoration: BoxDecoration(color: Colors.amber[50], borderRadius: BorderRadius.circular(8)),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                              children: [
                                _qtyBtn(Icons.remove, () {
                                  setState(() {
                                    if (qty <= 1) cart.removeItem(item.id);
                                    else cart.updateQuantity(item.id, qty - 1);
                                  });
                                }),
                                Text('$qty', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                                _qtyBtn(Icons.add, () {
                                  if (qty < item.stock) {
                                    setState(() => cart.updateQuantity(item.id, qty + 1));
                                  }
                                }),
                              ],
                            ),
                          ),
                        ),
                      ],
                    )
                  else
                    SizedBox(
                      width: double.infinity,
                      height: 32,
                      child: ElevatedButton(
                        onPressed: item.inStock ? () {
                          final errorMsg = cart.addItem(item);
                          if (errorMsg != null) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text(errorMsg),
                                duration: const Duration(seconds: 2),
                                backgroundColor: Colors.amber[700],
                                behavior: SnackBarBehavior.floating,
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                              ),
                            );
                          } else {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text('${item.name} added to cart'),
                                duration: const Duration(seconds: 1),
                                backgroundColor: const Color(0xFFF59E0B),
                                behavior: SnackBarBehavior.floating,
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                              ),
                            );
                          }
                        } : null,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFFF59E0B),
                          foregroundColor: Colors.white,
                          padding: EdgeInsets.zero,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                          elevation: 0,
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.add_shopping_cart, size: 13),
                            const SizedBox(width: 4),
                            Flexible(
                              child: Text(
                                item.isPaused ? 'Unavailable' : (item.stock <= 0 ? 'Sold Out' : 'Add to Cart'),
                                style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _miniTag(String text, Color bg, Color fg) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(4)),
      child: Text(text, style: TextStyle(fontSize: 8, fontWeight: FontWeight.bold, color: fg)),
    );
  }

  Widget _qtyBtn(IconData icon, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        padding: const EdgeInsets.all(5),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(5)),
        child: Icon(icon, size: 11, color: const Color(0xFFF59E0B)),
      ),
    );
  }

  Widget _summaryRow(String label, String value, {bool bold = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(fontSize: 12, color: Colors.grey[500], fontWeight: bold ? FontWeight.w700 : FontWeight.normal)),
          Text(value, style: TextStyle(
            fontSize: bold ? 14 : 12,
            fontWeight: bold ? FontWeight.w800 : FontWeight.w500,
            color: bold ? Colors.amber[700] : Colors.grey[700],
          )),
        ],
      ),
    );
  }

  Future<void> _refreshOrders(String userId) async {
    try {
      final api = ApiService();
      final orders = await api.getUserOrders(userId);
      if (mounted) setState(() => _userOrders = orders);
    } catch (_) {}
  }

  // ─── SUCCESS TICKET ──────────────────────────────────────
  Widget _buildSuccessTicket(user) {
    final order = context.read<OrderProvider>().lastOrder;
    if (order == null) return const SizedBox();
    return Center(
      child: Container(
        margin: const EdgeInsets.all(16),
        padding: const EdgeInsets.all(24),
        constraints: const BoxConstraints(maxWidth: 480),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: const Color(0xFFFEE2E2)),
          boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.08), blurRadius: 24)],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 52, height: 52,
              decoration: BoxDecoration(color: Colors.green, borderRadius: BorderRadius.circular(14)),
              child: const Icon(Icons.check_circle, color: Colors.white, size: 28),
            ),
            const SizedBox(height: 12),
            const Text('Order Placed Successfully!', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 4),
            const Text('Show this QR code at the counter.', style: TextStyle(fontSize: 11, color: Colors.grey)),
            const SizedBox(height: 20),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                border: Border.all(color: Colors.amber[100]!),
                borderRadius: BorderRadius.circular(16),
                color: Colors.amber[50]?.withOpacity(0.3),
              ),
              child: Column(
                children: [
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(color: Colors.grey[900], borderRadius: BorderRadius.circular(12)),
                    child: QrImageView(
                      data: order.qrPayload ?? order.id,
                      version: QrVersions.auto,
                      size: 140,
                      backgroundColor: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text('TICKET AUTHENTICATION LOCK', style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: Colors.grey[400], letterSpacing: 1)),
                ],
              ),
            ),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(color: const Color(0xFFFEE2E2).withOpacity(0.5), borderRadius: BorderRadius.circular(14)),
              child: Column(
                children: [
                  Row(
                    children: [
                      Expanded(child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('ORDER ID', style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: Colors.grey[400])),
                          Text(order.id, style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.amber[700])),
                        ],
                      )),
                      Expanded(child: Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text('AMOUNT PAID', style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: Colors.grey[400])),
                          Text('₹${order.totalPrice.toStringAsFixed(2)}', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Colors.green)),
                        ],
                      )),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Icon(Icons.access_time, size: 12, color: Colors.grey[500]),
                      const SizedBox(width: 4),
                      Text(_formatOrderTime(order), style: TextStyle(fontSize: 10, color: Colors.grey[600])),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            ...order.items.map((item) => Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('${item.name} x${item.quantity}', style: const TextStyle(fontSize: 11)),
                  Text('₹${(item.price * item.quantity).toStringAsFixed(2)}', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
                ],
              ),
            )),
            const Divider(),
            _summaryRow('Total Paid', '₹${order.totalPrice.toStringAsFixed(2)}', bold: true),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () => setState(() {
                  successOrder = null;
                  context.read<OrderProvider>().setLastOrder(null);
                }),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFF59E0B),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: const Text('Place Another Order', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ─── ORDER HISTORY ───────────────────────────────────────
  Widget _buildOrderHistory(user) {
    final myOrders = List<Order>.from(_userOrders);
    myOrders.sort((a, b) => (b.createdAt ?? 0).compareTo(a.createdAt ?? 0));

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 16, 16, 0),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFFEE2E2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Your Booking History', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
                    SizedBox(height: 4),
                    Text('Track and view your past orders.', style: TextStyle(fontSize: 12, color: Colors.grey)),
                  ],
                ),
              ),
              GestureDetector(
                onTap: () {
                  if (user != null) _refreshOrders(user.id);
                },
                child: Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(color: Colors.amber[50], borderRadius: BorderRadius.circular(8)),
                  child: Icon(Icons.refresh, size: 16, color: Colors.amber[700]),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          if (myOrders.isEmpty)
            Center(
              child: Padding(
                padding: const EdgeInsets.all(32),
                child: Column(
                  children: [
                    Icon(Icons.receipt_long, size: 40, color: Colors.amber[100]),
                    const SizedBox(height: 10),
                    const Text('No orders yet', style: TextStyle(fontSize: 12, color: Colors.grey)),
                  ],
                ),
              ),
            )
          else
            ...myOrders.map((order) => _orderCard(order)),
        ],
      ),
    );
  }

  String _formatOrderTime(Order order) {
    if (order.timestamp != null && order.timestamp!.isNotEmpty) {
      try {
        final dt = DateTime.parse(order.timestamp!);
        final day = dt.day;
        final month = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][dt.month - 1];
        final hour = dt.hour > 12 ? dt.hour - 12 : (dt.hour == 0 ? 12 : dt.hour);
        final min = dt.minute.toString().padLeft(2, '0');
        final ampm = dt.hour >= 12 ? 'PM' : 'AM';
        return '$hour:$min $ampm, $day $month ${dt.year}';
      } catch (_) {}
    }
    if (order.createdAt != null && order.createdAt! > 0) {
      final dt = DateTime.fromMillisecondsSinceEpoch(order.createdAt!);
      final day = dt.day;
      final month = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][dt.month - 1];
      final hour = dt.hour > 12 ? dt.hour - 12 : (dt.hour == 0 ? 12 : dt.hour);
      final min = dt.minute.toString().padLeft(2, '0');
      final ampm = dt.hour >= 12 ? 'PM' : 'AM';
      return '$hour:$min $ampm, $day $month ${dt.year}';
    }
    return '';
  }

  MenuItem? _findMenuItem(String itemId) {
    try { return _menuItems.firstWhere((m) => m.id == itemId); } catch (_) {}
    return null;
  }

  Widget _orderCard(Order order) {
    final isCollected = order.status == 'collected' || order.status == 'delivered';
    final isExpired = order.status == 'expired' || order.status == 'cancelled';
    Color statusColor = isCollected ? Colors.green : (isExpired ? Colors.red : Colors.amber);

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFFEE2E2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(order.id, style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.amber[700])),
                    const SizedBox(height: 2),
                    Text(_formatOrderTime(order), style: TextStyle(fontSize: 9, color: Colors.grey[500])),
                    const SizedBox(height: 2),
                    Text(order.items.map((i) => '${i.name} x${i.quantity}').join(', '), style: const TextStyle(fontSize: 10, color: Colors.grey), maxLines: 2, overflow: TextOverflow.ellipsis),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                decoration: BoxDecoration(color: statusColor.withOpacity(0.1), borderRadius: BorderRadius.circular(6)),
                child: Text(order.statusLabel, style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: statusColor)),
              ),
            ],
          ),
          const SizedBox(height: 10),
          SizedBox(
            height: 50,
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: order.items.map((oi) {
                final mi = _findMenuItem(oi.itemId);
                return Container(
                  width: 50, height: 50,
                  margin: const EdgeInsets.only(right: 6),
                  decoration: BoxDecoration(color: Colors.amber[50], borderRadius: BorderRadius.circular(8)),
                  child: (mi?.imageUrl != null && mi!.imageUrl!.isNotEmpty)
                      ? ClipRRect(borderRadius: BorderRadius.circular(8), child: Image.network(mi.imageUrl!, fit: BoxFit.cover))
                      : const Center(child: Text('🍲', style: TextStyle(fontSize: 18))),
                );
              }).toList(),
            ),
          ),
          const SizedBox(height: 10),
          _stepper(order),
          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('₹${order.totalPrice.toStringAsFixed(2)}', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
              if (order.status != 'collected' && order.status != 'cancelled' && order.status != 'expired')
                ElevatedButton.icon(
                  onPressed: () {
                    setState(() {
                      successOrder = order;
                      context.read<OrderProvider>().setLastOrder(order);
                    });
                  },
                  icon: const Icon(Icons.qr_code, size: 12),
                  label: const Text('QR Ticket', style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFF59E0B),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _stepper(Order order) {
    final steps = ['Scheduled', 'Preparing', 'Ready'];
    int activeIndex = 0;
    switch (order.status) {
      case 'scheduled': activeIndex = 0; break;
      case 'preparing': activeIndex = 1; break;
      case 'ready': activeIndex = 2; break;
      default: activeIndex = 3;
    }

    return Row(
      children: List.generate(steps.length, (i) {
        final isActive = i <= activeIndex;
        final isCurrent = i == activeIndex;
        return Expanded(
          child: Row(
            children: [
              Container(
                width: 20, height: 20,
                decoration: BoxDecoration(
                  color: isActive ? const Color(0xFFF59E0B) : Colors.grey[200],
                  shape: BoxShape.circle,
                ),
                child: Center(
                  child: isCurrent
                      ? const SizedBox(width: 8, height: 8, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : Icon(i < activeIndex ? Icons.check : Icons.circle, size: 6, color: isActive ? Colors.white : Colors.grey),
                ),
              ),
              if (i < steps.length - 1)
                Expanded(child: Container(height: 2, color: i < activeIndex ? const Color(0xFFF59E0B) : Colors.grey[200])),
            ],
          ),
        );
      }),
    );
  }

  // ─── REVIEW SECTION ──────────────────────────────────────
  Widget _buildReviewSection(user) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 0),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFFEE2E2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Add Public Faculty Review', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold)),
          const SizedBox(height: 4),
          const Text('Reviews are sentiment analyzed automatically.', style: TextStyle(fontSize: 10, color: Colors.grey)),
          const SizedBox(height: 12),
          Wrap(
            spacing: 6, runSpacing: 4,
            children: _menuItems.map((m) {
              final isSelected = selectedReviewItem?.id == m.id;
              return GestureDetector(
                onTap: () => setState(() => selectedReviewItem = isSelected ? null : m),
                behavior: HitTestBehavior.opaque,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: isSelected ? const Color(0xFFF59E0B) : Colors.amber[50]?.withOpacity(0.5),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: isSelected ? const Color(0xFFF59E0B) : const Color(0xFFFEE2E2).withOpacity(0.4)),
                  ),
                  child: Text(m.name, style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: isSelected ? Colors.white : Colors.grey)),
                ),
              );
            }).toList(),
          ),
          if (selectedReviewItem != null) ...[
            const SizedBox(height: 12),
            Row(
              children: [
                const Text('Rating: ', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Colors.grey)),
                ...List.generate(5, (i) => GestureDetector(
                  onTap: () => setState(() => reviewRating = i + 1),
                  behavior: HitTestBehavior.opaque,
                  child: Icon(i < reviewRating ? Icons.star : Icons.star_border, color: Colors.amber, size: 18),
                )),
              ],
            ),
            const SizedBox(height: 8),
            TextField(
              onChanged: (v) => reviewComment = v,
              maxLines: 2,
              decoration: InputDecoration(
                hintText: 'How was the ${selectedReviewItem!.name}?',
                hintStyle: const TextStyle(fontSize: 11),
                filled: true,
                fillColor: Colors.amber[50]?.withOpacity(0.5),
                contentPadding: const EdgeInsets.all(10),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFFEE2E2))),
                enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFFEE2E2))),
              ),
              style: const TextStyle(fontSize: 11),
            ),
            const SizedBox(height: 10),
            ElevatedButton(
              onPressed: reviewComment.isEmpty ? null : () async {
                final result = await ApiService().addReview(
                  userId: user?.id ?? 'guest',
                  userName: user?.name ?? 'Guest',
                  rating: reviewRating,
                  comment: reviewComment,
                  menuItemId: selectedReviewItem?.id,
                  menuItemName: selectedReviewItem?.name,
                );
                if (result['success'] == true && mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Review posted! Sentiment: ${result['review']?['sentiment'] ?? ''}')),
                  );
                  setState(() { selectedReviewItem = null; reviewComment = ''; reviewRating = 5; });
                }
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFF59E0B),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
              child: const Text('Post Review', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold)),
            ),
          ],
        ],
      ),
    );
  }

  // ─── SENTIMENT LOG ───────────────────────────────────────
  Widget _buildSentimentLog() {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 0),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFFEE2E2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('LIVE CAMPUS SENTIMENT LOG', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.grey[400], letterSpacing: 1)),
          const SizedBox(height: 12),
          if (_reviews.isEmpty)
            const Center(child: Padding(
              padding: EdgeInsets.all(16),
              child: Text('No reviews yet.', style: TextStyle(fontSize: 11, color: Colors.grey)),
            ))
          else
            ..._reviews.take(4).map((rev) => Container(
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: Colors.amber[50]?.withOpacity(0.5), borderRadius: BorderRadius.circular(12), border: Border.all(color: const Color(0xFFFEE2E2).withOpacity(0.3))),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(rev.userName, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: rev.sentiment == 'positive' ? Colors.green[50] : (rev.sentiment == 'negative' ? Colors.red[50] : Colors.grey[100]),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(rev.sentiment, style: TextStyle(fontSize: 8, fontWeight: FontWeight.bold, color: rev.sentiment == 'positive' ? Colors.green[700] : (rev.sentiment == 'negative' ? Colors.red[700] : Colors.grey[600]))),
                      ),
                    ],
                  ),
                  if (rev.menuItemName != null) ...[
                    const SizedBox(height: 2),
                    Text('On: ${rev.menuItemName}', style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: Colors.amber[800])),
                  ],
                  const SizedBox(height: 4),
                  Text('"${rev.comment}"', style: TextStyle(fontSize: 10, color: Colors.grey[500], fontStyle: FontStyle.italic)),
                ],
              ),
            )),
        ],
      ),
    );
  }

  Widget _buildFloatingCartButton() {
    final cart = context.watch<CartProvider>();
    if (cart.isEmpty) return const SizedBox.shrink();

    return GestureDetector(
      onTap: () {
        Navigator.push(context, MaterialPageRoute(builder: (_) => const CheckoutScreen()));
      },
      child: Container(
        width: 60, height: 60,
        margin: const EdgeInsets.only(bottom: 16, right: 4),
        decoration: BoxDecoration(
          gradient: const LinearGradient(colors: [Color(0xFFF59E0B), Color(0xFFEA580C)]),
          borderRadius: BorderRadius.circular(16),
          boxShadow: [BoxShadow(color: const Color(0xFFF59E0B).withOpacity(0.4), blurRadius: 12, offset: const Offset(0, 4))],
        ),
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            Center(
              child: Icon(Icons.shopping_cart, color: Colors.white, size: 26),
            ),
            Positioned(
              right: -4, top: -4,
              child: Container(
                padding: const EdgeInsets.all(4),
                decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle),
                child: Text(
                  '${cart.totalItems}',
                  style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFFF59E0B)),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ─── DARK FOOTER ─────────────────────────────────────────
  Widget _buildDarkFooter(branding, String copyright, String phone, String email, String address) {
    final screenWidth = MediaQuery.of(context).size.width;
    final isMobile = screenWidth < 600;

    return Container(
      padding: EdgeInsets.all(isMobile ? 20 : 32),
      decoration: const BoxDecoration(color: Color(0xFF1F2937)),
      child: Column(
        children: [
          isMobile
              ? Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _footerBrand(branding),
                    const SizedBox(height: 20),
                    _footerLinks(),
                    const SizedBox(height: 20),
                    _footerContact(phone, email, address),
                  ],
                )
              : Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(flex: 3, child: _footerBrand(branding)),
                    Expanded(flex: 3, child: _footerLinks()),
                    Expanded(flex: 3, child: _footerContact(phone, email, address)),
                  ],
                ),
          const SizedBox(height: 20),
          Container(
            padding: const EdgeInsets.only(top: 12),
            decoration: const BoxDecoration(border: Border(top: BorderSide(color: Color(0xFF374151)))),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Flexible(child: Text(copyright.replaceAll('&amp;', '&'), style: const TextStyle(fontSize: 10, color: Colors.grey), overflow: TextOverflow.ellipsis)),
                GestureDetector(
                  onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const SettingsScreen())),
                  behavior: HitTestBehavior.opaque,
                  child: Row(
                    children: [
                      const Icon(Icons.settings, size: 10, color: Colors.grey),
                      const SizedBox(width: 3),
                      Text('Settings', style: TextStyle(fontSize: 9, color: Colors.grey[400])),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _decodeHtml(String text) {
    return text.replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&#39;', "'").replaceAll('&quot;', '"');
  }

  Widget _footerBrand(branding) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Esc(Q)', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.white)),
        const SizedBox(height: 6),
        Text(_decodeHtml(branding.heroTitle ?? 'Campus Smart Canteen Platform'), style: const TextStyle(fontSize: 11, color: Colors.grey)),
        const SizedBox(height: 6),
        Text('Powered by ${_decodeHtml(branding.heroTitle ?? "Esc(Q)")}', style: const TextStyle(fontSize: 10, color: Colors.grey)),
      ],
    );
  }

  Widget _footerLinks() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Quick Links', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.white)),
        const SizedBox(height: 6),
        _link('Menu & Order', () => setState(() => customerTab = 'menu')),
        _link('Order History', () {
          setState(() => customerTab = 'history');
          final user = context.read<AuthProvider>().user;
          if (user != null) _refreshOrders(user.id);
        }),
        _link('Settings', () => Navigator.push(context, MaterialPageRoute(builder: (_) => const SettingsScreen()))),
        _link('Help & Support', () {}),
      ],
    );
  }

  Widget _link(String text, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Padding(padding: const EdgeInsets.only(bottom: 4), child: Text(text, style: const TextStyle(fontSize: 10, color: Colors.grey))),
    );
  }

  Widget _footerContact(String phone, String email, String address) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Contact Us', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.white)),
        const SizedBox(height: 6),
        _contactRow(Icons.phone, phone),
        _contactRow(Icons.email, email),
        _contactRow(Icons.location_on, address),
      ],
    );
  }

  Widget _contactRow(IconData icon, String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        children: [
          Icon(icon, size: 10, color: Colors.grey[500]),
          const SizedBox(width: 4),
          Expanded(child: Text(text, style: const TextStyle(fontSize: 10, color: Colors.grey))),
        ],
      ),
    );
  }

  // ─── OVERRIDE BUILD WITH G PAY MODAL ─────────────────────
  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final user = auth.user;
    final branding = _branding;
    final screenWidth = MediaQuery.of(context).size.width;
    final isMobile = screenWidth < 600;
    final isTablet = screenWidth >= 600 && screenWidth < 1024;

    if (_isLoading) {
      return Scaffold(
        backgroundColor: const Color(0xFFFBFCFF),
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              SizedBox(height: 40, width: 40, child: CircularProgressIndicator(color: Colors.amber[600], strokeWidth: 3)),
              const SizedBox(height: 16),
              const Text('Loading menu...', style: TextStyle(fontSize: 12, color: Colors.grey)),
            ],
          ),
        ),
      );
    }

    if (_error != null) {
      return Scaffold(
        backgroundColor: const Color(0xFFFBFCFF),
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.error_outline, size: 48, color: Colors.red[300]),
              const SizedBox(height: 12),
              Text(_error!, style: const TextStyle(fontSize: 12, color: Colors.grey), textAlign: TextAlign.center),
              const SizedBox(height: 16),
              ElevatedButton(onPressed: _loadAll, style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFF59E0B), foregroundColor: Colors.white), child: const Text('Retry')),
            ],
          ),
        ),
      );
    }

    final bMenuTitle = branding.menuTitle ?? "Today's Menu";
    final bMenuSubtitle = branding.menuSubtitle ?? 'Freshly prepared, just for you.';
    final bContactPhone = branding.contactPhone ?? '+91 9940918442';
    final bContactEmail = branding.contactEmail ?? 'escqsupportemail@gmail.com';
    final bContactAddress = branding.contactAddress ?? 'AUTO HUB SOLUTION (AHS), Tamil Nadu, India';
    final bFooterCopyright = branding.footerCopyright ?? '\u00a9 2026 Esc(Q). All Rights Reserved.';

    final scaffold = Scaffold(
      backgroundColor: const Color(0xFFFBFCFF),
      floatingActionButton: _buildFloatingCartButton(),
      body: Column(
        children: [
          _buildHeader(auth, user),
          Expanded(
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildHero(isMobile),
                  _buildCanteenAndSearch(isMobile),
                  if (successOrder == null) _buildTabSwitcher(),
                  if (successOrder != null)
                    _buildSuccessTicket(user)
                  else if (customerTab == 'menu')
                    _buildMenuGrid(isMobile, isTablet, bMenuTitle, bMenuSubtitle)
                  else
                    _buildOrderHistory(user),
                  const SizedBox(height: 24),
                  _buildDarkFooter(branding, bFooterCopyright, bContactPhone, bContactEmail, bContactAddress),
                ],
              ),
            ),
          ),
        ],
      ),
    );

    return scaffold;
  }
}
