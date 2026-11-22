import 'package:flutter_test/flutter_test.dart';
import 'package:pista_core/pista_core.dart';
import 'package:pista_customer/features/support/support_pages.dart';
import 'package:pista_ui/pista_ui.dart';

class SupportApi extends PistaApi {
  final calls = <String>[];
  final sent = <Map<String, dynamic>>[];
  String status = 'open';
  bool canRate = false, canReply = true, unread = false;
  int? rating;
  final messages = <Map<String, dynamic>>[
    {
      'id': 'm1',
      'from': 'you',
      'body': 'The raita was missing.',
      'createdAt': '2026-11-23T10:00:00Z',
    },
  ];
  Map<String, dynamic> ticket() => {
    'id': 't1',
    'number': 12,
    'subject': 'Missing item on #PH0007',
    'category': 'missing_item',
    'status': status,
    'orderNumber': 7,
    'canReply': canReply,
    'canRate': canRate,
    'rating': rating,
    'messages': messages,
  };
  @override
  Future<dynamic> request(
    String path, {
    String method = 'GET',
    Object? body,
    String? idempotencyKey,
  }) async {
    calls.add('$method $path');
    if (path == '/support/tickets' && method == 'GET') {
      return [
        {
          'id': 't1',
          'number': 12,
          'subject': 'Missing item on #PH0007',
          'category': 'missing_item',
          'status': status,
          'updatedAt': DateTime.now().toUtc().toIso8601String(),
          'unread': unread,
          'canRate': false,
        },
      ];
    }
    if (path == '/support/tickets' && method == 'POST') {
      sent.add(Map<String, dynamic>.from(body as Map));
      return {...ticket(), 'id': 't-new'};
    }
    if (path == '/support/tickets/t1' || path == '/support/tickets/t-new') {
      return ticket();
    }
    if (path.endsWith('/messages')) {
      sent.add(Map<String, dynamic>.from(body as Map));
      messages.add({
        'id': 'm${messages.length + 1}',
        'from': 'you',
        'body': (body)['body'],
        'createdAt': DateTime.now().toUtc().toIso8601String(),
      });
      status = 'open';
      return ticket();
    }
    if (path.endsWith('/rating')) {
      rating = (body as Map)['rating'] as int;
      canRate = false;
      return ticket();
    }
    if (path.endsWith('/close')) {
      status = 'closed';
      canReply = false;
      return ticket();
    }
    throw StateError('Unexpected $method $path');
  }
}

Future<void> settle(WidgetTester tester) =>
    tester.pumpAndSettle(const Duration(milliseconds: 100));

