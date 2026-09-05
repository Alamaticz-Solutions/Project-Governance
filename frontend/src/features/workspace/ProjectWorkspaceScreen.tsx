import { useState, type CSSProperties, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { Button, Drawer, FormLayout, Icon, InlineAlert, SelectField, TextArea } from '@ui-kit';
import { useAction, useApp, useAsync } from '../../app/providers';
import { entityByType } from '../../lib/entities';
import type { AppfwClient, AppfwRecord } from '../../lib/appfwClient';
import { AsyncSection, humanizeEnum, asText, formatDate } from '../../components/ui';
import { hasAnyRole, roleKey } from '../../lib/authContext';
import { APPROVAL_DECISION, WORKFLOW_STAGE_STATUS as WSS } from '../shared/enums';

/**
 * Gate workspace. Dark glass presentation mirrors the Dev-branch project
 * workspace — header card with a current-stage badge, a tabbed body, and a
 * bottom row of decision / timeline widgets. Every transition is this branch's
 * real workflow surface (start / submit / skip / save_stage / submit_decision
 * against WorkflowStage + ProjectApproval); the Dev per-gate review forms are
 * not ported (they target a data contract this branch's backend does not
 * expose).
 */

const projectEntity = entityByType('Project');
const instanceEntity = entityByType('WorkflowInstance');
const stageEntity = entityByType('WorkflowStage');
const submissionEntity = entityByType('GateSubmission');
const approvalEntity = entityByType('ProjectApproval');

const DONE = new Set<string>([WSS.APPROVED, WSS.SKIPPED]);
const CURRENT = new Set<string>([WSS.IN_PROGRESS, WSS.PENDING_APPROVAL, WSS.CHANGES_REQUESTED]);

async function loadWorkspace(client: AppfwClient, projectId: string) {
  const project = await client.findRecord(projectEntity, projectId);
  const instances = await client
    .queryList(instanceEntity, {
      filter: { project_id: { _eq: projectId } },
      selection: ['id', 'status', 'current_stage_id', 'started_at'],
      limit: 5
    })
    .catch(() => ({ rows: [] as AppfwRecord[] }));
  const instanceId = instances.rows[0]?.id as string | undefined;
  const [stages, submissions, approvals] = await Promise.all([
    instanceId
      ? client
          .queryList(stageEntity, {
            filter: { workflow_instance_id: { _eq: instanceId } },
            sort: { sequence_order: 'asc' },
            selection: ['id', 'stage_name', 'stage_code', 'sequence_order', 'status', 'started_at', 'completed_at', 'due_date', 'notes'],
            limit: 100
          })
          .catch(() => ({ rows: [] as AppfwRecord[] }))
      : Promise.resolve({ rows: [] as AppfwRecord[] }),
    client
      .queryList(submissionEntity, {
        filter: { project_id: { _eq: projectId } },
        sort: { created_at: 'asc' },
        selection: ['id', 'stage', 'status', 'decision', 'submitted_at'],
        limit: 100
      })
      .catch(() => ({ rows: [] as AppfwRecord[] })),
    client
      .queryList(approvalEntity, {
        filter: { project_id: { _eq: projectId } },
        sort: { sequence_order: 'asc' },
        selection: ['id', 'approval_stage', 'assigned_role', 'status', 'decision', 'comments', 'approved_at'],
        limit: 100
      })
      .catch(() => ({ rows: [] as AppfwRecord[] }))
  ]);
  return {
    project,
    instance: instances.rows[0] ?? null,
    stages: stages.rows,
    submissions: submissions.rows,
    approvals: approvals.rows
  };
}

const glassCard: CSSProperties = {
  borderRadius: 16,
  background: 'rgba(30,41,59,0.5)',
  backdropFilter: 'blur(12px)',
  border: '1px solid rgba(255,255,255,0.1)'
};
const td: CSSProperties = { padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#e2e8f0', verticalAlign: 'top' };

function DarkTable({ headers, children }: { headers: string[]; children: ReactNode }) {
  return (
    <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: 'rgba(15,23,42,0.5)' }}>
            {headers.map((h) => (
              <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 700, color: '#94A3B8', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function ProjectWorkspaceScreen() {
  const { projectId = '' } = useParams();
  const { auth } = useApp();
  const state = useAsync((client) => loadWorkspace(client, projectId), [projectId]);

  const stageAction = useAction((client, verb: 'start' | 'submit' | 'skip', stageId: string, extra: string) => {
    if (verb === 'start') return client.invoke('start', { stageId });
    if (verb === 'skip') return client.invoke('skip', { stageId, reason: extra });
    return client.invoke('submit', { stageId, payload: { notes: extra } });
  });
  const saveStage = useAction((client, stage: string, notes: string) =>
    client.invoke('saveStage', { projectId, stage, payload: { notes, status: 'in_progress' } })
  );
  const decide = useAction((client, decisionValue: string, comments: string) =>
    client.invoke('submitDecision', { projectId, payload: { decision: decisionValue, comments } })
  );

  const [tab, setTab] = useState<'stages' | 'submissions' | 'approvals'>('stages');
  const [gateDrawer, setGateDrawer] = useState<string | null>(null);
  const [gateNotes, setGateNotes] = useState('');
  const [skipFor, setSkipFor] = useState<string | null>(null);
  const [skipReason, setSkipReason] = useState('');
  const [decision, setDecision] = useState('APPROVED');
  const [decisionComments, setDecisionComments] = useState('');

  const canOperate = hasAnyRole(auth, [
    'admin', 'epmo', 'project_manager', 'bta', 'finance', 'eac', 'cab', 'pic', 'trc', 'security', 'analysis_team'
  ]);

  return (
    <div className="animate-fade-in" style={{ padding: 32, minHeight: '100%', background: '#0f172a', color: '#f8fafc', position: 'relative' }}>
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', background: 'linear-gradient(to bottom right, #0f172a, #1e1b4b, #0f172a)' }} />
      <div style={{ position: 'relative', zIndex: 1, maxWidth: 1600, margin: '0 auto', display: 'grid', gap: 24 }}>
        <AsyncSection state={state} isEmpty={(data) => !data.project}>
          {(data) => {
            const project = data.project as AppfwRecord;
            const currentStageRow = data.stages.find((s) => CURRENT.has(String(s.status)));
            const currentStageLabel = currentStageRow ? asText(currentStageRow.stage_name) : asText(project.current_stage) || 'Intake';

            const primaryRole = roleKey(auth.roles[0]);
            const privileged = hasAnyRole(auth, ['admin', 'epmo']);
            const primaryRoleHasPending = data.approvals.some(
              (row) => String(row.status).toLowerCase() === 'pending' && roleKey(String(row.assigned_role ?? '')) === primaryRole
            );
            const targetApproval = data.approvals.find(
              (row) =>
                String(row.status).toLowerCase() === 'pending' &&
                (primaryRoleHasPending ? roleKey(String(row.assigned_role ?? '')) === primaryRole : privileged)
            );

            const timeline = data.stages.map((s) => {
              const status = String(s.status);
              return {
                label: asText(s.stage_name),
                state: DONE.has(status) ? 'done' : CURRENT.has(status) ? 'current' : status === WSS.REJECTED ? 'blocked' : 'upcoming',
                detail: humanizeEnum(status),
                date: s.completed_at ?? s.started_at
              } as const;
            });

            const tabs: { id: typeof tab; label: string; icon: string; count: number }[] = [
              { id: 'stages', label: 'Stages', icon: 'checklist', count: data.stages.length },
              { id: 'submissions', label: 'Gate submissions', icon: 'description', count: data.submissions.length },
              { id: 'approvals', label: 'Approval routing', icon: 'fact_check', count: data.approvals.length }
            ];

            return (
              <>
                {/* Header card */}
                <div style={{ ...glassCard, position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg,#4F46E5 0%,#7C3AED 50%,#06B6D4 100%)' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, padding: '24px 32px', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', background: 'linear-gradient(135deg,#EEF2FF,#F5F3FF)', color: '#4F46E5', padding: '4px 12px', borderRadius: 9999 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4F46E5' }} />
                          {currentStageLabel}
                        </span>
                        <span style={{ color: '#475569' }}>·</span>
                        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#94A3B8' }}>
                          {asText(project.project_number)}
                        </span>
                      </div>
                      <h1 style={{ margin: '0 0 12px', fontSize: 24, fontWeight: 800, color: 'white', lineHeight: 1.2 }}>
                        Workspace · {asText(project.project_name)}
                      </h1>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap', fontSize: 12, color: '#94A3B8' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Icon name="flag" size={14} /> {humanizeEnum(project.status)}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Icon name="account_tree" size={14} /> workflow {asText(data.instance?.status ?? 'not started')}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-end' }}>
                      <div style={{ padding: '14px 20px', borderRadius: 12, textAlign: 'center', background: 'linear-gradient(135deg, rgba(79,70,229,0.12) 0%, rgba(124,58,237,0.08) 100%)', border: '1px solid rgba(79,70,229,0.2)' }}>
                        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#818CF8', marginBottom: 6 }}>Current stage</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'linear-gradient(135deg,#4F46E5,#7C3AED)' }} />
                          <span style={{ fontSize: 13, fontWeight: 800, color: 'white' }}>{currentStageLabel}</span>
                        </div>
                      </div>
                      <Link
                        to={`/projects/${projectId}`}
                        style={{ background: 'rgba(30,41,59,0.8)', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.12)', padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}
                      >
                        Project detail
                      </Link>
                    </div>
                  </div>
                </div>

                {!canOperate && (
                  <InlineAlert tone="warning" title="Read-only" detail="Your role cannot operate gates on this project. Actions are hidden." />
                )}
                {stageAction.error && <InlineAlert tone="danger" title="Stage action failed" detail={stageAction.error.message} />}
                {decide.error && <InlineAlert tone="danger" title="Decision failed" detail={decide.error.message} />}
                {saveStage.error && <InlineAlert tone="danger" title="Save failed" detail={saveStage.error.message} />}

                {/* Tabs */}
                <div style={{ ...glassCard, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '0 8px', overflowX: 'auto' }}>
                    {tabs.map((t) => {
                      const on = tab === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setTab(t.id)}
                          style={{
                            position: 'relative',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '16px 20px',
                            fontSize: 13,
                            fontWeight: 700,
                            color: on ? 'white' : '#94A3B8',
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          <Icon name={t.icon} size={18} /> {t.label}
                          <span style={{ padding: '2px 8px', borderRadius: 9999, fontSize: 11, fontWeight: 800, background: on ? 'rgba(79,70,229,0.2)' : 'rgba(255,255,255,0.05)', color: on ? '#818CF8' : '#94A3B8' }}>
                            {t.count}
                          </span>
                          {on && <span style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, borderRadius: '3px 3px 0 0', background: 'linear-gradient(90deg,#4F46E5,#7C3AED)' }} />}
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ padding: 24 }}>
                    {tab === 'stages' &&
                      (data.stages.length === 0 ? (
                        <p style={{ color: '#64748B' }}>No workflow instance / stages for this project yet.</p>
                      ) : (
                        <DarkTable headers={['#', 'Stage', 'Status', 'Started', 'Due', 'Actions']}>
                          {data.stages.map((stage) => {
                            const status = String(stage.status);
                            const stageId = String(stage.id);
                            return (
                              <tr key={stageId}>
                                <td style={td}>{asText(stage.sequence_order)}</td>
                                <td style={td}>
                                  {asText(stage.stage_name)}
                                  <br />
                                  <small style={{ color: '#64748B' }}>{asText(stage.stage_code)}</small>
                                </td>
                                <td style={td}>{humanizeEnum(status)}</td>
                                <td style={td}>{formatDate(stage.started_at)}</td>
                                <td style={td}>{formatDate(stage.due_date)}</td>
                                <td style={td}>
                                  {canOperate && (
                                    <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                      {(status === WSS.ELIGIBLE || status === WSS.CHANGES_REQUESTED) && (
                                        <button type="button" style={miniBtn} disabled={stageAction.pending} onClick={() => stageAction.run('start', stageId, '').then(() => state.reload())}>
                                          Start
                                        </button>
                                      )}
                                      {status === WSS.IN_PROGRESS && (
                                        <>
                                          <button type="button" style={miniBtn} onClick={() => { setGateDrawer(asText(stage.stage_code)); setGateNotes(''); }}>
                                            Gate form
                                          </button>
                                          <button type="button" style={miniBtnPrimary} disabled={stageAction.pending} onClick={() => stageAction.run('submit', stageId, gateNotes).then(() => state.reload())}>
                                            Submit
                                          </button>
                                        </>
                                      )}
                                      {status !== WSS.APPROVED && status !== WSS.SKIPPED && (
                                        <button type="button" style={miniBtnGhost} onClick={() => { setSkipFor(stageId); setSkipReason(''); }}>
                                          Skip
                                        </button>
                                      )}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </DarkTable>
                      ))}

                    {tab === 'submissions' &&
                      (data.submissions.length === 0 ? (
                        <p style={{ color: '#64748B' }}>No gate submissions.</p>
                      ) : (
                        <DarkTable headers={['Stage', 'Status', 'Decision', 'Submitted']}>
                          {data.submissions.map((row) => (
                            <tr key={String(row.id)}>
                              <td style={td}>{humanizeEnum(row.stage)}</td>
                              <td style={td}>{humanizeEnum(row.status)}</td>
                              <td style={td}>{humanizeEnum(row.decision)}</td>
                              <td style={td}>{formatDate(row.submitted_at)}</td>
                            </tr>
                          ))}
                        </DarkTable>
                      ))}

                    {tab === 'approvals' &&
                      (data.approvals.length === 0 ? (
                        <p style={{ color: '#64748B' }}>No approval routing.</p>
                      ) : (
                        <DarkTable headers={['Role', 'Stage', 'Status', 'Decision', 'Comments']}>
                          {data.approvals.map((row) => {
                            const mine =
                              String(row.status).toLowerCase() === 'pending' &&
                              (privileged || primaryRole === roleKey(String(row.assigned_role ?? '')));
                            return (
                              <tr key={String(row.id)} style={mine ? { background: 'rgba(79,70,229,0.08)' } : undefined}>
                                <td style={td}>{humanizeEnum(row.assigned_role)}{mine ? ' · you' : ''}</td>
                                <td style={td}>{humanizeEnum(row.approval_stage)}</td>
                                <td style={td}>{humanizeEnum(row.status)}</td>
                                <td style={td}>{humanizeEnum(row.decision)}</td>
                                <td style={td}>{asText(row.comments)}</td>
                              </tr>
                            );
                          })}
                        </DarkTable>
                      ))}
                  </div>
                </div>

                {/* Bottom widgets */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
                  {/* Decision */}
                  <div style={{ ...glassCard, padding: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#DC2626' }} />
                      <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'white' }}>Required Decision</h3>
                      <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 9999, background: 'linear-gradient(135deg,#EEF2FF,#F5F3FF)', color: '#4F46E5' }}>
                        {currentStageLabel}
                      </span>
                    </div>
                    {canOperate ? (
                      <FormLayout
                        columns="one"
                        footer={
                          <Button
                            variant="primary"
                            isLoading={decide.pending}
                            disabled={!targetApproval}
                            onClick={() => decide.run(decision, decisionComments).then(() => state.reload())}
                          >
                            {targetApproval
                              ? `Decide as ${privileged && !primaryRoleHasPending ? 'admin/EPMO override' : (auth.roles[0] ?? 'your role').toUpperCase()}`
                              : 'No pending approval for your role'}
                          </Button>
                        }
                      >
                        <SelectField label="Decision" value={decision} onChange={(e) => setDecision(e.target.value)} options={APPROVAL_DECISION} />
                        <TextArea label="Comments" rows={2} value={decisionComments} onChange={(e) => setDecisionComments(e.target.value)} />
                      </FormLayout>
                    ) : (
                      <p style={{ color: '#94A3B8', fontSize: 13, margin: 0 }}>You do not have a role that can decide on this project.</p>
                    )}
                  </div>

                  {/* Timeline */}
                  <div style={{ ...glassCard, padding: 24 }}>
                    <h3 style={{ margin: '0 0 20px', fontSize: 14, fontWeight: 800, color: 'white' }}>Approval Timeline</h3>
                    {timeline.length === 0 ? (
                      <p style={{ color: '#64748B', fontSize: 13 }}>No stages yet.</p>
                    ) : (
                      <div style={{ position: 'relative', marginLeft: 8 }}>
                        <div style={{ position: 'absolute', top: 8, bottom: 0, left: 7, width: 2, borderRadius: 9999, background: 'linear-gradient(180deg,#4F46E5 0%,rgba(226,232,240,0.3) 100%)' }} />
                        {timeline.map((node, i) => (
                          <div key={i} style={{ position: 'relative', display: 'flex', gap: 16, marginBottom: 20, zIndex: 1 }}>
                            <span
                              style={{
                                width: 16,
                                height: 16,
                                borderRadius: '50%',
                                flexShrink: 0,
                                marginTop: 2,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background:
                                  node.state === 'done'
                                    ? 'linear-gradient(135deg,#059669,#047857)'
                                    : node.state === 'current'
                                      ? 'linear-gradient(135deg,#4F46E5,#7C3AED)'
                                      : node.state === 'blocked'
                                        ? '#DC2626'
                                        : '#1e293b',
                                border: node.state === 'upcoming' ? '2px solid rgba(100,116,139,0.5)' : 'none'
                              }}
                            >
                              {node.state === 'done' && <Icon name="check" size={10} style={{ color: 'white' }} />}
                            </span>
                            <span style={{ flex: 1 }}>
                              <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: node.state === 'upcoming' ? '#64748B' : '#f8fafc' }}>{node.label}</span>
                              <span style={{ display: 'block', fontSize: 11, fontWeight: 600, marginTop: 2, color: node.state === 'done' ? '#34D399' : node.state === 'current' ? '#818CF8' : '#94A3B8' }}>
                                {node.detail}
                              </span>
                              {node.date ? <span style={{ display: 'block', fontSize: 11, color: '#64748B', marginTop: 2 }}>{formatDate(node.date)}</span> : null}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <Drawer
                  open={gateDrawer !== null}
                  title={`Gate form · ${gateDrawer ?? ''}`}
                  description="Generic gate form. Saved to the matching GateSubmission via save_stage."
                  onClose={() => setGateDrawer(null)}
                  footer={
                    <>
                      <Button variant="quiet" onClick={() => setGateDrawer(null)}>
                        Close
                      </Button>
                      <Button
                        variant="primary"
                        isLoading={saveStage.pending}
                        onClick={async () => {
                          if (!gateDrawer) return;
                          const result = await saveStage.run(gateDrawer, gateNotes);
                          if (result !== undefined) {
                            setGateDrawer(null);
                            state.reload();
                          }
                        }}
                      >
                        Save gate form
                      </Button>
                    </>
                  }
                >
                  <FormLayout columns="one">
                    <TextArea label="Notes" rows={6} value={gateNotes} onChange={(e) => setGateNotes(e.target.value)} />
                  </FormLayout>
                </Drawer>

                <Drawer
                  open={skipFor !== null}
                  title="Skip stage"
                  description="A reason is required and recorded to the audit log."
                  onClose={() => setSkipFor(null)}
                  footer={
                    <>
                      <Button variant="quiet" onClick={() => setSkipFor(null)}>
                        Cancel
                      </Button>
                      <Button
                        variant="primary"
                        isLoading={stageAction.pending}
                        disabled={!skipReason.trim()}
                        onClick={async () => {
                          if (!skipFor) return;
                          const result = await stageAction.run('skip', skipFor, skipReason.trim());
                          if (result !== undefined) {
                            setSkipFor(null);
                            state.reload();
                          }
                        }}
                      >
                        Confirm skip
                      </Button>
                    </>
                  }
                >
                  <FormLayout columns="one">
                    <TextArea label="Skip reason" required rows={3} value={skipReason} onChange={(e) => setSkipReason(e.target.value)} />
                  </FormLayout>
                </Drawer>
              </>
            );
          }}
        </AsyncSection>
      </div>
    </div>
  );
}

const miniBtn: CSSProperties = {
  padding: '5px 12px',
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
  background: 'rgba(30,41,59,0.8)',
  color: '#e2e8f0',
  border: '1px solid rgba(255,255,255,0.12)'
};
const miniBtnPrimary: CSSProperties = { ...miniBtn, background: 'linear-gradient(135deg,#4F46E5,#7C3AED)', color: 'white', border: 'none' };
const miniBtnGhost: CSSProperties = { ...miniBtn, background: 'transparent', color: '#94A3B8' };
