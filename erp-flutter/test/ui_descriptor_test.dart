import 'package:flutter_test/flutter_test.dart';
import 'package:small_erp/core/models/ui_descriptor.dart';
import 'package:small_erp/core/models/tool_call.dart';

void main() {
  group('UiDescriptor.fromJson', () {
    test('parses a table descriptor (web schema)', () {
      final d = UiDescriptor.fromJson({
        'component': 'table',
        'title': 'Overdue Invoices',
        'columns': [
          {'key': 'name', 'label': 'Invoice'},
          {'key': 'amount', 'label': 'Amount'},
        ],
        'data': [
          {'name': 'INV-1', 'amount': 100},
        ],
        'explanation': '1 record',
        '_dataSource': 'live',
      });

      expect(d.component, UiComponent.table);
      expect(d.columns.length, 2);
      expect(d.columns.first.label, 'Invoice');
      expect(d.data.single['name'], 'INV-1');
      expect(d.dataSource, 'live');
    });

    test('parses an action descriptor into a ToolCall', () {
      final d = UiDescriptor.fromJson({
        'component': 'action',
        'actionType': 'create_customer',
        'actionParams': {'customer_name': 'Ahmed Pharma'},
        'missingFields': ['mobile_no'],
      });

      expect(d.component, UiComponent.action);
      final ToolCall call = d.action!;
      expect(call.tool, 'create_customer');
      expect(call.isWrite, isTrue);
      expect(call.needsConfirmation, isTrue);
      expect(call.params['customer_name'], 'Ahmed Pharma');
    });

    test('parses the navigate extension', () {
      final d = UiDescriptor.fromJson({
        'component': 'navigate',
        'target': 'erp-ops',
        'url': 'http://localhost:8000/ops/accounting',
      });
      expect(d.component, UiComponent.navigate);
      expect(d.navigateTarget, 'erp-ops');
      expect(d.navigateUrl, contains('/ops/accounting'));
    });

    test('parses the openDoc extension', () {
      final d = UiDescriptor.fromJson({
        'component': 'open_doc',
        'doctype': 'Purchase Order',
        'prefill': {'supplier': 'ACME'},
      });
      expect(d.component, UiComponent.openDoc);
      expect(d.docType, 'Purchase Order');
      expect(d.docPrefill!['supplier'], 'ACME');
    });

    test('unknown component falls back to text; never throws', () {
      final d = UiDescriptor.fromJson({'component': 'wormhole'});
      expect(d.component, UiComponent.text);
    });

    test('tolerates malformed / missing fields', () {
      final d = UiDescriptor.fromJson({
        'component': 'table',
        'columns': 'not-a-list',
        'data': null,
        'metrics': [42, 'junk'],
      });
      expect(d.columns, isEmpty);
      expect(d.data, isEmpty);
      expect(d.metrics, isEmpty);
    });
  });

  group('ToolCall validation', () {
    test('reports missing required params', () {
      const call = ToolCall(tool: 'record_payment', params: {
        'invoice_name': 'INV-1',
        // amount missing
      });
      expect(call.missingRequired, contains('amount'));
      expect(call.isComplete, isFalse);
    });

    test('is complete once all required params present', () {
      const call = ToolCall(tool: 'record_payment', params: {
        'invoice_name': 'INV-1',
        'amount': 500,
      });
      expect(call.isComplete, isTrue);
    });

    test('withParam is immutable and additive', () {
      const call = ToolCall(tool: 'create_customer', params: {});
      final next = call.withParam('customer_name', 'Zed');
      expect(call.params, isEmpty);
      expect(next.params['customer_name'], 'Zed');
    });
  });
}
