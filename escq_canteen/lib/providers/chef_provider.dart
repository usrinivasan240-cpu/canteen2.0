import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/chef.dart'
import '../services/api_service.dart';

class ChefProvider extends ChangeNotifier {
  final ApiService _api = ApiService();

  List<Chef> _chefs = [];
  List<dynamic> _kitchenTasks = [];
  List<dynamic> _chefLeave = [];
  bool _loading = false;
  String? _error;
  Timer? _refreshTimer;

  List<Chef> get chefs => _chefs;
  List<dynamic> get kitchenTasks => _kitchenTasks;
  List<dynamic> get chefLeave => _chefLeave;
  bool get loading => _loading;
  String? get error => _error;

  List<Chef> get activeChefs => _chefs.where((c) => c.isAvailableStatus).toList();
  List<Chef> get onLeaveChefs => _chefs.where((c) => c.isOnLeave).toList();
  List<Chef> get inactiveChefs => _chefs.where((c) => c.isInactive).toList();

  @override
  void dispose() {
    _refreshTimer?.cancel();
    super.dispose();
  }

  void _setLoading(bool value) {
    _loading = value;
    notifyListeners();
  }

  void _setError(String message) {
    _error = message;
    notifyListeners();
  }

  void _clearError() {
    _error = null;
    notifyListeners();
  }

  Future<void> loadChefs({String? canteenId}) async {
    _setLoading(true);
    _clearError();

    try {
      final response = await _api.getChefs(canteenId: canteenId);
      if (response['success'] == true && response['chefs'] != null) {
        _chefs = (response['chefs'] as List<dynamic>)
            .map((e) => Chef.fromJson(e as Map<String, dynamic>))
            .toList();
      } else {
        _setError(response['error'] ?? 'Failed to load chefs');
      }
    } catch (e) {
      _setError('Failed to load chefs: $e');
    } finally {
      _setLoading(false);
    }
  }

  Future<void> loadKitchenTasks({String? canteenId, String? chefId}) async {
    _clearError();
    try {
      final response = await _api.getKitchenTasks(canteenId: canteenId, chefId: chefId);
      if (response['success'] == true && response['tasks'] != null) {
        _kitchenTasks = response['tasks'];
      }
    } catch (e) {
      debugPrint('Failed to load kitchen tasks: $e');
    }
  }

  Future<void> loadChefLeave({String? chefId}) async {
    _clearError();
    try {
      final response = await _api.getChefLeave(chefId: chefId);
      if (response['success'] == true && response['leave'] != null) {
        _chefLeave = (response['leave'] as List<dynamic>)
            .map((e) => ChefLeave.fromJson(e as Map<String, dynamic>))
            .toList();
      }
    } catch (e) {
      debugPrint('Failed to load chef leave: $e');
    }
  }

  Future<Chef?> createChef({
    required String canteenId,
    required String name,
    String? phone,
    String? email,
    List<String> specialization = const [],
    String? userId,
  }) async {
    _setLoading(true);
    _clearError();

    try {
      final response = await _api.createChef(
        canteenId: canteenId,
        name: name,
        phone: phone,
        email: email,
        specialization: specialization,
        userId: userId,
      );

      if (response['success'] == true && response['chef'] != null) {
        final chef = Chef.fromJson(response['chef']);
        _chefs.add(chef);
        notifyListeners();
        return Chef.fromJson(response['chef']);
      } else {
        _setError(response['error'] ?? 'Failed to create chef');
        return null;
      }
    } catch (e) {
      _setError('Failed to create chef: $e');
      return null;
    } finally {
      _setLoading(false);
    }
  }

  Future<bool> updateChef({
    required String chefId,
    String? name,
    String? phone,
    String? email,
    List<String>? specialization,
    String? status,
    bool? isAvailable,
  }) async {
    _setLoading(true);
    _clearError();

    try {
      final response = await _api.updateChef(
        chefId: chefId,
        name: name,
        phone: phone,
        email: email,
        specialization: specialization,
        status: status,
        isAvailable: isAvailable,
      );

      if (response['success'] == true && response['chef'] != null) {
        final index = _chefs.indexWhere((c) => c.id == response['chef']['id']);
        if (index != -1) {
          _chefs[index] = Chef.fromJson(response['chef']);
          notifyListeners();
        }
        return true;
      } else {
        _setError(response['error'] ?? 'Failed to update chef');
        return false;
      }
    } catch (e) {
      _setError('Failed to update chef: $e');
      return false;
    } finally {
      _setLoading(false);
    }
  }

  Future<bool> deleteChef(String chefId) async {
    _setLoading(true);
    _clearError();

    try {
      final response = await _api.deleteChef(chefId: chefId);

      if (response['success'] == true) {
        _chefs.removeWhere((c) => c.id == chefId);
        notifyListeners();
        return true;
      } else {
        _setError(response['error'] ?? 'Failed to delete chef');
        return false;
      }
    } catch (e) {
      _setError('Failed to delete chef: $e');
      return false;
    } finally {
      _setLoading(false);
    }
  }

  Future<bool> setChefLeave({
    required String chefId,
    required int startDate,
    required int endDate,
    String? reason,
  }) async {
    _setLoading(true);
    _clearError();

    try {
      final response = await _api.setChefLeave(
        chefId: chefId,
        startDate: startDate,
        endDate: endDate,
        reason: reason,
      );

      if (response['success'] == true) {
        await loadChefLeave();
        return true;
      } else {
        _setError(response['error'] ?? 'Failed to set leave');
        return false;
      }
    } catch (e) {
      _setError('Failed to set leave: $e');
      return false;
    } finally {
      _setLoading(false);
    }
  }

  Future<bool> assignItemToChef({
    required String itemId,
    required String chefId,
    bool isBackup = false,
  }) async {
    _setLoading(true);
    _clearError();

    try {
      final response = await _api.assignChefToItem(
        itemId: itemId,
        chefId: chefId,
        isBackup: isBackup,
      );

      if (response['success'] == true) {
        return true;
      } else {
        _setError(response['error'] ?? 'Failed to assign chef');
        return false;
      }
    } catch (e) {
      _setError('Failed to assign chef: $e');
      return false;
    } finally {
      _setLoading(false);
    }
  }

  void _setLoading(bool value) {
    _loading = value;
    notifyListeners();
  }

  void _setError(String message) {
    _error = message;
    notifyListeners();
  }

  void _clearError() {
    _error = null;
    notifyListeners();
  }
}