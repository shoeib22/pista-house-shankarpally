import 'dart:async';
import 'package:pista_core/pista_core.dart';
import 'package:pista_ui/pista_ui.dart';
import 'map_widgets.dart';
import 'tracking_connection.dart';
import 'eta_card.dart';
import 'package:flutter_map/flutter_map.dart';

const _green = Color(0xFF073B29);
const _cream = Color(0xFFFBF3E8);

class LiveTrackingPage extends StatefulWidget {
  final PistaApi api;
  final String orderId;
  const LiveTrackingPage({super.key, required this.api, required this.orderId});
  @override
  State<LiveTrackingPage> createState() => _LiveTrackingPageState();
}

class _LiveTrackingPageState extends State<LiveTrackingPage>
    with SingleTickerProviderStateMixin {
  late final live = TrackingConnection(widget.api, orderId: widget.orderId);
  late final glide = RiderGlide(this);
  final mapController = MapController();
  Map<String, dynamic>? route;
  Timer? timer;
  bool loadingRoute = false;
  bool fitted = false;
  DateTime? routeAt;
  late final etaLoader = EtaLoader(widget.api, widget.orderId);
  @override
  void initState() {
    super.initState();
    live.addListener(update);
    live.connect();
    timer = Timer.periodic(const Duration(seconds: 5), (_) => update());
  }

  void update() {
    if (!mounted) return;
    glide.moveTo(
      mapPoint(live.snapshot?['location']),
      recordedAt: DateTime.tryParse(
        '${live.snapshot?['location']?['recordedAt']}',
      ),
      animate: !MediaQuery.disableAnimationsOf(context),
    );
    setState(() {});
    if (live.connected && live.snapshot != null) {
      etaLoader.refresh(() {
        if (mounted) setState(() {});
      });
    }
    final s = live.snapshot;
    if (s?['fresh'] == true &&
        live.connected &&
        (routeAt == null ||
            DateTime.now().difference(routeAt!).inSeconds >= 30))
      loadRoute();
  }

  Future<void> loadRoute() async {
    if (loadingRoute) return;
    loadingRoute = true;
    routeAt = DateTime.now();
    try {
      final data = await widget.api.request('/orders/${widget.orderId}/route');
      if (mounted) setState(() => route = Map<String, dynamic>.from(data));
      if (mounted && data['available'] == true && !fitted) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (!mounted) return;
          final all = (data['coordinates'] as List)
              .map(
                (p) =>
                    LatLng((p[1] as num).toDouble(), (p[0] as num).toDouble()),
              )
              .toList();
          final outlet = mapPoint(live.snapshot?['outlet']);
          if (outlet != null) all.add(outlet);
          if (all.length > 1) {
            mapController.fitCamera(
              CameraFit.bounds(
                bounds: LatLngBounds.fromPoints(all),
                padding: EdgeInsets.fromLTRB(
                  45,
                  90,
                  45,
                  MediaQuery.sizeOf(context).height * .48,
                ),
              ),
            );
            fitted = true;
          }
        });
      }
    } catch (_) {
      if (mounted) setState(() => route = null);
    } finally {
      loadingRoute = false;
    }
  }

  @override
  void dispose() {
    timer?.cancel();
    live.removeListener(update);
    live.dispose();
    glide.dispose();
    mapController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final s = live.snapshot,
        destination = mapPoint(s?['destination']),
        rider = mapPoint(s?['location']),
        outlet = mapPoint(s?['outlet']);
    final received = DateTime.tryParse('${s?['locationAt']}');
    final fresh =
        live.connected &&
        s?['fresh'] == true &&
        live.snapshotReceivedAt != null &&
        DateTime.now().difference(live.snapshotReceivedAt!).inSeconds < 10;
    final status = '${s?['status'] ?? 'connecting'}';
    final terminal = [
      'delivered',
      'collected',
      'cancelled',
      'rejected',
      'delivery_failed',
    ].contains(status);
    final hasRoute = fresh && route?['available'] == true;
    final points = hasRoute
        ? (route!['coordinates'] as List)
              .map(
                (p) =>
                    LatLng((p[1] as num).toDouble(), (p[0] as num).toDouble()),
              )
              .toList()
        : <LatLng>[];
    final heading = terminal
        ? (status == 'delivered' ? 'Enjoy every bite.' : 'Delivery update')
        : status == 'out_for_delivery'
        ? 'Good food is on its way.'
        : status == 'ready'
        ? 'Packed with care.'
        : 'A little patience. A lot of flavour.';
    return Scaffold(
      backgroundColor: _cream,
      appBar: AppBar(
        title: const Text('Track your order'),
        backgroundColor: _cream,
      ),
      body: Stack(
        children: [
          Positioned.fill(
            child: destination == null && rider == null && outlet == null
                ? Container(
                    color: pistaIvory,
                    alignment: Alignment.center,
                    child: const Padding(
                      padding: EdgeInsets.all(30),
                      child: Text(
                        'A map appears when your order has a delivery pin or the rider shares a location.',
                        textAlign: TextAlign.center,
                      ),
                    ),
                  )
                : Stack(
                    children: [
                      ListenableBuilder(
                        listenable: glide,
                        builder: (context, _) {
                          final shown = glide.value ?? rider;
                          return DeliveryMap(
                            controller: mapController,
                            center: destination ?? rider ?? outlet!,
                            route: points,
                            markers: [
                              if (outlet != null)
                                mapMarker(
                                  outlet,
                                  Icons.storefront_outlined,
                                  const Color(0xFFB69B60),
                                ),
                              if (destination != null)
                                mapMarker(
                                  destination,
                                  Icons.home_rounded,
                                  _green,
                                ),
                              if (shown != null && !terminal)
                                mapMarker(
                                  shown,
                                  Icons.delivery_dining,
                                  fresh ? const Color(0xFFB69B60) : Colors.grey,
                                  pulse: fresh,
                                ),
                            ],
                          );
                        },
                      ),
                      Positioned(
                        left: 16,
                        top: 16,
                        child: Material(
                          elevation: 4,
                          shadowColor: const Color(0x33073B29),
                          color: const Color(0xFFFDF8F0),
                          borderRadius: BorderRadius.circular(24),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 14,
                              vertical: 9,
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(
                                  terminal
                                      ? Icons.check_circle_outline
                                      : fresh
                                      ? Icons.sensors
                                      : Icons.schedule,
                                  size: 18,
                                  color: fresh || terminal
                                      ? _green
                                      : Colors.brown,
                                ),
                                const SizedBox(width: 8),
                                Text(
                                  terminal
                                      ? status.replaceAll('_', ' ')
                                      : etaLoader.available
                                      ? etaRange(etaLoader.value!)
                                      : hasRoute
                                      ? '${((route!['durationSeconds'] as num) / 60).ceil()} min · ${((route!['distanceMetres'] as num) / 1000).toStringAsFixed(1)} km'
                                      : fresh
                                      ? 'Live'
                                      : live.connected
                                      ? 'Waiting for rider'
                                      : 'Reconnecting…',
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w700,
                                    color: _green,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                      Positioned(
                        right: 16,
                        top: 16,
                        child: IconButton.filledTonal(
                          tooltip: 'Show full delivery route',
                          icon: const Icon(Icons.center_focus_strong),
                          onPressed: () {
                            final markers = [
                              ...points,
                              if (outlet != null) outlet,
                              if (destination != null) destination,
                              if (rider != null) rider,
                            ];
                            if (markers.length > 1) {
                              mapController.fitCamera(
                                CameraFit.bounds(
                                  bounds: LatLngBounds.fromPoints(markers),
                                  padding: EdgeInsets.fromLTRB(
                                    55,
                                    90,
                                    55,
                                    MediaQuery.sizeOf(context).height * .48,
                                  ),
                                ),
                              );
                            } else if (markers.isNotEmpty) {
                              mapController.move(markers.first, 16);
                            }
                          },
                        ),
                      ),
                    ],
                  ),
          ),
          DraggableScrollableSheet(
            initialChildSize: .44,
            minChildSize: .2,
            maxChildSize: .92,
            snap: true,
            builder: (context, scroll) => SingleChildScrollView(
              controller: scroll,
              child: SafeArea(
                top: false,
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(22),
                  decoration: const BoxDecoration(
                    color: _cream,
                    borderRadius: BorderRadius.vertical(
                      top: Radius.circular(28),
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: Color(0x28073B29),
                        blurRadius: 20,
                        offset: Offset(0, -4),
                      ),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Center(
                        child: Container(
                          width: 42,
                          height: 4,
                          margin: const EdgeInsets.only(bottom: 16),
                          decoration: BoxDecoration(
                            color: const Color(0xFFD5CCBA),
                            borderRadius: BorderRadius.circular(2),
                          ),
                        ),
                      ),
                      Text(
                        heading,
                        style: const TextStyle(
                          fontFamily: 'packages/pista_ui/HouseSerif',
                          fontSize: 29,
                          height: 1.12,
                          color: pistaGreen,
                        ),
                      ),
                      const SizedBox(height: 14),
                      Row(
                        children: [
                          Icon(
                            fresh ? Icons.sensors : Icons.schedule,
                            color: fresh ? pistaGreen : Colors.brown,
                            size: 18,
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              terminal
                                  ? status.replaceAll('_', ' ')
                                  : fresh
                                  ? 'Live location connected'
                                  : live.connected
                                  ? 'Waiting for a fresh rider location'
                                  : 'Connection interrupted. Reconnecting…',
                              style: const TextStyle(
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ],
                      ),
                      if (s?['rider'] != null)
                        Padding(
                          padding: const EdgeInsets.only(top: 12),
                          child: Text(
                            '${s!['rider']['name']} · Your delivery partner',
                          ),
                        ),
                      if (etaLoader.available && !terminal)
                        Padding(
                          padding: const EdgeInsets.only(top: 12),
                          child: EtaCard(eta: etaLoader.value!),
                        ),
                      if (hasRoute && !etaLoader.available)
                        Padding(
                          padding: const EdgeInsets.only(top: 8),
                          child: Text(
                            'About ${((route!['durationSeconds'] as num) / 60).ceil()} min travel · ${((route!['distanceMetres'] as num) / 1000).toStringAsFixed(1)} km\nEstimate excludes traffic and preparation time.',
                            style: const TextStyle(height: 1.5),
                          ),
                        ),
                      if (!hasRoute && !terminal && !etaLoader.available)
                        const Padding(
                          padding: EdgeInsets.only(top: 10),
                          child: Text(
                            'Arrival time appears when fresh location and road routing are available.',
                            style: TextStyle(
                              color: Colors.black54,
                              fontSize: 12,
                            ),
                          ),
                        ),
                      if (fresh && !terminal)
                        const Padding(
                          padding: EdgeInsets.only(top: 8),
                          child: Text(
                            'Between GPS updates the marker\u2019s movement is smoothed and estimated.',
                            style: TextStyle(
                              fontSize: 11,
                              color: Colors.black54,
                            ),
                          ),
                        ),
                      if (received != null && !fresh && !terminal)
                        Padding(
                          padding: const EdgeInsets.only(top: 8),
                          child: Text(
                            'Last position ${DateTime.now().difference(received).inMinutes} min ago. The marker is not live.',
                            style: const TextStyle(
                              color: Colors.brown,
                              fontSize: 12,
                            ),
                          ),
                        ),
                      const SizedBox(height: 18),
                      _journey(status),
                      const SizedBox(height: 18),
                      if (s != null) ...[
                        Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFFFAF3),
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(color: const Color(0xFFE1D4BC)),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  const Expanded(
                                    child: Text(
                                      'Order summary',
                                      style: TextStyle(
                                        fontSize: 17,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ),
                                  Text(
                                    '#PH${s['number'].toString().padLeft(4, '0')}',
                                    style: const TextStyle(fontSize: 11),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 10),
                              for (final item in (s['items'] as List? ?? []))
                                Padding(
                                  padding: const EdgeInsets.only(bottom: 7),
                                  child: Row(
                                    children: [
                                      Expanded(
                                        child: Text(
                                          '${item['name']} × ${item['quantity']}',
                                          style: const TextStyle(fontSize: 12),
                                        ),
                                      ),
                                      if (item['unitPaise'] is num)
                                        Text(
                                          rupees(
                                            (item['unitPaise'] as num).toInt() *
                                                (item['quantity'] as num)
                                                    .toInt(),
                                          ),
                                          style: const TextStyle(fontSize: 12),
                                        ),
                                    ],
                                  ),
                                ),
                              const SizedBox(height: 7),
                              Row(
                                children: [
                                  const Expanded(
                                    child: Text(
                                      'Delivery fee',
                                      style: TextStyle(fontSize: 12),
                                    ),
                                  ),
                                  Text(
                                    rupees(
                                      (s['deliveryPaise'] as num? ?? 0).toInt(),
                                    ),
                                    style: const TextStyle(fontSize: 12),
                                  ),
                                ],
                              ),
                              if ((s['taxPaise'] as num? ?? 0) > 0)
                                Padding(
                                  padding: const EdgeInsets.only(top: 8),
                                  child: Row(
                                    children: [
                                      const Expanded(
                                        child: Text(
                                          'Tax',
                                          style: TextStyle(fontSize: 12),
                                        ),
                                      ),
                                      Text(
                                        rupees((s['taxPaise'] as num).toInt()),
                                        style: const TextStyle(fontSize: 12),
                                      ),
                                    ],
                                  ),
                                ),
                              const Divider(),
                              Row(
                                children: [
                                  const Expanded(
                                    child: Text(
                                      'Total',
                                      style: TextStyle(
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ),
                                  Text(
                                    rupees(
                                      (s['totalPaise'] as num? ?? 0).toInt(),
                                    ),
                                    style: const TextStyle(
                                      color: pistaGreen,
                                      fontWeight: FontWeight.w700,
                                      fontSize: 20,
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 18),
                      ],
                      if (live.error != null)
                        Padding(
                          padding: const EdgeInsets.only(top: 10),
                          child: Text(
                            live.error!,
                            style: const TextStyle(
                              fontSize: 12,
                              color: Colors.brown,
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _journey(String status) {
    final index = status == 'delivered'
        ? 3
        : status == 'out_for_delivery' || status == 'delivery_failed'
        ? 2
        : ['accepted', 'preparing', 'ready'].contains(status)
        ? 1
        : 0;
    final icons = [
      Icons.check_rounded,
      Icons.ramen_dining_outlined,
      Icons.delivery_dining,
      Icons.home_outlined,
    ];
    final labels = ['Order placed', 'Preparing', 'On the way', 'Delivered'];
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (var i = 0; i < 4; i++)
          Expanded(
            child: Column(
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Container(
                        height: 1,
                        color: i == 0
                            ? Colors.transparent
                            : i <= index
                            ? pistaGreen
                            : const Color(0xFFD5CCBA),
                      ),
                    ),
                    Container(
                      width: 34,
                      height: 34,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: i <= index
                            ? pistaGreen
                            : const Color(0xFFECE1CF),
                        border: Border.all(
                          color: const Color(0xFFFAF3E7),
                          width: 2,
                        ),
                        boxShadow: const [
                          BoxShadow(color: Color(0x1517613B), blurRadius: 8),
                        ],
                      ),
                      child: Icon(
                        icons[i],
                        size: 18,
                        color: i <= index
                            ? const Color(0xFFFFF7E9)
                            : const Color(0xFF9A8A6B),
                      ),
                    ),
                    Expanded(
                      child: Container(
                        height: 1,
                        color: i == 3
                            ? Colors.transparent
                            : i < index
                            ? pistaGreen
                            : const Color(0xFFD5CCBA),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  labels[i],
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 10,
                    color: i <= index ? pistaGreen : Colors.black45,
                    fontWeight: i == index ? FontWeight.w700 : FontWeight.w400,
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}
