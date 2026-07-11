import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/providers/api_provider.dart';
import '../../../core/theme/app_theme.dart';

class CustomerListScreen extends StatefulWidget {
  const CustomerListScreen({super.key});

  @override
  State<CustomerListScreen> createState() => _CustomerListScreenState();
}

class _CustomerListScreenState extends State<CustomerListScreen> {
  List<dynamic> _customers = [];
  bool _loading = true;
  String? _error;
  String _search = '';

  @override
  void initState() {
    super.initState();
    _loadCustomers();
  }

  Future<void> _loadCustomers() async {
    setState(() => _loading = true);
    final api = context.read<ApiProvider>().client;
    if (api == null) return;

    try {
      final data = await api.callMethod(
        'small_erp.api.customers.get_customers',
        args: {'search': _search, 'page_size': 50},
      );
      setState(() {
        _customers = data['customers'] ?? [];
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  void _showAddCustomerDialog() {
    final nameCtrl = TextEditingController();
    final mobileCtrl = TextEditingController();
    final emailCtrl = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppTheme.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('New Customer', style: TextStyle(color: AppTheme.textPrimary)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: nameCtrl,
              decoration: const InputDecoration(labelText: 'Customer Name'),
              style: const TextStyle(color: AppTheme.textPrimary),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: mobileCtrl,
              decoration: const InputDecoration(labelText: 'Mobile'),
              style: const TextStyle(color: AppTheme.textPrimary),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: emailCtrl,
              decoration: const InputDecoration(labelText: 'Email'),
              style: const TextStyle(color: AppTheme.textPrimary),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(ctx);
              await _createCustomer(nameCtrl.text, mobileCtrl.text, emailCtrl.text);
            },
            child: const Text('Create'),
          ),
        ],
      ),
    );
  }

  Future<void> _createCustomer(String name, String mobile, String email) async {
    final api = context.read<ApiProvider>().client;
    if (api == null) return;

    try {
      await api.callMethod(
        'small_erp.api.customers.create_customer',
        args: {
          'customer_name': name,
          'mobile_no': mobile,
          'email_id': email,
        },
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Customer created'), backgroundColor: AppTheme.success),
      );
      _loadCustomers();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: $e'), backgroundColor: AppTheme.danger),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Customers'),
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: _loadCustomers),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: _showAddCustomerDialog,
        child: const Icon(Icons.person_add),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(12),
            child: TextField(
              decoration: const InputDecoration(
                hintText: 'Search customers...',
                prefixIcon: Icon(Icons.search, color: AppTheme.textSecondary),
              ),
              style: const TextStyle(color: AppTheme.textPrimary),
              onChanged: (val) {
                _search = val;
                _loadCustomers();
              },
            ),
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _error != null
                    ? Center(child: Text(_error!, style: const TextStyle(color: AppTheme.danger)))
                    : RefreshIndicator(
                        onRefresh: _loadCustomers,
                        child: ListView.builder(
                          padding: const EdgeInsets.symmetric(horizontal: 12),
                          itemCount: _customers.length,
                          itemBuilder: (ctx, i) => _CustomerTile(customer: _customers[i]),
                        ),
                      ),
          ),
        ],
      ),
    );
  }
}

class _CustomerTile extends StatelessWidget {
  final dynamic customer;
  const _CustomerTile({required this.customer});

  @override
  Widget build(BuildContext context) {
    final name = customer['customer_name'] ?? customer['name'] ?? '';
    final mobile = customer['mobile_no'] ?? '';
    final orders = customer['total_orders'] ?? 0;
    final outstanding = customer['outstanding'] ?? 0;

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        leading: CircleAvatar(
          backgroundColor: AppTheme.primary.withValues(alpha: 0.15),
          child: Text(
            name.isNotEmpty ? name[0].toUpperCase() : '?',
            style: const TextStyle(color: AppTheme.primary, fontWeight: FontWeight.w700),
          ),
        ),
        title: Text(name,
            style: const TextStyle(fontWeight: FontWeight.w600, color: AppTheme.textPrimary)),
        subtitle: Text(
          '${customer['customer_group'] ?? 'Retail'}${mobile.isNotEmpty ? ' · $mobile' : ''}',
          style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary),
        ),
        trailing: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text('$orders orders',
                style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary)),
            if (outstanding > 0)
              Text('\$$outstanding due',
                  style: const TextStyle(
                      fontSize: 12, fontWeight: FontWeight.w600, color: AppTheme.warning)),
          ],
        ),
      ),
    );
  }
}
