import 'dart:async';
import 'package:flutter/material.dart';
import '../models/wallet.dart';
import '../services/api_service.dart';

class WalletProvider extends ChangeNotifier {
  final ApiService _api = ApiService();

  Wallet? _wallet;
  List<WalletTransaction> _transactions = [];
  List<WalletTopup> _topups = [];
  bool _loading = false;
  String? _error;
  Timer? _balanceRefreshTimer;
  // Set when the server reports a dead session (expired/revoked JWT).
  // Screens watch this to send the user to login instead of error loops.
  bool _sessionExpired = false;
  bool get sessionExpired => _sessionExpired;
  void clearSessionExpired() {
    _sessionExpired = false;
  }

  Wallet? get wallet => _wallet;
  List<WalletTransaction> get transactions => _transactions;
  List<WalletTopup> get topups => _topups;
  bool get loading => _loading;
  String? get error => _error;
  String get formattedBalance {
    if (_wallet == null) return '₹0.00';
    final rupees = _wallet!.balance / 100;
    return '₹${rupees.toStringAsFixed(2)}';
  }

  bool get hasWallet => _wallet != null;
  bool get isWalletActive => _wallet?.isActive ?? false;

  Future<void> loadWallet() async {
    if (_loading) return;
    _setLoading(true);
    _clearError();

    try {
      final response = await _api.getWallet();
      if (response['sessionExpired'] == true) {
        _sessionExpired = true;
        _wallet = null;
        notifyListeners();
        return;
      }
      if (response['success'] == true && response['wallet'] != null) {
        _wallet = Wallet.fromJson(response['wallet']);
        _transactions = (response['transactions'] as List<dynamic>?)
            ?.map((e) => WalletTransaction.fromJson(e as Map<String, dynamic>))
            .toList() ?? [];
        _topups = (response['topups'] as List<dynamic>?)
            ?.map((e) => WalletTopup.fromJson(e as Map<String, dynamic>))
            .toList() ?? [];
      }
    } catch (e) {
      _setError('Failed to load wallet: $e');
    } finally {
      _setLoading(false);
    }
  }

  Future<void> refreshBalance() async {
    if (!hasWallet) return;
    try {
      final response = await _api.getWalletBalance();
      if (response['success'] == true && response['wallet'] != null) {
        _wallet = Wallet.fromJson(response['wallet']);
        notifyListeners();
      }
    } catch (e) {
      debugPrint('Failed to refresh balance: $e');
    }
  }

  Future<void> loadTransactions({int page = 1, int limit = 20}) async {
    try {
      final response = await _api.getWalletTransactions(page: page, limit: limit);
      if (response['success'] == true && response['transactions'] != null) {
        final newTransactions = (response['transactions'] as List<dynamic>)
            .map((e) => WalletTransaction.fromJson(e as Map<String, dynamic>))
            .toList();
        if (page == 1) {
          _transactions = newTransactions;
        } else {
          _transactions.addAll(newTransactions);
        }
        notifyListeners();
      }
    } catch (e) {
      debugPrint('Failed to load transactions: $e');
    }
  }

  Future<void> loadTopups({int page = 1, int limit = 20}) async {
    try {
      final response = await _api.getWalletTopups(page: page, limit: limit);
      if (response['success'] == true && response['topups'] != null) {
        final newTopups = (response['topups'] as List<dynamic>)
            .map((e) => WalletTopup.fromJson(e as Map<String, dynamic>))
            .toList();
        if (page == 1) {
          _topups = newTopups;
        } else {
          _topups.addAll(newTopups);
        }
        notifyListeners();
      }
    } catch (e) {
      debugPrint('Failed to load topups: $e');
    }
  }

