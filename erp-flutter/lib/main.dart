import 'package:flutter/material.dart';

import 'app/app.dart';
import 'core/auth/auth_controller.dart';
import 'core/config/app_config.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // TODO(config): source from --dart-define / a settings screen for prod.
  final config = AppConfig.dev();

  final auth = AuthController(config: config);
  await auth.restore();

  runApp(MuslimBotApp(config: config, auth: auth));
}
