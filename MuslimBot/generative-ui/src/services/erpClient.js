/**
 * ERP Client — Fetches live data from the Frappe/ERPNext backend
 * via the small_erp API endpoints.
 *
 * Authentication is handled by the Vite proxy (dev) or nginx (prod)
 * so no API keys are present in this client-side code.
 *
 * All requests go to /api/method/... which the proxy forwards
 * to frappe-web:8000 with the correct Host & Authorization headers.
 */

// ─── Core transport ─────────────────────────────────────────────────

/**
 * Call a Frappe whitelisted method.
 * @param {string} method  Dotted method path (e.g. "small_erp.api.dashboard.get_dashboard_kpis")
 * @param {Object} args    Arguments to pass
 * @param {"GET"|"POST"} httpMethod
 * @returns {Promise<any>}  The `message` payload from the Frappe response
 */
async function frappeCall(method, args = {}, httpMethod = 'GET') {
  let url = `/api/method/${method}`;
  if (method.startsWith('small_erp.api.')) {
    const subPath = method.substring('small_erp.'.length);
    const slashPath = subPath.replace(/\./g, '/');
    url = `/v1/erp/${slashPath}`;
  }

  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-Frappe-CSRF-Token': 'None',
  };

  let response;

  if (httpMethod === 'GET') {
    const filteredArgs = Object.fromEntries(
      Object.entries(args).filter(([, v]) => v !== '' && v !== undefined && v !== null)
    );
    const params = new URLSearchParams(filteredArgs).toString();
    const fullUrl = params ? `${url}?${params}` : url;
    response = await fetch(fullUrl, { headers });
  } else {
    response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(args),
    });
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(
      `Frappe API [${response.status}] ${method}: ${errorText.slice(0, 200)}`
    );
  }

  const data = await response.json();
  return data.message || data;
}

// ─── Health check ───────────────────────────────────────────────────

export async function checkERPConnection() {
  try {
    const data = await getDashboardKPIs();
    return data !== undefined;
  } catch {
    return false;
  }
}

// ─── GenUI snapshot ─────────────────────────────────────────────────

export async function getERPSnapshot(pageSize = 100) {
  return frappeCall('small_erp.api.genui.get_erp_snapshot', { page_size: pageSize });
}

export async function getDefaultWarehouse() {
  return frappeCall('small_erp.api.genui.get_default_warehouse');
}

// ─── Dashboard ──────────────────────────────────────────────────────

export async function getDashboardKPIs() {
  return frappeCall('small_erp.api.dashboard.get_dashboard_kpis');
}

export async function getRevenueChartData(period = 'monthly') {
  return frappeCall('small_erp.api.dashboard.get_revenue_chart_data', { period });
}

export async function getMonthlyPerformance(months = 12) {
  return frappeCall('small_erp.api.dashboard.get_monthly_performance', { months });
}

export async function getRecentActivity(limit = 10) {
  return frappeCall('small_erp.api.dashboard.get_recent_activity', { limit });
}

// ─── Orders / Invoices ──────────────────────────────────────────────

export async function getOrders({ status, customer, search, page, page_size } = {}) {
  return frappeCall('small_erp.api.orders.get_orders', {
    status: status || '',
    customer: customer || '',
    search: search || '',
    page: page || 1,
    page_size: page_size || 50,
  });
}

export async function getOrderDetail(invoiceName) {
  return frappeCall('small_erp.api.orders.get_order_detail', {
    invoice_name: invoiceName,
  });
}

// ─── Customers ──────────────────────────────────────────────────────

export async function getCustomers({ search, page, page_size } = {}) {
  return frappeCall('small_erp.api.customers.get_customers', {
    search: search || '',
    page: page || 1,
    page_size: page_size || 50,
  });
}

export async function getCustomerDetail(customerName) {
  return frappeCall('small_erp.api.customers.get_customer_detail', {
    customer_name: customerName,
  });
}

export async function searchCustomers(query) {
  return frappeCall('small_erp.api.customers.search_customers', { query });
}

// ─── Inventory ──────────────────────────────────────────────────────

export async function getItems({ search, item_group, page, page_size } = {}) {
  return frappeCall('small_erp.api.inventory.get_items', {
    search: search || '',
    item_group: item_group || '',
    page: page || 1,
    page_size: page_size || 50,
  });
}

