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
};

export function MeetingCenterPage() {
  const [meetings, setMeetings] = useState<PocMeeting[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
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

  const active = useMemo(
    () => meetings.find((m) => m.id === activeId) ?? null,
    [meetings, activeId],
  );
  const flowMode = meetings.some(
    (m) => m.source === "flow_scheduled" || m.source === "flow_ingest",
  );

  const refresh = useCallback(async () => {
    try {
      const list = await teamsPocApi.list();
      setMeetings(list);
      setActiveId((cur) => cur ?? list[0]?.id ?? null);
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
      setActiveId(created.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to schedule meeting");
    } finally {
      setScheduling(false);
    }
  }

  async function ingest() {
    if (!active) return;
    setIngesting(true);
    setError(null);
    try {
      const updated = await teamsPocApi.ingestTranscript(active.id, vtt);
      setMeetings((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to ingest transcript");
    } finally {
      setIngesting(false);
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
      <div className="flex items-center justify-between mb-8">
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

      <div
        className={`mb-6 rounded-lg border px-4 py-3 text-sm ${
          flowMode
            ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
            : "border-amber-400/30 bg-amber-500/10 text-amber-200"
        }`}
      >
        <strong>{flowMode ? "Flow mode." : "Local-stub mode."}</strong>{" "}
        {flowMode
          ? "Meetings are created in Teams by a Power Automate flow; transcripts arrive via POST /teams-poc/ingest."
          : "POWER_AUTOMATE_SCHEDULE_URL is unset — meetings get a placeholder join link. Paste or upload a .vtt below to run the pipeline manually."}
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upcoming Schedule Sidebar */}
        <div className="space-y-6">
          <div className="bg-[#1e293b] rounded-2xl shadow-sm border border-white/10 p-5">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 border-b border-white/10 pb-2 mb-4">
              Meetings ({meetings.length})
            </h3>

            {loading ? (
              <p className="text-sm text-slate-500">Loading…</p>
            ) : meetings.length === 0 ? (
              <p className="text-sm text-slate-500">No meetings yet. Use “Schedule Meeting”.</p>
            ) : (
              <div className="space-y-3">
                {meetings.map((meeting) => {
                  const isActive = activeId === meeting.id;
                  return (
                    <div
                      key={meeting.id}
                      onClick={() => setActiveId(meeting.id)}
                      className={`p-4 rounded-xl border cursor-pointer transition-all hover:shadow-md ${
                        isActive
                          ? "bg-indigo-500/20 border-indigo-400/50"
                          : "bg-slate-800 border-white/5 hover:border-indigo-400/30"
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2 gap-2">
                        <span
                          className={`text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded border ${STATUS_STYLE[meeting.status]}`}
                        >
                          {meeting.status}
                        </span>
                        <span className="text-[11px] font-bold text-slate-500">
                          {fmtDateTime(meeting.start_time ?? meeting.created_at)}
                        </span>
                      </div>
                      <h4 className="font-bold text-white text-sm mb-1 leading-snug line-clamp-2">
                        {meeting.subject}
                      </h4>
                      <p className="text-xs text-slate-400">{meeting.source}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Meeting Workspace */}
        {active && (
          <div className="lg:col-span-2 flex flex-col gap-6">
            {/* Context Header */}
            <div className="bg-[#1e293b] rounded-2xl p-6 shadow-sm border border-white/10 flex flex-col gap-4">
              <div className="flex justify-between items-start gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-1" style={{ fontFamily: "var(--font-display)" }}>
                    {active.subject}
                  </h2>
                  <div className="flex flex-wrap gap-4 text-xs font-medium text-slate-400">
                    <span className="flex items-center gap-1">
                      <span className="material-icons text-[14px]">event</span>{" "}
                      {fmtDateTime(active.start_time)}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="material-icons text-[14px]">bolt</span> {active.source}
                    </span>
                    {active.external_ref && (
                      <span className="flex items-center gap-1">
                        <span className="material-icons text-[14px]">tag</span>
                        {active.external_ref.slice(0, 24)}…
                      </span>
                    )}
                  </div>
                  {active.join_url && (
                    <a
                      href={active.join_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 mt-2 text-sm text-blue-400 hover:underline"
                    >
                      <span className="material-icons text-[16px]">videocam</span> Join link
                    </a>
                  )}
                </div>
                <span
                  className={`text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded border ${STATUS_STYLE[active.status]}`}
                >
                  {active.status}
                </span>
              </div>
              {active.error_message && (
                <p className="text-sm text-rose-300 bg-rose-500/10 border border-rose-400/20 rounded-lg px-3 py-2">
                  {active.error_message}
                </p>
              )}
            </div>

            {/* Ingest transcript */}
            {(active.status === "scheduled" || active.status === "failed") && (
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

            {active.status === "processing" && (
              <div className="bg-[#1e293b] rounded-2xl p-6 shadow-sm border border-white/10 text-sm text-amber-300 flex items-center gap-2">
                <span className="material-icons animate-spin text-[18px]">autorenew</span>
                Running AI extraction pipeline…
              </div>
            )}

            {active.status === "completed" && (
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
                        {active.summary || "No summary produced."}
                      </p>
                    </div>
                  </div>

                  {/* Action Items */}
                  <div className="bg-[#1e293b] rounded-2xl p-6 shadow-sm border border-white/10">
                    <div className="flex items-center gap-2 mb-4 border-b border-white/10 pb-3">
                      <span className="material-icons text-orange-400">assignment_turned_in</span>
                      <h3 className="font-bold text-white text-lg">Action Items</h3>
                    </div>
                    {active.action_items.length ? (
                      <div className="space-y-3">
                        {active.action_items.map((a, i) => (
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
                    {active.decisions.length ? (
                      <ul className="space-y-2 text-sm text-slate-300 list-disc pl-4">
                        {active.decisions.map((d, i) => (
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
                    {active.contains_process_flow ? (
                      <p className="text-sm text-slate-300">
                        Detected: <strong>{active.process_name ?? "Unnamed process"}</strong> · BPMN:{" "}
                        {active.bpmn_status ?? "n/a"}
                      </p>
                    ) : (
                      <p className="text-sm text-slate-500">No process flow described in this transcript.</p>
                    )}
                  </div>
                </div>

                {active.agenda_items.length > 0 && (
                  <div className="bg-[#1e293b] rounded-2xl p-6 shadow-sm border border-white/10">
                    <h3 className="font-bold text-white text-lg mb-3">Agenda items</h3>
                    <ul className="space-y-1 text-sm text-slate-300">
                      {active.agenda_items.map((a, i) => (
                        <li key={i}>
                          {a.project}
                          {a.department ? <span className="text-slate-500"> · {a.department}</span> : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {active.transcript_text && (
                  <details className="bg-[#1e293b] rounded-2xl p-6 shadow-sm border border-white/10">
                    <summary className="font-bold text-white cursor-pointer">Parsed transcript</summary>
                    <pre className="mt-3 max-h-72 overflow-auto bg-slate-900 border border-white/10 rounded-lg p-3 text-[11px] whitespace-pre-wrap text-slate-300">
                      {active.transcript_text}
                    </pre>
                  </details>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
