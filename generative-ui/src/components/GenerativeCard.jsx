import React from 'react';
import { User, Building, MapPin, DollarSign, Calendar, Activity } from 'lucide-react';

function getIcon(label) {
  const lower = label.toLowerCase();
  if (lower.includes('email') || lower.includes('contact')) return <User className="w-4 h-4 text-indigo-500" />;
  if (lower.includes('region') || lower.includes('country') || lower.includes('address')) return <MapPin className="w-4 h-4 text-blue-500" />;
  if (lower.includes('billing') || lower.includes('revenue') || lower.includes('outstanding')) return <DollarSign className="w-4 h-4 text-emerald-500" />;
  if (lower.includes('date') || lower.includes('volume')) return <Calendar className="w-4 h-4 text-violet-500" />;
  return <Activity className="w-4 h-4 text-slate-400" />;
}

export function GenerativeCard({ title = 'Account Profile', cardDetails = {} }) {
  if (!cardDetails?.title) return null;
  const { title: detailTitle, subtitle, details = [] } = cardDetails;

  return (
    <div className="panel-card p-6 max-w-lg mx-auto animate-slide-up-fade">
      <h3 className="text-sm font-semibold text-slate-500 mb-4 flex items-center gap-2 border-b border-slate-200 pb-3">
        <span className="w-1.5 h-3.5 bg-violet-500 rounded-full" />
        {title}
      </h3>
      <div className="flex items-center gap-4 mb-6">
        <div className="w-14 h-14 rounded-xl accent-gradient flex items-center justify-center font-bold text-white text-lg shadow-md">
          {detailTitle.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <h4 className="text-lg font-bold text-slate-900">{detailTitle}</h4>
          {subtitle && (
            <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
              <Building className="w-3.5 h-3.5" />
              {subtitle}
            </p>
          )}
        </div>
      </div>
      <div className="space-y-2">
        {details.map((detail, idx) => (
          <div key={idx} className="flex items-center justify-between py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="flex items-center gap-2">
              {getIcon(detail.label)}
              <span className="text-xs text-slate-500 font-medium">{detail.label}</span>
            </div>
            <span className="text-xs font-semibold text-slate-800">{detail.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default GenerativeCard;
