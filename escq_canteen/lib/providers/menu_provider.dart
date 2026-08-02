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

  String _selectedCategory = 'Meals';
  String get selectedCategory => _selectedCategory;

  String _searchQuery = '';
  String get searchQuery => _searchQuery;

  String _selectedCanteenId = 'canteen_001';
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
    return _canteens.where((c) => c.collegeId == userCollegeId).toList();
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
    if (_userCollegeId == null) return null;
    try {
      return _colleges.firstWhere((c) => c.id == _userCollegeId);
    } catch (_) {
      return _colleges.isNotEmpty ? _colleges.first : null;
    }
  }

  CollegeBranding get branding {
    return userCollege?.branding ?? CollegeBranding();
  }

  Future<void> loadData({String? userCollegeId, String? userCanteenId}) async {
    _loading = true;
    notifyListeners();

    try {
      if (userCollegeId != null) _userCollegeId = userCollegeId;
      if (userCanteenId != null) _selectedCanteenId = userCanteenId;

      final collegesFuture = _api.getColleges();
      final canteensFuture = _api.getCanteens();
      final subCanteensFuture = _api.getSubCanteens();

      _colleges = await collegesFuture;
      _canteens = await canteensFuture;
      _subCanteens = await subCanteensFuture;

      // Auto-select college from canteen
      if (_userCollegeId == null && _canteens.isNotEmpty) {
        try {
          final cant = _canteens.firstWhere((c) => c.id == _selectedCanteenId);
          _userCollegeId = cant.collegeId;
        } catch (_) {
          if (_canteens.isNotEmpty) _userCollegeId = _canteens.first.collegeId;
        }
      }

      // Auto-select sub-canteen
      if (_selectedSubCanteenId.isEmpty && _subCanteens.isNotEmpty) {
        try {
          final sub = _subCanteens.firstWhere((s) => s.canteenId == _selectedCanteenId);
          _selectedSubCanteenId = sub.id;
        } catch (_) {}
      }

      await loadMenu();
    } catch (e) {
      print('Error loading data: $e');
    }

    _loading = false;
    notifyListeners();
  }

  Future<void> loadMenu() async {
    try {
      final data = await _api.getCanteenData(_selectedCanteenId);
      _items = _api.parseMenuItems(data);
    } catch (e) {
      print('Error loading menu: $e');
    }
    notifyListeners();
  }
}
