import 'dart:async';
import 'package:pista_ui/pista_ui.dart';
import 'package:pista_core/pista_core.dart';
import 'payment_launcher.dart';

enum _Stage {
  loading,
  ready,
  starting,
  confirming,
  paid,
  pending,
  failed,
  expired,
}

/// Pays for a saved order. The server owns the amount and decides when the
/// order is paid; this page only starts the payment, opens the checkout, and
/// then keeps asking the server what happened. Pops `true` once it is paid.
class PaymentPage extends StatefulWidget {
  final PistaApi api;
  final String orderId;
  final int orderNumber;
  final List<Map<String, dynamic>> items;
  final int deliveryPaise;

  /// Replaced in tests; by default the launcher matching the server's provider.
  final PaymentLauncher? launcher;
  final Duration pollEvery, giveUpAfter;
  const PaymentPage({
    super.key,
    required this.api,
    required this.orderId,
    required this.orderNumber,
    this.items = const [],
    this.deliveryPaise = 0,
    this.launcher,
    this.pollEvery = const Duration(seconds: 3),
    this.giveUpAfter = const Duration(seconds: 90),
  });
  @override
  State<PaymentPage> createState() => _PaymentPageState();
}

class _PaymentPageState extends State<PaymentPage> {
  _Stage stage = _Stage.loading;
  Map<String, dynamic>? status;
  Map<String, dynamic>? config;
  PaymentSession? session;
  String? message;
  Timer? poller;
  Map<String, dynamic>? lastProof;
  int polls = 0;
  bool checking = false;

  int get amount => (status?['amountPaise'] as num?)?.toInt() ?? 0;

  @override
  void initState() {
    super.initState();
    load();
  }

  @override
  void dispose() {
    poller?.cancel();
    super.dispose();
  }

  void set(_Stage next, {String? note}) {
    if (!mounted) return;
    setState(() {
      stage = next;
      message = note;
    });
  }

  Future<void> load() async {
    try {
      final results = await Future.wait([
        widget.api.paymentConfig(),
        widget.api.paymentStatus(widget.orderId),
      ]);
      config = results[0];
      apply(results[1]);
    } catch (e) {
      set(_Stage.failed, note: '$e');
    }
  }

  /// Turns the server's answer into what the customer sees.
  void apply(Map<String, dynamic> s) {
    status = s;
    final payment = s['payment'] as Map?;
    final p = payment?['status'];
    if (s['orderPaymentStatus'] == 'paid' || p == 'paid') {
      poller?.cancel();
      set(_Stage.paid);
    } else if (s['orderPaymentStatus'] == 'refunded') {
      set(_Stage.failed, note: 'This order was refunded.');
    } else if (p == 'created' && stage == _Stage.confirming) {
      // Still waiting on the bank; the poller keeps asking.
      if (mounted) setState(() {});
    } else if (p == 'failed' && stage == _Stage.confirming) {
      poller?.cancel();
      set(
        _Stage.failed,
        note:
            '${payment?['failureReason'] ?? 'The payment did not go through.'}',
      );
    } else if (p == 'expired' && stage == _Stage.confirming) {
      poller?.cancel();
      set(_Stage.expired);
    } else if (stage == _Stage.loading) {
      set(_Stage.ready);
    } else if (mounted) {
      setState(() {});
    }
  }

  Future<void> pay() async {
    set(_Stage.starting);
    try {
      final started = await widget.api.startPayment(widget.orderId);
      session = PaymentSession(started);
    } catch (e) {
      set(_Stage.failed, note: '$e');
      return;
    }
    if (!mounted) return;
    final launcher = widget.launcher ?? launcherFor(session!, widget.api);
    LaunchResult result;
    try {
      result = await launcher.launch(context, session!);
    } catch (e) {
      result = LaunchResult(LaunchOutcome.failed, message: '$e');
    }
    if (!mounted) return;
    switch (result.outcome) {
      case LaunchOutcome.cancelled:
        set(
          _Stage.ready,
          note: 'Payment cancelled. You have not been charged.',
        );
      case LaunchOutcome.failed:
        // The gateway said it failed, but the server decides: look once more.
        lastProof = result.proof;
        await confirm(note: result.message, treatNoResultAsFailure: true);
      case LaunchOutcome.completed:
        lastProof = result.proof;
        startConfirming();
    }
  }

