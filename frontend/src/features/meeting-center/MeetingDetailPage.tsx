import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { useNavigate, useParams } from "react-router";
import { ApiError } from "../../lib/apiClient";
import { teamsPocApi, type PocMeeting } from "../../lib/teamsPocApi";
import { fmtDateTime, friendlyMeetingCode, isCancellable, SOURCE_LABEL, STATUS_DOT, STATUS_STYLE } from "./shared";

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

export function MeetingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [meeting, setMeeting] = useState<PocMeeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [vtt, setVtt] = useState(SAMPLE_VTT);
  const [ingesting, setIngesting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [removing, setRemoving] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const m = await teamsPocApi.get(id);
      setMeeting(m);
      setError(null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        setNotFound(true);
      } else {
        setError(e instanceof ApiError ? e.message : "Failed to load meeting");
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [load]);

  useEffect(() => {
    if (meeting?.status !== "processing") return;
    pollRef.current = setTimeout(() => void load(), 2500);
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [meeting, load]);

  async function ingest() {
    if (!meeting) return;
    setIngesting(true);
    setError(null);
    try {
      const updated = await teamsPocApi.ingestTranscript(meeting.id, vtt);
      setMeeting(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to ingest transcript");
    } finally {
      setIngesting(false);
    }
  }

  async function cancelMeeting() {
    if (!meeting) return;
    if (!window.confirm(`Cancel "${meeting.subject}"? The Teams join link will stop working.`)) {
      return;
    }
    setCancelling(true);
    setError(null);
    try {
      const updated = await teamsPocApi.cancel(meeting.id);
      setMeeting(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to cancel meeting");
    } finally {
      setCancelling(false);
    }
  }

  async function removeMeeting() {
    if (!meeting) return;
    if (
      !window.confirm(
        `Remove "${meeting.subject}"? This deletes the meeting record and any AI results. This does not cancel the meeting in Teams.`,
      )
    ) {
      return;
    }
    setRemoving(true);
    setError(null);
    try {
      await teamsPocApi.remove(meeting.id);
      navigate("/meeting-center");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to remove meeting");
      setRemoving(false);
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

  const BackButton = (
    <button
      type="button"
      onClick={() => navigate("/meeting-center")}
      className="flex items-center gap-1 text-sm font-semibold text-slate-400 hover:text-white transition-colors mb-4"
    >
      <span className="material-icons text-[18px]">arrow_back</span>
      Back to Meeting Center
    </button>
  );

  if (loading) {
    return (
      <div className="animate-fade-in p-6 min-h-full" style={{ background: "#0f172a", color: "#f8fafc" }}>
        {BackButton}
        <p className="text-sm text-slate-500">Loading…</p>
      </div>
    );
  }

  if (notFound || !meeting) {
    return (
      <div className="animate-fade-in p-6 min-h-full" style={{ background: "#0f172a", color: "#f8fafc" }}>
        {BackButton}
        <div className="bg-[#1e293b] rounded-2xl border border-white/10 p-10 text-center">
          <p className="text-sm text-slate-500">This meeting was not found — it may have been removed.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in p-6 min-h-full" style={{ background: "#0f172a", color: "#f8fafc" }}>
      {BackButton}

      {error && (
        <div className="mb-6 rounded-lg border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      {/* Header */}
      <div className="bg-[#1e293b] rounded-2xl p-6 shadow-sm border border-white/10 flex flex-col gap-4 mb-6">
        <div className="flex justify-between items-start gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1" style={{ fontFamily: "var(--font-display)" }}>
              {meeting.subject}
            </h1>
            <div className="flex flex-wrap gap-4 text-xs font-medium text-slate-400">
              <span className="flex items-center gap-1">
                <span className="material-icons text-[14px]">event</span> {fmtDateTime(meeting.start_time)}
              </span>
              <span className="flex items-center gap-1">
                <span className="material-icons text-[14px]">bolt</span> {SOURCE_LABEL[meeting.source]}
              </span>
              <span
                className="flex items-center gap-1"
                title={meeting.external_ref ? `Teams/Outlook reference: ${meeting.external_ref}` : "No external reference yet"}
              >
                <span className="material-icons text-[14px]">tag</span>
                {friendlyMeetingCode(meeting.id)}
              </span>
            </div>
            {meeting.status === "cancelled" ? (
              <div className="mt-3 rounded-lg border border-slate-500/30 bg-slate-500/10 px-3 py-2 text-sm text-slate-300 flex items-center gap-2 max-w-md">
                <span className="material-icons text-[18px] text-slate-400">event_busy</span>
                This meeting was cancelled. The Teams join link is no longer valid.
              </div>
            ) : meeting.join_url ? (
              <a
                href={meeting.join_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 mt-2 text-sm text-blue-400 hover:underline"
              >
                <span className="material-icons text-[16px]">videocam</span> Join link
              </a>
            ) : null}
            {meeting.attendees.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <span className="material-icons text-[14px] text-slate-500">group</span>
                {meeting.attendees.map((email) => (
                  <span
                    key={email}
                    className="text-[11px] font-medium text-slate-300 bg-slate-800 border border-white/10 rounded-full px-2.5 py-0.5"
                  >
                    {email}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-3 shrink-0">
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded border ${STATUS_STYLE[meeting.status]}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[meeting.status]}`} />
              {meeting.status}
            </span>
            <div className="flex items-center gap-3">
              {isCancellable(meeting) && (
                <button
                  type="button"
                  disabled={cancelling}
                  onClick={() => void cancelMeeting()}
                  className="flex items-center gap-1 text-xs font-semibold text-amber-300 hover:text-amber-200 disabled:opacity-40 transition-colors"
                >
                  <span className="material-icons text-[15px]">event_busy</span>
                  Cancel meeting
                </button>
              )}
              <button
                type="button"
                disabled={removing}
                onClick={() => void removeMeeting()}
                className="flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-rose-400 disabled:opacity-40 transition-colors"
              >
                <span className="material-icons text-[15px]">delete_outline</span>
                Remove
              </button>
            </div>
          </div>
        </div>
        {meeting.error_message && (
          <p className="text-sm text-rose-300 bg-rose-500/10 border border-rose-400/20 rounded-lg px-3 py-2">
            {meeting.error_message}
          </p>
        )}
      </div>

      {/* Ingest transcript */}
      {(meeting.status === "scheduled" || meeting.status === "failed") && (
        <div className="bg-[#1e293b] rounded-2xl p-6 shadow-sm border border-white/10 space-y-3 mb-6">
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

      {meeting.status === "processing" && (
        <div className="bg-[#1e293b] rounded-2xl p-6 shadow-sm border border-white/10 text-sm text-amber-300 flex items-center gap-2 mb-6">
          <span className="material-icons animate-spin text-[18px]">autorenew</span>
          Running AI extraction pipeline…
        </div>
      )}

      {meeting.status === "completed" && (
        <div className="space-y-6">
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
                  {meeting.summary || "No summary produced."}
                </p>
              </div>
            </div>

            {/* Action Items */}
            <div className="bg-[#1e293b] rounded-2xl p-6 shadow-sm border border-white/10">
              <div className="flex items-center gap-2 mb-4 border-b border-white/10 pb-3">
                <span className="material-icons text-orange-400">assignment_turned_in</span>
                <h3 className="font-bold text-white text-lg">Action Items</h3>
              </div>
              {meeting.action_items.length ? (
                <div className="space-y-3">
                  {meeting.action_items.map((a, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 bg-slate-800 border border-white/5 rounded-lg">
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
              {meeting.decisions.length ? (
                <ul className="space-y-2 text-sm text-slate-300 list-disc pl-4">
                  {meeting.decisions.map((d, i) => (
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
              {meeting.contains_process_flow ? (
                <p className="text-sm text-slate-300">
                  Detected: <strong>{meeting.process_name ?? "Unnamed process"}</strong> · BPMN:{" "}
                  {meeting.bpmn_status ?? "n/a"}
                </p>
              ) : (
                <p className="text-sm text-slate-500">No process flow described in this transcript.</p>
              )}
            </div>
          </div>

          {meeting.agenda_items.length > 0 && (
            <div className="bg-[#1e293b] rounded-2xl p-6 shadow-sm border border-white/10">
              <h3 className="font-bold text-white text-lg mb-3">Agenda items</h3>
              <ul className="space-y-1 text-sm text-slate-300">
                {meeting.agenda_items.map((a, i) => (
                  <li key={i}>
                    {a.project}
                    {a.department ? <span className="text-slate-500"> · {a.department}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {meeting.transcript_text && (
            <details className="bg-[#1e293b] rounded-2xl p-6 shadow-sm border border-white/10">
              <summary className="font-bold text-white cursor-pointer">Parsed transcript</summary>
              <pre className="mt-3 max-h-72 overflow-auto bg-slate-900 border border-white/10 rounded-lg p-3 text-[11px] whitespace-pre-wrap text-slate-300">
                {meeting.transcript_text}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
