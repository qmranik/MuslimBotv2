'use client';

import React from 'react';
import { useWorkspaceStore } from '../../stores/useWorkspaceStore';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { LayoutDashboard, MessageSquare } from 'lucide-react';

const mockRevenueData = [
  { name: 'Jan', revenue: 4000 },
  { name: 'Feb', revenue: 3000 },
  { name: 'Mar', revenue: 5000 },
  { name: 'Apr', revenue: 4500 },
  { name: 'May', revenue: 6000 },
  { name: 'Jun', revenue: 5500 },
];

const mockTransactions = [
  { id: 'INV-1001', customer: 'Acme Corp', status: 'Paid', amount: '$1,200.00' },
  { id: 'INV-1002', customer: 'Globex', status: 'Overdue', amount: '$450.00' },
  { id: 'INV-1003', customer: 'Initech', status: 'Paid', amount: '$3,100.00' },
];

export default function CommandCenterPage() {
  const { commandCenterTab, setCommandCenterTab, isAssistantFullScreen } = useWorkspaceStore();

  return (
    <div className="flex flex-col h-full w-full bg-[#090D16] text-white p-6 overflow-hidden">
      {/* Header & Tab Switcher */}
      <div className="flex flex-col space-y-4 mb-6 shrink-0">
        <h1 className="text-2xl font-semibold tracking-tight">Command Center</h1>
        
        <div className="flex bg-[#121826] p-1 rounded-lg w-fit border border-white/10">
          <button
            onClick={() => setCommandCenterTab('dashboard')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
              commandCenterTab === 'dashboard'
                ? 'bg-indigo-600/20 text-indigo-400 shadow-sm'
                : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Executive Dashboard</span>
          </button>
          
          <button
            onClick={() => setCommandCenterTab('assistant')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
              commandCenterTab === 'assistant'
                ? 'bg-indigo-600/20 text-indigo-400 shadow-sm'
                : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>MuslimBot Assistant</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative">
        {commandCenterTab === 'dashboard' ? (
          <div className="flex flex-col h-full overflow-y-auto space-y-6 pb-6">
            {/* Top Row: Metric Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 shrink-0">
              <div className="bg-[#121826] border border-white/5 p-5 rounded-xl shadow-lg glassmorphism">
                <p className="text-sm text-gray-400 font-medium">Total Revenue</p>
                <h3 className="text-3xl font-bold mt-2">$23,450</h3>
                <div className="mt-3 inline-flex items-center px-2 py-1 bg-green-500/10 text-green-400 text-xs rounded-full font-medium">
                  +12.5% this month
                </div>
              </div>
              <div className="bg-[#121826] border border-white/5 p-5 rounded-xl shadow-lg glassmorphism">
                <p className="text-sm text-gray-400 font-medium">Active Customers</p>
                <h3 className="text-3xl font-bold mt-2">1,204</h3>
                <div className="mt-3 inline-flex items-center px-2 py-1 bg-indigo-500/10 text-indigo-400 text-xs rounded-full font-medium">
                  +43 this week
                </div>
              </div>
              <div className="bg-[#121826] border border-white/5 p-5 rounded-xl shadow-lg glassmorphism">
                <p className="text-sm text-gray-400 font-medium">Low Stock Items</p>
                <h3 className="text-3xl font-bold mt-2">12</h3>
                <div className="mt-3 inline-flex items-center px-2 py-1 bg-red-500/10 text-red-400 text-xs rounded-full font-medium">
                  Needs attention
                </div>
              </div>
            </div>

            {/* Middle Row: Revenue Trends */}
            <div className="bg-[#121826] border border-white/5 p-6 rounded-xl shadow-lg glassmorphism shrink-0 h-[300px]">
              <h4 className="text-lg font-medium mb-4">Revenue Trends</h4>
              <div className="w-full h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={mockRevenueData}>
                    <XAxis dataKey="name" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                    <Tooltip 
                      cursor={{fill: '#ffffff05'}} 
                      contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', borderRadius: '8px' }} 
                    />
                    <Bar dataKey="revenue" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Bottom Row: Recent Transactions */}
            <div className="bg-[#121826] border border-white/5 rounded-xl shadow-lg glassmorphism shrink-0 overflow-hidden">
              <div className="px-6 py-4 border-b border-white/5">
                <h4 className="text-lg font-medium">Recent Transactions</h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#1a2133] text-gray-400">
                    <tr>
                      <th className="px-6 py-3 font-medium">Invoice #</th>
                      <th className="px-6 py-3 font-medium">Customer</th>
                      <th className="px-6 py-3 font-medium">Status</th>
                      <th className="px-6 py-3 font-medium text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {mockTransactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-6 py-4 font-medium text-indigo-300">{tx.id}</td>
                        <td className="px-6 py-4">{tx.customer}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                            tx.status === 'Paid' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                          }`}>
                            {tx.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">{tx.amount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex h-full w-full gap-6">
            {/* Left 60%: Generative Canvas */}
            <div className="flex-[6] bg-[#121826] border border-white/5 rounded-xl p-6 shadow-lg glassmorphism flex items-center justify-center relative overflow-hidden">
              {/* Grid Background Pattern */}
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-30 pointer-events-none"></div>
              
              <div className="text-center relative z-10">
                <div className="w-16 h-16 bg-indigo-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-indigo-500/30">
                  <LayoutDashboard className="w-8 h-8 text-indigo-400" />
                </div>
                <h3 className="text-xl font-medium text-gray-200">Generative Canvas</h3>
                <p className="text-gray-500 mt-2 max-w-sm mx-auto text-sm">
                  Functional blocks and interactive charts generated by the assistant will render here.
                </p>
              </div>
            </div>
            
            {/* Right 40%: Chat Stream */}
            <div className="flex-[4] bg-[#121826] border border-white/5 rounded-xl flex flex-col shadow-lg glassmorphism overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Mock Messages */}
                <div className="flex flex-col space-y-2 text-sm max-w-[85%]">
                  <span className="text-xs text-indigo-400 font-medium">MuslimBot</span>
                  <div className="bg-[#1e293b] p-3 rounded-2xl rounded-tl-sm border border-white/5 text-gray-200">
                    Hello! I'm ready to help you analyze your data. What would you like to see?
                  </div>
                </div>
              </div>
              
              {/* Input Area */}
              <div className="p-4 bg-[#0d121c] border-t border-white/5">
                <div className="relative flex items-center">
                  <input 
                    type="text" 
                    placeholder="Ask MuslimBot..." 
                    className="w-full bg-[#1e293b] text-white border border-white/10 rounded-full pl-4 pr-12 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-transparent transition-all placeholder-gray-500"
                  />
                  <button className="absolute right-2 p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
