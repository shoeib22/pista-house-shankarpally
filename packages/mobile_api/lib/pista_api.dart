import 'dart:convert';
import 'package:http/http.dart' as http;
export 'contract.g.dart';

class ApiException implements Exception {
  final String message;
  final int status;
  ApiException(this.message, this.status);
  @override
  String toString() => message;
}

class PistaApi {
  String baseUrl;
  static String betaServerOverride = '';
  String? token;

  /// Display details of the signed-in account, from the last sign-in.
  String? userName, userHandle, userEmail;
  bool emailVerified = false;
  final http.Client _client;
  PistaApi({String? baseUrl, http.Client? client})
    : baseUrl =
          baseUrl ??
          (const bool.fromEnvironment('BETA_TESTING')
              ? (betaServerOverride.isNotEmpty
                    ? betaServerOverride
                    : const String.fromEnvironment('API_URL'))
              : const String.fromEnvironment(
                  'API_URL',
                  defaultValue: 'http://10.0.2.2:3001/api',
                )),
      _client = client ?? http.Client();
  Future<dynamic> request(
    String path, {
    String method = 'GET',
    Object? body,
    String? idempotencyKey,
  }) async {
    if (baseUrl.isEmpty)
      throw ApiException(
        'Test backend is not configured. Open Beta server settings when your server is ready.',
        503,
      );
    final request = http.Request(method, Uri.parse('$baseUrl$path'));
    request.headers['Content-Type'] = 'application/json';
    if (token != null) request.headers['Authorization'] = 'Bearer $token';
    if (idempotencyKey != null)
      request.headers['Idempotency-Key'] = idempotencyKey;
    if (body != null) request.body = jsonEncode(body);
    final response = await http.Response.fromStream(
      await _client.send(request).timeout(const Duration(seconds: 15)),
    );
    final data = jsonDecode(response.body);
    if (response.statusCode >= 400)
      throw ApiException(
        data is Map ? '${data['message']}' : 'Request failed',
        response.statusCode,
      );
    return data;
  }

  Future<void> developmentLogin(String identity) async {
    if (!const bool.fromEnvironment('ALLOW_DEVELOPMENT_LOGIN'))
      throw ApiException(
        'Account provider is not configured in this build.',
        503,
      );
    final data = await request(
      '/auth/development',
      method: 'POST',
      body: {'identity': identity},
    );
    token = data['token'] as String;
  }

  Future<void> passwordLogin(
    String handle,
    String password,
    String audience,
  ) async {
    final data = await request(
      '/auth/login',
      method: 'POST',
      body: {'handle': handle, 'password': password, 'audience': audience},
    );
    _remember(data);
    userHandle ??= handle;
  }

  /// Customer self-registration with a mobile number and a passphrase. The
  /// number is not verified yet. Signs the new customer in.
  Future<void> register(
    String name,
    String phone,
    String password, {
    String? email,
  }) async {
    final data = await request(
      '/auth/register',
      method: 'POST',
      body: {
        'name': name,
        'phone': phone,
        'password': password,
        if (email != null && email.isNotEmpty) 'email': email,
      },
    );
    _remember(data);
    userEmail = data['email'] == null ? null : '${data['email']}';
    emailVerified = data['emailVerified'] == true;
    lastEmailSent = data['emailSent'] == true;
  }

  /// Whether the verification email from the last sign-up was sent.
  bool lastEmailSent = false;

  /// Refreshes the signed-in account's name, number and email status.
  Future<void> loadAccount() async {
    if (token == null) return;
    final data = await request('/auth/me');
    userName = '${data['name']}';
    userHandle = data['handle'] == null ? null : '${data['handle']}';
    userEmail = data['email'] == null ? null : '${data['email']}';
    emailVerified = data['emailVerified'] == true;
  }

  /// Adds or changes the account's email and sends a verification code.
  /// Returns whether the email was sent.
  Future<bool> setEmail(String email) async {
    final data = await request(
      '/auth/email',
      method: 'POST',
      body: {'email': email},
    );
    userEmail = '${data['email']}';
    emailVerified = data['verified'] == true;
    return data['sent'] == true;
  }

