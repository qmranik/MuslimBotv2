"""Drop deprecated AI Knowledge Source / Chunk DocTypes and tables."""

from __future__ import annotations

import frappe


def execute() -> None:
    doctypes = ("AI Knowledge Chunk", "AI Knowledge Source")

    for name in doctypes:
        if frappe.db.exists("DocType", name):
            frappe.delete_doc("DocType", name, force=True, ignore_permissions=True)

    for name in doctypes:
        table = f"tab{name}"
        if frappe.db.table_exists(table):
            frappe.db.sql_ddl(f"DROP TABLE IF EXISTS `{table}`")

    frappe.db.commit()
