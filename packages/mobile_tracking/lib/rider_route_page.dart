import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:pista_core/pista_core.dart';
import 'map_widgets.dart';

const _green = Color(0xFF073B29);
const _gold = Color(0xFFB69B60);
const _cream = Color(0xFFFBF3E8);

/// The rider's own map for an active delivery: where they are, the outlet (before
/// pickup), the customer's pin and the road route between them.
///
/// The rider's position is used on this screen and sent to the server only to
/// draw the route. It is not stored. Location *sharing* with the customer is a
/// separate, explicit control that starts after pickup.
class RiderRoutePage extends StatefulWidget {
  final PistaApi api;
  final String assignmentId;

  /// `assigned` (heading to the outlet first) or `picked_up`.
  final String status;
  final LatLng? destination;
  final String? recipient;
  const RiderRoutePage({
    super.key,
    required this.api,
    required this.assignmentId,
    required this.status,
    this.destination,
    this.recipient,
  });
  @override
  State<RiderRoutePage> createState() => _RiderRoutePageState();
}

class _RiderRoutePageState extends State<RiderRoutePage> {
  final mapController = MapController();
  StreamSubscription<Position>? positions;
  Position? me;
  Map<String, dynamic>? route;
  String? error;
  bool loading = false, fitted = false;
  DateTime? routedAt;
  LatLng? routedFrom;

  @override
  void initState() {
    super.initState();
    start();
  }

  Future<void> start() async {
    try {
      final first = await currentFix();
      if (!mounted) return;
      setState(() {
        me = first;
        error = null;
      });
      loadRoute();
      positions =
          Geolocator.getPositionStream(
            locationSettings: const LocationSettings(
              accuracy: LocationAccuracy.high,
              distanceFilter: 15,
            ),
          ).listen((p) {
            if (!mounted) return;
            setState(() => me = p);
            final from = routedFrom;
            final moved = from == null
                ? 999.0
                : const Distance().as(
                    LengthUnit.Meter,
                    from,
                    LatLng(p.latitude, p.longitude),
                  );
            if (moved > 120 ||
                routedAt == null ||
                DateTime.now().difference(routedAt!).inSeconds > 60) {
              loadRoute();
            }
          });
    } catch (e) {
      if (mounted) {
        setState(
          () => error =
              '${'$e'.replaceFirst('Exception: ', '')}\n'
              'You can still see the outlet and the customer’s pin.',
        );
        loadRoute(withoutPosition: true);
      }
    }
  }

  Future<void> loadRoute({bool withoutPosition = false}) async {
    final p = me;
    if (loading || (p == null && !withoutPosition)) return;
    if (p == null) return;
    loading = true;
    routedAt = DateTime.now();
    routedFrom = LatLng(p.latitude, p.longitude);
    try {
      final data = await widget.api.request(
        '/rider/tasks/${widget.assignmentId}/route'
        '?lat=${p.latitude.toStringAsFixed(6)}&lon=${p.longitude.toStringAsFixed(6)}',
      );
      if (!mounted) return;
      setState(() => route = Map<String, dynamic>.from(data));
      if (!fitted && route?['available'] == true) {
        fitted = true;
        WidgetsBinding.instance.addPostFrameCallback((_) => fit());
      }
    } catch (_) {
      if (mounted) setState(() => route = null);
    } finally {
      loading = false;
    }
  }

  List<LatLng> get _points => ((route?['coordinates'] as List?) ?? [])
      .map((c) => LatLng((c[1] as num).toDouble(), (c[0] as num).toDouble()))
      .toList();

  LatLng? _stop(String kind) {
    for (final s in (route?['stops'] as List?) ?? []) {
      if (s['kind'] == kind) return mapPoint(s);
    }
    return null;
  }

  void fit() {
    if (!mounted) return;
    final all = [
      ..._points,
      if (me != null) LatLng(me!.latitude, me!.longitude),
      if (widget.destination != null) widget.destination!,
    ];
    if (all.length > 1) {
      mapController.fitCamera(
        CameraFit.bounds(
          bounds: LatLngBounds.fromPoints(all),
          padding: EdgeInsets.fromLTRB(
            50,
            80,
            50,
            MediaQuery.sizeOf(context).height * .3,
          ),
        ),
      );
    }
  }

