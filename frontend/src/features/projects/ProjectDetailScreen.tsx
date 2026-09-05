import { useState, type CSSProperties, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Button, Dialog, FormLayout, Icon, InlineAlert, TextArea } from '@ui-kit';
import { useAction, useApp, useAsync } from '../../app/providers';
import { entityByType } from '../../lib/entities';
import type { AppfwClient, AppfwRecord } from '../../lib/appfwClient';
import { AsyncSection, canonicalEnumKey, humanizeEnum, formatDate, formatDateTime, asText } from '../../components/ui';
import { hasAnyRole } from '../../lib/authContext';

/**
 * Project record. Dark "read-only dossier" presentation mirrors the Dev-branch
 * project detail — header card, stage-gate pipeline ribbon, tabbed body. Tab
 * content is this branch's relational data (approvals / gate submissions /
 * risks / stakeholders) rather than Dev's form-payload dump, and the workflow
 * actions (cancel / fast-track) are retained.
 */

const projectEntity = entityByType('Project');
const stakeholderEntity = entityByType('ProjectStakeholder');
const approvalEntity = entityByType('ProjectApproval');
const gateSubmissionEntity = entityByType('GateSubmission');
const riskEntity = entityByType('RiskItem');

async function loadProject(client: AppfwClient, id: string) {
  const [project, stakeholders, approvals, submissions, risks] = await Promise.all([
    client.findRecord(projectEntity, id),
    client
      .queryList(stakeholderEntity, { filter: { project_id: { _eq: id } }, selection: ['id', 'role', 'added_at'], limit: 50 })
      .catch(() => ({ rows: [] as AppfwRecord[] })),
    client
      .queryList(approvalEntity, {
        filter: { project_id: { _eq: id } },
        sort: { sequence_order: 'asc' },
        selection: ['id', 'approval_stage', 'assigned_role', 'status', 'decision', 'comments', 'approved_at', 'sequence_order'],
        limit: 50
      })
      .catch(() => ({ rows: [] as AppfwRecord[] })),
    client
      .queryList(gateSubmissionEntity, {
        filter: { project_id: { _eq: id } },
        sort: { created_at: 'asc' },
        selection: ['id', 'stage', 'status', 'decision', 'submitted_at', 'created_at'],
        limit: 50
      })
      .catch(() => ({ rows: [] as AppfwRecord[] })),
    client
      .queryList(riskEntity, {
        filter: { project_id: { _eq: id } },
        selection: ['id', 'risk_title', 'risk_category', 'severity', 'probability', 'status', 'identified_at'],
        limit: 50
      })
      .catch(() => ({ rows: [] as AppfwRecord[] }))
  ]);
  return { project, stakeholders: stakeholders.rows, approvals: approvals.rows, submissions: submissions.rows, risks: risks.rows };
}

const glassCard: CSSProperties = {
  borderRadius: 16,
  background: 'rgba(30,41,59,0.5)',
  backdropFilter: 'blur(12px)',
  border: '1px solid rgba(255,255,255,0.1)'
};

const PIPELINE = ['Intake', 'EPMO', 'BTA', 'Finance', 'EAC', 'PIC'];

const darkBtn: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  background: 'rgba(30,41,59,0.8)',
  color: '#e2e8f0',
  border: '1px solid rgba(255,255,255,0.12)',
  padding: '8px 14px',
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer'
};
const darkBtnGhost: CSSProperties = { ...darkBtn, background: 'transparent', color: '#94A3B8' };

function stageMatches(value: string, key: string) {
  return value.toLowerCase().includes(key.toLowerCase());
}

