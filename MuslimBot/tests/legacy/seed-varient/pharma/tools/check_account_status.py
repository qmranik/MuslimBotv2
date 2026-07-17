"""
title: Check Account Status
description: Fetch financial summary or customer balance from ERPNext pharmacy.
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

    def check_account_status(
        self,
        report_type: str = "summary",
        customer_name: Optional[str] = None,
    ) -> str:
        """
        Get financial account status from the pharmacy's ERPNext.

        Use 'summary' for overall sales, expenses, and outstanding receivables.
        Use 'customer' with a customer_name to check their outstanding balance and purchase history.

        :param report_type: 'summary' for P&L overview, 'customer' for customer balance.
        :param customer_name: Required when report_type is 'customer'.
        :return: Financial data as JSON.
        """
        try:
            if report_type == "customer" and customer_name:
                return self._customer_balance(customer_name)
            return self._financial_summary()
        except Exception as e:
            return json.dumps({"status": "error", "message": str(e)})

    def _financial_summary(self) -> str:
        invoices = requests.get(
            f"{self.valves.ERPNEXT_URL}/api/resource/Sales Invoice",
            params={
                "filters": json.dumps([["docstatus", "=", 1]]),
                "fields": json.dumps(["sum(grand_total) as total_sales", "count(name) as count"]),
                "limit_page_length": 1,
            },
            headers=self._headers(), timeout=15,
        ).json().get("data", [{}])

        outstanding = requests.get(
            f"{self.valves.ERPNEXT_URL}/api/resource/Sales Invoice",
            params={
                "filters": json.dumps([["docstatus", "=", 1], ["outstanding_amount", ">", 0]]),
                "fields": json.dumps(["sum(outstanding_amount) as total", "count(name) as count"]),
                "limit_page_length": 1,
            },
            headers=self._headers(), timeout=15,
        ).json().get("data", [{}])

        sales = invoices[0] if invoices else {}
        unpaid = outstanding[0] if outstanding else {}

        return json.dumps({
            "status": "success",
            "report": "financial_summary",
            "total_sales": sales.get("total_sales", 0),
            "total_invoices": sales.get("count", 0),
            "total_outstanding": unpaid.get("total", 0),
            "unpaid_invoices": unpaid.get("count", 0),
        })

    def _customer_balance(self, customer_name: str) -> str:
        data = requests.get(
            f"{self.valves.ERPNEXT_URL}/api/resource/Sales Invoice",
            params={
                "filters": json.dumps([
                    ["customer", "like", f"%{customer_name}%"],
                    ["docstatus", "=", 1],
                ]),
                "fields": json.dumps([
                    "name", "customer", "grand_total",
                    "outstanding_amount", "posting_date", "status"
                ]),
                "order_by": "posting_date desc",
                "limit_page_length": 10,
            },
            headers=self._headers(), timeout=15,
        ).json().get("data", [])

        if not data:
            return json.dumps({"status": "not_found", "message": f"No invoices found for '{customer_name}'."})

        total_billed = sum(i.get("grand_total", 0) for i in data)
        total_outstanding = sum(i.get("outstanding_amount", 0) for i in data)

        return json.dumps({
            "status": "success",
            "customer": data[0]["customer"],
            "total_billed": total_billed,
            "total_outstanding": total_outstanding,
            "total_paid": total_billed - total_outstanding,
            "invoices": [
                {
                    "invoice": i["name"],
                    "date": i["posting_date"],
                    "total": i["grand_total"],
                    "outstanding": i["outstanding_amount"],
                    "status": i["status"],
                }
                for i in data
            ],
        })
