import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';
import 'package:image_picker/image_picker.dart';
import 'package:pista_tracking/pista_tracking.dart';
import 'package:pista_ui/pista_ui.dart';
import 'package:pista_core/pista_core.dart';

const _cream = Color(0xFFFBF3E8);
const _green = Color(0xFF073B29);
const _gold = Color(0xFFB69B60);
const _red = Color(0xFF9B2C1F);

const supportCategories = <String, (String, IconData)>{
  'missing_item': ('Missing item', Icons.remove_shopping_cart_outlined),
  'wrong_item': ('Wrong item', Icons.swap_horiz),
  'quality': ('Food quality', Icons.restaurant_outlined),
  'late': ('Late order', Icons.schedule),
  'delivery': ('Delivery problem', Icons.delivery_dining_outlined),
  'payment': ('Payment issue', Icons.payments_outlined),
  'refund': ('Refund question', Icons.currency_rupee),
  'app': ('App problem', Icons.phone_android),
  'other': ('Something else', Icons.chat_bubble_outline),
};

String statusLabel(String status) => switch (status) {
  'open' => 'We are looking into it',
  'pending_customer' => 'We have replied',
  'resolved' => 'Resolved',
  'closed' => 'Closed',
  _ => status,
};

Color statusColor(String status) => switch (status) {
  'open' => _gold,
  'pending_customer' => _green,
  _ => Colors.black45,
};

String ago(String iso) {
  final t = DateTime.tryParse(iso)?.toLocal();
  if (t == null) return '';
  final d = DateTime.now().difference(t);
  if (d.inMinutes < 1) return 'just now';
  if (d.inMinutes < 60) return '${d.inMinutes} min ago';
  if (d.inHours < 24) return '${d.inHours} h ago';
  return '${d.inDays} d ago';
}

const maxSupportPhotos = 3;
const maxPhotoBytes = 800000;

/// A photo chosen by the customer, ready to send.
class PickedPhoto {
  final Uint8List bytes;
  final String contentType;
  PickedPhoto(this.bytes, this.contentType);
  Map<String, String> toJson() => {
    'contentType': contentType,
    'data': base64Encode(bytes),
  };
}

/// Works out the image type from its first bytes, or null if it is not one the
/// server accepts (JPEG, PNG or WebP).
String? sniffImageType(Uint8List b) {
  if (b.length > 3 && b[0] == 0xff && b[1] == 0xd8 && b[2] == 0xff) {
    return 'image/jpeg';
  }
  if (b.length > 8 &&
      b[0] == 0x89 &&
      b[1] == 0x50 &&
      b[2] == 0x4e &&
      b[3] == 0x47) {
    return 'image/png';
  }
  if (b.length > 12 &&
      String.fromCharCodes(b.sublist(0, 4)) == 'RIFF' &&
      String.fromCharCodes(b.sublist(8, 12)) == 'WEBP') {
    return 'image/webp';
  }
  return null;
}

/// Opens the gallery. Replaceable in tests.
typedef PhotoSource = Future<List<PickedPhoto>> Function(int remaining);

Future<List<PickedPhoto>> pickFromDevice(int remaining) async {
  final files = await ImagePicker().pickMultiImage(
    maxWidth: 1600,
    maxHeight: 1600,
    imageQuality: 80,
  );
  final out = <PickedPhoto>[];
  for (final f in files.take(remaining)) {
    final bytes = await f.readAsBytes();
    final type = sniffImageType(bytes);
    if (type == null) {
      throw 'Only JPEG, PNG or WebP photos can be attached.';
    }
    if (bytes.length > maxPhotoBytes) {
      throw 'That photo is too large. Pick a smaller one.';
    }
    out.add(PickedPhoto(bytes, type));
  }
  return out;
}

