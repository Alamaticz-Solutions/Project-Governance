import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { ApiError } from "../../lib/apiClient";
import { teamsPocApi, type PocMeeting } from "../../lib/teamsPocApi";

const SAMPLE_VTT = `WEBVTT

00:00:01.000 --> 00:00:06.000
<v Priya Nair>Let's start the EAC review for the Cloud Data Lake migration.</v>

00:00:06.500 --> 00:00:12.000
<v Marcus Vance>Architecture looks solid, but it depends on the SOC2 vendor sign-off for the Azure modules.</v>

00:00:12.500 --> 00:00:18.000
<v Priya Nair>Agreed. Decision: we approve the design in principle, conditional on Security sign-off.</v>

00:00:18.500 --> 00:00:24.000
<v Marcus Vance>I'll raise the vendor risk assessment before the next session.</v>
`;

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const STATUS_STYLE: Record<PocMeeting["status"], string> = {
  scheduled: "bg-slate-500/20 text-slate-300 border-slate-400/30",
  processing: "bg-amber-500/20 text-amber-300 border-amber-400/30",
  completed: "bg-emerald-500/20 text-emerald-300 border-emerald-400/30",
  failed: "bg-rose-500/20 text-rose-300 border-rose-400/30",
  cancelled: "bg-slate-600/30 text-slate-400 border-slate-500/30",
};

const STATUS_DOT: Record<PocMeeting["status"], string> = {
  scheduled: "bg-slate-400",
  processing: "bg-amber-400",
  completed: "bg-emerald-400",
  failed: "bg-rose-400",
  cancelled: "bg-slate-500",
};

const SOURCE_LABEL: Record<PocMeeting["source"], string> = {
  local_stub: "Local stub",
  flow_scheduled: "Scheduled via Flow",
  flow_ingest: "Ingested via Flow",
  manual_ingest: "Manual ingest",
};

/** Cancelling is only allowed while the meeting is still `scheduled` and its
 * start time hasn't passed yet (mirrors the backend's own check). */
function isCancellable(m: PocMeeting): boolean {
  if (m.status !== "scheduled") return false;
  if (!m.start_time) return true;
  return new Date(m.start_time).getTime() > Date.now();
}

