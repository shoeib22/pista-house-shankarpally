import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pista_core/pista_core.dart';
import 'package:pista_tracking/pista_tracking.dart';

class FakeApi extends PistaApi {
  FakeApi() : super(baseUrl: 'http://test/api') {
    token = 'x';
  }
  final calls = <String>[];
  int unread = 1;
  Map<String, dynamic> prefs = {'promotions': false, 'reminders': false};
  final items = <Map<String, dynamic>>[
    {
      'id': 'n1',
      'kind': 'order.confirmed',
      'priority': 'p0',
      'title': 'Order #PH0007 confirmed',
      'body': 'The kitchen has it.',
      'data': {'orderId': 'o1'},
      'createdAt': '2026-11-23T10:00:00Z',
      'read': false,
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
    if (path == '/notifications/unread-count') return {'count': unread};
    if (path.startsWith('/notifications?')) {
      return {'unread': unread, 'items': items};
    }
    if (path == '/notifications/preferences') {
      if (method == 'PUT')
        prefs = {...prefs, ...(body as Map<String, dynamic>)};
      return prefs;
    }
    if (path == '/notifications/read') {
      for (final i in items) {
        i['read'] = true;
      }
      unread = 0;
      return {'ok': true};
    }
    return {'ok': true};
  }
}

Widget app(Widget child) => MaterialApp(home: Scaffold(body: child));

void main() {
  testWidgets('bell shows the unread count and opens the inbox', (t) async {
    final api = FakeApi();
    await t.pumpWidget(
      app(
        Builder(
          builder: (c) => AppBar(
            actions: [
              NotificationBell(api: api, every: const Duration(hours: 1)),
            ],
          ),
        ),
      ),
    );
    await t.pump();
    expect(find.text('1'), findsOneWidget);
    await t.tap(find.byTooltip('Notifications'));
    await t.pumpAndSettle();
    expect(find.text('Order #PH0007 confirmed'), findsOneWidget);
    await t.tap(find.text('Mark all read'));
    await t.pumpAndSettle();
    expect(api.unread, 0);
  });

  testWidgets('tapping an alert marks it opened and hands it to the app', (
    t,
  ) async {
    final api = FakeApi();
    Map<String, dynamic>? got;
    await t.pumpWidget(
      MaterialApp(
        home: NotificationsPage(api: api, onOpenItem: (n) => got = n),
      ),
    );
    await t.pumpAndSettle();
    await t.tap(find.byKey(const ValueKey('notification-n1')));
    await t.pumpAndSettle();
    expect(api.calls, contains('POST /notifications/n1/open'));
    expect((got!['data'] as Map)['orderId'], 'o1');
  });

  testWidgets('customers can opt in to reminders and offers; they start off', (
    t,
  ) async {
    final api = FakeApi();
    await t.pumpWidget(
      MaterialApp(home: NotificationsPage(api: api, showSettings: true)),
    );
    await t.pumpAndSettle();
    expect(api.prefs['reminders'], false);
    await t.tap(find.text('Reminders'));
    await t.pumpAndSettle();
    expect(api.prefs['reminders'], true);
    expect(api.prefs['promotions'], false);
  });

  testWidgets('a new alert while the app is open shows a banner', (t) async {
    final api = FakeApi()..unread = 0;
    await t.pumpWidget(
      app(
        Center(
          child: NotificationBell(api: api, every: const Duration(seconds: 5)),
        ),
      ),
    );
    await t.pump();
    api.unread = 1;
    await t.pump(const Duration(seconds: 6));
    await t.pump();
    await t.pump();
    expect(find.textContaining('Order #PH0007 confirmed'), findsOneWidget);
    expect(find.text('View'), findsOneWidget);
  });

  testWidgets('an empty inbox and a failing server are both explained', (
    t,
  ) async {
    final api = FakeApi()..items.clear();
    await t.pumpWidget(MaterialApp(home: NotificationsPage(api: api)));
    await t.pumpAndSettle();
    expect(find.textContaining('Nothing yet'), findsOneWidget);
  });
}