export async function getItemDetail(itemCode) {
  return frappeCall('small_erp.api.inventory.get_item_detail', {
    item_code: itemCode,
  });
}

export async function getLowStockItems(limit = 20) {
  return frappeCall('small_erp.api.inventory.get_low_stock_items', { limit });
}

export async function getItemGroups() {
  return frappeCall('small_erp.api.inventory.get_item_groups');
}

// ─── Accounting ─────────────────────────────────────────────────────

export async function getProfitAndLoss(period = 'this_month') {
  return frappeCall('small_erp.api.accounting.get_profit_and_loss', { period });
}

export async function getReceivables(page = 1) {
  return frappeCall('small_erp.api.accounting.get_receivables', { page });
}

export async function getPayables(page = 1) {
  return frappeCall('small_erp.api.accounting.get_payables', { page });
}

export async function getExpenseBreakdown(period = 'this_month') {
  return frappeCall('small_erp.api.accounting.get_expense_breakdown', { period });
}

export async function getCashFlowSummary() {
  return frappeCall('small_erp.api.accounting.get_cash_flow_summary');
}

// ─── Write Operations ───────────────────────────────────────────────

export async function createStockEntry({ entryType, items, sourceWarehouse, targetWarehouse }) {
  let warehouse = targetWarehouse;
  if (!warehouse) {
    const wh = await getDefaultWarehouse();
    warehouse = wh?.warehouse || '';
  }
  return frappeCall('small_erp.api.inventory.create_stock_entry', {
    entry_type: entryType,
    items_json: JSON.stringify(items),
    source_warehouse: sourceWarehouse || '',
    target_warehouse: warehouse,
  }, 'POST');
}

export async function createItem({ itemName, itemGroup, stockUom, standardRate, description }) {
  return frappeCall('small_erp.api.inventory.create_item', {
    item_name: itemName,
    item_group: itemGroup || 'Products',
    stock_uom: stockUom || 'Nos',
    standard_rate: standardRate || 0,
    description: description || '',
  }, 'POST');
}

export async function createCustomer({ customerName, customerGroup, mobileNo, emailId, territory }) {
  return frappeCall('small_erp.api.customers.create_customer', {
    customer_name: customerName,
    customer_group: customerGroup || '',
    mobile_no: mobileNo || '',
    email_id: emailId || '',
    territory: territory || '',
  }, 'POST');
}

export async function updateCustomer({ customer, customerName, mobileNo, emailId, customerGroup, territory }) {
  return frappeCall('small_erp.api.customers.update_customer', {
    customer,
    customer_name: customerName || undefined,
    mobile_no: mobileNo || undefined,
    email_id: emailId || undefined,
    customer_group: customerGroup || undefined,
    territory: territory || undefined,
  }, 'POST');
}

export async function createSalesInvoice({ customer, items, postingDate, dueDate }) {
  return frappeCall('small_erp.api.orders.create_sales_invoice', {
    customer,
    items_json: JSON.stringify(items),
    posting_date: postingDate || null,
    due_date: dueDate || null,
  }, 'POST');
}

export async function recordPayment({ invoiceName, amount, modeOfPayment }) {
  return frappeCall('small_erp.api.orders.record_payment', {
    invoice_name: invoiceName,
    amount,
    mode_of_payment: modeOfPayment || 'Cash',
  }, 'POST');
}

export async function posCheckout({ customer, items, modeOfPayment, discountPercentage, remarks }) {
  return frappeCall('small_erp.api.pos.pos_checkout', {
    customer: customer || '',
    items_json: JSON.stringify(items),
    mode_of_payment: modeOfPayment || 'Cash',
    discount_percentage: discountPercentage || 0,
    remarks: remarks || '',
  }, 'POST');
}

// ─── Composite: Build ERP Context for Gemini NLP Router ─────────────

/**
 * Fetches a comprehensive snapshot via a single Frappe endpoint.
 * Falls back to null if the backend is unreachable.
 */
export async function fetchERPContext() {
  try {
    const snapshot = await getERPSnapshot(100);
    if (snapshot && snapshot._meta?.source === 'live-erp') {
      return snapshot;
    }
    return null;
  } catch (error) {
    console.error('Failed to fetch ERP context:', error);
    return null;
  }
}
