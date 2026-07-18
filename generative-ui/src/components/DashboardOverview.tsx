'use client';

import React, { useEffect, useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Workflow,
  BrainCircuit,
  CheckCircle2,
  AlertTriangle,
  Clock,
  FileText,
  Send,
  RefreshCw,
  Zap,
  Server,
  Shield,
  Activity,
  Loader2,
} from 'lucide-react';
import { erpCall, systemHealth, type HealthStatus } from '@/lib/api';

/* ──────────────────────────────────────────────
   TYPES & ICONS
   ────────────────────────────────────────────── */

interface KpiData {
  label: string;
  value: string;
  change: string;
  trend: 'up' | 'down';
  iconName: string;
  description: string;
}

const IconMap: Record<string, React.ElementType> = {
  DollarSign,
  ShoppingCart,
  Workflow,
  BrainCircuit,
  Server,
  Shield,
};

/* ──────────────────────────────────────────────
   SUBCOMPONENTS
   ────────────────────────────────────────────── */

function KpiCard({ card }: { card: KpiData }) {
  const Icon = IconMap[card.iconName] || Activity;
  const isUp = card.trend === 'up';

  return (
    <div className="group relative overflow-hidden rounded-xl border border-divider bg-surface p-6 transition-all duration-300 hover:border-accent-border hover:shadow-[0_0_24px_rgba(16,185,129,0.06)]">
      <div className="absolute -top-12 -right-12 h-24 w-24 rounded-full bg-accent/5 opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100" />

      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-secondary">{card.label}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-primary">{card.value}</p>
          <p className="mt-1 text-xs text-secondary">{card.description}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-muted text-accent">
          <Icon size={20} />
        </div>
      </div>

      <div className="mt-4 flex items-center space-x-1.5">
        {isUp ? (
          <TrendingUp size={14} className="text-success" />
        ) : (
          <TrendingDown size={14} className="text-error" />
        )}
        <span className={`text-xs font-semibold ${isUp ? 'text-success' : 'text-error'}`}>
          {card.change}
        </span>
      </div>
    </div>
  );
}

function HealthCard({ name, statusValue }: { name: string, statusValue: string }) {
  const isOperational = statusValue === 'healthy' || statusValue === 'operational';
  const Icon = IconMap[name] || Server;

  return (
    <div className="flex items-center justify-between rounded-lg border border-divider bg-surface p-4 transition-colors hover:bg-surface-hover">
      <div className="flex items-center space-x-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-muted text-accent">
          <Icon size={16} />
        </div>
        <div>
          <p className="text-sm font-medium text-primary capitalize">{name}</p>
          <div className="mt-0.5 flex items-center space-x-1.5">
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${isOperational ? 'bg-success animate-pulse' : 'bg-warning animate-pulse'}`} />
            <span className={`text-xs font-medium capitalize ${isOperational ? 'text-success' : 'text-warning'}`}>
              {statusValue}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────
   MAIN COMPONENT
   ────────────────────────────────────────────── */

export default function DashboardOverview() {
  const [kpis, setKpis] = useState<KpiData[] | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [kpiRes, healthRes] = await Promise.all([
          erpCall<{ message: { kpis: KpiData[] } }>('api.dashboard.get_dashboard_kpis', {}, 'GET').catch(() => null),
          systemHealth().catch(() => null)
        ]);

        if (kpiRes && kpiRes.message && kpiRes.message.kpis) {
          setKpis(kpiRes.message.kpis);
        } else {
          // Fallback if ERP method isn't fully implemented yet, just clear the UI
          setKpis([]);
        }
        
        if (healthRes) {
          setHealth(healthRes);
        }
      } catch (err) {
        setError('Failed to load dashboard data.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="animate-spin text-accent" size={32} />
      </div>
    );
  }

  return (
    <section className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-primary lg:text-3xl">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-secondary">
          Real-time overview across ERP, orchestration, and AI systems.
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-error/10 p-4 text-sm text-error border border-error/30">
          {error}
        </div>
      )}

      {/* KPI Cards */}
      {kpis && kpis.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map((card, i) => (
            <KpiCard key={i} card={card} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-divider bg-surface p-8 text-center text-secondary">
          No KPI data available from ERP.
        </div>
      )}

      {/* Activity + System Health */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Recent Activity — takes 3 columns */}
        <div className="lg:col-span-3 rounded-xl border border-divider bg-surface overflow-hidden flex flex-col items-center justify-center min-h-[200px] text-secondary">
           <Activity size={32} className="mb-2 opacity-50" />
           <p className="text-sm">Activity feed coming soon.</p>
        </div>

        {/* System Health — takes 2 columns */}
        <div className="lg:col-span-2 rounded-xl border border-divider bg-surface overflow-hidden">
          <div className="flex items-center justify-between border-b border-divider px-6 py-4">
            <div className="flex items-center space-x-2">
              <CheckCircle2 size={16} className="text-success" />
              <h2 className="text-sm font-semibold text-primary">System Health</h2>
            </div>
          </div>
          <div className="space-y-3 p-4">
            {health ? (
              Object.entries(health.services).map(([name, status]) => (
                <HealthCard key={name} name={name} statusValue={status} />
              ))
            ) : (
              <div className="text-center text-sm text-secondary py-4">
                Health status unavailable.
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
