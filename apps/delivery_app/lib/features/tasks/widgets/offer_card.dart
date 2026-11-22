import 'dart:async';
import 'package:pista_ui/pista_ui.dart';

/// A time-limited delivery offer from auto-dispatch. It deliberately shows only
/// the area, distance and item count: the customer's name, phone and address
/// are revealed after the rider accepts.
class OfferCard extends StatefulWidget {
  final Map<String, dynamic> offer;
  final Duration clockSkew;
  final bool busy;
  final VoidCallback onAccept, onDecline;
  const OfferCard({
    super.key,
    required this.offer,
    required this.clockSkew,
    required this.busy,
    required this.onAccept,
    required this.onDecline,
  });
  @override
  State<OfferCard> createState() => _OfferCardState();
}

class _OfferCardState extends State<OfferCard> {
  Timer? tick;
  @override
  void initState() {
    super.initState();
    tick = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    tick?.cancel();
    super.dispose();
  }

  Duration get left {
    final ends = DateTime.tryParse('${widget.offer['expiresAt']}');
    if (ends == null) return Duration.zero;
    final now = DateTime.now().add(widget.clockSkew);
    final d = ends.difference(now);
    return d.isNegative ? Duration.zero : d;
  }

  @override
  Widget build(BuildContext context) {
    final order = Map<String, dynamic>.from(widget.offer['order'] as Map);
    final seconds = left.inSeconds;
    final expired = seconds <= 0;
    final km = order['distanceKm'];
    final items = (order['itemCount'] as num?)?.toInt() ?? 0;
    return Container(
      margin: const EdgeInsets.only(bottom: 22),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: const Color(0xFFFFFAF3),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: const Color(0xFFB69B60), width: 1.4),
        boxShadow: const [
          BoxShadow(
            color: Color(0x22073B29),
            blurRadius: 16,
            offset: Offset(0, 5),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              const Icon(Icons.delivery_dining, color: pistaGreen),
              const SizedBox(width: 8),
              const Expanded(
                child: Text(
                  'New delivery offer',
                  style: TextStyle(
                    fontFamily: 'packages/pista_ui/HouseSerif',
                    fontSize: 24,
                    fontWeight: FontWeight.w600,
                    color: pistaGreen,
                  ),
                ),
              ),
              Text(
                expired ? 'Expired' : '${seconds}s',
                semanticsLabel: expired
                    ? 'Offer expired'
                    : '$seconds seconds left',
                style: TextStyle(
                  fontWeight: FontWeight.w700,
                  color: seconds <= 8 ? const Color(0xFF9B2C1F) : pistaGreen,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            '#PH${'${order['number']}'.padLeft(4, '0')} · $items ${items == 1 ? 'item' : 'items'}',
            style: const TextStyle(fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 4),
          Text('Pick up: ${order['pickup']}'),
          Text(
            'Deliver to: ${(order['area'] as String?)?.isNotEmpty == true ? order['area'] : 'Area shared after accepting'}',
          ),
          if (km != null) Text('About $km km from the outlet'),
          const SizedBox(height: 6),
          const Text(
            'Customer name, phone and address are shown after you accept.',
            style: TextStyle(fontSize: 11, color: Colors.black54),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: widget.busy ? null : widget.onDecline,
                  child: const Text('Decline'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                flex: 2,
                child: FilledButton(
                  onPressed: widget.busy || expired ? null : widget.onAccept,
                  child: const Text('Accept delivery'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
