import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/providers/api_provider.dart';
import '../../../core/theme/app_theme.dart';

class InventoryListScreen extends StatefulWidget {
  const InventoryListScreen({super.key});

  @override
  State<InventoryListScreen> createState() => _InventoryListScreenState();
}

class _InventoryListScreenState extends State<InventoryListScreen> {
  List<dynamic> _items = [];
  bool _loading = true;
  String? _error;
  String _search = '';
  int _page = 1;
  int _totalPages = 1;

  @override
  void initState() {
    super.initState();
    _loadItems();
  }

  Future<void> _loadItems() async {
    setState(() => _loading = true);
    final api = context.read<ApiProvider>().client;
    if (api == null) return;

    try {
      final data = await api.callMethod(
        'small_erp.api.inventory.get_items',
        args: {'search': _search, 'page': _page, 'page_size': 20},
      );
      setState(() {
        _items = data['items'] ?? [];
        _totalPages = data['total_pages'] ?? 1;
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
        title: const Text('Inventory'),
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: _loadItems),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(12),
            child: TextField(
              decoration: const InputDecoration(
                hintText: 'Search items...',
                prefixIcon: Icon(Icons.search, color: AppTheme.textSecondary),
              ),
              style: const TextStyle(color: AppTheme.textPrimary),
              onChanged: (val) {
                _search = val;
                _page = 1;
                _loadItems();
              },
            ),
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _error != null
                    ? Center(child: Text(_error!, style: const TextStyle(color: AppTheme.danger)))
                    : RefreshIndicator(
                        onRefresh: _loadItems,
                        child: ListView.builder(
                          padding: const EdgeInsets.symmetric(horizontal: 12),
                          itemCount: _items.length,
                          itemBuilder: (ctx, i) => _InventoryItemTile(item: _items[i]),
                        ),
                      ),
          ),
          if (_totalPages > 1)
            Padding(
              padding: const EdgeInsets.all(12),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  IconButton(
                    icon: const Icon(Icons.chevron_left),
                    onPressed: _page > 1
                        ? () {
                            _page--;
                            _loadItems();
                          }
                        : null,
                  ),
                  Text('Page $_page of $_totalPages',
                      style: const TextStyle(color: AppTheme.textSecondary)),
                  IconButton(
                    icon: const Icon(Icons.chevron_right),
                    onPressed: _page < _totalPages
                        ? () {
                            _page++;
                            _loadItems();
                          }
                        : null,
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _InventoryItemTile extends StatelessWidget {
  final dynamic item;
  const _InventoryItemTile({required this.item});

  @override
  Widget build(BuildContext context) {
    final qty = item['actual_qty'] ?? item['available_qty'] ?? 0;
    final rate = item['standard_rate'] ?? 0;
    final isLow = (qty is num) && qty <= 5;

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        leading: Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            color: AppTheme.surfaceLight,
            borderRadius: BorderRadius.circular(12),
          ),
          child: const Icon(Icons.inventory_2, color: AppTheme.accent, size: 22),
        ),
        title: Text(
          item['item_name'] ?? item['name'] ?? '',
          style: const TextStyle(fontWeight: FontWeight.w600, color: AppTheme.textPrimary),
        ),
        subtitle: Text(
          '${item['item_group'] ?? ''} · ${item['stock_uom'] ?? ''}',
          style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary),
        ),
        trailing: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text('\$$rate',
                style: const TextStyle(fontWeight: FontWeight.w600, color: AppTheme.textPrimary)),
            const SizedBox(height: 2),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: isLow
                    ? AppTheme.danger.withValues(alpha: 0.15)
                    : AppTheme.success.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                'Qty: $qty',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: isLow ? AppTheme.danger : AppTheme.success,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
