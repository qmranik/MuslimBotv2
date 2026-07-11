import '../muslimbot/tool_catalog.dart';

/// A concrete, proposed invocation of a catalog tool with parameters.
///
/// Produced by the assistant (an `action` descriptor) and executed against the
/// ERP after user confirmation for writes. See REBUILD_PLAN §5.
class ToolCall {
  final String tool;
  final Map<String, dynamic> params;

  const ToolCall({required this.tool, this.params = const {}});

  ToolSpec? get spec => ToolCatalog.byName(tool);

  bool get isWrite => ToolCatalog.isWrite(tool);

  bool get needsConfirmation => spec?.needsConfirmation ?? true;

  /// Required params that are absent or blank — drives the "missing fields"
  /// prompt on an action card before it can be submitted.
  List<String> get missingRequired {
    final s = spec;
    if (s == null) return const [];
    return s.requiredParams
        .where((p) {
          final v = params[p.name];
          return v == null || (v is String && v.trim().isEmpty);
        })
        .map((p) => p.name)
        .toList(growable: false);
  }

  bool get isComplete => missingRequired.isEmpty;

  ToolCall copyWith({Map<String, dynamic>? params}) =>
      ToolCall(tool: tool, params: params ?? this.params);

  ToolCall withParam(String key, dynamic value) =>
      copyWith(params: {...params, key: value});

  Map<String, dynamic> toJson() => {'tool': tool, 'params': params};

  @override
  String toString() => 'ToolCall($tool, $params)';
}
