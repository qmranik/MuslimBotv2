import IframeWrapper from '@/components/IframeWrapper';

// Frappe Builder — the business's blog/website editor, embedded via the
// orchestrator's `builder` portal (frappe-web /builder).
export default function SitePage() {
  return (
    <div className="h-[calc(100vh-5rem)] w-full">
      <IframeWrapper targetApp="builder" />
    </div>
  );
}
