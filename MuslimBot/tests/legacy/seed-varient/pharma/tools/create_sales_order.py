"""
title: Create Sales Order
description: Create a pharmacy POS sale or sales order in ERPNext.
author: Quazi
version: 1.0.0
"""

import requests
import json
from datetime import datetime, timedelta
from pydantic import BaseModel, Field


class Tools:
    class Valves(BaseModel):
        ERPNEXT_URL: str = Field(default="http://frappe-web:8000", description="ERPNext base URL")
        ERPNEXT_API_KEY: str = Field(default="", description="Frappe API Key")
        ERPNEXT_API_SECRET: str = Field(default="", description="Frappe API Secret")

    def __init__(self):
        self.valves = self.Valves()

    def _headers(self) -> dict:
        return {
            "Content-Type": "application/json",
            "Authorization": f"token {self.valves.ERPNEXT_API_KEY}:{self.valves.ERPNEXT_API_SECRET}",
        }

    def create_sales_order(
        self,
        customer_name: str,
        items_json: str,
        as_invoice: bool = False,
    ) -> str:
        """
        Create a sales order or direct POS invoice in ERPNext.
        Use as_invoice=True for walk-in cash sales (creates Sales Invoice with stock update).
        Use as_invoice=False for orders to be fulfilled later.

        IMPORTANT: Confirm all items and totals with the customer BEFORE calling this.

        :param customer_name: Customer name in ERPNext (e.g., "Walk-in Customer", "Rahim Uddin").
        :param items_json: JSON array of items. Each needs "item_code" and "qty".
            Example: '[{"item_code": "NAPA-500", "qty": 10}]'
        :param as_invoice: True = POS invoice (immediate sale), False = Sales Order.
        :return: Order/invoice confirmation with total amount.
        """
        try:
            items = json.loads(items_json) if isinstance(items_json, str) else items_json
            if not items:
                return json.dumps({"status": "error", "message": "No items provided."})

            company_resp = requests.get(
                f"{self.valves.ERPNEXT_URL}/api/resource/Company",
                params={"limit_page_length": 1},
                headers=self._headers(), timeout=10,
            )
            company_resp.raise_for_status()
            company = company_resp.json()["data"][0]["name"]
            abbr_resp = requests.get(
                f"{self.valves.ERPNEXT_URL}/api/resource/Company/{company}",
                headers=self._headers(), timeout=10,
            )
            abbr = abbr_resp.json().get("data", {}).get("abbr", "QP")

            cust_resp = requests.get(
                f"{self.valves.ERPNEXT_URL}/api/resource/Customer/{customer_name}",
                headers=self._headers(), timeout=10,
            )
            if cust_resp.status_code != 200:
                return json.dumps({
                    "status": "error",
                    "message": f"Customer '{customer_name}' not found. Create the customer first.",
                })

            doc_items = []
            for item in items:
                item_resp = requests.get(
                    f"{self.valves.ERPNEXT_URL}/api/resource/Item/{item['item_code']}",
                    headers=self._headers(), timeout=10,
                )
                if item_resp.status_code != 200:
                    return json.dumps({"status": "error", "message": f"Item '{item['item_code']}' not found."})

                item_data = item_resp.json().get("data", {})
                rate = item.get("rate", item_data.get("standard_rate", 0))

                entry = {
                    "item_code": item["item_code"],
                    "qty": item["qty"],
                    "rate": rate,
                }

                if as_invoice:
                    entry["warehouse"] = f"Stores - {abbr}"
                else:
                    entry["delivery_date"] = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")

                doc_items.append(entry)

            if as_invoice:
                doc = {
                    "doctype": "Sales Invoice",
                    "customer": customer_name,
                    "company": company,
                    "update_stock": 1,
                    "items": doc_items,
                }
                doctype_label = "Sales Invoice"
                endpoint = "Sales Invoice"
            else:
                doc = {
                    "doctype": "Sales Order",
                    "customer": customer_name,
                    "company": company,
                    "delivery_date": (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d"),
                    "items": doc_items,
                }
                doctype_label = "Sales Order"
                endpoint = "Sales Order"

            resp = requests.post(
                f"{self.valves.ERPNEXT_URL}/api/resource/{endpoint}",
                json=doc,
                headers=self._headers(), timeout=15,
            )

            if resp.status_code in (200, 201):
                data = resp.json().get("data", {})
                doc_name = data.get("name", "")

                requests.put(
                    f"{self.valves.ERPNEXT_URL}/api/resource/{endpoint}/{doc_name}",
                    json={"docstatus": 1},
                    headers=self._headers(), timeout=15,
                )

                total = data.get("grand_total", sum(i["qty"] * i["rate"] for i in doc_items))

                return json.dumps({
                    "status": "success",
                    "type": doctype_label,
                    "document_id": doc_name,
                    "customer": customer_name,
                    "total_amount": total,
                    "items_count": len(doc_items),
                    "message": f"{doctype_label} {doc_name} created. Total: BDT {total:,.2f}",
                })
            else:
                return json.dumps({"status": "error", "message": f"Failed: {resp.text[:300]}"})

        except json.JSONDecodeError:
            return json.dumps({"status": "error", "message": "Invalid items_json format."})
        except Exception as e:
            return json.dumps({"status": "error", "message": str(e)})
