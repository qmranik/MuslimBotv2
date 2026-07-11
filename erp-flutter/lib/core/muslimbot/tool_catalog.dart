/// The canonical MuslimBot tool catalog.
///
/// This mirrors the 21 voice-callable tools in
/// `Muslimbot-voice-agent/agent.py` so the mobile assistant, the web
/// generative-UI, and the voice worker all speak ONE schema. Reads render as
/// generative components; writes render as confirm-before-submit action cards.
/// See REBUILD_PLAN §1.2.
library;

enum ToolKind { read, write }

enum ParamType { text, integer, number, currency, boolean, json, date }

class ToolParam {
  final String name;
  final ParamType type;
  final bool required;
  final Object? defaultValue;
  final String? label;

  const ToolParam(
    this.name,
    this.type, {
    this.required = false,
    this.defaultValue,
    this.label,
  });

  String get displayLabel =>
      label ??
      name
          .split('_')
          .map((w) => w.isEmpty ? w : '${w[0].toUpperCase()}${w.substring(1)}')
          .join(' ');
}

class ToolSpec {
  final String name;
  final ToolKind kind;
  final String description;
  final List<ToolParam> params;

  const ToolSpec({
    required this.name,
    required this.kind,
    required this.description,
    this.params = const [],
  });

  bool get needsConfirmation => kind == ToolKind.write;

  List<ToolParam> get requiredParams =>
      params.where((p) => p.required).toList(growable: false);
}

/// Static registry. Keep in lockstep with `agent.py`.
class ToolCatalog {
  ToolCatalog._();

