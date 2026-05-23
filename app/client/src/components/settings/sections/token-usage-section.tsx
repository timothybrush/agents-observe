import { useQuery } from '@tanstack/react-query'
import { Info } from 'lucide-react'
import { api, type TranscriptStatsErrorCode, type TranscriptStatsData } from '@/lib/api-client'
import { AgentLabel } from '@/components/shared/agent-label'
import type { Agent } from '@/types'
import { CollapsibleSection } from './collapsible-section'
import { ModelBadge } from './model-badge'
import { SortableTable, type SortableColumn } from './sortable-table'

function fmt(n: number): string {
  return n.toLocaleString()
}
function fmtCents(c: number | null): string {
  if (c == null) return '—'
  return `$${(c / 100).toFixed(2)}`
}
function fmtPct(r: number): string {
  return `${(r * 100).toFixed(1)}%`
}
function fmtMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(0)}s`
  if (ms < 3_600_000) {
    return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`
  }
  return `${Math.floor(ms / 3_600_000)}h ${Math.floor((ms % 3_600_000) / 60_000)}m`
}

const ERROR_MESSAGES: Record<TranscriptStatsErrorCode, string> = {
  disabled:
    "Session transcript parsing isn't enabled — set AGENTS_OBSERVE_TRANSCRIPT_STATS=1 to see models and token usage.",
  no_transcript:
    'Session transcript not available — models and token usage info not available for this session.',
  file_not_found: 'Session transcript file not found — models and token usage info not available.',
  file_unreadable:
    "Session transcript exists but isn't readable by the server — check the bind-mount permissions.",
  file_too_large: 'Session transcript exceeds the 100 MB safety cap — token stats skipped.',
  parse_error: "Couldn't parse this session's transcript — token usage info isn't available.",
  unknown: 'Token usage info is unavailable for this session.',
}

function AgentLabelByAgentId({ agentId, agents }: { agentId: string; agents: Agent[] }) {
  const agent = agents.find((a) => a.id === agentId)
  if (!agent) {
    return <span className="font-mono text-muted-foreground">{agentId.slice(0, 12)}</span>
  }
  return <AgentLabel agent={agent} disableTooltip />
}

function Card({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/20 px-2.5 py-1.5">
      <div className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`font-mono text-sm ${valueClass ?? 'text-foreground'}`}>{value}</div>
    </div>
  )
}

