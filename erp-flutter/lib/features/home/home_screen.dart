import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_controller.dart';
import '../../core/auth/persona.dart';
import '../../core/muslimbot/persona.dart';
import '../../core/theme/app_theme.dart';

/// Persona-aware native landing surface. Bespoke Tier-1 dashboards land in P5;
/// this establishes the shell, greeting and quick-action grid per persona.
class HomeScreen extends StatelessWidget {
  final VoidCallback? onOpenAssistant;
  const HomeScreen({super.key, this.onOpenAssistant});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthController>();
    final persona = auth.persona;
    final name = auth.session?.displayName ?? 'there';

    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            const _BrandDot(),
            const SizedBox(width: 10),
            Text('${MuslimBot.name} · ${persona.label}'),
          ],
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text('Assalamu alaikum, $name',
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                  )),
          const SizedBox(height: 4),
          Text(
            _subtitleFor(persona),
            style: TextStyle(color: Theme.of(context).hintColor),
          ),
          const SizedBox(height: 20),
          _AssistantCta(onTap: onOpenAssistant),
          const SizedBox(height: 20),
          Text('Quick actions',
              style: Theme.of(context)
                  .textTheme
                  .titleMedium
                  ?.copyWith(fontWeight: FontWeight.w600)),
          const SizedBox(height: 12),
          _QuickGrid(
            actions: _actionsFor(persona),
            onOpenAssistant: onOpenAssistant,
          ),
        ],
      ),
    );
  }

  String _subtitleFor(Persona p) => switch (p) {
        Persona.owner => 'Your business at a glance. Ask MuslimBot anything.',
        Persona.employee => 'Get things done — orders, stock, customers.',
        Persona.customer => 'Browse, order, and get support in one place.',
      };

  List<_QuickAction> _actionsFor(Persona p) => switch (p) {
        Persona.owner => const [
            _QuickAction('Ask MuslimBot', Icons.auto_awesome, AppTheme.primary, isAssistant: true),
            _QuickAction('Explore data', Icons.grid_view_rounded, AppTheme.accent, route: '/customers'),
            _QuickAction('Open ERP desk', Icons.dashboard_rounded, AppTheme.success, route: '/portal'),
            _QuickAction('Receivables', Icons.account_balance_wallet, AppTheme.warning, route: '/orders'),
          ],
        Persona.employee => const [
            _QuickAction('New sale', Icons.point_of_sale_rounded, AppTheme.primary, route: '/pos'),
            _QuickAction('Check stock', Icons.inventory_2_rounded, AppTheme.accent, route: '/inventory'),
            _QuickAction('Customers', Icons.people_rounded, AppTheme.success, route: '/customers'),
            _QuickAction('Open ERP desk', Icons.dashboard_rounded, AppTheme.warning, route: '/portal'),
          ],
        Persona.customer => const [
            _QuickAction('Browse catalog', Icons.storefront_rounded, AppTheme.primary, route: '/inventory'),
            _QuickAction('My orders', Icons.receipt_long_rounded, AppTheme.accent, route: '/orders'),
            _QuickAction('Get support', Icons.support_agent_rounded, AppTheme.success, isAssistant: true),
            _QuickAction('Ask a question', Icons.auto_awesome, AppTheme.warning, isAssistant: true),
          ],
      };
}

class _AssistantCta extends StatelessWidget {
  final VoidCallback? onTap;
  const _AssistantCta({this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [AppTheme.primary, AppTheme.accent],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(16),
        ),
        child: const Row(
          children: [
            Icon(Icons.auto_awesome, color: Colors.white, size: 28),
            SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Ask MuslimBot',
                      style: TextStyle(
                          color: Colors.white,
                          fontSize: 17,
                          fontWeight: FontWeight.w700)),
                  SizedBox(height: 2),
                  Text('“Show today’s sales”, “open accounting”, “new order”…',
                      style: TextStyle(color: Colors.white70, fontSize: 12)),
                ],
              ),
            ),
            Icon(Icons.arrow_forward_ios, color: Colors.white, size: 16),
          ],
        ),
      ),
    );
  }
}

class _QuickAction {
  final String label;
  final IconData icon;
  final Color color;
  final String? route;
  final bool isAssistant;
  const _QuickAction(this.label, this.icon, this.color, {this.route, this.isAssistant = false});
}

class _QuickGrid extends StatelessWidget {
  final List<_QuickAction> actions;
  final VoidCallback? onOpenAssistant;
  const _QuickGrid({required this.actions, this.onOpenAssistant});

  @override
  Widget build(BuildContext context) {
    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      childAspectRatio: 1.7,
      crossAxisSpacing: 12,
      mainAxisSpacing: 12,
      children: [
        for (final a in actions)
          Card(
            clipBehavior: Clip.antiAlias,
            child: InkWell(
              onTap: () {
                if (a.isAssistant) {
                  onOpenAssistant?.call();
                } else if (a.route != null) {
                  context.push(a.route!);
                }
              },
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: a.color.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Icon(a.icon, color: a.color, size: 20),
                    ),
                    Text(a.label,
                        style: const TextStyle(fontWeight: FontWeight.w600)),
                  ],
                ),
              ),
            ),
          ),
      ],
    );
  }
}

class _BrandDot extends StatelessWidget {
  const _BrandDot();
  @override
  Widget build(BuildContext context) {
    return Container(
      width: 26,
      height: 26,
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [AppTheme.primary, AppTheme.accent],
        ),
        borderRadius: BorderRadius.circular(8),
      ),
      child: const Icon(Icons.auto_awesome, size: 15, color: Colors.white),
    );
  }
}
