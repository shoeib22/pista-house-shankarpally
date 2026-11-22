import 'dart:async';
import 'package:pista_ui/pista_ui.dart';
import 'package:pista_core/pista_core.dart';

const _cream = Color(0xFFFBF3E8);
const _red = Color(0xFF9B2C1F);

/// Adds or verifies the account's email with a 6-digit code. Pops `true` once
/// the email is verified. Skipping is allowed: ordering does not need it, but
/// without a verified email a forgotten passphrase cannot be reset.
class VerifyEmailPage extends StatefulWidget {
  final PistaApi api;

  /// Whether the verification email was already sent (for example by sign-up).
  final bool alreadySent;
  const VerifyEmailPage({
    super.key,
    required this.api,
    this.alreadySent = false,
  });
  @override
  State<VerifyEmailPage> createState() => _VerifyEmailPageState();
}

class _VerifyEmailPageState extends State<VerifyEmailPage> {
  final email = TextEditingController(), code = TextEditingController();
  final emailForm = GlobalKey<FormState>(), codeForm = GlobalKey<FormState>();
  late bool entering = widget.api.userEmail == null;
  bool busy = false;
  String? error, notice;
  int wait = 0;
  Timer? timer;

  @override
  void initState() {
    super.initState();
    if (!entering) {
      notice = widget.alreadySent
          ? 'We sent a 6-digit code to ${widget.api.userEmail}.'
          : 'Tap “Send a new code” to get a 6-digit code at ${widget.api.userEmail}.';
      if (widget.alreadySent) _startWait();
    }
  }

  @override
  void dispose() {
    timer?.cancel();
    email.dispose();
    code.dispose();
    super.dispose();
  }

