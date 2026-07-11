import 'package:flutter/material.dart';

/// MuslimBot design tokens + light & dark [ThemeData].
///
/// The dark palette and static token names are preserved from the original app
/// so existing screens keep compiling during the rebuild; a light theme and
/// proper [ColorScheme]s are added for the new persona shell.
class AppTheme {
  // ── Brand tokens (dark-surface palette) ───────────────────────────────
  static const Color primary = Color(0xFF6C5CE7);
  static const Color primaryDark = Color(0xFF5A4BD1);
  static const Color accent = Color(0xFF00D2D3);
  static const Color success = Color(0xFF00B894);
  static const Color warning = Color(0xFFFDAA5E);
  static const Color danger = Color(0xFFFF6B6B);

  // Dark surfaces
  static const Color surface = Color(0xFF1E1E2E);
  static const Color surfaceLight = Color(0xFF2D2D44);
  static const Color background = Color(0xFF0F0F1A);
  static const Color cardBg = Color(0xFF1A1A2E);
  static const Color textPrimary = Color(0xFFF5F5F5);
  static const Color textSecondary = Color(0xFFB0B0C8);
  static const Color border = Color(0xFF2D2D44);

  // Light surfaces
  static const Color lightBackground = Color(0xFFF6F7FB);
  static const Color lightSurface = Color(0xFFFFFFFF);
  static const Color lightCardBg = Color(0xFFFFFFFF);
  static const Color lightTextPrimary = Color(0xFF1A1A2E);
  static const Color lightTextSecondary = Color(0xFF64648B);
  static const Color lightBorder = Color(0xFFE3E4F0);

  static const _fontFamily = 'Inter';

  static ThemeData get darkTheme => _build(
        brightness: Brightness.dark,
        scaffold: background,
        surface: surface,
        surfaceAlt: surfaceLight,
        card: cardBg,
        borderColor: border,
        onSurface: textPrimary,
        onSurfaceMuted: textSecondary,
      );

  static ThemeData get lightTheme => _build(
        brightness: Brightness.light,
        scaffold: lightBackground,
        surface: lightSurface,
        surfaceAlt: const Color(0xFFEFEFF6),
        card: lightCardBg,
        borderColor: lightBorder,
        onSurface: lightTextPrimary,
        onSurfaceMuted: lightTextSecondary,
      );

  static ThemeData _build({
    required Brightness brightness,
    required Color scaffold,
    required Color surface,
    required Color surfaceAlt,
    required Color card,
    required Color borderColor,
    required Color onSurface,
    required Color onSurfaceMuted,
  }) {
    final colorScheme = ColorScheme(
      brightness: brightness,
      primary: primary,
      onPrimary: Colors.white,
      secondary: accent,
      onSecondary: Colors.black,
      surface: surface,
      onSurface: onSurface,
      error: danger,
      onError: Colors.white,
    );

    return ThemeData(
      useMaterial3: true,
      brightness: brightness,
      primaryColor: primary,
      scaffoldBackgroundColor: scaffold,
      fontFamily: _fontFamily,
      colorScheme: colorScheme,
      dividerColor: borderColor,
      appBarTheme: AppBarTheme(
        backgroundColor: surface,
        foregroundColor: onSurface,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: TextStyle(
          fontFamily: _fontFamily,
          fontSize: 20,
          fontWeight: FontWeight.w600,
          color: onSurface,
        ),
        iconTheme: IconThemeData(color: onSurface),
      ),
      cardTheme: CardThemeData(
        color: card,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: BorderSide(color: borderColor, width: 1),
        ),
      ),
      bottomNavigationBarTheme: BottomNavigationBarThemeData(
        backgroundColor: surface,
        selectedItemColor: primary,
        unselectedItemColor: onSurfaceMuted,
        type: BottomNavigationBarType.fixed,
        elevation: 0,
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: surface,
        indicatorColor: primary.withValues(alpha: 0.16),
        elevation: 0,
      ),
      floatingActionButtonTheme: const FloatingActionButtonThemeData(
        backgroundColor: primary,
        foregroundColor: Colors.white,
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: surfaceAlt,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: borderColor),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: borderColor),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: primary, width: 2),
        ),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        hintStyle: TextStyle(color: onSurfaceMuted),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: primary,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          textStyle: const TextStyle(
            fontFamily: _fontFamily,
            fontWeight: FontWeight.w600,
            fontSize: 15,
          ),
        ),
      ),
    );
  }
}
