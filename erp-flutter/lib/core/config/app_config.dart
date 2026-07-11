import 'package:flutter/foundation.dart';

/// Central runtime configuration for the MuslimBot mobile super-app.
///
/// All backend access is funnelled through the Go `muslimbot-orchestrator`
/// (`/v1/*`) where possible so identity, tenancy and the Gemini key stay
/// server-side. Direct Frappe access (`/api/*`) is used for session login and
/// as a fallback when the orchestrator is not in front of the site.
@immutable
class AppConfig {
  /// Base URL of the Frappe/ERPNext site, e.g. `http://small.localhost:8000`.
  final String frappeBaseUrl;

  /// Base URL of the Go orchestrator, e.g. `http://localhost:8080`.
  /// The `/v1` prefix is appended by [orchestrator].
  final String orchestratorBaseUrl;

  /// Tenant namespace shared with the KB BFF / voice worker (`TENANT_ID`).
  final String tenantId;

  /// Authenticated workspace URLs embedded in the Tier-3 WebView.
  final Map<String, String> workspaceUrls;

  /// Feature flags — allow phased rollout and graceful degradation.
  final bool voiceEnabled;
  final bool genericEngineEnabled; // Tier 2 (frappe_mobile_sdk)
  final bool knowledgeHubEnabled;

  /// Optional dev-only Gemini key for the client-side structured router
  /// fallback (see REBUILD_PLAN §1.4). Prefer the server `/v1/ai/generate-ui`.
  final String geminiApiKey;

  const AppConfig({
    required this.frappeBaseUrl,
    required this.orchestratorBaseUrl,
    this.tenantId = 'default',
    this.workspaceUrls = const {},
    this.voiceEnabled = true,
    this.genericEngineEnabled = true,
    this.knowledgeHubEnabled = true,
    this.geminiApiKey = '',
  });

  /// Sensible local-dev defaults matching `docker-compose.local.yml` and
  /// `generative-ui/src/config/workspaceUrls.js`.
  factory AppConfig.dev() => const AppConfig(
        frappeBaseUrl: 'http://small.localhost:8000',
        orchestratorBaseUrl: 'http://localhost:8080',
        workspaceUrls: {
          'erp-ops': 'http://localhost:8000/ops',
          'automations': 'http://localhost:5678',
          'support': 'http://localhost:3000',
          'marketing': 'http://localhost:4007',
        },
      );

  /// Root of the orchestrator v1 API (no trailing slash).
  String get orchestrator => '${_noSlash(orchestratorBaseUrl)}/v1';

  /// Root of the Frappe site (no trailing slash).
  String get frappe => _noSlash(frappeBaseUrl);

  String workspaceUrl(String id) => workspaceUrls[id] ?? '';

  AppConfig copyWith({
    String? frappeBaseUrl,
    String? orchestratorBaseUrl,
    String? tenantId,
    Map<String, String>? workspaceUrls,
    bool? voiceEnabled,
    bool? genericEngineEnabled,
    bool? knowledgeHubEnabled,
    String? geminiApiKey,
  }) {
    return AppConfig(
      frappeBaseUrl: frappeBaseUrl ?? this.frappeBaseUrl,
      orchestratorBaseUrl: orchestratorBaseUrl ?? this.orchestratorBaseUrl,
      tenantId: tenantId ?? this.tenantId,
      workspaceUrls: workspaceUrls ?? this.workspaceUrls,
      voiceEnabled: voiceEnabled ?? this.voiceEnabled,
      genericEngineEnabled: genericEngineEnabled ?? this.genericEngineEnabled,
      knowledgeHubEnabled: knowledgeHubEnabled ?? this.knowledgeHubEnabled,
      geminiApiKey: geminiApiKey ?? this.geminiApiKey,
    );
  }

  static String _noSlash(String url) =>
      url.endsWith('/') ? url.substring(0, url.length - 1) : url;
}
