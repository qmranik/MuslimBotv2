import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/providers/api_provider.dart';
import '../../../core/theme/app_theme.dart';

class OrdersScreen extends StatefulWidget {
  const OrdersScreen({super.key});

  @override
  State<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends State<OrdersScreen> {
  List<dynamic> _orders = [];
  bool _loading = true;
  String? _error;
  String _statusFilter = '';

  @override
  void initState() {
    super.initState();
    _loadOrders();
  }

  Future<void> _loadOrders() async {
    setState(() => _loading = true);
    final api = context.read<ApiProvider>().client;
    if (api == null) return;

    try {
      final data = await api.callMethod(
        'small_erp.api.orders.get_orders',
        args: {'status': _statusFilter, 'page_size': 30},
      );
      setState(() {
        _orders = data['orders'] ?? [];
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Orders'),
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: _loadOrders),
        ],
      ),
      body: Column(
        children: [
          // Status filter chips
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            child: Row(
              children: [
                _FilterChip(
                  label: 'All',
                  selected: _statusFilter == '',
                  onTap: () {
                    _statusFilter = '';
                    _loadOrders();
                  },
                ),
                const SizedBox(width: 8),
                _FilterChip(
                  label: 'Paid',
                  selected: _statusFilter == 'paid',
                  onTap: () {
                    _statusFilter = 'paid';
                    _loadOrders();
                  },
                ),
                const SizedBox(width: 8),
                _FilterChip(
                  label: 'Unpaid',
                  selected: _statusFilter == 'unpaid',
                  onTap: () {
                    _statusFilter = 'unpaid';
                    _loadOrders();
                  },
                ),
                const SizedBox(width: 8),
                _FilterChip(
                  label: 'Draft',
                  selected: _statusFilter == 'draft',
                  onTap: () {
                    _statusFilter = 'draft';
                    _loadOrders();
                  },
                ),
              ],
            ),
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _error != null
                    ? Center(child: Text(_error!, style: const TextStyle(color: AppTheme.danger)))
                    : RefreshIndicator(
                        onRefresh: _loadOrders,
                        child: _orders.isEmpty
                            ? const Center(
                                child: Text('No orders found',
                                    style: TextStyle(color: AppTheme.textSecondary)))
                            : ListView.builder(
                                padding: const EdgeInsets.symmetric(horizontal: 12),
                                itemCount: _orders.length,
                                itemBuilder: (ctx, i) => _OrderTile(order: _orders[i]),
                              ),
                      ),
          ),
        ],
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;
  const _FilterChip({required this.label, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return ChoiceChip(
      label: Text(label),
      selected: selected,
      onSelected: (_) => onTap(),
      selectedColor: AppTheme.primary,
      backgroundColor: AppTheme.surfaceLight,
      labelStyle: TextStyle(
        color: selected ? Colors.white : AppTheme.textSecondary,
        fontWeight: FontWeight.w500,
      ),
      side: BorderSide(color: selected ? AppTheme.primary : AppTheme.border),
    );
  }
}

class _OrderTile extends StatelessWidget {
  final dynamic order;
  const _OrderTile({required this.order});

  @override
  Widget build(BuildContext context) {
    final outstanding = (order['outstanding_amount'] ?? 0) as num;
    final grandTotal = (order['grand_total'] ?? 0) as num;
    final isPaid = outstanding <= 0 && (order['docstatus'] ?? 0) == 1;
    final isDraft = (order['docstatus'] ?? 0) == 0;

    Color statusColor = isPaid
        ? AppTheme.success
        : isDraft
            ? AppTheme.textSecondary
            : AppTheme.warning;
    String statusText = isPaid
        ? 'Paid'
        : isDraft
            ? 'Draft'
            : 'Unpaid';

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        leading: Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            color: statusColor.withValues(alpha: 0.15),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(Icons.receipt_long, color: statusColor, size: 22),
        ),
        title: Text(
          order['name'] ?? '',
          style: const TextStyle(fontWeight: FontWeight.w600, color: AppTheme.textPrimary, fontSize: 14),
        ),
        subtitle: Text(
          '${order['customer_name'] ?? order['customer'] ?? ''} · ${order['posting_date'] ?? ''}',
          style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary),
        ),
        trailing: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text('\$${grandTotal.toStringAsFixed(2)}',
                style: const TextStyle(fontWeight: FontWeight.w700, color: AppTheme.textPrimary)),
            const SizedBox(height: 4),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: statusColor.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(statusText,
                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: statusColor)),
            ),
          ],
        ),
      ),
    );
  }
}
