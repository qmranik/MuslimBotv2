"use client";
import { createAI } from '../lib/rsc-lite';
import { ReactNode } from 'react';
import React from 'react';
import { GenerativeChart } from '../components/GenerativeChart';
import { GenerativeTable } from '../components/GenerativeTable';

// Mock system for UI streaming
export async function submitMessage(message: string): Promise<ReactNode> {
  // Client-side mock that returns generative UI nodes. In a real implementation
  // this would call the orchestrator /v1/ai and stream UI (the primary chat path
  // uses @ai-sdk/react via useGenerativeChat).

  await new Promise(resolve => setTimeout(resolve, 500));
  
  const lowerMsg = message.toLowerCase();
  
  if (lowerMsg.includes('chart') || lowerMsg.includes('sales') || lowerMsg.includes('snapshot')) {
    return (
      <div className="w-full flex flex-col gap-4">
        <p className="text-slate-200">Here is the sales chart and health snapshot you requested.</p>
        <div className="panel-card p-4 min-h-[300px] w-full max-w-2xl bg-slate-800 border-slate-700">
          <GenerativeChart 
            type="area" 
            title="Weekly Sales Generation"
            data={[
              { label: 'Mon', value: 120 },
              { label: 'Tue', value: 300 },
              { label: 'Wed', value: 150 },
              { label: 'Thu', value: 400 },
              { label: 'Fri', value: 500 },
              { label: 'Sat', value: 200 },
              { label: 'Sun', value: 250 },
            ]} 
          />
        </div>
      </div>
    );
  }
  
  if (lowerMsg.includes('table') || lowerMsg.includes('inventory') || lowerMsg.includes('stock')) {
    return (
      <div className="w-full flex flex-col gap-4">
        <p className="text-slate-200">I have pulled the latest inventory data for you.</p>
        <div className="panel-card w-full max-w-2xl bg-slate-800 border-slate-700">
          <GenerativeTable 
            columns={[
              { key: 'item', label: 'Item Name' },
              { key: 'stock', label: 'Stock Level' },
              { key: 'status', label: 'Status' }
            ]}
            data={[
              { item: 'Ergonomic Chair', stock: 12, status: 'In Stock' },
              { item: 'Standing Desk', stock: 2, status: 'Low Stock' },
              { item: 'Monitor Arm', stock: 45, status: 'In Stock' }
            ]}
          />
        </div>
      </div>
    );
  }

  if (lowerMsg.includes('invoice') || lowerMsg.includes('receivable')) {
    return (
      <div className="w-full flex flex-col gap-4">
        <p className="text-slate-200">Here are the overdue invoices from the ERP system.</p>
        <div className="panel-card w-full max-w-2xl bg-slate-800 border-slate-700">
          <GenerativeTable 
            columns={[
              { key: 'invoice', label: 'Invoice ID' },
              { key: 'amount', label: 'Amount' },
              { key: 'status', label: 'Status' }
            ]}
            data={[
              { invoice: 'INV-2026-001', amount: '$1,200', status: 'Overdue' },
              { invoice: 'INV-2026-002', amount: '$450', status: 'Pending' },
            ]}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="text-slate-200">
      <p>I am the MuslimBot Generative OS. I received your request: <strong>&quot;{message}&quot;</strong>.</p>
      <p className="mt-2 text-sm text-slate-400">Try asking for a &quot;sales chart&quot; or &quot;inventory table&quot; to see the Generative UI in action.</p>
    </div>
  );
}

// State type for AI context
export type ServerMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type ClientMessage = {
  id: string;
  role: 'user' | 'assistant';
  display: ReactNode;
};

// Create the AI context
export const AI = createAI({
  actions: {
    submitMessage,
  },
  initialAIState: [],
  initialUIState: [],
});
