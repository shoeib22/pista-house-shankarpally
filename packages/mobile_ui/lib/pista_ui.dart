import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
export 'package:flutter/material.dart';
export 'staff_access.dart';
export 'staff_account.dart';
export 'staff_team.dart';
export 'beta_server_dialog.dart';

const pistaGreen = Color(0xFF17613B);
const pistaIvory = Color(0xFFF7F3E9);
ThemeData pistaTheme() => ThemeData(
  colorScheme: ColorScheme.fromSeed(
    seedColor: pistaGreen,
    primary: pistaGreen,
    surface: const Color(0xFFFFFEFA),
  ),
  scaffoldBackgroundColor: const Color(0xFFFFFEFA),
  appBarTheme: const AppBarTheme(
    backgroundColor: Color(0xFFFFFEFA),
    surfaceTintColor: Colors.transparent,
  ),
  dividerColor: const Color(0xFFE0E4D8),
  inputDecorationTheme: InputDecorationTheme(
    filled: true,
    fillColor: pistaIvory,
    border: OutlineInputBorder(
      borderRadius: BorderRadius.circular(12),
      borderSide: BorderSide.none,
    ),
  ),
  filledButtonTheme: FilledButtonThemeData(
    style: FilledButton.styleFrom(
      minimumSize: const Size(0, 46),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
    ),
  ),
  useMaterial3: true,
);
String rupees(int paise) =>
    '₹${(paise / 100).toStringAsFixed(paise % 100 == 0 ? 0 : 2)}';

class PistaLogo extends StatelessWidget {
  const PistaLogo({super.key});
  @override
  Widget build(BuildContext context) => SizedBox(
    width: 164,
    height: 48,
    child: ClipRect(
      child: OverflowBox(
        alignment: Alignment.topLeft,
        maxHeight: 92,
        child: SvgPicture.asset(
          'assets/logo.svg',
          package: 'pista_ui',
          width: 164,
          height: 92,
          semanticsLabel: 'Pista House',
        ),
      ),
    ),
  );
}

class DevelopmentBanner extends StatelessWidget {
  const DevelopmentBanner({super.key});
  @override
  Widget build(BuildContext context) => Container(
    width: double.infinity,
    padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 9),
    color: pistaIvory,
    child: const Text(
      bool.fromEnvironment('BETA_TESTING')
          ? 'TESTFLIGHT BETA · sample menu · simulated payments'
          : 'DEVELOPMENT · sample menu · test payments',
      style: TextStyle(fontSize: 10, color: Color(0xFF807043)),
    ),
  );
}

class OrderTile extends StatelessWidget {
  final Map<String, dynamic> order;
  final Widget? action;
  const OrderTile(this.order, {super.key, this.action});
  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.only(bottom: 14),
    padding: const EdgeInsets.all(18),
    decoration: BoxDecoration(
      border: Border.all(color: const Color(0xFFE0E4D8)),
      borderRadius: BorderRadius.circular(12),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text(
              '#PH${order['number'].toString().padLeft(4, '0')}',
              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 17),
            ),
            const Spacer(),
            Text(rupees(order['totalPaise'])),
          ],
        ),
        const SizedBox(height: 9),
        Text(
          '${order['status']}'.replaceAll('_', ' '),
          style: const TextStyle(color: pistaGreen),
        ),
        const SizedBox(height: 6),
        Text(
          'Payment: ${order['paymentStatus']}',
          style: const TextStyle(fontSize: 12, color: Colors.black54),
        ),
        for (final item in order['items'] as List)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text('${item['quantity']} × ${item['name']}'),
          ),
        if (action != null)
          Padding(padding: const EdgeInsets.only(top: 14), child: action!),
      ],
    ),
  );
}
