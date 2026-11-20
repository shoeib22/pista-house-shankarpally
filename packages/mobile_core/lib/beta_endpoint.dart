import 'package:shared_preferences/shared_preferences.dart';
import 'package:pista_api/pista_api.dart';

class BetaEndpoint {
  static const _key = 'pista.beta.api_url.v1';
  static Future<void> restore() async {
    if (!const bool.fromEnvironment('BETA_TESTING')) return;
    try {
      final saved = await SharedPreferencesAsync().getString(_key);
      if (saved != null) {
        final uri = Uri.tryParse(saved);
        if (uri?.scheme == 'https' &&
            uri!.userInfo.isEmpty &&
            !uri.hasQuery &&
            !uri.hasFragment &&
            uri.path.endsWith('/api'))
          PistaApi.betaServerOverride = saved;
      }
    } catch (_) {
      /* Optional non-secret URL preferences do not prevent app startup. */
    }
  }

  static Future<void> save(String url) =>
      SharedPreferencesAsync().setString(_key, url);
}
