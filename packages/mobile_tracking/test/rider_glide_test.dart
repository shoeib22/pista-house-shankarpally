import 'package:flutter_test/flutter_test.dart';
import 'package:pista_tracking/pista_tracking.dart';

void main() {
  testWidgets(
    'rider marker glides between two real fixes and never overshoots',
    (tester) async {
      final glide = RiderGlide(tester);
      addTearDown(glide.dispose);
      const a = LatLng(17.4500, 78.1400), b = LatLng(17.4510, 78.1410);
      expect(glide.value, isNull);
      glide.moveTo(a);
      expect(glide.value, a);
      glide.moveTo(b);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 1750));
      final mid = glide.value!;
      expect(mid.latitude, inInclusiveRange(a.latitude, b.latitude));
      expect(mid.latitude, isNot(a.latitude));
      expect(mid.latitude, isNot(b.latitude));
      await tester.pump(const Duration(seconds: 4));
      expect(glide.value, b);
      await tester.pump(const Duration(seconds: 6));
    },
  );

  testWidgets('large jumps and reduced motion snap instead of sliding', (
    tester,
  ) async {
    final glide = RiderGlide(tester);
    addTearDown(glide.dispose);
    glide.moveTo(const LatLng(17.45, 78.14));
    glide.moveTo(const LatLng(17.60, 78.30));
    expect(glide.value, const LatLng(17.60, 78.30));
    glide.moveTo(const LatLng(17.6001, 78.3001), animate: false);
    expect(glide.value, const LatLng(17.6001, 78.3001));
    glide.moveTo(null);
    expect(glide.value, isNull);
  });

  testWidgets(
    'dead reckoning carries a moving rider on briefly, within bounds',
    (tester) async {
      final glide = RiderGlide(tester);
      addTearDown(glide.dispose);
      final t0 = DateTime.utc(2026, 11, 22, 12);
      const a = LatLng(17.4500, 78.1400), b = LatLng(17.4502, 78.1400);
      glide.moveTo(a, recordedAt: t0);
      glide.moveTo(b, recordedAt: t0.add(const Duration(seconds: 4)));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 3600));
      expect(glide.estimating, isTrue);
      await tester.pump(const Duration(milliseconds: 2000));
      final guess = glide.value!;
      expect(guess.latitude, greaterThan(b.latitude));
      expect(guess.longitude, b.longitude);
      await tester.pump(const Duration(seconds: 6));
      final end = glide.value!;
      expect(end.latitude - b.latitude, lessThanOrEqualTo(0.00021));
      expect(
        const Distance().as(LengthUnit.Meter, b, end),
        lessThanOrEqualTo(60),
      );
    },
  );

  testWidgets('a stationary rider and reduced motion never drift', (
    tester,
  ) async {
    final glide = RiderGlide(tester);
    addTearDown(glide.dispose);
    final t0 = DateTime.utc(2026, 11, 22, 12);
    const a = LatLng(17.4500, 78.1400), still = LatLng(17.450001, 78.1400);
    glide.moveTo(a, recordedAt: t0);
    glide.moveTo(still, recordedAt: t0.add(const Duration(seconds: 4)));
    await tester.pump();
    await tester.pump(const Duration(seconds: 7));
    expect(glide.value, still);
    expect(glide.estimating, isFalse);
    const c = LatLng(17.4510, 78.1400), d = LatLng(17.4512, 78.1400);
    glide.moveTo(
      c,
      recordedAt: t0.add(const Duration(seconds: 8)),
      animate: false,
    );
    glide.moveTo(
      d,
      recordedAt: t0.add(const Duration(seconds: 12)),
      animate: false,
    );
    await tester.pump(const Duration(seconds: 7));
    expect(glide.value, d);
  });
}
