import DashboardOverview from '@/components/DashboardOverview';
import ErpDataTable from '@/components/ErpDataTable';
import KnowledgeBaseBrowser from '@/components/KnowledgeBaseBrowser';

export default function WorkspaceDashboard() {
  return (
    <div className="space-y-12 pb-24">
      {/* KPI Cards + Activity Feed + System Health */}
      <DashboardOverview />

      {/* Divider */}
      <hr className="border-divider" />

      {/* ERP Invoice Table */}
      <ErpDataTable />

      {/* Divider */}
      <hr className="border-divider" />

      {/* RAG Knowledge Base */}
      <KnowledgeBaseBrowser />

      {/* AiChatPanel now lives in workspace/layout.tsx so it persists across routes */}
    </div>
  );
}
