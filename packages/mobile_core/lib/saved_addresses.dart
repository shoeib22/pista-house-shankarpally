import 'package:flutter/foundation.dart';
import 'package:pista_api/pista_api.dart';

/// The signed-in customer's saved delivery addresses, kept on the server.
/// Past orders keep their own copy of the address they used, so editing or
/// deleting an entry here never changes an order.
class AddressBook extends ChangeNotifier {
  AddressBook(this.api);
  final PistaApi api;
  List<Map<String, dynamic>> items = [];
  bool loading = false, loaded = false, _disposed = false;
  String? error;

  Map<String, dynamic>? get defaultAddress {
    for (final a in items) {
      if (a['isDefault'] == true) return a;
    }
    return null;
  }

  @override
  void notifyListeners() {
    if (!_disposed) super.notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    super.dispose();
  }

  void clear() {
    items = [];
    loaded = false;
    loading = false;
    error = null;
    notifyListeners();
  }

  /// Loads the list. Does nothing when nobody is signed in.
  Future<void> load({bool force = false}) async {
    if (api.token == null || loading || (loaded && !force)) return;
    loading = true;
    error = null;
    notifyListeners();
    try {
      final data = await api.request('/addresses') as List;
      items = data.map((a) => Map<String, dynamic>.from(a)).toList();
      loaded = true;
    } catch (e) {
      error = '$e';
    } finally {
      loading = false;
      notifyListeners();
    }
  }

  /// What the server expects: the address fields, a label, and optionally the
  /// map pin and whether this should become the default.
  static Map<String, dynamic> payload(
    Map<String, dynamic> address, {
    required String label,
    bool makeDefault = false,
  }) => {
    'label': label,
    'recipient': address['recipient'],
    'phone': address['phone'],
    'line1': address['line1'],
    'city': address['city'],
    'postalCode': address['postalCode'],
    if ('${address['landmark'] ?? ''}'.isNotEmpty)
      'landmark': address['landmark'],
    if (address['latitude'] is num && address['longitude'] is num) ...{
      'latitude': address['latitude'],
      'longitude': address['longitude'],
    },
    if (makeDefault) 'makeDefault': true,
  };

  /// Saves a new address, or updates the matching one when the same street
  /// address and postcode are already saved.
  Future<Map<String, dynamic>> save(
    Map<String, dynamic> address, {
    String label = 'Home',
    bool makeDefault = false,
  }) async {
    final saved = Map<String, dynamic>.from(
      await api.request(
        '/addresses',
        method: 'POST',
        body: payload(address, label: label, makeDefault: makeDefault),
      ),
    );
    await load(force: true);
    return saved;
  }

  Future<void> update(
    String id,
    Map<String, dynamic> address, {
    required String label,
    bool makeDefault = false,
  }) async {
    await api.request(
      '/addresses/$id',
      method: 'PUT',
      body: payload(address, label: label, makeDefault: makeDefault),
    );
    await load(force: true);
  }

  Future<void> makeDefault(String id) async {
    await api.request('/addresses/$id/default', method: 'PATCH');
    await load(force: true);
  }

  Future<void> remove(String id) async {
    await api.request('/addresses/$id', method: 'DELETE');
    await load(force: true);
  }
}
