import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Icon } from '@ui-kit';
import { useAction, useAsync } from '../../app/providers';
import { entityByType } from '../../lib/entities';
import type { AppfwRecord } from '../../lib/appfwClient';
import { AttendeePicker } from './AttendeePicker';
import { fmtDateTime, isCancellable, sourceLabel, statusLabel, statusStyle, type MeetingRow } from './shared';

/**
 * Meeting Center — card-grid dashboard: stat tiles that double as a status
 * filter, an inline expanding schedule form, and a hover-actions card grid.
 * `Meeting` rows are read over GraphQL; "Schedule Meeting" creates a live
 * Teams meeting through the governed-write stack (`scheduleViaGraph`).
 */

const meetingEntity = entityByType('Meeting');

const STAT_TILES: { key: 'total' | 'scheduled' | 'live' | 'captured' | 'cancelled'; label: string; color: string }[] = [
  { key: 'total', label: 'Total', color: '#f8fafc' },
  { key: 'scheduled', label: 'Scheduled', color: '#cbd5e1' },
  { key: 'live', label: 'Live on Teams', color: '#34d399' },
  { key: 'captured', label: 'Transcript captured', color: '#60A5FA' },
  { key: 'cancelled', label: 'Cancelled', color: '#94A3B8' }
];

function bucketOf(status: string | undefined): 'scheduled' | 'live' | 'captured' | 'cancelled' | null {
  switch (status) {
    case 'scheduled':
      return 'scheduled';
    case 'graph_scheduled':
      return 'live';
    case 'transcript_captured':
      return 'captured';
    case 'cancelled':
      return 'cancelled';
    default:
      return null;
  }
}

const cardBase: CSSProperties = {
  background: '#1e293b',
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.08)'
};

