"""
title: Add Inventory Items
description: Add bulk pharmacy/grocery stock via Material Receipt in ERPNext.
author: Quazi
version: 1.0.0
"""

import requests
import json
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

    def add_inventory_items(
        self,
        items_json: str,
        warehouse: str = "Stores",
    ) -> str:
        """
        Receive stock into the pharmacy warehouse. Creates a Material Receipt stock entry.

        :param items_json: JSON array of items to receive. Each item needs:
            "item_code", "qty", and "rate" (purchase/cost price).
            Example: '[{"item_code": "NAPA-500", "qty": 200, "rate": 1.3}]'
        :param warehouse: Target warehouse name (default: "Stores").
        :return: Confirmation with stock entry ID or error.
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
            target_warehouse = f"{warehouse} - {abbr}"

            se_items = []
            for item in items:
                se_items.append({
                    "item_code": item["item_code"],
                    "qty": item["qty"],
                    "basic_rate": item.get("rate", 0),
                    "t_warehouse": target_warehouse,
                })

            resp = requests.post(
                f"{self.valves.ERPNEXT_URL}/api/resource/Stock Entry",
                json={
                    "doctype": "Stock Entry",
                    "stock_entry_type": "Material Receipt",
                    "company": company,
                    "items": se_items,
                },
                headers=self._headers(), timeout=15,
            )
            resp.raise_for_status()
            se_name = resp.json().get("data", {}).get("name", "")

            submit = requests.put(
                f"{self.valves.ERPNEXT_URL}/api/resource/Stock Entry/{se_name}",
                json={"docstatus": 1},
                headers=self._headers(), timeout=15,
            )

            if submit.status_code == 200:
                return json.dumps({
                    "status": "success",
                    "stock_entry": se_name,
                    "warehouse": target_warehouse,
                    "items_added": len(se_items),
                    "message": f"Stock entry {se_name} submitted. {len(se_items)} item(s) received.",
                })
            else:
                return json.dumps({
                    "status": "partial",
                    "stock_entry": se_name,
                    "message": f"Entry created as draft ({se_name}). Submit manually in ERPNext.",
                })

        except json.JSONDecodeError:
            return json.dumps({"status": "error", "message": "Invalid items_json format."})
        except Exception as e:
            return json.dumps({"status": "error", "message": str(e)})
