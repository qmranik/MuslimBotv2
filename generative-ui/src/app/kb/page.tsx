import KnowledgeBaseBrowser from '@/components/KnowledgeBaseBrowser';

export default function KnowledgePage() {
  return (
    <div className="space-y-8 pb-24">
      <header>
        <h1 className="text-2xl font-semibold text-primary">Knowledge Base</h1>
        <p className="text-sm text-secondary">
          Search and manage the RAG corpus that grounds the agent&apos;s answers.
        </p>
      </header>
      <KnowledgeBaseBrowser />
    </div>
  );
}