  /// Starts a top-up. Returns a result map so the caller can branch:
  /// `{topup, useRazorpay, razorpayOrderId, razorpayKeyId, amount, message}`.
  /// Null means the request itself failed (see [error]).
  Future<Map<String, dynamic>?> initiateTopup({
    required int amount, // in paise
    required String provider, // 'RAZORPAY', 'VYAPAR', 'MOCK'
  }) async {
    _setLoading(true);
    _clearError();

    try {
      final response = await _api.initiateWalletTopup(
        amount: amount,
        provider: provider,
      );

      if (response['sessionExpired'] == true) {
        _sessionExpired = true;
        _setError('Session expired. Please log in again.');
        return {'sessionExpired': true};
      }
      if (response['success'] == true) {
        // Server returns { topupId, useRazorpay, razorpayOrderId, ... }
        // for Razorpay, not a full `topup` object. Handle both shapes so
        // the caller can branch (launch PSP vs no-op) without an error.
        WalletTopup? topup;
        if (response['topup'] != null) {
          topup = WalletTopup.fromJson(response['topup']);
          _topups.insert(0, topup);
          notifyListeners();
        } else if (response['topupId'] != null) {
          // Razorpay path — synthesize minimal topup so UI can confirm later.
          topup = WalletTopup(
            id: response['topupId'] as String,
            walletId: _wallet?.id ?? '',
            amount: amount,
            provider: provider,
            status: 'PENDING',
            providerOrderId: response['razorpayOrderId'] as String?,
            createdAt: DateTime.now().millisecondsSinceEpoch,
            updatedAt: DateTime.now().millisecondsSinceEpoch,
          );
          _topups.insert(0, topup);
          notifyListeners();
        } else {
          _setError('Topup initiated but no topupId returned');
          return null;
        }
        return {
          'topup': topup,
          'useRazorpay': response['useRazorpay'] == true,
          'razorpayOrderId': response['razorpayOrderId'],
          'razorpayKeyId': response['razorpayKeyId'],
          'amount': amount,
          'message': response['message'],
          'sessionExpired': response['sessionExpired'] == true,
        };
      } else {
        _setError(response['error'] ?? 'Failed to initiate topup');
        return null;
      }
    } catch (e) {
      _setError('Failed to initiate topup: $e');
      return null;
    } finally {
      _setLoading(false);
    }
  }

  Future<bool> processTopupSuccess({
    required String topupId,
    required String provider,
    String? providerOrderId,
    String? providerPaymentId,
  }) async {
    try {
      final response = await _api.confirmWalletTopup(
        topupId: topupId,
        provider: provider,
        providerOrderId: providerOrderId,
        providerPaymentId: providerPaymentId,
      );

      if (response['success'] == true) {
        await refreshBalance();
        await loadTopups();
        return true;
      }
      return false;
    } catch (e) {
      debugPrint('Failed to confirm topup: $e');
      return false;
    }
  }

  Future<bool> payWithWallet({
    required String orderId,
    required int amount, // in paise
    required String idempotencyKey,
  }) async {
    _setLoading(true);
    _clearError();

    try {
      final response = await _api.payWithWallet(
        orderId: orderId,
        amount: amount,
        idempotencyKey: idempotencyKey,
      );

      if (response['success'] == true) {
        await refreshBalance();
        return true;
      } else {
        _setError(response['error'] ?? 'Payment failed');
        return false;
      }
    } catch (e) {
      _setError('Payment failed: $e');
      return false;
    } finally {
      _setLoading(false);
    }
  }

  Future<bool> requestRefund({
    required String transactionId,
    required int amount,
    required String idempotencyKey,
  }) async {
    _setLoading(true);
    _clearError();

    try {
      final response = await _api.requestRefund(
        transactionId: transactionId,
        amount: amount,
        idempotencyKey: idempotencyKey,
      );

      if (response['success'] == true) {
        await refreshBalance();
        await loadTransactions();
        return true;
      } else {
        _setError(response['error'] ?? 'Refund failed');
        return false;
      }
    } catch (e) {
      _setError('Refund failed: $e');
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

  void startAutoRefresh({Duration interval = const Duration(seconds: 30)}) {
    _balanceRefreshTimer?.cancel();
    _balanceRefreshTimer = Timer.periodic(interval, (_) {
      refreshBalance();
    });
  }

  void stopAutoRefresh() {
    _balanceRefreshTimer?.cancel();
    _balanceRefreshTimer = null;
  }

  /// Drop all session state (logout / user switch) so the next account
  /// never sees the previous user's balance, and the refresh timer stops.
  void clear() {
    stopAutoRefresh();
    _wallet = null;
    _transactions = [];
    _topups = [];
    _loading = false;
    _error = null;
    _sessionExpired = false;
    notifyListeners();
  }

  @override
  void dispose() {
    _balanceRefreshTimer?.cancel();
    super.dispose();
  }
}
