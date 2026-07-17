"use client";
import React, { useCallback, useEffect, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Activity, Wallet, Box, AlertTriangle } from 'lucide-react';
import { GenerativeChart } from '../components/GenerativeChart';
import {
  getDashboardKPIs,
  getRevenueChartData,
  getRecentActivity,
  checkERPConnection,
} from '../services/erpClient';
import { dummyDatabase } from '../data/database';

function MetricTile({ label, value, trend, alert, icon: Icon }) {
  const isUp = trend === 'up';
  const isDown = trend === 'down';
  
  return (
    <div className="panel-card p-6 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium text-slate-500">{label}</span>
        {Icon && <Icon className="w-4 h-4 text-emerald-600" />}
      </div>
      <div className="flex flex-col gap-1 mt-auto">
        <span className="text-4xl font-display text-[var(--text-primary)]">{value}</span>
        {(isUp || isDown) && (
          <div className="flex items-center">
            <span className={`inline-flex items-center gap-1 text-xs font-bold px-1.5 py-0.5 rounded ${
              isUp ? 'text-emerald-700' : 'text-rose-700'
            }`}>
              {isUp ? '▲' : '▼'} {alert && typeof alert === 'string' && alert !== 'warning' && alert !== 'stable' ? alert : '12.4%'}
            </span>
          </div>
        )}
        {alert === 'warning' && (
          <div className="flex items-center mt-1">
             <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
              ▼ needs review
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function RecentActivityTimeline({ data }) {
  return (
    <div className="panel-card p-6 flex flex-col h-full">
      <h3 className="text-lg font-display font-semibold mb-4">Recent Activity</h3>
      <div className="flex-1 overflow-y-auto pr-2 space-y-5 mt-2">
        {data.map((item, idx) => (
          <div key={idx} className="relative pl-6">
            <div className={`absolute left-0 top-1.5 w-2 h-2 rounded-full ${idx === 0 ? 'bg-emerald-600' : 'bg-slate-300'}`} />
            <p className="text-sm font-medium text-slate-900 leading-tight">{item.title}</p>
            <p className="text-xs text-slate-500 mt-0.5">{item.subtitle}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CommandCenter() {
  const [kpis, setKpis] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [activityData, setActivityData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Dashboard');

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
        setActivityData(
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
        revenue: { formatted: '£248,910', value: 248910 },
        customers: { value: 1284 },
        low_stock: { value: 17 },
      });
      setChartData(
        dummyDatabase.monthlyPerformance?.slice(-6).map((m) => ({
          label: m.month,
          value: m.revenue,
          secondaryValue: m.expenses,
        })) || []
      );
      setActivityData([
        { title: 'Invoice #4821 paid', subtitle: 'ERPNext · 4m', time: '4m' },
        { title: 'New WhatsApp lead', subtitle: 'Chatwoot · 21m', time: '21m' },
        { title: 'Postiz scheduled 3 posts', subtitle: 'n8n flow · 1h', time: '1h' }
      ]);
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

  const tabs = ['Dashboard', 'Orders', 'Inventory', 'Customers'];

  return (
    <div className="h-full overflow-y-auto p-8 md:p-12 pl-24 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-4xl md:text-5xl font-display font-medium text-[var(--text-primary)] mb-3 tracking-tight">
          Assalamu alaikum, Amina
        </h1>
        <p className="text-base text-slate-500">
          A live summary across ERPNext, n8n, Chatwoot & Postiz...
        </p>
      </div>

      {/* Sub-Navigation */}
      <div className="flex items-center gap-6 border-b border-slate-200">
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-4 text-sm font-medium transition-colors border-b-2 ${
              activeTab === tab 
                ? 'border-[var(--accent-primary)] text-[var(--text-primary)]' 
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content (Dashboard View) */}
      {activeTab === 'Dashboard' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Top Row: KPI Cards */}
          <MetricTile
            label="Total Revenue"
            value={kpis?.revenue?.formatted || (loading ? '…' : '£0')}
            trend="up"
            alert="12.4% this week"
            icon={Wallet}
          />
          <MetricTile
            label="Active Orders"
            value={kpis?.customers?.value ?? (loading ? '…' : '0')}
            trend="up"
            alert="3.1%"
            icon={Box}
          />
          <MetricTile
            label="Low Stock Items"
            value={kpis?.low_stock?.value ?? (loading ? '…' : '0')}
            trend={(kpis?.low_stock?.value || 0) > 5 ? 'down' : 'up'}
            alert={(kpis?.low_stock?.value || 0) > 5 ? 'warning' : 'stable'}
            icon={AlertTriangle}
          />

          {/* Bottom Left: Wide Chart */}
          <div className="md:col-span-2 min-h-[360px] panel-card p-2">
             <GenerativeChart
               type="area"
               data={chartData}
               title="Weekly Sales"
             />
          </div>

          {/* Bottom Right: Timeline */}
          <div className="md:col-span-1 min-h-[360px]">
             <RecentActivityTimeline data={activityData} />
          </div>
        </div>
      )}
    </div>
  );
}
