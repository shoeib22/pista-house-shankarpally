import 'package:flutter/material.dart';
import 'package:pista_ui/pista_ui.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:geolocator/geolocator.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:pista_core/pista_core.dart';
export 'package:latlong2/latlong.dart';

LatLng? mapPoint(dynamic data) {
  if (data is! Map || data['latitude'] is! num || data['longitude'] is! num)
    return null;
  final lat = (data['latitude'] as num).toDouble(),
      lon = (data['longitude'] as num).toDouble();
  if (!lat.isFinite || !lon.isFinite || lat.abs() > 90 || lon.abs() > 180)
    return null;
  return LatLng(lat, lon);
}

Future<Position> currentFix({bool requestPermission = true}) async {
  if (!await Geolocator.isLocationServiceEnabled())
    throw Exception('Turn on location services to use your current location.');
  var permission = await Geolocator.checkPermission();
  if (permission == LocationPermission.denied && requestPermission)
    permission = await Geolocator.requestPermission();
  if (permission == LocationPermission.denied ||
      permission == LocationPermission.deniedForever)
    throw Exception(
      'Location permission is off. You can still choose a pin manually.',
    );
  return Geolocator.getCurrentPosition(
    locationSettings: const LocationSettings(
      accuracy: LocationAccuracy.high,
      timeLimit: Duration(seconds: 15),
    ),
  );
}

const _mapGreen = Color(0xFF073B29);
const _mapGold = Color(0xFFB69B60);
const _mapCream = Color(0xFFFBF3E8);

/// Warms OpenStreetMap tiles slightly so the map sits comfortably in the cream
/// and green heritage design. Labels, roads and attribution stay readable.
const _warmTiles = ColorFilter.matrix([
  1, 0, 0, 0, 2, //
  0, .97, 0, 0, 2,
  0, 0, .88, 0, 0,
  0, 0, 0, 1, 0,
]);

class DeliveryMap extends StatelessWidget {
  final LatLng center;
  final List<Marker> markers;
  final List<LatLng> route;
  final void Function(LatLng)? onTap;
  final MapController? controller;
  const DeliveryMap({
    super.key,
    required this.center,
    this.markers = const [],
    this.route = const [],
    this.onTap,
    this.controller,
  });
  @override
  Widget build(BuildContext context) => FlutterMap(
    mapController: controller,
    options: MapOptions(
      initialCenter: center,
      initialZoom: 15,
      minZoom: 3,
      maxZoom: 19,
      onTap: (_, point) => onTap?.call(point),
    ),
    children: [
      TileLayer(
        urlTemplate: const String.fromEnvironment(
          'MAP_TILE_URL',
          defaultValue: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        ),
        userAgentPackageName: 'com.pistahouse.shankarpally.maps',
        tileBuilder: (context, tile, _) =>
            ColorFiltered(colorFilter: _warmTiles, child: tile),
      ),
      if (route.isNotEmpty)
        PolylineLayer(
          polylines: [
            Polyline(
              points: route,
              color: _mapGreen,
              strokeWidth: 5,
              borderColor: _mapCream,
              borderStrokeWidth: 2.5,
              strokeCap: StrokeCap.round,
              strokeJoin: StrokeJoin.round,
            ),
          ],
        ),
      MarkerLayer(markers: markers),
      Align(
        alignment: Alignment.bottomRight,
        child: Material(
          color: const Color(0xEEFBF3E8),
          borderRadius: const BorderRadius.only(topLeft: Radius.circular(8)),
          child: InkWell(
            onTap: () =>
                launchUrl(Uri.parse('https://www.openstreetmap.org/copyright')),
            child: const Padding(
              padding: EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              child: Text(
                '© OpenStreetMap contributors',
                style: TextStyle(fontSize: 10, color: _mapGreen),
              ),
            ),
          ),
        ),
      ),
    ],
  );
}

String _markerLabel(IconData icon) => icon == Icons.storefront_outlined
    ? 'Pista House outlet'
    : icon == Icons.delivery_dining
    ? 'Delivery partner location'
    : icon == Icons.location_on
    ? 'Selected delivery entrance'
    : 'Delivery destination';

/// A round badge marker, centred on its coordinate. When [pulse] is set a soft
/// ring radiates from it (used for a live rider); the ring is static when the
/// device asks for reduced motion.
Marker mapMarker(
  LatLng point,
  IconData icon,
  Color color, {
  bool pulse = false,
}) {
  if (icon == Icons.location_on) return _pinMarker(point, color);
  return Marker(
    point: point,
    width: pulse ? 84 : 48,
    height: pulse ? 84 : 48,
    child: _Badge(icon: icon, color: color, pulse: pulse),
  );
}

