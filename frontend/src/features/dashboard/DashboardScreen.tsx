import { Link, useNavigate } from 'react-router';
import {
  Badge,
  Button,
  KpiTile,
  PageHeader,
  Surface
} from '@ui-kit';
import { useApp, useAsync } from '../../app/providers';
import { entityByType } from '../../lib/entities';
import type { AppfwClient, AppfwRecord } from '../../lib/appfwClient';
import { AsyncSection, EnumBadge, formatDate } from '../../components/ui';

const projectEntity = entityByType('Project');
const approvalEntity = entityByType('ProjectApproval');

async function countWhere(client: AppfwClient, filter: unknown): Promise<number> {
  const result = await client.queryList(projectEntity, { filter, limit: 1, selection: ['id'] });
  return result.page.queryCount;
}

// `filter` args are untyped JSON and compare the raw stored text — the
// model's SCREAMING_SNAKE casing, not the PascalCase the GraphQL enum type
// uses for mutation input / read projections (confirmed live).
async function loadDashboard(client: AppfwClient, roles: readonly string[]) {
  const [total, active, inDelivery, cancelled, recent, approvals] = await Promise.all([
    countWhere(client, undefined),
    countWhere(client, { status: { _eq: 'ACTIVE' } }),
    countWhere(client, { status: { _eq: 'IN_DELIVERY' } }),
    countWhere(client, { status: { _eq: 'CANCELLED' } }),
    client.queryList(projectEntity, {
      limit: 8,
      sort: { created_at: 'desc' },
      selection: [
        'id',
        'project_number',
        'project_name',
        'status',
        'priority',
        'current_stage',
        'submitted_at'
      ]
    }),
    roles.length
      ? client
          .queryList(approvalEntity, {
            limit: 8,
            filter: {
              _and: [
                { status: { _eq: 'PENDING' } },
                { assigned_role: { _in: roles.map((r) => r.toUpperCase()) } }
              ]
            },
            sort: { created_at: 'asc' },
            selection: ['id', 'approval_stage', 'assigned_role', 'status', 'project_id']
          })
          .catch(() => ({ rows: [] as AppfwRecord[] }))
      : Promise.resolve({ rows: [] as AppfwRecord[] })
  ]);
  return {
    counts: { total, active, inDelivery, cancelled },
    recent: recent.rows,
    approvals: approvals.rows
  };
}

export function DashboardScreen() {
  const navigate = useNavigate();
  const { auth } = useApp();
  const state = useAsync((client) => loadDashboard(client, auth.roles), [auth.roles.join(',')]);

  return (
    <>
      <PageHeader
        title="Portfolio dashboard"
        subtitle="Governance intake, gate progression, and approvals at a glance"
        actions={
          <Button variant="primary" onClick={() => navigate('/intake')}>
            New intake
          </Button>
        }
      />
      <AsyncSection state={state}>
        {(data) => (
          <>
            <div className="app-kpi-grid">
              <KpiTile label="All projects" value={String(data.counts.total)} tone="accent" />
              <KpiTile label="Active" value={String(data.counts.active)} tone="success" />
              <KpiTile
                label="In delivery"
                value={String(data.counts.inDelivery)}
                tone="accent"
              />
              <KpiTile
                label="Cancelled"
                value={String(data.counts.cancelled)}
                tone="neutral"
              />
            </div>

            <div className="app-work-grid">
              <Surface title="Recent projects" subtitle="Newest intake first">
                {data.recent.length === 0 ? (
                  <p>No projects yet.</p>
                ) : (
                  <table className="record-table">
                    <thead>
                      <tr>
                        <th>Number</th>
                        <th>Project</th>
                        <th>Status</th>
                        <th>Stage</th>
                        <th>Submitted</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recent.map((row) => (
                        <tr key={String(row.id)}>
                          <td>
                            <Link to={`/projects/${String(row.id)}`}>
                              {String(row.project_number ?? '—')}
                            </Link>
                          </td>
                          <td>{String(row.project_name ?? '—')}</td>
                          <td>
                            <EnumBadge value={row.status} />
                          </td>
                          <td>{String(row.current_stage ?? '—')}</td>
                          <td>{formatDate(row.submitted_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Surface>

              <Surface
                title="My pending approvals"
                subtitle={
                  auth.roles.length
                    ? `Routed to: ${auth.roles.join(', ')}`
                    : 'Set a role in the session dialog to see routed work'
                }
                actions={
                  <Button variant="quiet" onClick={() => navigate('/team-inbox')}>
                    Open inbox
                  </Button>
                }
              >
                {data.approvals.length === 0 ? (
                  <p>Nothing waiting on you.</p>
                ) : (
                  <ul>
                    {data.approvals.map((row) => (
                      <li key={String(row.id)}>
                        <Badge tone="warning">{String(row.assigned_role ?? '—')}</Badge>{' '}
                        {String(row.approval_stage ?? '—')} —{' '}
                        <Link to={`/projects/${String(row.project_id)}/workspace`}>
                          open workspace
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Surface>
            </div>
          </>
        )}
      </AsyncSection>
    </>
  );
}