export function ProjectDetailScreen() {
  const { projectId = '' } = useParams();
  const navigate = useNavigate();
  const { auth } = useApp();
  const [tab, setTab] = useState('overview');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const state = useAsync((client) => loadProject(client, projectId), [projectId]);
  const cancelAction = useAction((client, reason: string) => client.invoke('cancel', { projectId, reason }));
  const fastTrackAction = useAction((client) => client.invoke('fastTrackComplete', { projectId }));

  const canCancel = hasAnyRole(auth, ['admin', 'epmo', 'project_manager']);
  const canFastTrack = hasAnyRole(auth, ['admin']);

  return (
    <div className="animate-fade-in" style={{ padding: 32, minHeight: '100%', background: '#0f172a', color: '#f8fafc' }}>
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', background: 'linear-gradient(to bottom right,#0f172a,#1e1b4b,#0f172a)' }}
      />
      <div style={{ position: 'relative', zIndex: 1, maxWidth: 1400, margin: '0 auto', display: 'grid', gap: 24 }}>
        <AsyncSection state={state} isEmpty={(data) => !data.project}>
          {(data) => {
            const project = data.project as AppfwRecord;
            const currentStage = asText(project.current_stage);
            // Reads come back PascalCase (async-graphql rename) — normalise
            // before comparing to the model's SCREAMING_SNAKE.
            const approvedStages = data.approvals
              .filter((a) => canonicalEnumKey(String(a.status)) === 'APPROVED')
              .map((a) => asText(a.approval_stage).toLowerCase());
            const projectComplete = canonicalEnumKey(String(project.status)) === 'COMPLETED';
            const currentIdx = PIPELINE.findIndex((s) => stageMatches(currentStage, s));

            const isDone = (i: number, key: string) =>
              key === 'Intake' ||
              (currentIdx > i && currentIdx !== -1) ||
              projectComplete ||
              approvedStages.some((s) => s.includes(key.toLowerCase()));

            const tabs: { id: string; label: string; icon: string }[] = [
              { id: 'overview', label: 'Overview', icon: 'article' },
              { id: 'approvals', label: `Approvals (${data.approvals.length})`, icon: 'fact_check' },
              { id: 'gates', label: `Gate submissions (${data.submissions.length})`, icon: 'gavel' },
              { id: 'risks', label: `Risks (${data.risks.length})`, icon: 'warning' },
              { id: 'stakeholders', label: `Stakeholders (${data.stakeholders.length})`, icon: 'groups' }
            ];

            return (
              <>
                {/* Header card */}
                <div style={{ ...glassCard, position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg,#4F46E5 0%,#7C3AED 50%,#06B6D4 100%)' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, padding: '24px 32px 16px', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', background: 'linear-gradient(135deg,#EEF2FF,#F5F3FF)', color: '#4F46E5', padding: '4px 12px', borderRadius: 9999 }}>
                          Read-only record
                        </span>
                        <span style={{ color: '#475569' }}>·</span>
                        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#94A3B8' }}>
                          ID: {asText(project.project_number)}
                        </span>
                      </div>
                      <h1 style={{ margin: '0 0 12px', fontSize: 24, fontWeight: 800, color: 'white', lineHeight: 1.2 }}>
                        {asText(project.project_name)}
                      </h1>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap', fontSize: 12, color: '#94A3B8' }}>
                        <MetaItem icon="person_outline" value={asText(project.requestor_name)} />
                        <MetaItem icon="business" value={asText(project.department || project.business_unit)} />
                        <MetaItem icon="calendar_today" value={formatDate(project.created_at)} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-end' }}>
                      <div style={{ padding: '14px 20px', borderRadius: 12, textAlign: 'center', background: 'rgba(79,70,229,0.1)', border: '1px solid rgba(79,70,229,0.2)' }}>
                        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#818CF8', marginBottom: 6 }}>Current stage</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#4F46E5' }} />
                          <span style={{ fontSize: 13, fontWeight: 800, color: 'white' }}>{currentStage || 'Intake'}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <button type="button" style={darkBtn} onClick={() => navigate(`/projects/${projectId}/workspace`)}>
                          <Icon name="open_in_new" size={16} /> Open workspace
                        </button>
                        {canFastTrack && (
                          <button
                            type="button"
                            style={darkBtnGhost}
                            disabled={fastTrackAction.pending}
                            onClick={() => fastTrackAction.run().then(() => state.reload())}
                          >
                            Fast-track
                          </button>
                        )}
                        {canCancel && (
                          <button type="button" style={darkBtnGhost} onClick={() => setCancelOpen(true)}>
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Pipeline ribbon */}
                  <div style={{ padding: '0 32px 24px', display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
                    {PIPELINE.map((label, idx, arr) => {
                      const done = isDone(idx, label);
                      const active = idx === currentIdx;
                      return (
                        <div key={label} style={{ display: 'flex', alignItems: 'center' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <div
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 11,
                                fontWeight: 700,
                                color: done || active ? 'white' : '#475569',
                                background: done
                                  ? 'linear-gradient(135deg,#059669,#047857)'
                                  : active
                                    ? 'linear-gradient(135deg,#4F46E5,#7C3AED)'
                                    : 'rgba(30,41,59,0.8)',
                                border: done || active ? 'none' : '2px solid rgba(100,116,139,0.4)'
                              }}
                            >
                              {done ? <Icon name="check" size={14} /> : idx + 1}
                            </div>
                            <span style={{ fontSize: 9, fontWeight: 700, marginTop: 4, color: done ? '#6EE7B7' : active ? '#A5B4FC' : '#475569' }}>{label}</span>
                          </div>
                          {idx < arr.length - 1 && (
                            <div style={{ height: 2, width: 32, margin: '0 4px 16px', borderRadius: 9999, background: done ? 'linear-gradient(90deg,#059669,#047857)' : 'rgba(100,116,139,0.2)' }} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {cancelAction.error && <InlineAlert tone="danger" title="Cancel failed" detail={cancelAction.error.message} />}
                {fastTrackAction.error && <InlineAlert tone="danger" title="Fast-track failed" detail={fastTrackAction.error.message} />}

                {/* Tabs */}
                <div style={{ ...glassCard, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', padding: '4px 8px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', overflowX: 'auto' }}>
                    {tabs.map((t) => {
                      const on = tab === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setTab(t.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '16px 20px',
                            fontSize: 13,
                            fontWeight: 700,
                            borderBottom: `2px solid ${on ? '#818CF8' : 'transparent'}`,
                            color: on ? '#A5B4FC' : '#94A3B8',
                            background: on ? 'linear-gradient(180deg,rgba(79,70,229,0.08) 0%,transparent 100%)' : 'transparent',
                            border: 'none',
                            borderBottomWidth: 2,
                            borderBottomStyle: 'solid',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          <Icon name={t.icon} size={18} /> {t.label}
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ padding: 32 }}>
                    {tab === 'overview' && <OverviewTab project={project} />}
                    {tab === 'approvals' && <ApprovalsTab rows={data.approvals} />}
                    {tab === 'gates' && <SubmissionsTab rows={data.submissions} />}
                    {tab === 'risks' && <RisksTab rows={data.risks} />}
                    {tab === 'stakeholders' && <StakeholdersTab rows={data.stakeholders} />}
                  </div>
                </div>

                <Dialog
                  open={cancelOpen}
                  title="Cancel project"
                  description="This moves the project to CANCELLED. A reason is required and recorded to the audit log."
                  onClose={() => setCancelOpen(false)}
                  closeLabel="Close cancel dialog"
                  footer={
                    <>
                      <Button variant="quiet" onClick={() => setCancelOpen(false)}>
                        Keep project
                      </Button>
                      <Button
                        variant="primary"
                        isLoading={cancelAction.pending}
                        disabled={!cancelReason.trim()}
                        onClick={async () => {
                          const result = await cancelAction.run(cancelReason.trim());
                          if (result !== undefined) {
                            setCancelOpen(false);
                            setCancelReason('');
                            state.reload();
                          }
                        }}
                      >
                        Confirm cancel
                      </Button>
                    </>
                  }
                >
                  <FormLayout columns="one">
                    <TextArea
                      label="Cancellation reason"
                      required
                      rows={3}
                      value={cancelReason}
                      onChange={(event) => setCancelReason(event.target.value)}
                    />
                  </FormLayout>
                </Dialog>
              </>
            );
          }}
        </AsyncSection>
      </div>
    </div>
  );
}

function MetaItem({ icon, value }: { icon: string; value: string }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <Icon name={icon} size={14} />
      <span style={{ color: '#cbd5e1' }}>{value}</span>
    </span>
  );
}

function DarkTable({ headers, children }: { headers: string[]; children: ReactNode }) {
  return (
    <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
            {headers.map((h) => (
              <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 700, color: '#94A3B8', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
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

const td: CSSProperties = { padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#e2e8f0', verticalAlign: 'top' };

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <span style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>
        {label}
      </span>
      <span style={{ display: 'block', fontSize: 14, color: '#e2e8f0', whiteSpace: 'pre-wrap' }}>{value || <em style={{ color: '#475569' }}>Not specified</em>}</span>
    </div>
  );
}

function OverviewTab({ project }: { project: AppfwRecord }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 24 }}>
      <div style={{ ...glassCard, padding: 20, background: 'rgba(15,23,42,0.4)' }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 14, color: '#cbd5e1' }}>Request</h3>
        <div style={{ display: 'grid', gap: 12 }}>
          <Field label="Business unit" value={asText(project.business_unit)} />
          <Field label="Department" value={asText(project.department)} />
          <Field label="Sponsor" value={asText(project.sponsor_name)} />
          <Field label="Requestor" value={asText(project.requestor_name)} />
          <Field label="Request type" value={asText(project.request_type)} />
          <Field label="Priority" value={humanizeEnum(project.priority)} />
          <Field label="Risk level" value={humanizeEnum(project.risk_level)} />
        </div>
      </div>
      <div style={{ ...glassCard, padding: 20, background: 'rgba(15,23,42,0.4)' }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 14, color: '#cbd5e1' }}>Scope &amp; value</h3>
        <div style={{ display: 'grid', gap: 12 }}>
          <Field label="Problem statement" value={asText(project.problem_statement)} />
          <Field label="Business value" value={asText(project.business_value)} />
          <Field label="Desired outcome" value={asText(project.desired_outcome)} />
          <Field label="Strategic alignment" value={asText(project.strategic_alignment)} />
        </div>
      </div>
      <div style={{ ...glassCard, padding: 20, background: 'rgba(15,23,42,0.4)' }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 14, color: '#cbd5e1' }}>Compliance &amp; delivery</h3>
        <div style={{ display: 'grid', gap: 12 }}>
          <Field label="Contains PHI" value={project.has_phi_data ? 'Yes' : 'No'} />
          <Field label="Clinical" value={project.is_clinical ? 'Yes' : 'No'} />
          <Field label="HIPAA applicable" value={project.is_hipaa_applicable ? 'Yes' : 'No'} />
          <Field label="Vendor required" value={project.vendor_required ? 'Yes' : 'No'} />
          <Field label="Estimated budget" value={asText(project.budget_estimated)} />
          <Field label="Approved budget" value={asText(project.budget_approved)} />
          <Field label="Requested start" value={formatDate(project.requested_start_date)} />
          <Field label="Requested end" value={formatDate(project.requested_end_date)} />
          <Field label="Submitted" value={formatDateTime(project.submitted_at)} />
        </div>
      </div>
    </div>
  );
}

function ApprovalsTab({ rows }: { rows: readonly AppfwRecord[] }) {
  if (!rows.length) return <p style={{ color: '#64748B' }}>No approval routing yet.</p>;
  return (
    <DarkTable headers={['Stage', 'Role', 'Status', 'Decision', 'Decided', 'Comments']}>
      {rows.map((row) => (
        <tr key={String(row.id)}>
          <td style={td}>{humanizeEnum(row.approval_stage)}</td>
          <td style={td}>{humanizeEnum(row.assigned_role)}</td>
          <td style={td}>{humanizeEnum(row.status)}</td>
          <td style={td}>{humanizeEnum(row.decision)}</td>
          <td style={td}>{formatDate(row.approved_at)}</td>
          <td style={td}>{asText(row.comments)}</td>
        </tr>
      ))}
    </DarkTable>
  );
}

function SubmissionsTab({ rows }: { rows: readonly AppfwRecord[] }) {
  if (!rows.length) return <p style={{ color: '#64748B' }}>No gate submissions recorded.</p>;
  return (
    <DarkTable headers={['Stage', 'Status', 'Decision', 'Submitted']}>
      {rows.map((row) => (
        <tr key={String(row.id)}>
          <td style={td}>{humanizeEnum(row.stage)}</td>
          <td style={td}>{humanizeEnum(row.status)}</td>
          <td style={td}>{humanizeEnum(row.decision)}</td>
          <td style={td}>{formatDateTime(row.submitted_at)}</td>
        </tr>
      ))}
    </DarkTable>
  );
}

function RisksTab({ rows }: { rows: readonly AppfwRecord[] }) {
  if (!rows.length) return <p style={{ color: '#64748B' }}>No risks logged.</p>;
  return (
    <DarkTable headers={['Risk', 'Category', 'Severity', 'Probability', 'Status', 'Identified']}>
      {rows.map((row) => (
        <tr key={String(row.id)}>
          <td style={td}>{asText(row.risk_title)}</td>
          <td style={td}>{asText(row.risk_category)}</td>
          <td style={td}>{humanizeEnum(row.severity)}</td>
          <td style={td}>{humanizeEnum(row.probability)}</td>
          <td style={td}>{humanizeEnum(row.status)}</td>
          <td style={td}>{formatDate(row.identified_at)}</td>
        </tr>
      ))}
    </DarkTable>
  );
}

function StakeholdersTab({ rows }: { rows: readonly AppfwRecord[] }) {
  if (!rows.length) return <p style={{ color: '#64748B' }}>No stakeholders assigned.</p>;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {rows.map((row) => (
        <span
          key={String(row.id)}
          style={{ background: 'rgba(79,70,229,0.1)', border: '1px solid rgba(79,70,229,0.25)', color: '#A5B4FC', padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600 }}
        >
          {humanizeEnum(row.role)} · added {formatDate(row.added_at)}
        </span>
      ))}
    </div>
  );
}