/// A teardrop pin whose tip sits exactly on the coordinate.
Marker _pinMarker(LatLng point, Color color) => Marker(
  point: point,
  width: 56,
  height: 64,
  alignment: Alignment.topCenter,
  child: Semantics(
    label: _markerLabel(Icons.location_on),
    image: true,
    child: Stack(
      alignment: Alignment.topCenter,
      children: [
        const Positioned(
          top: 0,
          child: Icon(Icons.location_on, size: 64, color: Colors.white),
        ),
        Positioned(
          top: 4,
          child: Icon(Icons.location_on, size: 56, color: color),
        ),
        Positioned(
          top: 17,
          child: Container(
            width: 14,
            height: 14,
            decoration: const BoxDecoration(
              color: _mapCream,
              shape: BoxShape.circle,
            ),
          ),
        ),
      ],
    ),
  ),
);

class _Badge extends StatefulWidget {
  final IconData icon;
  final Color color;
  final bool pulse;
  const _Badge({required this.icon, required this.color, required this.pulse});
  @override
  State<_Badge> createState() => _BadgeState();
}

class _BadgeState extends State<_Badge> with SingleTickerProviderStateMixin {
  late final ctl = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1800),
  );
  @override
  void initState() {
    super.initState();
    if (widget.pulse) ctl.repeat();
  }

  @override
  void didUpdateWidget(_Badge old) {
    super.didUpdateWidget(old);
    if (widget.pulse && !ctl.isAnimating) ctl.repeat();
    if (!widget.pulse && ctl.isAnimating) ctl.stop();
  }

  @override
  void dispose() {
    ctl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final still = MediaQuery.disableAnimationsOf(context);
    return Semantics(
      label: _markerLabel(widget.icon),
      image: true,
      child: Center(
        child: SizedBox(
          width: widget.pulse ? 84 : 48,
          height: widget.pulse ? 84 : 48,
          child: Stack(
            alignment: Alignment.center,
            children: [
              if (widget.pulse)
                AnimatedBuilder(
                  animation: ctl,
                  builder: (context, _) {
                    final t = still ? .5 : ctl.value;
                    return Container(
                      width: 48 + 36 * t,
                      height: 48 + 36 * t,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: widget.color.withValues(alpha: .28 * (1 - t)),
                      ),
                    );
                  },
                ),
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: widget.color,
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.white, width: 3),
                  boxShadow: const [
                    BoxShadow(
                      color: Color(0x33073B29),
                      blurRadius: 12,
                      offset: Offset(0, 3),
                    ),
                  ],
                ),
                child: ExcludeSemantics(
                  child: Icon(widget.icon, color: Colors.white, size: 25),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class AddressPinPage extends StatefulWidget {
  final LatLng? initial;
  final LatLng? outlet;
  final PistaApi? api;
  const AddressPinPage({super.key, this.initial, this.outlet, this.api});
  @override
  State<AddressPinPage> createState() => _AddressPinPageState();
}

class _AddressPinPageState extends State<AddressPinPage> {
  final controller = MapController();
  LatLng? selected;
  String? error;
  bool locating = false;
  bool searching = false;
  final search = TextEditingController();
  List<Map<String, dynamic>> places = [];
  @override
  void initState() {
    super.initState();
    selected = widget.initial;
  }

  @override
  void dispose() {
    controller.dispose();
    search.dispose();
    super.dispose();
  }

  Future<void> useCurrentLocation() async {
    setState(() => locating = true);
    try {
      final p = await currentFix();
      if (mounted) {
        setState(() {
          selected = LatLng(p.latitude, p.longitude);
          error = p.accuracy > 100
              ? 'Your location is approximate. Adjust the pin to your entrance.'
              : null;
        });
        controller.move(selected!, 17);
      }
    } catch (e) {
      if (mounted) setState(() => error = '$e');
    } finally {
      if (mounted) setState(() => locating = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: _mapCream,
    appBar: AppBar(
      title: const Text('Find your doorstep'),
      backgroundColor: _mapCream,
    ),
    body: Column(
      children: [
        Expanded(
          child: Stack(
            children: [
              DeliveryMap(
                controller: controller,
                center:
                    selected ?? widget.outlet ?? const LatLng(17.452, 78.128),
                markers: [
                  if (widget.outlet != null)
                    mapMarker(
                      widget.outlet!,
                      Icons.storefront_outlined,
                      _mapGold,
                    ),
                  if (selected != null)
                    mapMarker(selected!, Icons.location_on, _mapGreen),
                ],
                onTap: (point) => setState(() {
                  selected = point;
                  error = null;
                  places = [];
                }),
              ),
              if (widget.api != null)
                Positioned(
                  left: 14,
                  right: 14,
                  top: 12,
                  child: Column(
                    children: [
                      Material(
                        elevation: 5,
                        shadowColor: const Color(0x33073B29),
                        color: const Color(0xFFFDF8F0),
                        borderRadius: BorderRadius.circular(30),
                        child: Row(
                          children: [
                            Expanded(
                              child: TextField(
                                controller: search,
                                onTap: () => setState(() => places = []),
                                textInputAction: TextInputAction.search,
                                onSubmitted: (_) => searchPlaces(),
                                decoration: const InputDecoration(
                                  hintText: 'Search an area or landmark',
                                  prefixIcon: Icon(Icons.search),
                                  filled: false,
                                  border: InputBorder.none,
                                  enabledBorder: InputBorder.none,
                                  focusedBorder: InputBorder.none,
                                ),
                              ),
                            ),
                            Padding(
                              padding: const EdgeInsets.only(right: 6),
                              child: IconButton.filled(
                                tooltip: 'Search places',
                                style: IconButton.styleFrom(
                                  backgroundColor: _mapGreen,
                                ),
                                onPressed: searching ? null : searchPlaces,
                                icon: searching
                                    ? const SizedBox(
                                        width: 18,
                                        height: 18,
                                        child: CircularProgressIndicator(
                                          strokeWidth: 2,
                                          color: Colors.white,
                                        ),
                                      )
                                    : const Icon(Icons.arrow_forward),
                              ),
                            ),
                          ],
                        ),
                      ),
                      if (places.isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(top: 8),
                          child: Material(
                            elevation: 5,
                            shadowColor: const Color(0x33073B29),
                            color: const Color(0xFFFDF8F0),
                            borderRadius: BorderRadius.circular(20),
                            clipBehavior: Clip.antiAlias,
                            child: ConstrainedBox(
                              constraints: const BoxConstraints(maxHeight: 220),
                              child: ListView(
                                shrinkWrap: true,
                                padding: EdgeInsets.zero,
                                children: [
                                  for (final place in places)
                                    ListTile(
                                      dense: true,
                                      leading: const Icon(
                                        Icons.place_outlined,
                                        color: _mapGreen,
                                      ),
                                      title: Text(
                                        place['label'],
                                        maxLines: 2,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                      onTap: () {
                                        final point = mapPoint(place)!;
                                        FocusScope.of(context).unfocus();
                                        setState(() {
                                          selected = point;
                                          error = null;
                                          places = [];
                                        });
                                        controller.move(point, 16);
                                      },
                                    ),
                                ],
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              Positioned(
                right: 14,
                bottom: 28,
                child: FloatingActionButton.small(
                  heroTag: null,
                  tooltip: 'Use my current location',
                  elevation: 3,
                  shape: const CircleBorder(),
                  backgroundColor: const Color(0xFFFDF8F0),
                  foregroundColor: _mapGreen,
                  onPressed: locating ? null : useCurrentLocation,
                  child: locating
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.my_location),
                ),
              ),
            ],
          ),
        ),
        if (MediaQuery.viewInsetsOf(context).bottom == 0)
          Container(
            width: double.infinity,
            decoration: const BoxDecoration(
              color: _mapCream,
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
                padding: const EdgeInsets.fromLTRB(22, 20, 22, 18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Text(
                      'A little closer to home.',
                      style: TextStyle(
                        fontFamily: 'packages/pista_ui/HouseSerif',
                        fontSize: 26,
                        fontWeight: FontWeight.w600,
                        color: _mapGreen,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      selected == null
                          ? widget.outlet != null
                                ? 'The gold marker is our outlet. Tap your entrance on the map, then confirm.'
                                : 'Tap the map to mark your entrance.'
                          : 'Delivery pin: ${selected!.latitude.toStringAsFixed(5)}, ${selected!.longitude.toStringAsFixed(5)}',
                      style: const TextStyle(height: 1.4),
                    ),
                    if (error != null)
                      Padding(
                        padding: const EdgeInsets.only(top: 6),
                        child: Text(
                          error!,
                          style: const TextStyle(
                            color: Color(0xFF9B2C1F),
                            height: 1.4,
                          ),
                        ),
                      ),
                    const SizedBox(height: 14),
                    FilledButton(
                      style: FilledButton.styleFrom(
                        backgroundColor: _mapGreen,
                        minimumSize: const Size.fromHeight(52),
                      ),
                      onPressed: selected == null
                          ? null
                          : () => Navigator.pop(context, selected),
                      child: const Text('Deliver here'),
                    ),
                  ],
                ),
              ),
            ),
          ),
      ],
    ),
  );
  Future<void> searchPlaces() async {
    if (searching || widget.api == null) return;
    FocusScope.of(context).unfocus();
    setState(() {
      searching = true;
      error = null;
    });
    try {
      final data = await widget.api!.request(
        '/maps/search?q=${Uri.encodeQueryComponent(search.text.trim())}',
      );
      if (mounted)
        setState(() {
          places = (data['places'] as List)
              .map((p) => Map<String, dynamic>.from(p))
              .toList();
          if (places.isEmpty)
            error =
                'No matching areas found. Try a nearby landmark or choose a pin.';
        });
    } catch (e) {
      if (mounted) setState(() => error = '$e');
    } finally {
      if (mounted) setState(() => searching = false);
    }
  }
}

/// Keeps a rider marker moving between GPS fixes.
///
/// 1. It slides from the marker's current spot to each new real fix.
/// 2. If the rider was clearly moving (at least 1 m/s between the last two
///    fixes), it carries on in that direction for a few seconds until the next
///    fix arrives. This is dead reckoning: a short, bounded estimate, capped at
///    [maxDrift] seconds and [maxDriftMetres], and always corrected by the next
///    real fix. It is switched off when the device asks for reduced motion and
///    stops entirely if updates stop arriving.
class RiderGlide extends ChangeNotifier {
  RiderGlide(TickerProvider vsync)
    : _controller = AnimationController(
        vsync: vsync,
        duration: const Duration(milliseconds: _glideMs + _driftMs),
      ) {
    _controller.addListener(notifyListeners);
  }
  static const _glideMs = 3500, _driftMs = 4000;
  static const maxDrift = Duration(milliseconds: _driftMs);
  static const maxDriftMetres = 60.0;
  static const _minSpeed = 1.0, _maxSpeed = 28.0;
  final AnimationController _controller;
  LatLng? _from, _to;
  DateTime? _lastRecorded;
  // Degrees per millisecond of the last two real fixes.
  double _dLat = 0, _dLng = 0;

  double get _elapsedMs => _controller.value * (_glideMs + _driftMs);

  /// Whether the marker is currently past the last real fix on an estimate.
  bool get estimating =>
      _to != null && _elapsedMs > _glideMs && (_dLat != 0 || _dLng != 0);

  /// The marker position to draw right now.
  LatLng? get value {
    final to = _to;
    if (to == null) return null;
    final elapsed = _elapsedMs;
    final from = _from;
    if (from != null && elapsed < _glideMs) {
      final t = elapsed / _glideMs;
      return LatLng(
        from.latitude + (to.latitude - from.latitude) * t,
        from.longitude + (to.longitude - from.longitude) * t,
      );
    }
    if (_dLat == 0 && _dLng == 0 || elapsed <= _glideMs) return to;
    final ms = (elapsed - _glideMs).clamp(0, _driftMs).toDouble();
    final guess = LatLng(to.latitude + _dLat * ms, to.longitude + _dLng * ms);
    final moved = const Distance().as(LengthUnit.Meter, to, guess);
    if (moved <= maxDriftMetres) return guess;
    final k = maxDriftMetres / moved;
    return LatLng(
      to.latitude + (guess.latitude - to.latitude) * k,
      to.longitude + (guess.longitude - to.longitude) * k,
    );
  }

  /// Feeds a real GPS fix. [recordedAt] is when the phone took the fix.
  void moveTo(LatLng? point, {DateTime? recordedAt, bool animate = true}) {
    if (point == null) {
      _from = _to = null;
      _dLat = _dLng = 0;
      _lastRecorded = null;
      notifyListeners();
      return;
    }
    if (point == _to) return;
    final current = value, previous = _to, previousAt = _lastRecorded;
    _dLat = _dLng = 0;
    if (animate &&
        previous != null &&
        previousAt != null &&
        recordedAt != null) {
      final dt = recordedAt.difference(previousAt).inMilliseconds;
      if (dt >= 1000 && dt <= 20000) {
        final metres = const Distance().as(LengthUnit.Meter, previous, point);
        final speed = metres / (dt / 1000);
        if (speed >= _minSpeed && speed <= _maxSpeed) {
          _dLat = (point.latitude - previous.latitude) / dt;
          _dLng = (point.longitude - previous.longitude) / dt;
        }
      }
    }
    _lastRecorded = recordedAt;
    _to = point;
    if (!animate ||
        current == null ||
        const Distance().as(LengthUnit.Meter, current, point) > 800) {
      _from = null;
      _controller.value = _glideMs / (_glideMs + _driftMs);
      if (animate) _controller.forward();
      notifyListeners();
      return;
    }
    _from = current;
    _controller.forward(from: 0);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }
}