  Future<bool> resendEmailCode() async {
    final data = await request('/auth/email/resend', method: 'POST');
    return data['sent'] == true;
  }

  Future<void> verifyEmail(String code) async {
    await request('/auth/email/verify', method: 'POST', body: {'code': code});
    emailVerified = true;
  }

  // ---- payments ----------------------------------------------------

  /// Which payment provider the server uses, and whether it is the test one.
  Future<Map<String, dynamic>> paymentConfig() async =>
      Map<String, dynamic>.from(await request('/payments/config'));

  /// Starts (or resumes) paying for an order. The server chooses the amount.
  Future<Map<String, dynamic>> startPayment(String orderId) async =>
      Map<String, dynamic>.from(
        await request('/orders/$orderId/payments', method: 'POST'),
      );

  Future<Map<String, dynamic>> paymentStatus(String orderId) async =>
      Map<String, dynamic>.from(await request('/orders/$orderId/payment'));

  /// Tells the server the customer has finished paying. The server verifies any
  /// proof and checks with the gateway; it never takes the app's word for it.
  Future<Map<String, dynamic>> confirmPayment(
    String paymentId, {
    Map<String, dynamic>? result,
  }) async => Map<String, dynamic>.from(
    await request(
      '/payments/$paymentId/confirm',
      method: 'POST',
      body: {if (result != null) 'result': result},
    ),
  );

  /// Test-payment control (only works when the server uses the simulated provider).
  Future<Map<String, dynamic>> simulatePayment(
    String paymentId,
    String outcome,
  ) async => Map<String, dynamic>.from(
    await request(
      '/payments/$paymentId/simulate',
      method: 'POST',
      body: {'outcome': outcome},
    ),
  );

  /// Asks for a passphrase reset code. The server answers the same for every
  /// identifier, so this reveals nothing about who has an account.
  Future<String> forgotPassphrase(String identifier) async {
    final data = await request(
      '/auth/forgot',
      method: 'POST',
      body: {'identifier': identifier},
    );
    return '${data['message']}';
  }

  Future<void> resetPassphrase(
    String identifier,
    String code,
    String password,
  ) => request(
    '/auth/reset',
    method: 'POST',
    body: {'identifier': identifier, 'code': code, 'password': password},
  );

  void _remember(dynamic data) {
    token = data['token'] as String;
    userName = data['user'] is Map ? '${data['user']['name']}' : null;
    userHandle = data['handle'] == null ? null : '${data['handle']}';
  }

  Future<void> acceptInvitation(
    String code,
    String password,
    String audience,
  ) async {
    final data = await request(
      '/auth/accept-invitation',
      method: 'POST',
      body: {'token': code.trim(), 'password': password, 'audience': audience},
    );
    token = data['token'] as String;
  }

  Future<void> signOut() async {
    try {
      if (token != null) await request('/session', method: 'DELETE');
    } finally {
      token = null;
      userName = userHandle = userEmail = null;
      emailVerified = false;
    }
  }

  Future<void> configureBetaServer(String value) async {
    if (!const bool.fromEnvironment('BETA_TESTING'))
      throw ApiException(
        'Server configuration is available only in beta builds.',
        403,
      );
    final uri = Uri.tryParse(value.trim());
    if (uri == null ||
        uri.scheme != 'https' ||
        uri.host.isEmpty ||
        uri.userInfo.isNotEmpty ||
        uri.hasQuery ||
        uri.hasFragment ||
        !uri.path.replaceAll(RegExp(r'/$'), '').endsWith('/api'))
      throw ApiException('Enter the HTTPS test API URL ending in /api.', 400);
    final normalized = uri.toString().replaceAll(RegExp(r'/$'), '');
    final candidate = PistaApi(baseUrl: normalized);
    try {
      final health = await candidate.request('/health');
      if (health['beta'] != true ||
          health['development'] == true ||
          health['payments'] != 'beta_simulated')
        throw ApiException(
          'This address is not an isolated Pista beta server.',
          400,
        );
    } finally {
      candidate.close();
    }
    token = null;
    baseUrl = normalized;
    betaServerOverride = normalized;
  }

  void close() => _client.close();
}
