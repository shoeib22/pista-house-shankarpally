import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:pista_core/pista_core.dart';
import 'map_widgets.dart';
import 'tracking_connection.dart';
import 'eta_card.dart';

const _green = Color(0xFF073B29);
const _gold = Color(0xFFB69B60);
const _cream = Color(0xFFFBF3E8);

/// A compact "where is the rider" view for outlet staff. It shows only the
/// rider's latest shared position, the outlet and the delivery pin. It has no
/// customer order summary, and it keeps no history of the rider's movements.
class RiderLocationPage extends StatefulWidget {
  final PistaApi api;
  final String orderId;
  const RiderLocationPage({
    super.key,
    required this.api,
    required this.orderId,
  });
  @override
  State<RiderLocationPage> createState() => _RiderLocationPageState();
}

class _RiderLocationPageState extends State<RiderLocationPage>
    with SingleTickerProviderStateMixin {
  late final live = TrackingConnection(widget.api, orderId: widget.orderId);
  late final glide = RiderGlide(this);
  final mapController = MapController();
  late final etaLoader = EtaLoader(widget.api, widget.orderId);
  Timer? timer;
  bool fitted = false;

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

  void _fit(List<LatLng> points) {
    if (points.length > 1) {
      mapController.fitCamera(
        CameraFit.bounds(
          bounds: LatLngBounds.fromPoints(points),
          padding: EdgeInsets.fromLTRB(
            55,
            60,
            55,
            MediaQuery.sizeOf(context).height * .3,
          ),
        ),
      );
    } else if (points.isNotEmpty) {
      mapController.move(points.first, 16);
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = live.snapshot;
    final rider = mapPoint(s?['location']),
        outlet = mapPoint(s?['outlet']),
        destination = mapPoint(s?['destination']);
    final seen = DateTime.tryParse('${s?['locationAt']}');
    final fresh =
        live.connected &&
        s?['fresh'] == true &&
        live.snapshotReceivedAt != null &&
        DateTime.now().difference(live.snapshotReceivedAt!).inSeconds < 10;
    final ago = seen == null ? null : DateTime.now().difference(seen);
    final sharing = s?['sharing'] == true;
    final name = s?['rider']?['name'];
    final headline = name == null ? 'No rider assigned' : '$name';
    final detail = s == null
        ? live.connected
              ? 'Loading the delivery…'
              : 'Connecting…'
        : rider == null
        ? sharing
              ? 'Waiting for the rider’s first GPS position.'
              : 'The rider has not started sharing a location.'
        : fresh
        ? 'Live now'
        : ago == null
        ? 'Position not live'
        : 'Last seen ${ago.inMinutes < 1 ? 'under a minute' : '${ago.inMinutes} min'} ago. Not live.';
    final anchor = rider ?? destination ?? outlet;
    return Scaffold(
      backgroundColor: _cream,
      appBar: AppBar(
        title: const Text('Rider location'),
        backgroundColor: _cream,
      ),
      body: Column(
        children: [
          Expanded(
            child: anchor == null
                ? const Center(
                    child: Padding(
                      padding: EdgeInsets.all(30),
                      child: Text(
                        'A map appears when the outlet, delivery pin or rider location is known.',
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
                            center: anchor,
                            markers: [
                              if (outlet != null)
                                mapMarker(
                                  outlet,
                                  Icons.storefront_outlined,
                                  _gold,
                                ),
                              if (destination != null)
                                mapMarker(
                                  destination,
                                  Icons.home_rounded,
                                  _green,
                                ),
                              if (shown != null)
                                mapMarker(
                                  shown,
                                  Icons.delivery_dining,
                                  fresh ? _gold : Colors.grey,
                                  pulse: fresh,
                                ),
                            ],
                          );
                        },
                      ),
                      Positioned(
                        right: 16,
                        top: 16,
                        child: IconButton.filledTonal(
                          tooltip: 'Show rider, outlet and delivery pin',
                          icon: const Icon(Icons.center_focus_strong),
                          onPressed: () => _fit([
                            if (rider != null) rider,
                            if (outlet != null) outlet,
                            if (destination != null) destination,
                          ]),
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
                    Row(
                      children: [
                        Icon(
                          fresh ? Icons.sensors : Icons.schedule,
                          color: fresh ? _green : Colors.brown,
                          size: 20,
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            headline,
                            style: const TextStyle(
                              fontFamily: 'packages/pista_ui/HouseSerif',
                              fontSize: 26,
                              fontWeight: FontWeight.w600,
                              color: _green,
                            ),
                          ),
                        ),
                        if (s?['number'] != null)
                          Text(
                            '#PH${s!['number'].toString().padLeft(4, '0')}',
                            style: const TextStyle(fontSize: 12),
                          ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(detail, style: const TextStyle(height: 1.4)),
                    if (live.error != null)
                      Padding(
                        padding: const EdgeInsets.only(top: 6),
                        child: Text(
                          live.error!,
                          style: const TextStyle(
                            fontSize: 12,
                            color: Colors.brown,
                          ),
                        ),
                      ),
                    if (etaLoader.available)
                      Padding(
                        padding: const EdgeInsets.only(top: 10),
                        child: Text(
                          'Customer arrival estimate: about ${etaRange(etaLoader.value!)}',
                          style: const TextStyle(fontWeight: FontWeight.w600),
                        ),
                      ),
                    const SizedBox(height: 6),
                    const Text(
                      'Shows the rider’s latest shared position only. No movement history is kept.',
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
}
