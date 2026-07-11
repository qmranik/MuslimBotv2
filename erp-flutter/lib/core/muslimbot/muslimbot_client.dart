import 'dart:convert';
import 'package:http/http.dart' as http;

import '../auth/session.dart';
import '../config/app_config.dart';
import '../frappe/app_exception.dart';
import '../models/tool_call.dart';
import '../models/ui_descriptor.dart';
import 'persona_mode.dart';

/// Result of executing a catalog tool server-side.
class ToolResult {
  final String tool;
  final bool ok;
  final Map<String, dynamic>? data;
  final String? error;

  const ToolResult({required this.tool, required this.ok, this.data, this.error});

  factory ToolResult.fromJson(Map<String, dynamic> j) => ToolResult(
        tool: (j['tool'] ?? '').toString(),
        ok: j['ok'] == true,
        data: j['data'] is Map
            ? (j['data'] as Map).map((k, v) => MapEntry(k.toString(), v))
            : null,
        error: j['error']?.toString(),
      );
}

/// Client for the single server-side MuslimBot brain on the orchestrator
/// (`/v1/ai/generate-ui`, `/v1/ai/tool/execute`). Keeping the intelligence
/// server-side means the Gemini key and tool credentials never ship in the app
/// (MUSLIMBOT_PRODUCTION_PLAN W2). In prod the request passes through
/// Traefik+Authentik; the app forwards its Frappe token + tenant for the
/// interim bridge and degrades gracefully to a text reply on failure.
class MuslimBotClient {
  final AppConfig config;
  final Session? session;
  final http.Client _http;

  MuslimBotClient({required this.config, this.session, http.Client? httpClient})
      : _http = httpClient ?? http.Client();

  Map<String, String> get _headers {
    final h = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Tenant-Id': session?.tenantId ?? config.tenantId,
    };
    final s = session;
    if (s != null && s.apiKey.isNotEmpty && s.apiSecret.isNotEmpty) {
      h['Authorization'] = 'token ${s.apiKey}:${s.apiSecret}';
    }
    if (s != null && s.user.isNotEmpty) {
      // Interim identity hint until mobile OAuth2 via Authentik lands (W1.2).
      h['X-authentik-email'] = s.user;
    }
    return h;
  }

  /// Ask MuslimBot to produce a [UiDescriptor] for [prompt].
  Future<UiDescriptor> generateUi(
    String prompt, {
    List<Map<String, String>> history = const [],
    PersonaMode personaMode = PersonaMode.full,
    String surface = 'mobile',
  }) async {
    final uri = Uri.parse('${config.orchestrator}/ai/generate-ui');
    try {
      final res = await _http.post(
        uri,
        headers: _headers,
        body: jsonEncode({
          'prompt': prompt,
          'history': history,
          'surface': surface,
          'persona_mode':
              personaMode == PersonaMode.supportAndOrdering ? 'support_and_ordering' : 'full',
        }),
      );
      if (res.statusCode == 200) {
        final body = jsonDecode(res.body);
        if (body is Map<String, dynamic>) return UiDescriptor.fromJson(body);
        return UiDescriptor.text('Unexpected response from MuslimBot.');
      }
      if (res.statusCode == 401 || res.statusCode == 403) {
        return UiDescriptor.text(
            'MuslimBot AI needs sign-in through the secure gateway on this build.');
      }
      return UiDescriptor.text('MuslimBot is unavailable right now.');
    } catch (_) {
      return UiDescriptor.text('Could not reach MuslimBot. Check your connection.');
    }
  }

  /// Execute a catalog [ToolCall]. Write tools require [confirm]=true.
  Future<ToolResult> executeTool(ToolCall call, {bool confirm = false}) async {
    if (call.isWrite && !confirm) {
      throw const ValidationException('Write tools require explicit confirmation.');
    }
    final uri = Uri.parse('${config.orchestrator}/ai/tool/execute');
    final res = await _http.post(
      uri,
      headers: _headers,
      body: jsonEncode({
        'tool': call.tool,
        'params': call.params,
        'confirm': confirm,
      }),
    );
    if (res.statusCode == 200 || res.statusCode == 502) {
      final body = jsonDecode(res.body);
      if (body is Map<String, dynamic>) return ToolResult.fromJson(body);
    }
    throw ApiException('Tool execution failed', statusCode: res.statusCode);
  }
}
