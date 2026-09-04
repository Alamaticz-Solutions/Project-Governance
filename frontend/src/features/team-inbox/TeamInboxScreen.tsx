import { useMemo } from 'react';
import { Link } from 'react-router';
import {
  Badge,
  InlineAlert,
  PageHeader,
  SegmentedControl,
  Surface
} from '@appfw/pds-health-components';
import { useApp, useAsync } from '../../app/providers';
import { entityByType } from '../../lib/entities';
import type { AppfwClient, AppfwRecord } from '../../lib/appfwClient';
import { AsyncSection, EnumBadge, formatDate } from '../../components/ui';
import { useState } from 'react';

const approvalEntity = entityByType('ProjectApproval');
const gateReviewEntity = entityByType('GateReview');

async function loadInbox(client: AppfwClient, roles: readonly string[]) {
  const upperRoles = roles.map((role) => role.toUpperCase());
  const roleFilter = upperRoles.length ? { assigned_role: { _in: upperRoles } } : undefined;

  const [approvals, reviews] = await Promise.all([
    client
      .queryList(approvalEntity, {
        limit: 100,
        sort: [{ created_at: 'asc' }],
        filter: roleFilter
          ? { _and: [{ status: { _eq: 'PENDING' } }, roleFilter] }
          : { status: { _eq: 'PENDING' } },
        selection: [
          'id',
          'approval_stage',
          'assigned_role',
          'status',
          'sequence_order',
          'created_at',
          'project_id'
        ]
      })
      .catch(() => ({ rows: [] as AppfwRecord[] })),
    client
      .queryList(gateReviewEntity, {
        limit: 100,
        sort: [{ due_date: 'asc' }],
        filter: roleFilter
          ? { _and: [{ status: { _in: ['PENDING', 'IN_PROGRESS'] } }, roleFilter] }
          : { status: { _in: ['PENDING', 'IN_PROGRESS'] } },
        selection: [
          'id',
          'gate_code',
          'gate_name',
          'committee',
          'assigned_role',
          'status',
          'due_date',
          'priority',
          'project_id'
        ]
      })
      .catch(() => ({ rows: [] as AppfwRecord[] }))
  ]);
  return { approvals: approvals.rows, reviews: reviews.rows };
}

export function TeamInboxScreen() {
  const { auth } = useApp();
  const [view, setView] = useState<'approvals' | 'gates'>('approvals');
  const state = useAsync((client) => loadInbox(client, auth.roles), [auth.roles.join(',')]);

  const roleNote = useMemo(
    () =>
      auth.roles.length
        ? `Showing work routed to: ${auth.roles.join(', ')}`
        : 'No role set — showing all pending work. Set your role in the session dialog to filter.',
    [auth.roles]
  );

  return (
    <>
      <PageHeader title="Team inbox" subtitle={roleNote} />
      {auth.source !== 'session' && (
        <InlineAlert
          tone="warning"
          title="No local session"
          detail="Actions will fail closed until you set a bearer token and role."
        />
      )}
      <Surface
        actions={
          <SegmentedControl
            options={[
              { value: 'approvals', label: 'Approvals' },
              { value: 'gates', label: 'Gate reviews' }
            ]}
            value={view}
            onValueChange={(value) => setView(value as 'approvals' | 'gates')}
            ariaLabel="Inbox view"
          />
        }
      >
        <AsyncSection
          state={state}
          isEmpty={(data) =>
            view === 'approvals' ? data.approvals.length === 0 : data.reviews.length === 0
          }
          emptyTitle="Inbox clear"
          emptyDetail="No pending items for your role."
        >
          {(data) =>
            view === 'approvals' ? (
              <table className="record-table">
                <thead>
                  <tr>
                    <th>Stage</th>
                    <th>Role</th>
                    <th>Seq</th>
                    <th>Waiting since</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.approvals.map((row) => (
                    <tr key={String(row.id)}>
                      <td>{String(row.approval_stage ?? '—')}</td>
                      <td>
                        <Badge tone="warning">{String(row.assigned_role ?? '—')}</Badge>
                      </td>
                      <td>{String(row.sequence_order ?? '—')}</td>
                      <td>{formatDate(row.created_at)}</td>
                      <td>
                        <Link to={`/projects/${String(row.project_id)}/workspace`}>
                          Open workspace
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="record-table">
                <thead>
                  <tr>
                    <th>Gate</th>
                    <th>Committee</th>
                    <th>Status</th>
                    <th>Due</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.reviews.map((row) => (
                    <tr key={String(row.id)}>
                      <td>
                        {String(row.gate_code ?? '')} · {String(row.gate_name ?? '—')}
                      </td>
                      <td>{String(row.committee ?? '—')}</td>
                      <td>
                        <EnumBadge value={row.status} />
                      </td>
                      <td>{formatDate(row.due_date)}</td>
                      <td>
                        <Link to={`/projects/${String(row.project_id)}/workspace`}>
                          Open workspace
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          }
        </AsyncSection>
      </Surface>
    </>
  );
}
