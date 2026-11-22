import 'package:flutter_test/flutter_test.dart';
import 'package:pista_core/pista_core.dart';
import 'package:pista_ui/pista_ui.dart';
import 'package:pista_owner/features/orders/widgets/order_actions.dart';
import 'package:pista_owner/main.dart';

class OwnerAccessApi extends PistaApi {
  Map? lastLogin;
  @override
  Future<dynamic> request(
    String path, {
    String method = 'GET',
    Object? body,
    String? idempotencyKey,
  }) async {
    if (path == '/auth/login') {
      lastLogin = body as Map;
      return {
        'token': 'test-owner-token',
        'user': {'role': 'owner'},
      };
    }
    if (path == '/orders' || path == '/riders' || path == '/team/invitations') {
      return [];
    }
    if (path == '/outlet') return {'paused': false};
    if (path == '/team') return [];
    throw StateError('Unexpected request $path');
  }
}

void main() {
  testWidgets(
    'owner signs in with credentials instead of a development identity',
    (tester) async {
      final api = OwnerAccessApi();
      await tester.pumpWidget(
        MaterialApp(
          theme: pistaTheme(),
          home: OwnerHome(api: api),
        ),
      );
      expect(find.text('Open test owner account'), findsNothing);
      await tester.enterText(find.byType(TextFormField).at(0), 'sample.owner');
      await tester.enterText(
        find.byType(TextFormField).at(1),
        'sample-owner-passphrase',
      );
      await tester.scrollUntilVisible(
        find.widgetWithText(FilledButton, 'Sign in').hitTestable(),
        160,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.tap(find.widgetWithText(FilledButton, 'Sign in'));
      await tester.pumpAndSettle();
      expect(api.lastLogin?['audience'], 'owner');
      expect(find.text('Manage team access'), findsOneWidget);
      expect(api.token, 'test-owner-token');
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
    },
  );
  testWidgets(
    'invitation form requires matching passphrases before activation',
    (tester) async {
      int accepted = 0;
      String? received;
      await tester.pumpWidget(
        MaterialApp(
          theme: pistaTheme(),
          home: Scaffold(
            body: ListView(
              padding: const EdgeInsets.all(24),
              children: [
                StaffAccess(
                  title: 'Staff access',
                  developmentLabel: 'Test access',
                  busy: false,
                  onSignIn: (_, _) async {},
                  onAccept: (token, password) async {
                    accepted++;
                    received = token;
                  },
                ),
              ],
            ),
          ),
        ),
      );
      await tester.tap(find.text('Use invitation'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextFormField).at(0), 'bb' * 32);
      await tester.enterText(
        find.byType(TextFormField).at(1),
        'sample-long-passphrase',
      );
      await tester.enterText(
        find.byType(TextFormField).at(2),
        'different-passphrase',
      );
      await tester.scrollUntilVisible(
        find.text('Activate account').hitTestable(),
        180,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.tap(find.text('Activate account'));
      await tester.pumpAndSettle();
      expect(accepted, 0);
      expect(find.text('Passphrases do not match'), findsOneWidget);
      await tester.enterText(
        find.byType(TextFormField).at(2),
        'sample-long-passphrase',
      );
      await tester.tap(find.text('Activate account'));
      await tester.pumpAndSettle();
      expect(accepted, 1);
      expect(received, 'bb' * 32);
      await tester.pumpWidget(const SizedBox());
    },
  );
  testWidgets(
    'owner can look up the rider only while a delivery is under way',
    (tester) async {
      Future<void> show(String orderStatus, String assignmentStatus) async {
        await tester.pumpWidget(
          MaterialApp(
            theme: pistaTheme(),
            home: Scaffold(
              body: OwnerOrderActions(
                api: PistaApi(),
                order: {
                  'id': 'order-1',
                  'status': orderStatus,
                  'fulfilment': 'delivery',
                  'paymentStatus': 'paid',
                  'version': 3,
                  'assignments': [
                    {
                      'id': 'task-1',
                      'isActive': true,
                      'status': assignmentStatus,
                      'version': 1,
                      'rider': {'name': 'Sample rider'},
                    },
                  ],
                },
                riders: const [],
                busy: false,
                send: (_, _) async {},
              ),
            ),
          ),
        );
      }

      await show('out_for_delivery', 'picked_up');
      expect(find.text('Where is the rider?'), findsOneWidget);
      await show('ready', 'assigned');
      expect(find.text('Where is the rider?'), findsNothing);
      await tester.pumpWidget(const SizedBox());
    },
  );
  testWidgets('owner assigns an online rider with the current order version', (
    tester,
  ) async {
    String? sentPath;
    Map<String, dynamic>? sentBody;
    await tester.pumpWidget(
      MaterialApp(
        theme: pistaTheme(),
        home: Scaffold(
          body: OwnerOrderActions(
            api: PistaApi(),
            order: {
              'id': 'order-1',
              'status': 'ready',
              'fulfilment': 'delivery',
              'paymentStatus': 'paid',
              'version': 7,
              'assignments': [],
            },
            riders: [
              {'id': 'rider-1', 'name': 'Sample rider', 'riderAvailable': true},
            ],
            busy: false,
            send: (path, body) async {
              sentPath = path;
              sentBody = body;
            },
          ),
        ),
      ),
    );
    await tester.tap(find.byType(DropdownButton<String>));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Sample rider').last);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Assign rider'));
    await tester.pumpAndSettle();
    expect(sentPath, '/orders/order-1/assignment');
    expect(sentBody, {'riderId': 'rider-1', 'version': 7});
  });
  testWidgets('owner confirms physical return before releasing a failed task', (
    tester,
  ) async {
    String? sentPath;
    await tester.pumpWidget(
      MaterialApp(
        theme: pistaTheme(),
        home: Scaffold(
          body: OwnerOrderActions(
            api: PistaApi(),
            order: {
              'id': 'order-1',
              'status': 'delivery_failed',
              'fulfilment': 'delivery',
              'paymentStatus': 'paid',
              'version': 7,
              'assignments': [
                {
                  'id': 'task-1',
                  'status': 'failed',
                  'isActive': true,
                  'version': 3,
                  'failureReason': 'Recipient unavailable',
                  'rider': {'name': 'Sample rider'},
                },
              ],
            },
            riders: [],
            busy: false,
            send: (path, body) async {
              sentPath = path;
            },
          ),
        ),
      ),
    );
    await tester.tap(find.text('Confirm return to outlet'));
    await tester.pumpAndSettle();
    expect(sentPath, isNull);
    await tester.tap(find.text('Confirm return'));
    await tester.pumpAndSettle();
    expect(sentPath, '/assignments/task-1/staff-actions');
  });
  test(
    'production mobile builds refuse development identity login by default',
    () async {
      final api = PistaApi();
      await expectLater(
        api.developmentLogin('owner'),
        throwsA(isA<ApiException>()),
      );
      api.close();
    },
  );
}
