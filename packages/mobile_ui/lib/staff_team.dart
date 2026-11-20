import 'package:flutter/material.dart';
import 'staff_account.dart';

class StaffTeam extends StatefulWidget {
  final AccountRequest request;
  const StaffTeam({super.key, required this.request});
  @override
  State<StaffTeam> createState() => _StaffTeamState();
}

class _StaffTeamState extends State<StaffTeam> {
  final form = GlobalKey<FormState>(),
      name = TextEditingController(),
      handle = TextEditingController();
  String role = 'counter';
  bool busy = false;
  String? error;
  List<Map<String, dynamic>> members = [], invitations = [];
  Map<String, dynamic>? issued;
  @override
  void initState() {
    super.initState();
    load();
  }

  @override
  void dispose() {
    name.dispose();
    handle.dispose();
    super.dispose();
  }

  Future<void> load() async {
    try {
      final data = await Future.wait([
        widget.request('/team', 'GET', null),
        widget.request('/team/invitations', 'GET', null),
      ]);
      if (mounted)
        setState(() {
          members = (data[0] as List)
              .map((m) => Map<String, dynamic>.from(m))
              .toList();
          invitations = (data[1] as List)
              .map((m) => Map<String, dynamic>.from(m))
              .toList();
        });
    } catch (e) {
      if (mounted) setState(() => error = '$e');
    }
  }

