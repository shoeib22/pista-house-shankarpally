import 'package:flutter/material.dart';

class BetaServerDialog extends StatefulWidget {
  final String initialUrl;
  final Future<void> Function(String) onConnect;
  const BetaServerDialog({
    super.key,
    required this.initialUrl,
    required this.onConnect,
  });
  @override
  State<BetaServerDialog> createState() => _BetaServerDialogState();
}

class _BetaServerDialogState extends State<BetaServerDialog> {
  late final controller = TextEditingController(text: widget.initialUrl);
  bool busy = false;
  String? error;
  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    scrollable: true,
    title: const Text('Beta test server'),
    content: Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'This beta can be installed before the backend is online. Connect when your administrator provides the HTTPS API address. Use only the address supplied by the app owner.',
          style: TextStyle(height: 1.6),
        ),
        const SizedBox(height: 18),
        TextField(
          controller: controller,
          enabled: !busy,
          keyboardType: TextInputType.url,
          autocorrect: false,
          decoration: InputDecoration(
            labelText: 'HTTPS API URL ending in /api',
            errorText: error,
          ),
        ),
      ],
    ),
    actions: [
      TextButton(
        onPressed: busy ? null : () => Navigator.pop(context),
        child: const Text('Close'),
      ),
      FilledButton(
        onPressed: busy
            ? null
            : () async {
                setState(() {
                  busy = true;
                  error = null;
                });
                try {
                  await widget.onConnect(controller.text);
                  if (context.mounted) Navigator.pop(context, true);
                } catch (e) {
                  if (mounted) setState(() => error = '$e');
                } finally {
                  if (mounted) setState(() => busy = false);
                }
              },
        child: Text(busy ? 'Checking…' : 'Verify & connect'),
      ),
    ],
  );
}
