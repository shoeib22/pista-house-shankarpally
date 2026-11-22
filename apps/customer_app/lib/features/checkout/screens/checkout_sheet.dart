import 'package:pista_ui/pista_ui.dart';
import 'package:pista_core/pista_core.dart';
import 'package:pista_tracking/pista_tracking.dart';
import '../../payment/payment_page.dart';

class CheckoutSheet extends StatefulWidget {
  final CustomerModel model;
  const CheckoutSheet({super.key, required this.model});
  @override
  State<CheckoutSheet> createState() => _CheckoutSheetState();
}

class _CheckoutSheetState extends State<CheckoutSheet> {
  final form = GlobalKey<FormState>();
  final recipient = TextEditingController(),
      phone = TextEditingController(),
      line1 = TextEditingController(),
      city = TextEditingController(text: 'Shankarpally'),
      postal = TextEditingController(),
      landmark = TextEditingController();
  late String mode = widget.model.fulfilment;
  LatLng? pin;
  String? selectedId, selectedLabel;
  bool saveThis = true;
  @override
  void initState() {
    super.initState();
    final a = widget.model.deliveryAddress;
    if (a != null) {
      pin = mapPoint(a);
      recipient.text = a['recipient'] ?? '';
      phone.text = a['phone'] ?? '';
      line1.text = a['line1'] ?? '';
      city.text = a['city'] ?? '';
      postal.text = a['postalCode'] ?? '';
      landmark.text = a['landmark'] ?? '';
    }
    if (widget.model.api.token != null) {
      widget.model.addresses.addListener(_addressesChanged);
      widget.model.addresses.load().then((_) => _prefillDefault());
    }
  }

  void _addressesChanged() {
    if (mounted) setState(() {});
  }

  /// Fills the form from the default saved address, but never over something
  /// the customer already typed or an order that is already saved.
  void _prefillDefault() {
    final m = widget.model;
    final a = m.addresses.defaultAddress;
    if (!mounted ||
        a == null ||
        m.pendingOrder != null ||
        m.deliveryAddress != null ||
        line1.text.isNotEmpty ||
        recipient.text.isNotEmpty) {
      return;
    }
    setState(() => _apply(a));
  }

  void _apply(Map<String, dynamic> a) {
    selectedId = a['id'];
    selectedLabel = a['label'];
    recipient.text = '${a['recipient'] ?? ''}';
    phone.text = '${a['phone'] ?? ''}';
    line1.text = '${a['line1'] ?? ''}';
    city.text = '${a['city'] ?? ''}';
    postal.text = '${a['postalCode'] ?? ''}';
    landmark.text = '${a['landmark'] ?? ''}';
    pin = mapPoint(a);
  }

  Future<void> _saveAddress(Map<String, dynamic> address) async {
    try {
      await widget.model.addresses.save(
        address,
        label:
            selectedLabel ??
            (widget.model.addresses.items.isEmpty ? 'Home' : 'Other'),
      );
    } catch (_) {
      // The order is already saved; a failed address save must not block it.
    }
  }

  @override
  void dispose() {
    widget.model.addresses.removeListener(_addressesChanged);
    for (final c in [recipient, phone, line1, city, postal, landmark]) {
      c.dispose();
    }
    super.dispose();
  }

