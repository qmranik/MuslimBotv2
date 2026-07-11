import 'package:flutter/foundation.dart';

import '../config/app_config.dart';
import '../frappe/app_exception.dart';
import '../network/frappe_auth_api.dart';
import 'persona.dart';
import 'secure_store.dart';
import 'session.dart';

enum AuthStatus { unknown, authenticating, authenticated, unauthenticated }

/// Owns the authenticated [Session] and derived [Persona]. Persists the session
/// so users stay logged in, and exposes login / restore / logout / persona
/// override for the router and shell.
class AuthController extends ChangeNotifier {
  final AppConfig config;
  final SecureStore store;
  final FrappeAuthApi api;

  AuthController({
    required this.config,
    SecureStore? store,
    FrappeAuthApi? api,
  })  : store = store ?? SecureStore(),
        api = api ?? FrappeAuthApi();

  AuthStatus _status = AuthStatus.unknown;
  Session? _session;
  String? _error;

  AuthStatus get status => _status;
  Session? get session => _session;
  String? get error => _error;
  bool get isAuthenticated => _status == AuthStatus.authenticated;
  Persona get persona => _session?.persona ?? Persona.customer;

  /// The default instance URL to prefill on the login screen.
  Future<String> lastBaseUrl() async =>
      (await store.readLastBaseUrl()) ?? config.frappeBaseUrl;

  /// Restore a persisted session on cold start.
  Future<void> restore() async {
    final saved = await store.readSession();
    if (saved != null && saved.hasCookie) {
      _session = saved;
      _status = AuthStatus.authenticated;
    } else {
      _status = AuthStatus.unauthenticated;
    }
    notifyListeners();
  }

  Future<void> login({
    required String baseUrl,
    required String user,
    required String password,
  }) async {
    _status = AuthStatus.authenticating;
    _error = null;
    notifyListeners();

    final normalized = _noSlash(baseUrl.trim());
    try {
      final credentials = await api.login(
        baseUrl: normalized,
        user: user.trim(),
        password: password,
      );
      final apiKey = credentials['api_key']!;
      final apiSecret = credentials['api_secret']!;
      final fullName = credentials['full_name']!;

      final userId = await api.loggedUser(
        baseUrl: normalized,
        apiKey: apiKey,
        apiSecret: apiSecret,
      );
      final roles = await api.roles(
        baseUrl: normalized,
        apiKey: apiKey,
        apiSecret: apiSecret,
        user: userId,
      );

      _session = Session(
        baseUrl: normalized,
        apiKey: apiKey,
        apiSecret: apiSecret,
        user: userId,
        fullName: fullName,
        roles: roles,
        tenantId: config.tenantId,
      );
      await store.saveSession(_session!);
      await store.saveLastBaseUrl(normalized);
      _status = AuthStatus.authenticated;
    } on AppException catch (e) {
      _error = e.friendly;
      _status = AuthStatus.unauthenticated;
    } catch (e) {
      _error = 'Unexpected error: $e';
      _status = AuthStatus.unauthenticated;
    }
    notifyListeners();
  }

  /// Preview another persona's surface (staff only). Persisted with the session.
  Future<void> overridePersona(Persona? persona) async {
    if (_session == null) return;
    _session = _session!.copyWith(
      personaOverride: persona,
      clearOverride: persona == null,
    );
    await store.saveSession(_session!);
    notifyListeners();
  }

  Future<void> logout() async {
    final s = _session;
    if (s != null) {
      await api.logout(
        baseUrl: s.baseUrl,
        apiKey: s.apiKey,
        apiSecret: s.apiSecret,
      );
    }
    await store.clearSession();
    _session = null;
    _status = AuthStatus.unauthenticated;
    notifyListeners();
  }

  static String _noSlash(String url) =>
      url.endsWith('/') ? url.substring(0, url.length - 1) : url;
}
