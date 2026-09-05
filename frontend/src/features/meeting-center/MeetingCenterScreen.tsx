import { useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button, Dialog, FormLayout, Icon, InlineAlert, TextField } from '@ui-kit';
import { useAction, useAsync } from '../../app/providers';
import { entityByType } from '../../lib/entities';
import type { AppfwRecord } from '../../lib/appfwClient';
import { humanizeEnum, formatDateTime } from '../../components/ui';

/**
 * Meeting center. Dark master/detail presentation mirrors the Dev-branch
 * Enterprise Meeting Center (schedule rail + meeting workspace). Data is real:
 * Meeting rows from the App Framework client, and the "Schedule Meeting"
 * affordance creates a manual Meeting row (no Microsoft Graph call — writes
 * are still gated on this branch).
 */

const meetingEntity = entityByType('Meeting');

type Row = AppfwRecord & { id: string };

const darkCard: CSSProperties = {
  background: '#1e293b',
  borderRadius: 16,
  border: '1px solid rgba(255,255,255,0.1)'
};

export function MeetingCenterScreen() {
  const navigate = useNavigate();
  const [addOpen, setAddOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [joinUrl, setJoinUrl] = useState('');
  const [organizer, setOrganizer] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const state = useAsync(
    (client) =>
      client.queryList(meetingEntity, {
        limit: 50,
        sort: { created_at: 'desc' },
        selection: [
          'id',
          'subject',
          'source',
          'status',
          'start_time',
          'organizer_email',
          'summary',
          'bpmn_status',
          'created_at'
        ]
      }),
    []
  );

  const createMeeting = useAction((client, input: AppfwRecord) =>
    client.saveRecord(meetingEntity, 'create', input)
  );

  const rows = (state.data?.rows ?? []) as Row[];
  const selected = rows.find((r) => r.id === selectedId) ?? rows[0];

  return (
    <div className="animate-fade-in" style={{ padding: 24, minHeight: '100%', background: '#0f172a', color: '#f8fafc' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', gap: 12, letterSpacing: '-0.02em' }}>
            <Icon name="groups" size={30} style={{ color: '#60A5FA' }} />
            Enterprise Meeting Center
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: '#94A3B8' }}>
            Governance council meetings and transcript-driven process discovery.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
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
          <Icon name="add" size={18} /> Schedule Meeting
        </button>
      </div>

      <InlineAlert
        tone="neutral"
        title="Manual registration"
        detail="Scheduling / cancelling real Teams meetings is write-gated pending the governed-write stack. Register a meeting here and attach a VTT on its detail screen."
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 2fr)', gap: 24, marginTop: 16, alignItems: 'start' }}>
        {/* Schedule rail */}
        <div style={{ ...darkCard, padding: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#64748B', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 8 }}>
            Schedule
          </h3>
          {state.status !== 'ready' ? (
            <p style={{ color: '#94A3B8', fontSize: 14 }}>Loading meetings…</p>
          ) : rows.length === 0 ? (
            <p style={{ color: '#64748B', fontSize: 14 }}>No meetings registered yet.</p>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {rows.map((m) => {
                const active = selected?.id === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedId(m.id)}
                    style={{
                      textAlign: 'left',
                      padding: 16,
                      borderRadius: 12,
                      cursor: 'pointer',
                      background: active ? 'rgba(79,70,229,0.2)' : '#0f172a',
                      border: `1px solid ${active ? 'rgba(129,140,248,0.5)' : 'rgba(255,255,255,0.06)'}`
                    }}
                  >
                    <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                      <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#A5B4FC', background: 'rgba(79,70,229,0.2)', border: '1px solid rgba(79,70,229,0.3)', padding: '2px 6px', borderRadius: 4 }}>
                        {m.source ? humanizeEnum(m.source) : 'Meeting'}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#64748B' }}>{humanizeEnum(m.status)}</span>
                    </span>
                    <span style={{ display: 'block', fontWeight: 700, color: 'white', fontSize: 14 }}>{String(m.subject ?? 'Untitled meeting')}</span>
                    <span style={{ display: 'block', fontSize: 12, color: '#94A3B8', marginTop: 2 }}>
                      {m.start_time ? formatDateTime(m.start_time) : formatDateTime(m.created_at)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Workspace */}
        {selected ? (
          <div style={{ display: 'grid', gap: 24 }}>
            <div style={{ ...darkCard, padding: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                <div>
                  <h2 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 700, color: 'white' }}>{String(selected.subject ?? 'Untitled meeting')}</h2>
                  <div style={{ display: 'flex', gap: 16, fontSize: 12, fontWeight: 500, color: '#94A3B8', flexWrap: 'wrap' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Icon name="event" size={14} /> {selected.start_time ? formatDateTime(selected.start_time) : '—'}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Icon name="person" size={14} /> {String(selected.organizer_email ?? '—')}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Icon name="insights" size={14} /> AI status: {selected.bpmn_status ? humanizeEnum(selected.bpmn_status) : 'none'}
                    </span>
                  </div>
                </div>
                <Link
                  to={`/meeting-center/${selected.id}`}
                  style={{
                    background: 'rgba(30,41,59,0.7)',
                    color: '#e2e8f0',
                    border: '1px solid rgba(255,255,255,0.1)',
                    padding: '8px 16px',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 700,
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  <Icon name="open_in_new" size={16} /> Open detail
                </Link>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 24 }}>
              <div
                style={{
                  borderRadius: 16,
                  padding: 1,
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'linear-gradient(135deg, #312E81 0%, #1E40AF 100%)'
                }}
              >
                <div style={{ background: 'rgba(0,0,0,0.2)', backdropFilter: 'blur(8px)', borderRadius: 15, padding: 24, color: 'white', height: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 12 }}>
                    <Icon name="auto_graph" size={20} style={{ color: '#A5B4FC' }} />
                    <h3 style={{ margin: 0, fontWeight: 700, fontSize: 16 }}>AI Summary &amp; Notes</h3>
                  </div>
                  {selected.summary ? (
                    <p style={{ fontSize: 14, color: '#E0E7FF', lineHeight: 1.6, margin: 0 }}>{String(selected.summary)}</p>
                  ) : (
                    <p style={{ fontSize: 14, color: '#C7D2FE', margin: 0 }}>
                      No summary yet. Attach a transcript on the detail screen to generate one.
                    </p>
                  )}
                </div>
              </div>

              <div style={{ ...darkCard, padding: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 12 }}>
                  <Icon name="assignment_turned_in" size={20} style={{ color: '#FB923C' }} />
                  <h3 style={{ margin: 0, fontWeight: 700, color: 'white', fontSize: 16 }}>Action Items</h3>
                </div>
                <p style={{ fontSize: 14, color: '#94A3B8', margin: 0 }}>
                  Action items are extracted with the transcript. Open the detail screen to run processing.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ ...darkCard, padding: 48, textAlign: 'center', color: '#64748B' }}>
            Select a meeting from the schedule, or register one to begin.
          </div>
        )}
      </div>

      <Dialog
        open={addOpen}
        title="Register meeting"
        description="Creates a Meeting row you can attach a transcript to. No Microsoft Graph call is made."
        onClose={() => setAddOpen(false)}
        closeLabel="Close register dialog"
        footer={
          <>
            <Button variant="quiet" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              isLoading={createMeeting.pending}
              disabled={!subject.trim()}
              onClick={async () => {
                const created = await createMeeting.run({
                  subject: subject.trim(),
                  source: 'manual',
                  status: 'scheduled',
                  join_url: joinUrl.trim() || null,
                  organizer_email: organizer.trim() || null
                });
                if (created && typeof created.id === 'string') {
                  setAddOpen(false);
                  setSubject('');
                  setJoinUrl('');
                  setOrganizer('');
                  navigate(`/meeting-center/${created.id}`);
                }
              }}
            >
              Register
            </Button>
          </>
        }
      >
        {createMeeting.error && (
          <InlineAlert tone="danger" title="Create failed" detail={createMeeting.error.message} />
        )}
        <FormLayout columns="one">
          <TextField label="Subject" required value={subject} onChange={(e) => setSubject(e.target.value)} />
          <TextField label="Join URL" value={joinUrl} onChange={(e) => setJoinUrl(e.target.value)} />
          <TextField label="Organizer email" type="email" value={organizer} onChange={(e) => setOrganizer(e.target.value)} />
        </FormLayout>
      </Dialog>
    </div>
  );
}
