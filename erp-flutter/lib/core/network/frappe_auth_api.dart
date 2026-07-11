import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;

import '../frappe/app_exception.dart';

/// Minimal, dependency-light Frappe auth transport used by the login flow.
///
/// Heavier CRUD/metadata access is handled by the Tier-2 engine
/// (frappe_mobile_sdk); this only covers what P1 needs: obtain a session
/// cookie, resolve the logged-in user, and best-effort fetch roles for persona
/// derivation. All failures are normalized to [AppException].
class FrappeAuthApi {
  final http.Client _client;
  FrappeAuthApi([http.Client? client]) : _client = client ?? http.Client();

  /// Logs in and returns a map containing apiKey, apiSecret, username, and fullName.
  Future<Map<String, String>> login({
    required String baseUrl,
    required String user,
    required String password,
  }) async {
    final uri = Uri.parse('${_root(baseUrl)}/api/method/login');
    late http.Response res;
    try {
      res = await _client.post(
        uri,
        headers: {'Accept': 'application/json'},
        body: {'usr': user, 'pwd': password},
      );
    } on SocketException {
      throw const NetworkException();
    } on HttpException {
      throw const NetworkException();
    }

    if (res.statusCode != 200) {
      throw AuthException('Login failed', statusCode: res.statusCode);
    }

    final body = jsonDecode(res.body);
    final msg = body['message'];
    if (msg is! Map) {
      throw const AuthException('Invalid login response from server');
    }

    return {
      'api_key': (msg['api_key'] ?? '').toString(),
      'api_secret': (msg['api_secret'] ?? '').toString(),
      'username': (msg['username'] ?? '').toString(),
      'full_name': (msg['full_name'] ?? '').toString(),
    };
  }

  /// Returns the logged-in user id (email/username) for a session.
  Future<String> loggedUser({
    required String baseUrl,
    required String apiKey,
    required String apiSecret,
  }) async {
    final data = await _method(baseUrl, apiKey, apiSecret, 'frappe.auth.get_logged_user');
    final user = (data is Map ? data['message'] : data)?.toString() ?? '';
    if (user.isEmpty || user == 'Guest') {
      throw const AuthException('Session is not authenticated');
    }
    return user;
  }

  /// Best-effort role fetch (child table on the User doc). Returns `[]` if the
  /// current user cannot read their own roles — persona falls back to customer.
  Future<List<String>> roles({
    required String baseUrl,
    required String apiKey,
    required String apiSecret,
    required String user,
  }) async {
    try {
      final uri = Uri.parse(
        '${_root(baseUrl)}/api/resource/User/${Uri.encodeComponent(user)}'
        '?fields=${Uri.encodeComponent('["roles.role"]')}',
      );
      final res = await _client.get(uri, headers: _authHeaders(apiKey, apiSecret));
      if (res.statusCode != 200) return const [];
      final body = jsonDecode(res.body);
      final data = body is Map ? body['data'] : null;
      final rolesRaw = data is Map ? data['roles'] : null;
      if (rolesRaw is! List) return const [];
      return rolesRaw
          .whereType<Map>()
          .map((e) => (e['role'] ?? '').toString())
          .where((r) => r.isNotEmpty)
          .toList(growable: false);
    } catch (_) {
      return const [];
    }
  }

  Future<void> logout({
    required String baseUrl,
    required String apiKey,
    required String apiSecret,
  }) async {
    try {
      await _client.get(
        Uri.parse('${_root(baseUrl)}/api/method/logout'),
        headers: _authHeaders(apiKey, apiSecret),
      );
    } catch (_) {
      // best-effort; local session is cleared regardless
    }
  }

  // ── internals ─────────────────────────────────────────────────────────
  Future<Object?> _method(
    String baseUrl,
    String apiKey,
    String apiSecret,
    String method,
  ) async {
    late http.Response res;
    try {
      res = await _client.get(
        Uri.parse('${_root(baseUrl)}/api/method/$method'),
        headers: _authHeaders(apiKey, apiSecret),
      );
    } on SocketException {
      throw const NetworkException();
    }
    if (res.statusCode == 401 || res.statusCode == 403) {
      throw AuthException('Not authorized', statusCode: res.statusCode);
    }
    if (res.statusCode != 200) {
      throw ApiException('Request failed ($method)', statusCode: res.statusCode);
    }
    return jsonDecode(res.body);
  }

  Map<String, String> _authHeaders(String apiKey, String apiSecret) => {
        'Accept': 'application/json',
        'Authorization': 'token $apiKey:$apiSecret',
      };

  static String _root(String url) =>
      url.endsWith('/') ? url.substring(0, url.length - 1) : url;
}
