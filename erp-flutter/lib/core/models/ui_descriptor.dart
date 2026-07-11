import 'tool_call.dart';

/// The generative-UI component the assistant asks the client to render.
///
/// The first six mirror the web `generative-ui` schema; `navigate`, `flow`,
/// `openDoc` and `rag` are MuslimBot-mobile extensions (REBUILD_PLAN §3, §5.6).
enum UiComponent {
  metrics,
  chart,
  table,
  card,
  action,
  text,
  navigate,
  flow,
  openDoc,
  rag;

  static UiComponent parse(String? raw) {
    switch ((raw ?? 'text').toLowerCase()) {
      case 'metrics':
        return UiComponent.metrics;
      case 'chart':
        return UiComponent.chart;
      case 'table':
        return UiComponent.table;
      case 'card':
        return UiComponent.card;
      case 'action':
        return UiComponent.action;
      case 'navigate':
        return UiComponent.navigate;
      case 'flow':
        return UiComponent.flow;
      case 'open_doc':
      case 'opendoc':
        return UiComponent.openDoc;
      case 'rag':
        return UiComponent.rag;
      default:
        return UiComponent.text;
    }
  }
}

class TableColumn {
  final String key;
  final String label;
  const TableColumn(this.key, this.label);

  factory TableColumn.fromJson(Map<String, dynamic> j) =>
      TableColumn((j['key'] ?? '').toString(), (j['label'] ?? '').toString());
}

class MetricItem {
  final String label;
  final String value;
  final String change;
  final String trend; // up | down | neutral
  const MetricItem({
    required this.label,
    required this.value,
    this.change = '',
    this.trend = 'neutral',
  });

  factory MetricItem.fromJson(Map<String, dynamic> j) => MetricItem(
        label: (j['label'] ?? '').toString(),
        value: (j['value'] ?? '').toString(),
        change: (j['change'] ?? '').toString(),
        trend: (j['trend'] ?? 'neutral').toString(),
      );
}

/// A single step in a `flow` wizard descriptor.
class FlowStep {
  final String title;
  final List<Map<String, dynamic>> fields;
  const FlowStep({required this.title, this.fields = const []});

  factory FlowStep.fromJson(Map<String, dynamic> j) => FlowStep(
        title: (j['title'] ?? '').toString(),
        fields: _mapList(j['fields']),
      );
}

/// Immutable descriptor returned by the intent router / RAG / voice bridge.
class UiDescriptor {
  final UiComponent component;
  final String title;
  final String explanation;

  // chart
  final String? chartType; // bar | line | area | pie
  // table
  final List<TableColumn> columns;
  final List<Map<String, dynamic>> data;
  // metrics
  final List<MetricItem> metrics;
  // card
  final Map<String, dynamic>? cardDetails;

  // action (write tool) — see ToolCatalog
  final ToolCall? action;
  final List<String> missingFields;

  // navigate (drive Tier-3 WebView)
  final String? navigateTarget; // workspace id or route key
  final String? navigateUrl;

  // openDoc (launch Tier-2 generic form, pre-filled)
  final String? docType;
  final Map<String, dynamic>? docPrefill;

  // rag
  final List<Map<String, dynamic>> sources;

  // provenance
  final String dataSource; // live | cache | mock

  const UiDescriptor({
    required this.component,
    this.title = '',
    this.explanation = '',
    this.chartType,
    this.columns = const [],
    this.data = const [],
    this.metrics = const [],
    this.cardDetails,
    this.action,
    this.missingFields = const [],
    this.navigateTarget,
    this.navigateUrl,
    this.docType,
    this.docPrefill,
    this.sources = const [],
    this.dataSource = 'live',
  });

  /// Plain conversational reply.
  factory UiDescriptor.text(String explanation, {String title = ''}) =>
      UiDescriptor(
        component: UiComponent.text,
        title: title,
        explanation: explanation,
      );

  /// Tolerant parser — never throws on malformed AI output.
  factory UiDescriptor.fromJson(Map<String, dynamic> j) {
    final component = UiComponent.parse(j['component']?.toString());

    ToolCall? action;
    final actionType = j['actionType']?.toString();
    if (component == UiComponent.action && actionType != null && actionType.isNotEmpty) {
      action = ToolCall(
        tool: actionType,
        params: _asMap(j['actionParams']),
      );
    }

    return UiDescriptor(
      component: component,
      title: (j['title'] ?? '').toString(),
      explanation: (j['explanation'] ?? '').toString(),
      chartType: j['chartType']?.toString(),
      columns: _mapList(j['columns']).map(TableColumn.fromJson).toList(),
      data: _mapList(j['data']),
      metrics: _mapList(j['metrics']).map(MetricItem.fromJson).toList(),
      cardDetails: _asMapOrNull(j['cardDetails']),
      action: action,
      missingFields: _stringList(j['missingFields']),
      navigateTarget: j['target']?.toString(),
      navigateUrl: j['url']?.toString(),
      docType: (j['docType'] ?? j['doctype'])?.toString(),
      docPrefill: _asMapOrNull(j['docPrefill'] ?? j['prefill']),
      sources: _mapList(j['sources'] ?? j['chunks']),
      dataSource: (j['_dataSource'] ?? 'live').toString(),
    );
  }
}

// ── defensive json helpers (library-private, shared by the models above) ──
Map<String, dynamic> _asMap(Object? v) =>
    v is Map ? v.map((k, val) => MapEntry(k.toString(), val)) : {};

Map<String, dynamic>? _asMapOrNull(Object? v) =>
    v is Map ? v.map((k, val) => MapEntry(k.toString(), val)) : null;

List<Map<String, dynamic>> _mapList(Object? v) {
  if (v is! List) return const [];
  return v
      .whereType<Map>()
      .map((e) => e.map((k, val) => MapEntry(k.toString(), val)))
      .toList(growable: false);
}

List<String> _stringList(Object? v) =>
    v is List ? v.map((e) => e.toString()).toList(growable: false) : const [];
