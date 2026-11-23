import 'package:flutter_test/flutter_test.dart';
import 'package:pista_core/pista_core.dart';
import 'package:pista_customer/features/engagement/engagement_pages.dart';
import 'package:pista_ui/pista_ui.dart';

class FakeApi extends PistaApi {
  FakeApi({this.signedIn = true, this.rated}) : super(baseUrl: 'http://t/api') {
    if (signedIn) token = 'x';
  }
  final bool signedIn;
  Map<String, dynamic>? rated;
  final calls = <String>[];
  Object? lastBody;
  @override
  Future<dynamic> request(
    String path, {
    String method = 'GET',
    Object? body,
    String? idempotencyKey,
  }) async {
    calls.add('$method $path');
    if (path == '/me/offers') {
      return [
        {
          'id': 'o1',
          'title': 'Haleem is ready',
          'body': 'Fresh haleem from 6 pm tonight.',
          'productId': 'p1',
        },
      ];
    }
    if (path == '/me/recommendations') {
      return [
        {
          'productId': 'p2',
          'name': 'Chicken Biryani',
          'pricePaise': 25000,
          'reason': 'You order this often',
        },
      ];
    }
    if (path.endsWith('/rating') && method == 'GET') return rated;
    if (path.endsWith('/rating') && method == 'POST') {
      lastBody = body;
      return {'ok': true};
    }
    throw StateError('Unexpected $method $path');
  }
}

void main() {
  testWidgets(
    'For you shows the owner offer as written and picks with reasons',
    (t) async {
      t.view.physicalSize = const Size(800, 2000);
      t.view.devicePixelRatio = 1;
      addTearDown(t.view.resetPhysicalSize);
      addTearDown(t.view.resetDevicePixelRatio);
      final model = CustomerModel(FakeApi());
      var browsed = false;
      await t.pumpWidget(
        MaterialApp(
          theme: pistaTheme(),
          home: Scaffold(
            body: ForYouTab(model: model, onBrowse: () => browsed = true),
          ),
        ),
      );
      await t.pumpAndSettle();
      expect(find.text('Haleem is ready'), findsOneWidget);
      expect(find.text('Fresh haleem from 6 pm tonight.'), findsOneWidget);
      expect(find.textContaining('You order this often'), findsOneWidget);
      await t.tap(find.byTooltip('Add Chicken Biryani to cart'));
      await t.pump();
      expect(model.cart['p2'], 1);
      await t.tap(find.text('Browse the menu'));
      expect(browsed, true);
    },
  );

  testWidgets(
    'signed-out visitors are asked to sign in and nothing is requested',
    (t) async {
      final api = FakeApi(signedIn: false);
      await t.pumpWidget(
        MaterialApp(
          theme: pistaTheme(),
          home: Scaffold(
            body: ForYouTab(model: CustomerModel(api), onBrowse: () {}),
          ),
        ),
      );
      await t.pumpAndSettle();
      expect(find.textContaining('Sign in'), findsOneWidget);
      expect(api.calls, isEmpty);
    },
  );

  testWidgets(
    'rating needs a star, sends stars and note once, then says thanks',
    (t) async {
      final api = FakeApi();
      await t.pumpWidget(
        MaterialApp(
          theme: pistaTheme(),
          home: RatePage(api: api, order: const {'id': 'o9', 'number': 7}),
        ),
      );
      await t.pumpAndSettle();
      expect(find.textContaining('#PH0007'), findsOneWidget);
      await t.tap(find.text('Send rating'));
      await t.pump();
      expect(find.text('Tap a star to rate.'), findsOneWidget);
      expect(api.calls.where((c) => c.startsWith('POST')), isEmpty);
      await t.tap(find.byTooltip('4 stars'));
      await t.enterText(find.byType(TextField), 'Great biryani');
      await t.tap(find.text('Send rating'));
      await t.pumpAndSettle();
      expect(api.lastBody, {'stars': 4, 'comment': 'Great biryani'});
      expect(find.textContaining('Thank you'), findsOneWidget);
    },
  );

  testWidgets(
    'an order that was already rated shows the rating instead of the form',
    (t) async {
      final api = FakeApi(rated: {'stars': 5, 'comment': null});
      await t.pumpWidget(
        MaterialApp(
          theme: pistaTheme(),
          home: RatePage(api: api, order: const {'id': 'o9', 'number': 7}),
        ),
      );
      await t.pumpAndSettle();
      expect(find.textContaining('5 out of 5'), findsOneWidget);
      expect(find.text('Send rating'), findsNothing);
    },
  );
}
