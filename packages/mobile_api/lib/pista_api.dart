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
    token = data['token'] as String;
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
