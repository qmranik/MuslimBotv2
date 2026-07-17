import React, { useCallback, useEffect, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, TrendingUp } from 'lucide-react';
import { GenerativeChart } from '../components/GenerativeChart';
import { GenerativeTable } from '../components/GenerativeTable';
import {
  getDashboardKPIs,
  getRevenueChartData,
  getRecentActivity,
  checkERPConnection,
} from '../services/erpClient';
import { dummyDatabase } from '../data/database';

function MetricTile({ label, value, trend, alert }) {
  const TrendIcon = trend === 'down' ? ArrowDownRight : ArrowUpRight;
  return (
    <div className="panel-card p-4 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        {alert && (
          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
            alert === 'warning'
              ? 'bg-amber-50 text-amber-700 border border-amber-200'
              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
          }`}>
            {alert === 'warning' ? 'Alert' : 'Stable'}
          </span>
        )}
      </div>
      <div className="flex items-end justify-between">
        <span className="text-2xl font-extrabold text-slate-900 tracking-tight">{value}</span>
        {trend && (
          <span className={`flex items-center gap-0.5 text-[10px] font-bold ${
            trend === 'up' ? 'text-emerald-600' : 'text-rose-600'
          }`}>
            <TrendIcon className="w-3 h-3" />
            {trend === 'up' ? 'Up' : 'Down'}
          </span>
        )}
      </div>
    </div>
  );
}

export function CommandCenter() {
  const [kpis, setKpis] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [tableData, setTableData] = useState([]);
  const [tableColumns, setTableColumns] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const connected = await checkERPConnection();
      if (connected) {
        const [kpiData, chart, activity] = await Promise.all([
          getDashboardKPIs(),
          getRevenueChartData('monthly'),
          getRecentActivity(10),
        ]);
        setKpis(kpiData);
        const rows = chart?.labels?.map((label, i) => ({
          label,
          value: chart?.values?.[i] || 0,
        })) || [];
        setChartData(rows);
        const activities = activity?.activities || activity || [];
        setTableColumns([
          { key: 'title', label: 'Event' },
          { key: 'subtitle', label: 'Detail' },
          { key: 'time', label: 'When' },
        ]);
        setTableData(
          (Array.isArray(activities) ? activities : []).map((a) => ({
            title: a.title || a.type || a.name,
            subtitle: a.subtitle || a.customer || a.reference || '',
            time: a.time || a.timestamp || a.date || '',
          }))
        );
      } else {
        throw new Error('offline');
      }
    } catch {
      setKpis({
        revenue: { formatted: '$12,450', value: 12450 },
        customers: { value: dummyDatabase.customers.length },
        low_stock: { value: 3 },
      });
      setChartData(
        dummyDatabase.monthlyPerformance?.slice(-6).map((m) => ({
          label: m.month,
          value: m.revenue,
          secondaryValue: m.expenses,
        })) || []
      );
      setTableColumns([
        { key: 'invoiceNumber', label: 'Invoice #' },
        { key: 'customerName', label: 'Customer' },
        { key: 'amount', label: 'Amount' },
        { key: 'status', label: 'Status' },
      ]);
      setTableData(
        dummyDatabase.invoices.slice(-8).map((i) => ({
          ...i,
          amount: `$${Number(i.amount).toLocaleString()}`,
        }))
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const handler = () => loadData();
    window.addEventListener('erp:cache:invalidate', handler);
    return () => window.removeEventListener('erp:cache:invalidate', handler);
  }, [loadData]);

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 space-y-5">
      <div className="flex items-center gap-2 mb-1">
        <TrendingUp className="w-5 h-5 text-indigo-600" />
        <div>
          <h2 className="text-base font-bold text-slate-900">Command Center</h2>
          <p className="text-[11px] text-slate-500">Executive overview and recent activity</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricTile
          label="Total Revenue"
          value={kpis?.revenue?.formatted || (loading ? '…' : '$0')}
          trend="up"
          alert="stable"
        />
        <MetricTile
          label="Active Customers"
          value={kpis?.customers?.value ?? (loading ? '…' : '0')}
          trend="up"
          alert="stable"
        />
        <MetricTile
          label="Low Stock Items"
          value={kpis?.low_stock?.value ?? (loading ? '…' : '0')}
          trend={(kpis?.low_stock?.value || 0) > 5 ? 'down' : 'up'}
          alert={(kpis?.low_stock?.value || 0) > 5 ? 'warning' : 'stable'}
        />
      </div>

      <GenerativeChart
        type="bar"
        data={chartData}
        title="Revenue Trends"
      />

      <GenerativeTable
        title="Recent Transactions"
        columns={tableColumns}
        data={tableData}
      />
    </div>
  );
}
