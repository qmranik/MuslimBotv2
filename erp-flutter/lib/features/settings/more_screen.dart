import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/auth/auth_controller.dart';
import '../../core/auth/persona.dart';

/// Account / settings surface: identity, persona (with staff preview override),
/// instance info, and sign-out.
class MoreScreen extends StatelessWidget {
  const MoreScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthController>();
    final session = auth.session;
    final isStaff = auth.persona.isStaff;

    return Scaffold(
      appBar: AppBar(title: const Text('More')),
      body: ListView(
        children: [
          ListTile(
            leading: CircleAvatar(
              child: Text(
                (session?.displayName.isNotEmpty ?? false)
                    ? session!.displayName[0].toUpperCase()
                    : '?',
              ),
            ),
            title: Text(session?.displayName ?? 'Unknown'),
            subtitle: Text('${auth.persona.label} · ${session?.baseUrl ?? ''}'),
          ),
          const Divider(),
          if (isStaff)
            ExpansionTile(
              leading: const Icon(Icons.switch_account_rounded),
              title: const Text('Preview persona'),
              subtitle: Text('Currently: ${auth.persona.label}'),
              children: [
                for (final p in Persona.values)
                  ListTile(
                    title: Text(p.label),
                    trailing: auth.persona == p
                        ? const Icon(Icons.check_circle, color: Colors.green)
                        : const Icon(Icons.circle_outlined),
                    onTap: () => auth.overridePersona(
                      p == _basePersona(auth) ? null : p,
                    ),
                  ),
              ],
            ),
          ListTile(
            leading: const Icon(Icons.info_outline),
            title: const Text('Roles'),
            subtitle: Text(
              (session?.roles.isEmpty ?? true)
                  ? 'No roles reported'
                  : session!.roles.join(', '),
            ),
          ),
          const Divider(),
          ListTile(
            leading: const Icon(Icons.logout, color: Colors.redAccent),
            title: const Text('Sign out',
                style: TextStyle(color: Colors.redAccent)),
            onTap: () => auth.logout(),
          ),
        ],
      ),
    );
  }

  /// The role-derived persona ignoring any manual override.
  Persona _basePersona(AuthController auth) =>
      Persona.fromRoles(auth.session?.roles ?? const []);
}
