import 'package:pista_ui/pista_ui.dart';
import 'package:pista_core/pista_core.dart';
import 'email_pages.dart';

/// Customer sign-in and sign-up. Pops `true` once the customer is signed in.
///
/// Sign-up uses a mobile number and a passphrase. In this private beta the
/// number is not verified (no SMS provider is configured), and the page says so.
class CustomerAuthPage extends StatefulWidget {
  final PistaApi api;
  final bool startOnSignUp;
  const CustomerAuthPage({
    super.key,
    required this.api,
    this.startOnSignUp = false,
  });
  @override
  State<CustomerAuthPage> createState() => _CustomerAuthPageState();
}

class _CustomerAuthPageState extends State<CustomerAuthPage> {
  late bool signUp = widget.startOnSignUp;
  bool busy = false, hidden = true;
  String? error;
  final signInForm = GlobalKey<FormState>(),
      signUpForm = GlobalKey<FormState>();
  final handle = TextEditingController(),
      password = TextEditingController(),
      name = TextEditingController(),
      phone = TextEditingController(),
      email = TextEditingController(),
      newPassword = TextEditingController(),
      confirm = TextEditingController();

  @override
  void dispose() {
    for (final c in [
      handle,
      password,
      name,
      phone,
      email,
      newPassword,
      confirm,
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _forgot() async {
    final used = await Navigator.push<String>(
      context,
      MaterialPageRoute(
        builder: (_) => ForgotPassphrasePage(
          api: widget.api,
          initialIdentifier: handle.text.trim(),
        ),
      ),
    );
    if (used == null || !mounted) return;
    setState(() {
      handle.text = used;
      password.clear();
      error = null;
    });
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Passphrase changed. Sign in with your new passphrase.'),
      ),
    );
  }

  Future<void> submit() async {
    final form = (signUp ? signUpForm : signInForm).currentState!;
    if (!form.validate()) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      if (signUp) {
        await widget.api.register(
          name.text.trim(),
          phone.text.trim(),
          newPassword.text,
          email: email.text.trim(),
        );
        if (mounted &&
            widget.api.userEmail != null &&
            !widget.api.emailVerified) {
          // Ask for the emailed code right away; it can be skipped.
          await Navigator.push<bool>(
            context,
            MaterialPageRoute(
              builder: (_) => VerifyEmailPage(
                api: widget.api,
                alreadySent: widget.api.lastEmailSent,
              ),
            ),
          );
        }
      } else {
        await widget.api.passwordLogin(
          handle.text.trim(),
          password.text,
          'customer',
        );
      }
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) setState(() => error = '$e');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Widget _passwordField(
    TextEditingController c,
    String label, {
    String? Function(String?)? validator,
    String? helper,
  }) => Padding(
    padding: const EdgeInsets.only(bottom: 14),
    child: TextFormField(
      controller: c,
      enabled: !busy,
      obscureText: hidden,
      autocorrect: false,
      enableSuggestions: false,
      autofillHints: const [AutofillHints.password],
      decoration: InputDecoration(
        labelText: label,
        helperText: helper,
        helperMaxLines: 2,
        suffixIcon: IconButton(
          tooltip: hidden ? 'Show passphrase' : 'Hide passphrase',
          icon: Icon(
            hidden ? Icons.visibility_outlined : Icons.visibility_off_outlined,
          ),
          onPressed: () => setState(() => hidden = !hidden),
        ),
      ),
      validator:
          validator ??
          (v) => (v ?? '').isEmpty ? 'Enter your passphrase' : null,
    ),
  );

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: const Color(0xFFFBF3E8),
    appBar: AppBar(
      backgroundColor: const Color(0xFFFBF3E8),
      title: Text(signUp ? 'Create your account' : 'Welcome back'),
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
          const PistaLogo(),
          const SizedBox(height: 18),
          SegmentedButton<bool>(
            segments: const [
              ButtonSegment(value: false, label: Text('Sign in')),
              ButtonSegment(value: true, label: Text('Create account')),
            ],
            selected: {signUp},
            onSelectionChanged: busy
                ? null
                : (v) => setState(() {
                    signUp = v.first;
                    error = null;
                  }),
          ),
          const SizedBox(height: 22),
          if (!signUp)
            Form(
              key: signInForm,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  TextFormField(
                    controller: handle,
                    enabled: !busy,
                    autocorrect: false,
                    autofillHints: const [AutofillHints.username],
                    decoration: const InputDecoration(
                      labelText: 'Mobile number or username',
                    ),
                    validator: (v) => (v ?? '').trim().isEmpty
                        ? 'Enter your mobile number or username'
                        : null,
                  ),
                  const SizedBox(height: 14),
                  _passwordField(password, 'Passphrase'),
                  Align(
                    alignment: Alignment.centerRight,
                    child: TextButton(
                      onPressed: busy ? null : _forgot,
                      child: const Text('Forgot your passphrase?'),
                    ),
                  ),
                ],
              ),
            )
          else
            Form(
              key: signUpForm,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  TextFormField(
                    controller: name,
                    enabled: !busy,
                    textCapitalization: TextCapitalization.words,
                    autofillHints: const [AutofillHints.name],
                    decoration: const InputDecoration(labelText: 'Your name'),
                    validator: (v) =>
                        (v?.trim().length ?? 0) < 2 ? 'Enter your name' : null,
                  ),
                  const SizedBox(height: 14),
                  TextFormField(
                    controller: phone,
                    enabled: !busy,
                    keyboardType: TextInputType.phone,
                    autofillHints: const [
                      AutofillHints.telephoneNumberNational,
                    ],
                    decoration: const InputDecoration(
                      labelText: 'Mobile number',
                      prefixText: '+91  ',
                    ),
                    validator: (v) =>
                        RegExp(
                          r'^[6-9]\d{9}$',
                        ).hasMatch((v ?? '').replaceAll(RegExp(r'[\s-]'), ''))
                        ? null
                        : 'Enter a valid 10-digit mobile number',
                  ),
                  const SizedBox(height: 14),
                  TextFormField(
                    controller: email,
                    enabled: !busy,
                    keyboardType: TextInputType.emailAddress,
                    autocorrect: false,
                    autofillHints: const [AutofillHints.email],
                    decoration: const InputDecoration(
                      labelText: 'Email address',
                      helperText:
                          'Used to reset your passphrase. We never send marketing email.',
                      helperMaxLines: 2,
                    ),
                    validator: (v) =>
                        RegExp(
                          r'^[^@\s]+@[^@\s]+\.[^@\s]+$',
                        ).hasMatch((v ?? '').trim())
                        ? null
                        : 'Enter a valid email address',
                  ),
                  const SizedBox(height: 14),
                  _passwordField(
                    newPassword,
                    'Choose a passphrase',
                    helper: 'At least 12 characters. A few words work well.',
                    validator: (v) => (v ?? '').length < 12
                        ? 'Use at least 12 characters'
                        : null,
                  ),
                  _passwordField(
                    confirm,
                    'Repeat your passphrase',
                    validator: (v) => v != newPassword.text
                        ? 'Passphrases do not match'
                        : null,
                  ),
                  const Text(
                    'Your mobile number is not verified in this private beta. We email you a code to verify your email address, which is also how you reset a forgotten passphrase. Orders use sample menu data and simulated payments.',
                    style: TextStyle(
                      fontSize: 12,
                      height: 1.5,
                      color: Colors.black54,
                    ),
                  ),
                ],
              ),
            ),
          if (error != null)
            Padding(
              padding: const EdgeInsets.only(top: 14),
              child: Text(
                error!,
                style: const TextStyle(color: Color(0xFF9B2C1F)),
              ),
            ),
          const SizedBox(height: 22),
          FilledButton(
            style: FilledButton.styleFrom(
              minimumSize: const Size.fromHeight(52),
            ),
            onPressed: busy ? null : submit,
            child: Text(
              busy
                  ? 'Please wait…'
                  : signUp
                  ? 'Create account'
                  : 'Sign in',
            ),
          ),
          const SizedBox(height: 10),
          TextButton(
            onPressed: busy
                ? null
                : () => setState(() {
                    signUp = !signUp;
                    error = null;
                  }),
            child: Text(
              signUp
                  ? 'Already have an account? Sign in'
                  : 'New here? Create an account',
            ),
          ),
        ],
      ),
    ),
  );
}