export function MeetingCenterScreen() {
  const navigate = useNavigate();
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [showSchedule, setShowSchedule] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const [subject, setSubject] = useState('');
  const [date, setDate] = useState(today);
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('11:00');
  const [attendees, setAttendees] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<(typeof STAT_TILES)[number]['key']>('total');

  const state = useAsync(
    (client) =>
      client.queryList(meetingEntity, {
        limit: 100,
        sort: { created_at: 'desc' },
        selection: ['id', 'subject', 'source', 'status', 'start_time', 'organizer_email', 'created_at']
      }),
    []
  );
  const meetings = (state.data?.rows ?? []) as MeetingRow[];

  const createMeeting = useAction((client, input: AppfwRecord) => client.saveRecord(meetingEntity, 'create', input));
  const scheduleOnGraph = useAction((client, meetingId: string, payload: Record<string, unknown>) =>
    client.invoke<{ ok: boolean }>('scheduleViaGraph', { meetingId, payload })
  );
  const cancelOnGraph = useAction((client, meetingId: string) => client.invoke<{ ok: boolean }>('cancelViaGraph', { meetingId, payload: {} }));
  const markFailed = useAction((client, id: string, error_message: string) =>
    client.saveRecord(meetingEntity, 'update', { id, status: 'failed', error_message })
  );

  const stats = useMemo(() => {
    const s = { total: meetings.length, scheduled: 0, live: 0, captured: 0, cancelled: 0 };
    for (const m of meetings) {
      const b = bucketOf(typeof m.status === 'string' ? m.status : undefined);
      if (b) s[b] += 1;
    }
    return s;
  }, [meetings]);

  const filtered = useMemo(
    () => (statusFilter === 'total' ? meetings : meetings.filter((m) => bucketOf(typeof m.status === 'string' ? m.status : undefined) === statusFilter)),
    [meetings, statusFilter]
  );

  // poll while any meeting is being scheduled
  useEffect(() => {
    if (!createMeeting.pending && !scheduleOnGraph.pending) return;
    pollRef.current = setTimeout(() => state.reload(), 2000);
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createMeeting.pending, scheduleOnGraph.pending]);

  async function schedule(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    const start = new Date(`${date}T${startTime}:00`);
    const end = new Date(`${date}T${endTime}:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      setFormError('Enter a valid date, start time, and end time.');
      return;
    }
    if (end <= start) {
      setFormError('End time must be after start time.');
      return;
    }
    if (start.getTime() < Date.now() - 60_000) {
      setFormError('Cannot schedule a meeting in the past.');
      return;
    }

    const created = await createMeeting.run({
      subject: subject.trim() || '(untitled)',
      source: 'manual',
      status: 'scheduled',
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      attendees
    });
    if (!created || typeof created.id !== 'string') return;

    const result = await scheduleOnGraph.run(created.id, {
      subject: subject.trim() || '(untitled)',
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      attendees
    });
    if (!result?.ok) {
      await markFailed.run(created.id, scheduleOnGraph.error?.message ?? 'Failed to schedule via Microsoft Graph');
    }

    setShowSchedule(false);
    setSubject('');
    setAttendees([]);
    await state.reload();
    navigate(`/meeting-center/${created.id}`);
  }

  async function cancelMeeting(id: string, meetingSubject: string) {
    if (!window.confirm(`Cancel "${meetingSubject}"? The Teams join link will stop working.`)) return;
    setCancellingId(id);
    try {
      await cancelOnGraph.run(id);
      await state.reload();
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <div className="animate-fade-in" style={{ padding: 24, minHeight: '100%', background: '#0f172a', color: '#f8fafc' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', gap: 12, letterSpacing: '-0.02em' }}>
            <Icon name="groups" size={30} style={{ color: '#60A5FA' }} />
            Enterprise Meeting Center
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: '#94A3B8' }}>
            Schedule Microsoft Teams meetings and run their transcripts through the AI pipeline.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowSchedule((v) => !v)}
          style={{
            background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
            color: 'white',
            boxShadow: '0 8px 24px rgba(79,70,229,0.35)',
            padding: '10px 20px',
            borderRadius: 10,
            fontWeight: 700,
            fontSize: 14,
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}
        >
          <Icon name={showSchedule ? 'close' : 'add'} size={18} /> {showSchedule ? 'Cancel' : 'Schedule Meeting'}
        </button>
      </div>

      {/* Stat tiles — click to filter */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
        {STAT_TILES.map((t) => {
          const active = statusFilter === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setStatusFilter((cur) => (cur === t.key ? 'total' : t.key))}
              style={{
                textAlign: 'left',
                ...cardBase,
                padding: '12px 16px',
                cursor: 'pointer',
                borderColor: active ? 'rgba(129,140,248,0.6)' : 'rgba(255,255,255,0.08)',
                boxShadow: active ? '0 0 0 1px rgba(129,140,248,0.4)' : undefined
              }}
            >
              <div style={{ fontSize: 24, fontWeight: 800, color: t.color }}>{stats[t.key]}</div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748B', marginTop: 2 }}>{t.label}</div>
            </button>
          );
        })}
      </div>

      {statusFilter !== 'total' && (
        <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, color: '#94A3B8' }}>
          Filtering by <span style={{ color: 'white' }}>{STAT_TILES.find((t) => t.key === statusFilter)?.label}</span>
          <button type="button" onClick={() => setStatusFilter('total')} style={{ color: '#60A5FA', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
            Clear filter
          </button>
        </div>
      )}

      {(() => {
        const loadError = state.status === 'error' ? state.error?.message : undefined;
        const message = loadError ?? scheduleOnGraph.error?.message ?? cancelOnGraph.error?.message;
        if (!message) return null;
        return (
          <div style={{ marginBottom: 20, borderRadius: 10, border: '1px solid rgba(244,63,94,0.3)', background: 'rgba(244,63,94,0.1)', padding: '12px 16px', fontSize: 13, color: '#FCA5A5' }}>
            {message}
          </div>
        );
      })()}

      {showSchedule && (
        <form onSubmit={schedule} style={{ marginBottom: 20, ...cardBase, padding: 20, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          <label style={{ gridColumn: '1 / -1', display: 'block', fontSize: 11, fontWeight: 700, color: '#94A3B8' }}>
            Subject
            <input style={inputStyle} value={subject} onChange={(e) => setSubject(e.target.value)} required placeholder="e.g. EAC Architecture Review" />
          </label>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#94A3B8' }}>
            Date
            <input type="date" min={today} style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} required />
          </label>
          <div style={{ display: 'flex', gap: 12 }}>
            <label style={{ flex: 1, fontSize: 11, fontWeight: 700, color: '#94A3B8' }}>
              Start
              <input type="time" style={inputStyle} value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
            </label>
            <label style={{ flex: 1, fontSize: 11, fontWeight: 700, color: '#94A3B8' }}>
              End
              <input type="time" style={inputStyle} value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
            </label>
          </div>
          <div style={{ gridColumn: '1 / -1', fontSize: 11, fontWeight: 700, color: '#94A3B8' }}>
            Attendees (optional)
            <AttendeePicker value={attendees} onChange={setAttendees} />
            {attendees.length > 0 && (
              <span style={{ display: 'block', marginTop: 4, fontSize: 11, color: '#64748B' }}>{attendees.length} attendee(s) will get a Teams invite email.</span>
            )}
          </div>

          {formError && (
            <div style={{ gridColumn: '1 / -1', borderRadius: 8, border: '1px solid rgba(244,63,94,0.3)', background: 'rgba(244,63,94,0.1)', padding: '8px 12px', fontSize: 12, color: '#FCA5A5' }}>
              {formError}
            </div>
          )}

          <p style={{ gridColumn: '1 / -1', margin: 0, fontSize: 11, color: '#64748B' }}>
            Organized by the governance service mailbox. Invitations are sent from that account.
          </p>

          <div style={{ gridColumn: '1 / -1' }}>
            <button
              type="submit"
              disabled={createMeeting.pending || scheduleOnGraph.pending}
              style={{
                background: 'linear-gradient(135deg,#4F46E5,#7C3AED)',
                color: 'white',
                border: 'none',
                borderRadius: 10,
                padding: '10px 24px',
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
                opacity: createMeeting.pending || scheduleOnGraph.pending ? 0.6 : 1
              }}
            >
              {createMeeting.pending || scheduleOnGraph.pending ? 'Scheduling…' : 'Create meeting'}
            </button>
          </div>
        </form>
      )}

      {/* Meeting grid */}
      {state.status !== 'ready' ? (
        <p style={{ color: '#64748B', fontSize: 14 }}>Loading…</p>
      ) : meetings.length === 0 ? (
        <div style={{ ...cardBase, padding: 48, textAlign: 'center', color: '#64748B' }}>No meetings yet. Use "Schedule Meeting" to create one.</div>
      ) : filtered.length === 0 ? (
        <div style={{ ...cardBase, padding: 48, textAlign: 'center', color: '#64748B' }}>
          No {STAT_TILES.find((t) => t.key === statusFilter)?.label.toLowerCase()} meetings.{' '}
          <button type="button" onClick={() => setStatusFilter('total')} style={{ color: '#60A5FA', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
            Show all
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
          {filtered.map((m) => {
            const status = typeof m.status === 'string' ? m.status : 'scheduled';
            const style = statusStyle(status);
            const cancellable = isCancellable(m);
            const isCancelling = cancellingId === m.id;
            return (
              <div
                key={m.id}
                onClick={() => navigate(`/meeting-center/${m.id}`)}
                style={{
                  position: 'relative',
                  ...cardBase,
                  padding: 16,
                  cursor: 'pointer',
                  transition: 'transform 0.15s, box-shadow 0.15s',
                  opacity: isCancelling ? 0.5 : 1,
                  pointerEvents: isCancelling ? 'none' : 'auto'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(129,140,248,0.3)')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
              >
                {cancellable && (
                  <button
                    type="button"
                    title="Cancel meeting"
                    onClick={(e) => {
                      e.stopPropagation();
                      void cancelMeeting(m.id, String(m.subject ?? 'this meeting'));
                    }}
                    style={{
                      position: 'absolute',
                      top: 10,
                      right: 10,
                      background: 'transparent',
                      border: 'none',
                      color: '#64748B',
                      cursor: 'pointer',
                      padding: 4,
                      borderRadius: 6,
                      display: 'flex'
                    }}
                  >
                    <Icon name="event_busy" size={16} />
                  </button>
                )}

                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 10,
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    padding: '3px 8px',
                    borderRadius: 5,
                    background: style.bg,
                    color: style.color,
                    border: `1px solid ${style.border}`
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: style.color }} />
                  {statusLabel(status)}
                </span>
                <h4 style={{ margin: '8px 0 0', fontSize: 14, fontWeight: 700, color: 'white', lineHeight: 1.4 }} title={String(m.subject ?? '')}>
                  {String(m.subject ?? 'Untitled meeting')}
                </h4>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: '#94A3B8', marginTop: 12 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Icon name="event" size={14} />
                    {fmtDateTime((m.start_time as string | undefined) ?? (m.created_at as string | undefined))}
                  </span>
                  <span>{sourceLabel(m.source as string | undefined)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const inputStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  marginTop: 6,
  background: '#0f172a',
  border: '1px solid rgba(255,255,255,0.1)',
  color: 'white',
  borderRadius: 8,
  padding: '9px 12px',
  fontSize: 13,
  outline: 'none'
};
