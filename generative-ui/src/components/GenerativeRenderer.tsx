'use client';

import React, { useState } from 'react';
import { z } from 'zod';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  Table2,
  CreditCard,
  Play,
  ExternalLink,
  FileText,
  BookOpen,
  MessageSquare,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import type { UiDescriptor, ToolResult } from '@/lib/api';
import { executeTool } from '@/lib/api';

/* ──────────────────────────────────────────────
   SCHEMA VALIDATION
   ────────────────────────────────────────────── */

const uiDescriptorSchema = z.object({
  component: z.enum([
    'metrics',
    'chart',
    'table',
    'card',
    'action',
    'flow',
    'navigate',
    'open_doc',
    'rag',
    'text'
  ]).catch('text'),
  title: z.string().optional(),
  explanation: z.string().optional(),
  chartType: z.enum(['bar', 'line', 'area', 'pie']).optional(),
  columns: z.array(z.object({ key: z.string(), label: z.string() })).optional(),
  data: z.array(z.record(z.unknown())).optional(),
  metrics: z.array(
    z.object({
      label: z.string(),
      value: z.string(),
      change: z.string().optional(),
      trend: z.enum(['up', 'down', 'neutral']).optional()
    })
  ).optional(),
  cardDetails: z.object({
    title: z.string(),
    subtitle: z.string().optional(),
    details: z.array(z.object({ label: z.string(), value: z.string() })).optional()
  }).optional(),
  actionType: z.string().optional(),
  actionParams: z.record(z.unknown()).optional(),
  missingFields: z.array(z.string()).optional(),
  target: z.string().optional(),
  url: z.string().optional(),
  docType: z.string().optional(),
  _dataSource: z.string().optional()
}).passthrough();

/* ──────────────────────────────────────────────
   GENERATIVE RENDERER
   Maps UiDescriptor → React component tree.
   This is the heart of the "Generative UI" pattern:
   the AI returns JSON, this renders it.
   ────────────────────────────────────────────── */

interface GenerativeRendererProps {
  descriptor: UiDescriptor;
  onNavigate?: (target: string, url?: string) => void;
}

export default function GenerativeRenderer({
  descriptor,
  onNavigate,
}: GenerativeRendererProps) {
  // Validate the incoming descriptor
  const parseResult = uiDescriptorSchema.safeParse(descriptor);
  
  if (!parseResult.success) {
    console.error('Invalid UI descriptor:', parseResult.error);
    return (
      <div className="rounded-xl border border-error/20 bg-error/5 p-4">
        <p className="text-sm text-error font-medium">Failed to render AI response.</p>
        <p className="text-xs text-error/80 mt-1">Malformed structure returned from orchestrator.</p>
      </div>
    );
  }

  const validDescriptor = parseResult.data as UiDescriptor;

  switch (validDescriptor.component) {
    case 'metrics':
      return <MetricsComponent descriptor={validDescriptor} />;
    case 'chart':
      return <ChartComponent descriptor={validDescriptor} />;
    case 'table':
      return <TableComponent descriptor={validDescriptor} />;
    case 'card':
      return <CardComponent descriptor={validDescriptor} />;
    case 'action':
      return <ActionComponent descriptor={validDescriptor} />;
    case 'navigate':
      return <NavigateComponent descriptor={validDescriptor} onNavigate={onNavigate} />;
    case 'open_doc':
      return <OpenDocComponent descriptor={validDescriptor} onNavigate={onNavigate} />;
    case 'rag':
      return <RagComponent descriptor={validDescriptor} />;
    case 'text':
      return <TextComponent descriptor={validDescriptor} />;
    case 'flow':
      return <FlowComponent descriptor={validDescriptor} />;
    default:
      return <TextComponent descriptor={validDescriptor} />;
  }
}

/* ── Metrics ────────────────────────────────────────────────────────────── */

