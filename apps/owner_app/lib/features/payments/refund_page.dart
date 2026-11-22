import 'package:pista_ui/pista_ui.dart';
import 'package:pista_core/pista_core.dart';

const _reasons = [
  'Order rejected',
  'Item unavailable',
  'Late delivery',
  'Quality complaint',
  'Wrong or missing item',
  'Duplicate payment',
  'Other',
];

/// Refunds an order's payment, fully or partly. Owner only (the server enforces
/// it). A refund goes back to the customer's original payment method and cannot
/// be undone, so nothing is sent until the owner confirms.
class RefundPage extends StatefulWidget {
  final PistaApi api;
  final Map<String, dynamic> order;
  const RefundPage({super.key, required this.api, required this.order});
  @override
  State<RefundPage> createState() => _RefundPageState();
}

class _RefundPageState extends State<RefundPage> {
  Map<String, dynamic>? status;
  bool loading = true, busy = false, full = true;
  String? error, done;
  String reason = _reasons.first;
  final amount = TextEditingController(), detail = TextEditingController();
  final form = GlobalKey<FormState>();

  // A retry of the SAME refund reuses its key (so a flaky connection can never
  // refund twice). Changing the amount or reason starts a new refund.
  String? _key, _signature;

  String get orderId => '${widget.order['id']}';
  int get paid =>
      ((status?['payment'] as Map?)?['amountPaise'] as num?)?.toInt() ??
      (status?['amountPaise'] as num?)?.toInt() ??
      0;
  int get refunded => (status?['refundedPaise'] as num?)?.toInt() ?? 0;
  int get remaining => paid - refunded;
  bool get isPaid => status?['orderPaymentStatus'] == 'paid';

  @override
  void initState() {
    super.initState();
    load();
  }

  @override
  void dispose() {
    amount.dispose();
    detail.dispose();
    super.dispose();
  }

  Future<void> load() async {
    try {
      final s = Map<String, dynamic>.from(
        await widget.api.request('/orders/$orderId/payment'),
      );
      if (mounted) {
        setState(() {
          status = s;
          loading = false;
          error = null;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          error = '$e';
          loading = false;
        });
      }
    }
  }

  /// Rupees typed by the owner to paise, or null if it is not a valid amount.
  int? parseRupees(String text) {
    final t = text.trim();
    if (!RegExp(r'^\d{1,6}(\.\d{1,2})?$').hasMatch(t)) return null;
    return (double.parse(t) * 100).round();
  }

  String get reasonText {
    final extra = detail.text.trim();
    final r = extra.isEmpty ? reason : '$reason: $extra';
    return r.length > 200 ? r.substring(0, 200) : r;
  }

