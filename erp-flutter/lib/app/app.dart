import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../core/auth/auth_controller.dart';
import '../core/config/app_config.dart';
import '../core/muslimbot/persona.dart';
import '../core/theme/app_theme.dart';
import '../core/providers/api_provider.dart';
import 'router.dart';

/// Root MuslimBot application: providers + themed [MaterialApp.router].
class MuslimBotApp extends StatefulWidget {
  final AppConfig config;
  final AuthController auth;

  const MuslimBotApp({super.key, required this.config, required this.auth});

  @override
  State<MuslimBotApp> createState() => _MuslimBotAppState();
}

class _MuslimBotAppState extends State<MuslimBotApp> {
  late final GoRouter _router = createRouter(widget.auth);

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        Provider<AppConfig>.value(value: widget.config),
        ChangeNotifierProvider<AuthController>.value(value: widget.auth),
        ChangeNotifierProxyProvider<AuthController, ApiProvider>(
          create: (_) => ApiProvider(),
          update: (_, auth, api) => api!..updateFromSession(auth.session),
        ),
      ],
      child: MaterialApp.router(
        title: MuslimBot.name,
        debugShowCheckedModeBanner: false,
        theme: AppTheme.lightTheme,
        darkTheme: AppTheme.darkTheme,
        themeMode: ThemeMode.system,
        routerConfig: _router,
      ),
    );
  }
}
