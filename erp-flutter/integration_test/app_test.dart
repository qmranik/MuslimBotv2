import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:small_erp/main.dart' as app;

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  group('End-to-End App Test', () {
    testWidgets('Login and verify basic navigation', (tester) async {
      // Start the app
      app.main();
      
      // Wait for the app to settle
      await tester.pumpAndSettle();

      // Find the URL field and enter the test instance URL
      final urlField = find.bySemanticsLabel('Server URL');
      if (urlField.evaluate().isNotEmpty) {
        await tester.enterText(urlField, 'http://small.localhost:8000');
      }

      // Enter Username
      final userField = find.bySemanticsLabel('Username');
      if (userField.evaluate().isNotEmpty) {
        await tester.enterText(userField, 'Administrator');
      }

      // Enter Password
      final passwordField = find.bySemanticsLabel('Password');
      if (passwordField.evaluate().isNotEmpty) {
        await tester.enterText(passwordField, 'admin');
      }

      // Tap Login button
      final loginButton = find.widgetWithText(ElevatedButton, 'Login');
      if (loginButton.evaluate().isNotEmpty) {
        await tester.tap(loginButton);
        await tester.pumpAndSettle(const Duration(seconds: 3));
      }
      
      // Verify Dashboard is visible
      expect(find.text('Dashboard'), findsWidgets);
      
      // Open drawer (if applicable) and navigate to POS
      final scaffold = find.byType(Scaffold).first;
      if (scaffold.evaluate().isNotEmpty) {
        // Find POS Checkout or Customers depending on app structure
        // This is a placeholder for actual navigation logic
        final posMenuItem = find.text('POS Checkout');
        if (posMenuItem.evaluate().isNotEmpty) {
             await tester.tap(posMenuItem);
             await tester.pumpAndSettle();
             expect(find.text('Cart'), findsWidgets);
        }
      }
    });
  });
}
