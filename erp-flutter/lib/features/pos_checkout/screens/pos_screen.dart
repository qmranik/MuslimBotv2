import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/providers/api_provider.dart';
import '../../../core/theme/app_theme.dart';

class PosScreen extends StatefulWidget {
  const PosScreen({super.key});

  @override
  State<PosScreen> createState() => _PosScreenState();
}

class _PosScreenState extends State<PosScreen> {
  List<dynamic> _items = [];
  final List<Map<String, dynamic>> _cart = [];
  String _searchQuery = '';
  bool _loading = true;
  String? _error;
  String? _selectedCustomer;
  List<dynamic> _customers = [];

  @override
  void initState() {
    super.initState();
    _loadItems();
    _loadCustomers();
  }

  Future<void> _loadItems() async {
    setState(() => _loading = true);
    final api = context.read<ApiProvider>().client;
    if (api == null) return;
    try {
      final data = await api.callMethod(
          'small_erp.api.pos.search_pos_items',
          args: {'query': _searchQuery, 'limit': 50});
      setState(() {
        _items = data is List ? data : [];
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  Future<void> _loadCustomers() async {
    final api = context.read<ApiProvider>().client;
    if (api == null) return;
    try {
      final data = await api.callMethod(
          'small_erp.api.customers.get_customers',
          args: {'page_size': 100});
      if (data is Map && data['customers'] != null) {
        setState(() => _customers = data['customers']);
        if (_customers.isNotEmpty && _selectedCustomer == null) {
          _selectedCustomer = _customers[0]['name'];
        }
      }
    } catch (_) {}
  }

  void _addToCart(Map<String, dynamic> item) {
    setState(() {
      final idx = _cart.indexWhere((c) => c['item_code'] == item['item_code']);
      if (idx >= 0) {
        _cart[idx]['qty'] = (_cart[idx]['qty'] as num) + 1;
      } else {
        _cart.add({
          'item_code': item['item_code'],
          'item_name': item['item_name'],
          'rate': item['standard_rate'] ?? 0,
          'qty': 1,
        });
      }
    });
  }

  void _removeFromCart(int index) {
    setState(() => _cart.removeAt(index));
  }

  double get _cartTotal => _cart.fold(
      0, (sum, item) => sum + (item['rate'] as num) * (item['qty'] as num));

  Future<void> _checkout() async {
    if (_cart.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Cart is empty'), backgroundColor: AppTheme.warning),
      );
      return;
    }
    if (_selectedCustomer == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Select a customer'), backgroundColor: AppTheme.warning),
      );
      return;
    }

    final api = context.read<ApiProvider>().client;
    if (api == null) return;

    try {
      final result = await api.callMethod(
          'small_erp.api.pos.pos_checkout',
          args: {
            'customer': _selectedCustomer,
            'items_json': _cart
                .map((c) => {
                      'item_code': c['item_code'],
                      'qty': c['qty'],
                      'rate': c['rate']
                    })
                .toList(),
          });

      if (mounted) {
        setState(() => _cart.clear());
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Invoice ${result['invoice']} created! Total: ${result['grand_total']}'),
            backgroundColor: AppTheme.success,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Checkout failed: $e'), backgroundColor: AppTheme.danger),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Point of Sale'),
        actions: [
          if (_cart.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: Badge(
                label: Text('${_cart.length}'),
                child: IconButton(
                  icon: const Icon(Icons.shopping_cart),
                  onPressed: _showCartSheet,
                ),
              ),
            ),
        ],
      ),
      body: Column(
        children: [
          // Search bar
          Padding(
            padding: const EdgeInsets.all(12),
            child: TextField(
              decoration: InputDecoration(
                hintText: 'Search items...',
                prefixIcon: const Icon(Icons.search, color: AppTheme.textSecondary),
                suffixIcon: _searchQuery.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear),
                        onPressed: () {
                          setState(() => _searchQuery = '');
                          _loadItems();
                        })
                    : null,
              ),
              style: const TextStyle(color: AppTheme.textPrimary),
              onChanged: (val) {
                _searchQuery = val;
                _loadItems();
              },
            ),
          ),

          // Items grid
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _error != null
                    ? Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(_error!, style: const TextStyle(color: AppTheme.danger)),
                            const SizedBox(height: 8),
                            ElevatedButton(onPressed: _loadItems, child: const Text('Retry')),
                          ],
                        ))
                    : _items.isEmpty
                        ? const Center(child: Text('No items found', style: TextStyle(color: AppTheme.textSecondary)))
                        : GridView.builder(
                            padding: const EdgeInsets.symmetric(horizontal: 12),
                            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                              crossAxisCount: 2,
                              childAspectRatio: 0.85,
                              crossAxisSpacing: 10,
                              mainAxisSpacing: 10,
                            ),
                            itemCount: _items.length,
                            itemBuilder: (ctx, i) => _ItemCard(
                              item: _items[i],
                              onAdd: () => _addToCart(_items[i]),
                            ),
                          ),
          ),
        ],
      ),
      // Cart summary bar
      bottomNavigationBar: _cart.isNotEmpty
          ? Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: const BoxDecoration(
                color: AppTheme.surface,
                border: Border(top: BorderSide(color: AppTheme.border)),
              ),
              child: SafeArea(
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('${_cart.length} items',
                              style: const TextStyle(color: AppTheme.textSecondary, fontSize: 13)),
                          Text('\$${_cartTotal.toStringAsFixed(2)}',
                              style: const TextStyle(
                                  fontSize: 22, fontWeight: FontWeight.w700, color: AppTheme.textPrimary)),
                        ],
                      ),
                    ),
                    ElevatedButton.icon(
                      onPressed: _showCartSheet,
                      icon: const Icon(Icons.payment),
                      label: const Text('Checkout'),
                      style: ElevatedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
                      ),
                    ),
                  ],
                ),
              ),
            )
          : null,
    );
  }

  void _showCartSheet() {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppTheme.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) => Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                    color: AppTheme.border, borderRadius: BorderRadius.circular(2)),
              ),
              const SizedBox(height: 16),
              const Text('Cart',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600, color: AppTheme.textPrimary)),
              const SizedBox(height: 12),

              // Customer picker
              DropdownButtonFormField<String>(
                initialValue: _selectedCustomer,
                decoration: const InputDecoration(
                  labelText: 'Customer',
                  prefixIcon: Icon(Icons.person, color: AppTheme.textSecondary),
                ),
                dropdownColor: AppTheme.surfaceLight,
                style: const TextStyle(color: AppTheme.textPrimary),
                items: _customers.map<DropdownMenuItem<String>>((c) {
                  return DropdownMenuItem(
                    value: c['name'] as String,
                    child: Text(c['customer_name'] ?? c['name']),
                  );
                }).toList(),
                onChanged: (val) => setState(() => _selectedCustomer = val),
              ),
              const SizedBox(height: 12),

              // Cart items
              Flexible(
                child: ListView.builder(
                  shrinkWrap: true,
                  itemCount: _cart.length,
                  itemBuilder: (ctx, i) {
                    final item = _cart[i];
                    return ListTile(
                      title: Text(item['item_name'],
                          style: const TextStyle(color: AppTheme.textPrimary)),
                      subtitle: Text('${item['qty']} × \$${item['rate']}',
                          style: const TextStyle(color: AppTheme.textSecondary)),
                      trailing: IconButton(
                        icon: const Icon(Icons.delete_outline, color: AppTheme.danger),
                        onPressed: () {
                          _removeFromCart(i);
                          setSheetState(() {});
                          setState(() {});
                        },
                      ),
                    );
                  },
                ),
              ),

              const Divider(color: AppTheme.border),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Total',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: AppTheme.textPrimary)),
                  Text('\$${_cartTotal.toStringAsFixed(2)}',
                      style: const TextStyle(
                          fontSize: 22, fontWeight: FontWeight.w700, color: AppTheme.success)),
                ],
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                height: 52,
                child: ElevatedButton(
                  onPressed: () {
                    Navigator.pop(ctx);
                    _checkout();
                  },
                  style: ElevatedButton.styleFrom(backgroundColor: AppTheme.success),
                  child: const Text('Complete Sale', style: TextStyle(fontSize: 16)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ItemCard extends StatelessWidget {
  final dynamic item;
  final VoidCallback onAdd;
  const _ItemCard({required this.item, required this.onAdd});

  @override
  Widget build(BuildContext context) {
    final rate = item['standard_rate'] ?? 0;
    return Card(
      child: InkWell(
        onTap: onAdd,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Image placeholder
              Expanded(
                child: Container(
                  width: double.infinity,
                  decoration: BoxDecoration(
                    color: AppTheme.surfaceLight,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.inventory_2, size: 40, color: AppTheme.textSecondary),
                ),
              ),
              const SizedBox(height: 8),
              Text(
                item['item_name'] ?? item['item_code'] ?? 'Item',
                style: const TextStyle(
                    fontSize: 14, fontWeight: FontWeight.w600, color: AppTheme.textPrimary),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 4),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('\$$rate',
                      style: const TextStyle(
                          fontSize: 16, fontWeight: FontWeight.w700, color: AppTheme.accent)),
                  Container(
                    padding: const EdgeInsets.all(4),
                    decoration: BoxDecoration(
                      color: AppTheme.primary.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Icon(Icons.add, size: 18, color: AppTheme.primary),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
