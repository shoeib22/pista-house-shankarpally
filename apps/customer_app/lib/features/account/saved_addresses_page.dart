import 'package:pista_ui/pista_ui.dart';
import 'package:pista_core/pista_core.dart';
import 'package:pista_tracking/pista_tracking.dart';

const _labels = ['Home', 'Work', 'Other'];

/// The customer's saved delivery addresses: add, edit, choose a default, delete.
class SavedAddressesPage extends StatefulWidget {
  final CustomerModel model;
  const SavedAddressesPage({super.key, required this.model});
  @override
  State<SavedAddressesPage> createState() => _SavedAddressesPageState();
}

class _SavedAddressesPageState extends State<SavedAddressesPage> {
  AddressBook get book => widget.model.addresses;
  @override
  void initState() {
    super.initState();
    book.load(force: true);
  }

  void say(String message) => ScaffoldMessenger.of(
    context,
  ).showSnackBar(SnackBar(content: Text(message)));

  Future<void> edit([Map<String, dynamic>? existing]) async {
    final saved = await Navigator.push<bool>(
      context,
      MaterialPageRoute(
        builder: (_) =>
            AddressFormPage(model: widget.model, existing: existing),
      ),
    );
    if (saved == true && mounted) {
      say(existing == null ? 'Address saved.' : 'Address updated.');
    }
  }

  Future<void> delete(Map<String, dynamic> a) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Delete ${a['label']}?'),
        content: const Text(
          'This removes it from your saved addresses. Past orders are not changed.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Keep'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await book.remove(a['id']);
      if (mounted) say('Address deleted.');
    } catch (e) {
      if (mounted) say('$e');
    }
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: book,
    builder: (context, _) => Scaffold(
      backgroundColor: const Color(0xFFFBF3E8),
      appBar: AppBar(
        title: const Text('Saved addresses'),
        backgroundColor: const Color(0xFFFBF3E8),
      ),
      floatingActionButton: widget.model.api.token == null
          ? null
          : FloatingActionButton.extended(
              backgroundColor: const Color(0xFF073B29),
              foregroundColor: const Color(0xFFFFF1CF),
              shape: const StadiumBorder(),
              onPressed: () => edit(),
              icon: const Icon(Icons.add_location_alt_outlined),
              label: const Text('Add address'),
            ),
      body: widget.model.api.token == null
          ? const Center(
              child: Padding(
                padding: EdgeInsets.all(28),
                child: Text(
                  'Sign in to save addresses for faster checkout.',
                  textAlign: TextAlign.center,
                ),
              ),
            )
          : book.loading && book.items.isEmpty
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: () => book.load(force: true),
              child: ListView(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 96),
                children: [
                  if (book.error != null)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: Text(
                        book.error!,
                        style: const TextStyle(color: Color(0xFF9B2C1F)),
                      ),
                    ),
                  if (book.items.isEmpty && book.error == null)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 40),
                      child: Column(
                        children: [
                          Icon(
                            Icons.home_outlined,
                            size: 44,
                            color: pistaGreen,
                          ),
                          SizedBox(height: 12),
                          Text(
                            'No saved addresses yet.\nAdd one, or tick “Save this address” at checkout.',
                            textAlign: TextAlign.center,
                            style: TextStyle(height: 1.5),
                          ),
                        ],
                      ),
                    ),
                  for (final a in book.items) _card(a),
                ],
              ),
            ),
    ),
  );

  Widget _card(Map<String, dynamic> a) {
    final pinned = a['latitude'] is num && a['longitude'] is num;
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.fromLTRB(16, 14, 6, 14),
      decoration: BoxDecoration(
        color: const Color(0xFFFFFAF3),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: a['isDefault'] == true
              ? const Color(0xFFB69B60)
              : const Color(0xFFE1D4BC),
          width: a['isDefault'] == true ? 1.4 : 1,
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(switch (a['label']) {
            'Home' => Icons.home_outlined,
            'Work' => Icons.work_outline,
            _ => Icons.place_outlined,
          }, color: pistaGreen),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        '${a['label']}',
                        style: const TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 16,
                        ),
                      ),
                    ),
                    if (a['isDefault'] == true) ...[
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 2,
                        ),
                        decoration: BoxDecoration(
                          color: const Color(0xFFEFE3C8),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: const Text(
                          'Default',
                          style: TextStyle(fontSize: 11),
                        ),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 4),
                Text('${a['recipient']} · ${a['phone']}'),
                Text(
                  '${a['line1']}, ${a['city']} ${a['postalCode']}',
                  style: const TextStyle(height: 1.4),
                ),
                if ('${a['landmark'] ?? ''}'.isNotEmpty)
                  Text(
                    'Landmark: ${a['landmark']}',
                    style: const TextStyle(fontSize: 12, color: Colors.black54),
                  ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    Icon(
                      pinned ? Icons.pin_drop : Icons.pin_drop_outlined,
                      size: 14,
                      color: pinned ? pistaGreen : Colors.black38,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      pinned ? 'Map pin saved' : 'No map pin',
                      style: const TextStyle(
                        fontSize: 11,
                        color: Colors.black54,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          PopupMenuButton<String>(
            tooltip: 'Address options',
            onSelected: (v) async {
              if (v == 'edit') {
                edit(a);
              } else if (v == 'default') {
                try {
                  await book.makeDefault(a['id']);
                } catch (e) {
                  if (mounted) say('$e');
                }
              } else if (v == 'delete') {
                delete(a);
              }
            },
            itemBuilder: (_) => [
              const PopupMenuItem(value: 'edit', child: Text('Edit')),
              if (a['isDefault'] != true)
                const PopupMenuItem(
                  value: 'default',
                  child: Text('Make default'),
                ),
              const PopupMenuItem(value: 'delete', child: Text('Delete')),
            ],
          ),
        ],
      ),
    );
  }
}

