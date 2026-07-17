import { usePathname } from 'next/navigation';
import { Bot, FileText, Search, Database, Sparkles, BookOpen } from 'lucide-react';

export function useFabContext() {
  const pathname = usePathname();

  if (pathname.startsWith('/knowledge-hub')) {
    return {
      mode: 'knowledge',
      icon: BookOpen,
      label: 'Ask the Knowledge Agent',
      tooltip: 'Query the RAG Knowledge Base',
    };
  }

  if (pathname.startsWith('/erp-')) {
    return {
      mode: 'system',
      icon: Database,
      label: 'System Agent',
      tooltip: 'Interact with legacy systems',
    };
  }

  if (pathname.startsWith('/generative')) {
    return {
      mode: 'generative',
      icon: Sparkles,
      label: 'Generative Agent',
      tooltip: 'Command the Generative OS',
    };
  }

  // Default Home
  return {
    mode: 'assistant',
    icon: Sparkles,
    label: 'Draft an invoice',
    tooltip: 'Draft an invoice or ask a question',
  };
}
