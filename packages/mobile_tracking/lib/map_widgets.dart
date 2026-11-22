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
      ),
      if (route.isNotEmpty)
        PolylineLayer(
          polylines: [
            Polyline(points: route, color: pistaGreen, strokeWidth: 5),
          ],
        ),
      MarkerLayer(markers: markers),
      Align(
        alignment: Alignment.bottomRight,
        child: Material(
          color: const Color(0xEEFBF3E8),
          child: InkWell(
            onTap: () =>
                launchUrl(Uri.parse('https://www.openstreetmap.org/copyright')),
            child: const Padding(
              padding: EdgeInsets.symmetric(horizontal: 7, vertical: 4),
              child: Text(
                '© OpenStreetMap contributors',
                style: TextStyle(fontSize: 10, color: pistaGreen),
              ),
            ),
          ),
        ),
      ),
    ],
  );
}

Marker mapMarker(LatLng point, IconData icon, Color color) => Marker(
  point: point,
  width: 48,
  height: 48,
  child: Container(
    decoration: BoxDecoration(
      color: color,
      shape: BoxShape.circle,
      border: Border.all(color: Colors.white, width: 3),
      boxShadow: const [BoxShadow(color: Color(0x2217613B), blurRadius: 12)],
    ),
    child: Icon(
      icon,
      color: Colors.white,
      size: 25,
      semanticLabel: icon == Icons.storefront_outlined
          ? 'Pista House outlet'
          : icon == Icons.delivery_dining
          ? 'Delivery partner location'
          : icon == Icons.location_on
          ? 'Selected delivery entrance'
          : 'Delivery destination',
    ),
  ),
);

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

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Find your doorstep')),
    body: Column(
      children: [
        if (widget.api != null)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
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
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton.filled(
                  tooltip: 'Search places',
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
              ],
            ),
          ),
        if (places.isNotEmpty)
          ConstrainedBox(
            constraints: const BoxConstraints(maxHeight: 150),
            child: ListView(
              shrinkWrap: true,
              children: [
                for (final place in places)
                  ListTile(
                    dense: true,
                    leading: const Icon(
                      Icons.place_outlined,
                      color: pistaGreen,
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
        Expanded(
          child: DeliveryMap(
            controller: controller,
            center: selected ?? widget.outlet ?? const LatLng(17.452, 78.128),
            markers: [
              if (widget.outlet != null)
                mapMarker(
                  widget.outlet!,
                  Icons.storefront_outlined,
                  const Color(0xFFB08844),
                ),
              if (selected != null)
                mapMarker(selected!, Icons.location_on, pistaGreen),
            ],
            onTap: (point) => setState(() {
              selected = point;
              error = null;
            }),
          ),
        ),
        if (MediaQuery.viewInsetsOf(context).bottom == 0)
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.all(22),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text(
                    'A little closer to home.',
                    style: TextStyle(
                      fontFamily: 'packages/pista_ui/HouseSerif',
                      fontSize: 26,
                      color: pistaGreen,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    selected == null
                        ? widget.outlet != null
                              ? 'The gold marker is our outlet. Tap your entrance, then confirm.'
                              : 'Tap the map to mark your entrance.'
                        : 'Delivery pin: ${selected!.latitude.toStringAsFixed(5)}, ${selected!.longitude.toStringAsFixed(5)}',
                  ),
                  if (error != null)
                    Text(error!, style: const TextStyle(color: Colors.red)),
                  TextButton.icon(
                    icon: const Icon(Icons.my_location),
                    label: Text(
                      locating ? 'Finding you…' : 'Use my current location',
                    ),
                    onPressed: locating
                        ? null
                        : () async {
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
                          },
                  ),
                  FilledButton(
                    onPressed: selected == null
                        ? null
                        : () => Navigator.pop(context, selected),
                    child: const Text('Deliver here'),
                  ),
                ],
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
