import 'package:pista_ui/pista_ui.dart';
import 'package:pista_core/pista_core.dart';

const audienceLabels = {
  'all': 'All customers',
  'recent': 'Ordered in the last 2 weeks',
  'lapsed': 'Not ordered for 2 weeks to 3 months',
};

/// Offers the owner writes and sends, plus how customers have rated orders.
/// An offer says exactly what is typed here. Only customers who opted in to
/// promotions receive it, and the server limits three offers a day.
class OffersPage extends StatefulWidget {
  final PistaApi api;
  const OffersPage({super.key, required this.api});
  @override
  State<OffersPage> createState() => _OffersPageState();
}

class _OffersPageState extends State<OffersPage> {
  List<Map<String, dynamic>> offers = [];
  Map<String, dynamic>? ratings;
  final title = TextEditingController(), body = TextEditingController();
  String audience = 'all';
  String when = 'now';
  bool busy = false, loaded = false;
  String? error;

  @override
  void initState() {
    super.initState();
    load();
  }

  @override
  void dispose() {
    title.dispose();
    body.dispose();
    super.dispose();
  }

  Future<void> load() async {
    try {
      final r = await Future.wait([
        widget.api.request('/offers'),
        widget.api.request('/ratings/summary'),
      ]);
      if (!mounted) return;
      setState(() {
        offers = (r[0] as List)
            .map((e) => Map<String, dynamic>.from(e as Map))
            .toList();
        ratings = Map<String, dynamic>.from(r[1] as Map);
        loaded = true;
        error = null;
      });
    } catch (e) {
      if (mounted) {
        setState(() {
          error = '$e';
          loaded = true;
        });
      }
    }
  }

  DateTime? get startsAt => switch (when) {
    'hour' => DateTime.now().add(const Duration(hours: 1)),
    'tomorrow' => DateTime.now().add(const Duration(days: 1)),
    _ => null,
  };

  Future<void> send() async {
    if (title.text.trim().length < 3 || body.text.trim().length < 5) {
      setState(() => error = 'Add a title and a short message.');
      return;
    }
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await widget.api.request(
        '/offers',
        method: 'POST',
        body: {
          'title': title.text.trim(),
          'body': body.text.trim(),
          'audience': audience,
          if (startsAt != null) 'startsAt': startsAt!.toUtc().toIso8601String(),
        },
      );
      title.clear();
      body.clear();
      await load();
    } catch (e) {
      if (mounted) setState(() => error = '$e');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> cancel(String id) async {
    try {
      await widget.api.request('/offers/$id/cancel', method: 'POST');
      await load();
    } catch (e) {
      if (mounted) setState(() => error = '$e');
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Offers and ratings')),
    body: RefreshIndicator(
      onRefresh: load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (error != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Text(error!, style: const TextStyle(color: Colors.red)),
            ),
          if (ratings != null) _ratings(),
          const SizedBox(height: 16),
          const Text(
            'Write an offer',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 4),
          const Text(
            'Customers who turned on offers get it as written. Quiet hours are respected.',
            style: TextStyle(fontSize: 12, color: Colors.black54),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: title,
            maxLength: 60,
            decoration: const InputDecoration(labelText: 'Title'),
          ),
          TextField(
            controller: body,
            maxLength: 160,
            maxLines: 2,
            decoration: const InputDecoration(labelText: 'Message'),
          ),
          DropdownButtonFormField<String>(
            initialValue: audience,
            decoration: const InputDecoration(labelText: 'Who'),
            items: [
              for (final e in audienceLabels.entries)
                DropdownMenuItem(value: e.key, child: Text(e.value)),
            ],
            onChanged: (v) => setState(() => audience = v ?? 'all'),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            children: [
              for (final e in {
                'now': 'Send now',
                'hour': 'In 1 hour',
                'tomorrow': 'Tomorrow',
              }.entries)
                ChoiceChip(
                  label: Text(e.value),
                  selected: when == e.key,
                  onSelected: (_) => setState(() => when = e.key),
                ),
            ],
          ),
          const SizedBox(height: 12),
          FilledButton(
            onPressed: busy ? null : send,
            child: Text(busy ? 'Saving…' : 'Send offer'),
          ),
          const SizedBox(height: 20),
          const Text(
            'Your offers',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
          ),
          if (loaded && offers.isEmpty)
            const Padding(
              padding: EdgeInsets.all(12),
              child: Text('No offers yet.'),
            ),
          for (final o in offers)
            Card(
              key: ValueKey('offer-${o['id']}'),
              child: ListTile(
                title: Text('${o['title']}'),
                subtitle: Text(
                  '${o['body']}\n${audienceLabels[o['audience']] ?? o['audience']} · ${_status(o)}',
                ),
                isThreeLine: true,
                trailing: o['status'] == 'scheduled'
                    ? TextButton(
                        onPressed: () => cancel('${o['id']}'),
                        child: const Text('Cancel'),
                      )
                    : null,
              ),
            ),
        ],
      ),
    ),
  );

  String _status(Map<String, dynamic> o) => switch (o['status']) {
    'sent' => 'sent to ${o['sentCount']} customers',
    'cancelled' => 'cancelled',
    _ => 'scheduled',
  };

  Widget _ratings() {
    final r = ratings!;
    final count = (r['count'] as num).toInt();
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Customer ratings',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 6),
            Text(
              count == 0
                  ? 'No ratings yet.'
                  : '${r['average']} out of 5 from $count orders',
            ),
            if (r['note'] != null)
              Text(
                '${r['note']}',
                style: const TextStyle(fontSize: 12, color: Colors.black54),
              ),
            for (final l in (r['lowRatings'] as List? ?? const []).take(3))
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Text(
                  '${l['stars']}★ order #${l['orderNumber']}: ${l['comment']}',
                  style: const TextStyle(fontSize: 13),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
