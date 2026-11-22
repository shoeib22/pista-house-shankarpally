import 'package:flutter_test/flutter_test.dart';
import 'package:pista_core/pista_core.dart';
import 'package:pista_customer/features/account/saved_addresses_page.dart';
import 'package:pista_customer/features/auth/auth_page.dart';
import 'package:pista_customer/features/checkout/screens/checkout_sheet.dart';
import 'package:pista_ui/pista_ui.dart';

/// A fake server with a customer address book.
class AccountsApi extends PistaApi {
  final calls = <String>[];
  Map? registered, lastCheckout, lastAddressBody;
  String? registerError;
  List<Map<String, dynamic>> book = [
    {
      'id': 'home-1',
      'label': 'Home',
      'recipient': 'Asha Rao',
      'phone': '9000000001',
      'line1': '12 Rose Lane',
      'city': 'Shankarpally',
      'postalCode': '000000',
      'landmark': 'Blue gate',
      'latitude': 17.45,
      'longitude': 78.13,
      'isDefault': true,
    },
    {
      'id': 'work-1',
      'label': 'Work',
      'recipient': 'Asha Rao',
      'phone': '9000000001',
      'line1': 'Office 4, Main Road',
      'city': 'Shankarpally',
      'postalCode': '000000',
      'landmark': null,
      'latitude': null,
      'longitude': null,
      'isDefault': false,
    },
  ];
  @override
  Future<dynamic> request(
    String path, {
    String method = 'GET',
    Object? body,
    String? idempotencyKey,
  }) async {
    calls.add('$method $path');
    if (path == '/auth/register') {
      if (registerError != null) throw ApiException(registerError!, 409);
      registered = Map.from(body as Map);
      return {
        'token': 'new-token',
        'user': {'id': 'u1', 'name': (body)['name'], 'role': 'customer'},
        'handle': (body)['phone'],
        'phoneVerified': false,
      };
    }
    if (path == '/addresses' && method == 'GET') return book;
    if (path == '/addresses' && method == 'POST') {
      lastAddressBody = Map.from(body as Map);
      final made = {
        ...Map<String, dynamic>.from(body),
        'id': 'new-${book.length}',
        'isDefault': false,
      };
      book = [...book, made];
      return made;
    }
    if (path.startsWith('/addresses/') && method == 'DELETE') {
      book = book.where((a) => '/addresses/${a['id']}' != path).toList();
      return {'ok': true};
    }
    if (path.endsWith('/default')) return {'ok': true};
    if (path == '/menu') {
      return [
        {
          'id': 'chicken-biryani',
          'name': 'Chicken Dum Biryani',
          'description': 'Sample',
          'category': 'Biryani',
          'pricePaise': 29900,
          'available': true,
          'vegetarian': false,
        },
      ];
    }
    if (path == '/outlet') return {'paused': false};
    if (path == '/orders' && method == 'POST') {
      lastCheckout = Map.from(body as Map);
      return {
        'id': 'order-1',
        'number': 1,
        'totalPaise': 31900,
        'paymentStatus': 'pending',
        'status': 'awaiting_acceptance',
        'fulfilment': 'delivery',
        'deliveryPaise': 2000,
        'items': [
          {'name': 'Chicken Dum Biryani', 'quantity': 1, 'unitPaise': 29900},
        ],
      };
    }
    if (path == '/orders') return [];
    throw StateError('Unexpected request $method $path');
  }
}

Widget host(Widget child) => MaterialApp(
  theme: pistaTheme(),
  home: Scaffold(body: child),
);

