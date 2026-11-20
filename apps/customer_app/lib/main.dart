import 'dart:async';
import 'features/checkout/screens/checkout_sheet.dart';
import 'features/checkout/screens/beta_access_sheet.dart';
import 'package:pista_ui/pista_ui.dart';
import 'package:pista_core/pista_core.dart';

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
  String search = '', category = 'All';
  bool vegOnly = false;
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
      appBar: AppBar(
        title: const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Shankarpally',
              style: TextStyle(fontSize: 19, fontWeight: FontWeight.w700),
            ),
            Text(
              'Pickup & delivery',
              style: TextStyle(fontSize: 12, color: Colors.black54),
            ),
          ],
        ),
        leading: const Icon(Icons.location_on_outlined, color: pistaGreen),
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
                    model.orders = [];
                    model.pendingOrder = null;
                    deliveryCodes.clear();
                    await model.refresh();
                  },
                ),
              ),
            ),
          IconButton(
            tooltip: 'Refresh',
            onPressed: model.busy ? null : model.refresh,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: Column(
        children: [
          const DevelopmentBanner(),
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
                : _menu(),
          ),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: tab,
        onDestinationSelected: (i) => setState(() => tab = i),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home),
            label: 'Home',
          ),
          NavigationDestination(
            icon: Icon(Icons.restaurant_menu),
            label: 'Menu',
          ),
          NavigationDestination(
            icon: Icon(Icons.receipt_long_outlined),
            label: 'Orders',
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline),
            label: 'Profile',
          ),
        ],
      ),
      bottomSheet: model.quantity > 0 && tab < 2
          ? SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: FilledButton(
                  onPressed: model.busy ? null : _checkout,
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        '${model.quantity} items · ${rupees(model.estimate)}',
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
  Widget _menu() {
    final products = model.products
        .where(
          (p) =>
              (category == 'All' || p.category == category) &&
              (!vegOnly || p.vegetarian) &&
              p.name.toLowerCase().contains(search.toLowerCase()),
        )
        .toList();
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 14, 20, 95),
      children: [
        const PistaLogo(),
        const SizedBox(height: 20),
        if (tab == 0)
          ClipRRect(
            borderRadius: BorderRadius.circular(16),
            child: Stack(
              children: [
                Image.asset(
                  'assets/biryani-cover.png',
                  package: 'pista_ui',
                  height: 185,
                  width: double.infinity,
                  fit: BoxFit.cover,
                ),
                Container(
                  height: 185,
                  width: double.infinity,
                  color: Colors.black.withValues(alpha: .3),
                ),
                const Positioned(
                  left: 20,
                  top: 27,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'THE HOUSE SIGNATURE',
                        style: TextStyle(
                          color: Color(0xFFECD8A0),
                          letterSpacing: 2,
                          fontSize: 10,
                        ),
                      ),
                      SizedBox(height: 12),
                      Text(
                        'Dum. Done\nroyally.',
                        style: TextStyle(
                          fontFamily: 'serif',
                          color: Colors.white,
                          fontSize: 33,
                          height: 1.08,
                        ),
                      ),
                      SizedBox(height: 10),
                      Text(
                        'Concept photography',
                        style: TextStyle(color: Colors.white70, fontSize: 9),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        const SizedBox(height: 20),
        Text(
          tab == 0 ? 'House favourites' : 'Find your favourite.',
          style: TextStyle(
            fontSize: tab == 0 ? 25 : 29,
            fontWeight: FontWeight.w600,
            fontFamily: tab == 1 ? 'serif' : null,
          ),
        ),
        const SizedBox(height: 17),
        TextField(
          decoration: const InputDecoration(
            hintText: 'Search biryani, starters & more',
            prefixIcon: Icon(Icons.search),
          ),
          onChanged: (v) => setState(() => search = v),
        ),
        const SizedBox(height: 12),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: ['All', 'Biryani', 'Starters', 'Desserts']
                .map(
                  (c) => Padding(
                    padding: const EdgeInsets.only(right: 7),
                    child: ChoiceChip(
                      label: Text(c),
                      selected: category == c,
                      onSelected: (_) => setState(() => category = c),
                    ),
                  ),
                )
                .toList(),
          ),
        ),
        Align(
          alignment: Alignment.centerLeft,
          child: FilterChip(
            label: const Text('Vegetarian'),
            selected: vegOnly,
            onSelected: (v) => setState(() => vegOnly = v),
          ),
        ),
        if (model.products.isEmpty)
          Padding(
            padding: const EdgeInsets.all(30),
            child: Text(
              model.busy
                  ? 'Loading menu…'
                  : 'No menu is available. Refresh to retry.',
            ),
          ),
        for (final p in products)
          Container(
            padding: const EdgeInsets.symmetric(vertical: 20),
            decoration: const BoxDecoration(
              border: Border(bottom: BorderSide(color: Color(0xFFE0E4D8))),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        p.vegetarian ? '● VEG' : '● NON-VEG',
                        style: TextStyle(
                          fontSize: 9,
                          color: p.vegetarian
                              ? pistaGreen
                              : const Color(0xFF9C543B),
                        ),
                      ),
                      const SizedBox(height: 7),
                      Text(
                        p.name,
                        style: const TextStyle(
                          fontWeight: FontWeight.w600,
                          fontSize: 17,
                        ),
                      ),
                      const SizedBox(height: 7),
                      Text(
                        rupees(p.pricePaise),
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      ),
                      const SizedBox(height: 7),
                      Text(
                        p.description,
                        style: const TextStyle(
                          fontSize: 12,
                          color: Colors.black54,
                          height: 1.5,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 14),
                SizedBox(
                  width: 110,
                  child: Column(
                    children: [
                      if (p.category == 'Biryani')
                        ClipRRect(
                          borderRadius: BorderRadius.circular(10),
                          child: Image.asset(
                            'assets/biryani-cover.png',
                            package: 'pista_ui',
                            width: 110,
                            height: 80,
                            fit: BoxFit.cover,
                          ),
                        ),
                      const SizedBox(height: 7),
                      if (!p.available)
                        const Text('Sold out')
                      else
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            if ((model.cart[p.id] ?? 0) > 0) ...[
                              IconButton(
                                tooltip: 'Remove ${p.name}',
                                visualDensity: VisualDensity.compact,
                                onPressed: () => model.change(p.id, -1),
                                icon: const Icon(Icons.remove, size: 17),
                              ),
                              Text('${model.cart[p.id]}'),
                            ],
                            IconButton(
                              tooltip: 'Add ${p.name}',
                              onPressed:
                                  model.busy || model.pendingOrder != null
                                  ? null
                                  : () => model.change(p.id, 1),
                              icon: const Icon(
                                Icons.add_circle_outline,
                                color: pistaGreen,
                              ),
                            ),
                          ],
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        const SizedBox(height: 12),
        const Text(
          'Illustrative menu and prices. Restaurant approval pending.',
          style: TextStyle(fontSize: 10, color: Colors.black54),
        ),
      ],
    );
  }

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
            action: order['paymentStatus'] == 'pending'
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
      ],
    ),
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