/// Thumbnails of the chosen photos with an "Add photo" button.
class PhotoPicker extends StatelessWidget {
  final List<PickedPhoto> photos;
  final bool enabled;
  final VoidCallback onAdd;
  final void Function(int index) onRemove;
  const PhotoPicker({
    super.key,
    required this.photos,
    required this.onAdd,
    required this.onRemove,
    this.enabled = true,
  });
  @override
  Widget build(BuildContext context) => Wrap(
    spacing: 8,
    runSpacing: 8,
    crossAxisAlignment: WrapCrossAlignment.center,
    children: [
      for (var i = 0; i < photos.length; i++)
        Stack(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: Image.memory(
                photos[i].bytes,
                width: 64,
                height: 64,
                fit: BoxFit.cover,
              ),
            ),
            Positioned(
              right: 0,
              top: 0,
              child: InkWell(
                key: ValueKey('remove-photo-$i'),
                onTap: enabled ? () => onRemove(i) : null,
                child: const CircleAvatar(
                  radius: 10,
                  backgroundColor: Colors.black54,
                  child: Icon(Icons.close, size: 12, color: Colors.white),
                ),
              ),
            ),
          ],
        ),
      if (photos.length < maxSupportPhotos)
        OutlinedButton.icon(
          onPressed: enabled ? onAdd : null,
          icon: const Icon(Icons.add_photo_alternate_outlined),
          label: Text(photos.isEmpty ? 'Add photos' : 'Add more'),
        ),
    ],
  );
}

/// Help centre: common answers and the customer's own requests.
class SupportPage extends StatefulWidget {
  final PistaApi api;

  /// Recent orders the customer can ask about.
  final List<Map<String, dynamic>> orders;
  const SupportPage({super.key, required this.api, this.orders = const []});
  @override
  State<SupportPage> createState() => _SupportPageState();
}

class _SupportPageState extends State<SupportPage> {
  List<Map<String, dynamic>>? tickets;
  String? error;

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    try {
      final data = await widget.api.request('/support/tickets') as List;
      if (mounted) {
        setState(() {
          tickets = data.map((t) => Map<String, dynamic>.from(t)).toList();
          error = null;
        });
      }
    } catch (e) {
      if (mounted) setState(() => error = '$e');
    }
  }

  Future<void> newRequest([Map<String, dynamic>? order]) async {
    final id = await Navigator.push<String>(
      context,
      MaterialPageRoute(
        builder: (_) => NewRequestPage(
          api: widget.api,
          orders: widget.orders,
          order: order,
        ),
      ),
    );
    if (id != null && mounted) {
      await Navigator.push<void>(
        context,
        MaterialPageRoute(
          builder: (_) => TicketPage(api: widget.api, ticketId: id),
        ),
      );
      load();
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: _cream,
    appBar: AppBar(
      backgroundColor: _cream,
      title: const Text('Help & support'),
    ),
    floatingActionButton: FloatingActionButton.extended(
      backgroundColor: _green,
      foregroundColor: const Color(0xFFFFF1CF),
      shape: const StadiumBorder(),
      onPressed: () => newRequest(),
      icon: const Icon(Icons.edit_outlined),
      label: const Text('New request'),
    ),
    body: RefreshIndicator(
      onRefresh: load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 100),
        children: [
          const Text(
            'Something wrong with an order? Tell us and the outlet will reply here.',
            style: TextStyle(height: 1.5),
          ),
          const SizedBox(height: 18),
          const Text(
            'Your requests',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 8),
          if (tickets == null && error == null)
            const Padding(
              padding: EdgeInsets.all(24),
              child: Center(child: CircularProgressIndicator()),
            )
          else if (error != null)
            Text(error!, style: const TextStyle(color: _red))
          else if (tickets!.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 18),
              child: Text('No requests yet.'),
            )
          else
            for (final t in tickets!) _card(t),
          const SizedBox(height: 24),
          const Text(
            'Quick answers',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 4),
          for (final (q, a) in _faq)
            ExpansionTile(
              tilePadding: EdgeInsets.zero,
              shape: const Border(),
              title: Text(
                q,
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
              childrenPadding: const EdgeInsets.only(bottom: 12),
              expandedCrossAxisAlignment: CrossAxisAlignment.start,
              children: [Text(a, style: const TextStyle(height: 1.5))],
            ),
        ],
      ),
    ),
  );

  Widget _card(Map<String, dynamic> t) => Padding(
    padding: const EdgeInsets.only(bottom: 10),
    child: Material(
      color: const Color(0xFFFFFAF3),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(
          color: t['unread'] == true ? _gold : const Color(0xFFE1D4BC),
          width: t['unread'] == true ? 1.4 : 1,
        ),
      ),
      clipBehavior: Clip.antiAlias,
      child: ListTile(
        onTap: () async {
          await Navigator.push<void>(
            context,
            MaterialPageRoute(
              builder: (_) =>
                  TicketPage(api: widget.api, ticketId: '${t['id']}'),
            ),
          );
          load();
        },
        leading: Icon(
          supportCategories['${t['category']}']?.$2 ??
              Icons.chat_bubble_outline,
          color: _green,
        ),
        title: Text(
          '${t['subject']}',
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(fontWeight: FontWeight.w600),
        ),
        subtitle: Text(
          '${statusLabel('${t['status']}')} · ${ago('${t['updatedAt']}')}',
          style: TextStyle(color: statusColor('${t['status']}')),
        ),
        trailing: t['unread'] == true
            ? const Badge(label: Text('New'), backgroundColor: _green)
            : const Icon(Icons.chevron_right),
      ),
    ),
  );

  static const _faq = [
    (
      'Where is my order?',
      'Open Order Again, then tap Track your order on a delivery. The map and estimated time update live once the rider has picked it up.',
    ),
    (
      'My payment failed but money left my account',
      'Do not pay again. If the order shows as unpaid, the bank usually returns the money automatically. Send us a request with the order and we will check it.',
    ),
    (
      'How do refunds work?',
      'The outlet reviews each request. Approved refunds go back to your original payment method and can take 5 to 7 working days to reach your bank.',
    ),
    (
      'Something was missing or wrong',
      'Tap New request, choose what happened and pick the order. Describe it and we will reply here.',
    ),
  ];
}

