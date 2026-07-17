"""
title: Check Inventory
description: Check pharmacy stock levels, filter by category, or show low-stock alerts.
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
        query: Optional[str] = None,
        category: Optional[str] = None,
        low_stock_only: bool = False,
    ) -> str:
        """
        Check pharmacy inventory. Search by item name, filter by category,
        or show only low-stock items needing reorder.

        :param query: Item name or partial name to search (e.g., "Napa", "paracetamol", "chawal").
        :param category: Filter by item group (e.g., "Antibiotics", "Grocery - Spices").
        :param low_stock_only: If true, only return items below safety stock level.
        :return: Inventory status with stock levels, prices, and shelf locations.
        """
        try:
            filters = [["Item", "disabled", "=", 0]]

            if query:
                filters.append(["Item", "item_name", "like", f"%{query}%"])
            if category:
                filters.append(["Item", "item_group", "like", f"%{category}%"])

            resp = requests.get(
                f"{self.valves.ERPNEXT_URL}/api/resource/Item",
                params={
                    "filters": json.dumps(filters),
                    "fields": json.dumps([
                        "item_code", "item_name", "item_group", "description",
                        "standard_rate", "stock_uom", "safety_stock", "brand"
                    ]),
                    "limit_page_length": 50,
                },
                headers=self._headers(),
                timeout=10,
            )
            resp.raise_for_status()
            items = resp.json().get("data", [])

            if not items and query:
                resp2 = requests.get(
                    f"{self.valves.ERPNEXT_URL}/api/resource/Item",
                    params={
                        "filters": json.dumps([
                            ["Item", "item_code", "like", f"%{query}%"],
                            ["Item", "disabled", "=", 0],
                        ]),
                        "fields": json.dumps([
                            "item_code", "item_name", "item_group", "description",
                            "standard_rate", "stock_uom", "safety_stock", "brand"
                        ]),
                        "limit_page_length": 20,
                    },
                    headers=self._headers(),
                    timeout=10,
                )
                items = resp2.json().get("data", [])

            if not items:
                return json.dumps({"status": "not_found", "message": f"No items found matching '{query or category}'."})

            results = []
            for item in items:
                try:
                    stock_resp = requests.get(
                        f"{self.valves.ERPNEXT_URL}/api/method/erpnext.stock.utils.get_stock_balance",
                        params={"item_code": item["item_code"]},
                        headers=self._headers(),
                        timeout=10,
                    )
                    qty = stock_resp.json().get("message", 0) if stock_resp.status_code == 200 else 0
                except Exception:
                    qty = 0

                safety = item.get("safety_stock", 0) or 0
                if low_stock_only and qty > safety:
                    continue

                status = "Out of Stock" if qty == 0 else "Low Stock" if qty <= safety else "In Stock"

                results.append({
                    "item_code": item["item_code"],
                    "item_name": item["item_name"],
                    "category": item.get("item_group", ""),
                    "price": item.get("standard_rate", 0),
                    "stock_uom": item.get("stock_uom", "Nos"),
                    "available_qty": qty,
                    "safety_stock": safety,
                    "status": status,
                    "brand": item.get("brand", ""),
                })

            return json.dumps({
                "status": "found",
                "count": len(results),
                "low_stock_count": sum(1 for r in results if r["status"] in ("Low Stock", "Out of Stock")),
                "items": results,
            })

        except Exception as e:
            return json.dumps({"status": "error", "message": str(e)})
