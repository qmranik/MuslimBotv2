"""
Quazi-Pharma ERPNext Seeder
============================
Populates a fresh ERPNext instance with realistic pharmacy + grocery demo data.

Usage:
    pip install -r requirements.txt
    python seed.py --url http://localhost:8080 --user Administrator --password admin
"""

import argparse
import json
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path

import requests

DATA_DIR = Path(__file__).parent.parent / "demo_erp_data"


class ERPNextSeeder:
    def __init__(self, url: str, api_key: str = "", api_secret: str = "",
                 user: str = "", password: str = ""):
        self.url = url.rstrip("/")
        self.session = requests.Session()
        self.session.headers["Content-Type"] = "application/json"

        if api_key and api_secret:
            self.session.headers["Authorization"] = f"token {api_key}:{api_secret}"
        elif user and password:
            self._login(user, password)
        else:
            print("ERROR: Provide either api-key/secret or user/password")
            sys.exit(1)

    def _login(self, user: str, password: str):
        resp = self.session.post(f"{self.url}/api/method/login", json={
            "usr": user, "pwd": password
        })
        if resp.status_code != 200:
            print(f"Login failed: {resp.status_code} {resp.text}")
            sys.exit(1)
        print(f"Logged in as {user}")

    def _exists(self, doctype: str, name: str) -> bool:
        resp = self.session.get(f"{self.url}/api/resource/{doctype}/{name}")
        return resp.status_code == 200

    def _create(self, doctype: str, data: dict) -> dict:
        data["doctype"] = doctype
        resp = self.session.post(f"{self.url}/api/resource/{doctype}", json=data)
        if resp.status_code in (200, 201):
            name = resp.json().get("data", {}).get("name", "")
            print(f"  Created {doctype}: {name}")
            return resp.json().get("data", {})
        elif resp.status_code == 409:
            print(f"  Already exists: {doctype} {data.get('name', data.get('item_code', ''))}")
            return {}
        else:
            print(f"  Failed {doctype}: {resp.status_code} — {resp.text[:200]}")
            return {}

    def _get_company(self) -> str:
        resp = self.session.get(f"{self.url}/api/resource/Company",
                                params={"limit_page_length": 1})
        companies = resp.json().get("data", [])
        if companies:
            return companies[0]["name"]
        print("ERROR: No company found. Run ERPNext setup wizard first.")
        sys.exit(1)

    def _get_abbr(self, company: str) -> str:
        resp = self.session.get(f"{self.url}/api/resource/Company/{company}")
        return resp.json().get("data", {}).get("abbr", "QP")

    def seed_all(self):
        print("\n=== Quazi-Pharma ERPNext Seeder ===\n")
        company = self._get_company()
        abbr = self._get_abbr(company)
        print(f"Company: {company} ({abbr})\n")

        self._seed_item_groups()
        self._seed_customer_groups()
        self._seed_supplier_groups()
        self._seed_items()
        self._seed_customers()
        self._seed_suppliers()
        self._seed_opening_stock(company, abbr)
        self._seed_sales_invoices(company, abbr)

        print("\n=== Seeding complete! ===")

    def _seed_item_groups(self):
        print("--- Item Groups ---")
        groups = [
            "Analgesics", "Antacids & GI", "Antibiotics",
            "Cardiac & BP", "Diabetes", "Respiratory",
            "Vitamins & Supplements", "Eye/Ear/Nose",
            "Grocery - Rice & Grains", "Grocery - Spices",
            "Grocery - Cooking Oil", "Grocery - Dairy",
            "Grocery - Beverages", "Personal Care",
        ]
        for g in groups:
            if not self._exists("Item Group", g):
                self._create("Item Group", {
                    "item_group_name": g,
                    "parent_item_group": "All Item Groups",
                    "is_group": 0
                })

    def _seed_customer_groups(self):
        print("--- Customer Groups ---")
        for g in ["Individual", "Commercial"]:
            if not self._exists("Customer Group", g):
                self._create("Customer Group", {
                    "customer_group_name": g,
                    "parent_customer_group": "All Customer Groups",
                    "is_group": 0
                })

    def _seed_supplier_groups(self):
        print("--- Supplier Groups ---")
        for g in ["Pharma Distributor", "FMCG Distributor"]:
            if not self._exists("Supplier Group", g):
                self._create("Supplier Group", {
                    "supplier_group_name": g,
                    "parent_supplier_group": "All Supplier Groups",
                    "is_group": 0
                })

    def _seed_items(self):
        print("--- Items ---")
        items = json.loads((DATA_DIR / "items.json").read_text())
        for item in items:
            if self._exists("Item", item["item_code"]):
                print(f"  Exists: {item['item_code']}")
                continue
            self._create("Item", {
                "item_code": item["item_code"],
                "item_name": item["item_name"],
                "item_group": item["item_group"],
                "stock_uom": item["stock_uom"],
                "is_stock_item": 1,
                "standard_rate": item["standard_rate"],
                "description": item["description"],
                "safety_stock": item.get("safety_stock", 10),
                "brand": item.get("brand", ""),
            })

    def _seed_customers(self):
        print("--- Customers ---")
        customers = json.loads((DATA_DIR / "customers.json").read_text())
        for c in customers:
            if self._exists("Customer", c["customer_name"]):
                print(f"  Exists: {c['customer_name']}")
                continue
            self._create("Customer", {
                "customer_name": c["customer_name"],
                "customer_type": c["customer_type"],
                "customer_group": c["customer_group"],
                "territory": c.get("territory", "Bangladesh"),
            })

    def _seed_suppliers(self):
        print("--- Suppliers ---")
        suppliers = json.loads((DATA_DIR / "suppliers.json").read_text())
        for s in suppliers:
            if self._exists("Supplier", s["supplier_name"]):
                print(f"  Exists: {s['supplier_name']}")
                continue
            self._create("Supplier", {
                "supplier_name": s["supplier_name"],
                "supplier_group": s["supplier_group"],
                "supplier_type": s.get("supplier_type", "Company"),
            })

    def _seed_opening_stock(self, company: str, abbr: str):
        print("--- Opening Stock (Material Receipt) ---")
        items = json.loads((DATA_DIR / "items.json").read_text())
        warehouse = f"Stores - {abbr}"

        entry = {
            "doctype": "Stock Entry",
            "stock_entry_type": "Material Receipt",
            "posting_date": (datetime.now() - timedelta(days=45)).strftime("%Y-%m-%d"),
            "company": company,
            "items": []
        }

        for item in items:
            if item.get("opening_qty", 0) > 0:
                entry["items"].append({
                    "item_code": item["item_code"],
                    "qty": item["opening_qty"],
                    "basic_rate": round(item["standard_rate"] * 0.65, 2),
                    "t_warehouse": warehouse,
                })

        resp = self.session.post(f"{self.url}/api/resource/Stock Entry", json=entry)
        if resp.status_code in (200, 201):
            se_name = resp.json().get("data", {}).get("name", "")
            print(f"  Created Stock Entry: {se_name}")
            submit = self.session.put(
                f"{self.url}/api/resource/Stock Entry/{se_name}",
                json={"docstatus": 1}
            )
            if submit.status_code == 200:
                print(f"  Submitted: {se_name}")
            else:
                print(f"  Submit failed: {submit.status_code}")
        else:
            print(f"  Stock Entry failed: {resp.status_code} — {resp.text[:200]}")

    def _seed_sales_invoices(self, company: str, abbr: str):
        print("--- Sales Invoices ---")
        orders = json.loads((DATA_DIR / "sample_orders.json").read_text())
        warehouse = f"Stores - {abbr}"

        for order in orders:
            posting_date = (datetime.now() - timedelta(days=order["days_ago"])).strftime("%Y-%m-%d")
            due_date = (datetime.now() - timedelta(days=order["days_ago"] - 30)).strftime("%Y-%m-%d")

            si = {
                "doctype": "Sales Invoice",
                "customer": order["customer"],
                "posting_date": posting_date,
                "due_date": due_date,
                "company": company,
                "update_stock": 1,
                "items": []
            }

            for item in order["items"]:
                si["items"].append({
                    "item_code": item["item_code"],
                    "qty": item["qty"],
                    "rate": item["rate"],
                    "warehouse": warehouse,
                })

            resp = self.session.post(f"{self.url}/api/resource/Sales Invoice", json=si)
            if resp.status_code in (200, 201):
                si_name = resp.json().get("data", {}).get("name", "")
                print(f"  Created: {si_name} ({order['customer']})")
                self.session.put(
                    f"{self.url}/api/resource/Sales Invoice/{si_name}",
                    json={"docstatus": 1}
                )
            else:
                print(f"  SI failed for {order['customer']}: {resp.status_code}")


def main():
    parser = argparse.ArgumentParser(description="Seed ERPNext with Quazi-Pharma demo data")
    parser.add_argument("--url", default="http://localhost:8080")
    parser.add_argument("--api-key", default=os.getenv("FRAPPE_API_KEY", ""))
    parser.add_argument("--api-secret", default=os.getenv("FRAPPE_API_SECRET", ""))
    parser.add_argument("--user", default="")
    parser.add_argument("--password", default="")
    args = parser.parse_args()

    seeder = ERPNextSeeder(
        url=args.url,
        api_key=args.api_key,
        api_secret=args.api_secret,
        user=args.user,
        password=args.password,
    )
    seeder.seed_all()


if __name__ == "__main__":
    main()
