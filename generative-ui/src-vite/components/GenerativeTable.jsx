import React, { useState, useMemo } from 'react';
import { Search, ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from 'lucide-react';

export function GenerativeTable({ title = 'Generated List', columns = [], data = [] }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const processedData = useMemo(() => {
    let result = [...data];
    if (searchTerm.trim()) {
      const lower = searchTerm.toLowerCase();
      result = result.filter((row) =>
        Object.values(row).some((val) => val != null && String(val).toLowerCase().includes(lower))
      );
    }
    if (sortConfig.key) {
      result.sort((a, b) => {
        const valA = a[sortConfig.key];
        const valB = b[sortConfig.key];
        const cleanA = typeof valA === 'string' && valA.startsWith('$') ? parseFloat(valA.replace(/[^0-9.-]+/g, '')) : valA;
        const cleanB = typeof valB === 'string' && valB.startsWith('$') ? parseFloat(valB.replace(/[^0-9.-]+/g, '')) : valB;
        if (cleanA < cleanB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (cleanA > cleanB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [data, searchTerm, sortConfig]);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return processedData.slice(start, start + itemsPerPage);
  }, [processedData, currentPage]);

  const totalPages = Math.ceil(processedData.length / itemsPerPage) || 1;

  const renderCell = (key, value) => {
    if (key === 'status') {
      const s = String(value).toLowerCase();
      if (s === 'paid' || s === 'active') {
        return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">{value}</span>;
      }
      if (s === 'pending') {
        return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">{value}</span>;
      }
      if (s === 'overdue' || s === 'inactive') {
        return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">{value}</span>;
      }
    }
    return String(value ?? '');
  };

  return (
    <div className="panel-card p-5 animate-slide-up-fade">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
          <span className="w-1.5 h-4 bg-blue-500 rounded-full" />
          {title}
        </h3>
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search records..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            className="pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 w-full sm:w-56 focus:outline-none focus:border-indigo-400"
          />
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              {columns.map((col) => (
                <th key={col.key} onClick={() => requestSort(col.key)} className="px-4 py-3 cursor-pointer hover:bg-slate-100">
                  <div className="flex items-center gap-1">
                    {col.label}
                    {sortConfig.key === col.key && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedData.length ? paginatedData.map((row, idx) => (
              <tr key={idx} className="hover:bg-slate-50 text-slate-700">
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-2.5 font-medium whitespace-nowrap">{renderCell(col.key, row[col.key])}</td>
                ))}
              </tr>
            )) : (
              <tr><td colSpan={columns.length || 1} className="px-4 py-8 text-center text-slate-400">No records found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-xs text-slate-500">
          <span>Page {currentPage} of {totalPages}</span>
          <div className="flex gap-1">
            <button type="button" disabled={currentPage === 1} onClick={() => setCurrentPage((p) => p - 1)} className="p-1 border border-slate-200 rounded-lg disabled:opacity-40"><ChevronLeft className="w-4 h-4" /></button>
            <button type="button" disabled={currentPage === totalPages} onClick={() => setCurrentPage((p) => p + 1)} className="p-1 border border-slate-200 rounded-lg disabled:opacity-40"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      )}
    </div>
  );
}

export default GenerativeTable;
