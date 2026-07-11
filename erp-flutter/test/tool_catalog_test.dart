import 'package:flutter_test/flutter_test.dart';
import 'package:small_erp/core/muslimbot/tool_catalog.dart';

void main() {
  group('ToolCatalog', () {
    test('holds all 21 MuslimBot tools', () {
      expect(ToolCatalog.all.length, 21);
    });

    test('12 reads + 9 writes', () {
      expect(ToolCatalog.reads.length, 12);
      expect(ToolCatalog.writes.length, 9);
    });

    test('tool names are unique', () {
      final names = ToolCatalog.all.map((t) => t.name).toSet();
      expect(names.length, ToolCatalog.all.length);
    });

    test('reads never require confirmation; writes always do', () {
      for (final t in ToolCatalog.reads) {
        expect(t.needsConfirmation, isFalse, reason: t.name);
      }
      for (final t in ToolCatalog.writes) {
        expect(t.needsConfirmation, isTrue, reason: t.name);
      }
    });

    test('lookup + isWrite work for known/unknown tools', () {
      expect(ToolCatalog.byName('create_order')?.kind, ToolKind.write);
      expect(ToolCatalog.isWrite('create_order'), isTrue);
      expect(ToolCatalog.isWrite('search_items'), isFalse);
      expect(ToolCatalog.byName('does_not_exist'), isNull);
    });

    test('canonical write tools are present (agent.py parity)', () {
      const expected = {
        'create_order',
        'submit_order',
        'record_payment',
        'create_customer',
        'create_item',
        'add_stock',
        'trigger_workflow',
        'send_notification',
        'create_event',
      };
      expect(ToolCatalog.writes.map((t) => t.name).toSet(), expected);
    });

    test('param display labels are humanized', () {
      final p = ToolCatalog.byName('record_payment')!.params
          .firstWhere((p) => p.name == 'invoice_name');
      expect(p.displayLabel, 'Invoice Name');
    });
  });
}