export function TokenUsageSection({ sessionId, agents }: { sessionId: string; agents: Agent[] }) {
  const { data, isLoading } = useQuery({
    queryKey: ['transcript-stats', sessionId],
    queryFn: () => api.getTranscriptStats(sessionId),
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
  })

  if (isLoading || !data) {
    return (
      <CollapsibleSection
        title="Token Usage"
        preview={<div className="text-xs text-muted-foreground italic">Loading…</div>}
        details={null}
      />
    )
  }

  if (!data.ok) {
    return (
      <CollapsibleSection
        title="Token Usage"
        preview={
          <div className="flex items-start gap-2 text-xs text-muted-foreground italic">
            <Info className="h-3 w-3 mt-0.5 shrink-0" />
            <span>{ERROR_MESSAGES[data.error] ?? data.message}</span>
          </div>
        }
        details={null}
      />
    )
  }

  const stats = data.data

  const byModelCols: SortableColumn<TranscriptStatsData['byModel'][number]>[] = [
    {
      key: 'model',
      label: 'Model',
      sortType: 'string',
      render: (r) => <ModelBadge modelId={r.model} pricing={stats.models[r.model]?.pricing} />,
      sortValue: (r) => r.model,
    },
    {
      key: 'calls',
      label: 'Requests',
      sortType: 'number',
      align: 'right',
      render: (r) => fmt(r.calls),
      sortValue: (r) => r.calls,
    },
    {
      key: 'input',
      label: 'Input',
      sortType: 'number',
      align: 'right',
      render: (r) => fmt(r.inputTokens),
      sortValue: (r) => r.inputTokens,
    },
    {
      key: 'output',
      label: 'Output',
      sortType: 'number',
      align: 'right',
      render: (r) => fmt(r.outputTokens),
      sortValue: (r) => r.outputTokens,
    },
    {
      key: 'cachePct',
      label: 'Cache %',
      sortType: 'number',
      align: 'right',
      render: (r) =>
        r.inputTokens > 0 ? (
          <span className="text-green-500">{fmtPct(r.cacheReadTokens / r.inputTokens)}</span>
        ) : (
          '—'
        ),
      sortValue: (r) => (r.inputTokens > 0 ? r.cacheReadTokens / r.inputTokens : 0),
    },
    {
      key: 'cacheRead',
      label: 'Cache read',
      sortType: 'number',
      align: 'right',
      render: (r) => <span className="text-muted-foreground">{fmt(r.cacheReadTokens)}</span>,
      sortValue: (r) => r.cacheReadTokens,
      className: 'border-l border-border/30',
    },
    {
      key: 'cacheWrite',
      label: 'Cache write',
      sortType: 'number',
      align: 'right',
      render: (r) => (
        <span className="text-muted-foreground">
          {fmt(r.cacheCreate5mTokens + r.cacheCreate1hTokens)}
        </span>
      ),
      sortValue: (r) => r.cacheCreate5mTokens + r.cacheCreate1hTokens,
    },
    {
      key: 'cost',
      label: 'Est Cost',
      sortType: 'number',
      align: 'right',
      render: (r) => <span className="text-amber-500">{fmtCents(r.costCents)}</span>,
      sortValue: (r) => r.costCents ?? 0,
      className: 'border-l border-border/30',
    },
  ]

  const promptCols: SortableColumn<TranscriptStatsData['prompts'][number]>[] = [
    {
      key: 'prompt',
      label: 'Prompt',
      sortType: 'string',
      render: (r) => (
        <span className="block truncate max-w-[400px]" title={r.text}>
          {r.text}
        </span>
      ),
      sortValue: (r) => r.text,
    },
    {
      key: 'duration',
      label: 'Duration',
      sortType: 'number',
      align: 'right',
      render: (r) => (r.durationMs == null ? '—' : fmtMs(r.durationMs)),
      sortValue: (r) => r.durationMs ?? 0,
    },
    {
      key: 'tools',
      label: 'Tools',
      sortType: 'number',
      align: 'right',
      render: (r) => fmt(r.toolCount),
      sortValue: (r) => r.toolCount,
    },
    {
      key: 'requests',
      label: 'Requests',
      sortType: 'number',
      align: 'right',
      render: (r) => fmt(r.requests),
      sortValue: (r) => r.requests,
    },
    {
      key: 'input',
      label: 'Input',
      sortType: 'number',
      align: 'right',
      render: (r) => fmt(r.inputTokens),
      sortValue: (r) => r.inputTokens,
    },
    {
      key: 'output',
      label: 'Output',
      sortType: 'number',
      align: 'right',
      render: (r) => fmt(r.outputTokens),
      sortValue: (r) => r.outputTokens,
    },
    {
      key: 'models',
      label: 'Model',
      sortType: 'string',
      render: (r) => (
        <span className="flex flex-wrap gap-1">
          {r.models.map((m) => (
            <ModelBadge key={m} modelId={m} pricing={stats.models[m]?.pricing} />
          ))}
        </span>
      ),
      sortValue: (r) => r.models.join(','),
    },
    {
      key: 'cost',
      label: 'Est Cost',
      sortType: 'number',
      align: 'right',
      render: (r) => <span className="text-amber-500">{fmtCents(r.costCents)}</span>,
      sortValue: (r) => r.costCents ?? 0,
    },
  ]

  const subagentCols: SortableColumn<TranscriptStatsData['subagents'][number]>[] = [
    {
      key: 'agent',
      label: 'Agent',
      sortType: 'string',
      render: (r) => <AgentLabelByAgentId agentId={r.agentId} agents={agents} />,
      sortValue: (r) => r.agentId,
    },
    {
      key: 'type',
      label: 'Type',
      sortType: 'string',
      render: (r) => <span className="text-blue-300">{r.agentType ?? '—'}</span>,
      sortValue: (r) => r.agentType ?? '',
    },
    {
      key: 'duration',
      label: 'Duration',
      sortType: 'number',
      align: 'right',
      render: (r) => fmtMs(r.durationMs),
      sortValue: (r) => r.durationMs,
    },
    {
      key: 'tools',
      label: 'Tools',
      sortType: 'number',
      align: 'right',
      render: (r) => fmt(r.toolCount),
      sortValue: (r) => r.toolCount,
    },
    {
      key: 'requests',
      label: 'Requests',
      sortType: 'number',
      align: 'right',
      render: (r) => fmt(r.requests),
      sortValue: (r) => r.requests,
    },
    {
      key: 'input',
      label: 'Input',
      sortType: 'number',
      align: 'right',
      render: (r) => fmt(r.inputTokens),
      sortValue: (r) => r.inputTokens,
    },
    {
      key: 'output',
      label: 'Output',
      sortType: 'number',
      align: 'right',
      render: (r) => fmt(r.outputTokens),
      sortValue: (r) => r.outputTokens,
    },
    {
      key: 'model',
      label: 'Model',
      sortType: 'string',
      render: (r) => <ModelBadge modelId={r.model} pricing={stats.models[r.model]?.pricing} />,
      sortValue: (r) => r.model,
    },
    {
      key: 'cost',
      label: 'Est Cost',
      sortType: 'number',
      align: 'right',
      render: (r) => <span className="text-amber-500">{fmtCents(r.costCents)}</span>,
      sortValue: (r) => r.costCents ?? 0,
    },
  ]

  const preview = (
    <div className="space-y-3">
      <div className="grid grid-cols-5 gap-2">
        <Card label="Requests" value={fmt(stats.summary.totalCalls)} />
        <Card label="Total Input" value={fmt(stats.summary.inputTotal)} />
        <Card label="Total Output" value={fmt(stats.summary.outputTotal)} />
        <Card
          label="Cache Hit"
          value={fmtPct(stats.summary.cacheHitRate)}
          valueClass="text-green-500"
        />
        <Card
          label="Est Cost"
          value={fmtCents(stats.summary.costTotalCents)}
          valueClass="text-amber-500"
        />
      </div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mt-2">
        By Model
      </div>
      <SortableTable
        rows={stats.byModel}
        columns={byModelCols}
        defaultSort={{ key: 'cost', dir: 'desc' }}
      />
    </div>
  )

  const details = (
    <div className="space-y-4">
      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-1">
          By Prompt
        </div>
        {stats.prompts.length === 0 ? (
          <div className="text-xs text-muted-foreground italic">No prompts in this session.</div>
        ) : (
          <SortableTable
            rows={stats.prompts}
            columns={promptCols}
            defaultSort={{ key: 'cost', dir: 'desc' }}
          />
        )}
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-1">
          Subagents
        </div>
        {stats.subagents.length === 0 ? (
          <div className="text-xs text-muted-foreground italic">No subagents in this session.</div>
        ) : (
          <SortableTable
            rows={stats.subagents}
            columns={subagentCols}
            defaultSort={{ key: 'cost', dir: 'desc' }}
          />
        )}
      </div>
    </div>
  )

  return <CollapsibleSection title="Token Usage" preview={preview} details={details} />
}