  void startConfirming() {
    polls = 0;
    set(_Stage.confirming);
    poller?.cancel();
    confirm();
    poller = Timer.periodic(widget.pollEvery, (_) {
      polls++;
      confirm();
    });
  }

  /// Asks the server to check with the gateway. Never marks anything paid itself.
  Future<void> confirm({
    String? note,
    bool treatNoResultAsFailure = false,
  }) async {
    if (checking || session == null) return;
    checking = true;
    try {
      final proof = lastProof;
      final s = await widget.api.confirmPayment(
        session!.paymentId,
        result: proof,
      );
      if (!mounted) return;
      if (treatNoResultAsFailure && s['orderPaymentStatus'] != 'paid') {
        status = s;
        set(_Stage.failed, note: note ?? 'The payment did not go through.');
        return;
      }
      apply(s);
      if (stage == _Stage.confirming &&
          polls * widget.pollEvery.inMilliseconds >=
              widget.giveUpAfter.inMilliseconds) {
        poller?.cancel();
        set(_Stage.pending);
      }
    } catch (e) {
      if (mounted && stage != _Stage.confirming) {
        set(_Stage.failed, note: '$e');
      }
      // While confirming, a network blip just means "ask again".
    } finally {
      checking = false;
    }
  }

  Future<void> checkAgain() async {
    polls = 0;
    set(_Stage.confirming);
    poller?.cancel();
    await confirm();
    poller = Timer.periodic(widget.pollEvery, (_) {
      polls++;
      confirm();
    });
  }

