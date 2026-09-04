import { useState } from 'react';
import { Link, useParams } from 'react-router';
import {
  Badge,
  Button,
  Drawer,
  FormLayout,
  InlineAlert,
  PageHeader,
  ProcessStepper,
  SelectField,
  Surface,
  TextArea,
  type ProcessStepItem,
  type ProcessStepStatus
} from '@appfw/pds-health-components';
import { useAction, useApp, useAsync } from '../../app/providers';
import { entityByType } from '../../lib/entities';
import type { AppfwClient, AppfwRecord } from '../../lib/appfwClient';
import { AsyncSection, EnumBadge, asText, formatDate } from '../../components/ui';
import { hasAnyRole } from '../../lib/authContext';
import { APPROVAL_DECISION } from '../shared/enums';

const projectEntity = entityByType('Project');
const instanceEntity = entityByType('WorkflowInstance');
const stageEntity = entityByType('WorkflowStage');
const submissionEntity = entityByType('GateSubmission');
const approvalEntity = entityByType('ProjectApproval');

const STEP_STATUS: Record<string, ProcessStepStatus> = {
  APPROVED: 'complete',
  SKIPPED: 'complete',
  IN_PROGRESS: 'current',
  PENDING_APPROVAL: 'current',
  ELIGIBLE: 'upcoming',
  CHANGES_REQUESTED: 'current',
  REJECTED: 'blocked',
  LOCKED: 'upcoming'
};

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
            sort: [{ sequence_order: 'asc' }],
            selection: [
              'id',
              'stage_name',
              'stage_code',
              'sequence_order',
              'status',
              'started_at',
              'completed_at',
              'due_date',
              'notes'
            ],
            limit: 100
          })
          .catch(() => ({ rows: [] as AppfwRecord[] }))
      : Promise.resolve({ rows: [] as AppfwRecord[] }),
    client
      .queryList(submissionEntity, {
        filter: { project_id: { _eq: projectId } },
        sort: [{ created_at: 'asc' }],
        selection: ['id', 'stage', 'status', 'decision', 'data', 'submitted_at'],
        limit: 100
      })
      .catch(() => ({ rows: [] as AppfwRecord[] })),
    client
      .queryList(approvalEntity, {
        filter: { project_id: { _eq: projectId } },
        sort: [{ sequence_order: 'asc' }],
        selection: ['id', 'approval_stage', 'assigned_role', 'status', 'decision', 'comments'],
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

export function ProjectWorkspaceScreen() {
  const { projectId = '' } = useParams();
  const { auth } = useApp();
  const state = useAsync((client) => loadWorkspace(client, projectId), [projectId]);

  const stageAction = useAction(
    (client, verb: 'start' | 'submit' | 'skip', stageId: string, extra: string) => {
      if (verb === 'start') return client.invoke('start', { stageId });
      if (verb === 'skip') return client.invoke('skip', { stageId, reason: extra });
      return client.invoke('submit', { stageId, payload: { notes: extra } });
    }
  );
  const saveStage = useAction((client, stage: string, notes: string) =>
    client.invoke('saveStage', { projectId, stage, payload: { notes, status: 'in_progress' } })
  );
  const decide = useAction((client, decision: string, comments: string) =>
    client.invoke('submitDecision', { projectId, payload: { decision, comments } })
  );

  const [gateDrawer, setGateDrawer] = useState<string | null>(null);
  const [gateNotes, setGateNotes] = useState('');
  const [skipFor, setSkipFor] = useState<string | null>(null);
  const [skipReason, setSkipReason] = useState('');
  const [decision, setDecision] = useState('APPROVED');
  const [decisionComments, setDecisionComments] = useState('');

  const canOperate = hasAnyRole(auth, [
    'admin',
    'epmo',
    'project_manager',
    'bta',
    'finance',
    'eac',
    'cab',
    'pic',
    'trc',
    'security',
    'analysis_team'
  ]);

  return (
    <AsyncSection state={state} isEmpty={(data) => !data.project}>
      {(data) => {
        const project = data.project as AppfwRecord;
        const steps: ProcessStepItem[] = data.stages.map((stage) => ({
          id: String(stage.id),
          label: asText(stage.stage_name),
          description: `${asText(stage.stage_code)} · ${asText(stage.status)}`,
          status: STEP_STATUS[String(stage.status)] ?? 'upcoming'
        }));

        return (
          <>
            <PageHeader
              eyebrow={asText(project.project_number)}
              title={`Workspace · ${asText(project.project_name)}`}
              subtitle={
                <span>
                  <EnumBadge value={project.status} /> · workflow{' '}
                  {asText(data.instance?.status ?? 'not started')}
                </span>
              }
              actions={
                <Link to={`/projects/${projectId}`}>
                  <Button variant="secondary">Project detail</Button>
                </Link>
              }
            />

            {!canOperate && (
              <InlineAlert
                tone="warning"
                title="Read-only"
                detail="Your role cannot operate gates on this project. Actions are hidden."
              />
            )}
            {stageAction.error && (
              <InlineAlert tone="danger" title="Stage action failed" detail={stageAction.error.message} />
            )}
            {decide.error && (
              <InlineAlert tone="danger" title="Decision failed" detail={decide.error.message} />
            )}
            {saveStage.error && (
              <InlineAlert tone="danger" title="Save failed" detail={saveStage.error.message} />
            )}

            {steps.length > 0 && (
              <Surface title="Gate progression">
                <ProcessStepper steps={steps} ariaLabel="Workflow stages" />
              </Surface>
            )}

            <Surface title="Stages" subtitle="Per-gate lifecycle transitions">
              {data.stages.length === 0 ? (
                <p>No workflow instance / stages for this project yet.</p>
              ) : (
                <table className="record-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Stage</th>
                      <th>Status</th>
                      <th>Started</th>
                      <th>Due</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.stages.map((stage) => {
                      const status = String(stage.status);
                      const stageId = String(stage.id);
                      return (
                        <tr key={stageId}>
                          <td>{asText(stage.sequence_order)}</td>
                          <td>
                            {asText(stage.stage_name)}
                            <br />
                            <small>{asText(stage.stage_code)}</small>
                          </td>
                          <td>
                            <EnumBadge value={status} />
                          </td>
                          <td>{formatDate(stage.started_at)}</td>
                          <td>{formatDate(stage.due_date)}</td>
                          <td>
                            {canOperate && (
                              <div className="inline-actions">
                                {(status === 'ELIGIBLE' || status === 'CHANGES_REQUESTED') && (
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    isLoading={stageAction.pending}
                                    onClick={() =>
                                      stageAction
                                        .run('start', stageId, '')
                                        .then(() => state.reload())
                                    }
                                  >
                                    Start
                                  </Button>
                                )}
                                {status === 'IN_PROGRESS' && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="secondary"
                                      onClick={() => {
                                        setGateDrawer(asText(stage.stage_code));
                                        setGateNotes('');
                                      }}
                                    >
                                      Gate form
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="primary"
                                      isLoading={stageAction.pending}
                                      onClick={() =>
                                        stageAction
                                          .run('submit', stageId, gateNotes)
                                          .then(() => state.reload())
                                      }
                                    >
                                      Submit
                                    </Button>
                                  </>
                                )}
                                {status !== 'APPROVED' && status !== 'SKIPPED' && (
                                  <Button
                                    size="sm"
                                    variant="quiet"
                                    isDenied
                                    onClick={() => {
                                      setSkipFor(stageId);
                                      setSkipReason('');
                                    }}
                                  >
                                    Skip
                                  </Button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </Surface>

            <div className="app-work-grid">
              <Surface title="Gate submissions">
                {data.submissions.length === 0 ? (
                  <p>No submissions.</p>
                ) : (
                  <ul>
                    {data.submissions.map((row) => (
                      <li key={String(row.id)}>
                        <Badge tone="neutral">{asText(row.stage)}</Badge>{' '}
                        <EnumBadge value={row.status} /> · <EnumBadge value={row.decision} /> ·{' '}
                        {formatDate(row.submitted_at)}
                      </li>
                    ))}
                  </ul>
                )}
              </Surface>

              <Surface title="Approval routing" subtitle="submit_decision applies to your pending role">
                {data.approvals.length === 0 ? (
                  <p>No approval routing.</p>
                ) : (
                  <ul>
                    {data.approvals.map((row) => (
                      <li key={String(row.id)}>
                        <Badge tone="warning">{asText(row.assigned_role)}</Badge>{' '}
                        {asText(row.approval_stage)} — <EnumBadge value={row.status} />{' '}
                        <EnumBadge value={row.decision} />
                      </li>
                    ))}
                  </ul>
                )}
                {canOperate && (
                  <FormLayout
                    columns="one"
                    footer={
                      <Button
                        variant="primary"
                        isLoading={decide.pending}
                        onClick={() =>
                          decide
                            .run(decision, decisionComments)
                            .then(() => state.reload())
                        }
                      >
                        Submit decision
                      </Button>
                    }
                  >
                    <SelectField
                      label="Decision"
                      value={decision}
                      onChange={(event) => setDecision(event.target.value)}
                      options={APPROVAL_DECISION}
                    />
                    <TextArea
                      label="Comments"
                      rows={2}
                      value={decisionComments}
                      onChange={(event) => setDecisionComments(event.target.value)}
                    />
                  </FormLayout>
                )}
              </Surface>
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
                <TextArea
                  label="Notes"
                  rows={6}
                  value={gateNotes}
                  onChange={(event) => setGateNotes(event.target.value)}
                />
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
                <TextArea
                  label="Skip reason"
                  required
                  rows={3}
                  value={skipReason}
                  onChange={(event) => setSkipReason(event.target.value)}
                />
              </FormLayout>
            </Drawer>
          </>
        );
      }}
    </AsyncSection>
  );
}
