import { GoogleGenerativeAI } from "@google/generative-ai";
import { fetchERPContext, checkERPConnection } from "./erpClient";
import { dummyDatabase } from "../data/database";

/**
 * Gemini NLP Router & Service
 * Orchestrates API calls to Google Gemini to interpret natural language queries over the ERP database,
 * returning structured JSON instructions specifying the UI component type and computed/filtered data.
 *
 * Data flow:
 *   1. Attempts to fetch LIVE data from ERPNext via erpClient.js
 *   2. Falls back to static dummyDatabase if the ERP is unreachable
 *   3. Passes the data to either Gemini (live mode) or the mock router (offline mode)
 */

// ─── ERP Data Cache ─────────────────────────────────────────────────
let cachedERPContext = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get ERP data — live from the backend or cached.
 * Falls back to dummyDatabase if the ERP is unreachable.
 * @returns {Promise<{data: Object, source: 'live'|'cache'|'mock'}>}
 */
async function getERPData() {
  const now = Date.now();

  // Return cached data if still fresh
  if (cachedERPContext && (now - cacheTimestamp) < CACHE_TTL) {
    return { data: cachedERPContext, source: 'cache' };
  }

  // Try fetching live data from the ERP
  try {
    const liveData = await fetchERPContext();
    if (liveData && liveData._meta?.source === 'live-erp') {
      liveData.monthlyPerformance = resolveMonthlyPerformance(liveData);
      cachedERPContext = liveData;
      cacheTimestamp = now;
      return { data: liveData, source: 'live' };
    }
  } catch (err) {
    console.warn('ERP data fetch failed, using fallback:', err.message);
  }

  // Fallback to static dummy data
  return { data: dummyDatabase, source: 'mock' };
}

/** Invalidate the ERP data cache (e.g., after a write operation). */
export function invalidateERPCache() {
  cachedERPContext = null;
  cacheTimestamp = 0;
}

/** Derive monthly revenue buckets from invoice list when series is empty. */
function deriveMonthlyPerformanceFromInvoices(invoices) {
  if (!invoices?.length) return [];
  const buckets = {};
  for (const inv of invoices) {
    if (!inv.date) continue;
    const key = inv.date.slice(0, 7);
    buckets[key] = (buckets[key] || 0) + (Number(inv.amount) || 0);
  }
  return Object.entries(buckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, revenue]) => {
      const [y, m] = key.split('-').map(Number);
      const label = new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'short', year: 'numeric' });
      return { month: label, month_key: key, revenue, expenses: 0, profit: revenue };
    });
}

/** Ensure monthlyPerformance has usable rows for trend charts. */
function resolveMonthlyPerformance(database) {
  let series = database.monthlyPerformance || [];
  const hasRevenue = series.some((m) => Number(m.revenue) > 0);
  const hasExpenses = series.some((m) => Number(m.expenses) > 0);

  if (series.length === 0 || (!hasRevenue && !hasExpenses)) {
    const derived = deriveMonthlyPerformanceFromInvoices(database.invoices);
    if (derived.length) {
      series = derived;
    }
  }
  return series;
}

/** Get the current data source status. */
export function getDataSourceStatus() {
  if (cachedERPContext && cachedERPContext._meta?.source === 'live-erp') {
    return 'live';
  }
  return 'mock';
}

// Helper to get Gemini API Key from localStorage or environment
export const getApiKey = () => {
  return localStorage.getItem("gemini_api_key") || import.meta.env.VITE_GEMINI_API_KEY || "";
};

// Helper to save key
export const saveApiKey = (key) => {
  if (key) {
    localStorage.setItem("gemini_api_key", key);
  } else {
    localStorage.removeItem("gemini_api_key");
  }
};

/**
 * Robust Mock Router
 * Evaluates queries locally and builds highly computed structured data
 * to demonstrate the Generative UI engine without requiring an API key.
 */
