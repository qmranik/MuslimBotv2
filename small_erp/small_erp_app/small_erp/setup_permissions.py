"""
Setup permissions for SMB Operator and SMB Manager roles.
Run after app installation: bench --site <site> execute small_erp.setup_permissions.run
"""
import frappe


def run():
    """Assign DocType permissions to SMB roles so they can operate without desk access."""
    from frappe.core.doctype.doctype.doctype import DocType

    _ensure_role("SMB Operator")
    _ensure_role("SMB Manager")

    # (doctype, role, permissions_list)
    permissions = [
        # Sales
        ("Sales Invoice", "SMB Operator", {"read": 1, "create": 1, "write": 1, "submit": 1, "amend": 1, "print": 1}),
        ("Sales Invoice", "SMB Manager", {"read": 1, "create": 1, "write": 1, "submit": 1, "amend": 1, "print": 1, "report": 1}),
        ("Sales Order", "SMB Operator", {"read": 1, "create": 1, "write": 1, "submit": 1}),
        ("Sales Order", "SMB Manager", {"read": 1, "create": 1, "write": 1, "submit": 1, "report": 1}),
        # Payments
        ("Payment Entry", "SMB Operator", {"read": 1, "create": 1, "write": 1, "submit": 1}),
        ("Payment Entry", "SMB Manager", {"read": 1, "create": 1, "write": 1, "submit": 1, "report": 1}),
        # Items & Stock
        ("Item", "SMB Operator", {"read": 1, "create": 1, "write": 1}),
        ("Item", "SMB Manager", {"read": 1, "create": 1, "write": 1, "report": 1}),
        ("Stock Entry", "SMB Operator", {"read": 1, "create": 1, "write": 1, "submit": 1}),
        ("Stock Entry", "SMB Manager", {"read": 1, "create": 1, "write": 1, "submit": 1, "report": 1}),
        ("Bin", "SMB Operator", {"read": 1}),
        ("Bin", "SMB Manager", {"read": 1, "report": 1}),
        ("Item Price", "SMB Operator", {"read": 1}),
        ("Item Price", "SMB Manager", {"read": 1}),
        ("Item Group", "SMB Operator", {"read": 1}),
        ("Item Group", "SMB Manager", {"read": 1}),
        # Customers
        ("Customer", "SMB Operator", {"read": 1, "create": 1, "write": 1}),
        ("Customer", "SMB Manager", {"read": 1, "create": 1, "write": 1, "report": 1}),
        ("Customer Group", "SMB Operator", {"read": 1}),
        ("Customer Group", "SMB Manager", {"read": 1}),
        # Accounting
        ("GL Entry", "SMB Operator", {"read": 1}),
        ("GL Entry", "SMB Manager", {"read": 1, "report": 1}),
        ("Purchase Invoice", "SMB Operator", {"read": 1}),
        ("Purchase Invoice", "SMB Manager", {"read": 1, "report": 1}),
        # Suppliers
        ("Supplier", "SMB Operator", {"read": 1}),
        ("Supplier", "SMB Manager", {"read": 1, "create": 1, "write": 1}),
        # Warehouses
        ("Warehouse", "SMB Operator", {"read": 1}),
        ("Warehouse", "SMB Manager", {"read": 1, "write": 1}),
        # Reports
        ("Sales Invoice", "SMB Manager", {"report": 1}),
        ("Sales Order", "SMB Manager", {"report": 1}),
        ("Payment Entry", "SMB Manager", {"report": 1}),
        ("Item", "SMB Manager", {"report": 1}),
        ("Customer", "SMB Manager", {"report": 1}),
    ]

    created = 0
    for doctype_name, role, perm in permissions:
        existing = frappe.db.get_value("DocPerm", {
            "parent": doctype_name,
            "role": role,
        })
        if existing:
            _update_permission(doctype_name, role, perm)
        else:
            _add_permission(doctype_name, role, perm)

    frappe.db.commit()
    print(f"Permissions setup complete.")


def _ensure_role(role_name):
    if not frappe.db.exists("Role", role_name):
        role = frappe.get_doc({
            "doctype": "Role",
            "role_name": role_name,
            "desk_access": 0,
        })
        role.insert(ignore_permissions=True)
        print(f"Created role: {role_name}")


def _add_permission(doctype_name, role, perm):
    """Add a DocPerm for the given role on the given doctype."""
    doctype = frappe.get_doc("DocType", doctype_name)
    doctype.append("permissions", {
        "role": role,
        **perm,
    })
    doctype.save(ignore_permissions=True)
    print(f"  Added {role} permissions for {doctype_name}: {perm}")


def _update_permission(doctype_name, role, perm):
    """Update an existing DocPerm for the given role."""
    existing_name = frappe.db.get_value("DocPerm", {
        "parent": doctype_name,
        "role": role,
    })
    if existing_name:
        docperm = frappe.get_doc("DocPerm", existing_name)
        for key, val in perm.items():
            setattr(docperm, key, val)
        docperm.save(ignore_permissions=True)
