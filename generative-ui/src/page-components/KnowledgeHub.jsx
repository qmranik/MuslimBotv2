import React, { useState } from 'react';
import { BookOpen, Upload, Globe, FileJson } from 'lucide-react';
import { SourceList } from '../components/knowledge/SourceList';
import { UploadPanel } from '../components/knowledge/UploadPanel';
import { UrlSourcePanel } from '../components/knowledge/UrlSourcePanel';
import { BulkImportPanel } from '../components/knowledge/BulkImportPanel';

const TABS = [
  { id: 'upload', label: 'Upload', icon: Upload },
  { id: 'url', label: 'URL Ingest', icon: Globe },
  { id: 'bulk', label: 'Bulk Import', icon: FileJson },
];

export function KnowledgeHub() {
  const [activeTab, setActiveTab] = useState('upload');
  const [refreshKey, setRefreshKey] = useState(0);

  const bumpRefresh = () => setRefreshKey((k) => k + 1);

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      <header className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-slate-200 bg-white shrink-0">
        <div className="flex items-center gap-3">
          <BookOpen className="w-5 h-5 text-indigo-600" />
          <div>
            <h1 className="text-sm font-bold text-slate-900">Knowledge Hub</h1>
            <p className="text-[10px] text-slate-500">Upload, index, and manage RAG sources</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  activeTab === tab.id
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                    : 'text-slate-500 hover:text-slate-700 border border-transparent hover:bg-slate-100'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5 min-h-0">
        <div className="panel-card p-6 min-h-[200px]">
          {activeTab === 'upload' && <UploadPanel onUploaded={bumpRefresh} />}
          {activeTab === 'url' && <UrlSourcePanel onUploaded={bumpRefresh} />}
          {activeTab === 'bulk' && <BulkImportPanel onUploaded={bumpRefresh} />}
        </div>

        <SourceList refreshKey={refreshKey} onRefresh={bumpRefresh} />
      </div>
    </div>
  );
}
