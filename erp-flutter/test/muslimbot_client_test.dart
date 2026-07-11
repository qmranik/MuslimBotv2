import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/testing.dart';
import 'package:http/http.dart' as http;
import 'package:small_erp/core/auth/session.dart';
import 'package:small_erp/core/config/app_config.dart';
import 'package:small_erp/core/models/tool_call.dart';
import 'package:small_erp/core/models/ui_descriptor.dart';
import 'package:small_erp/core/muslimbot/muslimbot_client.dart';
import 'package:small_erp/core/muslimbot/persona_mode.dart';

const _session = Session(
  baseUrl: 'http://x:8000',
  apiKey: 'k',
  apiSecret: 's',
  user: 'o@x.com',
  roles: ['System Manager'],
  tenantId: 'acme',
);

void main() {
  final config = AppConfig.dev();

  group('MuslimBotClient.generateUi', () {
    test('parses a metrics descriptor and sends tenant + auth headers', () async {
      late http.Request captured;
      final mock = MockClient((req) async {
        captured = req;
        return http.Response(
          jsonencodeMetrics(),
          200,
          headers: {'content-type': 'application/json'},
        );
      });
      final client = MuslimBotClient(config: config, session: _session, httpClient: mock);

      final d = await client.generateUi('today\'s sales');
      expect(d.component, UiComponent.metrics);
      expect(d.metrics.first.value, '₹1,000');
      // headers
      expect(captured.headers['X-Tenant-Id'], 'acme');
      expect(captured.headers['Authorization'], 'token k:s');
      expect(captured.url.path, endsWith('/v1/ai/generate-ui'));
      // persona mode default
      final sent = jsonDecode(captured.body) as Map<String, dynamic>;
      expect(sent['persona_mode'], 'full');
      expect(sent['surface'], 'mobile');
    });

    test('customer persona sends support_and_ordering scope', () async {
      final mock = MockClient((req) async {
        final body = jsonDecode(req.body) as Map<String, dynamic>;
        expect(body['persona_mode'], 'support_and_ordering');
        return http.Response('{"component":"text","explanation":"hi"}', 200);
      });
      final client = MuslimBotClient(config: config, session: _session, httpClient: mock);
      await client.generateUi('return policy?',
          personaMode: PersonaMode.supportAndOrdering);
    });

    test('401 degrades to a friendly text descriptor', () async {
      final mock = MockClient((req) async => http.Response('nope', 401));
      final client = MuslimBotClient(config: config, session: _session, httpClient: mock);
      final d = await client.generateUi('anything');
      expect(d.component, UiComponent.text);
      expect(d.explanation, contains('secure gateway'));
    });

    test('network error never throws — returns text', () async {
      final mock = MockClient((req) async => throw Exception('boom'));
      final client = MuslimBotClient(config: config, session: _session, httpClient: mock);
      final d = await client.generateUi('anything');
      expect(d.component, UiComponent.text);
    });
  });

  group('MuslimBotClient.executeTool', () {
    test('write tool without confirm throws before any request', () async {
      var called = false;
      final mock = MockClient((req) async {
        called = true;
        return http.Response('{}', 200);
      });
      final client = MuslimBotClient(config: config, session: _session, httpClient: mock);
      expect(
        () => client.executeTool(const ToolCall(tool: 'create_customer', params: {})),
        throwsA(isA<Exception>()),
      );
      expect(called, isFalse);
    });

    test('confirmed write posts confirm=true and parses result', () async {
      final mock = MockClient((req) async {
        final body = jsonDecode(req.body) as Map<String, dynamic>;
        expect(body['confirm'], true);
        expect(req.url.path, endsWith('/v1/ai/tool/execute'));
        return http.Response('{"tool":"create_customer","ok":true,"data":{"name":"CUST-1"}}', 200);
      });
      final client = MuslimBotClient(config: config, session: _session, httpClient: mock);
      final r = await client.executeTool(
        const ToolCall(tool: 'create_customer', params: {'customer_name': 'Ada'}),
        confirm: true,
      );
      expect(r.ok, isTrue);
      expect(r.data?['name'], 'CUST-1');
    });
  });
}

String jsonencodeMetrics() => jsonEncode({
      'component': 'metrics',
      'title': 'Today',
      'metrics': [
        {'label': 'Revenue', 'value': '₹1,000', 'trend': 'up'}
      ],
      '_dataSource': 'live',
    });
