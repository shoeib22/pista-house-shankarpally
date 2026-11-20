import 'package:flutter_test/flutter_test.dart';
import 'package:pista_core/pista_core.dart';
import 'package:pista_ui/pista_ui.dart';
import 'package:pista_customer/features/checkout/screens/beta_access_sheet.dart';

class BetaApi extends PistaApi {
  final paths = <String>[];
  Map? login;
  Map<String, dynamic>? order;
  bool revoke = false;
  @override
  Future<void> developmentLogin(String identity) async {
    throw StateError(
      'Anonymous development login must not run in a beta build',
    );
  }

  @override
  Future<dynamic> request(
    String path, {
    String method = 'GET',
    Object? body,
    String? idempotencyKey,
  }) async {
    paths.add(path);
    if (revoke) throw ApiException('Session revoked', 401);
    if (path == '/auth/login') {
      login = body as Map;
      return {
        'token': 'beta-fixture-token',
        'user': {'role': 'customer'},
      };
    }
    if (path == '/orders' && method == 'POST') {
      order = {
        'id': 'beta-order',
        'totalPaise': 1000,
        'items': [],
        'paymentStatus': 'pending',
      };
      return order;
    }
    if (path.endsWith('/beta-payment')) {
      order!['paymentStatus'] = 'paid';
      return order;
    }
    if (path == '/orders') return order == null ? [] : [order];
    if (path == '/menu') return [];
    if (path == '/outlet') return {'paused': false};
    throw StateError('Unexpected beta test path $path');
  }
}

void main() {
  const beta = bool.fromEnvironment('BETA_TESTING');
  test(
    'beta checkout requires private sign-in and uses only the beta payment endpoint',
    () async {
      final api = BetaApi();
      final current = CustomerModel(api);
      current.cart['fixture-item'] = 1;
      await current.createOrder();
      expect(current.pendingOrder, isNull);
      expect(current.error, contains('Sign in with your beta test account'));
      await api.passwordLogin(
        'sample.beta.customer',
        'sample-beta-passphrase',
        'customer',
      );
      await current.createOrder();
      await current.verifyTestPayment();
      expect(api.login?['audience'], 'customer');
      expect(api.paths, contains('/orders/beta-order/beta-payment'));
      expect(api.paths.any((p) => p.contains('development')), isFalse);
      current.dispose();
    },
    skip: !beta,
  );
  test('revoked beta customer sessions remove private cached orders', () async {
    final api = BetaApi();
    api.token = 'fixture';
    final model = CustomerModel(api);
    model.orders = [
      {'id': 'private-order'},
    ];
    api.revoke = true;
    await model.refresh();
    expect(api.token, isNull);
    expect(model.orders, isEmpty);
    model.dispose();
  }, skip: !beta);
  testWidgets(
    'customer beta sign-in sheet authenticates without an anonymous identity',
    (tester) async {
      final api = BetaApi();
      await tester.pumpWidget(
        MaterialApp(
          theme: pistaTheme(),
          home: Builder(
            builder: (context) => Scaffold(
              body: FilledButton(
                onPressed: () => showModalBottomSheet<void>(
                  context: context,
                  isScrollControlled: true,
                  useSafeArea: true,
                  builder: (context) => BetaAccessSheet(api: api),
                ),
                child: const Text('Open customer beta sign-in'),
              ),
            ),
          ),
        ),
      );
      await tester.tap(find.text('Open customer beta sign-in'));
      await tester.pumpAndSettle();
      await tester.enterText(
        find.byType(TextFormField).at(0),
        'sample.beta.customer',
      );
      await tester.enterText(
        find.byType(TextFormField).at(1),
        'sample-beta-passphrase',
      );
      await tester.scrollUntilVisible(
        find.widgetWithText(FilledButton, 'Sign in').hitTestable(),
        150,
        scrollable: find.byType(Scrollable).last,
      );
      await tester.tap(find.widgetWithText(FilledButton, 'Sign in'));
      await tester.pumpAndSettle();
      expect(api.token, 'beta-fixture-token');
      expect(api.login?['audience'], 'customer');
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
      api.close();
    },
    skip: !beta,
  );
}
