import 'dart:math';
import 'package:flutter/foundation.dart';
import 'package:pista_api/pista_api.dart';
import 'saved_addresses.dart';
export 'package:pista_api/pista_api.dart';
export 'features/delivery/delivery_model.dart';
export 'beta_endpoint.dart';
export 'device_dish_saves.dart';
export 'saved_addresses.dart';

String requestKey() => List.generate(
  24,
  (_) => Random.secure().nextInt(256).toRadixString(16).padLeft(2, '0'),
).join();

class Product extends ProductDto {
  Product(Map<String, dynamic> data) : super.fromJson(data);
}

class CustomerModel extends ChangeNotifier {
  final PistaApi api;
  CustomerModel(this.api);

  /// The signed-in customer's saved addresses.
  late final AddressBook addresses = AddressBook(api);
  List<Product> products = [];
  List<Map<String, dynamic>> orders = [];
  final Map<String, int> cart = {};
  Map<String, dynamic>? pendingOrder;
  String? _checkoutKey, _paymentEvent;
  bool busy = false, paused = false;
  String? error;
  String fulfilment = 'pickup';
  Map<String, dynamic>? deliveryAddress;
  Map<String, dynamic>? outletLocation;
  bool get checkoutLocked => _checkoutKey != null || pendingOrder != null;
  void resetForServer() {
    api.token = null;
    api.userName = api.userHandle = api.userEmail = null;
    api.emailVerified = false;
    addresses.clear();
    orders = [];
    cart.clear();
    pendingOrder = null;
    deliveryAddress = null;
    outletLocation = null;
    _checkoutKey = null;
    _paymentEvent = null;
    error = null;
    notifyListeners();
  }

  void configureCheckout(String mode, Map<String, dynamic>? address) {
    if (busy || checkoutLocked) return;
    fulfilment = mode;
    deliveryAddress = address;
    notifyListeners();
  }

  bool _disposed = false;
  @override
  void notifyListeners() {
    if (!_disposed) super.notifyListeners();
  }

  int get quantity => cart.values.fold(0, (a, b) => a + b);
  int get estimate =>
      products.fold(0, (sum, p) => sum + p.pricePaise * (cart[p.id] ?? 0));
  String reorder(Map<String, dynamic> order) {
    if (busy || checkoutLocked)
      return 'Finish or resolve your current checkout first.';
    final next = <String, int>{};
    var unavailable = false;
    for (final item in order['items'] as List? ?? []) {
      final id = item['productId'];
      final current = products.where((p) => p.id == id && p.available);
      if (current.isEmpty) {
        unavailable = true;
        continue;
      }
      final quantity = ((item['quantity'] as num?)?.toInt() ?? 1).clamp(1, 20);
      next[id] = ((next[id] ?? 0) + quantity).clamp(1, 20);
    }
    if (next.isEmpty) return 'These dishes are not available on today’s menu.';
    cart
      ..clear()
      ..addAll(next);
    fulfilment = 'pickup';
    deliveryAddress = null;
    notifyListeners();
    return unavailable
        ? 'Some dishes are unavailable. Review the current menu and prices.'
        : 'Review current prices and choose pickup or delivery.';
  }

  Future<void> work(Future<void> Function() action) async {
    if (busy) return;
    busy = true;
    error = null;
    notifyListeners();
    try {
      await action();
    } catch (e) {
      error = '$e';
      if (e is ApiException && e.status == 401 && api.token != null) {
        api.token = null;
        orders = [];
        pendingOrder = null;
        deliveryAddress = null;
        _checkoutKey = null;
        _paymentEvent = null;
      }
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  Future<void> refresh() => work(() async {
    final data = await Future.wait([
      api.request('/menu'),
      api.request('/outlet'),
    ]);
    products = (data[0] as List)
        .map((p) => Product(Map<String, dynamic>.from(p)))
        .toList();
    paused = data[1]['paused'];
    outletLocation = data[1]['latitude'] is num && data[1]['longitude'] is num
        ? {'latitude': data[1]['latitude'], 'longitude': data[1]['longitude']}
        : null;
    if (api.token != null)
      orders = (await api.request('/orders') as List)
          .map((o) => Map<String, dynamic>.from(o))
          .toList();
  });
  void change(String id, int delta) {
    if (busy || pendingOrder != null || _checkoutKey != null) return;
    final quantity = ((cart[id] ?? 0) + delta).clamp(0, 20);
    if (quantity == 0) {
      cart.remove(id);
    } else {
      cart[id] = quantity;
    }
    notifyListeners();
  }

  Future<void> createOrder() => work(() async {
    if (cart.isEmpty) return;
    if (api.token == null) {
      if (const bool.fromEnvironment('BETA_TESTING'))
        throw ApiException(
          'Sign in with your beta test account before checkout.',
          401,
        );
      await api.developmentLogin('customer');
    }
    _checkoutKey ??= requestKey();
    try {
      pendingOrder = Map<String, dynamic>.from(
        await api.request(
          '/orders',
          method: 'POST',
          idempotencyKey: _checkoutKey,
          body: {
            'fulfilment': fulfilment,
            if (fulfilment == 'delivery') 'deliveryAddress': deliveryAddress,
            'items': cart.entries
                .map((i) => {'productId': i.key, 'quantity': i.value})
                .toList(),
          },
        ),
      );
    } on ApiException catch (e) {
      // A definite validation failure created no order; permit cart corrections.
      // Retain the key after a timeout or uncertain server failure.
      if (e.status == 400 || e.status == 409) _checkoutKey = null;
      rethrow;
    }
    orders = (await api.request('/orders') as List)
        .map((o) => Map<String, dynamic>.from(o))
        .toList();
  });
  Future<void> verifyTestPayment() => work(() async {
    if (pendingOrder == null) return;
    _paymentEvent ??= requestKey();
    await api.request(
      '/orders/${pendingOrder!['id']}/${const bool.fromEnvironment('BETA_TESTING') ? 'beta-payment' : 'development-payment'}',
      method: 'POST',
      body: {'eventId': _paymentEvent},
    );
    cart.clear();
    pendingOrder = null;
    _checkoutKey = null;
    _paymentEvent = null;
    orders = (await api.request('/orders') as List)
        .map((o) => Map<String, dynamic>.from(o))
        .toList();
  });
  @override
  void dispose() {
    _disposed = true;
    addresses.dispose();
    api.close();
    super.dispose();
  }

  Future<void> signOut() async {
    try {
      await api.signOut();
    } finally {
      orders = [];
      addresses.clear();
      pendingOrder = null;
      cart.clear();
      deliveryAddress = null;
      _checkoutKey = null;
      _paymentEvent = null;
      notifyListeners();
    }
  }
}
