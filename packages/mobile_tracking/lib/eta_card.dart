import 'package:flutter/material.dart';
import 'package:pista_core/pista_core.dart';

const _green = Color(0xFF073B29);
const _gold = Color(0xFFB69B60);

/// Fetches the staged delivery estimate at most every [every], without
/// overlapping requests. A failed request simply keeps the previous value off
/// the screen: no estimate is better than a wrong one.
class EtaLoader {
  EtaLoader(this.api, this.orderId, {this.every = const Duration(seconds: 30)});
  final PistaApi api;
  final String orderId;
  final Duration every;
  Map<String, dynamic>? value;
  DateTime? _at;
  bool _loading = false;

  bool get available => value?['available'] == true;

  Future<void> refresh(VoidCallback changed) async {
    if (_loading || (_at != null && DateTime.now().difference(_at!) < every)) {
      return;
    }
    _loading = true;
    _at = DateTime.now();
    try {
      final data = await api.request('/orders/$orderId/eta');
      value = data is Map ? Map<String, dynamic>.from(data) : null;
    } catch (_) {
      value = null;
    } finally {
      _loading = false;
      changed();
    }
  }
}

String etaRange(Map<String, dynamic> eta) {
  final low = (eta['minutesLow'] as num).toInt(),
      high = (eta['minutesHigh'] as num).toInt();
  return low == high ? '$low min' : '$low–$high min';
}

/// The estimate as a range with the stages behind it, labelled honestly.
class EtaCard extends StatelessWidget {
  final Map<String, dynamic> eta;
  const EtaCard({super.key, required this.eta});
  @override
  Widget build(BuildContext context) {
    final stages = (eta['stages'] as List? ?? [])
        .map((s) => Map<String, dynamic>.from(s as Map))
        .toList();
    final rough = eta['confidence'] != 'history';
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFFFFAF3),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFE1D4BC)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Estimated arrival', style: TextStyle(fontSize: 12)),
          const SizedBox(height: 2),
          Text(
            'About ${etaRange(eta)}',
            style: const TextStyle(
              fontFamily: 'packages/pista_ui/HouseSerif',
              fontSize: 30,
              fontWeight: FontWeight.w600,
              color: _green,
            ),
          ),
          const SizedBox(height: 10),
          for (final stage in stages)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Row(
                children: [
                  Icon(
                    switch (stage['key']) {
                      'prep' => Icons.ramen_dining_outlined,
                      'assign' => Icons.person_search_outlined,
                      'pickup' => Icons.storefront_outlined,
                      'travel' => Icons.delivery_dining,
                      _ => Icons.home_outlined,
                    },
                    size: 18,
                    color: _gold,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      '${stage['label']}',
                      style: const TextStyle(fontSize: 13),
                    ),
                  ),
                  Text(
                    '~${stage['minutes']} min',
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
          const SizedBox(height: 8),
          Text(
            rough
                ? 'A rough estimate: some steps use typical times until the outlet has enough recent orders. Not traffic-aware.'
                : 'Based on this outlet’s recent orders and road distance. Not traffic-aware.',
            style: const TextStyle(
              fontSize: 11,
              height: 1.4,
              color: Colors.black54,
            ),
          ),
        ],
      ),
    );
  }
}
