import 'package:flutter_test/flutter_test.dart';
import 'package:pista_core/pista_core.dart';
import 'package:pista_delivery/main.dart';
import 'package:pista_ui/pista_ui.dart';

class RiderFakeApi extends PistaApi {
  bool online = false, offline = false, loseCompletionResponse = false;
  bool revoked = false;
  int completions = 0;
  final task = <String, dynamic>{
    'id': 'task-1',
    'version': 1,
    'isActive': true,
    'status': 'picked_up',
    'order': {
      'id': 'order-1',
      'number': 1,
      'status': 'out_for_delivery',
      'paymentStatus': 'paid',
      'totalPaise': 31900,
      'deliveryAddress': null,
      'items': [
        {'name': 'Sample biryani', 'quantity': 1},
      ],
    },
  };
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
    if (offline) throw Exception('Network unavailable');
    if (revoked) throw ApiException('Session revoked', 401);
    if (path == '/auth/login') {
      return {
        'token': 'test',
        'user': {'role': 'rider'},
      };
    }
    if (path == '/rider/availability') {
      online = (body as Map)['available'];
      return {'riderAvailable': online};
    }
    if (path.endsWith('/complete')) {
      completions++;
      task['status'] = 'delivered';
      task['isActive'] = false;
      task['version'] = 2;
      if (loseCompletionResponse) {
        offline = true;
        throw Exception('Response interrupted');
      }
      return {'ok': true};
    }
    if (path == '/rider/tasks') {
      return {
        'available': online,
        'tasks': [task],
      };
    }
    throw StateError('Unexpected path $path');
  }
}

void main() {
  test('revoked rider sessions clear cached task and contact data', () async {
    final api = RiderFakeApi();
    final current = DeliveryModel(api);
    await current.login();
    expect(current.tasks, isNotEmpty);
    api.revoked = true;
    await current.refresh();
    expect(current.signedIn, isFalse);
    expect(current.tasks, isEmpty);
    expect(api.token, isNull);
    current.dispose();
  });
  test(
    'unconfirmed completion stays pending until server state is reconciled',
    () async {
      final api = RiderFakeApi();
      final model = DeliveryModel(api);
      await model.login();
      api.loseCompletionResponse = true;
      await model.complete(model.tasks.single, '123456');
      expect(model.tasks.single['status'], 'picked_up');
      expect(model.connected, isFalse);
      expect(model.pendingAction, 'Delivery completion');
      api.offline = false;
      await model.refresh();
      expect(model.tasks.single['status'], 'delivered');
      expect(model.pendingAction, isNull);
      expect(api.completions, 1);
      model.dispose();
    },
  );
  testWidgets('rider verifies a delivery and sees it in history', (
    tester,
  ) async {
    final model = DeliveryModel(RiderFakeApi());
    await tester.pumpWidget(
      MaterialApp(
        theme: pistaTheme(),
        home: DeliveryHome(model: model),
      ),
    );
    await tester.enterText(find.byType(TextFormField).at(0), 'sample.rider');
    await tester.enterText(
      find.byType(TextFormField).at(1),
      'sample-test-passphrase',
    );
    await tester.scrollUntilVisible(
      find.widgetWithText(FilledButton, 'Sign in').hitTestable(),
      120,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.tap(find.widgetWithText(FilledButton, 'Sign in'));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(
      find.text('Verify delivery code').hitTestable(),
      150,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.tap(find.text('Verify delivery code'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), '123456');
    await tester.tap(find.text('Verify & complete'));
    await tester.pumpAndSettle();
    expect(model.tasks.single['status'], 'delivered');
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox());
  });
  test('rider build refuses an unconfigured identity provider', () async {
    final api = PistaApi();
    await expectLater(
      api.developmentLogin('rider'),
      throwsA(isA<ApiException>()),
    );
    api.close();
  });
}
