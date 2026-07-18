import IframeWrapper from '@/components/IframeWrapper';

export default function WorkflowsPage() {
  return (
    <div className="h-[calc(100vh-5rem)] w-full">
      <IframeWrapper targetApp="n8n" />
    </div>
  );
}