/// Starts a request, optionally about one order.
class NewRequestPage extends StatefulWidget {
  final PistaApi api;
  final List<Map<String, dynamic>> orders;
  final Map<String, dynamic>? order;
  final PhotoSource photoSource;
  const NewRequestPage({
    super.key,
    required this.api,
    this.orders = const [],
    this.order,
    this.photoSource = pickFromDevice,
  });
  @override
  State<NewRequestPage> createState() => _NewRequestPageState();
}

class _NewRequestPageState extends State<NewRequestPage> {
  String? category;
  String? orderId;
  final message = TextEditingController();
  final form = GlobalKey<FormState>();
  final photos = <PickedPhoto>[];
  bool busy = false;
  String? error;

  @override
  void initState() {
    super.initState();
    orderId = widget.order?['id'] as String?;
  }

  @override
  void dispose() {
    message.dispose();
    super.dispose();
  }

  Future<void> addPhotos() async {
    try {
      final more = await widget.photoSource(maxSupportPhotos - photos.length);
      if (mounted) {
        setState(() {
          photos.addAll(more.take(maxSupportPhotos - photos.length));
          error = null;
        });
      }
    } catch (e) {
      if (mounted) setState(() => error = '$e');
    }
  }

  Future<void> send() async {
    if (category == null) {
      setState(() => error = 'Choose what this is about.');
      return;
    }
    if (!form.currentState!.validate()) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final t = await widget.api.request(
        '/support/tickets',
        method: 'POST',
        body: {
          'category': category,
          if (orderId != null) 'orderId': orderId,
          'message': message.text.trim(),
          if (photos.isNotEmpty)
            'attachments': [for (final p in photos) p.toJson()],
        },
      );
      if (mounted) Navigator.pop(context, '${t['id']}');
    } catch (e) {
      if (mounted) setState(() => error = '$e');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: _cream,
    appBar: AppBar(backgroundColor: _cream, title: const Text('New request')),
    body: SafeArea(
      child: Form(
        key: form,
        child: ListView(
          padding: EdgeInsets.fromLTRB(
            22,
            8,
            22,
            24 + MediaQuery.viewInsetsOf(context).bottom,
          ),
          children: [
            const Text(
              'What is this about?',
              style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16),
            ),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final e in supportCategories.entries)
                  ChoiceChip(
                    avatar: Icon(e.value.$2, size: 18),
                    label: Text(e.value.$1),
                    selected: category == e.key,
                    onSelected: busy
                        ? null
                        : (_) => setState(() => category = e.key),
                  ),
              ],
            ),
            if (widget.orders.isNotEmpty || widget.order != null) ...[
              const SizedBox(height: 20),
              DropdownButtonFormField<String?>(
                initialValue: orderId,
                decoration: const InputDecoration(
                  labelText: 'Which order? (optional)',
                ),
                items: [
                  const DropdownMenuItem(
                    value: null,
                    child: Text('Not about a specific order'),
                  ),
                  for (final o in [
                    if (widget.order != null) widget.order!,
                    ...widget.orders.where(
                      (o) => o['id'] != widget.order?['id'],
                    ),
                  ])
                    DropdownMenuItem(
                      value: '${o['id']}',
                      child: Text(
                        '#PH${'${o['number']}'.padLeft(4, '0')} · ${rupees(o['totalPaise'])}',
                      ),
                    ),
                ],
                onChanged: busy ? null : (v) => setState(() => orderId = v),
              ),
            ],
            const SizedBox(height: 20),
            TextFormField(
              controller: message,
              enabled: !busy,
              minLines: 4,
              maxLines: 8,
              maxLength: 2000,
              textCapitalization: TextCapitalization.sentences,
              decoration: const InputDecoration(
                labelText: 'Tell us what happened',
                alignLabelWithHint: true,
              ),
              validator: (v) => (v?.trim().length ?? 0) < 5
                  ? 'Please add a few words so we can help'
                  : null,
            ),
            if (error != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Text(error!, style: const TextStyle(color: _red)),
              ),
            PhotoPicker(
              photos: photos,
              enabled: !busy,
              onAdd: addPhotos,
              onRemove: (i) => setState(() => photos.removeAt(i)),
            ),
            const SizedBox(height: 14),
            FilledButton(
              style: FilledButton.styleFrom(
                minimumSize: const Size.fromHeight(52),
              ),
              onPressed: busy ? null : send,
              child: Text(busy ? 'Sending…' : 'Send request'),
            ),
            const SizedBox(height: 10),
            const Text(
              'Please do not include card numbers, PINs or passwords.',
              style: TextStyle(fontSize: 12, color: Colors.black54),
            ),
          ],
        ),
      ),
    ),
  );
}

