import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/auth/auth_controller.dart';
import '../../core/auth/persona.dart';
import '../../core/config/app_config.dart';
import '../../core/models/ui_descriptor.dart';
import '../../core/muslimbot/muslimbot_client.dart';
import '../../core/muslimbot/persona.dart';
import '../../core/muslimbot/persona_mode.dart';
import '../../core/theme/app_theme.dart';

/// Opens the MuslimBot assistant as a draggable bottom sheet.
Future<void> showAssistantSheet(BuildContext context) {
  return showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => const AssistantSheet(),
  );
}

/// Chat UI shell. In P1 it presents the MuslimBot persona, quick prompts and a
/// composer; the intent router / generative renderer / voice are wired in P3–P4
/// (see REBUILD_PLAN §5.3). Kept as reusable scaffolding, not throwaway.
class AssistantSheet extends StatefulWidget {
  const AssistantSheet({super.key});

  @override
  State<AssistantSheet> createState() => _AssistantSheetState();
}

class _AssistantSheetState extends State<AssistantSheet> {
  final _controller = TextEditingController();
  final List<_Msg> _messages = [];
  bool _sending = false;

  static const _quickPrompts = [
    "Today's sales",
    'Low stock alerts',
    'Overdue receivables',
    'Open accounting',
    'New sale',
    'Search knowledge base',
  ];

  @override
  void initState() {
    super.initState();
    _messages.add(_Msg(sender: _Sender.bot, text: MuslimBot.greeting));
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _send([String? preset]) async {
    final text = (preset ?? _controller.text).trim();
    if (text.isEmpty || _sending) return;

    final auth = context.read<AuthController>();
    final config = context.read<AppConfig>();
    final personaMode = auth.persona == Persona.customer
        ? PersonaMode.supportAndOrdering
        : PersonaMode.full;

    setState(() {
      _messages.add(_Msg(sender: _Sender.user, text: text));
      _controller.clear();
      _sending = true;
    });

    final history = _messages
        .where((m) => m.text.isNotEmpty)
        .map((m) => {
              'sender': m.sender == _Sender.user ? 'user' : 'ai',
              'text': m.text,
            })
        .toList();

    final client = MuslimBotClient(config: config, session: auth.session);
    final UiDescriptor d =
        await client.generateUi(text, history: history, personaMode: personaMode);

    if (!mounted) return;
    setState(() {
      _messages.add(_Msg(sender: _Sender.bot, text: _describe(d)));
      _sending = false;
    });
  }

  /// Compact rendering until the full generative widget set lands (P3).
  String _describe(UiDescriptor d) {
    switch (d.component) {
      case UiComponent.text:
      case UiComponent.rag:
        return d.explanation.isEmpty ? '…' : d.explanation;
      case UiComponent.action:
        final tool = d.action?.tool ?? 'action';
        final missing = d.missingFields.isEmpty
            ? ''
            : '\nNeeds: ${d.missingFields.join(', ')}';
        return '${d.explanation}\n\n[Confirm $tool to proceed]$missing';
      case UiComponent.navigate:
        return '${d.explanation}\n\n[Open ${d.navigateTarget ?? d.navigateUrl ?? 'ERP'}]';
      case UiComponent.openDoc:
        return '${d.explanation}\n\n[Open ${d.docType ?? 'document'} form]';
      case UiComponent.metrics:
        final m = d.metrics
            .map((e) => '• ${e.label}: ${e.value}')
            .join('\n');
        return '${d.title}\n$m';
      case UiComponent.table:
        return '${d.title} — ${d.data.length} rows${d.explanation.isNotEmpty ? '\n${d.explanation}' : ''}';
      case UiComponent.chart:
        return '${d.title} (${d.chartType ?? 'chart'})\n${d.explanation}';
      case UiComponent.card:
        return d.explanation;
      case UiComponent.flow:
        return '${d.explanation}\n\n[Start guided steps]';
    }
  }

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.7,
      minChildSize: 0.4,
      maxChildSize: 0.95,
      expand: false,
      builder: (context, scrollController) {
        return Container(
          decoration: BoxDecoration(
            color: Theme.of(context).colorScheme.surface,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
          ),
          child: Column(
            children: [
              const SizedBox(height: 10),
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: AppTheme.border,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              _header(context),
              const Divider(height: 1),
              Expanded(
                child: ListView.builder(
                  controller: scrollController,
                  padding: const EdgeInsets.all(16),
                  itemCount: _messages.length,
                  itemBuilder: (_, i) => _Bubble(msg: _messages[i]),
                ),
              ),
              _quickChips(),
              _composer(context),
            ],
          ),
        );
      },
    );
  }

  Widget _header(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 8, 8),
      child: Row(
        children: [
          Container(
            width: 30,
            height: 30,
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                  colors: [AppTheme.primary, AppTheme.accent]),
              borderRadius: BorderRadius.circular(9),
            ),
            child: const Icon(Icons.auto_awesome, size: 17, color: Colors.white),
          ),
          const SizedBox(width: 10),
          const Text('MuslimBot',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
          const Spacer(),
          IconButton(
            tooltip: 'Voice (coming soon)',
            icon: const Icon(Icons.mic_none_rounded),
            onPressed: () => ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Voice call arrives in P4')),
            ),
          ),
          IconButton(
            icon: const Icon(Icons.close),
            onPressed: () => Navigator.of(context).pop(),
          ),
        ],
      ),
    );
  }

  Widget _quickChips() {
    return SizedBox(
      height: 44,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: _quickPrompts.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (_, i) => ActionChip(
          label: Text(_quickPrompts[i]),
          onPressed: () => _send(_quickPrompts[i]),
        ),
      ),
    );
  }

  Widget _composer(BuildContext context) {
    return SafeArea(
      top: false,
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          16,
          8,
          16,
          8 + MediaQuery.of(context).viewInsets.bottom,
        ),
        child: Row(
          children: [
            Expanded(
              child: TextField(
                controller: _controller,
                enabled: !_sending,
                textInputAction: TextInputAction.send,
                onSubmitted: (_) => _send(),
                decoration: const InputDecoration(
                  hintText: 'Ask MuslimBot…',
                  isDense: true,
                ),
              ),
            ),
            const SizedBox(width: 8),
            IconButton.filled(
              onPressed: _sending ? null : () => _send(),
              icon: _sending
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.arrow_upward_rounded),
            ),
          ],
        ),
      ),
    );
  }
}

enum _Sender { user, bot }

class _Msg {
  final _Sender sender;
  final String text;
  _Msg({required this.sender, required this.text});
}

class _Bubble extends StatelessWidget {
  final _Msg msg;
  const _Bubble({required this.msg});

  @override
  Widget build(BuildContext context) {
    final isUser = msg.sender == _Sender.user;
    return Align(
      alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 4),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        constraints: BoxConstraints(
          maxWidth: MediaQuery.of(context).size.width * 0.78,
        ),
        decoration: BoxDecoration(
          color: isUser
              ? AppTheme.primary
              : Theme.of(context).colorScheme.surface == AppTheme.surface
                  ? AppTheme.surfaceLight
                  : const Color(0xFFEFEFF6),
          borderRadius: BorderRadius.circular(14),
        ),
        child: Text(
          msg.text,
          style: TextStyle(
            color: isUser ? Colors.white : null,
            height: 1.35,
          ),
        ),
      ),
    );
  }
}