  Future<void> submit() async {
    if (!form.currentState!.validate()) return;
    final paise = full ? remaining : parseRupees(amount.text)!;
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Refund ${rupees(paise)}?'),
        content: Text(
          'This sends ${rupees(paise)} back to the customer’s original payment method for order #PH${'${widget.order['number']}'.padLeft(4, '0')}. A refund cannot be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Not yet'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Refund'),
          ),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    final signature = '$paise|$reasonText';
    if (_signature != signature) {
      _key = requestKey();
      _signature = signature;
    }
    setState(() {
      busy = true;
      error = null;
      done = null;
    });
    try {
      await widget.api.request(
        '/orders/$orderId/refunds',
        method: 'POST',
        body: {'amountPaise': paise, 'reason': reasonText},
        idempotencyKey: _key,
      );
      await load();
      if (mounted) {
        setState(() {
          done = '${rupees(paise)} refund submitted.';
          amount.clear();
          detail.clear();
          full = true;
          _key = _signature = null;
        });
      }
    } catch (e) {
      if (mounted) setState(() => error = '$e');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: Text('Refund #PH${'${widget.order['number']}'.padLeft(4, '0')}'),
    ),
    body: loading
        ? const Center(child: CircularProgressIndicator())
        : ListView(
            padding: const EdgeInsets.all(22),
            children: [
              if (status == null)
                Text(
                  error ?? 'Could not load the payment.',
                  style: const TextStyle(color: Colors.red),
                )
              else ...[
                _summary(),
                const SizedBox(height: 18),
                if (done != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 14),
                    child: Text(
                      done!,
                      style: const TextStyle(
                        color: pistaGreen,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                if (!isPaid && refunded == 0)
                  const Text(
                    'This order has not been paid, so there is nothing to refund.',
                  )
                else if (remaining <= 0)
                  const Text(
                    'This payment has been refunded in full.',
                    style: TextStyle(fontWeight: FontWeight.w600),
                  )
                else
                  _formCard(),
                if (error != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 14),
                    child: Text(
                      error!,
                      style: const TextStyle(color: Colors.red),
                    ),
                  ),
                _history(),
              ],
            ],
          ),
  );

  Widget _summary() => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      border: Border.all(color: const Color(0xFFE0E4D8)),
      borderRadius: BorderRadius.circular(12),
    ),
    child: Column(
      children: [
        _row('Paid', rupees(paid)),
        _row('Already refunded', rupees(refunded)),
        const Divider(),
        _row(
          'Left to refund',
          rupees(remaining < 0 ? 0 : remaining),
          bold: true,
        ),
        if ((status?['payment'] as Map?)?['method'] != null)
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Align(
              alignment: Alignment.centerLeft,
              child: Text(
                'Paid by ${(status!['payment'] as Map)['method']}',
                style: const TextStyle(fontSize: 12, color: Colors.black54),
              ),
            ),
          ),
      ],
    ),
  );

  Widget _row(String label, String value, {bool bold = false}) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 3),
    child: Row(
      children: [
        Expanded(child: Text(label)),
        Text(
          value,
          style: TextStyle(
            fontWeight: bold ? FontWeight.w700 : FontWeight.w500,
          ),
        ),
      ],
    ),
  );

  Widget _formCard() => Form(
    key: form,
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SegmentedButton<bool>(
          segments: [
            ButtonSegment(value: true, label: Text('All ${rupees(remaining)}')),
            const ButtonSegment(value: false, label: Text('Part of it')),
          ],
          selected: {full},
          onSelectionChanged: busy
              ? null
              : (v) => setState(() => full = v.first),
        ),
        if (!full)
          Padding(
            padding: const EdgeInsets.only(top: 14),
            child: TextFormField(
              controller: amount,
              enabled: !busy,
              keyboardType: const TextInputType.numberWithOptions(
                decimal: true,
              ),
              decoration: const InputDecoration(
                labelText: 'Amount to refund (₹)',
                prefixText: '₹ ',
              ),
              validator: (v) {
                final p = parseRupees(v ?? '');
                if (p == null || p <= 0) {
                  return 'Enter an amount like 50 or 49.50';
                }
                if (p > remaining) {
                  return 'At most ${rupees(remaining)} can be refunded';
                }
                return null;
              },
            ),
          ),
        const SizedBox(height: 14),
        DropdownButtonFormField<String>(
          initialValue: reason,
          decoration: const InputDecoration(labelText: 'Reason'),
          items: [
            for (final r in _reasons)
              DropdownMenuItem(value: r, child: Text(r)),
          ],
          onChanged: busy ? null : (v) => setState(() => reason = v ?? reason),
        ),
        const SizedBox(height: 14),
        TextFormField(
          controller: detail,
          enabled: !busy,
          maxLength: 150,
          decoration: InputDecoration(
            labelText: reason == 'Other'
                ? 'Describe the reason'
                : 'Details (optional)',
          ),
          validator: (v) => reason == 'Other' && (v?.trim().length ?? 0) < 3
              ? 'Add a few words'
              : null,
        ),
        const SizedBox(height: 8),
        FilledButton(
          style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(52)),
          onPressed: busy ? null : submit,
          child: Text(busy ? 'Sending…' : 'Refund to customer'),
        ),
        const SizedBox(height: 8),
        const Text(
          'The money goes back to the customer’s original payment method. Banks can take 5 to 7 working days. A full refund is only allowed once the order is rejected or finished.',
          style: TextStyle(fontSize: 11, color: Colors.black54, height: 1.5),
        ),
      ],
    ),
  );

  Widget _history() {
    final refunds = (status?['refunds'] as List? ?? []);
    if (refunds.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(top: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Refund history',
            style: TextStyle(fontSize: 17, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 8),
          for (final r in refunds)
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: Icon(switch (r['status']) {
                'succeeded' => Icons.check_circle_outline,
                'failed' => Icons.error_outline,
                _ => Icons.schedule,
              }, color: r['status'] == 'failed' ? Colors.red : pistaGreen),
              title: Text(rupees((r['amountPaise'] as num).toInt())),
              subtitle: Text('${r['reason']}\n${_label('${r['status']}')}'),
              isThreeLine: true,
            ),
        ],
      ),
    );
  }

  String _label(String s) => switch (s) {
    'succeeded' => 'Refunded',
    'processing' => 'On its way to the customer',
    'requested' => 'Being sent',
    'failed' => 'Failed. Try again with a new request',
    _ => s,
  };
}
