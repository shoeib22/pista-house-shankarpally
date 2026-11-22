import 'package:flutter_test/flutter_test.dart';
import 'package:pista_core/pista_core.dart';
import 'package:pista_delivery/features/tasks/widgets/offer_card.dart';
import 'package:pista_ui/pista_ui.dart';

Map<String, dynamic> offer(DateTime ends) => {
  'id': 'offer-1',
  'expiresAt': ends.toUtc().toIso8601String(),
  'order': {
    'number': 12,
    'itemCount': 2,
    'deliveryPaise': 2000,
    'area': 'Shankarpally \u00b7 501203',
    'pickup': 'Pista House Shankarpally',
    'distanceKm': 2.4,
  },
};

class OfferApi extends PistaApi {
  Map<String, dynamic>? live;
  final calls = <String>[];
  bool offersUnsupported = false;
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
    calls.add('$method $path');
    if (path == '/auth/login') {
      return {
        'token': 'test',
        'user': {'role': 'rider'},
      };
    }
    if (path == '/rider/tasks') return {'available': true, 'tasks': []};
    if (path == '/rider/offer') {
      if (offersUnsupported) throw ApiException('Not found', 404);
      return {
        'offer': live,
        'serverTime': DateTime.now().toUtc().toIso8601String(),
      };
    }
    if (path.startsWith('/rider/offers/')) {
      live = null;
      return {'ok': true};
    }
    throw StateError('Unexpected $path');
  }
}

void main() {
  testWidgets(
    'offer shows area and distance but not private customer details',
    (tester) async {
      var accepted = false, declined = false;
      await tester.pumpWidget(
        MaterialApp(
          theme: pistaTheme(),
          home: Scaffold(
            body: OfferCard(
              offer: offer(DateTime.now().add(const Duration(seconds: 25))),
              clockSkew: Duration.zero,
              busy: false,
              onAccept: () => accepted = true,
              onDecline: () => declined = true,
            ),
          ),
        ),
      );
      expect(find.text('New delivery offer'), findsOneWidget);
      expect(find.textContaining('#PH0012'), findsOneWidget);
      expect(find.textContaining('Shankarpally'), findsWidgets);
      expect(find.textContaining('2.4 km'), findsOneWidget);
      expect(find.textContaining('after you accept'), findsOneWidget);
      await tester.tap(find.text('Accept delivery'));
      await tester.tap(find.text('Decline'));
      expect(accepted && declined, isTrue);
      await tester.pumpWidget(const SizedBox());
    },
  );

  testWidgets('an expired offer cannot be accepted', (tester) async {
    var accepted = false;
    await tester.pumpWidget(
      MaterialApp(
        theme: pistaTheme(),
        home: Scaffold(
          body: OfferCard(
            offer: offer(DateTime.now().subtract(const Duration(seconds: 3))),
            clockSkew: Duration.zero,
            busy: false,
            onAccept: () => accepted = true,
            onDecline: () {},
          ),
        ),
      ),
    );
    expect(find.text('Expired'), findsOneWidget);
    await tester.tap(find.text('Accept delivery'), warnIfMissed: false);
    expect(accepted, isFalse);
    await tester.pumpWidget(const SizedBox());
  });

  test(
    'rider model loads a live offer and answers it through the server',
    () async {
      final api = OfferApi();
      final model = DeliveryModel(api);
      await model.login();
      expect(model.offer, isNull);
      api.live = offer(DateTime.now().add(const Duration(seconds: 30)));
      await model.refresh();
      expect(model.offer?['id'], 'offer-1');
      await model.respondToOffer(true);
      expect(api.calls, contains('POST /rider/offers/offer-1/respond'));
      expect(
        model.offer,
        isNull,
        reason: 'server state is read back after answering',
      );
      model.dispose();
    },
  );

  test('an older server without offers does not break the task list', () async {
    final api = OfferApi()..offersUnsupported = true;
    final model = DeliveryModel(api);
    await model.login();
    await model.refresh();
    expect(model.error, isNull);
    expect(model.connected, isTrue);
    expect(model.offer, isNull);
    model.dispose();
  });
}
