"""
title: Check Inventory
description: Check real-time stock levels from ERPNext by item name or code.
author: Quazi
version: 1.0.0
"""

import requests
import json
from typing import Optional
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

    def check_inventory(
        self,
        item_name: str,
        warehouse: Optional[str] = None,
    ) -> str:
        """
        Check available stock for a product in ERPNext.
        Use when a customer asks about product availability, stock levels, or pricing.

        :param item_name: Product name or item code to search for.
        :param warehouse: Optional warehouse filter.
        :return: JSON with item details, price, and stock quantity.
        """
        try:
            url = f"{self.valves.ERPNEXT_URL}/api/resource/Item"
            params = {
                "filters": json.dumps([
                    ["Item", "item_name", "like", f"%{item_name}%"],
                    ["Item", "disabled", "=", 0],
                ]),
                "fields": json.dumps([
                    "item_code", "item_name", "description",
                    "standard_rate", "stock_uom", "item_group", "brand",
                    "safety_stock"
                ]),
                "limit_page_length": 10,
            }
            resp = requests.get(url, params=params, headers=self._headers(), timeout=10)

            if resp.status_code != 200:
                params["filters"] = json.dumps([
                    ["Item", "item_code", "like", f"%{item_name}%"],
                    ["Item", "disabled", "=", 0],
                ])
                resp = requests.get(url, params=params, headers=self._headers(), timeout=10)

            resp.raise_for_status()
            items = resp.json().get("data", [])

            if not items:
                return json.dumps({
                    "status": "not_found",
                    "message": f"No products found matching '{item_name}'.",
                })

            results = []
            for item in items:
                stock_url = f"{self.valves.ERPNEXT_URL}/api/method/erpnext.stock.utils.get_stock_balance"
                stock_params = {"item_code": item["item_code"]}
                if warehouse:
                    stock_params["warehouse"] = warehouse

                try:
                    stock_resp = requests.get(stock_url, params=stock_params,
                                              headers=self._headers(), timeout=10)
                    qty = stock_resp.json().get("message", 0) if stock_resp.status_code == 200 else 0
                except Exception:
                    qty = 0

                results.append({
                    "item_code": item["item_code"],
                    "item_name": item["item_name"],
                    "description": item.get("description", ""),
                    "price": item.get("standard_rate", 0),
                    "stock_uom": item.get("stock_uom", "Nos"),
                    "available_qty": qty,
                    "in_stock": qty > 0,
                    "brand": item.get("brand", ""),
                    "category": item.get("item_group", ""),
                })

            return json.dumps({"status": "found", "count": len(results), "items": results})

        except Exception as e:
            return json.dumps({"status": "error", "message": str(e)})
