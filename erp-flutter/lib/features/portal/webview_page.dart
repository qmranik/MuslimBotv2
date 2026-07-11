import 'dart:io';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:webview_cookie_manager/webview_cookie_manager.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../../core/auth/auth_controller.dart';
import '../../core/config/app_config.dart';
import '../../core/theme/app_theme.dart';
import 'portal_client.dart';

/// Tier-3 surface: embeds the authenticated ERPNext desk/ops (or another
/// workspace) so *nothing* is ever a dead end. The Frappe `sid` cookie is
/// synced into the WebView so the desk loads already logged-in, and a JS
/// bridge relays ERP mutation events back to native for cache refresh.
class PortalWebViewPage extends StatefulWidget {
  final String appId;
  final String title;

  /// Optional deep target path (e.g. `/ops/accounting`) appended when the
  /// resolved workspace URL has no explicit path — used by MuslimBot `navigate`.
  final String? targetPath;

  const PortalWebViewPage({
    super.key,
    required this.appId,
    required this.title,
    this.targetPath,
  });

  @override
  State<PortalWebViewPage> createState() => _PortalWebViewPageState();
}

class _PortalWebViewPageState extends State<PortalWebViewPage> {
  WebViewController? _controller;
  bool _loading = true;
  String? _error;
  String? _resolvedUrl;

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    final config = context.read<AppConfig>();
    final auth = context.read<AuthController>();

    try {
      final base = await PortalClient(config).resolveUrl(widget.appId);
      if (base.isEmpty) {
        setState(() {
          _error = 'No URL configured for "${widget.appId}".';
          _loading = false;
        });
        return;
      }
      final url = _withPath(base, widget.targetPath);
      await _syncCookie(url, auth);

      final controller = WebViewController()
        ..setJavaScriptMode(JavaScriptMode.unrestricted)
        ..addJavaScriptChannel('MuslimBot', onMessageReceived: _onBridgeMessage)
        ..setNavigationDelegate(
          NavigationDelegate(
            onPageFinished: (_) {
              if (mounted) setState(() => _loading = false);
            },
            onWebResourceError: (err) {
              if (mounted) {
                setState(() {
                  _loading = false;
                  _error = 'Failed to load: ${err.description}';
                });
              }
            },
          ),
        )
        ..loadRequest(Uri.parse(url));

      if (mounted) {
        setState(() {
          _controller = controller;
          _resolvedUrl = url;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = 'Could not open portal: $e';
          _loading = false;
        });
      }
    }
  }

  /// Inject the session cookie for the target host so the desk is authenticated.
  Future<void> _syncCookie(String url, AuthController auth) async {
    final sid = auth.session?.sid;
    if (sid == null || sid.isEmpty) return;
    final host = Uri.parse(url).host;
    if (host.isEmpty) return;
    try {
      await WebviewCookieManager().setCookies([
        Cookie('sid', sid)
          ..domain = host
          ..path = '/',
      ]);
    } catch (_) {
      // Cookie sync is best-effort; SSO/portal URL may already carry auth.
    }
  }

  void _onBridgeMessage(JavaScriptMessage message) {
    // ERP_MUTATION_COMPLETE / WORKFLOW_SAVED → refresh native caches (P3+).
    // Kept minimal in P1; the event bus lands with the assistant.
    debugPrint('[MuslimBot bridge] ${message.message}');
  }

  static String _withPath(String base, String? path) {
    if (path == null || path.isEmpty) return base;
    final uri = Uri.parse(base);
    if (uri.path.length > 1) return base; // already has a path
    return base.endsWith('/')
        ? '$base${path.startsWith('/') ? path.substring(1) : path}'
        : '$base${path.startsWith('/') ? path : '/$path'}';
  }

  Future<void> _reload() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    await _controller?.reload();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.title),
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: _reload),
        ],
      ),
      body: Stack(
        children: [
          if (_controller != null && _error == null)
            WebViewWidget(controller: _controller!),
          if (_error != null) _ErrorView(message: _error!, onRetry: _bootstrap, url: _resolvedUrl),
          if (_loading && _error == null)
            const ColoredBox(
              color: Colors.transparent,
              child: Center(child: CircularProgressIndicator()),
            ),
        ],
      ),
    );
  }
}

class _ErrorView extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;
  final String? url;
  const _ErrorView({required this.message, required this.onRetry, this.url});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.public_off, size: 56, color: AppTheme.danger),
            const SizedBox(height: 16),
            Text(message, textAlign: TextAlign.center),
            const SizedBox(height: 16),
            ElevatedButton(onPressed: onRetry, child: const Text('Retry')),
          ],
        ),
      ),
    );
  }
}
