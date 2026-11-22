import 'dart:async';
import 'package:pista_ui/pista_ui.dart';
import 'package:pista_core/pista_core.dart';
import 'package:pista_tracking/pista_tracking.dart';
import '../payments/refund_page.dart';

const _amber = Color(0xFF956233);

const _categoryNames = {
  'missing_item': 'Missing item',
  'wrong_item': 'Wrong item',
  'quality': 'Food quality',
  'late': 'Late order',
  'delivery': 'Delivery problem',
  'payment': 'Payment issue',
  'refund': 'Refund question',
  'app': 'App problem',
  'other': 'Something else',
};

const cannedReplies = [
  'Sorry about that. We are looking into it and will update you shortly.',
  'We have refunded the affected item. It can take 5 to 7 working days to reach your bank.',
  'Could you tell us a little more about what happened?',
  'Thank you for letting us know. We have passed this to the kitchen.',
  'Your order is on its way. Your rider should reach you shortly.',
];

String ago(String iso) {
  final t = DateTime.tryParse(iso)?.toLocal();
  if (t == null) return '';
  final d = DateTime.now().difference(t);
  if (d.inMinutes < 1) return 'just now';
  if (d.inMinutes < 60) return '${d.inMinutes} min ago';
  if (d.inHours < 24) return '${d.inHours} h ago';
  return '${d.inDays} d ago';
}

String waiting(int minutes) {
  if (minutes < 60) return '$minutes min';
  if (minutes < 1440) return '${minutes ~/ 60} h';
  return '${minutes ~/ 1440} d';
}

/// Customer requests for the outlet: who is waiting, for how long, and what
/// has been answered.
class SupportInboxPage extends StatefulWidget {
  final PistaApi api;
  final Duration pollEvery;
  const SupportInboxPage({
    super.key,
    required this.api,
    this.pollEvery = const Duration(seconds: 15),
  });
  @override
  State<SupportInboxPage> createState() => _SupportInboxPageState();
}

class _SupportInboxPageState extends State<SupportInboxPage> {
  static const filters = {
    'needs_reply': 'Needs reply',
    'waiting': 'Waiting on customer',
    'finished': 'Finished',
    'all': 'All',
  };
  String filter = 'needs_reply';
  bool mine = false;
  final search = TextEditingController();
  List<Map<String, dynamic>>? items;
  Map<String, dynamic>? stats;
  String? error;
  Timer? poll;

  @override
  void initState() {
    super.initState();
    load();
    poll = Timer.periodic(widget.pollEvery, (_) => load());
  }

  @override
  void dispose() {
    poll?.cancel();
    search.dispose();
    super.dispose();
  }

  Future<void> load() async {
    try {
      final q = StringBuffer('/support/inbox?filter=$filter');
      if (mine) q.write('&mine=true');
      final text = search.text.trim();
      if (text.isNotEmpty) q.write('&search=${Uri.encodeQueryComponent(text)}');
      final results = await Future.wait([
        widget.api.request(q.toString()),
        widget.api.request('/support/stats'),
      ]);
      if (!mounted) return;
      setState(() {
        items = (results[0] as List)
            .map((t) => Map<String, dynamic>.from(t))
            .toList();
        stats = Map<String, dynamic>.from(results[1]);
        error = null;
      });
    } catch (e) {
      if (mounted) setState(() => error = '$e');
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Customer support')),
    body: RefreshIndicator(
      onRefresh: load,
      child: ListView(
        padding: const EdgeInsets.all(18),
        children: [
          if (stats != null) _stats(),
          const SizedBox(height: 14),
          TextField(
            controller: search,
            textInputAction: TextInputAction.search,
            onSubmitted: (_) => load(),
            decoration: InputDecoration(
              hintText: 'Search name, subject or request number',
              prefixIcon: const Icon(Icons.search),
              suffixIcon: search.text.isEmpty
                  ? null
                  : IconButton(
                      tooltip: 'Clear search',
                      icon: const Icon(Icons.close),
                      onPressed: () {
                        search.clear();
                        load();
                      },
                    ),
            ),
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            children: [
              for (final e in filters.entries)
                ChoiceChip(
                  label: Text(e.value),
                  selected: filter == e.key,
                  onSelected: (_) {
                    setState(() => filter = e.key);
                    load();
                  },
                ),
              FilterChip(
                label: const Text('Mine'),
                selected: mine,
                onSelected: (v) {
                  setState(() => mine = v);
                  load();
                },
              ),
            ],
          ),
          const SizedBox(height: 14),
          if (error != null)
            Text(error!, style: const TextStyle(color: Colors.red))
          else if (items == null)
            const Padding(
              padding: EdgeInsets.all(30),
              child: Center(child: CircularProgressIndicator()),
            )
          else if (items!.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 30),
              child: Text(
                'Nothing here. New customer requests appear in Needs reply.',
                textAlign: TextAlign.center,
              ),
            )
          else
            for (final t in items!) _card(t),
        ],
      ),
    ),
  );