/// Add or edit one saved address. Pops `true` when saved.
class AddressFormPage extends StatefulWidget {
  final CustomerModel model;
  final Map<String, dynamic>? existing;
  const AddressFormPage({super.key, required this.model, this.existing});
  @override
  State<AddressFormPage> createState() => _AddressFormPageState();
}

class _AddressFormPageState extends State<AddressFormPage> {
  final form = GlobalKey<FormState>();
  late final recipient = TextEditingController(
        text: widget.existing?['recipient'] ?? widget.model.api.userName ?? '',
      ),
      phone = TextEditingController(
        text: widget.existing?['phone'] ?? widget.model.api.userHandle ?? '',
      ),
      line1 = TextEditingController(text: widget.existing?['line1'] ?? ''),
      city = TextEditingController(
        text: widget.existing?['city'] ?? 'Shankarpally',
      ),
      postal = TextEditingController(
        text: widget.existing?['postalCode'] ?? '',
      ),
      landmark = TextEditingController(
        text: widget.existing?['landmark'] ?? '',
      ),
      custom = TextEditingController();
  late String label = () {
    final l = widget.existing?['label'] as String?;
    if (l == null) {
      return widget.model.addresses.items.isEmpty ? 'Home' : 'Other';
    }
    return _labels.contains(l) ? l : 'Other';
  }();
  late bool makeDefault =
      widget.existing?['isDefault'] == true ||
      widget.model.addresses.items.isEmpty;
  LatLng? pin;
  bool busy = false;
  String? error;

  @override
  void initState() {
    super.initState();
    final l = widget.existing?['label'] as String?;
    if (l != null && !_labels.contains(l)) custom.text = l;
    if (widget.existing != null) pin = mapPoint(widget.existing);
  }

  @override
  void dispose() {
    for (final c in [recipient, phone, line1, city, postal, landmark, custom]) {
      c.dispose();
    }
    super.dispose();
  }

  Widget field(
    String text,
    TextEditingController c, {
    TextInputType? keyboard,
    String? Function(String?)? validator,
  }) => Padding(
    padding: const EdgeInsets.only(bottom: 12),
    child: TextFormField(
      controller: c,
      enabled: !busy,
      keyboardType: keyboard,
      decoration: InputDecoration(labelText: text),
      validator:
          validator ??
          (v) => v == null || v.trim().isEmpty ? 'Enter $text' : null,
    ),
  );

