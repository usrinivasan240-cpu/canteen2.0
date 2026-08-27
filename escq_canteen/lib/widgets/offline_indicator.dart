import 'dart:async';
import 'package:flutter/material.dart';
import '../services/offline_sync_service.dart';

class OfflineIndicator extends StatefulWidget {
  const OfflineIndicator({super.key});

  @override
  State<OfflineIndicator> createState() => _OfflineIndicatorState();
}

class _OfflineIndicatorState extends State<OfflineIndicator> {
  final OfflineSyncService _syncService = OfflineSyncService();
  late StreamSubscription _onlineSub;
  late StreamSubscription _pendingSub;
  bool _isOnline = true;
  int _pendingCount = 0;

  @override
  void initState() {
    super.initState();
    _isOnline = _syncService.isOnline;
    _pendingCount = _syncService.pendingOperations.length;
    _onlineSub = _syncService.onOnlineStatusChanged.listen((online) {
      if (mounted) setState(() => _isOnline = online);
    });
    _pendingSub = _syncService.onPendingCountChanged.listen((count) {
      if (mounted) setState(() => _pendingCount = count);
    });
  }

  @override
  void dispose() {
    _onlineSub.cancel();
    _pendingSub.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_isOnline && _pendingCount == 0) return const SizedBox.shrink();

    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: _isOnline
            ? (_pendingCount > 0 ? const Color(0xFFF59E0B).withOpacity(0.9) : const Color(0xFF16A34A).withOpacity(0.9))
            : const Color(0xFFDC2626).withOpacity(0.9),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            _isOnline
                ? (_pendingCount > 0 ? Icons.sync : Icons.cloud_done)
                : Icons.cloud_off,
            color: Colors.white,
            size: 14,
          ),
          const SizedBox(width: 6),
          Text(
            _isOnline
                ? (_pendingCount > 0 ? 'Syncing $_pendingCount items...' : 'Online')
                : 'Offline - Changes queued',
            style: const TextStyle(
              color: Colors.white,
              fontSize: 11,
              fontWeight: FontWeight.w600,
            ),
          ),
          if (_pendingCount > 0 && !_isOnline) ...[
            const SizedBox(width: 6),
            GestureDetector(
              onTap: () => _syncService.forceSyncNow(),
              child: const Icon(Icons.refresh, color: Colors.white, size: 12),
            ),
          ],
        ],
      ),
    );
  }
}
