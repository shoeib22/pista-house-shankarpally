import 'package:pista_ui/pista_ui.dart';
import 'package:pista_core/pista_core.dart';

class BetaAccessSheet extends StatefulWidget {
  final PistaApi api;
  const BetaAccessSheet({super.key, required this.api});
  @override
  State<BetaAccessSheet> createState() => _BetaAccessSheetState();
}

class _BetaAccessSheetState extends State<BetaAccessSheet> {
  bool busy = false;
  String? error;
  @override
  Widget build(BuildContext context) => ConstrainedBox(
    constraints: BoxConstraints(
      maxHeight: MediaQuery.sizeOf(context).height * .9,
    ),
    child: ListView(
      shrinkWrap: true,
      padding: EdgeInsets.fromLTRB(
        24,
        24,
        24,
        24 + MediaQuery.viewInsetsOf(context).bottom,
      ),
      children: [
        const PistaLogo(),
        const SizedBox(height: 20),
        const Text(
          'Private TestFlight beta',
          style: TextStyle(color: pistaGreen, fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 12),
        const Text(
          'Use the customer test account provided by your outlet administrator. This beta uses sample orders and simulated payments.',
          style: TextStyle(height: 1.7),
        ),
        const SizedBox(height: 22),
        if (error != null)
          Text(error!, style: const TextStyle(color: Colors.red)),
        StaffAccess(
          title: 'Customer test sign-in',
          busy: busy,
          developmentLabel: '',
          onSignIn: (handle, password) async {
            setState(() {
              busy = true;
              error = null;
            });
            try {
              await widget.api.passwordLogin(handle, password, 'customer');
              if (context.mounted) Navigator.pop(context, true);
            } catch (e) {
              if (mounted) setState(() => error = '$e');
            } finally {
              if (mounted) setState(() => busy = false);
            }
          },
        ),
      ],
    ),
  );
}