void main() {
  testWidgets('sign-up validates the form, then registers and signs in', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(800, 2400);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final api = AccountsApi();
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
                  builder: (_) =>
                      CustomerAuthPage(api: api, startOnSignUp: true),
                ),
              ),
              child: const Text('open'),
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();
    expect(find.text('Create your account'), findsOneWidget);
    expect(find.textContaining('not verified yet'), findsOneWidget);
    // Nothing valid yet.
    await tester.ensureVisible(
      find.widgetWithText(FilledButton, 'Create account'),
    );
    await tester.tap(find.widgetWithText(FilledButton, 'Create account'));
    await tester.pumpAndSettle();
    expect(find.text('Enter your name'), findsOneWidget);
    expect(find.text('Enter a valid 10-digit mobile number'), findsOneWidget);
    expect(find.text('Use at least 12 characters'), findsOneWidget);
    expect(api.registered, isNull, reason: 'invalid forms are never sent');
    final fields = find.byType(TextFormField);
    await tester.enterText(fields.at(0), 'Asha Rao');
    await tester.enterText(fields.at(1), '90000 00001');
    await tester.enterText(fields.at(2), 'a-long-test-passphrase');
    await tester.enterText(fields.at(3), 'a-different-passphrase');
    await tester.ensureVisible(
      find.widgetWithText(FilledButton, 'Create account'),
    );
    await tester.tap(find.widgetWithText(FilledButton, 'Create account'));
    await tester.pumpAndSettle();
    expect(find.text('Passphrases do not match'), findsOneWidget);
    expect(api.registered, isNull);
    await tester.enterText(fields.at(3), 'a-long-test-passphrase');
    await tester.ensureVisible(
      find.widgetWithText(FilledButton, 'Create account'),
    );
    await tester.tap(find.widgetWithText(FilledButton, 'Create account'));
    await tester.pumpAndSettle();
    expect(api.registered?['name'], 'Asha Rao');
    expect(api.registered?['phone'], '90000 00001');
    expect(api.token, 'new-token');
    expect(api.userName, 'Asha Rao');
    expect(result, isTrue);
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('sign-up shows a duplicate-number error without leaving the page', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(800, 2400);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final api = AccountsApi()
      ..registerError =
          'An account with this mobile number already exists. Sign in instead.';
    await tester.pumpWidget(
      MaterialApp(
        theme: pistaTheme(),
        home: CustomerAuthPage(api: api, startOnSignUp: true),
      ),
    );
    final fields = find.byType(TextFormField);
    await tester.enterText(fields.at(0), 'Asha Rao');
    await tester.enterText(fields.at(1), '9000000001');
    await tester.enterText(fields.at(2), 'a-long-test-passphrase');
    await tester.enterText(fields.at(3), 'a-long-test-passphrase');
    await tester.ensureVisible(
      find.widgetWithText(FilledButton, 'Create account'),
    );
    await tester.tap(find.widgetWithText(FilledButton, 'Create account'));
    await tester.pumpAndSettle();
    expect(find.textContaining('already exists'), findsOneWidget);
    expect(api.token, isNull);
    expect(find.text('Create your account'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
  });

  test(
    'address book loads, saves with the right fields, deletes and clears on sign-out',
    () async {
      final api = AccountsApi()..token = 'tok';
      final model = CustomerModel(api);
      await model.addresses.load();
      expect(model.addresses.items.length, 2);
      expect(model.addresses.defaultAddress?['label'], 'Home');
      await model.addresses.save({
        'recipient': 'Asha Rao',
        'phone': '9000000001',
        'line1': '99 New Street',
        'city': 'Shankarpally',
        'postalCode': '000000',
        'landmark': '',
        'latitude': 17.4,
        'longitude': 78.1,
      }, label: 'Other');
      final sent = api.lastAddressBody!;
      expect(sent['label'], 'Other');
      expect(
        sent.containsKey('landmark'),
        isFalse,
        reason: 'empty landmark is omitted',
      );
      expect(sent['latitude'], 17.4);
      expect(sent.containsKey('makeDefault'), isFalse);
      expect(model.addresses.items.length, 3);
      await model.addresses.remove('work-1');
      expect(model.addresses.items.any((a) => a['id'] == 'work-1'), isFalse);
      model.resetForServer();
      expect(model.addresses.items, isEmpty);
      expect(api.token, isNull);
      api.calls.clear();
      await model.addresses.load();
      expect(
        api.calls,
        isEmpty,
        reason: 'nobody signed in, so nothing is fetched',
      );
      model.dispose();
    },
  );

  testWidgets(
    'saved addresses page lists them and deletes only after confirming',
    (tester) async {
      final api = AccountsApi()..token = 'tok';
      final model = CustomerModel(api);
      await tester.pumpWidget(
        MaterialApp(
          theme: pistaTheme(),
          home: SavedAddressesPage(model: model),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Home'), findsOneWidget);
      expect(find.text('Default'), findsOneWidget);
      expect(find.textContaining('12 Rose Lane'), findsOneWidget);
      expect(find.text('Map pin saved'), findsOneWidget);
      expect(find.text('No map pin'), findsOneWidget);
      await tester.tap(find.byTooltip('Address options').last);
      await tester.pumpAndSettle();
      await tester.tap(find.text('Delete'));
      await tester.pumpAndSettle();
      expect(find.text('Delete Work?'), findsOneWidget);
      await tester.tap(find.text('Keep'));
      await tester.pumpAndSettle();
      expect(api.calls.where((c) => c.startsWith('DELETE')), isEmpty);
      await tester.tap(find.byTooltip('Address options').last);
      await tester.pumpAndSettle();
      await tester.tap(find.text('Delete'));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(FilledButton, 'Delete'));
      await tester.pumpAndSettle();
      expect(api.calls, contains('DELETE /addresses/work-1'));
      expect(find.text('Work'), findsNothing);
      await tester.pumpWidget(const SizedBox());
      model.dispose();
    },
  );

  testWidgets(
    'checkout starts from the default address, lets you pick another, and saves new ones',
    (tester) async {
      tester.view.physicalSize = const Size(800, 2400);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final api = AccountsApi()..token = 'tok';
      final model = CustomerModel(api);
      await model.refresh();
      model.cart['chicken-biryani'] = 1;
      await tester.pumpWidget(host(CheckoutSheet(model: model)));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Delivery'));
      await tester.pumpAndSettle();
      // The default address is filled in, with its pin.
      expect(find.text('Deliver to a saved address'), findsOneWidget);
      expect(find.widgetWithText(TextFormField, 'Asha Rao'), findsOneWidget);
      expect(find.text('12 Rose Lane'), findsOneWidget);
      expect(find.textContaining('Delivery pin selected'), findsOneWidget);
      // Pick the other saved address.
      await tester.tap(find.widgetWithText(ChoiceChip, 'Work'));
      await tester.pumpAndSettle();
      expect(find.text('Office 4, Main Road'), findsOneWidget);
      expect(find.text('12 Rose Lane'), findsNothing);
      expect(
        find.textContaining('Choose delivery pin'),
        findsOneWidget,
        reason: 'Work has no pin',
      );
      await tester.pumpWidget(const SizedBox());
      model.dispose();
    },
  );

  testWidgets(
    'a typed address is saved after the order, only if the box is ticked',
    (tester) async {
      tester.view.physicalSize = const Size(800, 2400);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      for (final tick in [true, false]) {
        final api = AccountsApi()
          ..token = 'tok'
          ..book = [];
        final model = CustomerModel(api);
        await model.refresh();
        model.cart['chicken-biryani'] = 1;
        await tester.pumpWidget(host(CheckoutSheet(model: model)));
        await tester.pumpAndSettle();
        await tester.tap(find.text('Delivery'));
        await tester.pumpAndSettle();
        expect(find.text('Deliver to a saved address'), findsNothing);
        final fields = find.byType(TextFormField);
        await tester.enterText(fields.at(0), 'Asha Rao');
        await tester.enterText(fields.at(1), '9000000001');
        await tester.enterText(fields.at(2), '12 Rose Lane');
        await tester.enterText(fields.at(4), '000000');
        if (!tick) {
          await tester.tap(find.text('Save this address for next time'));
          await tester.pumpAndSettle();
        }
        await tester.tap(find.text('Save order & review payment →'));
        await tester.pumpAndSettle();
        expect(api.lastCheckout?['deliveryAddress']['line1'], '12 Rose Lane');
        final saved = api.calls.where((c) => c == 'POST /addresses').length;
        expect(
          saved,
          tick ? 1 : 0,
          reason: tick ? 'saved after the order' : 'unticked: not saved',
        );
        if (tick) expect(api.lastAddressBody?['label'], 'Home');
        await tester.pumpWidget(const SizedBox());
        model.dispose();
      }
    },
  );
}
