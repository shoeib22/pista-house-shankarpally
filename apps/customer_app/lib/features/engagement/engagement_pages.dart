import 'package:pista_ui/pista_ui.dart';
import 'package:pista_core/pista_core.dart';

const _cream = Color(0xFFFBF3E8);
const _green = Color(0xFF073B29);
const _gold = Color(0xFFB69B60);
const _red = Color(0xFF9B2C1F);

/// Offers the outlet has sent and dishes picked from the customer's own orders.
/// Offers say exactly what the owner wrote: nothing is added or invented.
class ForYouTab extends StatefulWidget {
  final CustomerModel model;
  final VoidCallback onBrowse;
  const ForYouTab({super.key, required this.model, required this.onBrowse});
  @override
  State<ForYouTab> createState() => _ForYouTabState();
}

class _ForYouTabState extends State<ForYouTab> {
  List<Map<String, dynamic>> offers = [], picks = [];
  bool loaded = false;
  String? error;

  PistaApi get api => widget.model.api;

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    if (api.token == null) {
      if (mounted) setState(() => loaded = true);
      return;
    }
    try {
      final results = await Future.wait([
        api.request('/me/offers'),
        api.request('/me/recommendations'),
      ]);
      List<Map<String, dynamic>> list(dynamic v) =>
          (v as List).map((e) => Map<String, dynamic>.from(e as Map)).toList();
      if (!mounted) return;
      setState(() {
        offers = list(results[0]);
        picks = list(results[1]);
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

  @override
  Widget build(BuildContext context) => RefreshIndicator(
    onRefresh: load,
    child: ListView(
      padding: const EdgeInsets.all(24),
      children: [
        const Text(
          'For you',
          style: TextStyle(fontSize: 26, fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 16),
        if (api.token == null)
          const Text(
            'Sign in to see offers from the restaurant and dishes picked from your orders.',
            style: TextStyle(height: 1.6),
          ),
        if (!loaded) const Center(child: CircularProgressIndicator()),
        if (error != null) Text(error!, style: const TextStyle(color: _red)),
        for (final o in offers) _offer(o),
        if (loaded && api.token != null && offers.isEmpty)
          const Padding(
            padding: EdgeInsets.only(bottom: 12),
            child: Text(
              'No offers right now. Prices on the menu are the prices you pay.',
              style: TextStyle(height: 1.6),
            ),
          ),
        if (picks.isNotEmpty) ...[
          const SizedBox(height: 12),
          const Text(
            'Picked for you',
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 8),
          for (final p in picks) _pick(p),
        ],
        const SizedBox(height: 16),
        FilledButton(
          onPressed: widget.onBrowse,
          child: const Text('Browse the menu'),
        ),
      ],
    ),
  );

  Widget _offer(Map<String, dynamic> o) => Container(
    key: ValueKey('offer-${o['id']}'),
    margin: const EdgeInsets.only(bottom: 12),
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      color: _green,
      borderRadius: BorderRadius.circular(18),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          '${o['title']}',
          style: const TextStyle(
            color: Colors.white,
            fontSize: 18,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 6),
        Text(
          '${o['body']}',
          style: const TextStyle(color: Color(0xFFFFF1CF), height: 1.4),
        ),
        if (o['productId'] != null) ...[
          const SizedBox(height: 10),
          OutlinedButton(
            style: OutlinedButton.styleFrom(
              foregroundColor: _gold,
              side: const BorderSide(color: _gold),
            ),
            onPressed: widget.onBrowse,
            child: const Text('See on the menu'),
          ),
        ],
      ],
    ),
  );

  Widget _pick(Map<String, dynamic> p) {
    final price = (p['pricePaise'] as num).toInt();
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        child: ListTile(
          key: ValueKey('pick-${p['productId']}'),
          title: Text('${p['name']}'),
          subtitle: Text('₹${price ~/ 100} · ${p['reason']}'),
          trailing: IconButton.filled(
            tooltip: 'Add ${p['name']} to cart',
            style: IconButton.styleFrom(backgroundColor: _green),
            onPressed: () {
              widget.model.change('${p['productId']}', 1);
              ScaffoldMessenger.maybeOf(context)
                ?..hideCurrentSnackBar()
                ..showSnackBar(
                  SnackBar(content: Text('${p['name']} added to your cart')),
                );
            },
            icon: const Icon(Icons.add),
          ),
        ),
      ),
    );
  }
}

/// Five stars and an optional note for a finished order. Rated once.
class RatePage extends StatefulWidget {
  final PistaApi api;
  final Map<String, dynamic> order;
  const RatePage({super.key, required this.api, required this.order});
  @override
  State<RatePage> createState() => _RatePageState();
}

class _RatePageState extends State<RatePage> {
  int stars = 0;
  final note = TextEditingController();
  bool busy = false, done = false;
  String? error;
  Map<String, dynamic>? existing;

  @override
  void initState() {
    super.initState();
    _existing();
  }

  @override
  void dispose() {
    note.dispose();
    super.dispose();
  }

  Future<void> _existing() async {
    try {
      final r = await widget.api.request(
        '/orders/${widget.order['id']}/rating',
      );
      if (r is Map && mounted) {
        setState(() => existing = Map<String, dynamic>.from(r));
      }
    } catch (_) {}
  }

  Future<void> send() async {
    if (stars == 0) {
      setState(() => error = 'Tap a star to rate.');
      return;
    }
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await widget.api.request(
        '/orders/${widget.order['id']}/rating',
        method: 'POST',
        body: {
          'stars': stars,
          if (note.text.trim().isNotEmpty) 'comment': note.text.trim(),
        },
      );
      if (mounted) setState(() => done = true);
    } catch (e) {
      if (mounted) setState(() => error = '$e');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final number = widget.order['number'];
    return Scaffold(
      backgroundColor: _cream,
      appBar: AppBar(
        backgroundColor: _cream,
        title: const Text('Rate your order'),
      ),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: existing != null
            ? Center(
                child: Text(
                  'You rated this order ${existing!['stars']} out of 5. Thank you.',
                  textAlign: TextAlign.center,
                ),
              )
            : done
            ? const Center(
                child: Text(
                  'Thank you. Your rating helps us improve.',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 18),
                ),
              )
            : ListView(
                children: [
                  Text(
                    'How was order #PH${'$number'.padLeft(4, '0')}?',
                    style: const TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      for (var i = 1; i <= 5; i++)
                        IconButton(
                          tooltip: '$i star${i == 1 ? '' : 's'}',
                          onPressed: busy
                              ? null
                              : () => setState(() => stars = i),
                          icon: Icon(
                            i <= stars
                                ? Icons.star_rounded
                                : Icons.star_border_rounded,
                            color: _gold,
                            size: 40,
                          ),
                        ),
                    ],
                  ),
                  TextField(
                    controller: note,
                    enabled: !busy,
                    maxLines: 3,
                    maxLength: 500,
                    decoration: const InputDecoration(
                      hintText: 'Anything we should know? (optional)',
                    ),
                  ),
                  if (error != null)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      child: Text(error!, style: const TextStyle(color: _red)),
                    ),
                  const SizedBox(height: 8),
                  FilledButton(
                    style: FilledButton.styleFrom(
                      minimumSize: const Size.fromHeight(52),
                    ),
                    onPressed: busy ? null : send,
                    child: Text(busy ? 'Sending…' : 'Send rating'),
                  ),
                ],
              ),
      ),
    );
  }
}
