import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/auth/auth_controller.dart';
import '../core/auth/persona.dart';
import '../features/assistant/assistant_sheet.dart';
import '../features/home/home_screen.dart';
import '../features/portal/webview_page.dart';
import '../features/settings/more_screen.dart';
import '../shared/coming_soon.dart';

class _Destination {
  final String label;
  final IconData icon;
  final Widget Function(BuildContext, VoidCallback openAssistant) build;
  const _Destination(this.label, this.icon, this.build);
}

/// Persona-aware navigation shell. Each persona gets a tailored set of
/// destinations; the MuslimBot FAB is available everywhere. Tabs marked
/// "coming soon" are filled by later phases (Tier-2 engine, customer support).
class PersonaShell extends StatefulWidget {
  const PersonaShell({super.key});

  @override
  State<PersonaShell> createState() => _PersonaShellState();
}

class _PersonaShellState extends State<PersonaShell> {
  int _index = 0;

  /// Indices the user has visited — used to lazily build heavy tabs (e.g. the
  /// WebView desk) only once opened, while keeping them alive afterwards.
  final Set<int> _visited = {0};

  void _openAssistant() => showAssistantSheet(context);

  List<_Destination> _destinationsFor(Persona persona) {
    switch (persona) {
      case Persona.owner:
        return [
          _Destination('Home', Icons.home_rounded,
              (_, open) => HomeScreen(onOpenAssistant: open)),
          _Destination('Explore', Icons.grid_view_rounded,
              (_, __) => const ComingSoon(
                    title: 'Explore data',
                    phase: 'P2',
                    description:
                        'Open and edit any Frappe DocType natively — the '
                        'metadata engine (frappe_mobile_sdk) lands here.',
                    icon: Icons.grid_view_rounded,
                  )),
          _Destination('ERP Desk', Icons.dashboard_rounded,
              (_, __) => const PortalWebViewPage(appId: 'erp-ops', title: 'ERP Desk')),
          _Destination('More', Icons.more_horiz_rounded, (_, __) => const MoreScreen()),
        ];
      case Persona.employee:
        return [
          _Destination('Home', Icons.home_rounded,
              (_, open) => HomeScreen(onOpenAssistant: open)),
          _Destination('ERP Desk', Icons.dashboard_rounded,
              (_, __) => const PortalWebViewPage(appId: 'erp-ops', title: 'ERP Desk')),
          _Destination('More', Icons.more_horiz_rounded, (_, __) => const MoreScreen()),
        ];
      case Persona.customer:
        return [
          _Destination('Home', Icons.home_rounded,
              (_, open) => HomeScreen(onOpenAssistant: open)),
          _Destination('Support', Icons.support_agent_rounded,
              (_, __) => const ComingSoon(
                    title: 'Support & orders',
                    phase: 'P4',
                    description:
                        'Place & track orders and raise support tickets '
                        '(Frappe Helpdesk), assisted by MuslimBot.',
                    icon: Icons.support_agent_rounded,
                  )),
          _Destination('More', Icons.more_horiz_rounded, (_, __) => const MoreScreen()),
        ];
    }
  }

  @override
  Widget build(BuildContext context) {
    final persona = context.watch<AuthController>().persona;
    final destinations = _destinationsFor(persona);
    final safeIndex = _index.clamp(0, destinations.length - 1);

    return Scaffold(
      body: IndexedStack(
        index: safeIndex,
        children: [
          for (var i = 0; i < destinations.length; i++)
            _visited.contains(i)
                ? destinations[i].build(context, _openAssistant)
                : const SizedBox.shrink(),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: _openAssistant,
        tooltip: 'Ask MuslimBot',
        child: const Icon(Icons.auto_awesome),
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: safeIndex,
        onDestinationSelected: (i) => setState(() {
          _index = i;
          _visited.add(i);
        }),
        destinations: [
          for (final d in destinations)
            NavigationDestination(icon: Icon(d.icon), label: d.label),
        ],
      ),
    );
  }
}
