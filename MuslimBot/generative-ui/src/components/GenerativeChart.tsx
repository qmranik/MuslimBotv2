"use client";
import React, { useMemo } from 'react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

const COLORS = ['#6366f1', '#3b82f6', '#10b981', '#ec4899', '#f59e0b', '#ef4444'];

function CustomTooltip({ active, payload, label }: { active?: any, payload?: any, label?: any }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="panel-card text-xs p-3 shadow-lg">
      <p className="font-semibold text-slate-800 mb-1">{label}</p>
      {payload.map((entry, idx) => (
        <div key={idx} className="flex items-center gap-2 py-0.5">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color || entry.fill }} />
          <span className="text-slate-500">{entry.name}:</span>
          <span className="font-medium text-slate-900">
            {typeof entry.value === 'number' && entry.value > 1000
              ? `$${entry.value.toLocaleString()}`
              : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export function GenerativeChart({ type = 'bar', data = [], title = '' }: { type?: string, data?: any[], title?: string }) {
  if (!data?.length) {
    return (
      <div className="panel-card flex items-center justify-center h-64">
        <p className="text-slate-500 text-sm">No chart data available.</p>
      </div>
    );
  }

  const renderChart = () => {
    switch (type.toLowerCase()) {
      case 'area':
        return (
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="value" stroke="#6366f1" fill="url(#areaFill)" strokeWidth={2} />
          </AreaChart>
        );
      case 'line':
        return (
          <LineChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        );
      case 'pie':
        return (
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={4} dataKey="value" nameKey="label">
              {data.map((entry, index) => (
                <Cell key={entry.label || index} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend formatter={(value) => <span className="text-xs text-slate-600">{value}</span>} />
          </PieChart>
        );
      default: {
        const hasSecondary = data.some((d) => d.secondaryValue !== undefined);
        return (
          <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }} barGap={6}>
            <defs>
              <linearGradient id="barPrimary" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" />
                <stop offset="100%" stopColor="#3b82f6" />
              </linearGradient>
              <linearGradient id="barSecondary" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#a855f7" />
                <stop offset="100%" stopColor="#6366f1" />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="value" name={hasSecondary ? 'Revenue' : 'Value'} fill="url(#barPrimary)" radius={[6, 6, 0, 0]} maxBarSize={45} />
            {hasSecondary && (
              <Bar dataKey="secondaryValue" name="Expenses" fill="url(#barSecondary)" radius={[6, 6, 0, 0]} maxBarSize={45} />
            )}
          </BarChart>
        );
      }
    }
  };

  return (
    <div className="panel-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
          <span className="w-1.5 h-4 bg-indigo-500 rounded-full" />
          {title || 'Chart'}
        </h3>
        <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
          {type}
        </span>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {renderChart()}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default GenerativeChart;
