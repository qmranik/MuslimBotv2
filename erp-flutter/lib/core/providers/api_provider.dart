import 'package:flutter/foundation.dart';
import '../api/frappe_api_client.dart';

/// Holds the global API client instance and connection settings.
/// In a real Riverpod app this would be a Provider, but we keep it simple
/// for the initial scaffold so we can run without code-gen.
class ApiProvider extends ChangeNotifier {
  FrappeApiClient? _client;
  bool _isConnected = false;
  String? _error;

  FrappeApiClient? get client => _client;
  bool get isConnected => _isConnected;
  String? get error => _error;

  Future<void> connect({
    required String baseUrl,
    required String email,
    required String password,
  }) async {
    _error = null;
    notifyListeners();
    try {
      final url = baseUrl.endsWith('/') ? baseUrl.substring(0, baseUrl.length - 1) : baseUrl;
      _client = FrappeApiClient(baseUrl: url);
      await _client!.login(email, password);
      // Let's verify we got a cookie and can hit ping
      await _client!.callMethod('frappe.ping');
      _isConnected = true;
      notifyListeners();
    } catch (e) {
      _client = null;
      _isConnected = false;
      _error = e.toString();
      notifyListeners();
      rethrow;
    }
  }

  void disconnect() {
    _client = null;
    _isConnected = false;
    notifyListeners();
  }

  void updateFromSession(dynamic session) {
    if (session == null) {
      if (_client != null) {
        _client = null;
        _isConnected = false;
        _error = null;
        notifyListeners();
      }
    } else {
      final String baseUrl = session.baseUrl;
      final String apiKey = session.apiKey;
      final String apiSecret = session.apiSecret;
      if (_client == null ||
          _client!.baseUrl != baseUrl ||
          _client!.apiKey != apiKey ||
          _client!.apiSecret != apiSecret) {
        _client = FrappeApiClient(
          baseUrl: baseUrl,
          apiKey: apiKey,
          apiSecret: apiSecret,
        );
        _isConnected = true;
        _error = null;
        notifyListeners();
      }
    }
  }

  void setError(String msg) {
    _error = msg;
    notifyListeners();
  }
}
