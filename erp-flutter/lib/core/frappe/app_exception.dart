/// Unified error taxonomy for the app. Network/Frappe/validation failures are
/// normalized into these so the UI can render friendly, actionable messages.
sealed class AppException implements Exception {
  final String message;
  final int? statusCode;
  const AppException(this.message, {this.statusCode});

  /// A short, user-facing message safe to show in a toast/snackbar.
  String get friendly => message;

  @override
  String toString() => '$runtimeType($statusCode): $message';
}

/// Authentication/authorization failure (401/403 or bad credentials).
class AuthException extends AppException {
  const AuthException(super.message, {super.statusCode});
  @override
  String get friendly => statusCode == 403
      ? 'You do not have permission for that.'
      : 'Please sign in again.';
}

/// Transport failure — no connectivity, timeout, DNS, TLS.
class NetworkException extends AppException {
  const NetworkException([super.message = 'Network unavailable']);
  @override
  String get friendly => 'Cannot reach the server. Check your connection.';
}

/// The server returned an error payload (Frappe `_server_messages`/`exc`).
class ApiException extends AppException {
  const ApiException(super.message, {super.statusCode});
}

/// Client-side validation failed before a request was made.
class ValidationException extends AppException {
  const ValidationException(super.message);
}