  @override
  Widget build(BuildContext context) => PopScope(
    canPop: stage != _Stage.confirming && stage != _Stage.starting,
    child: Scaffold(
      backgroundColor: const Color(0xFFFBF3E8),
      appBar: AppBar(
        backgroundColor: const Color(0xFFFBF3E8),
        title: const Text('Payment'),
        automaticallyImplyLeading:
            stage != _Stage.confirming && stage != _Stage.starting,
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            switch (stage) {
              _Stage.loading => const Padding(
                padding: EdgeInsets.symmetric(vertical: 60),
                child: Center(child: CircularProgressIndicator()),
              ),
              _Stage.paid => _paid(),
              _ => _body(),
            },
          ],
        ),
      ),
    ),
  );

  Widget _summary() => Container(
    padding: const EdgeInsets.all(18),
    decoration: BoxDecoration(
      color: const Color(0xFFFFFAF3),
      borderRadius: BorderRadius.circular(20),
      border: Border.all(color: const Color(0xFFE1D4BC)),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Order #PH${'${widget.orderNumber}'.padLeft(4, '0')}',
          style: const TextStyle(fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 8),
        for (final i in widget.items)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 2),
            child: Text('${i['quantity']} × ${i['name']}'),
          ),
        if (widget.deliveryPaise > 0)
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Text('Delivery charge: ${rupees(widget.deliveryPaise)}'),
          ),
        const Divider(height: 24),
        Row(
          children: [
            const Expanded(
              child: Text(
                'Total to pay',
                style: TextStyle(fontWeight: FontWeight.w600),
              ),
            ),
            Text(
              rupees(amount),
              style: const TextStyle(
                fontFamily: 'packages/pista_ui/HouseSerif',
                fontSize: 30,
                fontWeight: FontWeight.w700,
                color: pistaGreen,
              ),
            ),
          ],
        ),
      ],
    ),
  );

  Widget _paid() => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      const SizedBox(height: 24),
      const Icon(Icons.check_circle, size: 72, color: pistaGreen),
      const SizedBox(height: 14),
      const Text(
        'Payment received',
        textAlign: TextAlign.center,
        style: TextStyle(
          fontFamily: 'packages/pista_ui/HouseSerif',
          fontSize: 32,
          fontWeight: FontWeight.w600,
          color: pistaGreen,
        ),
      ),
      const SizedBox(height: 8),
      Text(
        '${rupees(amount)} paid for order #PH${'${widget.orderNumber}'.padLeft(4, '0')}. The outlet has your order.',
        textAlign: TextAlign.center,
        style: const TextStyle(height: 1.5),
      ),
      if (config?['simulated'] == true)
        const Padding(
          padding: EdgeInsets.only(top: 10),
          child: Text(
            'Test payment: no money moved.',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 12, color: Colors.black54),
          ),
        ),
      const SizedBox(height: 28),
      FilledButton(
        style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(52)),
        onPressed: () => Navigator.pop(context, true),
        child: const Text('View my order'),
      ),
    ],
  );

  Widget _body() {
    final simulated = config?['simulated'] == true;
    final canRetry = status?['canRetry'] == true;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _summary(),
        const SizedBox(height: 16),
        if (simulated)
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFFEFE3C8),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Text(
              'Private beta: this is a test payment. No real money is charged.',
              style: TextStyle(fontSize: 12, height: 1.4),
            ),
          ),
        const SizedBox(height: 16),
        if (message != null && stage != _Stage.failed)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Text(message!, style: const TextStyle(height: 1.5)),
          ),
        switch (stage) {
          _Stage.ready || _Stage.starting => FilledButton(
            style: FilledButton.styleFrom(
              minimumSize: const Size.fromHeight(54),
            ),
            onPressed: stage == _Stage.starting ? null : pay,
            child: Text(
              stage == _Stage.starting ? 'Starting…' : 'Pay ${rupees(amount)}',
            ),
          ),
          _Stage.confirming => const Column(
            children: [
              SizedBox(height: 8),
              CircularProgressIndicator(),
              SizedBox(height: 16),
              Text(
                'Confirming your payment with the bank…',
                textAlign: TextAlign.center,
                style: TextStyle(fontWeight: FontWeight.w600),
              ),
              SizedBox(height: 6),
              Text(
                'Please wait and do not pay again. This can take a minute for UPI.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 12,
                  color: Colors.black54,
                  height: 1.5,
                ),
              ),
            ],
          ),
          _Stage.pending => Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'Your bank has not confirmed yet',
                style: TextStyle(fontWeight: FontWeight.w700, fontSize: 17),
              ),
              const SizedBox(height: 6),
              const Text(
                'If money left your account, do not pay again. We will update your order as soon as the bank confirms, or refund you. You can close this page.',
                style: TextStyle(height: 1.5),
              ),
              const SizedBox(height: 14),
              FilledButton(
                onPressed: checkAgain,
                child: const Text('Check again'),
              ),
              TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: const Text('Close'),
              ),
            ],
          ),
          _Stage.expired => Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'This payment timed out',
                style: TextStyle(fontWeight: FontWeight.w700, fontSize: 17),
              ),
              const SizedBox(height: 6),
              const Text(
                'You have not been charged. If your bank did take money, it will be refunded automatically.',
                style: TextStyle(height: 1.5),
              ),
              const SizedBox(height: 14),
              FilledButton(
                onPressed: pay,
                child: const Text('Start payment again'),
              ),
            ],
          ),
          _Stage.failed => Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                message ?? 'The payment did not go through.',
                style: const TextStyle(color: Color(0xFF9B2C1F), height: 1.5),
              ),
              const SizedBox(height: 14),
              if (canRetry || status == null)
                FilledButton(onPressed: pay, child: const Text('Try again'))
              else
                const Text(
                  'You cannot retry this payment from the app. Please contact the outlet.',
                  style: TextStyle(height: 1.5),
                ),
              TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: const Text('Back'),
              ),
            ],
          ),
          _ => const SizedBox.shrink(),
        },
        const SizedBox(height: 16),
        const Text(
          'Payments are processed by our payment partner. We never see or store your card, UPI PIN or bank details.',
          style: TextStyle(fontSize: 11, color: Colors.black54, height: 1.5),
        ),
      ],
    );
  }
}
