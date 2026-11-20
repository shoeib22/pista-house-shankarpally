import 'package:pista_ui/pista_ui.dart';
import 'package:pista_core/pista_core.dart';

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
  @override
  void initState() {
    super.initState();
    final a = widget.model.deliveryAddress;
    if (a != null) {
      recipient.text = a['recipient'] ?? '';
      phone.text = a['phone'] ?? '';
      line1.text = a['line1'] ?? '';
      city.text = a['city'] ?? '';
      postal.text = a['postalCode'] ?? '';
      landmark.text = a['landmark'] ?? '';
    }
  }

  @override
  void dispose() {
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
                                m.configureCheckout(
                                  mode,
                                  mode == 'delivery'
                                      ? {
                                          'recipient': recipient.text.trim(),
                                          'phone': phone.text.trim(),
                                          'line1': line1.text.trim(),
                                          'city': city.text.trim(),
                                          'postalCode': postal.text.trim(),
                                          'landmark': landmark.text.trim(),
                                        }
                                      : null,
                                );
                                await m.createOrder();
                              } else {
                                await m.verifyTestPayment();
                                if (context.mounted && m.pendingOrder == null) {
                                  Navigator.pop(context);
                                }
                              }
                            },
                      child: Text(
                        m.busy
                            ? 'Please wait…'
                            : m.pendingOrder == null
                            ? 'Save order & review payment →'
                            : 'Confirm test payment →',
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
