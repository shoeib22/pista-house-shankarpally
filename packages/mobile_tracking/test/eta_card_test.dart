import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pista_tracking/pista_tracking.dart';

Map<String, dynamic> eta(String confidence) => {
  'available': true,
  'minutesLow': 24,
  'minutesHigh': 36,
  'confidence': confidence,
  'stages': [
    {'key': 'prep', 'label': 'Preparing your food', 'minutes': 10},
    {'key': 'travel', 'label': 'Travel to you', 'minutes': 12},
    {'key': 'handoff', 'label': 'Handing over at your door', 'minutes': 3},
  ],
};

void main() {
  test('range collapses when low and high match', () {
    expect(etaRange({'minutesLow': 5, 'minutesHigh': 5}), '5 min');
    expect(etaRange(eta('rough')), '24\u201336 min');
  });
  testWidgets('estimate shows a range, its stages and an honest caveat', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(body: EtaCard(eta: eta('rough'))),
      ),
    );
    expect(find.text('About 24\u201336 min'), findsOneWidget);
    expect(find.text('Preparing your food'), findsOneWidget);
    expect(find.text('~12 min'), findsOneWidget);
    expect(find.textContaining('rough estimate'), findsOneWidget);
    expect(find.textContaining('Not traffic-aware'), findsOneWidget);
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(body: EtaCard(eta: eta('history'))),
      ),
    );
    expect(
      find.textContaining('recent orders and road distance'),
      findsOneWidget,
    );
    expect(find.textContaining('rough estimate'), findsNothing);
  });
}
