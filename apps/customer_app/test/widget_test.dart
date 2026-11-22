import 'package:flutter_test/flutter_test.dart';
import 'package:pista_core/pista_core.dart';
import 'package:pista_customer/main.dart';
import 'package:pista_ui/pista_ui.dart';
import 'package:pista_customer/features/checkout/screens/checkout_sheet.dart';

class JourneyApi extends PistaApi {
  Map<String, dynamic>? order;
  Map? lastCheckout;
  @override
  Future<void> developmentLogin(String identity) async {
    token = 'test';
  }

  @override
  Future<dynamic> request(
    String path, {
    String method = 'GET',
    Object? body,
    String? idempotencyKey,
  }) async {
    if (path == '/menu') {
      return [
        {
          'id': 'chicken-biryani',
          'name': 'Chicken Dum Biryani',
          'description': 'Sample menu item',
          'category': 'Biryani',
          'pricePaise': 29900,
          'available': true,
          'vegetarian': false,
        },
      ];
    }
    if (path == '/outlet') return {'paused': false};
    if (path == '/orders' && method == 'POST') {
      lastCheckout = body as Map;
      order = {
        'id': 'order-1',
        'number': 1,
        'totalPaise': 29900,
        'paymentStatus': 'pending',
        'status': 'awaiting_acceptance',
        'items': [
          {'name': 'Chicken Dum Biryani', 'quantity': 1, 'unitPaise': 29900},
        ],
        'fulfilment': lastCheckout!['fulfilment'],
        'deliveryPaise': lastCheckout!['fulfilment'] == 'delivery' ? 2000 : 0,
      };
      return order;
    }
    if (path.endsWith('/development-payment')) {
      order!['paymentStatus'] = 'paid';
      return order;
    }
    if (path == '/orders') return order == null ? [] : [order];
    throw StateError('Unexpected request $path');
  }
}

class FakeApi extends PistaApi {
  final keys = <String?>[];
  bool fail = true;
  @override
  Future<void> developmentLogin(String identity) async {
    token = 'test';
  }

  @override
  Future<dynamic> request(
    String path, {
    String method = 'GET',
    Object? body,
    String? idempotencyKey,
  }) async {
    if (path == '/orders' && method == 'POST') {
      keys.add(idempotencyKey);
      if (fail) {
        fail = false;
        throw Exception('Connection interrupted after submission');
      }
      return {'id': 'saved-order', 'totalPaise': 29900, 'items': []};
    }
    if (path.endsWith('/development-payment')) return {'paymentStatus': 'paid'};
    return <dynamic>[];
  }
}

void main() {
  test(
    'changing the beta server drops the private address and uncertain checkout retry',
    () async {
      final api = FakeApi();
      final model = CustomerModel(api);
      model.cart['chicken-biryani'] = 1;
      model.deliveryAddress = {'latitude': 17.45, 'longitude': 78.12};
      await model.createOrder();
      final oldKey = api.keys.single;
      model.resetForServer();
      expect(model.deliveryAddress, isNull);
      model.cart['chicken-biryani'] = 1;
      await model.createOrder();
      expect(api.keys.last, isNot(oldKey));
      expect(model.error, isNull);
      model.dispose();
    },
  );
  testWidgets('delivery checkout validates an address before saving it', (
    tester,
  ) async {
    final api = JourneyApi();
    final model = CustomerModel(api);
    model.cart['chicken-biryani'] = 1;
    await tester.pumpWidget(
      MaterialApp(
        theme: pistaTheme(),
        home: Scaffold(body: CheckoutSheet(model: model)),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Delivery'));
    await tester.pumpAndSettle();
    final fields = find.byType(TextFormField);
    await tester.enterText(fields.at(0), 'Sample recipient');
    await tester.enterText(fields.at(1), '9000000000');
    await tester.enterText(fields.at(2), 'Sample test address');
    await tester.enterText(fields.at(4), '000000');
    await tester.scrollUntilVisible(
      find.text('Save order & review payment →').hitTestable(),
      180,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.tap(find.text('Save order & review payment →'));
    await tester.pumpAndSettle();
    expect(api.lastCheckout?['fulfilment'], 'delivery');
    expect(api.lastCheckout?['deliveryAddress']['postalCode'], '000000');
    expect(find.text('Delivery charge: ₹20'), findsOneWidget);
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox());
    model.dispose();
  });
  testWidgets(
    'customer can browse, save a pickup order, confirm payment and see it in history',
    (tester) async {
      final model = CustomerModel(JourneyApi());
      await tester.pumpWidget(
        MaterialApp(
          theme: pistaTheme(),
          home: CustomerHome(model: model),
        ),
      );
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(
        find.byTooltip('Add Chicken Dum Biryani').hitTestable(),
        180,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.tap(find.byTooltip('Add Chicken Dum Biryani'));
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(
        find.byTooltip('View cart').hitTestable(),
        -180,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.tap(find.byTooltip('View cart'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Save order & review payment →'));
      await tester.pumpAndSettle();
      expect(find.text('Server total: ₹299'), findsOneWidget);
      await tester.tap(find.text('Confirm test payment →'));
      await tester.pumpAndSettle();
      expect(find.text('#PH0001'), findsOneWidget);
      expect(find.text('Payment: paid'), findsOneWidget);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
    },
  );
  test(
    'checkout retains the same retry key and cart through an uncertain response',
    () async {
      final api = FakeApi();
      final model = CustomerModel(api);
      model.cart['chicken-biryani'] = 1;
      await model.createOrder();
      expect(model.error, contains('Connection interrupted'));
      model.change('chicken-biryani', 1);
      expect(model.cart['chicken-biryani'], 1);
      await model.createOrder();
      expect(api.keys.length, 2);
      expect(api.keys[0], api.keys[1]);
      expect(model.pendingOrder?['id'], 'saved-order');
      await model.verifyTestPayment();
      expect(model.pendingOrder, isNull);
      expect(model.cart, isEmpty);
      model.dispose();
    },
  );
}
