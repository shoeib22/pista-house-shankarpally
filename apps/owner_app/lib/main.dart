import 'package:pista_ui/pista_ui.dart';
import 'package:pista_core/pista_core.dart';
import 'features/orders/widgets/order_actions.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await BetaEndpoint.restore();
  runApp(
    MaterialApp(
      title: 'Pista House Owner',
      theme: pistaTheme(),
      home: const OwnerHome(),
      debugShowCheckedModeBanner: false,
    ),
  );
}

class OwnerHome extends StatefulWidget {
  final PistaApi? api;
  const OwnerHome({super.key, this.api});
  @override
  State<OwnerHome> createState() => _OwnerHomeState();
}

class _OwnerHomeState extends State<OwnerHome> {
  late final api = widget.api ?? PistaApi();
  List<Map<String, dynamic>> orders = [];
  List<Map<String, dynamic>> riders = [];
  bool busy = false, paused = false, signedIn = false;
  String? error;
  Future<void> run(Future<void> Function() action) async {
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await action();
    } catch (e) {
      error = '$e';
      if (e is ApiException && e.status == 401) {
        api.token = null;
        signedIn = false;
        orders = [];
        riders = [];
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> refresh() async {
    orders = (await api.request('/orders') as List)
        .map((o) => Map<String, dynamic>.from(o))
        .toList();
    paused = (await api.request('/outlet'))['paused'];
    riders = (await api.request('/riders') as List)
        .map((r) => Map<String, dynamic>.from(r))
        .toList();
  }

  @override
  void dispose() {
    api.close();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('Outlet overview'),
      actions: [
        if (const bool.fromEnvironment('BETA_TESTING'))
          IconButton(
            tooltip: 'Beta server',
            icon: const Icon(Icons.dns_outlined),
            onPressed: () => showDialog<void>(
              context: context,
              builder: (context) => BetaServerDialog(
                initialUrl: api.baseUrl,
                onConnect: (url) async {
                  await api.configureBetaServer(url);
                  await BetaEndpoint.save(api.baseUrl);
                  if (mounted) {
                    setState(() {
                      signedIn = false;
                      orders = [];
                      riders = [];
                      error = null;
                    });
                  }
                },
              ),
            ),
          ),
        if (signedIn)
          IconButton(
            tooltip: 'Your account',
            icon: const Icon(Icons.manage_accounts_outlined),
            onPressed: () => showModalBottomSheet<void>(
              context: context,
              isScrollControlled: true,
              useSafeArea: true,
              builder: (sheetContext) => SizedBox(
                height: MediaQuery.sizeOf(sheetContext).height * .9,
                child: StaffAccount(
                  request: (path, method, body) =>
                      api.request(path, method: method, body: body),
                  onToken: (token) => api.token = token,
                  onSignedOut: () {
                    Navigator.pop(sheetContext);
                    api.token = null;
                    setState(() {
                      signedIn = false;
                      orders = [];
                      riders = [];
                    });
                  },
                ),
              ),
            ),
          ),
        if (signedIn)
          IconButton(
            tooltip: 'Sign out',
            icon: const Icon(Icons.logout),
            onPressed: busy
                ? null
                : () async {
                    try {
                      await api.signOut();
                    } catch (_) {}
                    if (mounted) {
                      setState(() {
                        signedIn = false;
                        orders = [];
                        riders = [];
                      });
                    }
                  },
          ),
        IconButton(
          tooltip: 'Refresh',
          onPressed: !signedIn || busy ? null : () => run(refresh),
          icon: const Icon(Icons.refresh),
        ),
      ],
    ),
    body: ListView(
      padding: const EdgeInsets.all(22),
      children: [
        const PistaLogo(),
        const SizedBox(height: 18),
        const DevelopmentBanner(),
        const SizedBox(height: 20),
        if (error != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 20),
            child: Text(error!, style: const TextStyle(color: Colors.red)),
          ),
        if (!signedIn) ...[
          StaffAccess(
            title: 'Your owner account',
            busy: busy,
            developmentLabel: 'Open test owner account',
            onDevelopment: const bool.fromEnvironment('ALLOW_DEVELOPMENT_LOGIN')
                ? () => run(() async {
                    await api.developmentLogin('owner');
                    signedIn = true;
                    await refresh();
                  })
                : null,
            onSignIn: (handle, password) => run(() async {
              await api.passwordLogin(handle, password, 'owner');
              signedIn = true;
              await refresh();
            }),
          ),
        ] else ...[
          OutlinedButton.icon(
            onPressed: () => showModalBottomSheet<void>(
              context: context,
              isScrollControlled: true,
              useSafeArea: true,
              builder: (sheetContext) => SizedBox(
                height: MediaQuery.sizeOf(sheetContext).height * .9,
                child: StaffTeam(
                  request: (path, method, body) =>
                      api.request(path, method: method, body: body),
                ),
              ),
            ),
            icon: const Icon(Icons.group_outlined),
            label: const Text('Manage team access'),
          ),
          const SizedBox(height: 18),
          const Text(
            'App orders only',
            style: TextStyle(color: pistaGreen, fontSize: 12),
          ),
          const SizedBox(height: 10),
          const Text(
            'A clear view of the counter.',
            style: TextStyle(fontSize: 26, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 22),
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Completed app sales · all time'),
            subtitle: const Text(
              'Test orders only. Excludes Petpooja and counter sales.',
            ),
            trailing: Text(
              rupees(
                orders
                    .where(
                      (o) =>
                          ['collected', 'delivered'].contains(o['status']) &&
                          o['paymentStatus'] == 'paid',
                    )
                    .fold<int>(0, (sum, o) => sum + (o['totalPaise'] as int)),
              ),
              style: const TextStyle(fontSize: 23, fontWeight: FontWeight.w600),
            ),
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Accept new orders'),
            subtitle: Text(paused ? 'Store paused' : 'Store open'),
            value: !paused,
            onChanged: busy
                ? null
                : (value) => run(() async {
                    await api.request(
                      '/outlet',
                      method: 'PATCH',
                      body: {'paused': !value},
                    );
                    await refresh();
                  }),
          ),
          const Divider(height: 34),
          const Text(
            'Recent orders',
            style: TextStyle(fontSize: 22, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 16),
          if (orders.isEmpty)
            const Text(
              'No app orders yet. Orders placed in the customer app appear here.',
            ),
          for (final o in orders)
            OrderTile(
              o,
              action: OwnerOrderActions(
                api: api,
                order: o,
                riders: riders,
                busy: busy,
                send: (path, body) => run(() async {
                  await api.request(path, method: 'POST', body: body);
                  await refresh();
                }),
              ),
            ),
          const SizedBox(height: 20),
          const Text(
            'Orders, kitchen handoff, rider assignment and store pause are connected. Refund approval, reports and coupons are not enabled yet.',
            style: TextStyle(color: Colors.black54, fontSize: 12, height: 1.7),
          ),
        ],
      ],
    ),
  );
}
