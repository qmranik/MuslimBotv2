'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Download,
  Eye,
  Filter,
  FileText,
  Loader2,
} from 'lucide-react';
import { erpCall } from '@/lib/api';

/* ──────────────────────────────────────────────
   TYPES
   ────────────────────────────────────────────── */

type InvoiceStatus = 'paid' | 'pending' | 'overdue';
type SortDirection = 'asc' | 'desc' | null;
type SortKey = 'invoiceNumber' | 'client' | 'amount' | 'status' | 'dueDate';

interface Invoice {
  id: string;
  invoiceNumber: string;
  client: string;
  amount: number;
  status: InvoiceStatus;
  dueDate: string;
  issuedDate: string;
}

/* ──────────────────────────────────────────────
   HELPERS
   ────────────────────────────────────────────── */

function formatCurrency(amount: number): string {
  return `৳${amount.toLocaleString()}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const statusConfig: Record<InvoiceStatus, { label: string; colorClass: string; bgClass: string }> = {
  paid: { label: 'Paid', colorClass: 'text-success', bgClass: 'bg-success/10' },
  pending: { label: 'Pending', colorClass: 'text-warning', bgClass: 'bg-warning/10' },
  overdue: { label: 'Overdue', colorClass: 'text-error', bgClass: 'bg-error/10' },
};

/* ──────────────────────────────────────────────
   SUBCOMPONENTS
   ────────────────────────────────────────────── */

function SortIcon({ direction }: { direction: SortDirection }) {
  if (direction === 'asc') return <ChevronUp size={14} className="text-accent" />;
  if (direction === 'desc') return <ChevronDown size={14} className="text-accent" />;
  return <ChevronsUpDown size={14} className="text-secondary opacity-50" />;
}

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const config = statusConfig[status] || { label: status, colorClass: 'text-secondary', bgClass: 'bg-surface-hover' };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${config.colorClass} ${config.bgClass}`}>
      {config.label}
    </span>
  );
}

function EmptyState({ searchTerm, hasError }: { searchTerm: string; hasError?: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <FileText size={48} className="text-secondary opacity-40" />
      <p className="mt-4 text-sm font-medium text-secondary">No invoices found</p>
      <p className="mt-1 text-xs text-secondary">
        {hasError 
          ? 'Failed to fetch invoices from ERP.'
          : searchTerm
            ? `No results for "${searchTerm}". Try adjusting your search.`
            : 'There are no invoice records to display.'}
      </p>
    </div>
  );
}

/* ──────────────────────────────────────────────
   MAIN COMPONENT
   ────────────────────────────────────────────── */

