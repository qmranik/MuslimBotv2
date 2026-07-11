import 'package:flutter_test/flutter_test.dart';
import 'package:small_erp/core/auth/auth_controller.dart';
import 'package:small_erp/core/auth/persona.dart';
import 'package:small_erp/core/auth/secure_store.dart';
import 'package:small_erp/core/auth/session.dart';
import 'package:small_erp/core/config/app_config.dart';
import 'package:small_erp/core/frappe/app_exception.dart';
import 'package:small_erp/core/network/frappe_auth_api.dart';

class _FakeStore extends SecureStore {
  Session? saved;
  String? lastUrl;
  @override
  Future<void> saveSession(Session session) async => saved = session;
  @override
  Future<Session?> readSession() async => saved;
  @override
  Future<void> clearSession() async => saved = null;
  @override
  Future<void> saveLastBaseUrl(String url) async => lastUrl = url;
  @override
  Future<String?> readLastBaseUrl() async => lastUrl;
}

class _FakeApi extends FrappeAuthApi {
  final bool fail;
  final List<String> rolesResult = const ['System Manager'];
  _FakeApi({this.fail = false});

  @override
  Future<Map<String, String>> login({
    required String baseUrl,
    required String user,
    required String password,
  }) async {
    if (fail) throw const AuthException('Login failed', statusCode: 401);
    return {
      'api_key': 'KEY-123',
      'api_secret': 'SECRET-123',
      'username': 'owner@example.com',
      'full_name': 'Owner User',
    };
  }

  @override
  Future<String> loggedUser({
    required String baseUrl,
    required String apiKey,
    required String apiSecret,
  }) async =>
      'owner@example.com';

  @override
  Future<List<String>> roles({
    required String baseUrl,
    required String apiKey,
    required String apiSecret,
    required String user,
  }) async =>
      rolesResult;

  @override
  Future<void> logout({
    required String baseUrl,
    required String apiKey,
    required String apiSecret,
  }) async {}
}

void main() {
  final config = AppConfig.dev();

  group('Session serialization', () {
    test('round-trips including persona override', () {
      const s = Session(
        baseUrl: 'http://x:8000',
        sid: 'abc',
        apiKey: 'key',
        apiSecret: 'secret',
        user: 'u@x.com',
        fullName: 'You',
        roles: ['SMB Manager'],
        personaOverride: Persona.customer,
      );
      final back = Session.fromJson(s.toJson());
      expect(back.sid, 'abc');
      expect(back.apiKey, 'key');
      expect(back.apiSecret, 'secret');
      expect(back.roles, ['SMB Manager']);
      expect(back.personaOverride, Persona.customer);
      // Override wins over role-derived persona.
      expect(back.persona, Persona.customer);
    });
  });

  group('AuthController', () {
    test('restore with no session → unauthenticated', () async {
      final auth = AuthController(config: config, store: _FakeStore(), api: _FakeApi());
      await auth.restore();
      expect(auth.status, AuthStatus.unauthenticated);
      expect(auth.isAuthenticated, isFalse);
    });

    test('restore with saved session → authenticated + persona', () async {
      final store = _FakeStore()
        ..saved = const Session(
          baseUrl: 'http://x:8000',
          sid: 'sid',
          user: 'o@x.com',
          roles: ['System Manager'],
        );
      final auth = AuthController(config: config, store: store, api: _FakeApi());
      await auth.restore();
      expect(auth.isAuthenticated, isTrue);
      expect(auth.persona, Persona.owner);
    });

    test('successful login stores session and derives persona', () async {
      final store = _FakeStore();
      final auth = AuthController(config: config, store: store, api: _FakeApi());
      await auth.login(
        baseUrl: 'http://x:8000/',
        user: 'owner@example.com',
        password: 'secret',
      );
      expect(auth.isAuthenticated, isTrue);
      expect(auth.persona, Persona.owner);
      expect(store.saved?.apiKey, 'KEY-123');
      expect(store.saved?.apiSecret, 'SECRET-123');
      expect(store.lastUrl, 'http://x:8000'); // trailing slash normalized
    });

    test('failed login surfaces friendly error, stays unauthenticated', () async {
      final auth = AuthController(
        config: config,
        store: _FakeStore(),
        api: _FakeApi(fail: true),
      );
      await auth.login(baseUrl: 'http://x:8000', user: 'u', password: 'bad');
      expect(auth.isAuthenticated, isFalse);
      expect(auth.error, isNotNull);
    });

    test('persona override then clear', () async {
      final store = _FakeStore();
      final auth = AuthController(config: config, store: store, api: _FakeApi());
      await auth.login(baseUrl: 'http://x:8000', user: 'o', password: 'p');
      await auth.overridePersona(Persona.customer);
      expect(auth.persona, Persona.customer);
      await auth.overridePersona(null);
      expect(auth.persona, Persona.owner);
    });

    test('logout clears session', () async {
      final store = _FakeStore();
      final auth = AuthController(config: config, store: store, api: _FakeApi());
      await auth.login(baseUrl: 'http://x:8000', user: 'o', password: 'p');
      await auth.logout();
      expect(auth.isAuthenticated, isFalse);
      expect(store.saved, isNull);
    });
  });
}
