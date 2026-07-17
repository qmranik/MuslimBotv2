/**
 * Dummy ERP SaaS Database
 * Provides structured records for the Generative UI engine to filter, aggregate, and query.
 */

export const dummyDatabase = {
  // Invoices Table
  invoices: [
    { id: "inv_1", invoiceNumber: "INV-2024-001", customerName: "Acme Corp", amount: 1250.00, status: "Paid", date: "2024-01-15", category: "Software" },
    { id: "inv_2", invoiceNumber: "INV-2024-002", customerName: "Globex Corporation", amount: 3400.00, status: "Paid", date: "2024-01-20", category: "Consulting" },
    { id: "inv_3", invoiceNumber: "INV-2024-003", customerName: "Umbrella Corp", amount: 850.00, status: "Overdue", date: "2024-02-05", category: "Support" },
    { id: "inv_4", invoiceNumber: "INV-2024-004", customerName: "Initech", amount: 1950.00, status: "Paid", date: "2024-02-12", category: "Software" },
    { id: "inv_5", invoiceNumber: "INV-2024-005", customerName: "Hooli Inc", amount: 6200.00, status: "Pending", date: "2024-03-01", category: "Software" },
    { id: "inv_6", invoiceNumber: "INV-2024-006", customerName: "Veer Industries", amount: 1500.00, status: "Paid", date: "2024-03-10", category: "Support" },
    { id: "inv_7", invoiceNumber: "INV-2024-007", customerName: "Soylent Corp", amount: 4800.00, status: "Paid", date: "2024-04-18", category: "Consulting" },
    { id: "inv_8", invoiceNumber: "INV-2024-008", customerName: "Wayne Enterprises", amount: 12500.00, status: "Paid", date: "2024-05-02", category: "Software" },
    { id: "inv_9", invoiceNumber: "INV-2024-009", customerName: "Tyrell Corp", amount: 7200.00, status: "Pending", date: "2024-06-15", category: "Hardware" },
    { id: "inv_10", invoiceNumber: "INV-2024-010", customerName: "Stark Industries", amount: 18000.00, status: "Paid", date: "2024-07-22", category: "Consulting" },
    { id: "inv_11", invoiceNumber: "INV-2024-011", customerName: "Oscorp", amount: 2100.00, status: "Overdue", date: "2024-08-05", category: "Support" },
    { id: "inv_12", invoiceNumber: "INV-2024-012", customerName: "LexCorp", amount: 9500.00, status: "Paid", date: "2024-09-11", category: "Hardware" },
    { id: "inv_13", invoiceNumber: "INV-2024-013", customerName: "Massive Dynamic", amount: 5400.00, status: "Paid", date: "2024-10-05", category: "Software" },
    { id: "inv_14", invoiceNumber: "INV-2024-014", customerName: "Cyberdyne Systems", amount: 3800.00, status: "Pending", date: "2024-11-20", category: "Support" },
    { id: "inv_15", invoiceNumber: "INV-2024-015", customerName: "Wonka Industries", amount: 1600.00, status: "Paid", date: "2024-12-14", category: "Hardware" },
    
    // 2025 Invoices
    { id: "inv_16", invoiceNumber: "INV-2025-001", customerName: "Acme Corp", amount: 1450.00, status: "Paid", date: "2025-01-10", category: "Software" },
    { id: "inv_17", invoiceNumber: "INV-2025-002", customerName: "Globex Corporation", amount: 4100.00, status: "Paid", date: "2025-01-28", category: "Consulting" },
    { id: "inv_18", invoiceNumber: "INV-2025-003", customerName: "Umbrella Corp", amount: 920.00, status: "Paid", date: "2025-02-14", category: "Support" },
    { id: "inv_19", invoiceNumber: "INV-2025-004", customerName: "Initech", amount: 2200.00, status: "Paid", date: "2025-02-22", category: "Software" },
    { id: "inv_20", invoiceNumber: "INV-2025-005", customerName: "Hooli Inc", amount: 7500.00, status: "Paid", date: "2025-03-05", category: "Software" },
    { id: "inv_21", invoiceNumber: "INV-2025-006", customerName: "Veer Industries", amount: 1800.00, status: "Paid", date: "2025-03-18", category: "Support" },
    { id: "inv_22", invoiceNumber: "INV-2025-007", customerName: "Soylent Corp", amount: 5100.00, status: "Pending", date: "2025-04-12", category: "Consulting" },
    { id: "inv_23", invoiceNumber: "INV-2025-008", customerName: "Wayne Enterprises", amount: 14000.00, status: "Paid", date: "2025-05-15", category: "Software" },
    { id: "inv_24", invoiceNumber: "INV-2025-009", customerName: "Tyrell Corp", amount: 8000.00, status: "Paid", date: "2025-06-08", category: "Hardware" },
    { id: "inv_25", invoiceNumber: "INV-2025-010", customerName: "Stark Industries", amount: 22000.00, status: "Paid", date: "2025-07-19", category: "Consulting" },
    { id: "inv_26", invoiceNumber: "INV-2025-011", customerName: "Oscorp", amount: 3000.00, status: "Pending", date: "2025-08-25", category: "Support" },
    { id: "inv_27", invoiceNumber: "INV-2025-012", customerName: "LexCorp", amount: 11000.00, status: "Paid", date: "2025-09-02", category: "Hardware" },
    { id: "inv_28", invoiceNumber: "INV-2025-013", customerName: "Massive Dynamic", amount: 6200.00, status: "Paid", date: "2025-10-14", category: "Software" },
    { id: "inv_29", invoiceNumber: "INV-2025-014", customerName: "Cyberdyne Systems", amount: 4500.00, status: "Overdue", date: "2025-11-05", category: "Support" },
    { id: "inv_30", invoiceNumber: "INV-2025-015", customerName: "Wonka Industries", amount: 2100.00, status: "Paid", date: "2025-12-20", category: "Hardware" },

    // 2026 Invoices (Recent)
    { id: "inv_31", invoiceNumber: "INV-2026-001", customerName: "Acme Corp", amount: 1800.00, status: "Paid", date: "2026-01-12", category: "Software" },
    { id: "inv_32", invoiceNumber: "INV-2026-002", customerName: "Globex Corporation", amount: 5500.00, status: "Pending", date: "2026-02-18", category: "Consulting" },
    { id: "inv_33", invoiceNumber: "INV-2026-003", customerName: "Umbrella Corp", amount: 1200.00, status: "Paid", date: "2026-03-01", category: "Support" },
    { id: "inv_34", invoiceNumber: "INV-2026-004", customerName: "Wayne Enterprises", amount: 19500.00, status: "Pending", date: "2026-04-20", category: "Software" },
    { id: "inv_35", invoiceNumber: "INV-2026-005", customerName: "Initech", amount: 3100.00, status: "Overdue", date: "2026-05-10", category: "Software" }
  ],

  // Customers Table
  customers: [
    { id: "cust_1", name: "Acme Corp", email: "billing@acme.com", company: "Acme Corporation", totalRevenue: 4500.00, country: "United States", status: "Active" },
    { id: "cust_2", name: "Globex Corporation", email: "accounts@globex.org", company: "Globex Corp", totalRevenue: 13000.00, country: "Canada", status: "Active" },
    { id: "cust_3", name: "Umbrella Corp", email: "finance@umbrella.com", company: "Umbrella Pharmaceuticals", totalRevenue: 2970.00, country: "United Kingdom", status: "Active" },
    { id: "cust_4", name: "Initech", email: "peter@initech.com", company: "Initech Consulting", totalRevenue: 7250.00, country: "United States", status: "Active" },
    { id: "cust_5", name: "Hooli Inc", email: "gavin@hooli.xyz", company: "Hooli Inc", totalRevenue: 13700.00, country: "United States", status: "Active" },
    { id: "cust_6", name: "Veer Industries", email: "contact@veer.in", company: "Veer Enterprises", totalRevenue: 3300.00, country: "India", status: "Active" },
    { id: "cust_7", name: "Soylent Corp", email: "green@soylent.co", company: "Soylent Corporation", totalRevenue: 9900.00, country: "Germany", status: "Active" },
    { id: "cust_8", name: "Wayne Enterprises", email: "bruce@wayne.co", company: "Wayne Enterprises Ltd", totalRevenue: 46000.00, country: "United States", status: "Active" },
    { id: "cust_9", name: "Tyrell Corp", email: "replicant@tyrell.io", company: "Tyrell Genetics", totalRevenue: 15200.00, country: "Japan", status: "Active" },
    { id: "cust_10", name: "Stark Industries", email: "tony@stark.com", company: "Stark Industries Inc", totalRevenue: 40000.00, country: "United States", status: "Active" },
    { id: "cust_11", name: "Oscorp", email: "norman@oscorp.org", company: "Oscorp Technologies", totalRevenue: 5100.00, country: "United States", status: "Inactive" },
    { id: "cust_12", name: "LexCorp", email: "lex@lexcorp.net", company: "LexCorp Industries", totalRevenue: 20500.00, country: "United States", status: "Active" },
    { id: "cust_13", name: "Massive Dynamic", email: "bell@massivedynamic.com", company: "Massive Dynamic", totalRevenue: 11600.00, country: "Germany", status: "Active" },
    { id: "cust_14", name: "Cyberdyne Systems", email: "skynet@cyberdyne.ai", company: "Cyberdyne Robotics", totalRevenue: 8300.00, country: "United States", status: "Active" },
    { id: "cust_15", name: "Wonka Industries", email: "charlie@wonka.com", company: "Wonka Chocolates", totalRevenue: 3700.00, country: "United Kingdom", status: "Active" }
  ],

  // Products Table
  products: [
    { id: "prod_1", name: "ERP Suite Pro (Monthly)", price: 150.00, stock: 9999, category: "Software", rating: 4.8 },
    { id: "prod_2", name: " Frappe Cloud Server Lite", price: 29.00, stock: 120, category: "Software", rating: 4.5 },
    { id: "prod_3", name: "Enterprise DB Server License", price: 2400.00, stock: 85, category: "Software", rating: 4.9 },
    { id: "prod_4", name: "DevOps Architecture Consulting (Hr)", price: 180.00, stock: 9999, category: "Consulting", rating: 4.7 },
    { id: "prod_5", name: "24/7 SLA Customer Support Addon", price: 89.00, stock: 9999, category: "Support", rating: 4.2 },
    { id: "prod_6", name: "IoT Edge Hub Router Hardware", price: 650.00, stock: 45, category: "Hardware", rating: 4.6 },
    { id: "prod_7", name: "Secure VPN Gateway Hardware", price: 320.00, stock: 110, category: "Hardware", rating: 4.4 },
    { id: "prod_8", name: "ERP Implementation Workshop", price: 1500.00, stock: 15, category: "Consulting", rating: 4.8 },
    { id: "prod_9", name: "AI Analytics Plugin Suite", price: 299.00, stock: 9999, category: "Software", rating: 4.7 },
    { id: "prod_10", name: "Dedicated SysAdmin SLA (Monthly)", price: 800.00, stock: 10, category: "Support", rating: 4.3 }
  ],

  // Monthly Performance & Growth Stats
  monthlyPerformance: [
    { month: "Jan 2025", activeUsers: 1450, revenue: 16800, expenses: 10200, churnRate: 1.8 },
    { month: "Feb 2025", activeUsers: 1520, revenue: 17200, expenses: 10400, churnRate: 1.5 },
    { month: "Mar 2025", activeUsers: 1680, revenue: 21200, expenses: 11000, churnRate: 1.2 },
    { month: "Apr 2025", activeUsers: 1710, revenue: 19800, expenses: 10900, churnRate: 1.4 },
    { month: "May 2025", activeUsers: 1850, revenue: 24100, expenses: 12000, churnRate: 1.1 },
    { month: "Jun 2025", activeUsers: 1920, revenue: 25400, expenses: 12500, churnRate: 1.3 },
    { month: "Jul 2025", activeUsers: 2100, revenue: 31000, expenses: 13800, churnRate: 0.9 },
    { month: "Aug 2025", activeUsers: 2150, revenue: 28900, expenses: 13900, churnRate: 1.0 },
    { month: "Sep 2025", activeUsers: 2300, revenue: 33400, expenses: 14500, churnRate: 0.8 },
    { month: "Oct 2025", activeUsers: 2420, revenue: 35800, expenses: 15000, churnRate: 0.7 },
    { month: "Nov 2025", activeUsers: 2490, revenue: 32600, expenses: 14800, churnRate: 1.1 },
    { month: "Dec 2025", activeUsers: 2600, revenue: 38200, expenses: 16000, churnRate: 0.6 },
    { month: "Jan 2026", activeUsers: 2750, revenue: 40500, expenses: 17200, churnRate: 0.7 },
    { month: "Feb 2026", activeUsers: 2880, revenue: 42100, expenses: 17500, churnRate: 0.6 },
    { month: "Mar 2026", activeUsers: 3050, revenue: 46800, expenses: 18000, churnRate: 0.5 },
    { month: "Apr 2026", activeUsers: 3200, revenue: 49500, expenses: 19200, churnRate: 0.4 },
    { month: "May 2026", activeUsers: 3400, revenue: 53100, expenses: 20100, churnRate: 0.5 }
  ]
};
