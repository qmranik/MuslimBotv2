import 'dart:convert';
import 'package:http/http.dart' as http;

class FrappeException implements Exception {
  final String message;
  final int? statusCode;
  FrappeException(this.message, {this.statusCode});
  @override
  String toString() => 'FrappeException($statusCode): $message';
}

class FrappeApiClient {
  final String baseUrl;
  FrappeApiClient({
    required this.baseUrl,
    this.apiKey = '',
    this.apiSecret = '',
    this.sid,
  });

  String apiKey;
  String apiSecret;
  String? sid;

  Map<String, String> get _headers {
    final headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (apiKey.isNotEmpty && apiSecret.isNotEmpty) {
      headers['Authorization'] = 'token $apiKey:$apiSecret';
    } else if (sid != null && sid!.isNotEmpty) {
      headers['Cookie'] = 'sid=$sid';
    }
    return headers;
  }

  /// Login and retrieve API key and secret
  Future<void> login(String email, String password) async {
    final uri = Uri.parse('$baseUrl/api/method/login');
    final response = await http.post(
      uri,
      headers: {'Accept': 'application/json'},
      body: {'usr': email, 'pwd': password},
    );

    if (response.statusCode == 200) {
      final json = jsonDecode(response.body);
      final msg = json['message'];
      if (msg != null && msg is Map) {
        apiKey = (msg['api_key'] ?? '').toString();
        apiSecret = (msg['api_secret'] ?? '').toString();
      } else {
        throw FrappeException('Invalid response format from login');
      }
    } else {
      _handleResponse(response);
    }
  }

  /// Call a whitelisted Frappe method (POST /api/method/...)
  Future<dynamic> callMethod(String method,
      {Map<String, dynamic>? args}) async {
    final uri = Uri.parse('$baseUrl/api/method/$method');
    final response = await http.post(
      uri,
      headers: _headers,
      body: args != null ? jsonEncode(args) : '{}',
    );
    return _handleResponse(response);
  }

  /// GET a single document
  Future<dynamic> getDoc(String docType, String name) async {
    final uri = Uri.parse('$baseUrl/api/resource/$docType/$name');
    final response = await http.get(uri, headers: _headers);
    return _handleResponse(response);
  }

  /// GET a list of documents with filters/fields/pagination
  Future<dynamic> getList(
    String docType, {
    List<String>? fields,
    dynamic filters,
    int limit = 20,
    int start = 0,
    String? orderBy,
  }) async {
    final Map<String, String> params = {
      'fields': jsonEncode(fields ?? ['name']),
      'limit_page_length': limit.toString(),
      'limit_start': start.toString(),
    };
    if (filters != null) {
      params['filters'] = jsonEncode(filters);
    }
    if (orderBy != null) {
      params['order_by'] = orderBy;
    }
    final uri = Uri.parse('$baseUrl/api/resource/$docType')
        .replace(queryParameters: params);
    final response = await http.get(uri, headers: _headers);
    return _handleResponse(response);
  }

  /// POST to create a new document
  Future<dynamic> createDoc(
      String docType, Map<String, dynamic> data) async {
    final uri = Uri.parse('$baseUrl/api/resource/$docType');
    final response =
        await http.post(uri, headers: _headers, body: jsonEncode(data));
    return _handleResponse(response);
  }

  /// PUT to update a document
  Future<dynamic> updateDoc(
      String docType, String name, Map<String, dynamic> data) async {
    final uri = Uri.parse('$baseUrl/api/resource/$docType/$name');
    final response =
        await http.put(uri, headers: _headers, body: jsonEncode(data));
    return _handleResponse(response);
  }

  dynamic _handleResponse(http.Response response) {
    if (response.statusCode >= 200 && response.statusCode < 300) {
      final json = jsonDecode(response.body);
      // Frappe wraps method responses in {"message": ...}
      // and resource responses in {"data": ...}
      return json['message'] ?? json['data'] ?? json;
    } else {
      String errorMsg = 'HTTP ${response.statusCode}: ${response.reasonPhrase}';
      try {
        final json = jsonDecode(response.body);
        if (json['_server_messages'] != null) {
          final msgs = jsonDecode(json['_server_messages']);
          if (msgs is List && msgs.isNotEmpty) {
            final inner = msgs[0] is String ? jsonDecode(msgs[0]) : msgs[0];
            errorMsg = inner['message'] ?? errorMsg;
          }
        } else if (json['exc'] != null) {
          errorMsg = json['exc'].toString().split('\n').last;
        }
      } catch (_) {}
      throw FrappeException(errorMsg, statusCode: response.statusCode);
    }
  }
}
