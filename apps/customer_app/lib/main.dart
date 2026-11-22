import 'dart:async';
import 'features/checkout/screens/checkout_sheet.dart';
import 'features/checkout/screens/beta_access_sheet.dart';
import 'package:pista_ui/pista_ui.dart';
import 'package:pista_core/pista_core.dart';
import 'package:pista_tracking/pista_tracking.dart';
import 'features/menu/heritage_menu.dart';
import 'features/menu/reference_home.dart';
import 'features/menu/glass_navigation.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await BetaEndpoint.restore();
  runApp(const CustomerApp());
}

class CustomerApp extends StatelessWidget {
  const CustomerApp({super.key});
  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'Pista House Shankarpally',
    theme: pistaTheme(),
    home: const CustomerHome(),
    debugShowCheckedModeBanner: false,
  );
}

class CustomerHome extends StatefulWidget {
  final CustomerModel? model;
  const CustomerHome({super.key, this.model});
  @override
  State<CustomerHome> createState() => _CustomerHomeState();
}

class _CustomerHomeState extends State<CustomerHome> {
  late final model = widget.model ?? CustomerModel(PistaApi());
  late final Timer poll;
  int tab = 0;
  String menuCategory = 'All';

  final Map<String, Map<String, dynamic>> deliveryCodes = {};
  @override
  void initState() {
    super.initState();
    model.refresh();
    poll = Timer.periodic(const Duration(seconds: 5), (_) => model.refresh());
  }