  Future<void> run(Future<void> Function() action) async {
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await action();
      await load();
    } catch (e) {
      if (mounted) setState(() => error = '$e');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<bool> confirm(String message) async =>
      await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Confirm account change'),
          content: Text(message),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Confirm'),
            ),
          ],
        ),
      ) ??
      false;
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
        'Team access',
        style: TextStyle(fontSize: 26, fontWeight: FontWeight.w600),
      ),
      const SizedBox(height: 14),
      const Text(
        'Invite teammates with the role they need. Share codes privately; no email or SMS is sent.',
        style: TextStyle(height: 1.7),
      ),
      const SizedBox(height: 18),
      if (error != null)
        Text(error!, style: const TextStyle(color: Colors.red)),
      if (issued != null)
        Container(
          padding: const EdgeInsets.all(18),
          margin: const EdgeInsets.symmetric(vertical: 18),
          decoration: BoxDecoration(
            border: Border.all(color: Theme.of(context).colorScheme.primary),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'One-time code · ${issued!['handle']}',
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 12),
              SelectableText(
                issued!['token'],
                style: const TextStyle(fontFamily: 'monospace'),
              ),
              const SizedBox(height: 12),
              const Text(
                'Shown once. Expires after 24 hours. The recipient sets their own passphrase.',
                style: TextStyle(fontSize: 13, height: 1.6),
              ),
              TextButton(
                onPressed: () => setState(() => issued = null),
                child: const Text('Dismiss code'),
              ),
            ],
          ),
        ),
      Form(
        key: form,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextFormField(
              controller: name,
              enabled: !busy,
              decoration: const InputDecoration(labelText: 'Full name'),
              validator: (v) =>
                  (v?.trim().length ?? 0) < 2 ? 'Enter a full name' : null,
            ),
            const SizedBox(height: 14),
            TextFormField(
              controller: handle,
              enabled: !busy,
              autocorrect: false,
              enableSuggestions: false,
              decoration: const InputDecoration(labelText: 'Sign-in handle'),
              validator: (v) =>
                  RegExp(
                    r'^[a-z0-9][a-z0-9._-]{2,47}$',
                  ).hasMatch(v?.trim().toLowerCase() ?? '')
                  ? null
                  : 'Use 3–48 letters, numbers, dots or hyphens',
            ),
            const SizedBox(height: 14),
            DropdownButtonFormField<String>(
              initialValue: role,
              decoration: const InputDecoration(labelText: 'Role'),
              items: const [
                DropdownMenuItem(value: 'counter', child: Text('Counter')),
                DropdownMenuItem(value: 'kitchen', child: Text('Kitchen')),
                DropdownMenuItem(value: 'rider', child: Text('Delivery rider')),
              ],
              onChanged: busy ? null : (v) => setState(() => role = v!),
            ),
            const SizedBox(height: 18),
            FilledButton(
              onPressed: busy
                  ? null
                  : () => run(() async {
                      if (!form.currentState!.validate()) return;
                      final result = await widget
                          .request('/team/invitations', 'POST', {
                            'name': name.text.trim(),
                            'handle': handle.text.trim(),
                            'role': role,
                          });
                      if (mounted)
                        setState(
                          () => issued = Map<String, dynamic>.from(result),
                        );
                      name.clear();
                      handle.clear();
                    }),
              child: const Text('Create invitation'),
            ),
          ],
        ),
      ),
      const Divider(height: 36),
      const Text(
        'Outlet accounts',
        style: TextStyle(fontSize: 20, fontWeight: FontWeight.w600),
      ),
      for (final m in members)
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                m['name'],
                style: const TextStyle(
                  fontWeight: FontWeight.w600,
                  fontSize: 16,
                ),
              ),
              Text(
                '${m['role']} · ${m['credential']?['handle'] ?? 'Development identity'} · ${m['disabledAt'] == null ? 'Enabled' : 'Suspended'}',
                style: const TextStyle(
                  fontSize: 13,
                  color: Colors.black54,
                  height: 1.6,
                ),
              ),
              if (m['role'] != 'owner')
                Wrap(
                  spacing: 8,
                  children: [
                    if (m['credential'] != null && m['disabledAt'] == null)
                      TextButton(
                        onPressed: busy
                            ? null
                            : () => run(() async {
                                if (!await confirm(
                                  'Create a recovery code for ${m['name']}? Their sessions will be revoked when it is accepted.',
                                ))
                                  return;
                                final result = await widget.request(
                                  '/team/${m['id']}/recovery-invitation',
                                  'POST',
                                  {},
                                );
                                if (mounted)
                                  setState(
                                    () => issued = Map<String, dynamic>.from(
                                      result,
                                    ),
                                  );
                              }),
                        child: const Text('Recovery code'),
                      ),
                    TextButton(
                      onPressed: busy
                          ? null
                          : () => run(() async {
                              if (!await confirm(
                                '${m['disabledAt'] == null ? 'Suspend' : 'Re-enable'} ${m['name']}? Existing sessions will be revoked. Open deliveries will return to outlet review.',
                              ))
                                return;
                              await widget.request(
                                '/team/${m['id']}/status',
                                'PATCH',
                                {'disabled': m['disabledAt'] == null},
                              );
                            }),
                      child: Text(
                        m['disabledAt'] == null ? 'Suspend' : 'Re-enable',
                      ),
                    ),
                  ],
                ),
            ],
          ),
        ),
      const Divider(height: 24),
      const Text(
        'Recent invitations',
        style: TextStyle(fontSize: 20, fontWeight: FontWeight.w600),
      ),
      for (final i in invitations.take(20))
        ListTile(
          contentPadding: EdgeInsets.zero,
          title: Text(i['handle']),
          subtitle: Text(
            '${i['role']} · ${i['usedAt'] != null
                ? 'Accepted'
                : i['revokedAt'] != null
                ? 'Revoked'
                : DateTime.parse(i['expiresAt']).isBefore(DateTime.now())
                ? 'Expired'
                : 'Awaiting acceptance'}',
          ),
          trailing:
              i['usedAt'] == null &&
                  i['revokedAt'] == null &&
                  DateTime.parse(i['expiresAt']).isAfter(DateTime.now())
              ? TextButton(
                  onPressed: busy
                      ? null
                      : () => run(() async {
                          await widget.request(
                            '/team/invitations/${i['id']}',
                            'DELETE',
                            null,
                          );
                        }),
                  child: const Text('Revoke'),
                )
              : null,
        ),
    ],
  );
}
