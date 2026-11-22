import 'package:flutter_test/flutter_test.dart';
import 'package:pista_core/pista_core.dart';
import 'package:pista_customer/features/payment/payment_launcher.dart';
import 'package:pista_customer/features/payment/payment_page.dart';
import 'package:pista_ui/pista_ui.dart';

/// A fake server whose payment state the test controls.
class PayApi extends PistaApi {
  bool simulated = true;
  String payment = 'created', order = 'pending';
  bool canRetry = true, hasPayment = false;
  String? failureReason;
  void Function(PayApi)? onConfirm;
  void markPaid() {
    payment = 'paid';
    order = 'paid';
  }

  final calls = <String>[];
  Map? lastConfirmBody;
  int confirms = 0, sessions = 0;
  Map<String, dynamic> status() => {
    'orderId': 'o1',
    'orderPaymentStatus': order,
    'amountPaise': 31900,
    'payment': hasPayment
        ? {
            'id': 'p1',
            'status': payment,
            'failureReason': failureReason,
            'method': 'upi',
          }
        : null,
    'attempts': hasPayment ? 1 : 0,
    'canRetry': canRetry,
    'refundedPaise': 0,
    'refunds': [],
  };
  @override
  Future<dynamic> request(
    String path, {
    String method = 'GET',
    Object? body,
    String? idempotencyKey,
  }) async {
    calls.add('$method $path');
    if (path == '/payments/config') {
      return {
        'provider': simulated ? 'simulated' : 'razorpay',
        'simulated': simulated,
        'currency': 'INR',
      };
    }
    if (path == '/orders/o1/payment') return status();
    if (path == '/orders/o1/payments') {
      sessions++;
      hasPayment = true;
      payment = 'created';
      return {
        'paymentId': 'p1',
        'provider': simulated ? 'simulated' : 'razorpay',
        'simulated': simulated,
        'amountPaise': 31900,
        'currency': 'INR',
        'expiresAt': DateTime.now()
            .add(const Duration(minutes: 15))
            .toUtc()
            .toIso8601String(),
        'clientParams': {'keyId': 'rzp_test_x', 'orderId': 'order_1'},
      };
    }
    if (path == '/payments/p1/confirm') {
      confirms++;
      lastConfirmBody = body == null ? null : Map.from(body as Map);
      onConfirm?.call(this);
      return status();
    }
    throw StateError('Unexpected $method $path');
  }
}

class FakeLauncher implements PaymentLauncher {
  LaunchResult result;
  int launches = 0;
  FakeLauncher(this.result);
  @override
  Future<LaunchResult> launch(context, PaymentSession session) async {
    launches++;
    return result;
  }
}

Widget app(PaymentPage page) => MaterialApp(theme: pistaTheme(), home: page);
PaymentPage page(
  PayApi api, {
  PaymentLauncher? launcher,
  Duration giveUp = const Duration(milliseconds: 300),
}) => PaymentPage(
  api: api,
  orderId: 'o1',
  orderNumber: 7,
  items: const [
    {'name': 'Chicken Dum Biryani', 'quantity': 1},
  ],
  deliveryPaise: 2000,
  launcher: launcher,
  pollEvery: const Duration(milliseconds: 50),
  giveUpAfter: giveUp,
);

Future<void> settle(WidgetTester tester, [int steps = 12]) async {
  for (var i = 0; i < steps; i++) {
    await tester.pump(const Duration(milliseconds: 50));
  }
}