  Future<void> save() async {
    if (!form.currentState!.validate()) return;
    final chosen = label == 'Other'
        ? (custom.text.trim().isEmpty ? 'Other' : custom.text.trim())
        : label;
    final address = {
      'recipient': recipient.text.trim(),
      'phone': phone.text.trim(),
      'line1': line1.text.trim(),
      'city': city.text.trim(),
      'postalCode': postal.text.trim(),
      'landmark': landmark.text.trim(),
      if (pin != null) 'latitude': pin!.latitude,
      if (pin != null) 'longitude': pin!.longitude,
    };
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final book = widget.model.addresses;
      if (widget.existing == null) {
        await book.save(address, label: chosen, makeDefault: makeDefault);
      } else {
        await book.update(
          widget.existing!['id'],
          address,
          label: chosen,
          makeDefault: makeDefault,
        );
      }
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) setState(() => error = '$e');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: const Color(0xFFFBF3E8),
    appBar: AppBar(
      title: Text(widget.existing == null ? 'Add address' : 'Edit address'),
      backgroundColor: const Color(0xFFFBF3E8),
    ),
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
            Wrap(
              spacing: 8,
              children: [
                for (final l in _labels)
                  ChoiceChip(
                    label: Text(l),
                    selected: label == l,
                    onSelected: busy ? null : (_) => setState(() => label = l),
                  ),
              ],
            ),
            if (label == 'Other')
              Padding(
                padding: const EdgeInsets.only(top: 12),
                child: TextFormField(
                  controller: custom,
                  enabled: !busy,
                  maxLength: 30,
                  decoration: const InputDecoration(
                    labelText: 'Name this address (optional)',
                    counterText: '',
                  ),
                ),
              ),
            const SizedBox(height: 16),
            field(
              'Recipient name',
              recipient,
              validator: (v) =>
                  (v?.trim().length ?? 0) < 2 ? 'Enter a recipient name' : null,
            ),
            field(
              'Phone number',
              phone,
              keyboard: TextInputType.phone,
              validator: (v) => RegExp(r'^[6-9]\d{9}$').hasMatch(v ?? '')
                  ? null
                  : 'Enter a valid 10-digit mobile number',
            ),
            field(
              'Delivery address',
              line1,
              validator: (v) => (v?.trim().length ?? 0) < 5
                  ? 'Enter the full delivery address'
                  : null,
            ),
            field('City', city),
            field(
              'Postcode',
              postal,
              keyboard: TextInputType.number,
              validator: (v) => RegExp(r'^\d{6}$').hasMatch(v ?? '')
                  ? null
                  : 'Enter a 6-digit postcode',
            ),
            field('Landmark (optional)', landmark, validator: (_) => null),
            OutlinedButton.icon(
              icon: const Icon(Icons.place_outlined),
              label: Text(
                pin == null
                    ? 'Choose delivery pin on map'
                    : 'Delivery pin selected · Change',
              ),
              onPressed: busy
                  ? null
                  : () async {
                      final point = await Navigator.push<LatLng>(
                        context,
                        MaterialPageRoute(
                          builder: (_) => AddressPinPage(
                            api: widget.model.api,
                            initial: pin,
                            outlet: mapPoint(widget.model.outletLocation),
                          ),
                        ),
                      );
                      if (point != null && mounted) setState(() => pin = point);
                    },
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Make this my default address'),
              value: makeDefault,
              onChanged: busy ? null : (v) => setState(() => makeDefault = v),
            ),
            if (error != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Text(
                  error!,
                  style: const TextStyle(color: Color(0xFF9B2C1F)),
                ),
              ),
            FilledButton(
              style: FilledButton.styleFrom(
                minimumSize: const Size.fromHeight(52),
              ),
              onPressed: busy ? null : save,
              child: Text(busy ? 'Saving…' : 'Save address'),
            ),
          ],
        ),
      ),
    ),
  );
}
