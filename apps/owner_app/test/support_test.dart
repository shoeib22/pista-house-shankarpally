import 'package:flutter_test/flutter_test.dart';
import 'package:pista_core/pista_core.dart';
import 'package:pista_owner/features/support/support_pages.dart';
import 'package:pista_ui/pista_ui.dart';

class DeskApi extends PistaApi {
  final calls = <String>[];
  final bodies = <Map<String, dynamic>>[];
  String status = 'open';
  String priority = 'normal';
  String? assignedTo;
  final messages = <Map<String, dynamic>>[
    {
      'id': 'm1',
      'from': 'customer',
      'author': 'Asha',
      'internal': false,
      'body': 'The raita was missing.',
      'createdAt': '2026-11-23T10:00:00Z',
    },
    {
      'id': 'm2',
      'from': 'staff',
      'author': 'Ravi',
      'internal': true,
      'body': 'Asked the kitchen',
      'createdAt': '2026-11-23T10:02:00Z',
    },
  ];
  Map<String, dynamic> detail() => {
    'id': 't1',
    'number': 12,
    'subject': 'Missing item on #PH0007',
    'category': 'missing_item',
    'status': status,
    'priority': priority,
    'assignedTo': assignedTo,
    'overdue': false,
    'rating': null,
    'customer': {'name': 'Asha', 'phone': '9000000001', 'earlierRequests': 2},
    'order': {
      'id': 'o7',
      'number': 7,
      'status': 'delivered',
      'paymentStatus': 'paid',
      'fulfilment': 'delivery',
      'totalPaise': 31900,
      'items': [
        {'name': 'Chicken Dum Biryani', 'quantity': 1},
      ],
    },
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
    if (path.startsWith('/support/inbox?')) {
      return [
        {
          'id': 't1',
          'number': 12,
          'subject': 'Missing item on #PH0007',
          'category': 'missing_item',
          'status': 'open',
          'priority': 'high',
          'customer': 'Asha',
          'orderNumber': 7,
          'assignedTo': null,
          'waitingMinutes': 135,
          'overdue': true,
          'updatedAt': '2026-11-23T10:00:00Z',
        },
        {
          'id': 't2',
          'number': 13,
          'subject': 'Where is my order',
          'category': 'late',
          'status': 'open',
          'priority': 'normal',
          'customer': 'Vikram',
          'orderNumber': null,
          'assignedTo': 'Ravi',
          'waitingMinutes': 12,
          'overdue': false,
          'updatedAt': '2026-11-23T10:00:00Z',
        },
      ];
    }
    if (path == '/support/stats') {
      return {
        'needsReply': 2,
        'overdue': 1,
        'waitingOnCustomer': 0,
        'assignedToMe': 1,
        'resolvedToday': 3,
        'avgFirstResponseMinutes': 18,
        'satisfaction': {'average': 4.5, 'ratings': 6},
        'slaMinutes': 60,
      };
    }
    if (path == '/support/inbox/t1') return detail();
    if (path == '/support/inbox/t1/reply') {
      final b = Map<String, dynamic>.from(body as Map);
      bodies.add(b);
      messages.add({
        'id': 'm${messages.length + 1}',
        'from': 'staff',
        'author': 'You',
        'internal': b['internal'] == true,
        'body': b['body'],
        'createdAt': DateTime.now().toUtc().toIso8601String(),
      });
      if (b['internal'] != true) {
        status = (b['status'] as String?) ?? 'pending_customer';
      }
      return detail();
    }
    if (path == '/support/inbox/t1' && method == 'PATCH') return detail();
    throw StateError('Unexpected $method $path');
  }

  Future<dynamic> patch(Map body) async => null;
}

Future<void> settle(WidgetTester tester) =>
    tester.pumpAndSettle(const Duration(milliseconds: 100));

