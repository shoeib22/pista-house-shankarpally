import 'package:flutter/material.dart';

typedef AccountRequest =
    Future<dynamic> Function(
      String path,
      String method,
      Map<String, dynamic>? body,
    );

class StaffAccount extends StatefulWidget {
  final AccountRequest request;
  final void Function(String) onToken;
  final VoidCallback onSignedOut;
  const StaffAccount({
    super.key,
    required this.request,
    required this.onToken,
    required this.onSignedOut,
  });
  @override
  State<StaffAccount> createState() => _StaffAccountState();
}

class _StaffAccountState extends State<StaffAccount> {
  final form = GlobalKey<FormState>(),
      current = TextEditingController(),
      password = TextEditingController(),
      confirmation = TextEditingController();
  List<Map<String, dynamic>> sessions = [];
  bool busy = false;
  String? error, message;
  @override
  void initState() {
    super.initState();
    load();
  }

  @override
  void dispose() {
    current.dispose();
    password.dispose();
    confirmation.dispose();
    super.dispose();
  }

  Future<void> load() async {
    try {
      final data = await widget.request('/auth/sessions', 'GET', null);
      if (mounted)
        setState(
          () => sessions = (data as List)
              .map((s) => Map<String, dynamic>.from(s))
              .toList(),
        );
    } catch (e) {
      if (mounted) setState(() => error = '$e');
    }
  }

  Future<void> run(Future<void> Function() action) async {
    setState(() {
      busy = true;
      error = null;
      message = null;
    });
    try {
      await action();
    } catch (e) {
      if (mounted) setState(() => error = '$e');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => ListView(
    padding: EdgeInsets.fromLTRB(
      24,
      24,
      24,
      24 + MediaQuery.viewInsetsOf(context).bottom,
    ),
    children: [
      const Text(
        'Your account',
        style: TextStyle(fontSize: 26, fontWeight: FontWeight.w600),
      ),
      const SizedBox(height: 14),
      if (error != null)
        Text(error!, style: const TextStyle(color: Colors.red)),
      if (message != null)
        Text(
          message!,
          style: TextStyle(color: Theme.of(context).colorScheme.primary),
        ),
      const Text(
        'Change passphrase',
        style: TextStyle(fontSize: 19, fontWeight: FontWeight.w600),
      ),
      const SizedBox(height: 16),
      Form(
        key: form,
        child: Column(
          children: [
            TextFormField(
              controller: current,
              obscureText: true,
              enabled: !busy,
              autofillHints: const [AutofillHints.password],
              decoration: const InputDecoration(
                labelText: 'Current passphrase',
              ),
              validator: (v) => v == null || v.isEmpty
                  ? 'Enter your current passphrase'
                  : null,
            ),
            const SizedBox(height: 14),
            TextFormField(
              controller: password,
              obscureText: true,
              enabled: !busy,
              maxLength: 128,
              autofillHints: const [AutofillHints.newPassword],
              decoration: const InputDecoration(labelText: 'New passphrase'),
              validator: (v) =>
                  (v?.length ?? 0) < 12 ? 'Use at least 12 characters' : null,
            ),
            const SizedBox(height: 8),
            TextFormField(
              controller: confirmation,
              obscureText: true,
              enabled: !busy,
              maxLength: 128,
              autofillHints: const [AutofillHints.newPassword],
              decoration: const InputDecoration(
                labelText: 'Confirm new passphrase',
              ),
              validator: (v) =>
                  v != password.text ? 'Passphrases do not match' : null,
            ),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: busy
                  ? null
                  : () => run(() async {
                      if (!form.currentState!.validate()) return;
                      final data = await widget.request(
                        '/auth/password',
                        'POST',
                        {
                          'currentPassword': current.text,
                          'password': password.text,
                        },
                      );
                      widget.onToken(data['token']);
                      current.clear();
                      password.clear();
                      confirmation.clear();
                      if (mounted)
                        setState(
                          () => message =
                              'Passphrase changed. Other sessions were revoked.',
                        );
                      await load();
                    }),
              child: const Text('Update passphrase'),
            ),
          ],
        ),
      ),
      const Divider(height: 36),
      const Text(
        'Active sessions',
        style: TextStyle(fontSize: 19, fontWeight: FontWeight.w600),
      ),
      for (final session in sessions)
        ListTile(
          contentPadding: EdgeInsets.zero,
          title: Text(
            session['current'] == true ? 'This session' : 'Another session',
          ),
          subtitle: Text(
            '${session['authMethod']} · expires ${DateTime.parse(session['expiresAt']).toLocal()}',
          ),
          trailing: TextButton(
            onPressed: busy
                ? null
                : () => run(() async {
                    await widget.request(
                      '/auth/sessions/${session['id']}',
                      'DELETE',
                      null,
                    );
                    if (session['current'] == true) {
                      widget.onSignedOut();
                    } else {
                      await load();
                    }
                  }),
            child: Text(session['current'] == true ? 'Sign out' : 'Revoke'),
          ),
        ),
      const SizedBox(height: 16),
      OutlinedButton(
        onPressed: busy
            ? null
            : () => run(() async {
                await widget.request('/auth/logout-all', 'POST', {});
                widget.onSignedOut();
              }),
        child: const Text('Sign out all sessions'),
      ),
    ],
  );
}
