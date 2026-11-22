import 'package:pista_core/pista_core.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;
import 'package:flutter/foundation.dart';
import 'dart:async';

class TrackingConnection extends ChangeNotifier {
  final PistaApi api;
  final String? orderId;
  io.Socket? _socket;
  Map<String, dynamic>? snapshot;
  DateTime? snapshotReceivedAt;
  bool connected = false, ended = false, _disposed = false;
  String? error;
  String? lease, _watchedOrder;
  TrackingConnection(this.api, {this.orderId}) : _watchedOrder = orderId;
  void _notify() {
    if (!_disposed) notifyListeners();
  }

  void connect() {
    if (api.token == null || api.baseUrl.isEmpty) {
      error = 'Sign in and configure your server first.';
      _notify();
      return;
    }
    final uri = Uri.parse(api.baseUrl);
    _socket = io.io(
      uri.origin,
      io.OptionBuilder()
          .setTransports(['websocket'])
          .setPath(
            '${uri.path.replaceFirst(RegExp(r'/$'), '')}/tracking/socket.io',
          )
          .setAuth({'token': api.token})
          .disableAutoConnect()
          .enableForceNew()
          .build(),
    );
    _socket!.onConnect((_) {
      connected = true;
      error = null;
      _notify();
      if (_watchedOrder != null) watchOrder(_watchedOrder!);
    });
    _socket!.on('tracking:snapshot', (data) {
      if (data is Map) {
        snapshot = Map<String, dynamic>.from(data);
        snapshotReceivedAt = DateTime.now();
        _notify();
      }
    });
    _socket!.on('tracking:ended', (_) {
      ended = true;
      connected = false;
      snapshot = null;
      error = 'Tracking access ended. Refresh your account.';
      _notify();
    });
    _socket!.onDisconnect((_) {
      connected = false;
      _notify();
    });
    _socket!.onConnectError((e) {
      connected = false;
      error = 'Reconnecting to your delivery…';
      if ('$e'.contains('Tracking authentication failed')) {
        ended = true;
        snapshot = null;
        error = 'Sign in again to view this delivery.';
        scheduleMicrotask(() => _socket?.disconnect());
      }
      _notify();
    });
    _socket!.connect();
  }

  void watchOrder(String id) {
    _watchedOrder = id;
    if (connected)
      _socket!.emitWithAck(
        'tracking:watch',
        {'orderId': id, if (lease != null) 'lease': lease},
        ack: (data) {
          if (data is Map && data['ok'] != true) {
            error = 'This order is not available.';
            snapshot = null;
            _notify();
          }
        },
      );
  }

  Future<void> beginSharing(String id) async {
    if (!connected) {
      final ready = Completer<void>();
      void changed() {
        if (!ready.isCompleted && connected) ready.complete();
        if (!ready.isCompleted && ended)
          ready.completeError(Exception('Sign in again.'));
      }

      addListener(changed);
      try {
        changed();
        await ready.future.timeout(const Duration(seconds: 10));
      } finally {
        removeListener(changed);
      }
    }
    if (_disposed) throw Exception('Sharing was cancelled');
    final result = await _socket!
        .emitWithAckAsync('tracking:start', {'assignmentId': id})
        .timeout(const Duration(seconds: 8));
    if (result is! Map || result['ok'] != true || result['lease'] is! String)
      throw Exception('No active delivery to share. Refresh your tasks.');
    lease = result['lease'];
  }

  Future<bool> publish(Map<String, dynamic> point) async {
    if (!connected || ended || lease == null) return false;
    var accepted = false;
    await _socket!
        .emitWithAckAsync('tracking:position', {...point, 'lease': lease})
        .timeout(const Duration(seconds: 8))
        .then((data) {
          accepted = data is Map && data['ok'] == true;
        });
    return accepted;
  }

  Future<void> stop(String id) async {
    if (connected && lease != null) {
      try {
        await _socket
            ?.emitWithAckAsync('tracking:stop', {
              'assignmentId': id,
              'lease': lease,
            })
            .timeout(const Duration(seconds: 2));
      } catch (_) {}
    }
  }

  @override
  void dispose() {
    _disposed = true;
    _socket?.dispose();
    super.dispose();
  }
}
