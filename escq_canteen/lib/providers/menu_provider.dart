import 'package:flutter/material.dart';
import '../models/menu_item.dart';
import '../models/college.dart';
import '../services/api_service.dart';

class MenuProvider extends ChangeNotifier {
  final ApiService _api = ApiService();

  List<MenuItem> _items = [];
  List<MenuItem> get items => _items;

  List<College> _colleges = [];
  List<College> get colleges => _colleges;

  List<Canteen> _canteens = [];
  List<Canteen> get canteens => _canteens;

  List<SubCanteen> _subCanteens = [];
  List<SubCanteen> get subCanteens => _subCanteens;

  bool _loading = false;
  bool get loading => _loading;

  // 'All' default so no category is hidden on first load.
  String _selectedCategory = 'All';
  String get selectedCategory => _selectedCategory;

  String _searchQuery = '';
  String get searchQuery => _searchQuery;

  // No magic default: the server re-homes a missing/empty canteenId to
  // canteen_001, so selection must always be explicit (fail closed).
  String _selectedCanteenId = '';
  String get selectedCanteenId => _selectedCanteenId;

  String _selectedSubCanteenId = '';
  String get selectedSubCanteenId => _selectedSubCanteenId;

  void setCategory(String cat) {
    _selectedCategory = cat;
    notifyListeners();
  }

  void setSearchQuery(String q) {
    _searchQuery = q;
    notifyListeners();
  }

  void setCanteen(String id) {
    _selectedCanteenId = id;
    // A stale sub-counter from the previous canteen would filter the new
    // canteen down to generic items only — always reset on canteen change.
    _selectedSubCanteenId = '';
    notifyListeners();
  }

  void setSubCanteen(String id) {
    _selectedSubCanteenId = id;
    notifyListeners();
  }

  List<MenuItem> get filteredItems {
    return _items.where((item) {
      final catMatch = _selectedCategory == 'All' ||
          item.category.toLowerCase().contains(_selectedCategory.split(' ')[0].toLowerCase());
      final searchMatch = _searchQuery.isEmpty ||
          item.name.toLowerCase().contains(_searchQuery.toLowerCase()) ||
          item.category.toLowerCase().contains(_searchQuery.toLowerCase()) ||
          item.description.toLowerCase().contains(_searchQuery.toLowerCase());
      return catMatch && searchMatch;
    }).toList();
  }

  List<Canteen> get collegeCanteens {
    // Fail closed: an empty college id must never expose every canteen.
    final uid = _userCollegeId?.trim() ?? '';
    if (uid.isEmpty) return <Canteen>[];
    return _canteens.where((c) => c.collegeId.trim() == uid).toList();
  }

  /// Drop all user-scoped state (logout / user switch) so the next account
  /// never inherits the previous user's college/canteen filter or menu.
  /// The public colleges list is kept (needed by the registration screen).
  void resetUserScope() {
    _userCollegeId = null;
    _selectedCanteenId = '';
    _selectedSubCanteenId = '';
    _items = [];
    _canteens = [];
    _subCanteens = [];
    _selectedCategory = 'All';
    _searchQuery = '';
    notifyListeners();
  }

  String? _userCollegeId;
  String? get userCollegeId => _userCollegeId;

  void setUserCollege(String? id) {
    _userCollegeId = id;
  }

  List<SubCanteen> get canteenSubCounters {
    return _subCanteens.where((s) => s.canteenId == _selectedCanteenId).toList();
  }

  College? get userCollege {
    final uid = _userCollegeId?.trim() ?? '';
    if (uid.isEmpty) return null;
    try {
      return _colleges.firstWhere((c) => c.id == uid);
    } catch (_) {
      return null;
    }
  }

  CollegeBranding get branding {
    return userCollege?.branding ?? CollegeBranding();
  }

  Future<void> loadData({String? userCollegeId, String? userCanteenId}) async {
    _loading = true;
    notifyListeners();

    try {
      final normCollege = userCollegeId?.trim() ?? '';
      if (normCollege.isNotEmpty) _userCollegeId = normCollege;
      final normCanteen = userCanteenId?.trim() ?? '';
      if (normCanteen.isNotEmpty) _selectedCanteenId = normCanteen;

      // Colleges are critical for registration — fetch first and fail loudly
      // if they cannot be loaded. Canteens/subCanteens are secondary and
      // must not block the college dropdown when the server is slow.
      try {
        _colleges = await _api.getColleges();
      } catch (e) {
        // Keep rethrow so LoginScreen can show the actual error via _collegesError
        rethrow;
      }
      List<Canteen> fetched = [];
      try {
        fetched = await _api.getCanteens(
          collegeId: normCollege.isNotEmpty ? normCollege : null,
        );
      } catch (e) {
        debugPrint('[MenuProvider] getCanteens failed (non-fatal): $e');
      }
      // Strict client-side isolation as safety net.
      final uid = _userCollegeId?.trim() ?? '';
      _canteens = uid.isEmpty
          ? fetched
          : fetched.where((c) => c.collegeId.trim() == uid).toList();
      try {
        _subCanteens = await _api.getSubCanteens();
      } catch (e) {
        debugPrint('[MenuProvider] getSubCanteens failed (non-fatal): $e');
        _subCanteens = [];
      }

      // Auto-select college ONLY from an explicitly selected canteen.
      // Guessing from the first loaded canteen leaks another college's
      // identity when the list is unfiltered (no user / legacy account).
      if (_userCollegeId == null && _selectedCanteenId.isNotEmpty) {
        try {
          final cant = _canteens.firstWhere((c) => c.id == _selectedCanteenId);
          _userCollegeId = cant.collegeId;
        } catch (_) {}
      }

      // Auto-select sub-canteen (only when a canteen is selected)
      if (_selectedCanteenId.isNotEmpty &&
          _selectedSubCanteenId.isEmpty &&
          _subCanteens.isNotEmpty) {
        try {
          final sub = _subCanteens.firstWhere((s) => s.canteenId == _selectedCanteenId);
          _selectedSubCanteenId = sub.id;
        } catch (_) {}
      }

      await loadMenu();
    } catch (e) {
      debugPrint('Error loading data: $e');
      _loading = false;
      notifyListeners();
      rethrow;
    }

    _loading = false;
    notifyListeners();
  }

  Future<void> loadMenu() async {
    // Fail closed: never call /api/canteen with an empty id — the server
    // would silently serve canteen_001's menu (cross-college leak).
    if (_selectedCanteenId.trim().isEmpty) {
      _items = [];
      notifyListeners();
      return;
    }
    try {
      final data = await _api.getCanteenData(_selectedCanteenId);
      _items = _api.parseMenuItems(data);
    } catch (e) {
      debugPrint('Error loading menu: $e');
    }
    notifyListeners();
  }
}