function MetricsComponent({ descriptor }: { descriptor: UiDescriptor }) {
  const metrics = descriptor.metrics ?? [];
  return (
    <div className="space-y-3">
      {descriptor.title && (
        <h3 className="text-sm font-semibold text-primary">{descriptor.title}</h3>
      )}
      <div className="grid grid-cols-2 gap-3">
        {metrics.map((m, i) => (
          <div
            key={i}
            className="rounded-xl border border-divider bg-surface p-4 transition-colors hover:bg-surface-hover"
          >
            <p className="text-[10px] uppercase tracking-wider text-secondary">
              {m.label}
            </p>
            <p className="mt-1 text-xl font-bold text-primary">{m.value}</p>
            {m.change && (
              <div className="mt-1 flex items-center gap-1">
                {m.trend === 'up' && (
                  <TrendingUp size={12} className="text-success" />
                )}
                {m.trend === 'down' && (
                  <TrendingDown size={12} className="text-error" />
                )}
                {m.trend === 'neutral' && (
                  <Minus size={12} className="text-secondary" />
                )}
                <span
                  className={`text-xs font-medium ${
                    m.trend === 'up'
                      ? 'text-success'
                      : m.trend === 'down'
                        ? 'text-error'
                        : 'text-secondary'
                  }`}
                >
                  {m.change}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
      {descriptor.explanation && (
        <p className="text-xs text-secondary">{descriptor.explanation}</p>
      )}
    </div>
  );
}

/* ── Chart ──────────────────────────────────────────────────────────────── */

function ChartComponent({ descriptor }: { descriptor: UiDescriptor }) {
  const data = descriptor.data ?? [];
  const columns = descriptor.columns ?? [];
  const valueKey = columns.length > 1 ? columns[1].key : 'value';
  const labelKey = columns.length > 0 ? columns[0].key : 'label';

  const values = data.map((d) => Number(d[valueKey] ?? 0));
  const maxVal = Math.max(...values, 1);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        {descriptor.title && (
          <h3 className="text-sm font-semibold text-primary">{descriptor.title}</h3>
        )}
        <div className="flex items-center gap-1 text-[10px] text-secondary">
          <BarChart3 size={12} />
          <span>{descriptor.chartType ?? 'bar'}</span>
        </div>
      </div>

      {/* Simple bar chart */}
      <div className="rounded-xl border border-divider bg-surface p-4">
        <div className="flex h-40 items-end justify-around gap-2">
          {data.map((d, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-[10px] font-medium text-primary">
                {String(d[valueKey] ?? '')}
              </span>
              <div
                className="w-full max-w-10 rounded-t bg-accent transition-all hover:bg-accent/80"
                style={{ height: `${(values[i] / maxVal) * 100}%`, minHeight: '4px' }}
              />
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-around">
          {data.map((d, i) => (
            <span key={i} className="flex-1 text-center text-[10px] text-secondary truncate px-1">
              {String(d[labelKey] ?? '')}
            </span>
          ))}
        </div>
      </div>

      {descriptor.explanation && (
        <p className="text-xs text-secondary">{descriptor.explanation}</p>
      )}
    </div>
  );
}

/* ── Table ──────────────────────────────────────────────────────────────── */

function TableComponent({ descriptor }: { descriptor: UiDescriptor }) {
  const columns = descriptor.columns ?? [];
  const data = descriptor.data ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Table2 size={14} className="text-accent" />
        {descriptor.title && (
          <h3 className="text-sm font-semibold text-primary">{descriptor.title}</h3>
        )}
        <span className="text-[10px] text-secondary">({data.length} rows)</span>
      </div>

      <div className="overflow-hidden rounded-xl border border-divider">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-surface-hover text-[11px] uppercase tracking-wider text-secondary">
                {columns.map((col) => (
                  <th key={col.key} className="px-4 py-2.5 font-medium">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-divider">
              {data.map((row, i) => (
                <tr
                  key={i}
                  className="bg-surface transition-colors hover:bg-surface-hover"
                >
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-2.5 text-primary">
                      {String(row[col.key] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {descriptor.explanation && (
        <p className="text-xs text-secondary">{descriptor.explanation}</p>
      )}
    </div>
  );
}

/* ── Card ───────────────────────────────────────────────────────────────── */

function CardComponent({ descriptor }: { descriptor: UiDescriptor }) {
  const card = descriptor.cardDetails;
  if (!card) return <TextComponent descriptor={descriptor} />;

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-divider bg-surface p-5">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-muted text-accent">
            <CreditCard size={18} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-primary">{card.title}</h3>
            {card.subtitle && (
              <p className="text-xs text-secondary">{card.subtitle}</p>
            )}
          </div>
        </div>

        {card.details && card.details.length > 0 && (
          <div className="space-y-2 border-t border-divider pt-3">
            {card.details.map((d, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-secondary">{d.label}</span>
                <span className="font-medium text-primary">{d.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {descriptor.explanation && (
        <p className="text-xs text-secondary">{descriptor.explanation}</p>
      )}
    </div>
  );
}

/* ── Action (Write Tool Confirmation) ──────────────────────────────────── */

function ActionComponent({ descriptor }: { descriptor: UiDescriptor }) {
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>(
    'idle'
  );
  const [result, setResult] = useState<ToolResult | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});

  const hasMissing = descriptor.missingFields && descriptor.missingFields.length > 0;

  const handleConfirm = async () => {
    if (!descriptor.actionType) return;
    setState('loading');
    try {
      const params = {
        ...(descriptor.actionParams ?? {}),
        ...formValues,
      };
      const res = await executeTool(descriptor.actionType, params, true);
      setResult(res);
      setState(res.ok ? 'success' : 'error');
    } catch (err) {
      setResult({
        tool: descriptor.actionType ?? '',
        ok: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
      setState('error');
    }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-accent-border bg-accent-muted p-5">
        <div className="mb-3 flex items-center gap-2">
          <Play size={14} className="text-accent" />
          <h3 className="text-sm font-semibold text-primary">
            {descriptor.title ?? `Action: ${descriptor.actionType}`}
          </h3>
        </div>

        {descriptor.explanation && (
          <p className="mb-3 text-xs text-secondary">{descriptor.explanation}</p>
        )}

        {/* Show action parameters */}
        {descriptor.actionParams &&
          Object.keys(descriptor.actionParams).length > 0 && (
            <div className="mb-3 space-y-1.5 rounded-lg bg-surface p-3">
              {Object.entries(descriptor.actionParams).map(([key, val]) => (
                <div key={key} className="flex justify-between text-xs">
                  <span className="text-secondary">{key}</span>
                  <span className="font-medium text-primary">{String(val)}</span>
                </div>
              ))}
            </div>
          )}

        {/* Missing fields form */}
        {hasMissing && state === 'idle' && (
          <div className="mb-3 space-y-2">
            <p className="text-[10px] uppercase tracking-wider text-warning">
              Missing required fields
            </p>
            {descriptor.missingFields!.map((field) => (
              <div key={field} className="flex items-center gap-2">
                <label className="w-28 text-xs text-secondary">{field}</label>
                <input
                  type="text"
                  value={formValues[field] ?? ''}
                  onChange={(e) =>
                    setFormValues((prev) => ({ ...prev, [field]: e.target.value }))
                  }
                  className="flex-1 rounded-lg border border-divider bg-background px-3 py-1.5 text-xs text-primary focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none"
                  placeholder={`Enter ${field}`}
                />
              </div>
            ))}
          </div>
        )}

        {/* Action buttons */}
        {state === 'idle' && (
          <button
            onClick={handleConfirm}
            disabled={hasMissing && Object.values(formValues).some((v) => !v.trim())}
            className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-background transition-all hover:bg-accent/80 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Confirm & Execute
          </button>
        )}

        {state === 'loading' && (
          <div className="flex items-center justify-center gap-2 py-2">
            <Loader2 size={16} className="animate-spin text-accent" />
            <span className="text-xs text-secondary">Executing...</span>
          </div>
        )}

        {state === 'success' && (
          <div className="flex items-center gap-2 rounded-lg bg-success/10 px-3 py-2">
            <CheckCircle2 size={14} className="text-success" />
            <span className="text-xs text-success">Action completed successfully</span>
          </div>
        )}

        {state === 'error' && (
          <div className="flex items-center gap-2 rounded-lg bg-error/10 px-3 py-2">
            <AlertTriangle size={14} className="text-error" />
            <span className="text-xs text-error">
              {result?.error ?? 'Action failed'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Navigate ──────────────────────────────────────────────────────────── */

function NavigateComponent({
  descriptor,
  onNavigate,
}: {
  descriptor: UiDescriptor;
  onNavigate?: (target: string, url?: string) => void;
}) {
  return (
    <div className="space-y-3">
      {descriptor.explanation && (
        <p className="text-xs text-secondary">{descriptor.explanation}</p>
      )}
      <button
        onClick={() => onNavigate?.(descriptor.target ?? '', descriptor.url)}
        className="flex w-full items-center justify-between rounded-xl border border-divider bg-surface p-4 transition-colors hover:bg-surface-hover"
      >
        <div className="flex items-center gap-2">
          <ExternalLink size={14} className="text-accent" />
          <span className="text-sm font-medium text-primary">
            {descriptor.title ?? `Open ${descriptor.target ?? 'page'}`}
          </span>
        </div>
        <span className="text-xs text-secondary">→</span>
      </button>
    </div>
  );
}

/* ── Open Doc ──────────────────────────────────────────────────────────── */

function OpenDocComponent({
  descriptor,
  onNavigate,
}: {
  descriptor: UiDescriptor;
  onNavigate?: (target: string, url?: string) => void;
}) {
  return (
    <div className="space-y-3">
      {descriptor.explanation && (
        <p className="text-xs text-secondary">{descriptor.explanation}</p>
      )}
      <button
        onClick={() =>
          onNavigate?.(
            `open_doc/${descriptor.docType}`,
            descriptor.url
          )
        }
        className="flex w-full items-center gap-3 rounded-xl border border-divider bg-surface p-4 transition-colors hover:bg-surface-hover"
      >
        <FileText size={16} className="text-accent" />
        <div className="text-left">
          <p className="text-sm font-medium text-primary">
            {descriptor.title ?? `Open ${descriptor.docType}`}
          </p>
          {descriptor.docType && (
            <p className="text-[10px] text-secondary">DocType: {descriptor.docType}</p>
          )}
        </div>
      </button>
    </div>
  );
}

/* ── RAG / Knowledge ───────────────────────────────────────────────────── */

function RagComponent({ descriptor }: { descriptor: UiDescriptor }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <BookOpen size={14} className="text-info" />
        {descriptor.title && (
          <h3 className="text-sm font-semibold text-primary">{descriptor.title}</h3>
        )}
      </div>
      <div className="rounded-xl border border-info/20 bg-info/5 p-4">
        <p className="text-sm leading-relaxed text-primary">
          {descriptor.explanation ?? 'No answer found.'}
        </p>
      </div>
    </div>
  );
}

/* ── Text (fallback) ───────────────────────────────────────────────────── */

function TextComponent({ descriptor }: { descriptor: UiDescriptor }) {
  return (
    <div className="space-y-2">
      {descriptor.title && (
        <h3 className="text-sm font-semibold text-primary">{descriptor.title}</h3>
      )}
      <p className="text-sm leading-relaxed text-primary">
        {descriptor.explanation ?? ''}
      </p>
    </div>
  );
}

/* ── Flow ───────────────────────────────────────────────────────────────── */

function FlowComponent({ descriptor }: { descriptor: UiDescriptor }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <MessageSquare size={14} className="text-accent" />
        {descriptor.title && (
          <h3 className="text-sm font-semibold text-primary">{descriptor.title}</h3>
        )}
      </div>
      {descriptor.explanation && (
        <p className="text-sm text-secondary">{descriptor.explanation}</p>
      )}
      {descriptor.data && descriptor.data.length > 0 && (
        <div className="space-y-2">
          {descriptor.data.map((step, i) => (
            <div
              key={i}
              className="flex items-start gap-3 rounded-lg border border-divider bg-surface p-3"
            >
              <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-accent-muted text-[10px] font-bold text-accent">
                {i + 1}
              </div>
              <p className="text-xs text-primary">
                {String(step.description ?? step.step ?? JSON.stringify(step))}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