/// One conversation with the outlet.
class TicketPage extends StatefulWidget {
  final PistaApi api;
  final String ticketId;
  final Duration pollEvery;
  final PhotoSource photoSource;
  const TicketPage({
    super.key,
    required this.api,
    required this.ticketId,
    this.pollEvery = const Duration(seconds: 10),
    this.photoSource = pickFromDevice,
  });
  @override
  State<TicketPage> createState() => _TicketPageState();
}

class _TicketPageState extends State<TicketPage> {
  Map<String, dynamic>? ticket;
  String? error;
  bool sending = false;
  final replyPhotos = <PickedPhoto>[];
  final text = TextEditingController();
  final scroll = ScrollController();
  Timer? poll;
  int shown = 0;

  @override
  void initState() {
    super.initState();
    load();
    poll = Timer.periodic(widget.pollEvery, (_) => load());
  }

  @override
  void dispose() {
    poll?.cancel();
    text.dispose();
    scroll.dispose();
    super.dispose();
  }

  Future<void> load() async {
    if (sending) return;
    try {
      final t = Map<String, dynamic>.from(
        await widget.api.request('/support/tickets/${widget.ticketId}'),
      );
      if (!mounted) return;
      final count = (t['messages'] as List).length;
      setState(() {
        ticket = t;
        error = null;
      });
      if (count != shown) {
        shown = count;
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (scroll.hasClients) {
            scroll.animateTo(
              scroll.position.maxScrollExtent,
              duration: const Duration(milliseconds: 200),
              curve: Curves.easeOut,
            );
          }
        });
      }
    } catch (e) {
      if (mounted && ticket == null) setState(() => error = '$e');
    }
  }

  Future<void> act(Future<dynamic> Function() action) async {
    setState(() {
      sending = true;
      error = null;
    });
    try {
      final t = await action();
      if (mounted) ticket = Map<String, dynamic>.from(t);
    } catch (e) {
      if (mounted) error = '$e';
    } finally {
      if (mounted) setState(() => sending = false);
    }
    shown = -1;
    await load();
  }

  Future<void> addPhotos() async {
    try {
      final more = await widget.photoSource(
        maxSupportPhotos - replyPhotos.length,
      );
      if (mounted) {
        setState(() {
          replyPhotos.addAll(more.take(maxSupportPhotos - replyPhotos.length));
          error = null;
        });
      }
    } catch (e) {
      if (mounted) setState(() => error = '$e');
    }
  }

  Future<void> send() async {
    final body = text.text.trim();
    if (body.isEmpty || sending) return;
    await act(
      () => widget.api.request(
        '/support/tickets/${widget.ticketId}/messages',
        method: 'POST',
        body: {
          'body': body,
          if (replyPhotos.isNotEmpty)
            'attachments': [for (final p in replyPhotos) p.toJson()],
        },
      ),
    );
    if (error == null) {
      text.clear();
      if (mounted) setState(replyPhotos.clear);
    }
  }

  Future<void> rate(int stars) => act(
    () => widget.api.request(
      '/support/tickets/${widget.ticketId}/rating',
      method: 'POST',
      body: {'rating': stars},
    ),
  );

  @override
  Widget build(BuildContext context) {
    final t = ticket;
    return Scaffold(
      backgroundColor: _cream,
      appBar: AppBar(
        backgroundColor: _cream,
        title: Text(t == null ? 'Request' : 'Request #${t['number']}'),
        actions: [
          if (t != null && t['status'] != 'closed')
            PopupMenuButton<String>(
              tooltip: 'More',
              onSelected: (v) async {
                if (v == 'close') {
                  final ok = await showDialog<bool>(
                    context: context,
                    builder: (context) => AlertDialog(
                      title: const Text('Close this request?'),
                      content: const Text(
                        'You can start a new request any time.',
                      ),
                      actions: [
                        TextButton(
                          onPressed: () => Navigator.pop(context, false),
                          child: const Text('Keep open'),
                        ),
                        FilledButton(
                          onPressed: () => Navigator.pop(context, true),
                          child: const Text('Close'),
                        ),
                      ],
                    ),
                  );
                  if (ok == true) {
                    await act(
                      () => widget.api.request(
                        '/support/tickets/${widget.ticketId}/close',
                        method: 'POST',
                      ),
                    );
                  }
                }
              },
              itemBuilder: (_) => const [
                PopupMenuItem(value: 'close', child: Text('Close request')),
              ],
            ),
        ],
      ),
      body: t == null
          ? Center(
              child: error == null
                  ? const CircularProgressIndicator()
                  : Padding(
                      padding: const EdgeInsets.all(24),
                      child: Text(error!, style: const TextStyle(color: _red)),
                    ),
            )
          : Column(
              children: [
                _header(t),
                Expanded(
                  child: ListView(
                    controller: scroll,
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
                    children: [
                      for (final m in (t['messages'] as List)) _bubble(m),
                      if (t['canRate'] == true) _rating(),
                      if (t['rating'] != null)
                        Padding(
                          padding: const EdgeInsets.symmetric(vertical: 10),
                          child: Text(
                            'Thanks for rating: ${'★' * (t['rating'] as int)}',
                            textAlign: TextAlign.center,
                            style: const TextStyle(color: _gold),
                          ),
                        ),
                    ],
                  ),
                ),
                if (error != null)
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Text(error!, style: const TextStyle(color: _red)),
                  ),
                _composer(t),
              ],
            ),
    );
  }

  Widget _header(Map<String, dynamic> t) => Container(
    width: double.infinity,
    padding: const EdgeInsets.fromLTRB(20, 4, 20, 12),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          '${t['subject']}',
          style: const TextStyle(
            fontFamily: 'packages/pista_ui/HouseSerif',
            fontSize: 24,
            fontWeight: FontWeight.w600,
            color: _green,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          statusLabel('${t['status']}'),
          style: TextStyle(
            fontWeight: FontWeight.w600,
            color: statusColor('${t['status']}'),
          ),
        ),
      ],
    ),
  );

  Widget _bubble(Map<String, dynamic> m) {
    final mine = m['from'] == 'you';
    return Align(
      alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 4),
        padding: const EdgeInsets.all(12),
        constraints: BoxConstraints(
          maxWidth: MediaQuery.sizeOf(context).width * .78,
        ),
        decoration: BoxDecoration(
          color: mine ? _green : const Color(0xFFFFFAF3),
          borderRadius: BorderRadius.circular(16),
          border: mine ? null : Border.all(color: const Color(0xFFE1D4BC)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (!mine)
              const Text(
                'Pista House support',
                style: TextStyle(
                  fontSize: 11,
                  color: _gold,
                  fontWeight: FontWeight.w700,
                ),
              ),
            Text(
              '${m['body']}',
              style: TextStyle(
                height: 1.4,
                color: mine ? const Color(0xFFFFF1CF) : Colors.black87,
              ),
            ),
            SupportPhotoRow(
              api: widget.api,
              photos: (m['attachments'] as List?) ?? const [],
            ),
            const SizedBox(height: 4),
            Text(
              ago('${m['createdAt']}'),
              style: TextStyle(
                fontSize: 10,
                color: mine ? const Color(0xAAFFF1CF) : Colors.black45,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _rating() => Container(
    margin: const EdgeInsets.symmetric(vertical: 12),
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(
      color: const Color(0xFFFFFAF3),
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: const Color(0xFFE1D4BC)),
    ),
    child: Column(
      children: [
        const Text(
          'How did we do?',
          style: TextStyle(fontWeight: FontWeight.w600),
        ),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            for (var i = 1; i <= 5; i++)
              IconButton(
                tooltip: '$i star${i == 1 ? '' : 's'}',
                onPressed: sending ? null : () => rate(i),
                icon: const Icon(
                  Icons.star_border_rounded,
                  color: _gold,
                  size: 32,
                ),
              ),
          ],
        ),
      ],
    ),
  );

  Widget _composer(Map<String, dynamic> t) {
    if (t['canReply'] != true) {
      return const SafeArea(
        child: Padding(
          padding: EdgeInsets.all(16),
          child: Text(
            'This request is closed. Start a new request if you need more help.',
            textAlign: TextAlign.center,
            style: TextStyle(color: Colors.black54),
          ),
        ),
      );
    }
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          12,
          6,
          12,
          10 + MediaQuery.viewInsetsOf(context).bottom,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (replyPhotos.isNotEmpty)
              Align(
                alignment: Alignment.centerLeft,
                child: Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: PhotoPicker(
                    photos: replyPhotos,
                    enabled: !sending,
                    onAdd: addPhotos,
                    onRemove: (i) => setState(() => replyPhotos.removeAt(i)),
                  ),
                ),
              ),
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                IconButton(
                  tooltip: 'Attach photos',
                  onPressed: sending || replyPhotos.length >= maxSupportPhotos
                      ? null
                      : addPhotos,
                  icon: const Icon(Icons.add_photo_alternate_outlined),
                ),
                Expanded(
                  child: TextField(
                    controller: text,
                    enabled: !sending,
                    minLines: 1,
                    maxLines: 4,
                    maxLength: 2000,
                    textCapitalization: TextCapitalization.sentences,
                    decoration: InputDecoration(
                      hintText: t['status'] == 'resolved'
                          ? 'Reply to reopen this request'
                          : 'Write a message',
                      counterText: '',
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton.filled(
                  tooltip: 'Send message',
                  style: IconButton.styleFrom(backgroundColor: _green),
                  onPressed: sending ? null : send,
                  icon: const Icon(Icons.send_rounded),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
