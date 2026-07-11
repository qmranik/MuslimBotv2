/// Scopes what MuslimBot is allowed to do for the active persona.
///
/// This is a UX/prompt-level scope only; Frappe still enforces real
/// permissions server-side. See REBUILD_PLAN §4–§5.
enum PersonaMode {
  /// Owners/employees: full read + (permitted) write tool catalogue.
  full,

  /// Customers: knowledge answers + placing/tracking their own orders and
  /// raising support tickets. No desk, no back-office writes.
  supportAndOrdering;

  String get scopeInstruction => switch (this) {
        PersonaMode.full =>
          'Scope: full operator access. Offer any read tool; confirm before any write.',
        PersonaMode.supportAndOrdering =>
          'Scope: CUSTOMER support & self-service only. You may answer questions from the '
              'knowledge base, check product availability, place/track the customer\'s own '
              'orders, and raise support tickets. Never expose back-office data or other '
              'customers\' records, and never perform administrative writes.',
      };
}
