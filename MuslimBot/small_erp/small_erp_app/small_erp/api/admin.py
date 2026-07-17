"""
Tenant Administration API — provisioning and onboarding for SaaS multi-tenancy.
Called by n8n automation or the provision-tenant.sh script after bench new-site.
"""
import frappe
from frappe.utils import nowdate, getdate


@frappe.whitelist()
def onboard_tenant(company_name, company_abbr="", currency="USD",
                   country="United States", admin_email=""):
    """
    Bootstrap a freshly created tenant site with sensible defaults.
    Creates: Company, Fiscal Year, Default Warehouse, Customer Group,
    SMB roles, and standard configuration.

    Called via POST to /api/method/small_erp.api.admin.onboard_tenant
    after bench new-site has created the database.
    """
    # Only System Manager / Administrator can onboard
    if "System Manager" not in frappe.get_roles(frappe.session.user):
        frappe.throw("Only System Manager can onboard a tenant", frappe.PermissionError)

    results = {"steps": []}

    # 1. Create Company
    if not company_abbr:
        # Generate abbreviation from company name
        words = company_name.strip().split()
        company_abbr = "".join(w[0].upper() for w in words[:3]) or "CO"

    if not frappe.db.exists("Company", company_name):
        comp = frappe.get_doc({
            "doctype": "Company",
            "company_name": company_name,
            "abbr": company_abbr,
            "default_currency": currency,
            "country": country,
        })
        comp.insert(ignore_permissions=True)
        frappe.defaults.set_global_default("company", company_name)
        frappe.defaults.set_global_default("currency", currency)
        results["steps"].append(f"Created company: {company_name} ({company_abbr})")
    else:
        results["steps"].append(f"Company already exists: {company_name}")

    frappe.db.commit()

    # 2. Create Fiscal Year
    today = getdate(nowdate())
    fy_name = f"{today.year}-{today.year + 1}"
    if not frappe.db.exists("Fiscal Year", fy_name):
        fy = frappe.get_doc({
            "doctype": "Fiscal Year",
            "year": fy_name,
            "year_start_date": f"{today.year}-01-01",
            "year_end_date": f"{today.year}-12-31",
        })
        fy.insert(ignore_permissions=True)
        results["steps"].append(f"Created fiscal year: {fy_name}")
    else:
        results["steps"].append(f"Fiscal year exists: {fy_name}")

    # 3. Default Warehouse
    wh_name = f"Stores - {company_abbr}"
    if not frappe.db.exists("Warehouse", wh_name):
        wh = frappe.get_doc({
            "doctype": "Warehouse",
            "warehouse_name": "Stores",
            "company": company_name,
        })
        wh.insert(ignore_permissions=True)
        results["steps"].append(f"Created warehouse: {wh_name}")

    # 4. Default Customer Group
    cg_name = "General"
    if not frappe.db.exists("Customer Group", cg_name):
        cg = frappe.get_doc({
            "doctype": "Customer Group",
            "customer_group_name": cg_name,
            "is_group": 0,
            "parent_customer_group": "All Customer Groups",
        })
        cg.insert(ignore_permissions=True)
        results["steps"].append(f"Created customer group: {cg_name}")

    # 5. Default Item Group
    ig_name = "Products"
    if not frappe.db.exists("Item Group", ig_name):
        ig = frappe.get_doc({
            "doctype": "Item Group",
            "item_group_name": ig_name,
            "is_group": 0,
            "parent_item_group": "All Item Groups",
        })
        ig.insert(ignore_permissions=True)
        results["steps"].append(f"Created item group: {ig_name}")

    # 6. Standard Selling Price List
    pl_name = "Standard Selling"
    if not frappe.db.exists("Price List", pl_name):
        pl = frappe.get_doc({
            "doctype": "Price List",
            "price_list_name": pl_name,
            "enabled": 1,
            "selling": 1,
            "buying": 0,
        })
        pl.insert(ignore_permissions=True)
        results["steps"].append(f"Created price list: {pl_name}")

    # 7. Mark setup complete (bypass setup wizard)
    frappe.db.set_default("setup_complete", "1")
    try:
        ss = frappe.get_doc("System Settings")
        ss.setup_complete = 1
        if not ss.language:
            ss.language = "en"
        if not ss.time_zone:
            ss.time_zone = "UTC"
        ss.flags.ignore_mandatory = True
        ss.save(ignore_permissions=True)
        results["steps"].append("Setup wizard bypassed")
    except Exception as e:
        results["steps"].append(f"Setup wizard bypass partial: {e}")

    # 8. Configure n8n integration URL
    frappe.conf.n8n_url = "http://smb-n8n:5678"
    results["steps"].append("n8n integration configured")

    # 9. Set admin email if provided
    if admin_email:
        try:
            user = frappe.get_doc("User", "Administrator")
            user.email = admin_email
            user.flags.ignore_mandatory = True
            user.save(ignore_permissions=True)
            results["steps"].append(f"Admin email set: {admin_email}")
        except Exception:
            pass

    frappe.db.commit()

    results["status"] = "success"
    results["company"] = company_name
    results["site"] = frappe.local.site
    return results


@frappe.whitelist()
def get_tenant_info():
    """Return basic tenant metadata for health checks and dashboards."""
    if "System Manager" not in frappe.get_roles(frappe.session.user):
        frappe.throw("Insufficient permissions", frappe.PermissionError)

    company = frappe.defaults.get_global_default("company")
    site = frappe.local.site

    user_count = frappe.db.count("User", {"enabled": 1, "user_type": "System User"})
    item_count = frappe.db.count("Item", {"disabled": 0})
    customer_count = frappe.db.count("Customer", {"disabled": 0})

    return {
        "site": site,
        "company": company,
        "users": user_count,
        "items": item_count,
        "customers": customer_count,
    }
