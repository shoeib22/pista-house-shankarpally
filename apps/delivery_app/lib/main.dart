import 'dart:async';
import 'features/tasks/widgets/offer_card.dart';
import 'features/tasks/widgets/verification_dialog.dart';
import 'package:pista_ui/pista_ui.dart';
import 'package:pista_core/pista_core.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:pista_tracking/pista_tracking.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await BetaEndpoint.restore();
  runApp(
    MaterialApp(
      title: 'Pista House Delivery',
      theme: pistaTheme(),
      home: const DeliveryHome(),
      debugShowCheckedModeBanner: false,
    ),
  );
}

class DeliveryHome extends StatefulWidget {
  final DeliveryModel? model;
  const DeliveryHome({super.key, this.model});
  @override
  State<DeliveryHome> createState() => _DeliveryHomeState();
}

class _DeliveryHomeState extends State<DeliveryHome> {
  late final model = widget.model ?? DeliveryModel(PistaApi());
  late final Timer poll;
  bool history = false;
  @override
  void initState() {
    super.initState();
    poll = Timer.periodic(const Duration(seconds: 4), (_) => model.refresh());
  }

  @override
  void dispose() {
    poll.cancel();
    model.dispose();
    super.dispose();
  }

  Future<void> prompt(Map<String, dynamic> task, bool failure) async {
    final value = await showDialog<String>(
      context: context,
      builder: (context) => VerificationDialog(failure: failure),
    );
    if (value == null || value.isEmpty) return;
    if (failure) {
      await model.fail(task, value);
    } else {
      await model.complete(task, value);
    }
  }

