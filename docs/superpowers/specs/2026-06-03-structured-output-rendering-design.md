# StructuredOutput Event Rendering — Design

**Date:** 2026-06-03
**Status:** Approved

## Problem

Claude Code recently added the `StructuredOutput` tool, used by workflow subagents
(and the `schema` option of the `agent()` workflow hook) to emit validated,
schema-defined data. It fires the usual tool lifecycle hooks: `PreToolUse`,
`PostToolUse`, and `PostToolUseFailure`.

In agents-observe these events currently fall through to the generic `default`
tool handling: the row summary uses `tool_input.description || command || query`
(none of which exist), and the detail view dumps the payload as raw JSON. The
result is empty/uninformative rows and a wall of JSON in the detail panel.

`StructuredOutput` is unusual: its `tool_input` **is** the structured payload
(an arbitrary object whose shape is defined by the caller's schema — scalars,
nested objects, and arrays of objects like `findings[]`). The `tool_response` is
only the confirmation string `"Structured output provided successfully"` and
carries no useful information. On failure, `payload.error` is the schema
validation message (e.g. `must have required property 'findings'`) and
`tool_input` holds the rejected/partial output.

Because Pre and Post payloads are merged on the surviving Pre row
(`process-event.ts` payload merge), the full structured data is available on the
displayed event via `tool_input`.

## Goals

- Give `StructuredOutput` events a distinct icon and an informative one-line
  summary in the event stream.
- Render the structured payload readably in the detail view (hybrid:
  elevate the `summary` field, show the rest as formatted JSON).
- On `PostToolUseFailure`, show both the attempted output and the schema error.

## Non-Goals

- A fully recursive, schema-aware structured renderer (cards per array item,
  etc.). Rejected in favor of the simpler hybrid approach.
- Showing the `tool_response` confirmation string.
- Any server-side / hook-capture changes. This is client-render only.

## Design

### 1. Icon

`app/client/src/lib/event-icon-registry.ts`: add
```ts
ToolStructuredOutput: {
  id: 'ToolStructuredOutput',
  name: 'Structured Output',
  group: 'Tools',
  icon: Braces,          // lucide-react
  defaultColor: CYAN,
}
```

`app/client/src/agents/claude-code/process-event.ts` (`pickIconId` map): add
`StructuredOutput: 'ToolStructuredOutput'`.

The framework's `computeSlots` then renders the `StructuredOutput` tool chip
automatically; no row-summary slot work needed.

### 2. Row summary

`app/client/src/agents/claude-code/helpers.ts` (`getToolSummary` switch): add
```ts
case 'StructuredOutput':
  return structuredOutputSummary(toolInput)
```
where `structuredOutputSummary` returns, in priority order:
1. top-level `summary` field, if a non-empty string (passed through `oneLine`)
2. else the first string-valued top-level field (passed through `oneLine`)
3. else `‹N fields›` where N = number of top-level keys (or `''` if empty)

The existing `PostToolUseFailure` summary path
(`p.error || getToolSummary(...)`) already surfaces the schema-mismatch error on
the failure row — unchanged.

### 3. Detail view — hybrid

`app/client/src/agents/claude-code/event-detail.tsx`: a new shared component
```tsx
function StructuredOutputDetail({ data }: { data: Record<string, any> })
```
that renders:
- `summary` (if a string) via `DetailRow` (or `DetailCode` when long / markdown-ish)
- the remaining fields (all keys except `summary`) as one `DetailCode label="Output"`
  with `JSON.stringify(rest, null, 2)`
- nothing for the `Output` block when there are no non-`summary` keys (partial Pre event)

Wired into the `switch (event.toolName)` (PreToolUse/PostToolUse branch):
```tsx
case 'StructuredOutput':
  return <StructuredOutputDetail data={ti} />
```

### 4. Failure detail

In the existing `if (event.hookName === 'PostToolUseFailure')` block, when
`event.toolName === 'StructuredOutput'`, render `<StructuredOutputDetail data={failTi} />`
(the attempted output) above the existing `Error` `DetailCode`. Other tools keep
the current generic failure rendering.

### 5. Tests

`app/client/src/agents/claude-code/process-event.test.ts` (and/or a helpers test):
- a `PreToolUse` / `PostToolUse` event with `tool_name: 'StructuredOutput'`
  enriches to `iconId === 'ToolStructuredOutput'`.
- summary derivation: `{ summary: 'x', ... }` → `x`; `{ topRisks: 'r', findings: [...] }`
  (no summary) → `r` (first string field); `{ findings: [...] }` (no string scalars)
  → `‹1 fields›`-style fallback.

## Files Touched

- `app/client/src/lib/event-icon-registry.ts`
- `app/client/src/agents/claude-code/process-event.ts`
- `app/client/src/agents/claude-code/helpers.ts`
- `app/client/src/agents/claude-code/event-detail.tsx`
- `app/client/src/agents/claude-code/process-event.test.ts` (+ helpers test if present)

## Testing / Verification

- `just check` (tests + formatting) passes.
- Manual: load a session containing StructuredOutput events (e.g. a workflow run)
  in the dashboard and confirm icon, row summary, detail hybrid, and the
  failure-with-error rendering.
