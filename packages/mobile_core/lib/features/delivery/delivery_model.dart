import 'package:flutter/foundation.dart';
import 'package:pista_api/pista_api.dart';

class DeliveryModel extends ChangeNotifier {
  final PistaApi api;
  DeliveryModel(this.api);
  List<Map<String, dynamic>> tasks = [];

  /// A live auto-dispatch offer for this rider, if any, and how far the
  /// server's clock is from this phone's (so the countdown stays honest).
  Map<String, dynamic>? offer;
  Duration clockSkew = Duration.zero;
  bool signedIn = false,
      available = false,
      busy = false,
      connected = false,
      _disposed = false;
  String? error, pendingAction;
  @override
  void notifyListeners() {
    if (!_disposed) super.notifyListeners();
  }

  Future<void> _load() async {
    final data = await api.request('/rider/tasks');
    tasks = (data['tasks'] as List)
        .map((t) => Map<String, dynamic>.from(t))
        .toList();
    available = data['available'];
    connected = true;
    pendingAction = null;
    await _loadOffer();
  }

  Future<void> _loadOffer() async {
    if (!available) {
      offer = null;
      return;
    }
    try {
      final data = await api.request('/rider/offer');
      offer = data['offer'] is Map
          ? Map<String, dynamic>.from(data['offer'])
          : null;
      final server = DateTime.tryParse('${data['serverTime']}');
      if (server != null) clockSkew = server.difference(DateTime.now());
    } catch (_) {
      // Offers are optional: an older server or a blip must not break tasks.
      offer = null;
    }
  }

  Future<void> refresh() async {
    if (busy || !signedIn) return;
    busy = true;
    notifyListeners();
    try {
      await _load();
    } catch (e) {
      connected = false;
      error = '$e';
      if (e is ApiException && e.status == 401) {
        clearSession();
        error = 'Session expired or revoked. Sign in again.';
      }
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  Future<void> login() async {
    await _signIn(() => api.developmentLogin('rider'));
  }

  Future<void> loginWithPassword(String handle, String password) =>
      _signIn(() => api.passwordLogin(handle, password, 'rider'));
  Future<void> acceptInvitation(String token, String password) =>
      _signIn(() => api.acceptInvitation(token, password, 'rider'));
  Future<void> signOut() async {
    try {
      await api.signOut();
    } catch (_) {
      error = 'Signed out locally. Server revocation could not be confirmed.';
    }
    signedIn = false;
    connected = false;
    tasks = [];
    offer = null;
    pendingAction = null;
    available = false;
    notifyListeners();
  }

  void clearSession() {
    api.token = null;
    signedIn = false;
    connected = false;
    tasks = [];
    offer = null;
    pendingAction = null;
    available = false;
    notifyListeners();
  }

  Future<void> _signIn(Future<void> Function() action) async {
    if (busy) return;
    busy = true;
    error = null;
    notifyListeners();
    try {
      await action();
      signedIn = true;
      await _load();
    } catch (e) {
      error = '$e';
      connected = false;
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  Future<void> _mutate(
    String path,
    String method,
    Map<String, dynamic> body,
    String description,
  ) async {
    if (busy || !connected) return;
    busy = true;
    error = null;
    notifyListeners();
    try {
      await api.request(path, method: method, body: body);
      await _load();
    } catch (e) {
      error = '$e';
      if (e is! ApiException) {
        pendingAction = description;
        connected = false;
      }
      if (e is ApiException && e.status == 401) {
        clearSession();
        error = 'Session expired or revoked. Sign in again.';
        return;
      }
      // Read back server state after any uncertain result. Never display an optimistic completion.
      try {
        await _load();
      } catch (_) {
        connected = false;
      }
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  Future<void> setAvailable(bool value) => _mutate(
    '/rider/availability',
    'PATCH',
    {'available': value},
    'Availability change',
  );
  Future<void> respondToOffer(bool accept) {
    final id = offer?['id'];
    if (id == null) return Future.value();
    return _mutate(
      '/rider/offers/$id/respond',
      'POST',
      {'accept': accept},
      accept ? 'Accepting the delivery' : 'Declining the delivery',
    );
  }

  Future<void> pickup(Map<String, dynamic> task) => _mutate(
    '/rider/tasks/${task['id']}/actions',
    'POST',
    {'action': 'pickup', 'version': task['version']},
    'Pickup confirmation',
  );
  Future<void> fail(Map<String, dynamic> task, String reason) => _mutate(
    '/rider/tasks/${task['id']}/actions',
    'POST',
    {'action': 'fail', 'version': task['version'], 'reason': reason},
    'Failed-delivery report',
  );
  Future<void> complete(Map<String, dynamic> task, String code) => _mutate(
    '/rider/tasks/${task['id']}/complete',
    'POST',
    {'version': task['version'], 'code': code},
    'Delivery completion',
  );
  @override
  void dispose() {
    _disposed = true;
    api.close();
    super.dispose();
  }
}