void main() {
  testWidgets(
    'help centre lists requests with a new-reply marker, plus quick answers',
    (tester) async {
      tester.view.physicalSize = const Size(800, 2400);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final api = SupportApi()
        ..unread = true
        ..status = 'pending_customer';
      await tester.pumpWidget(
        MaterialApp(
          theme: pistaTheme(),
          home: SupportPage(api: api),
        ),
      );
      await settle(tester);
      expect(find.text('Help & support'), findsOneWidget);
      expect(find.text('Missing item on #PH0007'), findsOneWidget);
      expect(
        find.text('New'),
        findsOneWidget,
        reason: 'an unread reply is flagged',
      );
      expect(find.textContaining('We have replied'), findsOneWidget);
      expect(find.text('How do refunds work?'), findsOneWidget);
      await tester.tap(find.text('How do refunds work?'));
      await settle(tester);
      expect(find.textContaining('5 to 7 working days'), findsOneWidget);
      await tester.pumpWidget(const SizedBox());
    },
  );

  testWidgets(
    'a new request needs a category and a few words, then goes to the server',
    (tester) async {
      tester.view.physicalSize = const Size(800, 2400);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final api = SupportApi();
      String? created;
      await tester.pumpWidget(
        MaterialApp(
          theme: pistaTheme(),
          home: Builder(
            builder: (context) => Scaffold(
              body: FilledButton(
                onPressed: () async => created = await Navigator.push<String>(
                  context,
                  MaterialPageRoute(
                    builder: (_) => NewRequestPage(
                      api: api,
                      order: const {
                        'id': 'o7',
                        'number': 7,
                        'totalPaise': 29900,
                      },
                    ),
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
      expect(find.text('Which order? (optional)'), findsOneWidget);
      await tester.tap(find.widgetWithText(FilledButton, 'Send request'));
      await settle(tester);
      expect(find.text('Choose what this is about.'), findsOneWidget);
      expect(api.sent, isEmpty);
      await tester.tap(find.text('Missing item'));
      await settle(tester);
      await tester.tap(find.widgetWithText(FilledButton, 'Send request'));
      await settle(tester);
      expect(
        find.text('Please add a few words so we can help'),
        findsOneWidget,
      );
      expect(api.sent, isEmpty);
      await tester.enterText(
        find.byType(TextFormField).last,
        'The raita was missing from my order.',
      );
      await tester.tap(find.widgetWithText(FilledButton, 'Send request'));
      await settle(tester);
      expect(api.sent.single, {
        'category': 'missing_item',
        'orderId': 'o7',
        'message': 'The raita was missing from my order.',
      });
      expect(created, 't-new');
    },
  );

  testWidgets(
    'the conversation shows staff as support, sends replies, and picks up new messages',
    (tester) async {
      final api = SupportApi()
        ..status = 'pending_customer'
        ..messages.add({
          'id': 'm2',
          'from': 'support',
          'body': 'Sorry about that, we are checking.',
          'createdAt': '2026-11-23T10:05:00Z',
        });
      await tester.pumpWidget(
        MaterialApp(
          theme: pistaTheme(),
          home: TicketPage(
            api: api,
            ticketId: 't1',
            pollEvery: const Duration(milliseconds: 200),
          ),
        ),
      );
      await settle(tester);
      expect(find.text('Request #12'), findsOneWidget);
      expect(find.text('The raita was missing.'), findsOneWidget);
      expect(find.text('Pista House support'), findsOneWidget);
      expect(find.text('We have replied'), findsOneWidget);
      await tester.enterText(find.byType(TextField), 'Thank you, any update?');
      await tester.tap(find.byTooltip('Send message'));
      await settle(tester);
      expect(api.sent.last, {'body': 'Thank you, any update?'});
      expect(find.text('Thank you, any update?'), findsOneWidget);
      expect(
        find.text('We are looking into it'),
        findsOneWidget,
        reason: 'back in the staff queue',
      );
      api.messages.add({
        'id': 'm9',
        'from': 'support',
        'body': 'A refund is on its way.',
        'createdAt': '2026-11-23T10:30:00Z',
      });
      await tester.pump(const Duration(milliseconds: 400));
      await settle(tester);
      expect(
        find.text('A refund is on its way.'),
        findsOneWidget,
        reason: 'new staff message arrives by itself',
      );
      await tester.pumpWidget(const SizedBox());
    },
  );

  testWidgets(
    'a resolved request can be rated once, and a closed one cannot be replied to',
    (tester) async {
      final api = SupportApi()
        ..status = 'resolved'
        ..canRate = true;
      await tester.pumpWidget(
        MaterialApp(
          theme: pistaTheme(),
          home: TicketPage(
            api: api,
            ticketId: 't1',
            pollEvery: const Duration(minutes: 5),
          ),
        ),
      );
      await settle(tester);
      expect(find.text('Resolved'), findsOneWidget);
      expect(find.text('How did we do?'), findsOneWidget);
      expect(find.text('Reply to reopen this request'), findsOneWidget);
      await tester.tap(find.byTooltip('4 stars'));
      await settle(tester);
      expect(api.rating, 4);
      expect(find.text('How did we do?'), findsNothing);
      expect(find.textContaining('Thanks for rating'), findsOneWidget);
      await tester.tap(find.byTooltip('More'));
      await settle(tester);
      await tester.tap(find.text('Close request'));
      await settle(tester);
      expect(find.text('Close this request?'), findsOneWidget);
      await tester.tap(find.text('Keep open'));
      await settle(tester);
      expect(api.status, 'resolved');
      await tester.tap(find.byTooltip('More'));
      await settle(tester);
      await tester.tap(find.text('Close request'));
      await settle(tester);
      await tester.tap(find.widgetWithText(FilledButton, 'Close'));
      await settle(tester);
      expect(api.status, 'closed');
      expect(find.textContaining('This request is closed'), findsOneWidget);
      expect(find.byTooltip('Send message'), findsNothing);
      await tester.pumpWidget(const SizedBox());
    },
  );
}
