import { useMemo, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router';
import { Icon } from '@ui-kit';
import { useApp, useAsync } from '../../app/providers';
import { entityByType } from '../../lib/entities';
import type { AppfwClient, AppfwRecord } from '../../lib/appfwClient';
import { humanizeEnum, formatDate } from '../../components/ui';
import { ROLE_CAPTIONS, type GovernanceRole } from '../../lib/authContext';

/**
 * Team inbox. Dark glass "Task Queue" presentation mirrors the Dev-branch
 * Pending Reviews screen. Rows are the pending ProjectApproval + open
 * GateReview items routed to the session roles, read through the App
 * Framework client.
 */

const approvalEntity = entityByType('ProjectApproval');
const gateReviewEntity = entityByType('GateReview');

type Task = {
  id: string;
  projectId: string;
  kind: 'approval' | 'gate';
  label: string;
  action: string;
  priority: string;
  date: string;
};

async function loadInbox(client: AppfwClient, roles: readonly string[]): Promise<Task[]> {
  const enumRoles = roles.map((r) => r.toUpperCase());
  const roleFilter = enumRoles.length ? { assigned_role: { _in: enumRoles } } : undefined;

  const [approvals, reviews] = await Promise.all([
    client
      .queryList(approvalEntity, {
        limit: 100,
        sort: { created_at: 'asc' },
        filter: roleFilter
          ? { _and: [{ status: { _eq: 'PENDING' } }, roleFilter] }
          : { status: { _eq: 'PENDING' } },
        selection: ['id', 'approval_stage', 'assigned_role', 'sequence_order', 'created_at', 'project_id']
      })
      .catch(() => ({ rows: [] as AppfwRecord[] })),
    client
      .queryList(gateReviewEntity, {
        limit: 100,
        sort: { due_date: 'asc' },
        filter: roleFilter
          ? { _and: [{ status: { _in: ['PENDING', 'IN_PROGRESS'] } }, roleFilter] }
          : { status: { _in: ['PENDING', 'IN_PROGRESS'] } },
        selection: ['id', 'gate_code', 'gate_name', 'committee', 'due_date', 'priority', 'project_id']
      })
      .catch(() => ({ rows: [] as AppfwRecord[] }))
  ]);

  const tasks: Task[] = [
    ...approvals.rows.map((r) => ({
      id: String(r.id),
      projectId: String(r.project_id ?? ''),
      kind: 'approval' as const,
      label: r.approval_stage ? humanizeEnum(r.approval_stage) : 'Approval',
      action: `${r.assigned_role ? humanizeEnum(r.assigned_role) : 'Review'} Review`,
      priority: '', // ProjectApproval rows carry no priority; only gate reviews do
      date: formatDate(r.created_at)
    })),
    ...reviews.rows.map((r) => ({
      id: String(r.id),
      projectId: String(r.project_id ?? ''),
      kind: 'gate' as const,
      label: `${String(r.gate_code ?? '')} · ${String(r.gate_name ?? 'Gate')}`.replace(/^ · /, ''),
      action: `${String(r.committee ?? 'Gate')} Review`,
      priority: String(r.priority ?? 'MEDIUM').toUpperCase(),
      date: formatDate(r.due_date)
    }))
  ];
  return tasks;
}

function iconForAction(action: string): string {
  const a = action.toLowerCase();
  if (a.includes('epmo')) return 'architecture';
  if (a.includes('bta')) return 'explore';
  if (a.includes('finance')) return 'account_balance';
  if (a.includes('security')) return 'security';
  if (a.includes('gate')) return 'fact_check';
  if (a.includes('eac')) return 'groups';
  if (a.includes('pic')) return 'assured_workload';
  return 'assignment';
}

function priorityStyle(priority: string): CSSProperties {
  const p = priority.toLowerCase();
  if (p === 'critical') return { background: 'rgba(244,63,94,0.2)', color: '#FDA4AF', border: '1px solid rgba(244,63,94,0.3)' };
  if (p === 'high') return { background: 'rgba(249,115,22,0.2)', color: '#FDBA74', border: '1px solid rgba(249,115,22,0.3)' };
  if (p === 'low') return { background: 'rgba(16,185,129,0.2)', color: '#6EE7B7', border: '1px solid rgba(16,185,129,0.3)' };
  return { background: 'rgba(59,130,246,0.2)', color: '#93C5FD', border: '1px solid rgba(59,130,246,0.3)' };
}

const inputStyle: CSSProperties = {
  background: 'rgba(30,41,59,0.7)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8,
  color: '#f1f5f9',
  fontSize: 13,
  fontWeight: 500,
  height: 40,
  outline: 'none'
};

export function TeamInboxScreen() {
  const { auth } = useApp();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  const state = useAsync((client) => loadInbox(client, auth.roles), [auth.roles.join(',')]);

  const teamName = auth.roles.length
    ? ROLE_CAPTIONS[auth.roles[0] as GovernanceRole] ?? auth.roles[0]
    : 'your team';

  const tasks = state.data ?? [];
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const a = actionFilter.toLowerCase().trim();
    return tasks.filter(
      (t) =>
        (!q || t.label.toLowerCase().includes(q)) && (!a || t.action.toLowerCase().includes(a))
    );
  }, [tasks, search, actionFilter]);

  return (
    <div
      className="animate-fade-in"
      style={{ minHeight: '100%', position: 'relative', overflow: 'hidden', background: '#0f172a', color: '#f1f5f9', paddingBottom: 40 }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 0,
          background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)'
        }}
      />
      <div style={{ position: 'relative', zIndex: 10, maxWidth: 1280, margin: '0 auto', padding: '32px 24px 0' }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            marginBottom: 32
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: 28,
                fontWeight: 700,
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                letterSpacing: '-0.02em'
              }}
            >
              <Icon name="inbox" size={30} style={{ color: '#818CF8' }} />
              Pending Reviews: {teamName}
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: 14, color: '#94A3B8' }}>
              Manage and process governance tasks awaiting your team&apos;s decision.
            </p>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
            <div style={{ position: 'relative' }}>
              <Icon name="search" size={16} style={{ position: 'absolute', left: 12, top: 12, color: '#94A3B8' }} />
              <input
                type="text"
                placeholder="Search by project..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ ...inputStyle, paddingLeft: 36, paddingRight: 16, width: 240 }}
              />
            </div>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              aria-label="Filter by required action"
              style={{ ...inputStyle, paddingLeft: 12, paddingRight: 28, width: 190, cursor: 'pointer' }}
            >
              <option value="">All Required Actions</option>
              <option value="EPMO">EPMO Review</option>
              <option value="BTA">BTA Review</option>
              <option value="Finance">Finance Review</option>
              <option value="EAC">EAC Review</option>
              <option value="PIC">PIC Review</option>
              <option value="Gate">Gate Review</option>
              <option value="Security">Security Review</option>
            </select>
            <button
              type="button"
              onClick={() => state.reload()}
              title="Refresh"
              style={{ ...inputStyle, width: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#94A3B8' }}
            >
              <Icon name="refresh" size={20} />
            </button>
          </div>
        </div>

        <div
          style={{
            background: 'rgba(255,255,255,0.05)',
            backdropFilter: 'blur(12px)',
            borderRadius: 16,
            border: '1px solid rgba(255,255,255,0.1)',
            overflow: 'hidden',
            boxShadow: '0 20px 40px -10px rgba(0,0,0,0.5)'
          }}
        >
          <div
            style={{
              padding: '20px 24px',
              borderBottom: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(15,23,42,0.4)',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
          >
            <h3 style={{ margin: 0, fontWeight: 700, color: 'white', fontSize: 18 }}>Task Queue</h3>
            <span
              style={{
                background: 'rgba(79,70,229,0.2)',
                color: '#A5B4FC',
                border: '1px solid rgba(79,70,229,0.3)',
                fontSize: 12,
                padding: '2px 8px',
                borderRadius: 9999,
                fontWeight: 700
              }}
            >
              {filtered.length} tasks
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(15,23,42,0.6)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  {['Project', 'Required Action', 'Priority', 'Date', ''].map((c, i) => (
                    <th
                      key={c || i}
                      style={{ padding: '16px 24px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#cbd5e1' }}
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {state.status === 'loading' || state.status === 'idle' ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '64px 24px', textAlign: 'center', color: '#94A3B8', fontWeight: 600 }}>
                      Loading tasks…
                    </td>
                  </tr>
                ) : filtered.length > 0 ? (
                  filtered.map((task) => (
                    <tr
                      key={`${task.kind}-${task.id}`}
                      onClick={() => task.projectId && navigate(`/team-inbox/${task.projectId}/workspace`)}
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: task.projectId ? 'pointer' : 'default' }}
                    >
                      <td style={{ padding: '16px 24px', fontWeight: 600, color: '#e2e8f0' }}>{task.label}</td>
                      <td style={{ padding: '16px 24px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: 6,
                              borderRadius: 6,
                              background: 'rgba(30,41,59,1)',
                              color: '#94A3B8',
                              border: '1px solid rgba(255,255,255,0.05)'
                            }}
                          >
                            <Icon name={iconForAction(task.action)} size={16} />
                          </span>
                          <span style={{ fontWeight: 600, color: '#cbd5e1' }}>{task.action}</span>
                        </span>
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        {task.priority ? (
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              padding: '4px 10px',
                              borderRadius: 6,
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em',
                              ...priorityStyle(task.priority)
                            }}
                          >
                            {task.priority}
                          </span>
                        ) : (
                          <span style={{ color: '#64748B' }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: '16px 24px', color: '#94A3B8', fontSize: 12, fontWeight: 500 }}>{task.date}</td>
                      <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                        <span
                          style={{
                            background: 'rgba(30,41,59,0.7)',
                            color: '#e2e8f0',
                            border: '1px solid rgba(255,255,255,0.1)',
                            padding: '8px 16px',
                            borderRadius: 8,
                            fontSize: 12,
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4
                          }}
                        >
                          <Icon name="play_arrow" size={16} /> Open Workspace
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} style={{ padding: '48px 24px' }}>
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          padding: '48px 16px',
                          textAlign: 'center',
                          background: 'rgba(15,23,42,0.3)',
                          borderRadius: 16,
                          border: '2px dashed rgba(255,255,255,0.1)'
                        }}
                      >
                        <div
                          style={{
                            width: 80,
                            height: 80,
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: 20,
                            background: search || actionFilter ? 'rgba(30,41,59,0.8)' : 'rgba(16,185,129,0.1)',
                            border: `1px solid ${search || actionFilter ? 'rgba(255,255,255,0.1)' : 'rgba(16,185,129,0.2)'}`
                          }}
                        >
                          <Icon
                            name={search || actionFilter ? 'search_off' : 'task_alt'}
                            size={40}
                            style={{ color: search || actionFilter ? '#64748b' : '#34d399' }}
                          />
                        </div>
                        <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'white' }}>
                          {search || actionFilter ? 'No matching tasks found' : "You're all caught up!"}
                        </h3>
                        <p style={{ margin: '8px 0 0', fontSize: 14, color: '#94A3B8', maxWidth: 360 }}>
                          {search || actionFilter
                            ? "No pending reviews match your current search or filter."
                            : `There are currently no pending tasks requiring action from ${teamName}.`}
                        </p>
                        {(search || actionFilter) && (
                          <button
                            type="button"
                            onClick={() => {
                              setSearch('');
                              setActionFilter('');
                            }}
                            style={{
                              marginTop: 24,
                              border: '1px solid rgba(255,255,255,0.1)',
                              color: '#cbd5e1',
                              background: 'rgba(30,41,59,0.5)',
                              padding: '10px 24px',
                              borderRadius: 8,
                              fontSize: 13,
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 8
                            }}
                          >
                            <Icon name="filter_alt_off" size={18} /> Clear all filters
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
