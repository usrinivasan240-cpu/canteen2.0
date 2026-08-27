import 'dart:async';
import 'dart:convert';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/api_service.dart';

class SyncOperation {
  final String id;
  final String entityType;
  final String entityId;
  final String operation;
  final Map<String, dynamic> payload;
  final int createdAt;
  int attempts;
  String status;
  String? lastError;

  SyncOperation({
    required this.id,
    required this.entityType,
    required this.entityId,
    required this.operation,
    required this.payload,
    required this.createdAt,
    this.attempts = 0,
    this.status = 'pending',
    this.lastError,
  });

  Map<String, dynamic> toJson() => {
    'id': id,
    'entityType': entityType,
    'entityId': entityId,
    'operation': operation,
    'payload': payload,
    'createdAt': createdAt,
    'attempts': attempts,
    'status': status,
    'lastError': lastError,
  };

  factory SyncOperation.fromJson(Map<String, dynamic> json) => SyncOperation(
    id: json['id'] ?? '',
    entityType: json['entityType'] ?? '',
    entityId: json['entityId'] ?? '',
    operation: json['operation'] ?? '',
    payload: Map<String, dynamic>.from(json['payload'] ?? {}),
    createdAt: json['createdAt'] ?? 0,
    attempts: json['attempts'] ?? 0,
    status: json['status'] ?? 'pending',
    lastError: json['lastError'],
  );
}

class OfflineSyncService {
  static final OfflineSyncService _instance = OfflineSyncService._();
  factory OfflineSyncService() => _instance;
  OfflineSyncService._();

  final ApiService _api = ApiService();
  final List<SyncOperation> _pendingOps = [];
  Timer? _syncTimer;
  bool _isSyncing = false;
  bool _isOnline = true;
  StreamSubscription? _connectivitySubscription;

  List<SyncOperation> get pendingOperations => List.unmodifiable(_pendingOps);
  bool get isOnline => _isOnline;
  bool get hasPendingOps => _pendingOps.isNotEmpty;

  final StreamController<bool> _onlineStatusController = StreamController<bool>.broadcast();
  Stream<bool> get onOnlineStatusChanged => _onlineStatusController.stream;

  final StreamController<int> _pendingCountController = StreamController<int>.broadcast();
  Stream<int> get onPendingCountChanged => _pendingCountController.stream;

  Future<void> initialize() async {
    await _loadPendingOps();
    _startConnectivityListener();
    _startPeriodicSync();
  }

  void _startConnectivityListener() {
    _connectivitySubscription = Connectivity().onConnectivityChanged.listen((results) {
      final wasOnline = _isOnline;
      _isOnline = results.any((r) => r != ConnectivityResult.none);
      if (!wasOnline && _isOnline) {
        _syncPendingOps();
      }
      _onlineStatusController.add(_isOnline);
    });
  }

  void _startPeriodicSync() {
    _syncTimer = Timer.periodic(const Duration(seconds: 30), (_) {
      if (_isOnline && _pendingOps.isNotEmpty && !_isSyncing) {
        _syncPendingOps();
      }
    });
  }

  Future<void> _loadPendingOps() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final data = prefs.getString('sync_queue');
      if (data != null) {
        final List<dynamic> list = jsonDecode(data);
        _pendingOps.clear();
        _pendingOps.addAll(list.map((e) => SyncOperation.fromJson(e)));
        _pendingCountController.add(_pendingOps.length);
      }
    } catch (e) {
      print('Failed to load sync queue: $e');
    }
  }

  Future<void> _savePendingOps() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final data = jsonEncode(_pendingOps.map((e) => e.toJson()).toList());
      await prefs.setString('sync_queue', data);
      _pendingCountController.add(_pendingOps.length);
    } catch (e) {
      print('Failed to save sync queue: $e');
    }
  }

  Future<void> queueOperation({
    required String entityType,
    required String entityId,
    required String operation,
    required Map<String, dynamic> payload,
  }) async {
    final op = SyncOperation(
      id: 'sync_${DateTime.now().millisecondsSinceEpoch}_${entityType}',
      entityType: entityType,
      entityId: entityId,
      operation: operation,
      payload: payload,
      createdAt: DateTime.now().millisecondsSinceEpoch,
    );

    _pendingOps.add(op);
    await _savePendingOps();

    if (_isOnline) {
      _syncPendingOps();
    }
  }

  Future<void> _syncPendingOps() async {
    if (_isSyncing || _pendingOps.isEmpty) return;
    _isSyncing = true;

    try {
      final toSync = List<SyncOperation>.from(_pendingOps.where((op) => op.status == 'pending'));
      if (toSync.isEmpty) {
        _isSyncing = false;
        return;
      }

      final opsPayload = toSync.map((op) => {
        'entityType': op.entityType,
        'entityId': op.entityId,
        'operation': op.operation,
        'payload': op.payload,
      }).toList();

      final result = await _api.syncPush(
        userId: '',
        operations: opsPayload,
      );

      if (result['success'] == true) {
        final results = result['results'] as List? ?? [];
        for (int i = 0; i < toSync.length; i++) {
          final syncResult = i < results.length ? results[i] : null;
          if (syncResult != null && syncResult['status'] == 'synced') {
            _pendingOps.remove(toSync[i]);
          } else if (syncResult != null && syncResult['status'] == 'conflict') {
            toSync[i].status = 'conflict';
            toSync[i].lastError = 'Conflict detected';
          } else {
            toSync[i].attempts++;
            if (toSync[i].attempts >= 5) {
              toSync[i].status = 'failed';
              toSync[i].lastError = 'Max retries exceeded';
            }
          }
        }
      } else {
        for (final op in toSync) {
          op.attempts++;
          op.lastError = result['error'] ?? 'Sync failed';
          if (op.attempts >= 5) {
            op.status = 'failed';
          }
        }
      }
    } catch (e) {
      print('Sync error: $e');
      for (final op in _pendingOps.where((op) => op.status == 'pending')) {
        op.attempts++;
        op.lastError = e.toString();
        if (op.attempts >= 5) op.status = 'failed';
      }
    } finally {
      _isSyncing = false;
      await _savePendingOps();
    }
  }

  Future<void> forceSyncNow() async {
    if (_isOnline) {
      await _syncPendingOps();
    }
  }

  Future<void> clearFailedOps() async {
    _pendingOps.removeWhere((op) => op.status == 'failed');
    await _savePendingOps();
  }

  void dispose() {
    _syncTimer?.cancel();
    _connectivitySubscription?.cancel();
    _onlineStatusController.close();
    _pendingCountController.close();
  }
}