  @override
  void dispose() {
    positions?.cancel();
    mapController.dispose();
    super.dispose();
  }

  String _mins(num seconds) => '${(seconds / 60).ceil()} min';
  String _km(num metres) => '${(metres / 1000).toStringAsFixed(1)} km';

  @override
  Widget build(BuildContext context) {
    final available = route?['available'] == true;
    final outlet = _stop('outlet');
    final destination = _stop('customer') ?? widget.destination;
    final mine = me == null ? null : LatLng(me!.latitude, me!.longitude);
    final center = mine ?? destination ?? outlet;
    final legs = (route?['legs'] as List?) ?? [];
    final toOutlet = outlet != null && legs.length >= 2;
    return Scaffold(
      backgroundColor: _cream,
      appBar: AppBar(
        title: const Text('Map to customer'),
        backgroundColor: _cream,
      ),
      body: Column(
        children: [
          Expanded(
            child: center == null
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.all(30),
                      child: Text(
                        error ??
                            'A map appears when your position or the delivery pin is known.',
                        textAlign: TextAlign.center,
                      ),
                    ),
                  )
                : Stack(
                    children: [
                      DeliveryMap(
                        controller: mapController,
                        center: center,
                        route: _points,
                        markers: [
                          if (outlet != null)
                            mapMarker(outlet, Icons.storefront_outlined, _gold),
                          if (destination != null)
                            mapMarker(destination, Icons.home_rounded, _green),
                          if (mine != null)
                            mapMarker(
                              mine,
                              Icons.navigation,
                              const Color(0xFF2B6CB0),
                              pulse: true,
                            ),
                        ],
                      ),
                      Positioned(
                        right: 16,
                        top: 16,
                        child: IconButton.filledTonal(
                          tooltip: 'Show my route',
                          icon: const Icon(Icons.center_focus_strong),
                          onPressed: fit,
                        ),
                      ),
                    ],
                  ),
          ),
          Container(
            width: double.infinity,
            decoration: const BoxDecoration(
              color: _cream,
              borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
              boxShadow: [
                BoxShadow(
                  color: Color(0x22073B29),
                  blurRadius: 18,
                  offset: Offset(0, -4),
                ),
              ],
            ),
            child: SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(22, 18, 22, 18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      available
                          ? '${_mins(route!['durationSeconds'])} · ${_km(route!['distanceMetres'])}'
                          : 'Finding your route…',
                      style: const TextStyle(
                        fontFamily: 'packages/pista_ui/HouseSerif',
                        fontSize: 28,
                        fontWeight: FontWeight.w600,
                        color: _green,
                      ),
                    ),
                    if (widget.recipient != null)
                      Padding(
                        padding: const EdgeInsets.only(top: 2),
                        child: Text('To ${widget.recipient}'),
                      ),
                    if (available && toOutlet) ...[
                      const SizedBox(height: 8),
                      _leg(Icons.storefront_outlined, 'To the outlet', legs[0]),
                      _leg(Icons.home_outlined, 'Outlet to customer', legs[1]),
                    ] else if (available && legs.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      _leg(Icons.home_outlined, 'To the customer', legs[0]),
                    ],
                    if (error != null)
                      Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: Text(
                          error!,
                          style: const TextStyle(color: Colors.brown),
                        ),
                      ),
                    if (route != null && !available)
                      Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: Text(
                          '${route!['reason'] ?? 'Route unavailable.'} Use Navigate to open a maps app.',
                          style: const TextStyle(color: Colors.brown),
                        ),
                      ),
                    const SizedBox(height: 8),
                    const Text(
                      'Road route only. Not traffic-aware. Your position is used to draw this route and is not stored.',
                      style: TextStyle(fontSize: 11, color: Colors.black54),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _leg(IconData icon, String label, dynamic leg) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 3),
    child: Row(
      children: [
        Icon(icon, size: 18, color: _gold),
        const SizedBox(width: 10),
        Expanded(child: Text(label)),
        Text(
          '${_mins(leg['durationSeconds'])} · ${_km(leg['distanceMetres'])}',
          style: const TextStyle(fontWeight: FontWeight.w600),
        ),
      ],
    ),
  );
}