  static const List<ToolSpec> all = [
    // ─── Reads (instant, no confirmation) ────────────────────────────────
    ToolSpec(
      name: 'search_items',
      kind: ToolKind.read,
      description:
          'Search items/products in inventory by name, category or description.',
      params: [
        ToolParam('query', ParamType.text, required: true),
        ToolParam('limit', ParamType.integer, defaultValue: 5),
      ],
    ),
    ToolSpec(
      name: 'check_stock',
      kind: ToolKind.read,
      description: 'Check inventory levels for an item across warehouses.',
      params: [ToolParam('item_name', ParamType.text, required: true)],
    ),
    ToolSpec(
      name: 'sales_summary',
      kind: ToolKind.read,
      description: "Today's revenue and order count.",
    ),
    ToolSpec(
      name: 'get_recent_orders',
      kind: ToolKind.read,
      description: 'Recent invoices, optionally filtered by customer/status.',
      params: [
        ToolParam('customer', ParamType.text),
        ToolParam('status', ParamType.text),
        ToolParam('limit', ParamType.integer, defaultValue: 5),
      ],
    ),
    ToolSpec(
      name: 'search_customer',
      kind: ToolKind.read,
      description: 'Find customers by name or phone.',
      params: [ToolParam('query', ParamType.text, required: true)],
    ),
    ToolSpec(
      name: 'customer_history',
      kind: ToolKind.read,
      description: 'Purchase history and spending for a customer.',
      params: [
        ToolParam('customer_name', ParamType.text, required: true),
        ToolParam('limit', ParamType.integer, defaultValue: 5),
      ],
    ),
    ToolSpec(
      name: 'get_receivables',
      kind: ToolKind.read,
      description: 'Outstanding unpaid invoices (receivables).',
      params: [ToolParam('limit', ParamType.integer, defaultValue: 5)],
    ),
    ToolSpec(
      name: 'low_stock_alerts',
      kind: ToolKind.read,
      description: 'Items at or below reorder level.',
    ),
    ToolSpec(
      name: 'ask_business_ai',
      kind: ToolKind.read,
      description: 'Answer a complex business question via the n8n AI workflow.',
      params: [ToolParam('question', ParamType.text, required: true)],
    ),
    ToolSpec(
      name: 'list_events',
      kind: ToolKind.read,
      description: 'Upcoming calendar events.',
      params: [ToolParam('max_results', ParamType.integer, defaultValue: 5)],
    ),
    ToolSpec(
      name: 'system_status',
      kind: ToolKind.read,
      description: 'Current time plus ERP health.',
    ),
    ToolSpec(
      name: 'search_knowledge_base',
      kind: ToolKind.read,
      description: 'Search organization knowledge base for policies/FAQs (RAG).',
      params: [ToolParam('query', ParamType.text, required: true)],
    ),

    // ─── Writes (ALWAYS confirm before executing) ────────────────────────
    ToolSpec(
      name: 'create_order',
      kind: ToolKind.write,
      description: 'Create a sales invoice (regular or POS).',
      params: [
        ToolParam('customer', ParamType.text, required: true),
        ToolParam('items', ParamType.json, required: true),
        ToolParam('is_pos', ParamType.boolean, defaultValue: false),
      ],
    ),
    ToolSpec(
      name: 'submit_order',
      kind: ToolKind.write,
      description: 'Finalize (submit) a draft invoice.',
      params: [ToolParam('invoice_name', ParamType.text, required: true)],
    ),
    ToolSpec(
      name: 'record_payment',
      kind: ToolKind.write,
      description: 'Record a payment against an invoice.',
      params: [
        ToolParam('invoice_name', ParamType.text, required: true),
        ToolParam('amount', ParamType.currency, required: true),
        ToolParam('mode_of_payment', ParamType.text, defaultValue: 'Cash'),
      ],
    ),
    ToolSpec(
      name: 'create_customer',
      kind: ToolKind.write,
      description: 'Add a new customer.',
      params: [
        ToolParam('customer_name', ParamType.text, required: true),
        ToolParam('mobile_no', ParamType.text),
        ToolParam('customer_group', ParamType.text, defaultValue: 'Individual'),
      ],
    ),
    ToolSpec(
      name: 'create_item',
      kind: ToolKind.write,
      description: 'Add a new product/item with pricing.',
      params: [
        ToolParam('item_name', ParamType.text, required: true),
        ToolParam('rate', ParamType.currency, required: true),
        ToolParam('item_group', ParamType.text, defaultValue: 'Products'),
        ToolParam('stock_uom', ParamType.text, defaultValue: 'Nos'),
      ],
    ),
    ToolSpec(
      name: 'add_stock',
      kind: ToolKind.write,
      description: 'Add stock via material receipt.',
      params: [
        ToolParam('item_code', ParamType.text, required: true),
        ToolParam('qty', ParamType.number, required: true),
        ToolParam('warehouse', ParamType.text, defaultValue: 'Stores - LDI'),
      ],
    ),
    ToolSpec(
      name: 'trigger_workflow',
      kind: ToolKind.write,
      description: 'Run an n8n automation (alerts, summaries, reminders).',
      params: [
        ToolParam('workflow', ParamType.text, required: true),
        ToolParam('params', ParamType.json, defaultValue: '{}'),
      ],
    ),
    ToolSpec(
      name: 'send_notification',
      kind: ToolKind.write,
      description: 'Send an email/SMS/Slack notification via n8n.',
      params: [
        ToolParam('message', ParamType.text, required: true),
        ToolParam('channel', ParamType.text, defaultValue: 'email'),
        ToolParam('recipient', ParamType.text),
      ],
    ),
    ToolSpec(
      name: 'create_event',
      kind: ToolKind.write,
      description: 'Create a calendar event.',
      params: [
        ToolParam('summary', ParamType.text, required: true),
        ToolParam('start_time', ParamType.date, required: true),
        ToolParam('end_time', ParamType.date, required: true),
      ],
    ),
  ];

  static final Map<String, ToolSpec> _byName = {
    for (final t in all) t.name: t,
  };

  static ToolSpec? byName(String name) => _byName[name];

  static bool isWrite(String name) => byName(name)?.kind == ToolKind.write;

  static List<ToolSpec> get reads =>
      all.where((t) => t.kind == ToolKind.read).toList(growable: false);

  static List<ToolSpec> get writes =>
      all.where((t) => t.kind == ToolKind.write).toList(growable: false);
}