const runMockRouter = (query, db = null) => {
  const database = db || dummyDatabase;
  const normalized = query.toLowerCase();

  const invoices = database.invoices || [];
  const customers = database.customers || [];
  const products = database.products || [];
  const monthlyPerf = resolveMonthlyPerformance(database);
  const kpis = database.kpis || null;
  const defaultWarehouse = database.defaultWarehouse || 'Stores - LDI';

  // ─── ACTION - Intercepting Write Operations ───────────────────────
  // A. Stock Adjustment / Receipt (e.g., "please add 10 box of napa")
  if (normalized.includes("add") && (normalized.includes("stock") || normalized.includes("napa") || normalized.includes("qty") || normalized.includes("box") || normalized.includes("itm001") || normalized.includes("banana"))) {
    const qtyMatch = normalized.match(/(\d+)/);
    const qty = qtyMatch ? parseInt(qtyMatch[1], 10) : 10;
    
    let itemCode = "ITM001";
    let itemName = "Super Widget A";
    if (normalized.includes("napa") && normalized.includes("extra")) {
      itemCode = "NAPA-EX";
      itemName = "Napa Extra";
    } else if (normalized.includes("napa") && normalized.includes("syr")) {
      itemCode = "NAPA-SYR";
      itemName = "Napa Syrup 60ml";
    } else if (normalized.includes("napa") && normalized.includes("baby")) {
      itemCode = "BABY-NAPA";
      itemName = "Baby Napa Drops 15ml";
    } else if (normalized.includes("napa")) {
      itemCode = "NAPA-500";
      itemName = "Napa 500mg (Paracetamol)";
    } else if (normalized.includes("banana")) {
      itemCode = "NANO-BANANA";
      itemName = "Nano Banana Energy Supplement";
    } else {
      const matchingProduct = products.find(p => normalized.includes(p.name.toLowerCase()));
      if (matchingProduct) {
        itemCode = matchingProduct.id;
        itemName = matchingProduct.name;
      }
    }

    return {
      component: "action",
      title: "Confirm Stock Entry (Material Receipt)",
      actionType: "create_stock_entry",
      actionParams: {
        entryType: "Material Receipt",
        items: [{ item_code: itemCode, qty: qty, rate: 0 }],
        targetWarehouse: defaultWarehouse
      },
      explanation: `I've prepared a Stock Entry proposal to receive **${qty} unit(s)** of **${itemName} (${itemCode})** into **${defaultWarehouse}**. Please confirm to submit this to the ERP.`
    };
  }

  // B. Create Customer
  if (normalized.includes("create customer") || normalized.includes("add customer")) {
    const nameMatch = query.match(/(?:customer|add)\s+([A-Za-z\s]+)(?:\s+|$)/i);
    let customerName = nameMatch ? nameMatch[1].trim() : "New Customer";
    if (customerName.toLowerCase().startsWith("customer")) {
      customerName = customerName.slice(8).trim();
    }
    
    const missingFields = [];
    if (!normalized.includes("@")) missingFields.push("emailId");
    if (!normalized.match(/\d{5}/)) missingFields.push("mobileNo");

    return {
      component: "action",
      title: "Confirm New Customer Creation",
      actionType: "create_customer",
      missingFields: missingFields,
      actionParams: {
        customerName: customerName,
        customerGroup: "General",
        mobileNo: normalized.match(/\d{5,}/) ? normalized.match(/\d{5,}/)[0] : "",
        emailId: normalized.includes("@") ? query.match(/\S+@\S+\.\S+/)?.[0] || "" : "",
        territory: "All Territories"
      },
      explanation: missingFields.length > 0
        ? `I've prepared a proposal to create **"${customerName}"**, but I need you to provide the following required fields: ${missingFields.join(', ')}.`
        : `I've prepared a proposal to create a new customer **"${customerName}"**. Please confirm to save this to your database.`
    };
  }

  // C. Create Product / Item
  if (normalized.includes("create item") || normalized.includes("add item") || normalized.includes("create product") || normalized.includes("add product")) {
    const nameMatch = query.match(/(?:item|product)\s+([A-Za-z0-9\s]+)(?:\s+|$)/i);
    let itemName = nameMatch ? nameMatch[1].trim() : "New Product Item";
    
    return {
      component: "action",
      title: "Confirm Product Item Creation",
      actionType: "create_item",
      actionParams: {
        itemName: itemName,
        itemGroup: "Products",
        stockUom: "Nos",
        standardRate: 100.0,
        description: `Standard ${itemName}`
      },
      explanation: `I've drafted a product entry for **"${itemName}"** under the **Products** group. Please confirm to add it to the catalog.`
    };
  }

  // D. Create Invoice / Sales Invoice
  if (normalized.includes("create invoice") || normalized.includes("add invoice") || normalized.includes("create order") || normalized.includes("add order")) {
    const customer = customers[0]?.name || "Demo Client";
    const product = products[0]?.id || "ITM001";
    const productName = products[0]?.name || "Super Widget A";
    const price = products[0]?.price || 450;

    return {
      component: "action",
      title: "Confirm Sales Invoice Creation",
      actionType: "create_invoice",
      actionParams: {
        customer: customer,
        items: [{ item_code: product, qty: 1, rate: price }]
      },
      explanation: `I've drafted a Sales Invoice for client **"${customer}"** with 1 unit of **${productName} ($${price})**. Confirm to submit.`
    };
  }

  // E. Record Payment
  if (normalized.includes("record payment") || normalized.includes("add payment") || normalized.includes("pay invoice")) {
    const overdue = invoices.filter((i) => i.status === 'Overdue' || i.status === 'Pending');
    const target = overdue[0] || invoices[0];
    const invoiceNum = target?.invoiceNumber || target?.name || "INV-0001";
    const amount = target?.outstanding || target?.amount || 100;

    return {
      component: "action",
      title: "Confirm Payment Entry",
      actionType: "record_payment",
      actionParams: {
        invoiceName: invoiceNum,
        amount: amount,
        modeOfPayment: "Cash"
      },
      explanation: `I've prepared a Payment Entry to record **$${amount}** against outstanding Invoice **${invoiceNum}**. Confirm to submit.`
    };
  }

  // F. POS Checkout
  if (normalized.includes("pos checkout") || normalized.includes("checkout") || normalized.includes("sell at pos")) {
    const customer = customers[0]?.name || customers[0]?.id || '';
    const product = products[0];
    return {
      component: "action",
      title: "Confirm POS Checkout",
      actionType: "pos_checkout",
      actionParams: {
        customer,
        items: [{ item_code: product?.id || 'ITM001', qty: 1, rate: product?.price || 100 }],
        modeOfPayment: "Cash",
      },
      explanation: `POS checkout draft for **${customer}** with 1× **${product?.name || 'item'}**. Confirm to create invoice + payment.`
    };
  }

  // G. Update Customer
  if (normalized.includes("update customer") || normalized.includes("edit customer")) {
    const target = customers.find((c) => normalized.includes((c.name || '').toLowerCase())) || customers[0];
    return {
      component: "action",
      title: "Confirm Customer Update",
      actionType: "update_customer",
      actionParams: {
        customer: target?.id || target?.name,
        customerName: target?.name,
        emailId: target?.email || '',
        mobileNo: target?.phone || '',
      },
      explanation: `Update profile for **${target?.name || 'customer'}**. Confirm to save changes.`
    };
  }

  if (normalized.includes("low stock")) {
    const lowItems = products.filter((p) => Number(p.stock) <= 5 || Number(p.available) <= 5);
    return {
      component: "table",
      title: "Low Stock Items",
      columns: [
        { key: "name", label: "Item" },
        { key: "category", label: "Group" },
        { key: "stock", label: "Stock Qty" },
        { key: "available", label: "Available" },
      ],
      data: (lowItems.length ? lowItems : products.slice(0, 10)).map((p) => ({
        name: p.name,
        category: p.category,
        stock: p.stock,
        available: p.available,
      })),
      explanation: `Showing ${lowItems.length || 'catalog'} items with low or zero stock levels.`
    };
  }

  if (normalized.includes("trend") || normalized.includes("revenue") || normalized.includes("sales") || normalized.includes("growth") || normalized.includes("chart") || normalized.includes("expense")) {
    const isExpenses = normalized.includes("expense") || normalized.includes("spending");
    const isUsers = normalized.includes("user") || normalized.includes("signup");
    const isPie = normalized.includes("pie") || normalized.includes("category") || normalized.includes("share");
    const isLine = normalized.includes("line");
    
    if (isPie || normalized.includes("breakdown") || normalized.includes("distribution")) {
      // Group invoices by Category
      const breakdown = invoices.reduce((acc, inv) => {
        const cat = inv.category || inv.item_group || 'Other';
        acc[cat] = (acc[cat] || 0) + (inv.amount || 0);
        return acc;
      }, {});

      const chartData = Object.keys(breakdown).map(cat => ({
        label: cat,
        value: Math.round(breakdown[cat])
      }));

      return {
        component: "chart",
        title: "Revenue Share by Product Category",
        chartType: "pie",
        data: chartData,
        explanation: "This pie chart shows our overall revenue distribution across major business sectors: Software, Hardware, Consulting, and Support. Software and Consulting represent our primary growth drivers."
      };
    }

    if (isUsers) {
      const data = monthlyPerf.map(m => ({
        label: typeof m.month === 'string' && m.month.includes(' ') ? m.month.split(" ")[0] + " " + m.month.split(" ")[1].slice(2) : m.month,
        value: m.activeUsers
      })).slice(-12);

      return {
        component: "chart",
        title: "Active Customer Sign-ups (Last 12 Months)",
        chartType: "area",
        data,
        explanation: "Here is the user sign-up trajectory for the last 12 months. We notice steady compounding growth with record monthly active sign-ups in early 2026."
      };
    }

    // Revenue vs expenses trend (dual series bar chart)
    const isDualTrend = isExpenses || normalized.includes("vs") || normalized.includes("versus");
    const chartRows = monthlyPerf.length
      ? monthlyPerf
      : deriveMonthlyPerformanceFromInvoices(invoices);

    if (chartRows.length) {
      const data = chartRows.slice(-12).map((m) => {
        const label = typeof m.month === 'string' && m.month.includes(' ')
          ? m.month.split(' ')[0] + ' ' + m.month.split(' ')[1]?.slice(2)
          : m.month;
        const revenue = Number(m.revenue) || 0;
        const expenses = Number(m.expenses) || 0;
        return {
          label,
          value: revenue,
          secondaryValue: isDualTrend ? expenses : (m.profit != null ? Number(m.profit) : revenue - expenses),
        };
      });

      const allExpensesZero = data.every((d) => !d.secondaryValue || d.secondaryValue === 0);
      const note = allExpensesZero && data.some((d) => d.value > 0)
        ? ' Expense GL entries are zero — showing revenue bars only.'
        : '';

      return {
        component: "chart",
        title: isDualTrend ? "Monthly Revenue vs Expenses" : "Revenue Trend",
        chartType: isLine ? "line" : "bar",
        data,
        explanation: `Monthly financial trend from live ERP data.${note} Green bars show ${isDualTrend && !allExpensesZero ? 'expenses' : 'net margin / profit'}.`
      };
    }

    // Fallback: aggregate from P&L if available
    if (kpis?.revenue?.value || database.profitAndLoss?.income?.value) {
      const rev = Number(kpis?.revenue?.value || database.profitAndLoss?.income?.value || 0);
      const exp = Number(database.profitAndLoss?.expenses?.value || 0);
      return {
        component: "chart",
        title: "Financial Overview (Period Total)",
        chartType: "bar",
        data: [
          { label: 'Revenue', value: rev },
          { label: 'Expenses', value: exp, secondaryValue: exp },
        ],
        explanation: 'Sparse monthly data — showing period totals from KPIs and P&L instead of refusing.'
      };
    }
  }

  // 2. TABLE - Dynamic Lists & Filtered Data
  if (normalized.includes("list") || normalized.includes("table") || normalized.includes("invoice") || normalized.includes("customer") || normalized.includes("client") || normalized.includes("product") || normalized.includes("show")) {
    
    // Invoices list
    if (normalized.includes("invoice")) {
      let filteredInvoices = [...invoices];
      let title = "ERP Global Invoices Log";

      if (normalized.includes("overdue")) {
        filteredInvoices = filteredInvoices.filter(i => i.status === "Overdue");
        title = "Overdue Accounts Invoices";
      } else if (normalized.includes("pending")) {
        filteredInvoices = filteredInvoices.filter(i => i.status === "Pending");
        title = "Pending Settlement Invoices";
      } else if (normalized.includes("paid")) {
        filteredInvoices = filteredInvoices.filter(i => i.status === "Paid");
        title = "Settled Paid Invoices";
      }

      // If specific category requested
      if (normalized.includes("software")) {
        filteredInvoices = filteredInvoices.filter(i => i.category === "Software");
        title += " (Software Category)";
      } else if (normalized.includes("support")) {
        filteredInvoices = filteredInvoices.filter(i => i.category === "Support");
        title += " (Support Addons)";
      }

      return {
        component: "table",
        title: title,
        columns: [
          { key: "invoiceNumber", label: "Invoice #" },
          { key: "customerName", label: "Client" },
          { key: "category", label: "Category" },
          { key: "date", label: "Issue Date" },
          { key: "amount", label: "Amount" },
          { key: "status", label: "Status" }
        ],
        data: filteredInvoices.map(i => ({
          ...i,
          amount: `$${i.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        })),
        explanation: `Extracted ${filteredInvoices.length} invoice records matching your filters. You can sort the columns or search directly using the interactive search bar inside the table.`
      };
    }

    // Customers list
    if (normalized.includes("customer") || normalized.includes("client")) {
      const data = customers.map(c => ({
        id: c.id,
        name: c.name,
        email: c.email,
        company: c.company,
        revenue: `$${c.totalRevenue.toLocaleString()}`,
        country: c.country,
        status: c.status
      }));

      return {
        component: "table",
        title: "Active Enterprise Customers & Global Accounts",
        columns: [
          { key: "name", label: "Client Name" },
          { key: "company", label: "Organization" },
          { key: "email", label: "Email Address" },
          { key: "revenue", label: "Total Billing" },
          { key: "country", label: "Region" },
          { key: "status", label: "Status" }
        ],
        data,
        explanation: "Here is the master customer index, demonstrating complete details on total custom revenue billing, locations, and system activity status."
      };
    }

    // Products List
    if (normalized.includes("product") || normalized.includes("inventory") || normalized.includes("stock")) {
      const data = products.map(p => ({
        ...p,
        price: `$${p.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
        stock: p.stock === 9999 ? "∞ Unlimited" : p.stock,
        rating: `${p.rating} ★`
      }));

      return {
        component: "table",
        title: "ERP Service Catalog & Product Catalog",
        columns: [
          { key: "name", label: "Service / Product Name" },
          { key: "category", label: "Classification" },
          { key: "price", label: "Unit Value" },
          { key: "stock", label: "In Stock" },
          { key: "rating", label: "Rating" }
        ],
        data,
        explanation: "Loaded active catalog software packages, edge-hardware products, and hourly support pricing metrics with dynamic ratings."
      };
    }
  }

  // 3. METRICS - Comprehensive KPI Summaries
  if (normalized.includes("kpi") || normalized.includes("summary") || normalized.includes("overview") || normalized.includes("dashboard") || normalized.includes("metric") || normalized.includes("performance")) {
    // If we have live KPIs from the ERP, use them directly
    if (kpis && kpis.revenue) {
      return {
        component: "metrics",
        title: "ERP Core Executive KPI Summary (Live)",
        metrics: [
          { label: kpis.revenue.label || "Revenue", value: kpis.revenue.formatted || `$${kpis.revenue.value}`, change: "", trend: "up" },
          { label: kpis.orders?.label || "Orders", value: String(kpis.orders?.value || 0), change: "", trend: "up" },
          { label: kpis.pending?.label || "Pending Orders", value: String(kpis.pending?.value || 0), change: "", trend: "neutral" },
          { label: kpis.receivable?.label || "Receivable", value: kpis.receivable?.formatted || `$${kpis.receivable?.value || 0}`, change: "", trend: "down" },
          { label: kpis.low_stock?.label || "Low Stock", value: String(kpis.low_stock?.value || 0), change: "", trend: kpis.low_stock?.value > 5 ? "down" : "neutral" },
          { label: kpis.customers?.label || "Active Customers", value: String(kpis.customers?.value || 0), change: "", trend: "up" },
        ],
        explanation: "Live KPI data pulled directly from the ERPNext system. Revenue and order counts reflect real submitted invoices."
      };
    }

    // Fallback: compute from invoice list
    const totalRevenue = invoices
      .filter(i => i.status === "Paid")
      .reduce((sum, i) => sum + (i.amount || 0), 0);

    const pendingRevenue = invoices
      .filter(i => i.status === "Pending")
      .reduce((sum, i) => sum + (i.amount || 0), 0);

    const overdueRevenue = invoices
      .filter(i => i.status === "Overdue")
      .reduce((sum, i) => sum + (i.amount || 0), 0);

    return {
      component: "metrics",
      title: "ERP Core Executive KPI Summary",
      metrics: [
        { label: "Gross Settled Revenue", value: `$${totalRevenue.toLocaleString()}`, change: "+14.8%", trend: "up" },
        { label: "Pipeline Collections", value: `$${pendingRevenue.toLocaleString()}`, change: "7 Invoices Pending", trend: "neutral" },
        { label: "Receivables Risk (Overdue)", value: `$${overdueRevenue.toLocaleString()}`, change: "High Risk Area", trend: "down" },
        { label: "Active User Core", value: "3,400 Accounts", change: "+8.2% MoM Growth", trend: "up" }
      ],
      explanation: "This KPI matrix highlights key business financials and growth metrics. Revenue settlement has increased by 14.8% since Q4, although overdue receivables represent a small risk area."
    };
  }

  // 4. CARD - Profiles & Detail Cards
  if (normalized.includes("detail") || normalized.includes("profile") || normalized.includes("who is") || normalized.includes("about") || normalized.includes("find")) {
    // Look for matching customer names
    const matchingCustomer = customers.find(c => 
      normalized.includes((c.name || '').toLowerCase()) || 
      normalized.includes((c.company || '').toLowerCase()) ||
      (c.name === "Wayne Enterprises" && normalized.includes("wayne")) ||
      (c.name === "Stark Industries" && normalized.includes("stark")) ||
      (c.name === "Acme Corp" && normalized.includes("acme"))
    );

    if (matchingCustomer) {
      // Find invoices for this customer
      const custInvoices = invoices.filter(i => (i.customerName || i.customer_name) === matchingCustomer.name);
      const invoiceCount = custInvoices.length;
      const outstanding = custInvoices
        .filter(i => i.status !== "Paid")
        .reduce((sum, i) => sum + (i.amount || 0), 0);

      return {
        component: "card",
        title: `${matchingCustomer.name} Account Profile`,
        cardDetails: {
          title: matchingCustomer.name,
          subtitle: matchingCustomer.company,
          details: [
            { label: "Account Email", value: matchingCustomer.email },
            { label: "Headquarters Region", value: matchingCustomer.country },
            { label: "Total Billing Record", value: `$${matchingCustomer.totalRevenue.toLocaleString()}` },
            { label: "Outstanding Receivables", value: `$${outstanding.toLocaleString()}` },
            { label: "Invoice Volume", value: `${invoiceCount} generated` },
            { label: "Status Level", value: matchingCustomer.status }
          ]
        },
        explanation: `Successfully aggregated profile statistics for ${matchingCustomer.name}. Outstanding invoices: $${outstanding}. Status is currently ${matchingCustomer.status}.`
      };
    }
  }

  // Default: Smart Text / Informational Fallback
  return {
    component: "text",
    title: "Conversational Response",
    explanation: `I've analyzed your prompt: "${query}". \n\nI can render rich dynamic UIs! Try asking me one of these precise command queries:\n\n📊 *Show a chart of revenue vs expenses trend.*\n📋 *Show overdue invoices in a table.*\n📈 *Compare active user growth over time.*\n📊 *Render revenue category share in a pie chart.*\n💼 *Show details for customer Stark Industries.*\n⭐ *Show me a summary of business KPIs.*`
  };
};

/**
 * Main NLP Router Execution
 * Connects to Gemini API if the user has provided an API key,
 * otherwise routes immediately to our high-fidelity Mock Router.
 */
export const runNLPRouter = async (query, history = []) => {
  const apiKey = getApiKey();

  // Always fetch ERP data first (cached if fresh)
  const { data: erpData, source: dataSource } = await getERPData();

  // If no API key is provided, run our mock router with live data
  if (!apiKey) {
    return new Promise((resolve) => {
      setTimeout(() => {
        const result = runMockRouter(query, erpData);
        result._dataSource = dataSource;
        result._meta = { generatedAt: new Date().toISOString(), dataSource };
        resolve(result);
      }, dataSource === 'live' ? 500 : 1000);
    });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    // Use gemini-2.5-flash for incredibly fast and accurate structure
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
      }
    });

    const dbContext = JSON.stringify(erpData, null, 2);

    const dataLabel = dataSource === 'live' ? 'LIVE ERP DATA (from ERPNext)' : 'OFFLINE SAMPLE DATA';

    const defaultWh = erpData.defaultWarehouse || 'use defaultWarehouse from database JSON';

    const systemInstruction = `
You are the NLP Router, Data Processor, and Generative UI coordinator for a Small ERP SaaS Dashboard.
DATA SOURCE: ${dataLabel}
Your job is to analyze the user's natural language request (and chat history) and determine which interactive React UI component should be rendered, along with the precise processed data needed to render it.

You have DIRECT access to the complete database below:
--- DATABASE JSON START ---
${dbContext}
--- DATABASE JSON END ---

AVAILABLE ERP WRITE ENDPOINTS (emit "action" component for these):
- create_stock_entry → Material Receipt/Issue (use defaultWarehouse="${defaultWh}" for targetWarehouse)
- create_customer → new Customer record
- create_item → new Item/Product
- create_invoice → Sales Invoice
- record_payment → Payment Entry against invoice
- pos_checkout → POS sale (invoice + payment in one step)
- update_customer → edit existing Customer fields

CHART RULES (critical):
- Prefer monthlyPerformance[] for revenue/expense trend charts. Each row has { month, revenue, expenses, profit }.
- For revenue vs expenses bar charts: use chartType "bar", data as [{ label: month, value: revenue, secondaryValue: expenses }].
- If expenses are all zero but revenue exists, still render a revenue chart and explain — NEVER refuse with "no monthlyPerformance data".
- If monthlyPerformance is sparse, aggregate from invoices[] by posting date or use profitAndLoss / kpis totals.
- NEVER return plain-text refusal when partial data can be charted.

RULES:
1. Always output exactly conforming to the JSON schema below. DO NOT wrap the output in codeblocks, return raw JSON string.
2. Select the most appropriate "component" type ONLY from the allowed list:
   - "chart": trends, revenue growth, metrics comparison, distribution.
     - Provide "chartType" ("bar", "line", "area", "pie") and "data": [{ label, value, secondaryValue? }].
   - "table": lists of invoices, products, customers, inventory.
   - "metrics": KPI dashboard from kpis{} or computed aggregates.
   - "card": single customer/product detail.
   - "action": write operations.
     - If the user omitted mandatory fields (e.g. they asked to create an invoice but didn't specify the items or customer), leave them blank in actionParams and list their keys in "missingFields".
     - actionType: "create_stock_entry" | "create_customer" | "create_item" | "create_invoice" | "record_payment" | "pos_checkout" | "update_customer"
     - create_stock_entry: { entryType, items: [{item_code, qty, rate}], targetWarehouse from defaultWarehouse }
     - create_customer: { customerName, customerGroup, mobileNo, emailId, territory }
     - create_item: { itemName, itemGroup, stockUom, standardRate, description }
     - create_invoice: { customer, items: [{item_code, qty, rate}] }
     - record_payment: { invoiceName, amount, modeOfPayment }
     - pos_checkout: { customer, items: [{item_code, qty, rate}], modeOfPayment }
     - update_customer: { customer (id/name), customerName?, mobileNo?, emailId?, customerGroup?, territory? }
   - "text": greetings or non-ERP queries only. DO NOT invent new component types.
3. Keep "explanation" concise — what was filtered/computed or action drafted.
4. Process, filter, group, aggregate dynamically from the database JSON.

JSON SCHEMA:
{
  "component": "chart" | "table" | "metrics" | "card" | "text" | "action",
  "title": "string",
  "chartType": "bar" | "line" | "area" | "pie",
  "columns": [{"key": "string", "label": "string"}],
  "data": [any],
  "metrics": [{"label": "string", "value": "string | number", "change": "string", "trend": "up" | "down" | "neutral"}],
  "cardDetails": { "title": "string", "subtitle": "string", "details": [{"label": "string", "value": "string"}] },
  "actionType": "create_stock_entry" | "create_customer" | "create_item" | "create_invoice" | "record_payment" | "pos_checkout" | "update_customer",
  "actionParams": any,
  "explanation": "string",
  "missingFields": ["string"]
}
`;

    // Construct simple messages array including system instruction
    const chatSession = model.startChat({
      history: history.length > 0 ? history.map(h => ({
        role: h.sender === "user" ? "user" : "model",
        parts: [{ text: h.text }]
      })) : []
    });

    const prompt = `${systemInstruction}\n\nUser request: "${query}"`;
    const result = await chatSession.sendMessage(prompt);
    const responseText = result.response.text();
    
    // Parse response
    const parsed = JSON.parse(responseText);
    parsed._dataSource = dataSource;
    parsed._meta = { ...(parsed._meta || {}), generatedAt: new Date().toISOString() };
    return parsed;
  } catch (error) {
    console.error("Gemini Router Error, falling back to Mock Router:", error);
    // Graceful fallback to Mock Router with whatever data we have
    const result = runMockRouter(query, erpData);
    result._dataSource = dataSource;
    return result;
  }
};