  void _startWait() {
    timer?.cancel();
    setState(() => wait = 60);
    timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) return t.cancel();
      setState(() => wait = wait > 0 ? wait - 1 : 0);
      if (wait == 0) t.cancel();
    });
  }

  Future<void> run(Future<void> Function() action) async {
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await action();
    } catch (e) {
      if (mounted) setState(() => error = '$e');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> sendTo(String address) => run(() async {
    final sent = await widget.api.setEmail(address);
    if (!mounted) return;
    setState(() {
      entering = false;
      notice = sent
          ? 'We sent a 6-digit code to $address.'
          : 'We could not send the email just now. Tap “Send a new code” to try again.';
    });
    if (sent) _startWait();
  });

  Future<void> resend() => run(() async {
    final sent = await widget.api.resendEmailCode();
    if (!mounted) return;
    setState(() {
      notice = sent
          ? 'A new code is on its way to ${widget.api.userEmail}.'
          : 'We could not send the email just now. Please try again shortly.';
    });
    if (sent) _startWait();
  });

  Future<void> verify() async {
    if (!codeForm.currentState!.validate()) return;
    await run(() async {
      await widget.api.verifyEmail(code.text.trim());
      if (mounted) Navigator.pop(context, true);
    });
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: _cream,
    appBar: AppBar(
      backgroundColor: _cream,
      title: Text(entering ? 'Add your email' : 'Verify your email'),
    ),
    body: SafeArea(
      child: ListView(
        padding: EdgeInsets.fromLTRB(
          24,
          8,
          24,
          24 + MediaQuery.viewInsetsOf(context).bottom,
        ),
        children: [
          const Text(
            'A verified email lets you reset your passphrase if you ever forget it. We never send marketing email.',
            style: TextStyle(height: 1.6),
          ),
          const SizedBox(height: 20),
          if (entering)
            Form(
              key: emailForm,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  TextFormField(
                    controller: email,
                    enabled: !busy,
                    keyboardType: TextInputType.emailAddress,
                    autocorrect: false,
                    autofillHints: const [AutofillHints.email],
                    decoration: const InputDecoration(
                      labelText: 'Email address',
                    ),
                    validator: (v) =>
                        RegExp(
                          r'^[^@\s]+@[^@\s]+\.[^@\s]+$',
                        ).hasMatch((v ?? '').trim())
                        ? null
                        : 'Enter a valid email address',
                  ),
                  const SizedBox(height: 16),
                  FilledButton(
                    style: FilledButton.styleFrom(
                      minimumSize: const Size.fromHeight(52),
                    ),
                    onPressed: busy
                        ? null
                        : () {
                            if (emailForm.currentState!.validate()) {
                              sendTo(email.text.trim());
                            }
                          },
                    child: Text(busy ? 'Please wait…' : 'Send code'),
                  ),
                ],
              ),
            )
          else
            Form(
              key: codeForm,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (notice != null)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 14),
                      child: Text(notice!, style: const TextStyle(height: 1.5)),
                    ),
                  TextFormField(
                    controller: code,
                    enabled: !busy,
                    keyboardType: TextInputType.number,
                    maxLength: 6,
                    autofillHints: const [AutofillHints.oneTimeCode],
                    decoration: const InputDecoration(
                      labelText: '6-digit code',
                      counterText: '',
                    ),
                    validator: (v) =>
                        RegExp(r'^\d{6}$').hasMatch((v ?? '').trim())
                        ? null
                        : 'Enter the 6-digit code',
                  ),
                  const SizedBox(height: 16),
                  FilledButton(
                    style: FilledButton.styleFrom(
                      minimumSize: const Size.fromHeight(52),
                    ),
                    onPressed: busy ? null : verify,
                    child: Text(busy ? 'Please wait…' : 'Verify email'),
                  ),
                  const SizedBox(height: 6),
                  TextButton(
                    onPressed: busy || wait > 0 ? null : resend,
                    child: Text(
                      wait > 0
                          ? 'Send a new code in ${wait}s'
                          : 'Send a new code',
                    ),
                  ),
                  TextButton(
                    onPressed: busy
                        ? null
                        : () => setState(() => entering = true),
                    child: const Text('Use a different email'),
                  ),
                  const Text(
                    'Codes expire after 10 minutes and work once. Check your spam folder if it does not arrive.',
                    style: TextStyle(
                      fontSize: 12,
                      color: Colors.black54,
                      height: 1.5,
                    ),
                  ),
                ],
              ),
            ),
          if (error != null)
            Padding(
              padding: const EdgeInsets.only(top: 14),
              child: Text(error!, style: const TextStyle(color: _red)),
            ),
          const SizedBox(height: 10),
          TextButton(
            onPressed: busy ? null : () => Navigator.pop(context, false),
            child: const Text('Skip for now'),
          ),
        ],
      ),
    ),
  );
}

/// Forgotten passphrase: ask for a code, then set a new passphrase. Pops the
/// mobile number or email the customer used so sign-in can be pre-filled.
class ForgotPassphrasePage extends StatefulWidget {
  final PistaApi api;
  final String initialIdentifier;
  const ForgotPassphrasePage({
    super.key,
    required this.api,
    this.initialIdentifier = '',
  });
  @override
  State<ForgotPassphrasePage> createState() => _ForgotPassphrasePageState();
}

class _ForgotPassphrasePageState extends State<ForgotPassphrasePage> {
  late final identifier = TextEditingController(text: widget.initialIdentifier);
  final code = TextEditingController(),
      password = TextEditingController(),
      confirm = TextEditingController();
  final askForm = GlobalKey<FormState>(), resetForm = GlobalKey<FormState>();
  bool asked = false, busy = false, hidden = true;
  String? error, notice;

