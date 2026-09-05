import { useState, type CSSProperties } from 'react';
import { Link, useParams } from 'react-router';
import { Button, Icon, InlineAlert } from '@ui-kit';
import { useAction, useAsync } from '../../app/providers';
import { entityByType } from '../../lib/entities';
import type { AppfwRecord } from '../../lib/appfwClient';
import { AsyncSection, asText, humanizeEnum, formatDateTime } from '../../components/ui';

/**
 * Meeting detail. Dark card presentation mirrors the Dev-branch meeting
 * workspace (AI summary / action items / details). Functionality is this
 * branch's: fetch the Meeting row, run `processTranscript` against a governed
 * Graph transcript or a pasted VTT, and show whatever content came back.
 */

const meetingEntity = entityByType('Meeting');

const darkCard: CSSProperties = {
  background: '#1e293b',
  borderRadius: 16,
  border: '1px solid rgba(255,255,255,0.1)',
  overflow: 'hidden'
};
const cardHeader: CSSProperties = {
  padding: '16px 20px',
  borderBottom: '1px solid rgba(255,255,255,0.1)',
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  background: 'rgba(255,255,255,0.04)'
};

export function MeetingDetailScreen() {
  const { meetingId = '' } = useParams();
  const [vtt, setVtt] = useState('');
  const state = useAsync((client) => client.findRecord(meetingEntity, meetingId), [meetingId]);
  const process = useAction((client, pastedVtt: string) =>
    client.invoke('processTranscript', {
      meetingId,
      payload: pastedVtt.trim() ? { vtt: pastedVtt } : {}
    })
  );

  return (
    <div className="animate-fade-in" style={{ padding: 24, minHeight: '100%', background: '#0f172a', color: '#f8fafc' }}>
      <AsyncSection state={state} isEmpty={(record) => !record}>
        {(record) => {
          const meeting = record as AppfwRecord;
          const decisions = Array.isArray(meeting.decisions) ? (meeting.decisions as unknown[]) : [];
          return (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#818CF8' }}>Meeting</span>
                  <h1 style={{ margin: '4px 0 6px', fontSize: 26, fontWeight: 700, color: 'white' }}>{asText(meeting.subject)}</h1>
                  <span style={{ fontSize: 13, color: '#94A3B8' }}>
                    {humanizeEnum(meeting.status)} · source {asText(meeting.source)}
                  </span>
                </div>
                <Link
                  to="/meeting-center"
                  style={{
                    background: 'rgba(30,41,59,0.7)',
                    color: '#e2e8f0',
                    border: '1px solid rgba(255,255,255,0.1)',
                    padding: '8px 16px',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 700,
                    textDecoration: 'none'
                  }}
                >
                  Back to list
                </Link>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24, alignItems: 'start' }}>
                {/* Details */}
                <div style={darkCard}>
                  <div style={cardHeader}>
                    <Icon name="info" size={20} style={{ color: '#60A5FA' }} />
                    <h3 style={{ margin: 0, fontWeight: 700, color: 'white', fontSize: 16 }}>Details</h3>
                  </div>
                  <dl style={{ margin: 0, padding: 20, display: 'grid', gap: 12 }}>
                    {[
                      ['Organizer', asText(meeting.organizer_email)],
                      ['Start', formatDateTime(meeting.start_time)],
                      ['End', formatDateTime(meeting.end_time)],
                      ['Join URL', asText(meeting.join_url)],
                      ['Graph meeting id', asText(meeting.graph_online_meeting_id)],
                      ['Transcript id', asText(meeting.graph_transcript_id)],
                      ['AI / BPMN status', asText(meeting.bpmn_status)]
                    ].map(([k, v]) => (
                      <div key={k} style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 12 }}>
                        <dt style={{ fontSize: 12, color: '#64748B' }}>{k}</dt>
                        <dd style={{ margin: 0, fontSize: 13, color: '#e2e8f0', wordBreak: 'break-word' }}>{v}</dd>
                      </div>
                    ))}
                  </dl>
                </div>

                {/* Process transcript */}
                <div style={darkCard}>
                  <div style={cardHeader}>
                    <Icon name="graphic_eq" size={20} style={{ color: '#F472B6' }} />
                    <h3 style={{ margin: 0, fontWeight: 700, color: 'white', fontSize: 16 }}>Process transcript</h3>
                  </div>
                  <div style={{ padding: 20 }}>
                    {process.error && (
                      <InlineAlert
                        tone={process.error.details.category === 'policy_denied' ? 'warning' : 'danger'}
                        title="process_transcript failed"
                        detail={process.error.message}
                      />
                    )}
                    <label style={{ display: 'block', fontSize: 12, color: '#94A3B8', marginBottom: 6 }}>
                      Paste VTT (optional) — leave blank to fetch from Microsoft Graph
                    </label>
                    <textarea
                      rows={8}
                      value={vtt}
                      onChange={(e) => setVtt(e.target.value)}
                      style={{
                        width: '100%',
                        background: '#0f172a',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 8,
                        color: '#e2e8f0',
                        fontSize: 12,
                        padding: 12,
                        resize: 'vertical'
                      }}
                    />
                    <div style={{ marginTop: 12, textAlign: 'right' }}>
                      <Button
                        variant="primary"
                        isLoading={process.pending}
                        onClick={() => process.run(vtt).then(() => state.reload())}
                      >
                        Run process_transcript
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Captured content */}
              {(meeting.summary || meeting.transcript_text || decisions.length > 0) && (
                <div style={{ ...darkCard, marginTop: 24 }}>
                  <div style={cardHeader}>
                    <Icon name="auto_awesome" size={20} style={{ color: '#A5B4FC' }} />
                    <h3 style={{ margin: 0, fontWeight: 700, color: 'white', fontSize: 16 }}>AI Summary &amp; Notes</h3>
                  </div>
                  <div style={{ padding: 20 }}>
                    {meeting.summary ? (
                      <p style={{ fontSize: 14, color: '#cbd5e1', lineHeight: 1.6, marginTop: 0 }}>{asText(meeting.summary)}</p>
                    ) : null}
                    {decisions.length > 0 && (
                      <>
                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#64748B', margin: '8px 0' }}>
                          Key decisions
                        </div>
                        <ul style={{ display: 'grid', gap: 8, padding: 0, listStyle: 'none', margin: 0 }}>
                          {decisions.map((d, i) => (
                            <li
                              key={i}
                              style={{
                                display: 'flex',
                                gap: 8,
                                fontSize: 14,
                                color: '#d1fae5',
                                background: 'rgba(16,185,129,0.1)',
                                border: '1px solid rgba(16,185,129,0.2)',
                                borderRadius: 10,
                                padding: 10
                              }}
                            >
                              <Icon name="check_circle" size={18} style={{ color: '#34d399', flexShrink: 0 }} />
                              {asText(d)}
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                    {meeting.transcript_text ? (
                      <pre
                        style={{
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          maxHeight: 320,
                          overflow: 'auto',
                          padding: 12,
                          marginTop: 12,
                          background: '#0f172a',
                          borderRadius: 8,
                          fontSize: 12,
                          color: '#94A3B8'
                        }}
                      >
                        {asText(meeting.transcript_text)}
                      </pre>
                    ) : null}
                  </div>
                </div>
              )}
            </>
          );
        }}
      </AsyncSection>
    </div>
  );
}
