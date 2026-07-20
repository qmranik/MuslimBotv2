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
import type { UiDescriptor, ToolResult, ToolAction } from '@/lib/api';
import { prepareAction, confirmAction } from '@/lib/api';

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
  data: z.array(z.record(z.string(), z.unknown())).optional(),
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
  actionParams: z.record(z.string(), z.unknown()).optional(),
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

// Two-step write confirmation (W1). "Review" prepares a durable, server-normalized
// ToolAction; "Confirm" executes it via /v1/tool-actions/:id/confirm. The card
// shows the SERVER's normalized parameters — the exact thing that will run — not
// the client's guess. Nothing mutates business state before Confirm.
function ActionComponent({ descriptor }: { descriptor: UiDescriptor }) {
  const [state, setState] = useState<
    'intent' | 'preparing' | 'prepared' | 'executing' | 'success' | 'error'
  >('intent');
  const [action, setAction] = useState<ToolAction | null>(null);
  const [result, setResult] = useState<ToolResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});

  const hasMissing =
    !!descriptor.missingFields && descriptor.missingFields.length > 0;
  const missingUnfilled =
    hasMissing &&
    descriptor.missingFields!.some((f) => !(formValues[f] ?? '').trim());

  const handleReview = async () => {
    if (!descriptor.actionType) return;
    setState('preparing');
    setErrorMsg(null);
    try {
      const params = { ...(descriptor.actionParams ?? {}), ...formValues };
      const res = await prepareAction(descriptor.actionType, params);
      if ('action_id' in res) {
        setAction(res);
        setState('prepared');
      } else if ('result' in res) {
        // Read executed instantly (defensive — action descriptors are writes).
        setResult(res.result);
        setState(res.result.ok ? 'success' : 'error');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not prepare action');
      setState('error');
    }
  };

  const handleConfirm = async () => {
    if (!action) return;
    setState('executing');
    try {
      const done = await confirmAction(action.action_id, 'approve');
      setAction(done);
      if (done.status === 'executed') {
        setState('success');
      } else {
        setErrorMsg(done.error ?? `Action ${done.status}`);
        setState('error');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Confirmation failed');
      setState('error');
    }
  };

  const handleCancel = async () => {
    if (action) {
      try {
        await confirmAction(action.action_id, 'reject');
      } catch {
        /* best-effort */
      }
    }
    setState('intent');
    setAction(null);
  };

  // Which params to show: server-normalized once prepared, else the intent.
  const shownParams =
    action?.normalized_params ??
    (descriptor.actionParams as Record<string, unknown> | undefined) ??
    {};

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-accent-border bg-accent-muted p-5">
        <div className="mb-3 flex items-center gap-2">
          <Play size={14} className="text-accent" />
          <h3 className="text-sm font-semibold text-primary">
            {action?.summary ??
              descriptor.title ??
              `Action: ${descriptor.actionType}`}
          </h3>
        </div>

        {descriptor.explanation && state === 'intent' && (
          <p className="mb-3 text-xs text-secondary">{descriptor.explanation}</p>
        )}

        {state === 'prepared' && (
          <p className="mb-2 text-[10px] uppercase tracking-wider text-accent">
            Review — this is exactly what will run
          </p>
        )}

        {Object.keys(shownParams).length > 0 && state !== 'success' && (
          <div className="mb-3 space-y-1.5 rounded-lg bg-surface p-3">
            {Object.entries(shownParams).map(([key, val]) => (
              <div key={key} className="flex justify-between gap-4 text-xs">
                <span className="text-secondary">{key}</span>
                <span className="truncate font-medium text-primary">
                  {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Missing fields form (before review) */}
        {hasMissing && state === 'intent' && (
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

        {state === 'intent' && (
          <button
            onClick={handleReview}
            disabled={missingUnfilled}
            className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-background transition-all hover:bg-accent/80 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Review action
          </button>
        )}

        {state === 'preparing' && (
          <div className="flex items-center justify-center gap-2 py-2">
            <Loader2 size={16} className="animate-spin text-accent" />
            <span className="text-xs text-secondary">Preparing…</span>
          </div>
        )}

        {state === 'prepared' && (
          <div className="flex gap-2">
            <button
              onClick={handleConfirm}
              className="flex-1 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-background transition-all hover:bg-accent/80"
            >
              Confirm &amp; Execute
            </button>
            <button
              onClick={handleCancel}
              className="rounded-lg border border-divider px-4 py-2.5 text-sm text-secondary transition-colors hover:text-primary"
            >
              Cancel
            </button>
          </div>
        )}

        {state === 'executing' && (
          <div className="flex items-center justify-center gap-2 py-2">
            <Loader2 size={16} className="animate-spin text-accent" />
            <span className="text-xs text-secondary">Executing…</span>
          </div>
        )}

        {state === 'success' && (
          <div className="flex items-center gap-2 rounded-lg bg-success/10 px-3 py-2">
            <CheckCircle2 size={14} className="text-success" />
            <span className="text-xs text-success">
              Done{action?.action_id ? ` · ${action.action_id}` : ''}
            </span>
          </div>
        )}

        {state === 'error' && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 rounded-lg bg-error/10 px-3 py-2">
              <AlertTriangle size={14} className="text-error" />
              <span className="text-xs text-error">
                {errorMsg ?? result?.error ?? 'Action failed'}
              </span>
            </div>
            <button
              onClick={() => setState('intent')}
              className="text-xs text-secondary hover:text-primary"
            >
              Try again
            </button>
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
