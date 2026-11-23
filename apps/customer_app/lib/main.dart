import 'dart:async';
import 'features/checkout/screens/checkout_sheet.dart';
import 'features/auth/auth_page.dart';
import 'features/auth/email_pages.dart';
import 'features/support/support_pages.dart';
import 'features/engagement/engagement_pages.dart';
import 'features/account/saved_addresses_page.dart';
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
    model.addListener(_cartChanged);
  }

  Timer? _cartTimer;
  String _cartSent = '0:0';

  /// Tells the server what is in the cart a little after it stops changing, so
  /// a forgotten cart can be reminded about (only if the customer opted in).
  void _cartChanged() {
    final key = '${model.quantity}:${model.estimate}';
    if (key == _cartSent || model.api.token == null) return;
    _cartTimer?.cancel();
    _cartTimer = Timer(const Duration(seconds: 20), () async {
      final now = '${model.quantity}:${model.estimate}';
      if (now == _cartSent || model.api.token == null) return;
      try {
        await model.api.request(
          '/me/cart',
          method: 'PUT',
          body: {'itemCount': model.quantity, 'totalPaise': model.estimate},
        );
        _cartSent = now;
      } catch (_) {
        // Reminders are optional; try again on the next change.
      }
    });
  }

  /// Where a tapped notification should lead.
  void _openNotification(Map<String, dynamic> n) {
    final kind = '${n['kind']}';
    if (kind.startsWith('support')) {
      Navigator.push<void>(
        context,
        MaterialPageRoute(
          builder: (_) => SupportPage(api: model.api, orders: model.orders),
        ),
      );
    } else if (kind == 'order.rate') {
      final id = (n['data'] as Map?)?['orderId'];
      final match = model.orders.where((o) => o['id'] == id);
      if (match.isNotEmpty) {
        Navigator.push<void>(
          context,
          MaterialPageRoute(
            builder: (_) => RatePage(api: model.api, order: match.first),
          ),
        );
      }
    } else if (kind == 'offer') {
      Navigator.maybePop(context);
      setState(() => tab = 4);
    } else if (kind.startsWith('order') || kind.startsWith('refund')) {
      Navigator.maybePop(context);
      setState(() => tab = 2);
    }
  }

  @override
  void dispose() {
    poll.cancel();
    _cartTimer?.cancel();
    model.removeListener(_cartChanged);
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
                leading: const Icon(Icons.notifications_none),
                title: const Text('Notifications'),
                onTap: () {
                  Navigator.pop(context);
                  Navigator.push<void>(
                    context,
                    MaterialPageRoute(
                      builder: (_) => NotificationsPage(
                        api: model.api,
                        showSettings: true,
                        onOpenItem: _openNotification,
                      ),
                    ),
                  );
                },
              ),
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
                NotificationBell(
                  api: model.api,
                  showSettings: true,
                  color: heritageGreen,
                  onOpenItem: _openNotification,
                ),
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
        onSelected: (index) {
          setState(() => tab = const [0, 2, 4, 3][index]);
          if (index == 3) _loadSupportUnread();
        },
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
    final canAgain = order['paymentStatus'] == 'paid' && order['items'] is List;
    final help = TextButton.icon(
      onPressed: model.api.token == null ? null : () => _askForHelp(order),
      icon: const Icon(Icons.support_agent_outlined, size: 18),
      label: const Text('Get help with this order'),
    );
    final done =
        order['status'] == 'delivered' || order['status'] == 'collected';
    final rate = TextButton.icon(
      onPressed: model.api.token == null
          ? null
          : () => Navigator.push<void>(
              context,
              MaterialPageRoute(
                builder: (_) => RatePage(api: model.api, order: order),
              ),
            ),
      icon: const Icon(Icons.star_outline_rounded, size: 18),
      label: const Text('Rate this order'),
    );
    final again = OutlinedButton.icon(
      onPressed: model.busy || model.checkoutLocked
          ? null
          : () => _orderAgain(order),
      icon: const Icon(Icons.replay_rounded),
      label: const Text('Order again'),
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [?existing, if (canAgain) again, if (done) rate, help],
    );
  }

  Future<void> _askForHelp(Map<String, dynamic> order) async {
    final id = await Navigator.push<String>(
      context,
      MaterialPageRoute(
        builder: (_) =>
            NewRequestPage(api: model.api, orders: model.orders, order: order),
      ),
    );
    if (id != null && mounted) {
      await Navigator.push<void>(
        context,
        MaterialPageRoute(
          builder: (_) => TicketPage(api: model.api, ticketId: id),
        ),
      );
      _loadSupportUnread();
    }
  }

  int supportUnread = 0;
  Future<void> _loadSupportUnread() async {
    if (model.api.token == null) return;
    try {
      final tickets = await model.api.request('/support/tickets') as List;
      if (mounted) {
        setState(
          () =>
              supportUnread = tickets.where((t) => t['unread'] == true).length,
        );
      }
    } catch (_) {
      // Support is optional; a failure here must not disturb the account tab.
    }
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

  Widget _offers() => ForYouTab(
    model: model,
    onBrowse: () => setState(() {
      menuCategory = 'All';
      tab = 1;
    }),
  );
  Widget _profile() {
    const beta = bool.fromEnvironment('BETA_TESTING');
    final signedIn = model.api.token != null;
    final name = model.api.userName;
    final handle = model.api.userHandle;
    return ListView(
      padding: const EdgeInsets.all(24),
      children: [
        const PistaLogo(),
        const SizedBox(height: 24),
        const Text(
          'Your account',
          style: TextStyle(fontSize: 26, fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 16),
        if (!beta)
          const Text(
            'Browse without signing in. This development build signs in with a test customer at checkout. Phone verification, saved addresses and notification preferences are not configured yet.',
            style: TextStyle(height: 1.7),
          )
        else if (!signedIn) ...[
          const Text(
            'Create an account or sign in to order, track your delivery and save your addresses.',
            style: TextStyle(height: 1.7),
          ),
          const SizedBox(height: 20),
          FilledButton(
            onPressed: () => _betaSignIn(),
            child: const Text('Sign in'),
          ),
          const SizedBox(height: 10),
          OutlinedButton(
            onPressed: () => _betaSignIn(signUp: true),
            child: const Text('Create account'),
          ),
        ] else ...[
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFFFFFAF3),
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: const Color(0xFFE1D4BC)),
            ),
            child: Row(
              children: [
                CircleAvatar(
                  backgroundColor: heritageGreen,
                  foregroundColor: const Color(0xFFFFF1CF),
                  child: Text(
                    (name ?? '?').trim().isEmpty
                        ? '?'
                        : (name ?? '?').trim()[0].toUpperCase(),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        name ?? 'Signed in',
                        style: const TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 17,
                        ),
                      ),
                      if (handle != null)
                        Text(
                          RegExp(r'^\d{10}$').hasMatch(handle)
                              ? '+91 $handle'
                              : handle,
                          style: const TextStyle(color: Colors.black54),
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: const Icon(Icons.mail_outline, color: heritageGreen),
            title: Text(model.api.userEmail ?? 'Add your email'),
            subtitle: Text(
              model.api.userEmail == null
                  ? 'Needed to reset a forgotten passphrase'
                  : model.api.emailVerified
                  ? 'Verified'
                  : 'Not verified. Tap to verify.',
              style: TextStyle(
                color: model.api.userEmail != null && !model.api.emailVerified
                    ? const Color(0xFF956233)
                    : null,
              ),
            ),
            trailing: model.api.emailVerified
                ? const Icon(Icons.verified_outlined, color: heritageGreen)
                : const Icon(Icons.chevron_right),
            onTap: model.api.emailVerified
                ? null
                : () async {
                    await Navigator.push<bool>(
                      context,
                      MaterialPageRoute(
                        builder: (_) => VerifyEmailPage(api: model.api),
                      ),
                    );
                    if (mounted) setState(() {});
                  },
          ),
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: const Icon(Icons.place_outlined, color: heritageGreen),
            title: const Text('Saved addresses'),
            subtitle: const Text('Add, edit or choose a default'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => Navigator.push<void>(
              context,
              MaterialPageRoute(
                builder: (_) => SavedAddressesPage(model: model),
              ),
            ),
          ),
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: Badge(
              isLabelVisible: supportUnread > 0,
              label: Text('$supportUnread'),
              child: const Icon(
                Icons.support_agent_outlined,
                color: heritageGreen,
              ),
            ),
            title: const Text('Help & support'),
            subtitle: Text(
              supportUnread > 0
                  ? '$supportUnread new ${supportUnread == 1 ? 'reply' : 'replies'}'
                  : 'Ask about an order or get answers',
            ),
            trailing: const Icon(Icons.chevron_right),
            onTap: () async {
              await Navigator.push<void>(
                context,
                MaterialPageRoute(
                  builder: (_) =>
                      SupportPage(api: model.api, orders: model.orders),
                ),
              );
              _loadSupportUnread();
            },
          ),
          const Divider(),
          const SizedBox(height: 8),
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
        if (beta) ...[
          const SizedBox(height: 20),
          const Text(
            'Private beta: your mobile number is not verified yet, orders use sample menu data and payments are simulated.',
            style: TextStyle(fontSize: 12, height: 1.6, color: Colors.black54),
          ),
        ],
      ],
    );
  }

  Future<bool> _betaSignIn({bool signUp = false}) async {
    final accepted = await Navigator.push<bool>(
      context,
      MaterialPageRoute(
        builder: (_) => CustomerAuthPage(api: model.api, startOnSignUp: signUp),
      ),
    );
    if (accepted == true) {
      await model.refresh();
      model.addresses.load(force: true);
      model.api
          .loadAccount()
          .then((_) {
            if (mounted) setState(() {});
          })
          .catchError((_) {});
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
