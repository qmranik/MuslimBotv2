import React from 'react';
import { ArrowUpRight, ArrowDownRight, Activity } from 'lucide-react';

export function GenerativeMetrics({ title = 'Dashboard Analytics', metrics = [] }) {
  if (!metrics?.length) return null;

  const styles = [
    { bar: 'bg-indigo-500' },
    { bar: 'bg-blue-500' },
    { bar: 'bg-emerald-500' },
    { bar: 'bg-violet-500' },
  ];

  return (
    <div className="animate-slide-up-fade">
      {title && (
        <h3 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <span className="w-1.5 h-4 bg-indigo-500 rounded-full" />
          {title}
        </h3>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric, idx) => (
          <div key={idx} className="panel-interactive p-5 flex flex-col justify-between min-h-[140px]">
            <div className="flex justify-between items-start">
              <span className="text-xs font-semibold text-slate-500">{metric.label}</span>
              <Activity className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <div className="mt-3">
              <div className={`w-8 h-1 rounded-full mb-3 ${styles[idx % styles.length].bar}`} />
              <div className="text-2xl font-extrabold text-slate-900">{metric.value}</div>
              {metric.change && (
                <span className={`inline-flex items-center gap-0.5 mt-2 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  metric.trend === 'up' ? 'bg-emerald-50 text-emerald-700' : metric.trend === 'down' ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-600'
                }`}>
                  {metric.trend === 'up' ? <ArrowUpRight className="w-3 h-3" /> : metric.trend === 'down' ? <ArrowDownRight className="w-3 h-3" /> : null}
                  {metric.change}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default GenerativeMetrics;
