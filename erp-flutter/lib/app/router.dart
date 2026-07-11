import 'package:go_router/go_router.dart';

import '../core/auth/auth_controller.dart';
import '../features/auth/login_screen.dart';
import '../features/dashboard/screens/dashboard_screen.dart';
import '../features/pos_checkout/screens/pos_screen.dart';
import '../features/inventory/screens/inventory_list_screen.dart';
import '../features/customers/screens/customer_list_screen.dart';
import '../features/orders/screens/orders_screen.dart';
import '../features/portal/webview_page.dart';
import 'persona_shell.dart';

/// App router with an auth-driven redirect. Rebuilds on [AuthController]
/// changes so login/logout navigate automatically.
GoRouter createRouter(AuthController auth) {
  return GoRouter(
    initialLocation: '/',
    refreshListenable: auth,
    redirect: (context, state) {
      final authed = auth.isAuthenticated;
      final atLogin = state.matchedLocation == '/login';
      if (!authed) return atLogin ? null : '/login';
      if (atLogin) return '/';
      return null;
    },
    routes: [
      GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
      GoRoute(
        path: '/',
        builder: (_, __) => const PersonaShell(),
        routes: [
          GoRoute(path: 'dashboard', builder: (_, __) => const DashboardScreen()),
          GoRoute(path: 'pos', builder: (_, __) => const PosScreen()),
          GoRoute(path: 'inventory', builder: (_, __) => const InventoryListScreen()),
          GoRoute(path: 'customers', builder: (_, __) => const CustomerListScreen()),
          GoRoute(path: 'orders', builder: (_, __) => const OrdersScreen()),
          GoRoute(path: 'portal', builder: (_, __) => const PortalWebViewPage(appId: 'erp-ops', title: 'ERP Desk')),
        ],
      ),
    ],
  );
}
