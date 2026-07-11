import 'package:flutter_test/flutter_test.dart';
import 'package:small_erp/core/auth/persona.dart';

void main() {
  group('Persona.fromRoles', () {
    test('owner from System Manager / SMB Manager', () {
      expect(Persona.fromRoles(['System Manager']), Persona.owner);
      expect(Persona.fromRoles(['SMB Manager', 'Sales User']), Persona.owner);
      expect(Persona.fromRoles(['Administrator']), Persona.owner);
    });

    test('employee from a staff role', () {
      expect(Persona.fromRoles(['SMB Operator']), Persona.employee);
      expect(Persona.fromRoles(['Sales User']), Persona.employee);
      expect(Persona.fromRoles(['Support Team']), Persona.employee);
    });

    test('customer when no desk role', () {
      expect(Persona.fromRoles(['Customer']), Persona.customer);
      expect(Persona.fromRoles([]), Persona.customer);
      expect(Persona.fromRoles(['Website User']), Persona.customer);
    });

    test('owner precedence over employee roles', () {
      expect(
        Persona.fromRoles(['SMB Operator', 'System Manager']),
        Persona.owner,
      );
    });

    test('isStaff reflects owner/employee', () {
      expect(Persona.owner.isStaff, isTrue);
      expect(Persona.employee.isStaff, isTrue);
      expect(Persona.customer.isStaff, isFalse);
    });
  });
}
