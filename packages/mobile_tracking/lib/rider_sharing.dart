import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';
import 'package:pista_core/pista_core.dart';
import 'package:pista_ui/pista_ui.dart';
import 'map_widgets.dart';
import 'tracking_connection.dart';

class RiderLocationSharing extends StatefulWidget {
  final PistaApi api;
  final String assignmentId, orderId;
  const RiderLocationSharing({
    super.key,
    required this.api,
    required this.assignmentId,
    required this.orderId,
  });
  @override
  State<RiderLocationSharing> createState() => _RiderLocationSharingState();
}

class _RiderLocationSharingState extends State<RiderLocationSharing> {
  TrackingConnection? live;
  StreamSubscription<Position>? positions;
  Timer? heartbeat;
  bool sharing = false, busy = false, sending = false;
  String? error;
  DateTime? sent, lastAttempt;
  Future<void> start() async {
    setState(() => busy = true);
    try {
      final first = await currentFix();
      if (!mounted) return;
      live = TrackingConnection(widget.api)
        ..addListener(changed)
        ..connect();
      await live!.beginSharing(widget.assignmentId);
      if (!mounted) {
        live?.stop(widget.assignmentId).whenComplete(() => live?.dispose());
        return;
      }
      setState(() {
        sharing = true;
        error = null;
      });
      live!.watchOrder(widget.orderId);
      final LocationSettings settings =
          defaultTargetPlatform == TargetPlatform.android
          ? AndroidSettings(
              accuracy: LocationAccuracy.high,
              distanceFilter: 10,
              intervalDuration: const Duration(seconds: 5),
              foregroundNotificationConfig: const ForegroundNotificationConfig(
                notificationTitle: 'Pista House delivery location',
                notificationText:
                    'Sharing your location for the active delivery.',
                enableWakeLock: true,
              ),
            )
          : defaultTargetPlatform == TargetPlatform.iOS
          ? AppleSettings(
              accuracy: LocationAccuracy.high,
              distanceFilter: 10,
              activityType: ActivityType.automotiveNavigation,
              pauseLocationUpdatesAutomatically: false,
              showBackgroundLocationIndicator: true,
              allowBackgroundLocationUpdates: true,
            )
          : const LocationSettings(
              accuracy: LocationAccuracy.high,
              distanceFilter: 10,
            );
      positions = Geolocator.getPositionStream(locationSettings: settings).listen(
        send,
        onError: (Object e) {
          if (mounted)
            setState(
              () => error =
                  'GPS is unavailable. Check location permission and services.',
            );
        },
      );
      Future<void>.delayed(const Duration(seconds: 2), () {
        if (mounted && sharing) send(first);
      });
      heartbeat = Timer.periodic(const Duration(seconds: 10), (_) async {
        if (!mounted || !sharing || sending) return;
        try {
          final fix = await currentFix(requestPermission: false);
          if (mounted && sharing) send(fix);
        } catch (_) {
          if (mounted) setState(() => error = 'Waiting for location services.');
        }
      });
    } catch (e) {
      if (mounted) {
        stop();
        setState(() => error = '$e');
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  void changed() {
    if (!mounted) return;
    final s = live?.snapshot;
    if (live?.ended == true ||
        (s != null &&
            (s['sharing'] != true || s['publisherCurrent'] == false))) {
      scheduleMicrotask(() {
        if (mounted) stop();
      });
      return;
    }
    setState(() {});
  }

  Future<void> send(Position p) async {
    if (!mounted ||
        !sharing ||
        sending ||
        live?.connected != true ||
        (lastAttempt != null &&
            DateTime.now().difference(lastAttempt!).inSeconds < 5))
      return;
    if (p.accuracy > 100 ||
        DateTime.now().difference(p.timestamp).inSeconds.abs() > 30) {
      if (mounted) setState(() => error = 'Waiting for an accurate GPS fix.');
      return;
    }
    sending = true;
    lastAttempt = DateTime.now();
    try {
      final ok = await live!.publish({
        'assignmentId': widget.assignmentId,
        'latitude': p.latitude,
        'longitude': p.longitude,
        'accuracy': p.accuracy,
        'heading': p.heading.clamp(0, 360),
        'recordedAt': p.timestamp.toUtc().toIso8601String(),
      });
      if (mounted)
        setState(() {
          if (ok) {
            sent = DateTime.now();
            error = null;
          } else {
            error = 'Location not confirmed. Check the active delivery.';
          }
        });
    } catch (_) {
      if (mounted)
        setState(() => error = 'Location update interrupted. Reconnecting…');
    } finally {
      sending = false;
    }
  }

  void stop() {
    heartbeat?.cancel();
    positions?.cancel();
    positions = null;
    final connection = live;
    connection?.removeListener(changed);
    if (connection != null) {
      connection.stop(widget.assignmentId).whenComplete(connection.dispose);
    }
    live = null;
    if (mounted) setState(() => sharing = false);
  }

  @override
  void dispose() {
    heartbeat?.cancel();
    positions?.cancel();
    final connection = live;
    connection?.removeListener(changed);
    if (connection != null) {
      connection.stop(widget.assignmentId).whenComplete(connection.dispose);
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.only(bottom: 14),
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(
      color: pistaIvory,
      borderRadius: BorderRadius.circular(16),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            const Icon(Icons.sensors, color: pistaGreen),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                sharing
                    ? 'Delivery location sharing'
                    : 'Help them follow your arrival',
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Text(
          sharing
              ? (live?.connected == true
                    ? (sent == null
                          ? 'Waiting for GPS confirmation…'
                          : 'Sharing your latest GPS position')
                    : 'Reconnecting; your position is not live')
              : 'Share GPS only for this active delivery. A system location indicator stays visible.',
          style: const TextStyle(fontSize: 12),
        ),
        if (error != null)
          Text(error!, style: const TextStyle(color: Colors.brown)),
        TextButton(
          onPressed: busy
              ? null
              : sharing
              ? stop
              : start,
          child: Text(
            busy
                ? 'Checking location…'
                : sharing
                ? 'Stop sharing'
                : 'Share live location',
          ),
        ),
      ],
    ),
  );
}
