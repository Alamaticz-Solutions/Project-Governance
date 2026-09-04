import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import {
  Badge,
  Button,
  Dialog,
  FormLayout,
  InlineAlert,
  PageHeader,
  Surface,
  Tabs,
  TextArea,
  type TabItem
} from '@appfw/pds-health-components';
import { useAction, useApp, useAsync } from '../../app/providers';
import { entityByType } from '../../lib/entities';
import type { AppfwClient, AppfwRecord } from '../../lib/appfwClient';
import {
  AsyncSection,
  DefinitionList,
  EnumBadge,
  formatDate,
  formatDateTime,
  asText
} from '../../components/ui';
import { hasAnyRole } from '../../lib/authContext';

const projectEntity = entityByType('Project');
const stakeholderEntity = entityByType('ProjectStakeholder');
const approvalEntity = entityByType('ProjectApproval');
const gateSubmissionEntity = entityByType('GateSubmission');
const riskEntity = entityByType('RiskItem');

async function loadProject(client: AppfwClient, id: string) {
  const [project, stakeholders, approvals, submissions, risks] = await Promise.all([
    client.findRecord(projectEntity, id),
    client
      .queryList(stakeholderEntity, {
        filter: { project_id: { _eq: id } },
        selection: ['id', 'role', 'added_at'],
        limit: 50
      })
      .catch(() => ({ rows: [] as AppfwRecord[] })),
    client
      .queryList(approvalEntity, {
        filter: { project_id: { _eq: id } },
        sort: [{ sequence_order: 'asc' }],
        selection: [
          'id',
          'approval_stage',
          'assigned_role',
          'status',
          'decision',
          'comments',
          'approved_at',
          'sequence_order'
        ],
        limit: 50
      })
      .catch(() => ({ rows: [] as AppfwRecord[] })),
    client
      .queryList(gateSubmissionEntity, {
        filter: { project_id: { _eq: id } },
        sort: [{ created_at: 'asc' }],
        selection: ['id', 'stage', 'status', 'decision', 'submitted_at', 'created_at'],
        limit: 50
      })
      .catch(() => ({ rows: [] as AppfwRecord[] })),
    client
      .queryList(riskEntity, {
        filter: { project_id: { _eq: id } },
        selection: [
          'id',
          'risk_title',
          'risk_category',
          'severity',
          'probability',
          'status',
          'identified_at'
        ],
        limit: 50
      })
      .catch(() => ({ rows: [] as AppfwRecord[] }))
  ]);
  return { project, stakeholders, approvals, submissions, risks };
}

