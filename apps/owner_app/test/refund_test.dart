import 'package:flutter_test/flutter_test.dart';
import 'package:pista_core/pista_core.dart';
import 'package:pista_owner/features/payments/refund_page.dart';
import 'package:pista_ui/pista_ui.dart';

class RefundApi extends PistaApi {
  int paid = 31900, refunded = 0;
  String orderState = 'paid';
  bool failNext = false;
  final posts = <Map<String, dynamic>>[];
  final keys = <String?>[];
  final refunds = <Map<String, dynamic>>[];
  @override
  Future<dynamic> request(
    String path, {
    String method = 'GET',
    Object? body,
    String? idempotencyKey,
  }) async {
    if (path == '/orders/o1/payment') {
      return {
        'orderId': 'o1',
        'orderPaymentStatus': orderState,
        'amountPaise': paid,
        'payment': {
          'id': 'p1',
          'status': 'paid',
          'amountPaise': paid,
          'method': 'upi',
        },
        'refundedPaise': refunded,
        'refunds': refunds,
      };
    }
    if (path == '/orders/o1/refunds' && method == 'POST') {
      posts.add(Map<String, dynamic>.from(body as Map));
      keys.add(idempotencyKey);
      if (failNext) {
        failNext = false;
        throw ApiException(
          'The payment provider could not process the refund.',
          502,
        );
      }
      final amount = body['amountPaise'] as int;
      refunded += amount;
      if (refunded >= paid) orderState = 'refunded';
      refunds.insert(0, {
        'id': 'r${refunds.length}',
        'amountPaise': amount,
        'status': 'processing',
        'reason': body['reason'],
      });
      return {'id': 'r1', 'status': 'processing'};
    }
    throw StateError('Unexpected $method $path');
  }
}

Widget app(RefundApi api) => MaterialApp(
  theme: pistaTheme(),
  home: RefundPage(api: api, order: const {'id': 'o1', 'number': 12}),
);

Future<void> settle(WidgetTester tester) async {
  await tester.pumpAndSettle(const Duration(milliseconds: 100));
}

