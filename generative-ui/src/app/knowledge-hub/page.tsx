'use client';

import React from 'react';
import { useWorkspaceStore } from '../../stores/useWorkspaceStore';
import { Globe, Lock, Upload, Link as LinkIcon, Package, FileText, CheckCircle, Database } from 'lucide-react';

export default function KnowledgeHubPage() {
  const { 
    knowledgeHubTier, 
    setKnowledgeHubTier, 
    knowledgeHubIngestMode, 
    setKnowledgeHubIngestMode 
  } = useWorkspaceStore();

  return (
    <div className="flex flex-col h-full w-full bg-[#090D16] text-white p-6 overflow-hidden">
      {/* Header & Scope Toggle */}
      <div className="flex items-center justify-between mb-6 shrink-0">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Knowledge Hub</h1>
          <p className="text-gray-400 text-sm mt-1">Manage and interrogate vector database datasets.</p>
        </div>
        
        <div className="flex bg-[#121826] p-1 rounded-lg border border-white/10">
          <button
            onClick={() => setKnowledgeHubTier('public')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
              knowledgeHubTier === 'public'
                ? 'bg-blue-600/20 text-blue-400 shadow-sm'
                : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
            }`}
          >
            <Globe className="w-4 h-4" />
            <span>Public Knowledge Base</span>
          </button>
          
          <button
            onClick={() => setKnowledgeHubTier('private')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
              knowledgeHubTier === 'private'
                ? 'bg-purple-600/20 text-purple-400 shadow-sm'
                : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
            }`}
          >
            <Lock className="w-4 h-4" />
            <span>Private Knowledge Base</span>
          </button>
        </div>
      </div>

      {/* Main Content Split */}
      <div className="flex flex-1 gap-6 overflow-hidden">
        {/* Left Column: Ingest & Sources (60%) */}
        <div className="flex-[6] flex flex-col gap-6 overflow-y-auto pr-2 pb-4">
          
          {/* Ingestion Panel */}
          <div className="bg-[#121826] border border-white/5 rounded-xl p-5 shadow-lg glassmorphism shrink-0">
            <h3 className="text-sm font-medium text-gray-300 uppercase tracking-wider mb-4">Add to {knowledgeHubTier} Index</h3>
            
            {/* Input Toolbar */}
            <div className="flex space-x-2 mb-6">
              <button
                onClick={() => setKnowledgeHubIngestMode('file')}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  knowledgeHubIngestMode === 'file' ? 'bg-indigo-600 text-white' : 'bg-[#1a2133] text-gray-400 hover:bg-[#232b40]'
                }`}
              >
                <Upload className="w-4 h-4" />
                <span>Upload File</span>
              </button>
              <button
                onClick={() => setKnowledgeHubIngestMode('url')}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  knowledgeHubIngestMode === 'url' ? 'bg-indigo-600 text-white' : 'bg-[#1a2133] text-gray-400 hover:bg-[#232b40]'
                }`}
              >
                <LinkIcon className="w-4 h-4" />
                <span>URL Ingest</span>
              </button>
              <button
                onClick={() => setKnowledgeHubIngestMode('bulk')}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  knowledgeHubIngestMode === 'bulk' ? 'bg-indigo-600 text-white' : 'bg-[#1a2133] text-gray-400 hover:bg-[#232b40]'
                }`}
              >
                <Package className="w-4 h-4" />
                <span>Bulk Import</span>
              </button>
            </div>

            {/* Dynamic Input Form */}
            <div className="bg-[#0d121c] border border-white/10 rounded-lg p-6 min-h-[160px] flex items-center justify-center">
              {knowledgeHubIngestMode === 'file' && (
                <div className="text-center w-full">
                  <div className="mx-auto w-12 h-12 rounded-full border-2 border-dashed border-gray-600 flex items-center justify-center mb-3">
                    <FileText className="w-5 h-5 text-gray-500" />
                  </div>
                  <p className="text-sm text-gray-400 mb-1">Drag and drop documents here</p>
                  <p className="text-xs text-gray-500 mb-4">Supported formats: PDF, TXT, MD, DOCX</p>
                  <button className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-md text-sm font-medium transition-colors">
                    Browse Files
                  </button>
                </div>
              )}

              {knowledgeHubIngestMode === 'url' && (
                <div className="w-full max-w-md">
                  <label className="block text-sm font-medium text-gray-400 mb-2">Ingest Website Content</label>
                  <div className="flex space-x-2">
                    <input 
                      type="url" 
                      placeholder="https://example.com/docs" 
                      className="flex-1 bg-[#1e293b] text-white border border-white/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-md text-sm font-medium transition-colors">
                      Scrape
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Will attempt to extract main article body text and index it.</p>
                </div>
              )}

              {knowledgeHubIngestMode === 'bulk' && (
                <div className="w-full">
                  <label className="block text-sm font-medium text-gray-400 mb-2">Raw Markdown / Text Ingest</label>
                  <textarea 
                    placeholder="# Source Document Title&#10;&#10;Paste raw markdown data here..."
                    className="w-full h-32 bg-[#1e293b] text-white border border-white/10 rounded-md p-3 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono resize-none"
                  ></textarea>
                  <div className="flex justify-end mt-2">
                    <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-md text-sm font-medium transition-colors">
                      Process Chunk
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Indexed Sources List */}
          <div className="bg-[#121826] border border-white/5 rounded-xl flex flex-col flex-1 shadow-lg glassmorphism min-h-[300px]">
            <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-300 uppercase tracking-wider">Indexed Sources</h3>
              <div className="text-xs text-gray-500 bg-white/5 px-2 py-1 rounded">2,041 Chunks</div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2">
              <div className="space-y-1">
                {[
                  { name: 'Onboarding_Guide_2026.pdf', status: 'Healthy', type: 'PDF' },
                  { name: 'https://docs.erp.local/api', status: 'Healthy', type: 'URL' },
                  { name: 'Q3_Financial_Summary.docx', status: 'Healthy', type: 'DOCX' },
                  { name: 'Support_Macro_Templates.md', status: 'Healthy', type: 'MD' },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 hover:bg-white/[0.02] rounded-lg border border-transparent hover:border-white/5 transition-colors group">
                    <div className="flex items-center space-x-3 overflow-hidden">
                      <div className="w-8 h-8 rounded bg-indigo-500/10 flex items-center justify-center shrink-0">
                        <Database className="w-4 h-4 text-indigo-400" />
                      </div>
                      <div className="truncate">
                        <p className="text-sm font-medium text-gray-200 truncate">{item.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{item.type} Source</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 shrink-0">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="text-xs font-medium text-green-400 hidden group-hover:inline-block">Indexed</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Sandbox Interrogator (40%) */}
        <div className="flex-[4] bg-[#121826] border border-white/5 rounded-xl flex flex-col shadow-lg glassmorphism overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5 bg-[#171e2e]">
            <h3 className="text-sm font-medium text-gray-200 flex items-center">
              <span className={`w-2 h-2 rounded-full mr-2 ${knowledgeHubTier === 'public' ? 'bg-blue-500' : 'bg-purple-500'}`}></span>
              Sandbox Chat 
              <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-white/10 text-gray-400">
                {knowledgeHubTier} Tier
              </span>
            </h3>
            <p className="text-xs text-gray-500 mt-1">Test responses using only context from the {knowledgeHubTier} knowledge base.</p>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Mock Sandbox Chat */}
            <div className="flex flex-col space-y-2 text-sm max-w-[90%] self-end">
              <div className="bg-indigo-600 p-3 rounded-2xl rounded-tr-sm text-white ml-auto">
                What does our onboarding guide say about the new vacation policy?
              </div>
            </div>
            
            <div className="flex flex-col space-y-2 text-sm max-w-[90%]">
              <span className="text-xs text-indigo-400 font-medium">System Context ({knowledgeHubTier})</span>
              <div className="bg-[#1e293b] p-3 rounded-2xl rounded-tl-sm border border-white/5 text-gray-200 text-sm leading-relaxed">
                <p>Based on the <span className="text-indigo-300 font-mono text-xs bg-indigo-500/10 px-1 py-0.5 rounded">Onboarding_Guide_2026.pdf</span>, the new vacation policy grants 20 days of PTO per year, accrued monthly. Unused days roll over up to a maximum of 30 days.</p>
              </div>
            </div>
          </div>
          
          <div className="p-4 bg-[#0d121c] border-t border-white/5">
            <div className="relative flex items-center">
              <input 
                type="text" 
                placeholder={`Test ${knowledgeHubTier} vector search...`} 
                className="w-full bg-[#1e293b] text-white border border-white/10 rounded-full pl-4 pr-12 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-transparent transition-all placeholder-gray-500"
              />
              <button className="absolute right-2 p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