  @override
  void dispose() {
    for (final c in [identifier, code, password, confirm]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> run(Future<void> Function() action) async {
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await action();
    } catch (e) {
      if (mounted) setState(() => error = '$e');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> ask() async {
    if (!askForm.currentState!.validate()) return;
    await run(() async {
      final message = await widget.api.forgotPassphrase(identifier.text.trim());
      if (mounted) {
        setState(() {
          asked = true;
          notice = message;
        });
      }
    });
  }

  Future<void> reset() async {
    if (!resetForm.currentState!.validate()) return;
    await run(() async {
      await widget.api.resetPassphrase(
        identifier.text.trim(),
        code.text.trim(),
        password.text,
      );
      if (mounted) Navigator.pop(context, identifier.text.trim());
    });
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: _cream,
    appBar: AppBar(
      backgroundColor: _cream,
      title: const Text('Reset your passphrase'),
    ),
    body: SafeArea(
      child: ListView(
        padding: EdgeInsets.fromLTRB(
          24,
          8,
          24,
          24 + MediaQuery.viewInsetsOf(context).bottom,
        ),
        children: [
          Form(
            key: askForm,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text(
                  'Enter your mobile number or email. If it matches an account with a verified email, we will send a 6-digit code there.',
                  style: TextStyle(height: 1.6),
                ),
                const SizedBox(height: 16),
                TextFormField(
                  controller: identifier,
                  enabled: !busy && !asked,
                  autocorrect: false,
                  decoration: const InputDecoration(
                    labelText: 'Mobile number or email',
                  ),
                  validator: (v) => (v ?? '').trim().length < 3
                      ? 'Enter your mobile number or email'
                      : null,
                ),
                if (!asked) ...[
                  const SizedBox(height: 16),
                  FilledButton(
                    style: FilledButton.styleFrom(
                      minimumSize: const Size.fromHeight(52),
                    ),
                    onPressed: busy ? null : ask,
                    child: Text(busy ? 'Please wait…' : 'Send code'),
                  ),
                ],
              ],
            ),
          ),
          if (asked)
            Form(
              key: resetForm,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const SizedBox(height: 18),
                  if (notice != null)
                    Text(notice!, style: const TextStyle(height: 1.5)),
                  const SizedBox(height: 14),
                  TextFormField(
                    controller: code,
                    enabled: !busy,
                    keyboardType: TextInputType.number,
                    maxLength: 6,
                    decoration: const InputDecoration(
                      labelText: '6-digit code',
                      counterText: '',
                    ),
                    validator: (v) =>
                        RegExp(r'^\d{6}$').hasMatch((v ?? '').trim())
                        ? null
                        : 'Enter the 6-digit code',
                  ),
                  const SizedBox(height: 14),
                  TextFormField(
                    controller: password,
                    enabled: !busy,
                    obscureText: hidden,
                    autocorrect: false,
                    enableSuggestions: false,
                    decoration: InputDecoration(
                      labelText: 'New passphrase',
                      helperText: 'At least 12 characters.',
                      suffixIcon: IconButton(
                        tooltip: hidden ? 'Show passphrase' : 'Hide passphrase',
                        icon: Icon(
                          hidden
                              ? Icons.visibility_outlined
                              : Icons.visibility_off_outlined,
                        ),
                        onPressed: () => setState(() => hidden = !hidden),
                      ),
                    ),
                    validator: (v) => (v ?? '').length < 12
                        ? 'Use at least 12 characters'
                        : null,
                  ),
                  const SizedBox(height: 14),
                  TextFormField(
                    controller: confirm,
                    enabled: !busy,
                    obscureText: hidden,
                    autocorrect: false,
                    enableSuggestions: false,
                    decoration: const InputDecoration(
                      labelText: 'Repeat new passphrase',
                    ),
                    validator: (v) =>
                        v != password.text ? 'Passphrases do not match' : null,
                  ),
                  const SizedBox(height: 16),
                  FilledButton(
                    style: FilledButton.styleFrom(
                      minimumSize: const Size.fromHeight(52),
                    ),
                    onPressed: busy ? null : reset,
                    child: Text(busy ? 'Please wait…' : 'Set new passphrase'),
                  ),
                  TextButton(
                    onPressed: busy
                        ? null
                        : () => setState(() {
                            asked = false;
                            error = null;
                            code.clear();
                          }),
                    child: const Text('Send a new code'),
                  ),
                  const Text(
                    'Resetting signs you out everywhere. Codes expire after 10 minutes and work once.',
                    style: TextStyle(
                      fontSize: 12,
                      color: Colors.black54,
                      height: 1.5,
                    ),
                  ),
                ],
              ),
            ),
          if (error != null)
            Padding(
              padding: const EdgeInsets.only(top: 14),
              child: Text(error!, style: const TextStyle(color: _red)),
            ),
        ],
      ),
    ),
  );
}
