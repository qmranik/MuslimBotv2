import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';
import '../../features/dashboard/screens/dashboard_screen.dart';
import '../../features/pos_checkout/screens/pos_screen.dart';
import '../../features/inventory/screens/inventory_list_screen.dart';
import '../../features/customers/screens/customer_list_screen.dart';
import '../../features/orders/screens/orders_screen.dart';

class AppHome extends StatefulWidget {
  const AppHome({super.key});

  @override
  State<AppHome> createState() => AppHomeState();
}

class AppHomeState extends State<AppHome> {
  int _currentIndex = 0;

  final List<Widget> _screens = const [
    DashboardScreen(),
    PosScreen(),
    InventoryListScreen(),
    CustomerListScreen(),
    OrdersScreen(),
  ];

  void onTabTapped(int index) {
    setState(() => _currentIndex = index);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _currentIndex,
        children: _screens,
      ),
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          border: Border(top: BorderSide(color: AppTheme.border, width: 1)),
        ),
        child: BottomNavigationBar(
          currentIndex: _currentIndex,
          onTap: onTabTapped,
          items: const [
            BottomNavigationBarItem(
              icon: Icon(Icons.dashboard_rounded),
              label: 'Overview',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.point_of_sale_rounded),
              label: 'POS',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.inventory_2_rounded),
              label: 'Inventory',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.people_rounded),
              label: 'Customers',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.receipt_long_rounded),
              label: 'Orders',
            ),
          ],
        ),
      ),
    );
  }
}
