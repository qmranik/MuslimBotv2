import 'persona.dart';

/// An authenticated Frappe session plus the derived identity used to pick a
/// [Persona]. Persisted (securely) so users stay logged in across launches.
class Session {
  final String baseUrl;
  final String sid;
  final String apiKey;
  final String apiSecret;
  final String user;
  final String fullName;
  final List<String> roles;
  final String tenantId;

  /// Optional manual override (e.g. an owner previewing the customer surface).
  final Persona? personaOverride;

  const Session({
    required this.baseUrl,
    this.sid = '',
    this.apiKey = '',
    this.apiSecret = '',
    required this.user,
    this.fullName = '',
    this.roles = const [],
    this.tenantId = 'default',
    this.personaOverride,
  });

  Persona get persona => personaOverride ?? Persona.fromRoles(roles);

  String get displayName => fullName.isNotEmpty ? fullName : user;

  bool get hasCookie => sid.isNotEmpty || (apiKey.isNotEmpty && apiSecret.isNotEmpty);

  Session copyWith({
    List<String>? roles,
    String? fullName,
    Persona? personaOverride,
    bool clearOverride = false,
  }) {
    return Session(
      baseUrl: baseUrl,
      sid: sid,
      apiKey: apiKey,
      apiSecret: apiSecret,
      user: user,
      fullName: fullName ?? this.fullName,
      roles: roles ?? this.roles,
      tenantId: tenantId,
      personaOverride: clearOverride ? null : (personaOverride ?? this.personaOverride),
    );
  }

  Map<String, dynamic> toJson() => {
        'baseUrl': baseUrl,
        'sid': sid,
        'apiKey': apiKey,
        'apiSecret': apiSecret,
        'user': user,
        'fullName': fullName,
        'roles': roles,
        'tenantId': tenantId,
        'personaOverride': personaOverride?.name,
      };

  factory Session.fromJson(Map<String, dynamic> j) => Session(
        baseUrl: (j['baseUrl'] ?? '').toString(),
        sid: (j['sid'] ?? '').toString(),
        apiKey: (j['apiKey'] ?? '').toString(),
        apiSecret: (j['apiSecret'] ?? '').toString(),
        user: (j['user'] ?? '').toString(),
        fullName: (j['fullName'] ?? '').toString(),
        roles: (j['roles'] as List?)?.map((e) => e.toString()).toList() ??
            const [],
        tenantId: (j['tenantId'] ?? 'default').toString(),
        personaOverride: _personaFromName(j['personaOverride']?.toString()),
      );

  static Persona? _personaFromName(String? name) {
    if (name == null) return null;
    for (final p in Persona.values) {
      if (p.name == name) return p;
    }
    return null;
  }
}
