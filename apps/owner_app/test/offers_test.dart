import 'package:flutter_test/flutter_test.dart';
import 'package:pista_core/pista_core.dart';
import 'package:pista_owner/features/engagement/offers_page.dart';
import 'package:pista_ui/pista_ui.dart';

class FakeApi extends PistaApi {
  FakeApi() : super(baseUrl: 'http://t/api') {
    token = 'x';
  }
  final offers = <Map<String, dynamic>>[];
  Object? posted;
  @override
  Future<dynamic> request(
    String path, {
    String method = 'GET',
    Object? body,
    String? idempotencyKey,
  }) async {
    if (path == '/offers' && method == 'GET') return offers;
    if (path == '/offers' && method == 'POST') {
      posted = body;
      final b = body as Map;
      offers.add({
        'id': 'o1',
        'title': b['title'],
        'body': b['body'],
        'audience': b['audience'],
        'status': 'scheduled',
        'sentCount': 0,
      });
      return offers.last;
    }
    if (path == '/ratings/summary') {
      return {
        'count': 2,
        'average': 3.5,
        'note':
            'Fewer than 20 ratings so far: treat the average as a rough guide.',
        'lowRatings': [
          {'stars': 2, 'comment': 'Arrived cold', 'orderNumber': 7},
        ],
      };
    }
    if (path == '/offers/o1/cancel') {
      offers.first['status'] = 'cancelled';
      return {'ok': true};
    }
    throw StateError('Unexpected $method $path');
  }
}

void main() {
  testWidgets('owner sees honest ratings, writes an offer, and can cancel it', (
    t,
  ) async {
    t.view.physicalSize = const Size(800, 2600);
    t.view.devicePixelRatio = 1;
    addTearDown(t.view.resetPhysicalSize);
    addTearDown(t.view.resetDevicePixelRatio);
    final api = FakeApi();
    await t.pumpWidget(
      MaterialApp(
        theme: pistaTheme(),
        home: OffersPage(api: api),
      ),
    );
    await t.pumpAndSettle();
    expect(find.textContaining('3.5 out of 5 from 2 orders'), findsOneWidget);
    expect(find.textContaining('Fewer than 20'), findsOneWidget);
    expect(find.textContaining('Arrived cold'), findsOneWidget);
    await t.tap(find.text('Send offer'));
    await t.pump();
    expect(find.text('Add a title and a short message.'), findsOneWidget);
    expect(api.posted, isNull);
    await t.enterText(
      find.widgetWithText(TextField, 'Title'),
      'Haleem is ready',
    );
    await t.enterText(
      find.widgetWithText(TextField, 'Message'),
      'Fresh haleem from 6 pm tonight.',
    );
    await t.tap(find.text('Send offer'));
    await t.pumpAndSettle();
    expect((api.posted as Map)['audience'], 'all');
    expect(
      (api.posted as Map).containsKey('startsAt'),
      false,
      reason: 'send now',
    );
    expect(find.text('Haleem is ready'), findsOneWidget);
    await t.tap(find.text('Cancel'));
    await t.pumpAndSettle();
    expect(find.textContaining('cancelled'), findsOneWidget);
  });
}
