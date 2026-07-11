/// The three operator personas the app is designed around.
///
/// Persona only changes *presentation and default surface* — trust boundaries
/// are always enforced server-side by Frappe permissions. See REBUILD_PLAN §4.
enum Persona {
  owner,
  employee,
  customer;

  String get label => switch (this) {
        Persona.owner => 'Owner',
        Persona.employee => 'Employee',
        Persona.customer => 'Customer',
      };

  bool get isStaff => this == Persona.owner || this == Persona.employee;

  /// Derive a persona from the user's Frappe roles.
  ///
  /// Owner  → System Manager / SMB Manager / Administrator.
  /// Employee → any other staff/desk role (SMB Operator, Sales, Support…).
  /// Customer → website/portal users with no desk role (default fallback).
  static Persona fromRoles(Iterable<String> roles) {
    final set = roles.map((r) => r.trim()).toSet();
    const ownerRoles = {
      'Administrator',
      'System Manager',
      'SMB Manager',
    };
    if (set.any(ownerRoles.contains)) return Persona.owner;

    // Any desk-capable staff role → employee.
    const staffMarkers = {
      'SMB Operator',
      'Sales User',
      'Sales Manager',
      'Accounts User',
      'Stock User',
      'Support Team',
      'HR User',
      'Employee',
    };
    if (set.any(staffMarkers.contains)) return Persona.employee;

    return Persona.customer;
  }
}
