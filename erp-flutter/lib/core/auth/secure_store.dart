import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'session.dart';

/// Thin wrapper over [FlutterSecureStorage] for the persisted session and the
/// last-used instance URL. Keys are namespaced to avoid collisions.
class SecureStore {
  static const _kSession = 'muslimbot.session';
  static const _kLastBaseUrl = 'muslimbot.lastBaseUrl';

  final FlutterSecureStorage _storage;
  SecureStore([FlutterSecureStorage? storage])
      : _storage = storage ?? const FlutterSecureStorage();

  Future<void> saveSession(Session session) =>
      _storage.write(key: _kSession, value: jsonEncode(session.toJson()));

  Future<Session?> readSession() async {
    final raw = await _storage.read(key: _kSession);
    if (raw == null || raw.isEmpty) return null;
    try {
      return Session.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } catch (_) {
      return null;
    }
  }

  Future<void> clearSession() => _storage.delete(key: _kSession);

  Future<void> saveLastBaseUrl(String url) =>
      _storage.write(key: _kLastBaseUrl, value: url);

  Future<String?> readLastBaseUrl() => _storage.read(key: _kLastBaseUrl);
}
