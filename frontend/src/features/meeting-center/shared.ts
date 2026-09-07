import type { AppfwRecord } from '../../lib/appfwClient';

/**
 * Shared display helpers for the Meeting Center screens — ported from
 * origin/Dev's `features/meeting-center/shared.ts`. Dev's `status`/`source`
 * are typed enums straight off its own POC pipeline (`scheduled|processing|
 * completed|failed|cancelled`, `local_stub|graph_scheduled|graph_ingest|...`);
 * this branch's `Meeting.status`/`Meeting.source` are plain strings with a
 * different, real vocabulary driven by `services::meeting_scheduling` /
 * `services::meeting_agent` (`scheduled` -> `graph_scheduled` once a live
 * Teams meeting is created, `transcript_captured` once a VTT is attached,
 * `cancelled`; source is `manual` or `local_stub`). Adapted to that
 * vocabulary rather than reproducing Dev's fictional one.
 */

export type MeetingRow = AppfwRecord & { id: string };

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export const STATUS_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  scheduled: { bg: 'rgba(100,116,139,0.2)', color: '#cbd5e1', border: 'rgba(148,163,184,0.3)' },
  graph_scheduled: { bg: 'rgba(16,185,129,0.15)', color: '#34d399', border: 'rgba(52,211,153,0.3)' },
  transcript_captured: { bg: 'rgba(96,165,250,0.15)', color: '#60A5FA', border: 'rgba(96,165,250,0.3)' },
  cancelled: { bg: 'rgba(100,116,139,0.15)', color: '#94A3B8', border: 'rgba(148,163,184,0.2)' },
  failed: { bg: 'rgba(244,63,94,0.15)', color: '#FB7185', border: 'rgba(251,113,133,0.3)' }
};
const DEFAULT_STATUS_STYLE = { bg: 'rgba(100,116,139,0.15)', color: '#94A3B8', border: 'rgba(148,163,184,0.2)' };
export function statusStyle(status: string) {
  return STATUS_STYLE[status] ?? DEFAULT_STATUS_STYLE;
}

export const STATUS_LABEL: Record<string, string> = {
  scheduled: 'Scheduled',
  graph_scheduled: 'Live on Teams',
  transcript_captured: 'Transcript captured',
  cancelled: 'Cancelled',
  failed: 'Failed'
};
export function statusLabel(status: string): string {
  return STATUS_LABEL[status] ?? status.replace(/_/g, ' ');
}

export const SOURCE_LABEL: Record<string, string> = {
  manual: 'Manual registration',
  local_stub: 'Local stub'
};
export function sourceLabel(source: string | null | undefined): string {
  if (!source) return 'Local stub';
  return SOURCE_LABEL[source] ?? source.replace(/_/g, ' ');
}

/** Cancelling (a real Graph cancel via `cancelViaGraph`) only makes sense
 * once a live Teams meeting actually backs the row, and while it hasn't
 * already started. */
export function isCancellable(m: MeetingRow): boolean {
  if (m.status !== 'graph_scheduled') return false;
  const start = m.start_time;
  if (typeof start !== 'string') return true;
  return new Date(start).getTime() > Date.now();
}

/** Splits a comma/semicolon/newline-separated string of email addresses into
 * a deduped, trimmed list. */
export function parseEmailList(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/[,;\n]/)) {
    const email = part.trim();
    if (!email || seen.has(email.toLowerCase())) continue;
    seen.add(email.toLowerCase());
    out.push(email);
  }
  return out;
}