void main() {
  testWidgets(
    'the inbox shows the queue, urgency and how well support is doing',
    (tester) async {
      tester.view.physicalSize = const Size(800, 2400);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final api = DeskApi();
      await tester.pumpWidget(
        MaterialApp(
          theme: pistaTheme(),
          home: SupportInboxPage(
            api: api,
            pollEvery: const Duration(minutes: 5),
          ),
        ),
      );
      await settle(tester);
      expect(find.text('Customer support'), findsOneWidget);
      expect(find.text('Need a reply'), findsOneWidget);
      expect(find.text('Overdue (60 min)'), findsOneWidget);
      expect(
        find.text('18 min'),
        findsOneWidget,
        reason: 'average first reply',
      );
      expect(find.text('4.5 ★'), findsOneWidget);
      expect(find.text('#12 · Missing item on #PH0007'), findsOneWidget);
      expect(find.text('2 h'), findsOneWidget, reason: '135 minutes waiting');
      expect(find.textContaining('with Ravi'), findsOneWidget);
      expect(
        find.byIcon(Icons.flag),
        findsOneWidget,
        reason: 'high priority flag',
      );
      expect(
        api.calls.first,
        '/support/inbox?filter=needs_reply'.replaceFirst('/', 'GET /'),
      );
      await tester.tap(find.text('Waiting on customer'));
      await settle(tester);
      expect(api.calls, contains('GET /support/inbox?filter=waiting'));
      await tester.tap(find.text('Mine'));
      await settle(tester);
      expect(api.calls.last, 'GET /support/stats');
      expect(
        api.calls.any(
          (c) => c == 'GET /support/inbox?filter=waiting&mine=true',
        ),
        isTrue,
      );
      await tester.enterText(find.byType(TextField), 'asha rao');
      await tester.testTextInput.receiveAction(TextInputAction.search);
      await settle(tester);
      expect(api.calls.any((c) => c.contains('search=asha+rao')), isTrue);
      await tester.pumpWidget(const SizedBox());
    },
  );

  testWidgets(
    'a ticket shows the order, private notes stand out, and replies reach the server',
    (tester) async {
      tester.view.physicalSize = const Size(800, 2400);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final api = DeskApi();
      await tester.pumpWidget(
        MaterialApp(
          theme: pistaTheme(),
          home: TicketDetailPage(api: api, ticketId: 't1'),
        ),
      );
      await settle(tester);
      expect(find.text('Request #12'), findsOneWidget);
      expect(
        find.textContaining('Asha · +91 9000000001 · 2 earlier requests'),
        findsOneWidget,
      );
      expect(find.text('Order #PH0007'), findsOneWidget);
      expect(find.text('1 × Chicken Dum Biryani'), findsOneWidget);
      expect(find.text('Refund this order'), findsOneWidget);
      expect(find.text('Ravi · private note'), findsOneWidget);
      expect(find.text('The raita was missing.'), findsOneWidget);
      // A canned reply fills the box, and sending marks it answered.
      await tester.tap(find.textContaining('Sorry about that'));
      await settle(tester);
      await tester.tap(find.widgetWithText(FilledButton, 'Send'));
      await settle(tester);
      expect(api.bodies.last, {'body': cannedReplies.first});
      expect(api.status, 'pending_customer');
      // A private note is flagged internal and never carries a status change.
      await tester.tap(find.byType(Switch));
      await settle(tester);
      await tester.enterText(find.byType(TextField), 'Customer is a regular');
      await tester.tap(find.widgetWithText(FilledButton, 'Add note'));
      await settle(tester);
      expect(api.bodies.last, {
        'body': 'Customer is a regular',
        'internal': true,
      });
      // Send & resolve.
      await tester.tap(find.byType(Switch));
      await settle(tester);
      await tester.enterText(find.byType(TextField), 'All sorted, thank you.');
      await tester.tap(find.text('Send & resolve'));
      await settle(tester);
      expect(api.bodies.last, {
        'body': 'All sorted, thank you.',
        'status': 'resolved',
      });
      expect(api.status, 'resolved');
      await tester.pumpWidget(const SizedBox());
    },
  );

  testWidgets('staff can assign and prioritise from the menu', (tester) async {
    final api = DeskApi();
    await tester.pumpWidget(
      MaterialApp(
        theme: pistaTheme(),
        home: TicketDetailPage(api: api, ticketId: 't1'),
      ),
    );
    await settle(tester);
    await tester.tap(find.byTooltip('Actions'));
    await settle(tester);
    expect(find.text('Assign to me'), findsOneWidget);
    expect(find.text('Mark high priority'), findsOneWidget);
    await tester.tap(find.text('Assign to me'));
    await settle(tester);
    expect(api.calls, contains('PATCH /support/inbox/t1'));
    await tester.pumpWidget(const SizedBox());
  });
}
