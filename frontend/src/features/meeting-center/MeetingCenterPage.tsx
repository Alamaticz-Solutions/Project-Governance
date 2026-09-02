import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { ApiError } from "../../lib/apiClient";
import { teamsPocApi, type PocMeeting } from "../../lib/teamsPocApi";
import { fmtDateTime, isCancellable, parseEmailList, SOURCE_LABEL, STATUS_DOT, STATUS_STYLE } from "./shared";

export function MeetingCenterPage() {
  const navigate = useNavigate();
  const [meetings, setMeetings] = useState<PocMeeting[]>([]);
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
  const [attendeesInput, setAttendeesInput] = useState("");
  const [scheduling, setScheduling] = useState(false);

  const [removingId, setRemovingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<PocMeeting["status"] | "all">("all");

  const stats = useMemo(() => {
    const s = { total: meetings.length, scheduled: 0, processing: 0, completed: 0, failed: 0, cancelled: 0 };
    for (const m of meetings) s[m.status] += 1;
    return s;
  }, [meetings]);

  const filteredMeetings = useMemo(
    () => (statusFilter === "all" ? meetings : meetings.filter((m) => m.status === statusFilter)),
    [meetings, statusFilter],
  );

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

  // poll while any meeting is processing, so card badges stay current
  useEffect(() => {
    if (!meetings.some((m) => m.status === "processing")) return;
    pollRef.current = setTimeout(() => void refresh(), 2500);
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [meetings, refresh]);

  async function schedule(e: FormEvent) {
    e.preventDefault();

    const start = new Date(`${date}T${startTime}:00`);
    const end = new Date(`${date}T${endTime}:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      setError("Enter a valid date, start time, and end time.");
      return;
    }
    if (end <= start) {
      setError("End time must be after start time.");
      return;
    }

    setScheduling(true);
    setError(null);
    try {
      const created = await teamsPocApi.schedule({
        subject,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        organizer_email: organizerEmail || undefined,
        attendees: parseEmailList(attendeesInput),
      });
      setShowSchedule(false);
      await refresh();
      navigate(`/meeting-center/${created.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to schedule meeting");
    } finally {
      setScheduling(false);
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

      {/* Dashboard stat tiles — click to filter the grid below */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {(
          [
            ["total", "all", "Total", "text-white"],
            ["scheduled", "scheduled", "Scheduled", "text-slate-300"],
            ["processing", "processing", "Processing", "text-amber-300"],
            ["completed", "completed", "Completed", "text-emerald-300"],
            ["failed", "failed", "Failed", "text-rose-300"],
          ] as const
        ).map(([key, filterValue, label, color]) => {
          const isActive = statusFilter === filterValue;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setStatusFilter((cur) => (cur === filterValue ? "all" : filterValue))}
              className={`text-left bg-[#1e293b] rounded-xl border px-4 py-3 transition-all hover:-translate-y-0.5 hover:shadow-md ${
                isActive ? "border-indigo-400/60 ring-1 ring-indigo-400/40" : "border-white/10 hover:border-indigo-400/30"
              }`}
            >
              <div className={`text-2xl font-extrabold ${color}`}>{stats[key]}</div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mt-0.5">{label}</div>
            </button>
          );
        })}
      </div>

      {statusFilter !== "all" && (
        <div className="mb-4 flex items-center gap-2 text-xs font-semibold text-slate-400">
          Filtering by <span className="text-white capitalize">{statusFilter}</span>
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className="text-blue-400 hover:underline"
          >
            Clear filter
          </button>
        </div>
      )}

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
                required
              />
            </label>
            <label className="block text-xs font-semibold text-slate-400 flex-1">
              End
              <input
                type="time"
                className="mt-1 w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
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
          <label className="block text-xs font-semibold text-slate-400 md:col-span-2">
            Attendees (optional)
            <textarea
              className="mt-1 w-full h-16 bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
              value={attendeesInput}
              onChange={(e) => setAttendeesInput(e.target.value)}
              placeholder="comma, semicolon, or newline separated — internal or external emails both work, e.g. jane@yourcompany.com, partner@othercompany.com"
            />
            {parseEmailList(attendeesInput).length > 0 && (
              <span className="mt-1 block text-[11px] text-slate-500">
                {parseEmailList(attendeesInput).length} attendee(s) will get a Teams invite email.
              </span>
            )}
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
      ) : filteredMeetings.length === 0 ? (
        <div className="bg-[#1e293b] rounded-2xl border border-white/10 p-10 text-center">
          <p className="text-sm text-slate-500">
            No <span className="capitalize">{statusFilter}</span> meetings.{" "}
            <button type="button" onClick={() => setStatusFilter("all")} className="text-blue-400 hover:underline">
              Show all
            </button>
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredMeetings.map((meeting) => {
            const isRemoving = removingId === meeting.id;
            const isCancelling = cancellingId === meeting.id;
            const cancellable = isCancellable(meeting);
            return (
              <div
                key={meeting.id}
                onClick={() => navigate(`/meeting-center/${meeting.id}`)}
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
    </div>
  );
}
