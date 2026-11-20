import 'package:pista_ui/pista_ui.dart';

class OwnerOrderActions extends StatefulWidget {
  final Map<String, dynamic> order;
  final List<Map<String, dynamic>> riders;
  final bool busy;
  final Future<void> Function(String, Map<String, dynamic>) send;
  const OwnerOrderActions({
    super.key,
    required this.order,
    required this.riders,
    required this.busy,
    required this.send,
  });
  @override
  State<OwnerOrderActions> createState() => _OwnerOrderActionsState();
}

class _OwnerOrderActionsState extends State<OwnerOrderActions> {
  String? selected;
  @override
  Widget build(BuildContext context) {
    final o = widget.order;
    final assignments = (o['assignments'] as List? ?? [])
        .where((a) => a['isActive'] == true)
        .toList();
    final a = assignments.isEmpty ? null : assignments.first as Map;
    final available = widget.riders
        .where((r) => r['riderAvailable'] == true)
        .toList();
    final action = {
      'awaiting_acceptance': 'accept',
      'accepted': 'prepare',
      'preparing': 'ready',
    }[o['status']];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (action != null && o['paymentStatus'] == 'paid')
          FilledButton(
            onPressed: widget.busy
                ? null
                : () => widget.send('/orders/${o['id']}/actions', {
                    'action': action,
                    'version': o['version'],
                  }),
            child: Text(
              {
                'accept': 'Accept order',
                'prepare': 'Start preparing',
                'ready': 'Mark ready',
              }[action]!,
            ),
          ),
        if (o['status'] == 'ready' && o['fulfilment'] == 'pickup')
          FilledButton(
            onPressed: widget.busy
                ? null
                : () => widget.send('/orders/${o['id']}/actions', {
                    'action': 'collect',
                    'version': o['version'],
                  }),
            child: const Text('Confirm pickup collection'),
          ),
        if (o['fulfilment'] == 'delivery' &&
            o['status'] == 'ready' &&
            a == null) ...[
          DropdownButton<String>(
            isExpanded: true,
            value: available.any((r) => r['id'] == selected) ? selected : null,
            hint: const Text('Choose online rider'),
            items: available
                .map(
                  (r) => DropdownMenuItem<String>(
                    value: r['id'],
                    child: Text(r['name']),
                  ),
                )
                .toList(),
            onChanged: widget.busy
                ? null
                : (value) => setState(() => selected = value),
          ),
          FilledButton(
            onPressed: widget.busy || !available.any((r) => r['id'] == selected)
                ? null
                : () => widget.send('/orders/${o['id']}/assignment', {
                    'riderId': selected,
                    'version': o['version'],
                  }),
            child: const Text('Assign rider'),
          ),
          if (available.isEmpty)
            const Text(
              'No riders are online.',
              style: TextStyle(fontSize: 12, color: Colors.black54),
            ),
        ],
        if (a != null)
          Text(
            '${a['rider']['name']} · ${a['status']}',
            style: const TextStyle(color: pistaGreen),
          ),
        if (a?['status'] == 'assigned')
          TextButton(
            onPressed: widget.busy
                ? null
                : () => widget.send('/assignments/${a!['id']}/staff-actions', {
                    'action': 'unassign',
                    'version': a['version'],
                  }),
            child: const Text('Unassign rider'),
          ),
        if (a?['status'] == 'failed') ...[
          Text(
            '${a!['failureReason']}\nPayment remains paid. Resolve with the outlet.',
            style: const TextStyle(height: 1.6, color: Color(0xFF956233)),
          ),
          OutlinedButton(
            onPressed: widget.busy
                ? null
                : () async {
                    final confirmed = await showDialog<bool>(
                      context: context,
                      builder: (context) => AlertDialog(
                        title: const Text('Order returned?'),
                        content: const Text(
                          'Confirm only after the order has physically returned to the outlet. This makes it available for reassignment.',
                        ),
                        actions: [
                          TextButton(
                            onPressed: () => Navigator.pop(context, false),
                            child: const Text('Cancel'),
                          ),
                          FilledButton(
                            onPressed: () => Navigator.pop(context, true),
                            child: const Text('Confirm return'),
                          ),
                        ],
                      ),
                    );
                    if (confirmed == true) {
                      await widget.send(
                        '/assignments/${a['id']}/staff-actions',
                        {'action': 'confirm_return', 'version': a['version']},
                      );
                    }
                  },
            child: const Text('Confirm return to outlet'),
          ),
        ],
      ],
    );
  }
}