  Future<void> open(Uri uri) async {
    try {
      if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
        throw Exception('No app is available to open this action.');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('$e')));
      }
    }
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: model,
    builder: (context, _) => Scaffold(
      appBar: AppBar(
        title: const Text('Delivery partner'),
        actions: [
          if (const bool.fromEnvironment('BETA_TESTING'))
            IconButton(
              tooltip: 'Beta server',
              icon: const Icon(Icons.dns_outlined),
              onPressed: () => showDialog<void>(
                context: context,
                builder: (context) => BetaServerDialog(
                  initialUrl: model.api.baseUrl,
                  onConnect: (url) async {
                    await model.api.configureBetaServer(url);
                    await BetaEndpoint.save(model.api.baseUrl);
                    model.clearSession();
                  },
                ),
              ),
            ),
          if (model.signedIn)
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
                        model.api.request(path, method: method, body: body),
                    onToken: (token) => model.api.token = token,
                    onSignedOut: () {
                      Navigator.pop(sheetContext);
                      model.clearSession();
                    },
                  ),
                ),
              ),
            ),
          if (model.signedIn)
            IconButton(
              tooltip: 'Sign out',
              icon: const Icon(Icons.logout),
              onPressed: model.busy ? null : model.signOut,
            ),
          if (model.signedIn)
            IconButton(
              tooltip: 'Refresh tasks',
              onPressed: model.busy ? null : model.refresh,
              icon: const Icon(Icons.refresh),
            ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: model.refresh,
        child: ListView(
          padding: const EdgeInsets.all(22),
          children: [
            const PistaLogo(),
            const SizedBox(height: 18),
            const DevelopmentBanner(),
            const SizedBox(height: 22),
            if (model.error != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: Text(
                  model.error!,
                  style: const TextStyle(color: Colors.red),
                ),
              ),
            if (model.pendingAction != null)
              Container(
                padding: const EdgeInsets.all(14),
                color: pistaIvory,
                child: Text(
                  '${model.pendingAction} is not confirmed. Reconnect and refresh before retrying.',
                ),
              ),
            if (!model.signedIn) ...[
              StaffAccess(
                title: 'Your delivery account',
                busy: model.busy,
                onSignIn: model.loginWithPassword,
                onAccept: model.acceptInvitation,
                onDevelopment:
                    const bool.fromEnvironment('ALLOW_DEVELOPMENT_LOGIN')
                    ? model.login
                    : null,
                developmentLabel: 'Open test rider account',
              ),
            ] else ...[
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(
                  model.available ? 'You are online' : 'You are offline',
                ),
                subtitle: const Text('Availability controls new assignments.'),
                value: model.available,
                onChanged: model.busy || !model.connected
                    ? null
                    : model.setAvailable,
              ),
              Row(
                children: [
                  Icon(
                    model.connected
                        ? Icons.cloud_done_outlined
                        : Icons.cloud_off,
                    size: 15,
                    color: model.connected ? pistaGreen : Colors.orange,
                  ),
                  const SizedBox(width: 7),
                  Text(
                    model.connected
                        ? 'Synced with outlet'
                        : 'Connection interrupted',
                    style: const TextStyle(fontSize: 11, color: Colors.black54),
                  ),
                ],
              ),
              const SizedBox(height: 22),
              if (model.offer != null && model.available)
                OfferCard(
                  key: ValueKey(model.offer!['id']),
                  offer: model.offer!,
                  clockSkew: model.clockSkew,
                  busy: model.busy,
                  onAccept: () => model.respondToOffer(true),
                  onDecline: () => model.respondToOffer(false),
                ),
              SegmentedButton<bool>(
                segments: const [
                  ButtonSegment(value: false, label: Text('Active tasks')),
                  ButtonSegment(value: true, label: Text('History')),
                ],
                selected: {history},
                onSelectionChanged: (value) =>
                    setState(() => history = value.first),
              ),
              const SizedBox(height: 22),
              if (!model.tasks.any((t) => (t['isActive'] as bool) != history))
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 28),
                  child: Column(
                    children: [
                      const Icon(
                        Icons.delivery_dining_outlined,
                        size: 40,
                        color: pistaGreen,
                      ),
                      const SizedBox(height: 12),
                      Text(
                        history
                            ? 'No completed tasks yet.'
                            : 'No assigned deliveries. Stay online for your next job.',
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ),
                ),
              for (final task in model.tasks.where(
                (t) => (t['isActive'] as bool) != history,
              ))
                _task(task),
            ],
          ],
        ),
      ),
    ),
  );
  Widget _task(Map<String, dynamic> task) {
    final order = Map<String, dynamic>.from(task['order']);
    final a = order['deliveryAddress'] as Map?;
    return OrderTile(
      {...order, 'status': task['status']},
      action: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (a != null) ...[
            Text(
              '${a['recipient']}',
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 7),
            Text(
              '${a['line1']}\n${a['city']} · ${a['postalCode']}',
              style: const TextStyle(height: 1.6),
            ),
            if ((a['landmark'] ?? '').toString().isNotEmpty)
              Text(
                'Landmark: ${a['landmark']}',
                style: const TextStyle(color: Colors.black54, fontSize: 12),
              ),
            Row(
              children: [
                TextButton.icon(
                  onPressed: () => open(
                    Uri(
                      scheme: 'https',
                      host: 'www.google.com',
                      path: '/maps/dir/',
                      queryParameters: {
                        'api': '1',
                        'destination':
                            a['latitude'] != null && a['longitude'] != null
                            ? '${a['latitude']},${a['longitude']}'
                            : '${a['line1']}, ${a['city']}, ${a['postalCode']}',
                      },
                    ),
                  ),
                  icon: const Icon(Icons.navigation_outlined, size: 17),
                  label: const Text('Navigate'),
                ),
                if (a['latitude'] != null &&
                    a['longitude'] != null &&
                    ['assigned', 'picked_up'].contains(task['status']))
                  TextButton.icon(
                    onPressed: () => Navigator.push<void>(
                      context,
                      MaterialPageRoute(
                        builder: (_) => RiderRoutePage(
                          api: model.api,
                          assignmentId: task['id'],
                          status: task['status'],
                          recipient: '${a['recipient']}',
                          destination: LatLng(
                            (a['latitude'] as num).toDouble(),
                            (a['longitude'] as num).toDouble(),
                          ),
                        ),
                      ),
                    ),
                    icon: const Icon(Icons.map_outlined, size: 17),
                    label: const Text('Map'),
                  ),
                TextButton.icon(
                  onPressed: () =>
                      open(Uri(scheme: 'tel', path: '${a['phone']}')),
                  icon: const Icon(Icons.call_outlined, size: 17),
                  label: const Text('Call'),
                ),
              ],
            ),
            const SizedBox(height: 8),
          ],
          if (task['status'] == 'assigned')
            FilledButton(
              onPressed: model.busy || !model.connected
                  ? null
                  : () => model.pickup(task),
              child: const Text('Confirm pickup'),
            ),
          if (task['status'] == 'picked_up') ...[
            RiderLocationSharing(
              key: ValueKey(task['id']),
              api: model.api,
              assignmentId: task['id'],
              orderId: order['id'],
            ),
            FilledButton(
              onPressed: model.busy || !model.connected
                  ? null
                  : () => prompt(task, false),
              child: const Text('Verify delivery code'),
            ),
            TextButton(
              onPressed: model.busy || !model.connected
                  ? null
                  : () => prompt(task, true),
              child: const Text('Report failed delivery'),
            ),
          ],
          if (task['status'] == 'failed')
            Text(
              'Reported to outlet: ${task['failureReason']}\nReturn the order to the outlet for staff confirmation.',
              style: const TextStyle(color: Color(0xFF956233), height: 1.6),
            ),
        ],
      ),
    );
  }
}