export default function ErpDataTable() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'all'>('all');
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const res = await erpCall<{ message: { invoices: Invoice[] } }>('api.dashboard.get_invoices', {}, 'GET');
        if (res && res.message && res.message.invoices) {
          setInvoices(res.message.invoices);
        } else {
          setInvoices([]); // empty state if method not fully wired
        }
      } catch (err) {
        setError(true);
        setInvoices([]);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Sort handler
  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      if (sortDirection === 'asc') setSortDirection('desc');
      else if (sortDirection === 'desc') { setSortKey(null); setSortDirection(null); }
      else setSortDirection('asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  // Filter + Sort
  const filteredInvoices = useMemo(() => {
    let result = invoices.filter((inv) => {
      const matchesSearch =
        (inv.invoiceNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (inv.client || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
      return matchesSearch && matchesStatus;
    });

    if (sortKey && sortDirection) {
      result = [...result].sort((a, b) => {
        const valA = a[sortKey];
        const valB = b[sortKey];
        const modifier = sortDirection === 'asc' ? 1 : -1;

        if (typeof valA === 'number' && typeof valB === 'number') {
          return (valA - valB) * modifier;
        }
        return String(valA).localeCompare(String(valB)) * modifier;
      });
    }

    return result;
  }, [invoices, searchTerm, statusFilter, sortKey, sortDirection]);

  const columns: { key: SortKey; label: string; className?: string }[] = [
    { key: 'invoiceNumber', label: 'Invoice #' },
    { key: 'client', label: 'Client' },
    { key: 'amount', label: 'Amount', className: 'text-right' },
    { key: 'status', label: 'Status' },
    { key: 'dueDate', label: 'Due Date' },
  ];

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="animate-spin text-accent" size={32} />
      </div>
    );
  }

  return (
    <section className="space-y-6">
      {/* Section Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-primary">
            Invoices
          </h2>
          <p className="mt-0.5 text-sm text-secondary">
            {filteredInvoices.length} of {invoices.length} records
          </p>
        </div>

        {/* Search + Filter */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" />
            <input
              type="text"
              placeholder="Search invoices..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-9 w-64 rounded-lg border border-divider bg-surface pl-9 pr-3 text-sm text-primary placeholder:text-secondary transition-colors focus:border-accent focus:ring-2 focus:ring-accent focus:outline-none"
            />
          </div>

          {/* Status filter pills */}
          <div className="hidden items-center gap-1.5 rounded-lg border border-divider bg-surface p-1 md:flex">
            {(['all', 'paid', 'pending', 'overdue'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors focus:ring-2 focus:ring-accent focus:outline-none ${
                  statusFilter === status
                    ? 'bg-accent text-background'
                    : 'text-secondary hover:bg-surface-hover hover:text-primary'
                }`}
              >
                {status === 'all' ? 'All' : status}
              </button>
            ))}
          </div>

          {/* Mobile filter icon */}
          <button className="flex h-9 w-9 items-center justify-center rounded-lg border border-divider bg-surface text-secondary transition-colors hover:bg-surface-hover hover:text-primary md:hidden focus:ring-2 focus:ring-accent focus:outline-none">
            <Filter size={16} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface border border-divider rounded-xl overflow-hidden">
        {filteredInvoices.length === 0 ? (
          <EmptyState searchTerm={searchTerm} hasError={error} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-divider">
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      className={`px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-secondary cursor-pointer select-none transition-colors hover:text-primary ${col.className ?? ''}`}
                      onClick={() => handleSort(col.key)}
                    >
                      <div className={`flex items-center gap-1 ${col.className?.includes('text-right') ? 'justify-end' : ''}`}>
                        <span>{col.label}</span>
                        <SortIcon direction={sortKey === col.key ? sortDirection : null} />
                      </div>
                    </th>
                  ))}
                  <th className="px-6 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-secondary">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-divider">
                {filteredInvoices.map((invoice) => (
                  <tr
                    key={invoice.id}
                    className="group transition-colors hover:bg-surface-hover"
                  >
                    <td className="whitespace-nowrap px-6 py-4">
                      <span className="font-mono text-sm font-medium text-accent">
                        {invoice.invoiceNumber}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-primary">{invoice.client}</span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right">
                      <span className="text-sm font-semibold text-primary">
                        {formatCurrency(invoice.amount)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={invoice.status} />
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span className="text-sm text-secondary">
                        {invoice.dueDate ? formatDate(invoice.dueDate) : 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <button className="flex h-7 w-7 items-center justify-center rounded-md text-secondary transition-colors hover:bg-accent-muted hover:text-accent focus:ring-2 focus:ring-accent focus:outline-none" title="View">
                          <Eye size={14} />
                        </button>
                        <button className="flex h-7 w-7 items-center justify-center rounded-md text-secondary transition-colors hover:bg-accent-muted hover:text-accent focus:ring-2 focus:ring-accent focus:outline-none" title="Download">
                          <Download size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Table Footer */}
        {filteredInvoices.length > 0 && (
          <div className="flex items-center justify-between border-t border-divider px-6 py-3">
            <p className="text-xs text-secondary">
              Showing {filteredInvoices.length} invoice{filteredInvoices.length !== 1 ? 's' : ''}
            </p>
            <div className="flex items-center gap-2">
              <button className="rounded-md border border-divider bg-surface px-3 py-1 text-xs text-secondary transition-colors hover:bg-surface-hover hover:text-primary focus:ring-2 focus:ring-accent focus:outline-none">
                Previous
              </button>
              <button className="rounded-md border border-divider bg-surface px-3 py-1 text-xs text-secondary transition-colors hover:bg-surface-hover hover:text-primary focus:ring-2 focus:ring-accent focus:outline-none">
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
