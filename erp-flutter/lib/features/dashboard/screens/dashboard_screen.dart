import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/providers/api_provider.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/routing/app_router.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  Map<String, dynamic>? _kpis;
  List<dynamic>? _activity;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadDashboard();
  }

  Future<void> _loadDashboard() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    final api = context.read<ApiProvider>().client;
    if (api == null) return;

    try {
      final results = await Future.wait([
        api.callMethod('small_erp.api.dashboard.get_dashboard_kpis'),
        api.callMethod('small_erp.api.dashboard.get_recent_activity',
            args: {'limit': 10}),
      ]);
      setState(() {
        _kpis = results[0] as Map<String, dynamic>?;
        _activity = results[1] as List<dynamic>?;
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
        title: const Text('Dashboard'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadDashboard,
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? _buildError()
              : RefreshIndicator(
                  onRefresh: _loadDashboard,
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      _buildKpiGrid(),
                      const SizedBox(height: 20),
                      _buildQuickActions(),
                      const SizedBox(height: 20),
                      _buildActivityFeed(),
                    ],
                  ),
                ),
    );
  }

  Widget _buildError() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.cloud_off, size: 64, color: AppTheme.danger),
            const SizedBox(height: 16),
            Text(_error!, style: const TextStyle(color: AppTheme.danger),
                textAlign: TextAlign.center),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: _loadDashboard,
              child: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildKpiGrid() {
    if (_kpis == null) return const SizedBox.shrink();
    final items = <_KpiData>[
      _KpiData('Revenue', _kpis!['revenue']?['formatted'] ?? '\$0',
          Icons.trending_up, AppTheme.success),
      _KpiData('Orders', '${_kpis!['orders']?['value'] ?? 0}',
          Icons.receipt_long, AppTheme.primary),
      _KpiData('Pending', '${_kpis!['pending']?['value'] ?? 0}',
          Icons.hourglass_bottom, AppTheme.warning),
      _KpiData('Low Stock', '${_kpis!['low_stock']?['value'] ?? 0}',
          Icons.inventory_2, (_kpis!['low_stock']?['value'] ?? 0) > 0 ? AppTheme.danger : AppTheme.success),
      _KpiData('Receivable', _kpis!['receivable']?['formatted'] ?? '\$0',
          Icons.account_balance_wallet, AppTheme.accent),
      _KpiData('Customers', '${_kpis!['customers']?['value'] ?? 0}',
          Icons.people, AppTheme.primary),
    ];

    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        childAspectRatio: 1.6,
        crossAxisSpacing: 12,
        mainAxisSpacing: 12,
      ),
      itemCount: items.length,
      itemBuilder: (ctx, i) => _KpiCard(data: items[i]),
    );
  }

  Widget _buildQuickActions() {
    return Wrap(
      spacing: 10,
      runSpacing: 10,
      children: [
        _QuickActionChip(
          icon: Icons.add_shopping_cart,
          label: 'New Sale',
          color: AppTheme.primary,
          onTap: () {
            // Navigate to POS tab (index 1)
            final nav = context.findAncestorStateOfType<AppHomeState>();
            nav?.onTabTapped(1);
          },
        ),
        _QuickActionChip(
          icon: Icons.inventory,
          label: 'Stock',
          color: AppTheme.accent,
          onTap: () {
            final nav = context.findAncestorStateOfType<AppHomeState>();
            nav?.onTabTapped(2);
          },
        ),
        _QuickActionChip(
          icon: Icons.person_add,
          label: 'Add Customer',
          color: AppTheme.success,
          onTap: () {
            final nav = context.findAncestorStateOfType<AppHomeState>();
            nav?.onTabTapped(3);
          },
        ),
      ],
    );
  }

  Widget _buildActivityFeed() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Recent Activity',
                style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                    color: AppTheme.textPrimary)),
            const SizedBox(height: 12),
            if (_activity == null || _activity!.isEmpty)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 24),
                child: Center(
                  child: Text('No recent activity',
                      style: TextStyle(color: AppTheme.textSecondary)),
                ),
              )
            else
              ...(_activity!.take(8).map((item) => _ActivityRow(
                    title: item['title'] ?? '',
                    detail: item['detail'] ?? '',
                    icon: _mapIcon(item['icon']),
                  ))),
          ],
        ),
      ),
    );
  }

  IconData _mapIcon(String? iconName) {
    switch (iconName) {
      case 'receipt':
        return Icons.receipt_long;
      case 'package':
        return Icons.inventory_2;
      case 'user':
        return Icons.person;
      default:
        return Icons.circle;
    }
  }
}

// ── Reusable widgets ──────────────────────────────────────────────

class _KpiData {
  final String label;
  final String value;
  final IconData icon;
  final Color color;
  _KpiData(this.label, this.value, this.icon, this.color);
}

class _KpiCard extends StatelessWidget {
  final _KpiData data;
  const _KpiCard({required this.data});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: data.color.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(data.icon, color: data.color, size: 20),
            ),
            const Spacer(),
            Text(data.value,
                style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w700,
                    color: AppTheme.textPrimary)),
            const SizedBox(height: 2),
            Text(data.label,
                style: const TextStyle(
                    fontSize: 12, color: AppTheme.textSecondary)),
          ],
        ),
      ),
    );
  }
}

class _QuickActionChip extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;
  const _QuickActionChip(
      {required this.icon,
      required this.label,
      required this.color,
      required this.onTap});

  @override
  Widget build(BuildContext context) {
    return ActionChip(
      avatar: Icon(icon, color: color, size: 18),
      label: Text(label),
      onPressed: onTap,
      backgroundColor: color.withValues(alpha: 0.1),
      side: BorderSide(color: color.withValues(alpha: 0.3)),
      labelStyle: TextStyle(color: color, fontWeight: FontWeight.w500),
    );
  }
}

class _ActivityRow extends StatelessWidget {
  final String title;
  final String detail;
  final IconData icon;
  const _ActivityRow(
      {required this.title, required this.detail, required this.icon});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: AppTheme.surfaceLight,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, size: 18, color: AppTheme.accent),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title,
                    style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w500,
                        color: AppTheme.textPrimary)),
                Text(detail,
                    style: const TextStyle(
                        fontSize: 12, color: AppTheme.textSecondary)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}


