import 'package:pista_ui/pista_ui.dart';

class VerificationDialog extends StatefulWidget {
  final bool failure;
  const VerificationDialog({super.key, required this.failure});
  @override
  State<VerificationDialog> createState() => _VerificationDialogState();
}

class _VerificationDialogState extends State<VerificationDialog> {
  final controller = TextEditingController();
  String? error;
  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    scrollable: true,
    title: Text(widget.failure ? 'Report delivery issue' : 'Verify delivery'),
    content: Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          widget.failure
              ? 'Tell the outlet what happened. This does not cancel the order or refund payment.'
              : 'Ask the customer for the delivery code shown in their app. Complete only after handing over the order.',
          style: const TextStyle(fontSize: 13, height: 1.6),
        ),
        const SizedBox(height: 16),
        TextField(
          controller: controller,
          autofocus: true,
          keyboardType: widget.failure
              ? TextInputType.multiline
              : TextInputType.number,
          maxLength: widget.failure ? 300 : 6,
          decoration: InputDecoration(
            labelText: widget.failure ? 'Reason' : '6-digit delivery code',
            errorText: error,
          ),
        ),
      ],
    ),
    actions: [
      TextButton(
        onPressed: () => Navigator.pop(context),
        child: const Text('Cancel'),
      ),
      FilledButton(
        onPressed: () {
          final value = controller.text.trim();
          if (widget.failure
              ? value.length < 3
              : !RegExp(r'^\d{6}$').hasMatch(value)) {
            setState(
              () => error = widget.failure
                  ? 'Enter a reason (at least 3 characters)'
                  : 'Enter the 6-digit delivery code',
            );
            return;
          }
          Navigator.pop(context, value);
        },
        child: Text(widget.failure ? 'Report issue' : 'Verify & complete'),
      ),
    ],
  );
}
