import 'package:shared_preferences/shared_preferences.dart';

class DeviceDishSaves {
  static const _key = 'pista.saved_dishes.device.v1';
  static Future<Set<String>> load() async {
    try {
      return (await SharedPreferencesAsync().getStringList(_key) ?? []).toSet();
    } catch (_) {
      return {};
    }
  }

  static Future<void> save(Set<String> values) =>
      SharedPreferencesAsync().setStringList(_key, values.toList());
}
