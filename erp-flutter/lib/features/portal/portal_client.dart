import 'dart:convert';
import 'package:http/http.dart' as http;

import '../../core/config/app_config.dart';

/// Resolves the URL to embed for a workspace (`erp-ops`, `automations`,
/// `support`, `marketing`).
///
/// Prefers the orchestrator SSO endpoint `GET /v1/portals/:app/url` (which
/// returns an authenticated URL); falls back to the statically configured
/// workspace URL + cookie-sync when the orchestrator is not in front.
class PortalClient {
  final AppConfig config;
  final http.Client _client;
  PortalClient(this.config, [http.Client? client])
      : _client = client ?? http.Client();

  Future<String> resolveUrl(String appId) async {
    try {
      final res = await _client.get(
        Uri.parse('${config.orchestrator}/portals/$appId/url'),
        headers: {'Accept': 'application/json'},
      );
      if (res.statusCode == 200) {
        final body = jsonDecode(res.body);
        final url = (body is Map ? body['url'] : null)?.toString();
        if (url != null && url.isNotEmpty) return url;
      }
    } catch (_) {
      // fall through to static config
    }
    return config.workspaceUrl(appId);
  }
}
