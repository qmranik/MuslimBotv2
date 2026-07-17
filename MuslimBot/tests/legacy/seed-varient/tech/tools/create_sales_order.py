"""
title: Create Sales Order
description: Create a new sales order in ERPNext from conversational inputs.
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
        delivery_days: int = 7,
    ) -> str:
        """
        Create a sales order in ERPNext. Validates item availability before creating.
        Call this AFTER confirming all details with the customer.

        :param customer_name: Exact customer name as registered in ERPNext (e.g., "Rafiq Ahmed").
        :param items_json: JSON array of items. Each needs "item_code" and "qty".
            Example: '[{"item_code": "LAPTOP-T14S", "qty": 2}]'
        :param delivery_days: Days until expected delivery (default: 7).
        :return: Order confirmation with SO number and total, or validation errors.
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

            cust_resp = requests.get(
                f"{self.valves.ERPNEXT_URL}/api/resource/Customer/{customer_name}",
                headers=self._headers(), timeout=10,
            )
            if cust_resp.status_code != 200:
                return json.dumps({
                    "status": "error",
                    "message": f"Customer '{customer_name}' not found in ERPNext. Create the customer first.",
                })

            so_items = []
            for item in items:
                item_resp = requests.get(
                    f"{self.valves.ERPNEXT_URL}/api/resource/Item/{item['item_code']}",
                    headers=self._headers(), timeout=10,
                )
                if item_resp.status_code != 200:
                    return json.dumps({
                        "status": "error",
                        "message": f"Item '{item['item_code']}' not found.",
                    })

                item_data = item_resp.json().get("data", {})
                rate = item.get("rate", item_data.get("standard_rate", 0))

                so_items.append({
                    "item_code": item["item_code"],
                    "qty": item["qty"],
                    "rate": rate,
                    "delivery_date": (datetime.now() + timedelta(days=delivery_days)).strftime("%Y-%m-%d"),
                })

            delivery_date = (datetime.now() + timedelta(days=delivery_days)).strftime("%Y-%m-%d")

            so = {
                "doctype": "Sales Order",
                "customer": customer_name,
                "company": company,
                "delivery_date": delivery_date,
                "items": so_items,
            }

            resp = requests.post(
                f"{self.valves.ERPNEXT_URL}/api/resource/Sales Order",
                json=so,
                headers=self._headers(),
                timeout=15,
            )

            if resp.status_code in (200, 201):
                so_data = resp.json().get("data", {})
                so_name = so_data.get("name", "")

                submit_resp = requests.put(
                    f"{self.valves.ERPNEXT_URL}/api/resource/Sales Order/{so_name}",
                    json={"docstatus": 1},
                    headers=self._headers(), timeout=15,
                )

                total = so_data.get("grand_total", sum(
                    i["qty"] * i["rate"] for i in so_items
                ))

                return json.dumps({
                    "status": "success",
                    "order_id": so_name,
                    "customer": customer_name,
                    "total_amount": total,
                    "delivery_date": delivery_date,
                    "items_count": len(so_items),
                    "submitted": submit_resp.status_code == 200 if 'submit_resp' in dir() else False,
                    "message": f"Sales Order {so_name} created successfully for {customer_name}. Total: BDT {total:,.0f}",
                })
            else:
                return json.dumps({
                    "status": "error",
                    "message": f"Failed to create order: {resp.text[:300]}",
                })

        except json.JSONDecodeError:
            return json.dumps({"status": "error", "message": "Invalid items_json. Expected JSON array."})
        except Exception as e:
            return json.dumps({"status": "error", "message": str(e)})
