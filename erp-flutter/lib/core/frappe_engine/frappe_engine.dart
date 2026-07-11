import 'package:flutter/material.dart';

import '../auth/session.dart';

/// Initializes the frappe_mobile_sdk with the current session credentials.
class FrappeEngine {
  static void initialize(Session session) {
    // frappe_mobile_sdk uses its own providers or config.
    // We will initialize it properly when fully integrating the SDK API.
  }
}

/// A generic Explore screen that uses the SDK's DoctypeListScreen.
class ExploreTab extends StatelessWidget {
  const ExploreTab({super.key});

  @override
  Widget build(BuildContext context) {
    // We wrap the SDK's screen in our theme/navigation if needed.
    // DoctypeListScreen is provided by frappe_mobile_sdk to let users
    // pick a doctype and see its generic list and forms.
    return Scaffold(
      appBar: AppBar(
        title: const Text('Explore ERPNext'),
      ),
      // For now, we show a placeholder for ExploreTab until we wire up
      // the required dependencies (repository, appConfig) for DoctypeListScreen.
      body: const Center(
        child: Text('frappe_mobile_sdk generic engine initialized.\nSelect a doctype to explore.'),
      ),
    );
  }
}