void main() {
  testWidgets(
    'shows what was paid and what is left, and refunds it all after confirming',
    (tester) async {
      final api = RefundApi();
      await tester.pumpWidget(app(api));
      await settle(tester);
      expect(find.text('Refund #PH0012'), findsOneWidget);
      expect(find.text('₹319'), findsWidgets);
      expect(find.text('Left to refund'), findsOneWidget);
      expect(find.text('All ₹319'), findsOneWidget);
      await tester.tap(find.widgetWithText(FilledButton, 'Refund to customer'));
      await settle(tester);
      expect(find.text('Refund ₹319?'), findsOneWidget, reason: 'asks first');
      expect(api.posts, isEmpty, reason: 'nothing is sent before confirming');
      await tester.tap(find.text('Not yet'));
      await settle(tester);
      expect(api.posts, isEmpty);
      await tester.tap(find.widgetWithText(FilledButton, 'Refund to customer'));
      await settle(tester);
      await tester.tap(find.widgetWithText(FilledButton, 'Refund'));
      await settle(tester);
      expect(api.posts.single, {
        'amountPaise': 31900,
        'reason': 'Order rejected',
      });
      expect(api.keys.single, isNotNull);
      expect(find.text('₹319 refund submitted.'), findsOneWidget);
      expect(
        find.text('This payment has been refunded in full.'),
        findsOneWidget,
      );
      expect(find.text('Refund history'), findsOneWidget);
      expect(find.textContaining('On its way to the customer'), findsOneWidget);
      await tester.pumpWidget(const SizedBox());
    },
  );

  testWidgets('a partial refund is validated against what is left', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(800, 2400);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final api = RefundApi()
      ..refunded = 5000
      ..refunds.add({
        'id': 'r0',
        'amountPaise': 5000,
        'status': 'succeeded',
        'reason': 'Late delivery',
      });
    await tester.pumpWidget(app(api));
    await settle(tester);
    expect(
      find.text('₹269'),
      findsWidgets,
      reason: '319 paid minus 50 refunded',
    );
    await tester.tap(find.text('Part of it'));
    await settle(tester);
    final send = find.widgetWithText(FilledButton, 'Refund to customer');
    await tester.tap(send);
    await settle(tester);
    expect(find.text('Enter an amount like 50 or 49.50'), findsOneWidget);
    await tester.enterText(find.byType(TextFormField).first, '300');
    await tester.tap(send);
    await settle(tester);
    expect(find.text('At most ₹269 can be refunded'), findsOneWidget);
    await tester.enterText(find.byType(TextFormField).first, '49.555');
    await tester.tap(send);
    await settle(tester);
    expect(find.text('Enter an amount like 50 or 49.50'), findsOneWidget);
    expect(api.posts, isEmpty);
    await tester.enterText(find.byType(TextFormField).first, '49.50');
    await tester.tap(send);
    await settle(tester);
    await tester.tap(find.widgetWithText(FilledButton, 'Refund'));
    await settle(tester);
    expect(api.posts.single['amountPaise'], 4950);
    expect(
      find.textContaining('Refunded'),
      findsOneWidget,
      reason: 'the earlier refund is in the history',
    );
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets(
    'a retry of the same refund reuses its key; a changed refund gets a new one',
    (tester) async {
      final api = RefundApi()..failNext = true;
      await tester.pumpWidget(app(api));
      await settle(tester);
      Future<void> sendFull() async {
        await tester.tap(
          find.widgetWithText(FilledButton, 'Refund to customer'),
        );
        await settle(tester);
        await tester.tap(find.widgetWithText(FilledButton, 'Refund'));
        await settle(tester);
      }

      await sendFull();
      expect(
        find.textContaining('could not process the refund'),
        findsOneWidget,
        reason: 'the server’s message is shown',
      );
      expect(api.refunded, 0);
      await tester.tap(find.text('Part of it'));
      await settle(tester);
      await tester.tap(find.text('All ₹319'));
      await settle(tester);
      await sendFull();
      expect(api.keys.length, 2);
      expect(
        api.keys[1],
        api.keys[0],
        reason: 'identical retry: same key, so it can never refund twice',
      );
      expect(api.refunded, 31900);
      await tester.pumpWidget(const SizedBox());
    },
  );

  testWidgets('different reasons or amounts never share a key', (tester) async {
    final api = RefundApi()..failNext = true;
    await tester.pumpWidget(app(api));
    await settle(tester);
    await tester.tap(find.widgetWithText(FilledButton, 'Refund to customer'));
    await settle(tester);
    await tester.tap(find.widgetWithText(FilledButton, 'Refund'));
    await settle(tester);
    await tester.tap(find.text('Part of it'));
    await settle(tester);
    await tester.enterText(find.byType(TextFormField).first, '100');
    await tester.tap(find.widgetWithText(FilledButton, 'Refund to customer'));
    await settle(tester);
    await tester.tap(find.widgetWithText(FilledButton, 'Refund'));
    await settle(tester);
    expect(api.keys.length, 2);
    expect(
      api.keys[1],
      isNot(api.keys[0]),
      reason: 'a different amount is a different refund',
    );
    expect(api.posts[1]['amountPaise'], 10000);
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets(
    'an unpaid order has nothing to refund, and a fully refunded one says so',
    (tester) async {
      final unpaid = RefundApi()..orderState = 'pending';
      await tester.pumpWidget(app(unpaid));
      await settle(tester);
      expect(find.textContaining('nothing to refund'), findsOneWidget);
      expect(find.text('Refund to customer'), findsNothing);
      await tester.pumpWidget(const SizedBox());
      final done = RefundApi()
        ..orderState = 'refunded'
        ..refunded = 31900;
      await tester.pumpWidget(app(done));
      await settle(tester);
      expect(
        find.text('This payment has been refunded in full.'),
        findsOneWidget,
      );
      expect(find.text('Refund to customer'), findsNothing);
      await tester.pumpWidget(const SizedBox());
    },
  );
}