  Widget field(
    String label,
    TextEditingController controller, {
    TextInputType? keyboard,
    String? Function(String?)? validator,
  }) => Padding(
    padding: const EdgeInsets.only(bottom: 12),
    child: TextFormField(
      controller: controller,
      enabled: !widget.model.checkoutLocked && !widget.model.busy,
      keyboardType: keyboard,
      decoration: InputDecoration(labelText: label),
      validator:
          validator ??
          (value) =>
              value == null || value.trim().isEmpty ? 'Enter $label' : null,
    ),
  );
  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: widget.model,
    builder: (context, _) {
      final m = widget.model;
      return ConstrainedBox(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.sizeOf(context).height * .9,
        ),
        child: SingleChildScrollView(
          child: Padding(
            padding: EdgeInsets.fromLTRB(
              24,
              24,
              24,
              24 + MediaQuery.viewInsetsOf(context).bottom,
            ),
            child: Form(
              key: form,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    m.pendingOrder == null
                        ? 'Your order'
                        : 'Review saved order',
                    style: const TextStyle(
                      fontSize: 25,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 18),
                  if (m.pendingOrder == null) ...[
                    SegmentedButton<String>(
                      segments: const [
                        ButtonSegment(
                          value: 'pickup',
                          label: Text('Pickup'),
                          icon: Icon(Icons.shopping_bag_outlined),
                        ),
                        ButtonSegment(
                          value: 'delivery',
                          label: Text('Delivery'),
                          icon: Icon(Icons.delivery_dining_outlined),
                        ),
                      ],
                      selected: {mode},
                      onSelectionChanged: m.checkoutLocked || m.busy
                          ? null
                          : (values) => setState(() => mode = values.first),
                    ),
                    const SizedBox(height: 18),
                    if (mode == 'delivery' &&
                        widget.model.addresses.items.isNotEmpty) ...[
                      const Text(
                        'Deliver to a saved address',
                        style: TextStyle(fontWeight: FontWeight.w600),
                      ),
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 8,
                        runSpacing: 4,
                        children: [
                          for (final a in widget.model.addresses.items)
                            ChoiceChip(
                              avatar: Icon(switch (a['label']) {
                                'Home' => Icons.home_outlined,
                                'Work' => Icons.work_outline,
                                _ => Icons.place_outlined,
                              }, size: 18),
                              label: Text('${a['label']}'),
                              selected: selectedId == a['id'],
                              onSelected: m.checkoutLocked || m.busy
                                  ? null
                                  : (_) => setState(() => _apply(a)),
                            ),
                        ],
                      ),
                      const SizedBox(height: 14),
                    ],
                    if (mode == 'delivery') ...[
                      const Text(
                        'Development delivery zone: 000000. This sample postcode is not a real service area.',
                        style: TextStyle(
                          fontSize: 11,
                          color: Colors.black54,
                          height: 1.6,
                        ),
                      ),
                      const SizedBox(height: 14),
                      field(
                        'Recipient name',
                        recipient,
                        validator: (v) => (v?.trim().length ?? 0) < 2
                            ? 'Enter a recipient name'
                            : null,
                      ),
                      field(
                        'Phone number',
                        phone,
                        keyboard: TextInputType.phone,
                        validator: (v) =>
                            RegExp(r'^[6-9]\d{9}$').hasMatch(v ?? '')
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
                      field(
                        'Landmark (optional)',
                        landmark,
                        validator: (_) => null,
                      ),
                      OutlinedButton.icon(
                        icon: const Icon(Icons.place_outlined),
                        label: Text(
                          pin == null
                              ? 'Choose delivery pin on map'
                              : 'Delivery pin selected · Change',
                        ),
                        onPressed: m.checkoutLocked || m.busy
                            ? null
                            : () async {
                                final point = await Navigator.push<LatLng>(
                                  context,
                                  MaterialPageRoute(
                                    builder: (_) => AddressPinPage(
                                      api: m.api,
                                      initial: pin,
                                      outlet: mapPoint(m.outletLocation),
                                    ),
                                  ),
                                );
                                if (point != null && mounted) {
                                  setState(() => pin = point);
                                }
                              },
                      ),
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: 8),
                        child: Text(
                          'Choose the entrance for accurate tracking. PIN-code serviceability still applies.',
                          style: TextStyle(fontSize: 11, color: Colors.black54),
                        ),
                      ),
                      if (m.api.token != null)
                        CheckboxListTile(
                          contentPadding: EdgeInsets.zero,
                          controlAffinity: ListTileControlAffinity.leading,
                          title: const Text('Save this address for next time'),
                          value: saveThis,
                          onChanged: m.checkoutLocked || m.busy
                              ? null
                              : (v) => setState(() => saveThis = v ?? false),
                        ),
                    ],
                    for (final p in m.products.where(
                      (p) => m.cart.containsKey(p.id),
                    ))
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 7),
                        child: Row(
                          children: [
                            Expanded(
                              child: Text('${m.cart[p.id]} × ${p.name}'),
                            ),
                            Text(rupees(p.pricePaise * m.cart[p.id]!)),
                          ],
                        ),
                      ),
                  ] else ...[
                    Text(
                      m.pendingOrder!['fulfilment'] == 'delivery'
                          ? 'Delivery'
                          : 'Takeaway pickup',
                      style: const TextStyle(color: pistaGreen),
                    ),
                    for (final item in m.pendingOrder!['items'] as List)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 7),
                        child: Text('${item['quantity']} × ${item['name']}'),
                      ),
                    if (m.pendingOrder!['fulfilment'] == 'delivery')
                      Text(
                        'Delivery charge: ${rupees(m.pendingOrder!['deliveryPaise'] ?? 0)}',
                      ),
                  ],
                  const Divider(height: 30),
                  Text(
                    m.pendingOrder == null
                        ? 'Estimated items: ${rupees(m.estimate)}'
                        : 'Server total: ${rupees(m.pendingOrder!['totalPaise'])}',
                    style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'Sample prices and test payments. Delivery charges are checked before payment. No real money will be collected.',
                    style: TextStyle(
                      color: Colors.black54,
                      fontSize: 12,
                      height: 1.6,
                    ),
                  ),
                  if (m.pendingOrder != null)
                    const Padding(
                      padding: EdgeInsets.only(top: 12),
                      child: Text(
                        'Order saved · payment pending. Confirm the test payment to send it to the counter.',
                        style: TextStyle(color: pistaGreen, height: 1.6),
                      ),
                    ),
                  if (m.error != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 12),
                      child: Text(
                        m.error!,
                        style: const TextStyle(color: Colors.red),
                      ),
                    ),
                  const SizedBox(height: 22),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: m.busy || (m.paused && m.pendingOrder == null)
                          ? null
                          : () async {
                              if (m.pendingOrder == null) {
                                if (!form.currentState!.validate()) return;
                                final address = mode == 'delivery'
                                    ? <String, dynamic>{
                                        'recipient': recipient.text.trim(),
                                        'phone': phone.text.trim(),
                                        'line1': line1.text.trim(),
                                        'city': city.text.trim(),
                                        'postalCode': postal.text.trim(),
                                        'landmark': landmark.text.trim(),
                                        if (pin != null)
                                          'latitude': pin!.latitude,
                                        if (pin != null)
                                          'longitude': pin!.longitude,
                                      }
                                    : null;
                                m.configureCheckout(mode, address);
                                await m.createOrder();
                                if (address != null &&
                                    saveThis &&
                                    m.pendingOrder != null &&
                                    m.api.token != null) {
                                  _saveAddress(address);
                                }
                              } else {
                                final order = m.pendingOrder!;
                                final paid = await Navigator.push<bool>(
                                  context,
                                  MaterialPageRoute(
                                    builder: (_) => PaymentPage(
                                      api: m.api,
                                      orderId: '${order['id']}',
                                      orderNumber:
                                          (order['number'] as num?)?.toInt() ??
                                          0,
                                      items: (order['items'] as List? ?? [])
                                          .map(
                                            (i) => Map<String, dynamic>.from(i),
                                          )
                                          .toList(),
                                      deliveryPaise:
                                          (order['deliveryPaise'] as num?)
                                              ?.toInt() ??
                                          0,
                                    ),
                                  ),
                                );
                                if (paid == true) {
                                  await m.paymentFinished();
                                  if (context.mounted) Navigator.pop(context);
                                } else {
                                  await m.refresh();
                                }
                              }
                            },
                      child: Text(
                        m.busy
                            ? 'Please wait…'
                            : m.pendingOrder == null
                            ? 'Save order & review payment →'
                            : 'Pay ${rupees(m.pendingOrder!['totalPaise'] as int)} →',
                      ),
                    ),
                  ),
                  const SizedBox(height: 10),
                ],
              ),
            ),
          ),
        ),
      );
    },
  );
}