export function ProjectDetailScreen() {
  const { projectId = '' } = useParams();
  const navigate = useNavigate();
  const { auth } = useApp();
  const [tab, setTab] = useState('overview');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const state = useAsync((client) => loadProject(client, projectId), [projectId]);
  const cancelAction = useAction((client, reason: string) =>
    client.invoke('cancel', { projectId, reason })
  );
  const fastTrackAction = useAction((client) =>
    client.invoke('fastTrackComplete', { projectId })
  );

  const canCancel = hasAnyRole(auth, ['admin', 'epmo', 'project_manager']);
  const canFastTrack = hasAnyRole(auth, ['admin']);

  return (
    <AsyncSection state={state} isEmpty={(data) => !data.project}>
      {(data) => {
        const project = data.project as AppfwRecord;
        const tabs: TabItem[] = [
          {
            id: 'overview',
            label: 'Overview',
            content: <OverviewTab project={project} />
          },
          {
            id: 'approvals',
            label: `Approvals (${data.approvals.rows.length})`,
            content: <ApprovalsTab rows={data.approvals.rows} />
          },
          {
            id: 'gates',
            label: `Gate submissions (${data.submissions.rows.length})`,
            content: <SubmissionsTab rows={data.submissions.rows} />
          },
          {
            id: 'risks',
            label: `Risks (${data.risks.rows.length})`,
            content: <RisksTab rows={data.risks.rows} />
          },
          {
            id: 'stakeholders',
            label: `Stakeholders (${data.stakeholders.rows.length})`,
            content: <StakeholdersTab rows={data.stakeholders.rows} />
          }
        ];
        return (
          <>
            <PageHeader
              eyebrow={asText(project.project_number)}
              title={asText(project.project_name)}
              subtitle={
                <span>
                  <EnumBadge value={project.status} /> · stage {asText(project.current_stage)} ·
                  owner {asText(project.current_owner_role)}
                </span>
              }
              actions={
                <div className="inline-actions">
                  <Button
                    variant="secondary"
                    onClick={() => navigate(`/projects/${projectId}/workspace`)}
                  >
                    Open workspace
                  </Button>
                  {canFastTrack && (
                    <Button
                      variant="quiet"
                      isLoading={fastTrackAction.pending}
                      onClick={() => fastTrackAction.run().then(() => state.reload())}
                    >
                      Fast-track complete
                    </Button>
                  )}
                  {canCancel && (
                    <Button variant="quiet" isDenied onClick={() => setCancelOpen(true)}>
                      Cancel project
                    </Button>
                  )}
                </div>
              }
            />

            {cancelAction.error && (
              <InlineAlert
                tone="danger"
                title="Cancel failed"
                detail={cancelAction.error.message}
              />
            )}
            {fastTrackAction.error && (
              <InlineAlert
                tone="danger"
                title="Fast-track failed"
                detail={fastTrackAction.error.message}
              />
            )}

            <Surface>
              <Tabs items={tabs} selectedId={tab} onChange={setTab} ariaLabel="Project detail" />
            </Surface>

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
  );
}

function OverviewTab({ project }: { project: AppfwRecord }) {
  return (
    <div className="card-grid">
      <div>
        <h3>Request</h3>
        <DefinitionList
          items={[
            { label: 'Business unit', value: asText(project.business_unit) },
            { label: 'Department', value: asText(project.department) },
            { label: 'Sponsor', value: asText(project.sponsor_name) },
            { label: 'Requestor', value: asText(project.requestor_name) },
            { label: 'Request type', value: asText(project.request_type) },
            { label: 'Priority', value: <EnumBadge value={project.priority} /> },
            { label: 'Risk level', value: <EnumBadge value={project.risk_level} /> }
          ]}
        />
      </div>
      <div>
        <h3>Scope &amp; value</h3>
        <DefinitionList
          items={[
            { label: 'Problem statement', value: asText(project.problem_statement) },
            { label: 'Business value', value: asText(project.business_value) },
            { label: 'Desired outcome', value: asText(project.desired_outcome) },
            { label: 'Strategic alignment', value: asText(project.strategic_alignment) }
          ]}
        />
      </div>
      <div>
        <h3>Compliance &amp; delivery</h3>
        <DefinitionList
          items={[
            { label: 'Contains PHI', value: project.has_phi_data ? 'Yes' : 'No' },
            { label: 'Clinical', value: project.is_clinical ? 'Yes' : 'No' },
            { label: 'HIPAA applicable', value: project.is_hipaa_applicable ? 'Yes' : 'No' },
            { label: 'Vendor required', value: project.vendor_required ? 'Yes' : 'No' },
            { label: 'Estimated budget', value: asText(project.budget_estimated) },
            { label: 'Approved budget', value: asText(project.budget_approved) },
            { label: 'Requested start', value: formatDate(project.requested_start_date) },
            { label: 'Requested end', value: formatDate(project.requested_end_date) },
            { label: 'Submitted', value: formatDateTime(project.submitted_at) }
          ]}
        />
      </div>
    </div>
  );
}

function ApprovalsTab({ rows }: { rows: readonly AppfwRecord[] }) {
  if (!rows.length) return <p>No approval routing yet.</p>;
  return (
    <table className="record-table">
      <thead>
        <tr>
          <th>Stage</th>
          <th>Role</th>
          <th>Status</th>
          <th>Decision</th>
          <th>Decided</th>
          <th>Comments</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={String(row.id)}>
            <td>{asText(row.approval_stage)}</td>
            <td>{asText(row.assigned_role)}</td>
            <td>
              <EnumBadge value={row.status} />
            </td>
            <td>
              <EnumBadge value={row.decision} />
            </td>
            <td>{formatDate(row.approved_at)}</td>
            <td>{asText(row.comments)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SubmissionsTab({ rows }: { rows: readonly AppfwRecord[] }) {
  if (!rows.length) return <p>No gate submissions recorded.</p>;
  return (
    <table className="record-table">
      <thead>
        <tr>
          <th>Stage</th>
          <th>Status</th>
          <th>Decision</th>
          <th>Submitted</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={String(row.id)}>
            <td>{asText(row.stage)}</td>
            <td>
              <EnumBadge value={row.status} />
            </td>
            <td>
              <EnumBadge value={row.decision} />
            </td>
            <td>{formatDateTime(row.submitted_at)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function RisksTab({ rows }: { rows: readonly AppfwRecord[] }) {
  if (!rows.length) return <p>No risks logged.</p>;
  return (
    <table className="record-table">
      <thead>
        <tr>
          <th>Risk</th>
          <th>Category</th>
          <th>Severity</th>
          <th>Probability</th>
          <th>Status</th>
          <th>Identified</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={String(row.id)}>
            <td>{asText(row.risk_title)}</td>
            <td>{asText(row.risk_category)}</td>
            <td>{asText(row.severity)}</td>
            <td>{asText(row.probability)}</td>
            <td>
              <EnumBadge value={row.status} />
            </td>
            <td>{formatDate(row.identified_at)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function StakeholdersTab({ rows }: { rows: readonly AppfwRecord[] }) {
  if (!rows.length) return <p>No stakeholders assigned.</p>;
  return (
    <ul>
      {rows.map((row) => (
        <li key={String(row.id)}>
          <Badge tone="neutral">{asText(row.role)}</Badge> · added {formatDate(row.added_at)}
        </li>
      ))}
    </ul>
  );
}
