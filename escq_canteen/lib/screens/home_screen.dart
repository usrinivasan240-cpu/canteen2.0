import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:qr_flutter/qr_flutter.dart';
import '../providers/auth_provider.dart';
import '../providers/menu_provider.dart';
import '../providers/cart_provider.dart';
import '../providers/order_provider.dart';
import '../models/order.dart';
import '../models/menu_item.dart';
import '../models/college.dart';
import '../models/review.dart';
import '../services/api_service.dart';
import '../config.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  String selectedCategory = 'Meals';
  String customerTab = 'menu';
  String selectedSlot = 'ASAP (Instant)';
  Order? successOrder;
  bool showGPayModal = false;
  bool isSubmitting = false;
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
      final searchMatch = _searchQuery.isEmpty ||
          item.name.toLowerCase().contains(_searchQuery.toLowerCase()) ||
          item.category.toLowerCase().contains(_searchQuery.toLowerCase());
      return catMatch && searchMatch;
    }).toList();
  }

  List<Canteen> get _collegeCanteens => _canteens.where((c) {
    final user = context.read<AuthProvider>().user;
    return c.collegeId == (user?.collegeId ?? _userCollege?.id);
  }).toList();

  List<String> _generateTimeSlots() {
    final slots = ['ASAP (Instant)'];
    final now = DateTime.now();
    int minutes = now.minute;
    int hours = now.hour;
    final remainder = minutes % 15;
    minutes += (15 - remainder);
    if (minutes >= 60) { minutes = 0; hours++; }
    for (int i = 0; i < 16; i++) {
      final slotMin = minutes.toString().padLeft(2, '0');
      int displayHours = hours % 12;
      if (displayHours == 0) displayHours = 12;
      final ampm = hours >= 12 ? 'PM' : 'AM';
      slots.add('$displayHours:$slotMin $ampm');
      minutes += 15;
      if (minutes >= 60) { minutes = 0; hours++; }
    }
    return slots;
  }

  // ─── HEADER ──────────────────────────────────────────────
  Widget _buildHeader(AuthProvider auth, user) {
    return Container(
      color: Colors.white,
      child: SafeArea(
        bottom: false,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          child: Row(
            children: [
              if (_userCollege?.logoUrl != null && _userCollege!.logoUrl!.isNotEmpty)
                ClipRRect(
                  borderRadius: BorderRadius.circular(10),
                  child: Image.network(
                    _userCollege!.logoUrl!,
                    width: 36, height: 36, fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => _defaultLogo(),
                  ),
                )
              else
                _defaultLogo(),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _userCollege?.name ?? 'esc(Q)',
                      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.black87),
                      maxLines: 1, overflow: TextOverflow.ellipsis,
                    ),
                    const Text('esc(Q) Platform', style: TextStyle(fontSize: 9, color: Colors.grey)),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(color: Colors.grey[100], borderRadius: BorderRadius.circular(16)),
                child: Text(user?.email ?? '', style: const TextStyle(fontSize: 9, color: Colors.grey), overflow: TextOverflow.ellipsis),
              ),
              const SizedBox(width: 8),
              GestureDetector(
                onTap: () => auth.logout(),
                child: Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(color: Colors.grey[50], borderRadius: BorderRadius.circular(8)),
                  child: const Icon(Icons.logout, size: 14, color: Colors.grey),
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
      decoration: BoxDecoration(color: Colors.red[900], borderRadius: BorderRadius.circular(10)),
      child: const Icon(Icons.local_cafe, color: Colors.white, size: 18),
    );
  }

  // ─── HERO (Logo + Text Only, No Banner) ─────────────────
  Widget _buildHero(bool isMobile) {
    final logoUrl = _userCollege?.logoUrl;
    final logoWidget = (logoUrl != null && logoUrl.isNotEmpty)
        ? ClipRRect(
            borderRadius: BorderRadius.circular(14),
            child: Image.network(logoUrl, width: isMobile ? 64 : 100, height: isMobile ? 64 : 100, fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => _heroLogoFallback(),
            ),
          )
        : _heroLogoFallback();

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 16, 16, 0),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.grey.shade100),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 8)],
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
                  style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: Colors.amber[600], letterSpacing: 1.5),
                ),
                const SizedBox(height: 4),
                Text(
                  _decodeHtml(_branding.heroTitle ?? 'esc(Q)'),
                  style: TextStyle(fontSize: isMobile ? 20 : 26, fontWeight: FontWeight.w900, color: Colors.black87, height: 1.1),
                ),
                const SizedBox(height: 4),
                Text(_decodeHtml(_branding.heroSubtitle ?? 'Smart Campus Canteen Platform'), style: const TextStyle(fontSize: 11, color: Colors.grey, height: 1.3)),
                const SizedBox(height: 2),
                Text(_branding.heroTagline ?? 'Order Faster \u00b7 Skip the Queue \u00b7 Smart Pickup', style: const TextStyle(fontSize: 10, color: Colors.grey, fontStyle: FontStyle.italic)),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 6,
                  runSpacing: 4,
                  children: (_branding.featureBadges ?? ['Order Faster', 'Skip the Queue', 'Smart Pickup']).map((b) => Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(color: Colors.amber.shade200),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.bolt, size: 10, color: Colors.amber[500]),
                        const SizedBox(width: 3),
                        Text(b, style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: Colors.amber[700])),
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
      decoration: BoxDecoration(color: Colors.red[900], borderRadius: BorderRadius.circular(14)),
      child: const Icon(Icons.local_cafe, color: Colors.white, size: 30),
    );
  }

  // ─── CANTEEN + SEARCH ────────────────────────────────────
  Widget _buildCanteenAndSearch(bool isMobile) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      child: isMobile
          ? Column(
              children: [
                _canteenDropdown(),
                const SizedBox(height: 8),
                _searchBar(),
              ],
            )
          : Row(
              children: [
                _canteenDropdown(),
                const SizedBox(width: 12),
                Expanded(child: _searchBar()),
              ],
            ),
    );
  }

  Widget _canteenDropdown() {
    final collegeCanteens = _collegeCanteens;
    if (collegeCanteens.length > 1) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFFEE2E2)),
        ),
        child: DropdownButtonHideUnderline(
          child: DropdownButton<String>(
            value: _selectedCanteenId,
            isDense: true,
            isExpanded: true,
            items: collegeCanteens.map((c) => DropdownMenuItem(value: c.id, child: Text(c.name, style: const TextStyle(fontSize: 11)))).toList(),
            onChanged: (v) { if (v != null) setState(() => _selectedCanteenId = v); },
          ),
        ),
      );
    } else if (collegeCanteens.length == 1) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
        decoration: BoxDecoration(
          color: const Color(0xFFFEE2E2).withOpacity(0.6),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFFEE2E2)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.check_circle, size: 14, color: Colors.amber[500]),
            const SizedBox(width: 6),
            Text(collegeCanteens.first.name, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600)),
          ],
        ),
      );
    }
    return const SizedBox.shrink();
  }

  Widget _searchBar() {
    return TextField(
      onChanged: (v) => setState(() => _searchQuery = v),
      decoration: InputDecoration(
        hintText: 'Search menus, food items...',
        hintStyle: const TextStyle(fontSize: 11),
        prefixIcon: const Icon(Icons.search, size: 16),
        filled: true,
        fillColor: Colors.white,
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFFFEE2E2)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFFFEE2E2)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFFD97706), width: 2),
        ),
      ),
      style: const TextStyle(fontSize: 11),
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
      onTap: () => setState(() => customerTab = id),
      behavior: HitTestBehavior.opaque,
      child: Container(
        padding: const EdgeInsets.only(bottom: 12, right: 20),
        decoration: BoxDecoration(
          border: Border(bottom: BorderSide(color: isActive ? const Color(0xFFD97706) : Colors.transparent, width: 2)),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 11,
            fontWeight: isActive ? FontWeight.w900 : FontWeight.bold,
            color: isActive ? const Color(0xFFD97706) : Colors.grey,
            letterSpacing: 0.8,
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
                    Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.black87)),
                    const SizedBox(height: 2),
                    Text(subtitle, style: const TextStyle(fontSize: 11, color: Colors.grey)),
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
                    childAspectRatio: 0.68,
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
            flex: 5,
            child: Container(
              width: double.infinity,
              decoration: BoxDecoration(
                color: Colors.red[50],
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
            flex: 5,
            child: Padding(
              padding: const EdgeInsets.all(8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Text(item.name, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600), maxLines: 1, overflow: TextOverflow.ellipsis),
                      ),
                      Text('★ ${item.rating}', style: TextStyle(fontSize: 9, color: Colors.grey[400])),
                    ],
                  ),
                  const SizedBox(height: 2),
                  Row(
                    children: [
                      _miniTag('Prep: ${item.prepTime}m', Colors.red[50]!, Colors.red[800]!),
                      const SizedBox(width: 4),
                      _miniTag('Limit: ${item.dailyLimit}', Colors.grey[50]!, Colors.grey[500]!),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text('₹${item.price.toStringAsFixed(2)}', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Colors.red)),
                  const Spacer(),
                  // BUTTON - always at bottom, full width, explicitly tappable
                  if (qty > 0)
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                          child: Container(
                            decoration: BoxDecoration(color: Colors.red[50], borderRadius: BorderRadius.circular(8)),
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
                          setState(() => cart.addItem(item));
                        } : null,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFFD97706),
                          foregroundColor: Colors.white,
                          padding: EdgeInsets.zero,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                          elevation: 0,
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(Icons.add, size: 13),
                            const SizedBox(width: 3),
                            Text(
                              item.isPaused ? 'Unavailable' : (item.stock <= 0 ? 'Sold Out' : 'Add to Cart'),
                              style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold),
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
        child: Icon(icon, size: 11, color: const Color(0xFFD97706)),
      ),
    );
  }

  // ─── CART SIDEBAR ────────────────────────────────────────
  Widget _buildCartSidebar(user) {
    final cart = context.watch<CartProvider>();
    final slots = _generateTimeSlots();

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFFEE2E2)),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.03), blurRadius: 4)],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Your Checkout Basket', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Colors.black87)),
          const SizedBox(height: 2),
          Text('Connected dynamically', style: TextStyle(fontSize: 10, color: Colors.grey[400])),
          const SizedBox(height: 16),

          if (cart.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 30),
              child: Center(
                child: Column(
                  children: [
                    Icon(Icons.shopping_cart_outlined, size: 36, color: Colors.red[100]),
                    const SizedBox(height: 10),
                    Text('Your cart is currently empty.', style: TextStyle(fontSize: 11, color: Colors.grey[400])),
                  ],
                ),
              ),
            )
          else ...[
            SizedBox(
              height: 200,
              child: ListView(
                children: cart.items.entries.map((e) {
                  final item = e.value;
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: Row(
                      children: [
                        Container(
                          width: 32, height: 32,
                          decoration: BoxDecoration(color: Colors.red[50], borderRadius: BorderRadius.circular(6)),
                          child: item.menuItem.imageUrl != null && item.menuItem.imageUrl!.isNotEmpty
                              ? ClipRRect(borderRadius: BorderRadius.circular(6), child: Image.network(item.menuItem.imageUrl!, fit: BoxFit.cover))
                              : const Center(child: Text('🍲', style: TextStyle(fontSize: 12))),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(item.menuItem.name, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600), maxLines: 1, overflow: TextOverflow.ellipsis),
                              Text('₹${item.menuItem.price.toStringAsFixed(2)}', style: TextStyle(fontSize: 9, color: Colors.red[800], fontWeight: FontWeight.bold)),
                            ],
                          ),
                        ),
                        Container(
                          decoration: BoxDecoration(color: Colors.red[50], borderRadius: BorderRadius.circular(6)),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              _qtyBtn(Icons.remove, () {
                                setState(() {
                                  if (item.quantity <= 1) cart.removeItem(item.menuItem.id);
                                  else cart.updateQuantity(item.menuItem.id, item.quantity - 1);
                                });
                              }),
                              Padding(padding: const EdgeInsets.symmetric(horizontal: 3), child: Text('${item.quantity}', style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold))),
                              _qtyBtn(Icons.add, () {
                                if (item.quantity < item.menuItem.stock) {
                                  setState(() => cart.updateQuantity(item.menuItem.id, item.quantity + 1));
                                }
                              }),
                            ],
                          ),
                        ),
                        const SizedBox(width: 4),
                        GestureDetector(
                          onTap: () => setState(() => cart.removeItem(item.menuItem.id)),
                          child: Icon(Icons.delete_outline, size: 13, color: Colors.red[400]),
                        ),
                      ],
                    ),
                  );
                }).toList(),
              ),
            ),
            const Divider(color: Color(0xFFFEE2E2)),
            const SizedBox(height: 8),
            const Text('PICKUP SLOT', style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: Colors.grey)),
            const SizedBox(height: 4),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              decoration: BoxDecoration(
                color: const Color(0xFFFEE2E2).withOpacity(0.3),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFFFEE2E2)),
              ),
              child: DropdownButtonHideUnderline(
                child: DropdownButton<String>(
                  value: selectedSlot,
                  isExpanded: true,
                  items: slots.map((s) => DropdownMenuItem(value: s, child: Text(s, style: const TextStyle(fontSize: 11)))).toList(),
                  onChanged: (v) => setState(() => selectedSlot = v ?? 'ASAP (Instant)'),
                ),
              ),
            ),
            const SizedBox(height: 12),
            _summaryRow('Subtotal', '₹${cart.subtotal.toStringAsFixed(2)}'),
            _summaryRow('Convenience Fee', '₹${cart.convenienceFee.toStringAsFixed(2)} + ₹${cart.pgCharge.toStringAsFixed(2)}'),
            const Divider(color: Color(0xFFFEE2E2)),
            _summaryRow('Grand Total', '₹${cart.totalAmount.toStringAsFixed(2)}', bold: true),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              height: 42,
              child: ElevatedButton(
                onPressed: cart.isEmpty ? null : () {
                  setState(() => showGPayModal = true);
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF1A1A1A),
                  foregroundColor: Colors.white,
                  padding: EdgeInsets.zero,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  elevation: 4,
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                      decoration: BoxDecoration(color: Colors.blue[100], borderRadius: BorderRadius.circular(3)),
                      child: const Text('G Pay', style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: Color(0xFF1A73E8))),
                    ),
                    const SizedBox(width: 6),
                    const Text('Pay with G Pay', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _summaryRow(String label, String value, {bool bold = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(fontSize: 10, color: Colors.grey[500], fontWeight: bold ? FontWeight.bold : FontWeight.normal)),
          Text(value, style: TextStyle(
            fontSize: bold ? 13 : 10,
            fontWeight: bold ? FontWeight.bold : FontWeight.normal,
            color: bold ? Colors.amber[700] : Colors.grey[600],
          )),
        ],
      ),
    );
  }

  // ─── G PAY MODAL ─────────────────────────────────────────
  Widget _buildGPayModal(user) {
    final cart = context.read<CartProvider>();
    return GestureDetector(
      onTap: () => setState(() => showGPayModal = false),
      child: Container(
        color: Colors.black.withOpacity(0.6),
        child: Center(
          child: GestureDetector(
            onTap: () {},
            child: Container(
              width: 340,
              margin: const EdgeInsets.all(24),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(24)),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: const BoxDecoration(
                      color: Color(0xFFF8F9FA),
                      borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.lock, size: 14, color: Colors.grey),
                        const SizedBox(width: 6),
                        Text('pay.google.com', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
                        const Spacer(),
                        GestureDetector(
                          onTap: () => setState(() => showGPayModal = false),
                          child: const Icon(Icons.close, size: 18),
                        ),
                      ],
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      children: [
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              decoration: BoxDecoration(color: const Color(0xFF1A73E8).withOpacity(0.1), borderRadius: BorderRadius.circular(6)),
                              child: const Text('G Pay', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF1A73E8))),
                            ),
                            const SizedBox(width: 8),
                            const Text('Google Pay', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold)),
                            const Spacer(),
                            CircleAvatar(radius: 16, backgroundColor: Colors.grey[300], child: Text(user?.name?.substring(0, 1).toUpperCase() ?? 'U', style: const TextStyle(fontSize: 12))),
                          ],
                        ),
                        const SizedBox(height: 20),
                        Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: Colors.grey.shade200),
                            boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 8)],
                          ),
                          child: Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(color: const Color(0xFF1A73E8).withOpacity(0.1), borderRadius: BorderRadius.circular(3)),
                                child: const Text('VISA', style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: Color(0xFF1A73E8))),
                              ),
                              const SizedBox(width: 8),
                              const Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text('Test Card', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600)),
                                  Text('Visa •••• 1111', style: TextStyle(fontSize: 10, color: Colors.grey)),
                                ],
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 12),
                        Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(color: Colors.red[50], borderRadius: BorderRadius.circular(8)),
                          child: const Text(
                            'Your payment method won\'t be charged because you\'re in a test environment.',
                            style: TextStyle(fontSize: 10, color: Colors.red),
                            textAlign: TextAlign.center,
                          ),
                        ),
                        const SizedBox(height: 20),
                        Column(
                          children: [
                            const Text('Transaction Value', style: TextStyle(fontSize: 11, color: Colors.grey)),
                            const SizedBox(height: 4),
                            Text('₹${cart.totalAmount.toStringAsFixed(2)}', style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
                          ],
                        ),
                        const SizedBox(height: 20),
                        SizedBox(
                          width: double.infinity,
                          height: 44,
                          child: ElevatedButton(
                            onPressed: isSubmitting ? null : _handlePlaceOrder,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF1A73E8),
                              foregroundColor: Colors.white,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
                            ),
                            child: isSubmitting
                                ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                                : Text('Pay ₹${cart.totalAmount.toStringAsFixed(2)}', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold)),
                          ),
                        ),
                        const SizedBox(height: 12),
                        const Text('SECURE ENCRYPTED HANDSHAKE', style: TextStyle(fontSize: 9, color: Colors.grey, letterSpacing: 1)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _handlePlaceOrder() async {
    final cart = context.read<CartProvider>();
    final auth = context.read<AuthProvider>();
    final orderProv = context.read<OrderProvider>();
    final user = auth.user;

    if (cart.isEmpty || user == null) return;

    setState(() => isSubmitting = true);

    final result = await orderProv.placeOrder(
      userId: user.id,
      userName: user.name,
      items: cart.toOrderPayload(),
      pickupSlot: selectedSlot,
      canteenId: _selectedCanteenId,
      subCanteenId: _selectedSubCanteenId.isNotEmpty ? _selectedSubCanteenId : null,
    );

    if (result['success'] == true && mounted) {
      setState(() {
        successOrder = orderProv.lastOrder;
        showGPayModal = false;
        isSubmitting = false;
      });
      cart.clear();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Payment processed via Google Pay!'), backgroundColor: Colors.green),
      );
    } else if (mounted) {
      setState(() => isSubmitting = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(result['error'] ?? 'Failed to place order'), backgroundColor: Colors.red),
      );
    }
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
                border: Border.all(color: Colors.red[100]!),
                borderRadius: BorderRadius.circular(16),
                color: Colors.red[50]?.withOpacity(0.3),
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
              child: Row(
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
                  backgroundColor: const Color(0xFFD97706),
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
    final myOrders = _userOrders.where((o) => o.userId == (user?.id ?? '')).toList();
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
          const Text('Your Booking History', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          const SizedBox(height: 4),
          const Text('Track and view your past orders.', style: TextStyle(fontSize: 11, color: Colors.grey)),
          const SizedBox(height: 16),
          if (myOrders.isEmpty)
            Center(
              child: Padding(
                padding: const EdgeInsets.all(32),
                child: Column(
                  children: [
                    Icon(Icons.receipt_long, size: 40, color: Colors.red[100]),
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
                  decoration: BoxDecoration(color: Colors.red[50], borderRadius: BorderRadius.circular(8)),
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
                    backgroundColor: const Color(0xFFD97706),
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
                  color: isActive ? const Color(0xFFD97706) : Colors.grey[200],
                  shape: BoxShape.circle,
                ),
                child: Center(
                  child: isCurrent
                      ? const SizedBox(width: 8, height: 8, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : Icon(i < activeIndex ? Icons.check : Icons.circle, size: 6, color: isActive ? Colors.white : Colors.grey),
                ),
              ),
              if (i < steps.length - 1)
                Expanded(child: Container(height: 2, color: i < activeIndex ? const Color(0xFFD97706) : Colors.grey[200])),
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
                    color: isSelected ? const Color(0xFFD97706) : Colors.red[50]?.withOpacity(0.5),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: isSelected ? const Color(0xFFD97706) : const Color(0xFFFEE2E2).withOpacity(0.4)),
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
                fillColor: Colors.red[50]?.withOpacity(0.5),
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
                backgroundColor: const Color(0xFFD97706),
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
              decoration: BoxDecoration(color: Colors.red[50]?.withOpacity(0.5), borderRadius: BorderRadius.circular(12), border: Border.all(color: const Color(0xFFFEE2E2).withOpacity(0.3))),
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
                    Text('On: ${rev.menuItemName}', style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: Colors.red[800])),
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
                Row(
                  children: [
                    GestureDetector(
                      onTap: () => _showLegalPage('Privacy Policy'),
                      behavior: HitTestBehavior.opaque,
                      child: const Text('Privacy Policy', style: TextStyle(fontSize: 9, color: Colors.grey)),
                    ),
                    const Text(' \u00b7 ', style: TextStyle(color: Colors.grey)),
                    GestureDetector(
                      onTap: () => _showLegalPage('Terms & Conditions'),
                      behavior: HitTestBehavior.opaque,
                      child: const Text('Terms & Conditions', style: TextStyle(fontSize: 9, color: Colors.grey)),
                    ),
                  ],
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
        const Text('esc(Q)', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.white)),
        const SizedBox(height: 6),
        Text(_decodeHtml(branding.heroTitle ?? 'Campus Smart Canteen Platform'), style: const TextStyle(fontSize: 11, color: Colors.grey)),
        const SizedBox(height: 6),
        Text('Powered by ${_decodeHtml(branding.heroTitle ?? "esc(Q)")}', style: const TextStyle(fontSize: 10, color: Colors.grey)),
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
        _link('Order History', () => setState(() => customerTab = 'history')),
        _link('My Profile', () {}),
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

  Widget _buildLegalFooter() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: const BoxDecoration(color: Colors.white, border: Border(top: BorderSide(color: Color(0xFFE5E7EB)))),
      child: Column(
        children: [
          Wrap(
            spacing: 16, runSpacing: 6, alignment: WrapAlignment.center,
            children: ['About Us', 'Contact Us', 'Privacy Policy', 'Terms & Conditions', 'Refund Policy'].map((l) =>
              GestureDetector(
                onTap: () => _showLegalPage(l),
                behavior: HitTestBehavior.opaque,
                child: Text(l, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: Color(0xFFDC2626))),
              ),
            ).toList(),
          ),
          const SizedBox(height: 8),
          const Text('Powered by AUTO HUB SOLUTION (AHS)', style: TextStyle(fontSize: 11, color: Colors.grey)),
        ],
      ),
    );
  }

  void _showLegalPage(String page) {
    String title = page;
    String content;
    switch (page) {
      case 'About Us':
        title = 'About esc(Q)';
        content = 'esc(Q) is a Smart Campus Canteen Platform developed and operated by AUTO HUB SOLUTION (AHS).\n\n'
            'The platform enables students, faculty members, educational institutions, and participating canteens to browse digital menus, place food orders, make secure online payments, receive real-time order updates, and collect food efficiently.\n\n'
            'Our Mission:\nModernize campus dining by reducing waiting time, improving operational efficiency, minimizing food wastage, and delivering a seamless digital food ordering experience.\n\n'
            'Parent Organization:\nAUTO HUB SOLUTION (AHS) is an MSME (Udyam) registered technology enterprise focused on developing software products, automation systems, AI-powered solutions, and digital platforms.';
        break;
      case 'Contact Us':
        title = 'Contact Us';
        content = 'Legal Entity: AUTO HUB SOLUTION (AHS)\n'
            'Support Email: escqsupportemail@gmail.com\n'
            'Business Email: ahsglobalservices@gmail.com\n'
            'Alternative Email: autohubsolution777@gmail.com\n'
            'Support Mobile: +91 9940918442\n'
            'Support Hours: Mon\u2013Sat, 9:00 AM \u2013 6:00 PM IST';
        break;
      case 'Privacy Policy':
        title = 'Privacy Policy';
        content = 'Effective Date: January 2026\n\n'
            'This Privacy Policy describes how AUTO HUB SOLUTION (AHS) ("we," "us," or "our") collects, uses, stores, and protects your personal information when you use the esc(Q) platform.\n\n'
            '1. Information We Collect:\n\u2022 Account Information: Name, email, mobile number, college name, student/staff ID\n'
            '\u2022 Order Data: Food orders, cart items, payment confirmations, order history\n'
            '\u2022 Device & Usage Data: Browser type, device info, IP address, interaction logs\n\n'
            '2. How We Use Your Information:\nWe use your data to process orders, manage your account, communicate order updates, improve the platform, and ensure security.\n\n'
            '3. Data Sharing:\nWe do not sell your personal data. Information is shared only with participating canteens for order fulfillment, payment gateways, and government authorities when legally required.\n\n'
            '4. Data Security:\nWe implement industry-standard encryption, secure servers, and access controls.\n\n'
            '5. Your Rights:\nYou may request access, correction, or deletion of your personal data by contacting support.';
        break;
      case 'Terms & Conditions':
        title = 'Terms & Conditions';
        content = 'Effective Date: January 2026\n\n'
            'These Terms & Conditions govern your use of the esc(Q) platform operated by AUTO HUB SOLUTION (AHS).\n\n'
            '1. Eligibility:\nesc(Q) is intended for students, faculty, and staff of educational institutions with active canteen partnerships. Users must be at least 16 years of age.\n\n'
            '2. Account Responsibility:\nYou are responsible for maintaining the confidentiality of your account credentials.\n\n'
            '3. Orders & Payments:\nAll orders are subject to item availability. Payments are processed through secure third-party payment gateways.\n\n'
            '4. Order Cancellation:\nOrders may be cancelled before kitchen preparation begins.\n\n'
            '5. User Conduct:\nUsers shall not misuse the platform, attempt unauthorized access, or provide false information.\n\n'
            '6. Intellectual Property:\nAll content, logos, designs, and software on esc(Q) are the property of AUTO HUB SOLUTION (AHS).\n\n'
            '7. Governing Law:\nThese terms are governed by the laws of India. Disputes subject to courts in Tamil Nadu.';
        break;
      case 'Refund Policy':
        title = 'Refund & Cancellation Policy';
        content = 'Effective Date: January 2026\n\n'
            '1. Order Cancellation by User:\nYou may cancel at no charge if the kitchen has not yet started preparation.\n\n'
            '2. Cancellation by Canteen:\nIf a canteen cannot fulfill an order, a full refund will be initiated within 5\u20137 business days.\n\n'
            '3. Refund Eligibility:\nRefunds apply for duplicate charges, orders not received, incorrect items, or canteen-cancelled orders. Requests must be raised within 24 hours.\n\n'
            '4. Refund Process:\nApproved refunds are processed to the original payment method within 5\u20137 business days.\n\n'
            '5. Non-Refundable Situations:\nRefunds do not apply for successfully delivered orders, change of mind, or taste/portion complaints.\n\n'
            '6. Dispute Resolution:\nContact escqsupportemail@gmail.com with your order ID and issue description.';
        break;
      default:
        content = '';
    }
    showDialog(
      context: context,
      builder: (ctx) => Dialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        child: Container(
          constraints: const BoxConstraints(maxWidth: 420, maxHeight: 500),
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 40, height: 40,
                    decoration: BoxDecoration(color: const Color(0xFFDC2626), borderRadius: BorderRadius.circular(12)),
                    child: Icon(
                      page == 'About Us' ? Icons.info :
                      page == 'Contact Us' ? Icons.mail :
                      page == 'Privacy Policy' ? Icons.lock :
                      page == 'Terms & Conditions' ? Icons.description : Icons.replay,
                      color: Colors.white, size: 22,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(child: Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold))),
                  GestureDetector(onTap: () => Navigator.pop(ctx), child: const Icon(Icons.close, size: 20)),
                ],
              ),
              const SizedBox(height: 16),
              const Divider(),
              const SizedBox(height: 8),
              Flexible(
                child: SingleChildScrollView(
                  child: Text(content, style: const TextStyle(fontSize: 12, height: 1.5, color: Color(0xFF374151))),
                ),
              ),
            ],
          ),
        ),
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
              ElevatedButton(onPressed: _loadAll, style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFD97706), foregroundColor: Colors.white), child: const Text('Retry')),
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
    final bFooterCopyright = branding.footerCopyright ?? '\u00a9 2026 esc(Q). All Rights Reserved.';

    final scaffold = Scaffold(
      backgroundColor: const Color(0xFFFBFCFF),
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
                    isMobile
                        ? Column(children: [
                            _buildMenuGrid(isMobile, isTablet, bMenuTitle, bMenuSubtitle),
                            const SizedBox(height: 20),
                            _buildCartSidebar(user),
                          ])
                        : Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Expanded(flex: 8, child: _buildMenuGrid(isMobile, isTablet, bMenuTitle, bMenuSubtitle)),
                              const SizedBox(width: 24),
                              Expanded(flex: 4, child: _buildCartSidebar(user)),
                            ],
                          )
                  else
                    _buildOrderHistory(user),
                  if (customerTab == 'menu' && successOrder == null) ...[
                    const SizedBox(height: 20),
                    _buildReviewSection(user),
                    const SizedBox(height: 20),
                    _buildSentimentLog(),
                  ],
                  const SizedBox(height: 24),
                  _buildDarkFooter(branding, bFooterCopyright, bContactPhone, bContactEmail, bContactAddress),
                  _buildLegalFooter(),
                ],
              ),
            ),
          ),
        ],
      ),
    );

    if (showGPayModal) {
      return Stack(children: [scaffold, _buildGPayModal(user)]);
    }
    return scaffold;
  }
}