export function MeetingCenterPage() {
  const [meetings, setMeetings] = useState<PocMeeting[]>([]);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // schedule form
  const [showSchedule, setShowSchedule] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const [subject, setSubject] = useState("EAC Architecture Review — Cloud Data Lake");
  const [date, setDate] = useState(today);
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("11:00");
  const [organizerEmail, setOrganizerEmail] = useState("");
  const [scheduling, setScheduling] = useState(false);

  // transcript ingest
  const [vtt, setVtt] = useState(SAMPLE_VTT);
  const [ingesting, setIngesting] = useState(false);

  const [removingId, setRemovingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const detail = useMemo(
    () => meetings.find((m) => m.id === detailId) ?? null,
    [meetings, detailId],
  );

  const stats = useMemo(() => {
    const s = { total: meetings.length, scheduled: 0, processing: 0, completed: 0, failed: 0, cancelled: 0 };
    for (const m of meetings) s[m.status] += 1;
    return s;
  }, [meetings]);

  const refresh = useCallback(async () => {
    try {
      const list = await teamsPocApi.list();
      setMeetings(list);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load meetings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [refresh]);

  // poll while any meeting is processing
  useEffect(() => {
    if (!meetings.some((m) => m.status === "processing")) return;
    pollRef.current = setTimeout(() => void refresh(), 2500);
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [meetings, refresh]);

  // close the detail modal with Escape
  useEffect(() => {
    if (!detailId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setDetailId(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detailId]);

  async function schedule(e: FormEvent) {
    e.preventDefault();
    setScheduling(true);
    setError(null);
    try {
      const created = await teamsPocApi.schedule({
        subject,
        start_time: new Date(`${date}T${startTime}:00`).toISOString(),
        end_time: new Date(`${date}T${endTime}:00`).toISOString(),
        organizer_email: organizerEmail || undefined,
      });
      setShowSchedule(false);
      await refresh();
      setDetailId(created.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to schedule meeting");
    } finally {
      setScheduling(false);
    }
  }

  async function ingest() {
    if (!detail) return;
    setIngesting(true);
    setError(null);
    try {
      const updated = await teamsPocApi.ingestTranscript(detail.id, vtt);
      setMeetings((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to ingest transcript");
    } finally {
      setIngesting(false);
    }
  }

  async function removeMeeting(id: string, subject: string) {
    if (
      !window.confirm(
        `Remove "${subject}"? This deletes the meeting record and any AI results. This does not cancel the meeting in Teams.`,
      )
    ) {
      return;
    }
    setRemovingId(id);
    setError(null);
    try {
      await teamsPocApi.remove(id);
      setMeetings((prev) => prev.filter((m) => m.id !== id));
      setDetailId((cur) => (cur === id ? null : cur));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to remove meeting");
    } finally {
      setRemovingId(null);
    }
  }

  async function cancelMeeting(id: string, subject: string) {
    if (!window.confirm(`Cancel "${subject}"? The Teams join link will stop working.`)) {
      return;
    }
    setCancellingId(id);
    setError(null);
    try {
      const updated = await teamsPocApi.cancel(id);
      setMeetings((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to cancel meeting");
    } finally {
      setCancellingId(null);
    }
  }

  function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setVtt(String(reader.result ?? ""));
    reader.readAsText(file);
    e.target.value = "";
  }

  return (
    <div className="animate-fade-in p-6 min-h-full" style={{ background: "#0f172a", color: "#f8fafc" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="text-3xl font-bold text-white tracking-tight flex items-center gap-3"
            style={{ fontFamily: "var(--font-display)" }}
          >
            <span className="material-icons text-blue-500 text-[32px]">groups</span>
            Enterprise Meeting Center
          </h1>
          <p className="text-sm font-medium text-slate-400 mt-1">
            Schedule Teams meetings via Power Automate and run their transcripts through the AI pipeline.
          </p>
        </div>
        <button
          onClick={() => setShowSchedule((v) => !v)}
          className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/30 px-5 py-2.5 rounded-lg font-bold text-sm flex items-center gap-2 transition-all hover:-translate-y-0.5"
        >
          <span className="material-icons text-[18px]">{showSchedule ? "close" : "add"}</span>
          {showSchedule ? "Cancel" : "Schedule Meeting"}
        </button>
      </div>

      {/* Dashboard stat tiles */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {(
          [
            ["total", "Total", "text-white"],
            ["scheduled", "Scheduled", "text-slate-300"],
            ["processing", "Processing", "text-amber-300"],
            ["completed", "Completed", "text-emerald-300"],
            ["failed", "Failed", "text-rose-300"],
          ] as const
        ).map(([key, label, color]) => (
          <div key={key} className="bg-[#1e293b] rounded-xl border border-white/10 px-4 py-3">
            <div className={`text-2xl font-extrabold ${color}`}>{stats[key]}</div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      {showSchedule && (
        <form
          onSubmit={schedule}
          className="mb-6 bg-[#1e293b] rounded-2xl border border-white/10 p-5 grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          <label className="block text-xs font-semibold text-slate-400 md:col-span-2">
            Subject
            <input
              className="mt-1 w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
            />
          </label>
          <label className="block text-xs font-semibold text-slate-400">
            Date
            <input
              type="date"
              className="mt-1 w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </label>
          <div className="flex gap-3">
            <label className="block text-xs font-semibold text-slate-400 flex-1">
              Start
              <input
                type="time"
                className="mt-1 w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </label>
            <label className="block text-xs font-semibold text-slate-400 flex-1">
              End
              <input
                type="time"
                className="mt-1 w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </label>
          </div>
          <label className="block text-xs font-semibold text-slate-400">
            Organizer email (optional)
            <input
              className="mt-1 w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
              value={organizerEmail}
              onChange={(e) => setOrganizerEmail(e.target.value)}
              placeholder="forwarded to the flow; shown on the record"
            />
          </label>
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={scheduling}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-5 py-2 text-sm font-bold disabled:opacity-50"
            >
              {scheduling ? "Scheduling…" : "Create meeting"}
            </button>
          </div>
        </form>
      )}

      {/* Meeting grid */}
      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : meetings.length === 0 ? (
        <div className="bg-[#1e293b] rounded-2xl border border-white/10 p-10 text-center">
          <p className="text-sm text-slate-500">No meetings yet. Use "Schedule Meeting" to create one.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {meetings.map((meeting) => {
            const isRemoving = removingId === meeting.id;
            const isCancelling = cancellingId === meeting.id;
            const cancellable = isCancellable(meeting);
            return (
              <div
                key={meeting.id}
                onClick={() => setDetailId(meeting.id)}
                className={`group relative p-4 rounded-xl border cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5 bg-slate-800 border-white/5 hover:border-indigo-400/30 ${
                  isRemoving || isCancelling ? "opacity-40 pointer-events-none" : ""
                }`}
              >
                <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                  {cancellable && (
                    <button
                      type="button"
                      title="Cancel meeting"
                      onClick={(e) => {
                        e.stopPropagation();
                        void cancelMeeting(meeting.id, meeting.subject);
                      }}
                      className="text-slate-500 hover:text-amber-400 p-1 rounded-md hover:bg-amber-500/10"
                    >
                      <span className="material-icons text-[16px]">event_busy</span>
                    </button>
                  )}
                  <button
                    type="button"
                    title="Remove meeting"
                    onClick={(e) => {
                      e.stopPropagation();
                      void removeMeeting(meeting.id, meeting.subject);
                    }}
                    className="text-slate-500 hover:text-rose-400 p-1 rounded-md hover:bg-rose-500/10"
                  >
                    <span className="material-icons text-[16px]">delete_outline</span>
                  </button>
                </div>

                <div className="flex justify-between items-start mb-2 gap-2 pr-14">
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded border ${STATUS_STYLE[meeting.status]}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[meeting.status]}`} />
                    {meeting.status}
                  </span>
                </div>
                <h4 className="font-bold text-white text-sm mb-1 leading-snug line-clamp-2" title={meeting.subject}>
                  {meeting.subject}
                </h4>
                <div className="flex items-center justify-between text-xs text-slate-400 mt-3">
                  <span className="flex items-center gap-1">
                    <span className="material-icons text-[14px]">event</span>
                    {fmtDateTime(meeting.start_time ?? meeting.created_at)}
                  </span>
                  <span>{SOURCE_LABEL[meeting.source]}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail modal */}
      {detail && (
        <div
          className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto"
          onClick={() => setDetailId(null)}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-3xl my-8 bg-[#0f172a] rounded-2xl border border-white/10 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 bg-[#0f172a]/95 backdrop-blur rounded-t-2xl border-b border-white/10 px-6 py-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white mb-1" style={{ fontFamily: "var(--font-display)" }}>
                  {detail.subject}
                </h2>
                <div className="flex flex-wrap gap-4 text-xs font-medium text-slate-400">
                  <span className="flex items-center gap-1">
                    <span className="material-icons text-[14px]">event</span> {fmtDateTime(detail.start_time)}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="material-icons text-[14px]">bolt</span> {SOURCE_LABEL[detail.source]}
                  </span>
                  {detail.external_ref && (
                    <span className="flex items-center gap-1" title={detail.external_ref}>
                      <span className="material-icons text-[14px]">tag</span>
                      {detail.external_ref.slice(0, 24)}…
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-start gap-2 shrink-0">
                <span
                  className={`inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded border ${STATUS_STYLE[detail.status]}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[detail.status]}`} />
                  {detail.status}
                </span>
                <button
                  type="button"
                  onClick={() => setDetailId(null)}
                  className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-white/5"
                  title="Close"
                >
                  <span className="material-icons text-[20px]">close</span>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {detail.status === "cancelled" ? (
                <div className="rounded-lg border border-slate-500/30 bg-slate-500/10 px-4 py-3 text-sm text-slate-300 flex items-center gap-2">
                  <span className="material-icons text-[18px] text-slate-400">event_busy</span>
                  This meeting was cancelled. The Teams join link is no longer valid.
                </div>
              ) : detail.join_url ? (
                <a
                  href={detail.join_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-blue-400 hover:underline"
                >
                  <span className="material-icons text-[16px]">videocam</span> Join link
                </a>
              ) : null}

              {detail.error_message && (
                <p className="text-sm text-rose-300 bg-rose-500/10 border border-rose-400/20 rounded-lg px-3 py-2">
                  {detail.error_message}
                </p>
              )}

              {/* Ingest transcript */}
              {(detail.status === "scheduled" || detail.status === "failed") && (
                <div className="bg-[#1e293b] rounded-2xl p-6 shadow-sm border border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-white text-lg flex items-center gap-2">
                      <span className="material-icons text-rose-400">mic</span>
                      Ingest transcript (VTT)
                    </h3>
                    <label className="text-sm text-blue-400 hover:underline cursor-pointer">
                      Upload .vtt
                      <input type="file" accept=".vtt,.txt" className="hidden" onChange={onFile} />
                    </label>
                  </div>
                  <textarea
                    className="w-full h-48 bg-slate-900 border border-white/10 rounded-lg p-3 font-mono text-xs text-slate-200"
                    value={vtt}
                    onChange={(e) => setVtt(e.target.value)}
                  />
                  <button
                    onClick={ingest}
                    disabled={ingesting || !vtt.trim()}
                    className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-5 py-2 text-sm font-bold disabled:opacity-50"
                  >
                    {ingesting ? "Processing…" : "Process transcript"}
                  </button>
                </div>
              )}

              {detail.status === "processing" && (
                <div className="bg-[#1e293b] rounded-2xl p-6 shadow-sm border border-white/10 text-sm text-amber-300 flex items-center gap-2">
                  <span className="material-icons animate-spin text-[18px]">autorenew</span>
                  Running AI extraction pipeline…
                </div>
              )}

              {detail.status === "completed" && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* AI Meeting Summary */}
                    <div
                      className="relative overflow-hidden rounded-2xl p-1 shadow-xl border border-white/10"
                      style={{ background: "linear-gradient(135deg, #312E81 0%, #1E40AF 100%)" }}
                    >
                      <div className="bg-black/20 backdrop-blur-md rounded-xl p-6 relative z-10 text-white h-full">
                        <div className="flex items-center gap-3 mb-4 border-b border-white/10 pb-3">
                          <span className="material-icons text-indigo-300">auto_graph</span>
                          <h3 className="font-bold text-lg">AI Meeting Summary</h3>
                        </div>
                        <p className="text-sm text-indigo-100 leading-relaxed font-light">
                          {detail.summary || "No summary produced."}
                        </p>
                      </div>
                    </div>

                    {/* Action Items */}
                    <div className="bg-[#1e293b] rounded-2xl p-6 shadow-sm border border-white/10">
                      <div className="flex items-center gap-2 mb-4 border-b border-white/10 pb-3">
                        <span className="material-icons text-orange-400">assignment_turned_in</span>
                        <h3 className="font-bold text-white text-lg">Action Items</h3>
                      </div>
                      {detail.action_items.length ? (
                        <div className="space-y-3">
                          {detail.action_items.map((a, i) => (
                            <div
                              key={i}
                              className="flex items-start gap-3 p-3 bg-slate-800 border border-white/5 rounded-lg"
                            >
                              <span className="material-icons text-blue-400 text-[18px] mt-0.5">task_alt</span>
                              <div>
                                <div className="text-sm font-semibold text-white">{a.text}</div>
                                <div className="text-xs text-slate-400 mt-1">Assign to: {a.assignee || "—"}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500">None captured.</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-[#1e293b] rounded-2xl p-6 shadow-sm border border-white/10">
                      <h3 className="font-bold text-white text-lg mb-3 flex items-center gap-2">
                        <span className="material-icons text-emerald-400">how_to_vote</span> Decisions
                      </h3>
                      {detail.decisions.length ? (
                        <ul className="space-y-2 text-sm text-slate-300 list-disc pl-4">
                          {detail.decisions.map((d, i) => (
                            <li key={i}>{d}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-slate-500">None captured.</p>
                      )}
                    </div>

                    <div className="bg-[#1e293b] rounded-2xl p-6 shadow-sm border border-white/10">
                      <h3 className="font-bold text-white text-lg mb-3 flex items-center gap-2">
                        <span className="material-icons text-purple-400">account_tree</span> Process flow
                      </h3>
                      {detail.contains_process_flow ? (
                        <p className="text-sm text-slate-300">
                          Detected: <strong>{detail.process_name ?? "Unnamed process"}</strong> · BPMN:{" "}
                          {detail.bpmn_status ?? "n/a"}
                        </p>
                      ) : (
                        <p className="text-sm text-slate-500">No process flow described in this transcript.</p>
                      )}
                    </div>
                  </div>

                  {detail.agenda_items.length > 0 && (
                    <div className="bg-[#1e293b] rounded-2xl p-6 shadow-sm border border-white/10">
                      <h3 className="font-bold text-white text-lg mb-3">Agenda items</h3>
                      <ul className="space-y-1 text-sm text-slate-300">
                        {detail.agenda_items.map((a, i) => (
                          <li key={i}>
                            {a.project}
                            {a.department ? <span className="text-slate-500"> · {a.department}</span> : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {detail.transcript_text && (
                    <details className="bg-[#1e293b] rounded-2xl p-6 shadow-sm border border-white/10">
                      <summary className="font-bold text-white cursor-pointer">Parsed transcript</summary>
                      <pre className="mt-3 max-h-72 overflow-auto bg-slate-900 border border-white/10 rounded-lg p-3 text-[11px] whitespace-pre-wrap text-slate-300">
                        {detail.transcript_text}
                      </pre>
                    </details>
                  )}
                </>
              )}
            </div>

            <div className="sticky bottom-0 bg-[#0f172a]/95 backdrop-blur rounded-b-2xl border-t border-white/10 px-6 py-3 flex items-center justify-end gap-3">
              {isCancellable(detail) && (
                <button
                  type="button"
                  disabled={cancellingId === detail.id}
                  onClick={() => void cancelMeeting(detail.id, detail.subject)}
                  className="flex items-center gap-1 text-xs font-semibold text-amber-300 hover:text-amber-200 disabled:opacity-40 transition-colors"
                >
                  <span className="material-icons text-[15px]">event_busy</span>
                  Cancel meeting
                </button>
              )}
              <button
                type="button"
                disabled={removingId === detail.id}
                onClick={() => void removeMeeting(detail.id, detail.subject)}
                className="flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-rose-400 disabled:opacity-40 transition-colors"
              >
                <span className="material-icons text-[15px]">delete_outline</span>
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