void main() {
  testWidgets(
    'shows the server total and a test banner, then pays and shows success',
    (tester) async {
      final api = PayApi()..onConfirm = (a) => a.markPaid();
      final launcher = FakeLauncher(
        const LaunchResult(LaunchOutcome.completed),
      );
      bool? result;
      await tester.pumpWidget(
        MaterialApp(
          theme: pistaTheme(),
          home: Builder(
            builder: (context) => Scaffold(
              body: FilledButton(
                onPressed: () async => result = await Navigator.push<bool>(
                  context,
                  MaterialPageRoute(
                    builder: (_) => page(api, launcher: launcher),
                  ),
                ),
                child: const Text('open'),
              ),
            ),
          ),
        ),
      );
      await tester.tap(find.text('open'));
      await settle(tester);
      expect(
        find.text('₹319'),
        findsOneWidget,
        reason: 'the server’s total, not the app’s',
      );
      expect(find.text('Order #PH0007'), findsOneWidget);
      expect(find.text('1 × Chicken Dum Biryani'), findsOneWidget);
      expect(find.textContaining('Delivery charge: ₹20'), findsOneWidget);
      expect(find.textContaining('No real money is charged'), findsOneWidget);
      await tester.tap(find.widgetWithText(FilledButton, 'Pay ₹319'));
      await settle(tester);
      expect(launcher.launches, 1);
      expect(api.calls, contains('POST /orders/o1/payments'));
      expect(find.text('Payment received'), findsOneWidget);
      expect(
        find.textContaining('Test payment: no money moved'),
        findsOneWidget,
      );
      await tester.tap(find.text('View my order'));
      await settle(tester);
      expect(result, isTrue);
    },
  );

  testWidgets(
    'the gateway proof is passed to the server, which does the deciding',
    (tester) async {
      final api = PayApi()..onConfirm = (a) => a.markPaid();
      final proof = {
        'razorpay_payment_id': 'pay_1',
        'razorpay_order_id': 'order_1',
        'razorpay_signature': 'abc',
      };
      await tester.pumpWidget(
        app(
          page(
            api,
            launcher: FakeLauncher(
              LaunchResult(LaunchOutcome.completed, proof: proof),
            ),
          ),
        ),
      );
      await settle(tester);
      await tester.tap(find.widgetWithText(FilledButton, 'Pay ₹319'));
      await settle(tester);
      expect(api.lastConfirmBody, {'result': proof});
      expect(find.text('Payment received'), findsOneWidget);
      await tester.pumpWidget(const SizedBox());
    },
  );

  testWidgets(
    'a bank that is slow stays pending without paying twice, then can be checked again',
    (tester) async {
      final api = PayApi();
      await tester.pumpWidget(
        app(
          page(
            api,
            launcher: FakeLauncher(const LaunchResult(LaunchOutcome.completed)),
          ),
        ),
      );
      await settle(tester);
      await tester.tap(find.widgetWithText(FilledButton, 'Pay ₹319'));
      await settle(tester, 4);
      expect(find.textContaining('Confirming your payment'), findsOneWidget);
      expect(find.textContaining('do not pay again'), findsOneWidget);
      await settle(tester, 20);
      expect(find.text('Your bank has not confirmed yet'), findsOneWidget);
      expect(find.textContaining('do not pay again'), findsOneWidget);
      expect(
        find.widgetWithText(FilledButton, 'Pay ₹319'),
        findsNothing,
        reason: 'no second payment is offered',
      );
      expect(api.sessions, 1);
      api.onConfirm = (a) => a.markPaid();
      await tester.tap(find.text('Check again'));
      await settle(tester);
      expect(find.text('Payment received'), findsOneWidget);
      await tester.pumpWidget(const SizedBox());
    },
  );

  testWidgets('a declined payment shows why and offers another try', (
    tester,
  ) async {
    final api = PayApi()
      ..failureReason = 'Card declined by your bank'
      ..onConfirm = (a) => a.payment = 'failed';
    final launcher = FakeLauncher(
      const LaunchResult(
        LaunchOutcome.failed,
        message: 'Card declined by your bank',
      ),
    );
    await tester.pumpWidget(app(page(api, launcher: launcher)));
    await settle(tester);
    await tester.tap(find.widgetWithText(FilledButton, 'Pay ₹319'));
    await settle(tester);
    expect(find.text('Card declined by your bank'), findsOneWidget);
    expect(find.text('Try again'), findsOneWidget);
    expect(api.order, 'pending');
    launcher.result = const LaunchResult(LaunchOutcome.completed);
    api.onConfirm = (a) => a.markPaid();
    await tester.tap(find.text('Try again'));
    await settle(tester);
    expect(api.sessions, 2, reason: 'a fresh session for the retry');
    expect(find.text('Payment received'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('closing the checkout is not a failure and does not charge', (
    tester,
  ) async {
    final api = PayApi();
    await tester.pumpWidget(
      app(
        page(
          api,
          launcher: FakeLauncher(const LaunchResult(LaunchOutcome.cancelled)),
        ),
      ),
    );
    await settle(tester);
    await tester.tap(find.widgetWithText(FilledButton, 'Pay ₹319'));
    await settle(tester);
    expect(
      find.textContaining('Payment cancelled. You have not been charged'),
      findsOneWidget,
    );
    expect(find.widgetWithText(FilledButton, 'Pay ₹319'), findsOneWidget);
    expect(api.confirms, 0);
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('an expired session can be started again', (tester) async {
    final api = PayApi()..onConfirm = (a) => a.payment = 'expired';
    await tester.pumpWidget(
      app(
        page(
          api,
          launcher: FakeLauncher(const LaunchResult(LaunchOutcome.completed)),
        ),
      ),
    );
    await settle(tester);
    await tester.tap(find.widgetWithText(FilledButton, 'Pay ₹319'));
    await settle(tester);
    expect(find.text('This payment timed out'), findsOneWidget);
    expect(find.textContaining('refunded automatically'), findsOneWidget);
    expect(find.text('Start payment again'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('an order that is already paid goes straight to the receipt', (
    tester,
  ) async {
    final api = PayApi()
      ..order = 'paid'
      ..payment = 'paid'
      ..hasPayment = true;
    await tester.pumpWidget(app(page(api)));
    await settle(tester);
    expect(find.text('Payment received'), findsOneWidget);
    expect(api.sessions, 0);
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets(
    'a real gateway that is not installed in this build says so, and pays nothing',
    (tester) async {
      final api = PayApi()..simulated = false;
      await tester.pumpWidget(app(page(api)));
      await settle(tester);
      expect(find.textContaining('No real money'), findsNothing);
      await tester.tap(find.widgetWithText(FilledButton, 'Pay ₹319'));
      await settle(tester);
      expect(
        find.textContaining('does not include the razorpay checkout'),
        findsOneWidget,
      );
      expect(find.text('Payment received'), findsNothing);
      expect(api.order, 'pending');
      await tester.pumpWidget(const SizedBox());
    },
  );

  testWidgets('the built-in test checkout lets a tester choose the outcome', (
    tester,
  ) async {
    final calls = <String>[];
    final api = _SimApi(calls);
    await tester.pumpWidget(app(page(api)));
    await settle(tester);
    await tester.tap(find.widgetWithText(FilledButton, 'Pay ₹319'));
    await settle(tester);
    expect(find.text('Test payment'), findsOneWidget);
    expect(find.text('Pay successfully'), findsOneWidget);
    expect(find.text('Decline the payment'), findsOneWidget);
    expect(find.textContaining('slow UPI'), findsOneWidget);
    await tester.tap(find.text('Decline the payment'));
    await settle(tester, 20);
    expect(calls, contains('POST /payments/p1/simulate {outcome: failure}'));
    expect(find.text('The test payment was declined.'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
  });
}

class _SimApi extends PayApi {
  final List<String> log;
  _SimApi(this.log);
  @override
  Future<dynamic> request(
    String path, {
    String method = 'GET',
    Object? body,
    String? idempotencyKey,
  }) async {
    if (path == '/payments/p1/simulate') {
      log.add('$method $path $body');
      payment = (body as Map)['outcome'] == 'failure' ? 'failed' : 'paid';
      if (payment == 'paid') order = 'paid';
      return status();
    }
    return super.request(
      path,
      method: method,
      body: body,
      idempotencyKey: idempotencyKey,
    );
  }
}