  Widget _stats() {
    final s = stats!;
    Widget tile(String label, String value, {bool warn = false}) => Expanded(
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: warn ? const Color(0xFFFCEFD9) : pistaIvory,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          children: [
            Text(
              value,
              style: TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w700,
                color: warn ? _amber : pistaGreen,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              label,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 11),
            ),
          ],
        ),
      ),
    );
    final avg = s['avgFirstResponseMinutes'];
    final csat = s['satisfaction'] as Map?;
    return Column(
      children: [
        Row(
          children: [
            tile('Need a reply', '${s['needsReply']}'),
            const SizedBox(width: 8),
            tile(
              'Overdue (${s['slaMinutes']} min)',
              '${s['overdue']}',
              warn: (s['overdue'] as num) > 0,
            ),
            const SizedBox(width: 8),
            tile('Resolved today', '${s['resolvedToday']}'),
          ],
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            tile(
              'Avg first reply (7 days)',
              avg == null ? '—' : waiting((avg as num).toInt()),
            ),
            const SizedBox(width: 8),
            tile(
              'Customer rating',
              csat == null ? '—' : '${csat['average']} ★',
            ),
            const SizedBox(width: 8),
            tile('Assigned to me', '${s['assignedToMe']}'),
          ],
        ),
      ],
    );
  }

  Widget _card(Map<String, dynamic> t) => Padding(
    padding: const EdgeInsets.only(bottom: 10),
    child: Material(
      color: Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(
          color: t['overdue'] == true ? _amber : const Color(0xFFE0E4D8),
          width: t['overdue'] == true ? 1.5 : 1,
        ),
      ),
      clipBehavior: Clip.antiAlias,
      child: ListTile(
        onTap: () async {
          await Navigator.push<void>(
            context,
            MaterialPageRoute(
              builder: (_) =>
                  TicketDetailPage(api: widget.api, ticketId: '${t['id']}'),
            ),
          );
          load();
        },
        title: Text(
          '#${t['number']} · ${t['subject']}',
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(fontWeight: FontWeight.w600),
        ),
        subtitle: Text(
          [
            '${t['customer']}',
            _categoryNames['${t['category']}'] ?? '${t['category']}',
            if (t['orderNumber'] != null)
              'Order #PH${'${t['orderNumber']}'.padLeft(4, '0')}',
            if (t['assignedTo'] != null) 'with ${t['assignedTo']}',
          ].join(' · '),
        ),
        trailing: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            if (t['priority'] == 'high')
              const Icon(Icons.flag, size: 16, color: Colors.red),
            if (t['waitingMinutes'] != null)
              Text(
                waiting((t['waitingMinutes'] as num).toInt()),
                style: TextStyle(
                  fontWeight: FontWeight.w700,
                  color: t['overdue'] == true ? _amber : pistaGreen,
                ),
              )
            else
              Text(
                ago('${t['updatedAt']}'),
                style: const TextStyle(fontSize: 11),
              ),
          ],
        ),
      ),
    ),
  );
}

/// One request: the customer and order, the conversation, and the reply box.
class TicketDetailPage extends StatefulWidget {
  final PistaApi api;
  final String ticketId;
  const TicketDetailPage({
    super.key,
    required this.api,
    required this.ticketId,
  });
  @override
  State<TicketDetailPage> createState() => _TicketDetailPageState();
}

class _TicketDetailPageState extends State<TicketDetailPage> {
  Map<String, dynamic>? t;
  String? error;
  bool busy = false, note = false;
  final reply = TextEditingController();

  @override
  void initState() {
    super.initState();
    load();
  }

  @override
  void dispose() {
    reply.dispose();
    super.dispose();
  }

  Future<void> load() async {
    try {
      final d = Map<String, dynamic>.from(
        await widget.api.request('/support/inbox/${widget.ticketId}'),
      );
      if (mounted) {
        setState(() {
          t = d;
          error = null;
        });
      }
    } catch (e) {
      if (mounted && t == null) setState(() => error = '$e');
    }
  }

