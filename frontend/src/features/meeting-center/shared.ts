import type { PocMeeting } from "../../lib/teamsPocApi";

export function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export const STATUS_STYLE: Record<PocMeeting["status"], string> = {
  scheduled: "bg-slate-500/20 text-slate-300 border-slate-400/30",
  processing: "bg-amber-500/20 text-amber-300 border-amber-400/30",
  completed: "bg-emerald-500/20 text-emerald-300 border-emerald-400/30",
  failed: "bg-rose-500/20 text-rose-300 border-rose-400/30",
  cancelled: "bg-slate-600/30 text-slate-400 border-slate-500/30",
};

export const STATUS_DOT: Record<PocMeeting["status"], string> = {
  scheduled: "bg-slate-400",
  processing: "bg-amber-400",
  completed: "bg-emerald-400",
  failed: "bg-rose-400",
  cancelled: "bg-slate-500",
};

export const SOURCE_LABEL: Record<PocMeeting["source"], string> = {
  local_stub: "Local stub",
  flow_scheduled: "Scheduled via Flow",
  flow_ingest: "Ingested via Flow",
  manual_ingest: "Manual ingest",
};

/** Splits a comma/semicolon/newline-separated string of email addresses into
 * a deduped, trimmed list. Accepts internal or external addresses — the
 * Teams meeting invite (a normal Outlook calendar invite under the hood)
 * supports both. */
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

/** Cancelling is only allowed while the meeting is still `scheduled` and its
 * start time hasn't passed yet (mirrors the backend's own check). */
export function isCancellable(m: PocMeeting): boolean {
  if (m.status !== "scheduled") return false;
  if (!m.start_time) return true;
  return new Date(m.start_time).getTime() > Date.now();
}
