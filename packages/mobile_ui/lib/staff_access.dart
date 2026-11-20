import 'package:flutter/material.dart';

class StaffAccess extends StatefulWidget {
  final Future<void> Function(String, String) onSignIn;
  final Future<void> Function(String, String)? onAccept;
  final VoidCallback? onDevelopment;
  final String title, developmentLabel;
  final bool busy;
  const StaffAccess({
    super.key,
    required this.onSignIn,
    this.onAccept,
    required this.title,
    required this.developmentLabel,
    required this.busy,
    this.onDevelopment,
  });
  @override
  State<StaffAccess> createState() => _StaffAccessState();
}

class _StaffAccessState extends State<StaffAccess> {
  final form = GlobalKey<FormState>(),
      handle = TextEditingController(),
      password = TextEditingController(),
      code = TextEditingController(),
      confirmation = TextEditingController();
  bool invitation = false;
  @override
  void dispose() {
    for (final c in [handle, password, code, confirmation]) {
      c.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Form(
    key: form,
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          widget.title,
          style: const TextStyle(fontSize: 27, fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 14),
        if (widget.onAccept != null)
          SegmentedButton<bool>(
            segments: const [
              ButtonSegment(value: false, label: Text('Sign in')),
              ButtonSegment(value: true, label: Text('Use invitation')),
            ],
            selected: {invitation},
            onSelectionChanged: widget.busy
                ? null
                : (v) => setState(() => invitation = v.first),
          ),
        const SizedBox(height: 22),
        if (invitation)
          TextFormField(
            controller: code,
            enabled: !widget.busy,
            autocorrect: false,
            enableSuggestions: false,
            decoration: const InputDecoration(
              labelText: 'Invitation or recovery code',
            ),
            validator: (v) =>
                RegExp(r'^[a-f0-9]{64}$').hasMatch(v?.trim() ?? '')
                ? null
                : 'Enter the code from your owner',
          )
        else
          TextFormField(
            controller: handle,
            enabled: !widget.busy,
            autocorrect: false,
            enableSuggestions: false,
            autofillHints: const [AutofillHints.username],
            decoration: const InputDecoration(labelText: 'Sign-in handle'),
            validator: (v) => (v?.trim().length ?? 0) < 3
                ? 'Enter your sign-in handle'
                : null,
          ),
        const SizedBox(height: 14),
        TextFormField(
          controller: password,
          enabled: !widget.busy,
          obscureText: true,
          autocorrect: false,
          enableSuggestions: false,
          autofillHints: [
            invitation ? AutofillHints.newPassword : AutofillHints.password,
          ],
          maxLength: 128,
          decoration: InputDecoration(
            labelText: invitation ? 'Choose a passphrase' : 'Passphrase',
          ),
          validator: (v) => (v?.length ?? 0) < (invitation ? 12 : 1)
              ? (invitation
                    ? 'Use at least 12 characters'
                    : 'Enter your passphrase')
              : null,
        ),
        if (invitation) ...[
          const SizedBox(height: 8),
          TextFormField(
            controller: confirmation,
            enabled: !widget.busy,
            obscureText: true,
            autocorrect: false,
            enableSuggestions: false,
            autofillHints: const [AutofillHints.newPassword],
            maxLength: 128,
            decoration: const InputDecoration(labelText: 'Confirm passphrase'),
            validator: (v) =>
                v != password.text ? 'Passphrases do not match' : null,
          ),
        ],
        const SizedBox(height: 20),
        FilledButton(
          onPressed: widget.busy
              ? null
              : () async {
                  if (!form.currentState!.validate()) return;
                  final first = invitation
                      ? code.text.trim()
                      : handle.text.trim();
                  final pass = password.text;
                  try {
                    if (invitation) {
                      await widget.onAccept!(first, pass);
                    } else {
                      await widget.onSignIn(first, pass);
                    }
                  } finally {
                    if (mounted) {
                      password.clear();
                      confirmation.clear();
                    }
                  }
                },
          child: Text(
            widget.busy
                ? 'Please wait…'
                : invitation
                ? 'Activate account'
                : 'Sign in',
          ),
        ),
        const SizedBox(height: 14),
        const Text(
          'Need access or password recovery? Ask your outlet owner. Invitations expire after 24 hours.',
          style: TextStyle(fontSize: 13, color: Colors.black54, height: 1.6),
        ),
        if (widget.onDevelopment != null) ...[
          const Divider(height: 36),
          OutlinedButton(
            onPressed: widget.busy ? null : widget.onDevelopment,
            child: Text(widget.developmentLabel),
          ),
        ],
      ],
    ),
  );
}