  @override
  void dispose() {
    poll.cancel();
    model.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: model,
    builder: (context, _) => Scaffold(
      extendBody: true,
      drawer: Drawer(
        backgroundColor: heritageCream,
        child: SafeArea(
          child: ListView(
            padding: const EdgeInsets.all(24),
            children: [
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 24),
                child: Text(
                  'Pista House\nShankarpally',
                  style: TextStyle(
                    fontFamily: 'packages/pista_ui/HouseSerif',
                    fontSize: 32,
                    color: heritageGreen,
                  ),
                ),
              ),
              const DevelopmentBanner(),
              for (final entry in [
                (0, 'Home', Icons.home_outlined),
                (1, 'Menu', Icons.restaurant_menu),
                (2, 'Orders', Icons.receipt_long_outlined),
                (3, 'Profile', Icons.person_outline),
              ])
                ListTile(
                  leading: Icon(entry.$3, color: heritageGreen),
                  title: Text(entry.$2),
                  onTap: () {
                    Navigator.pop(context);
                    setState(() => tab = entry.$1);
                  },
                ),
              const Divider(),
              ListTile(
                leading: const Icon(Icons.refresh),
                title: const Text('Refresh menu and orders'),
                onTap: () {
                  Navigator.pop(context);
                  model.refresh();
                },
              ),
              if (const bool.fromEnvironment('BETA_TESTING'))
                ListTile(
                  leading: const Icon(Icons.dns_outlined),
                  title: const Text('Beta server settings'),
                  onTap: () {
                    Navigator.pop(context);
                    _serverSettings();
                  },
                ),
            ],
          ),
        ),
      ),
      appBar: tab == 0
          ? null
          : AppBar(
              centerTitle: true,
              title: const Text(
                'Pista House',
                style: TextStyle(
                  fontFamily: 'packages/pista_ui/HouseSerif',
                  fontSize: 29,
                  fontWeight: FontWeight.w600,
                  color: heritageGreen,
                ),
              ),
              leading: Builder(
                builder: (context) => IconButton(
                  tooltip: 'Open menu',
                  onPressed: () => Scaffold.of(context).openDrawer(),
                  icon: const Icon(Icons.menu_rounded, color: heritageGreen),
                ),
              ),
              actions: [
                IconButton(
                  tooltip: 'View cart',
                  onPressed: model.quantity == 0 ? null : _checkout,
                  icon: Badge(
                    isLabelVisible: model.quantity > 0,
                    label: Text('${model.quantity}'),
                    child: const Icon(
                      Icons.shopping_cart_outlined,
                      color: heritageGreen,
                    ),
                  ),
                ),
              ],
            ),
      body: Column(
        children: [
          if (tab != 0) const DevelopmentBanner(),
          if (model.error != null)
            MaterialBanner(
              content: Text(model.error!),
              actions: [
                TextButton(
                  onPressed: model.refresh,
                  child: const Text('Retry'),
                ),
              ],
            ),
          if (model.paused)
            const Padding(
              padding: EdgeInsets.all(14),
              child: Text(
                'The outlet has paused new orders. Existing orders are still available.',
              ),
            ),
          Expanded(
            child: tab == 2
                ? _orders()
                : tab == 3
                ? _profile()
                : tab == 4
                ? _offers()
                : tab == 0
                ? Builder(
                    builder: (context) => RefreshIndicator(
                      onRefresh: model.refresh,
                      child: ReferenceHome(
                        model: model,
                        openMenu: () => Scaffold.of(context).openDrawer(),
                        checkout: _checkout,
                        seeAll: () => setState(() {
                          menuCategory = 'All';
                          tab = 1;
                        }),
                        category: (value) => setState(() {
                          menuCategory = value == 'Sweets' ? 'Desserts' : value;
                          tab = 1;
                        }),
                      ),
                    ),
                  )
                : RefreshIndicator(
                    onRefresh: model.refresh,
                    child: HeritageMenu(
                      model: model,
                      home: tab == 0,
                      checkout: _checkout,
                      initialCategory: menuCategory,
                    ),
                  ),
          ),
        ],
      ),
      bottomNavigationBar: GlassNavigation(
        selectedIndex: switch (tab) {
          2 => 1,
          4 => 2,
          3 => 3,
          _ => 0,
        },
        onSelected: (index) => setState(() => tab = const [0, 2, 4, 3][index]),
      ),
      bottomSheet: model.quantity > 0 && tab == 1
          ? SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: FilledButton(
                  onPressed: model.busy ? null : _checkout,
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        '${model.quantity} ${model.quantity == 1 ? 'item' : 'items'} · ${rupees(model.estimate)}',
                      ),
                      const Text('View order →'),
                    ],
                  ),
                ),
              ),
            )
          : null,
    ),
  );
  Future<void> _serverSettings() => showDialog<void>(
    context: context,
    builder: (context) => BetaServerDialog(
      initialUrl: model.api.baseUrl,
      onConnect: (url) async {
        await model.api.configureBetaServer(url);
        await BetaEndpoint.save(model.api.baseUrl);
        model.resetForServer();
        deliveryCodes.clear();
        await model.refresh();
      },
    ),
  );
  Widget _orders() => RefreshIndicator(
    onRefresh: model.refresh,
    child: ListView(
      padding: const EdgeInsets.all(20),
      children: [
        const Text(
          'Your orders',
          style: TextStyle(fontSize: 26, fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 20),
        if (model.orders.isEmpty)
          const Text(
            'Your orders will appear after checkout. Only your own orders are shown.',
          ),
        for (final order in model.orders)
          OrderTile(
            order,
            action: _withOrderAgain(
              order,
              order['fulfilment'] == 'delivery' &&
                      order['paymentStatus'] == 'paid'
                  ? Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        FilledButton.icon(
                          onPressed: () => Navigator.push<void>(
                            context,
                            MaterialPageRoute(
                              builder: (_) => LiveTrackingPage(
                                api: model.api,
                                orderId: order['id'],
                              ),
                            ),
                          ),
                          icon: const Icon(Icons.map_outlined),
                          label: const Text('Track your order'),
                        ),
                        if (order['status'] == 'out_for_delivery')
                          TextButton(
                            onPressed: () => _deliveryCode(order),
                            child: const Text('Get delivery code'),
                          ),
                      ],
                    )
                  : order['paymentStatus'] == 'pending'
                  ? TextButton(
                      onPressed: () {
                        model.pendingOrder = order;
                        _checkout();
                      },
                      child: const Text('Resume test payment'),
                    )
                  : order['status'] == 'out_for_delivery'
                  ? TextButton(
                      onPressed: () => _deliveryCode(order),
                      child: const Text('Get delivery code'),
                    )
                  : null,
            ),
          ),
      ],
    ),
  );
  Widget? _withOrderAgain(Map<String, dynamic> order, Widget? existing) {
    if (order['paymentStatus'] != 'paid' || order['items'] is! List) {
      return existing;
    }
    final again = OutlinedButton.icon(
      onPressed: model.busy || model.checkoutLocked
          ? null
          : () => _orderAgain(order),
      icon: const Icon(Icons.replay_rounded),
      label: const Text('Order again'),
    );
    if (existing == null) return again;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [existing, again],
    );
  }

  Future<void> _orderAgain(Map<String, dynamic> order) async {
    if (model.cart.isNotEmpty) {
      final replace = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Replace your current cart?'),
          content: const Text(
            'Ordering again will replace the items already in your cart.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Keep cart'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Replace'),
            ),
          ],
        ),
      );
      if (replace != true || !mounted) return;
    }
    await model.refresh();
    if (!mounted) return;
    final message = model.reorder(order);
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
    if (model.cart.isNotEmpty) setState(() => tab = 1);
  }

  Widget _offers() => ListView(
    padding: const EdgeInsets.all(24),
    children: [
      const Text(
        'Offers',
        style: TextStyle(fontSize: 26, fontWeight: FontWeight.w600),
      ),
      const SizedBox(height: 16),
      const Text(
        'There are no offers or coupons available right now. Prices you see on the menu are the prices you pay.',
        style: TextStyle(height: 1.7),
      ),
      const SizedBox(height: 20),
      FilledButton(
        onPressed: () => setState(() {
          menuCategory = 'All';
          tab = 1;
        }),
        child: const Text('Browse the menu'),
      ),
    ],
  );
  Widget _profile() => ListView(
    padding: const EdgeInsets.all(24),
    children: [
      const PistaLogo(),
      const SizedBox(height: 24),
      const Text(
        'Your account',
        style: TextStyle(fontSize: 26, fontWeight: FontWeight.w600),
      ),
      const SizedBox(height: 16),
      const Text(
        bool.fromEnvironment('BETA_TESTING')
            ? 'This private beta uses an administrator-provided customer test account. Phone verification, saved addresses and live payments are not configured.'
            : 'Browse without signing in. This development build signs in with a test customer at checkout. Phone verification, saved addresses and notification preferences are not configured yet.',
        style: TextStyle(height: 1.7),
      ),
      if (const bool.fromEnvironment('BETA_TESTING')) ...[
        const SizedBox(height: 20),
        if (model.api.token == null)
          FilledButton(
            onPressed: () => _betaSignIn(),
            child: const Text('Sign in to beta account'),
          )
        else
          OutlinedButton(
            onPressed: model.busy
                ? null
                : () async {
                    try {
                      await model.signOut();
                    } catch (_) {}
                    if (mounted) setState(() => deliveryCodes.clear());
                  },
            child: const Text('Sign out'),
          ),
      ],
    ],
  );
  Future<bool> _betaSignIn() async {
    final accepted = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (context) => BetaAccessSheet(api: model.api),
    );
    if (accepted == true) {
      await model.refresh();
      return true;
    }
    return false;
  }

  Future<void> _checkout() async {
    if (const bool.fromEnvironment('BETA_TESTING') && model.api.token == null) {
      if (!await _betaSignIn() || !mounted) return;
    }

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (context) => CheckoutSheet(model: model),
    );
    if (mounted && model.cart.isEmpty && model.orders.isNotEmpty) {
      setState(() => tab = 2);
    }
  }

  Future<void> _deliveryCode(Map<String, dynamic> order) async {
    try {
      final id = order['id'] as String;
      var result = deliveryCodes[id];
      if (result == null ||
          DateTime.parse(result['expiresAt']).isBefore(DateTime.now())) {
        result = Map<String, dynamic>.from(
          await model.api.request('/orders/$id/delivery-code', method: 'POST'),
        );
        deliveryCodes[id] = result;
      }
      final currentCode = result;
      if (!mounted) return;
      await showDialog<void>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Your delivery code'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                '${currentCode['code']}',
                style: const TextStyle(
                  fontSize: 36,
                  letterSpacing: 5,
                  fontWeight: FontWeight.w700,
                  color: pistaGreen,
                ),
              ),
              const SizedBox(height: 18),
              const Text(
                'Share this code only when your rider hands over the order. It expires after 10 minutes. Do not share it before receiving your food.',
                style: TextStyle(height: 1.7),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Close'),
            ),
          ],
        ),
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('$e')));
      }
    }
  }
}