  Future<void> act(Future<dynamic> Function() action) async {
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final d = await action();
      if (mounted) t = Map<String, dynamic>.from(d);
    } catch (e) {
      if (mounted) error = '$e';
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> send({String? status}) async {
    final text = reply.text.trim();
    if (text.isEmpty || busy) return;
    await act(
      () => widget.api.request(
        '/support/inbox/${widget.ticketId}/reply',
        method: 'POST',
        body: {
          'body': text,
          if (note) 'internal': true,
          if (status != null && !note) 'status': status,
        },
      ),
    );
    if (error == null) reply.clear();
  }

  Future<void> change(Map<String, dynamic> body) => act(
    () => widget.api.request(
      '/support/inbox/${widget.ticketId}',
      method: 'PATCH',
      body: body,
    ),
  );

  @override
  Widget build(BuildContext context) {
    final d = t;
    return Scaffold(
      appBar: AppBar(
        title: Text(d == null ? 'Request' : 'Request #${d['number']}'),
        actions: [
          if (d != null)
            PopupMenuButton<String>(
              tooltip: 'Actions',
              onSelected: (v) {
                switch (v) {
                  case 'me':
                    change({'assign': 'me'});
                  case 'none':
                    change({'assign': 'none'});
                  case 'high':
                    change({'priority': 'high'});
                  case 'normal':
                    change({'priority': 'normal'});
                  case 'reopen':
                    change({'status': 'open'});
                  case 'close':
                    change({'status': 'closed'});
                }
              },
              itemBuilder: (_) => [
                if (d['assignedTo'] == null)
                  const PopupMenuItem(value: 'me', child: Text('Assign to me'))
                else
                  const PopupMenuItem(value: 'none', child: Text('Unassign')),
                if (d['priority'] == 'high')
                  const PopupMenuItem(
                    value: 'normal',
                    child: Text('Normal priority'),
                  )
                else
                  const PopupMenuItem(
                    value: 'high',
                    child: Text('Mark high priority'),
                  ),
                if (['resolved', 'closed'].contains(d['status']))
                  const PopupMenuItem(value: 'reopen', child: Text('Reopen'))
                else
                  const PopupMenuItem(
                    value: 'close',
                    child: Text('Close without replying'),
                  ),
              ],
            ),
        ],
      ),
      body: d == null
          ? Center(
              child: error == null
                  ? const CircularProgressIndicator()
                  : Text(error!, style: const TextStyle(color: Colors.red)),
            )
          : Column(
              children: [
                Expanded(
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      _header(d),
                      if (d['order'] != null) _order(d['order']),
                      const SizedBox(height: 10),
                      for (final m in (d['messages'] as List)) _message(m),
                      if (d['rating'] != null)
                        Padding(
                          padding: const EdgeInsets.only(top: 8),
                          child: Text(
                            'Customer rated this ${'★' * (d['rating'] as int)}'
                            '${(d['ratingComment'] ?? '').toString().isEmpty ? '' : ': ${d['ratingComment']}'}',
                            style: const TextStyle(color: _amber),
                          ),
                        ),
                    ],
                  ),
                ),
                if (error != null)
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Text(
                      error!,
                      style: const TextStyle(color: Colors.red),
                    ),
                  ),
                _composer(d),
              ],
            ),
    );
  }

  Widget _header(Map<String, dynamic> d) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(
        '${d['subject']}',
        style: const TextStyle(
          fontFamily: 'packages/pista_ui/HouseSerif',
          fontSize: 24,
          fontWeight: FontWeight.w600,
          color: pistaGreen,
        ),
      ),
      const SizedBox(height: 6),
      Wrap(
        spacing: 8,
        runSpacing: 4,
        children: [
          Chip(label: Text('${d['status']}'.replaceAll('_', ' '))),
          if (d['priority'] == 'high')
            const Chip(
              avatar: Icon(Icons.flag, size: 16, color: Colors.red),
              label: Text('High priority'),
            ),
          if (d['overdue'] == true)
            const Chip(
              label: Text('Overdue'),
              backgroundColor: Color(0xFFFCEFD9),
            ),
          Chip(
            label: Text(
              _categoryNames['${d['category']}'] ?? '${d['category']}',
            ),
          ),
          if (d['assignedTo'] != null)
            Chip(label: Text('With ${d['assignedTo']}')),
        ],
      ),
      const SizedBox(height: 6),
      Text(
        '${(d['customer'] as Map)['name']}'
        '${(d['customer'] as Map)['phone'] == null ? '' : ' · +91 ${(d['customer'] as Map)['phone']}'}'
        ' · ${(d['customer'] as Map)['earlierRequests']} earlier request${(d['customer'] as Map)['earlierRequests'] == 1 ? '' : 's'}',
        style: const TextStyle(color: Colors.black54),
      ),
    ],
  );

  Widget _order(Map<String, dynamic> o) => Container(
    margin: const EdgeInsets.only(top: 12),
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(
      color: pistaIvory,
      borderRadius: BorderRadius.circular(12),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text(
              'Order #PH${'${o['number']}'.padLeft(4, '0')}',
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
            const Spacer(),
            Text(rupees((o['totalPaise'] as num).toInt())),
          ],
        ),
        const SizedBox(height: 4),
        Text(
          '${'${o['status']}'.replaceAll('_', ' ')} · ${o['fulfilment']} · payment ${o['paymentStatus']}',
          style: const TextStyle(fontSize: 12, color: Colors.black54),
        ),
        for (final i in (o['items'] as List))
          Text('${i['quantity']} × ${i['name']}'),
        if (['paid', 'refunded'].contains(o['paymentStatus']))
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton.icon(
              onPressed: () => Navigator.push<void>(
                context,
                MaterialPageRoute(
                  builder: (_) => RefundPage(
                    api: widget.api,
                    order: {'id': o['id'], 'number': o['number']},
                  ),
                ),
              ),
              icon: const Icon(Icons.currency_rupee, size: 16),
              label: Text(
                o['paymentStatus'] == 'refunded'
                    ? 'Refund details'
                    : 'Refund this order',
              ),
            ),
          ),
      ],
    ),
  );

  Widget _message(Map<String, dynamic> m) {
    final from = '${m['from']}';
    if (from == 'system') {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Text(
          '${m['author']}: ${m['body']} · ${ago('${m['createdAt']}')}',
          textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 11, color: Colors.black45),
        ),
      );
    }
    final staff = from == 'staff';
    final internal = m['internal'] == true;
    return Align(
      alignment: staff ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 4),
        padding: const EdgeInsets.all(12),
        constraints: BoxConstraints(
          maxWidth: MediaQuery.sizeOf(context).width * .8,
        ),
        decoration: BoxDecoration(
          color: internal
              ? const Color(0xFFFFF4C9)
              : staff
              ? pistaGreen
              : pistaIvory,
          borderRadius: BorderRadius.circular(14),
          border: internal ? Border.all(color: const Color(0xFFE0C458)) : null,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              internal ? '${m['author']} · private note' : '${m['author']}',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: internal
                    ? _amber
                    : staff
                    ? const Color(0xFFFFE9B0)
                    : pistaGreen,
              ),
            ),
            Text(
              '${m['body']}',
              style: TextStyle(
                height: 1.4,
                color: staff && !internal ? Colors.white : Colors.black87,
              ),
            ),
            SupportPhotoRow(
              api: widget.api,
              photos: (m['attachments'] as List?) ?? const [],
            ),
            Text(
              ago('${m['createdAt']}'),
              style: TextStyle(
                fontSize: 10,
                color: staff && !internal ? Colors.white70 : Colors.black45,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _composer(Map<String, dynamic> d) => SafeArea(
    child: Padding(
      padding: EdgeInsets.fromLTRB(
        12,
        4,
        12,
        8 + MediaQuery.viewInsetsOf(context).bottom,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            height: 40,
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: [
                for (final c in cannedReplies)
                  Padding(
                    padding: const EdgeInsets.only(right: 6),
                    child: ActionChip(
                      label: Text(
                        c.length > 30 ? '${c.substring(0, 28)}…' : c,
                        style: const TextStyle(fontSize: 12),
                      ),
                      onPressed: () => setState(() => reply.text = c),
                    ),
                  ),
              ],
            ),
          ),
          TextField(
            controller: reply,
            enabled: !busy,
            minLines: 1,
            maxLines: 5,
            maxLength: 2000,
            decoration: InputDecoration(
              hintText: note
                  ? 'Private note (the customer will not see this)'
                  : 'Reply to the customer',
              counterText: '',
              fillColor: note ? const Color(0xFFFFF4C9) : null,
            ),
          ),
          Row(
            children: [
              Switch(
                value: note,
                onChanged: busy ? null : (v) => setState(() => note = v),
              ),
              const Text('Private note'),
              const Spacer(),
              if (!note)
                TextButton(
                  onPressed: busy ? null : () => send(status: 'resolved'),
                  child: const Text('Send & resolve'),
                ),
              FilledButton(
                onPressed: busy ? null : send,
                child: Text(note ? 'Add note' : 'Send'),
              ),
            ],
          ),
        ],
      ),
    ),
  );
}
