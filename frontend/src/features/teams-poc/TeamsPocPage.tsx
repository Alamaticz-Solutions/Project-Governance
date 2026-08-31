import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
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

00:00:24.500 --> 00:00:30.000
<v Priya Nair>The process is: request comes in, BTA scopes it, EAC reviews architecture, then Security gates it, then PIC funds it.</v>
`;

function StatusBadge({ status }: { status: PocMeeting["status"] }) {
  const map: Record<PocMeeting["status"], string> = {
    scheduled: "bg-slate-100 text-slate-600",
    processing: "bg-amber-100 text-amber-700",
    completed: "bg-emerald-100 text-emerald-700",
    failed: "bg-red-100 text-red-700",
  };
  return (
    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${map[status]}`}>
      {status}
    </span>
  );
}

export function TeamsPocPage() {
  const [meetings, setMeetings] = useState<PocMeeting[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // schedule form
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

  const [subResult, setSubResult] = useState<string | null>(null);

  const active = useMemo(() => meetings.find((m) => m.id === activeId) ?? null, [meetings, activeId]);
  const graphMode = meetings.some((m) => m.source === "graph_scheduled" || m.source === "teams_auto");

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
    refresh();
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [refresh]);

  // poll while any meeting is processing
  useEffect(() => {
    const anyProcessing = meetings.some((m) => m.status === "processing");
    if (!anyProcessing) return;
    pollRef.current = setTimeout(() => {
      void refresh();
    }, 2500);
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

  async function renewSubscription() {
    setSubResult(null);
    try {
      await teamsPocApi.renewSubscription();
      setSubResult("Subscription created / renewed. Graph will POST transcript notifications to GRAPH_NOTIFICATION_URL.");
    } catch (err) {
      setSubResult(err instanceof ApiError ? err.message : "Failed to renew subscription");
    }
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2" style={{ fontFamily: "var(--font-display)" }}>
            <span className="material-icons text-blue-600">smart_toy</span>
            Teams Meeting + VTT — POC
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Schedule a Teams meeting, then run a transcript end-to-end through the AI extraction pipeline.
          </p>
        </div>
        <button
          onClick={renewSubscription}
          className="px-3 py-2 rounded-lg text-sm font-medium bg-slate-100 hover:bg-slate-200 flex items-center gap-1.5"
        >
          <span className="material-icons text-[16px]">sync</span>
          Renew Graph subscription
        </button>
      </div>

      <div
        className={`mb-6 rounded-lg border px-4 py-3 text-sm ${
          graphMode
            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : "border-amber-200 bg-amber-50 text-amber-800"
        }`}
      >
        <strong>{graphMode ? "Graph mode" : "Local-stub mode"}.</strong>{" "}
        {graphMode
          ? "Meetings are created in Teams via Microsoft Graph; transcripts can auto-ingest via change notifications."
          : "GRAPH_* env vars are unset — meetings get a placeholder join link. Paste or upload a .vtt below to run the full pipeline manually (this is also exactly what a Power Automate flow would POST)."}
      </div>

      {subResult && (
        <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          {subResult}
        </div>
      )}
      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: schedule + list */}
        <div className="space-y-6">
          <form onSubmit={schedule} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 border-b border-gray-100 pb-2">
              Schedule a meeting
            </h3>
            <label className="block text-xs font-semibold text-slate-500">
              Subject
              <input
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
              />
            </label>
            <label className="block text-xs font-semibold text-slate-500">
              Date
              <input
                type="date"
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </label>
            <div className="flex gap-3">
              <label className="block text-xs font-semibold text-slate-500 flex-1">
                Start
                <input
                  type="time"
                  className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </label>
              <label className="block text-xs font-semibold text-slate-500 flex-1">
                End
                <input
                  type="time"
                  className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </label>
            </div>
            <label className="block text-xs font-semibold text-slate-500">
              Organizer email (optional)
              <input
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                value={organizerEmail}
                onChange={(e) => setOrganizerEmail(e.target.value)}
                placeholder="defaults to GRAPH_DEFAULT_ORGANIZER_EMAIL"
              />
            </label>
            <button
              type="submit"
              disabled={scheduling}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2 text-sm font-semibold disabled:opacity-50"
            >
              {scheduling ? "Scheduling…" : "Schedule meeting"}
            </button>
          </form>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 border-b border-gray-100 pb-2 mb-3">
              Meetings ({meetings.length})
            </h3>
            {loading ? (
              <p className="text-sm text-slate-400">Loading…</p>
            ) : meetings.length === 0 ? (
              <p className="text-sm text-slate-400">No meetings yet.</p>
            ) : (
              <ul className="space-y-2">
                {meetings.map((m) => (
                  <li key={m.id}>
                    <button
                      onClick={() => setActiveId(m.id)}
                      className={`w-full text-left p-3 rounded-xl border transition ${
                        activeId === m.id ? "border-indigo-300 bg-indigo-50" : "border-gray-100 hover:border-indigo-100"
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-sm font-semibold text-slate-800 line-clamp-2">{m.subject}</span>
                        <StatusBadge status={m.status} />
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">
                        {m.source} · {new Date(m.created_at).toLocaleString()}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Right: detail */}
        <div className="lg:col-span-2 space-y-6">
          {!active ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center text-slate-400 text-sm">
              Schedule or select a meeting to begin.
            </div>
          ) : (
            <>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">{active.subject}</h2>
                    <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-3">
                      <span>{active.source}</span>
                      {active.start_time && <span>{new Date(active.start_time).toLocaleString()}</span>}
                      {active.graph_online_meeting_id && <span>Graph id: {active.graph_online_meeting_id.slice(0, 20)}…</span>}
                    </div>
                    {active.join_url && (
                      <a
                        href={active.join_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 mt-2 text-sm text-blue-600 hover:underline"
                      >
                        <span className="material-icons text-[16px]">videocam</span>
                        Join link
                      </a>
                    )}
                  </div>
                  <StatusBadge status={active.status} />
                </div>
                {active.error_message && (
                  <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                    {active.error_message}
                  </p>
                )}
              </div>

              {(active.status === "scheduled" || active.status === "failed") && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-slate-800">Ingest transcript (VTT)</h3>
                    <label className="text-sm text-blue-600 hover:underline cursor-pointer">
                      Upload .vtt
                      <input type="file" accept=".vtt,.txt" className="hidden" onChange={onFile} />
                    </label>
                  </div>
                  <textarea
                    className="w-full h-56 border border-slate-200 rounded-lg p-3 font-mono text-xs"
                    value={vtt}
                    onChange={(e) => setVtt(e.target.value)}
                  />
                  <button
                    onClick={ingest}
                    disabled={ingesting || !vtt.trim()}
                    className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-5 py-2 text-sm font-semibold disabled:opacity-50"
                  >
                    {ingesting ? "Processing…" : "Process transcript"}
                  </button>
                </div>
              )}

              {active.status === "processing" && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-sm text-amber-700 flex items-center gap-2">
                  <span className="material-icons animate-spin text-[18px]">autorenew</span>
                  Running AI extraction pipeline…
                </div>
              )}

              {active.status === "completed" && (
                <div className="space-y-6">
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <h3 className="font-bold text-slate-800 mb-2">AI Summary</h3>
                    <p className="text-sm text-slate-600 leading-relaxed">{active.summary}</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                      <h3 className="font-bold text-slate-800 mb-3">Decisions</h3>
                      {active.decisions.length ? (
                        <ul className="space-y-2 text-sm text-slate-600 list-disc pl-4">
                          {active.decisions.map((d, i) => (
                            <li key={i}>{d}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-slate-400">None captured.</p>
                      )}
                    </div>
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                      <h3 className="font-bold text-slate-800 mb-3">Action items</h3>
                      {active.action_items.length ? (
                        <ul className="space-y-2 text-sm text-slate-600">
                          {active.action_items.map((a, i) => (
                            <li key={i} className="flex gap-2">
                              <span className="material-icons text-[16px] text-orange-500">task_alt</span>
                              <span>
                                {a.text}
                                <span className="text-slate-400"> — {a.assignee}</span>
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-slate-400">None captured.</p>
                      )}
                    </div>
                  </div>

                  {active.agenda_items.length > 0 && (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                      <h3 className="font-bold text-slate-800 mb-3">Agenda items</h3>
                      <ul className="space-y-1 text-sm text-slate-600">
                        {active.agenda_items.map((a, i) => (
                          <li key={i}>
                            {a.project}
                            {a.department ? <span className="text-slate-400"> · {a.department}</span> : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <h3 className="font-bold text-slate-800 mb-2">Process flow</h3>
                    {active.contains_process_flow ? (
                      <>
                        <p className="text-sm text-slate-600">
                          Detected: <strong>{active.process_name ?? "Unnamed process"}</strong> · BPMN:{" "}
                          {active.bpmn_status ?? "n/a"}
                        </p>
                        {active.bpmn_xml && (
                          <details className="mt-2">
                            <summary className="text-sm text-blue-600 cursor-pointer">View BPMN XML</summary>
                            <pre className="mt-2 max-h-64 overflow-auto bg-slate-50 border border-slate-100 rounded-lg p-3 text-[11px]">
                              {active.bpmn_xml}
                            </pre>
                          </details>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-slate-400">No process flow described in this transcript.</p>
                    )}
                  </div>

                  {active.transcript_text && (
                    <details className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                      <summary className="font-bold text-slate-800 cursor-pointer">Parsed transcript</summary>
                      <pre className="mt-3 max-h-72 overflow-auto bg-slate-50 border border-slate-100 rounded-lg p-3 text-[11px] whitespace-pre-wrap">
                        {active.transcript_text}
                      </pre>
                    </details>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
