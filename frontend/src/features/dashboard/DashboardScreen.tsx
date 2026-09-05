import { Link, useNavigate } from 'react-router';
import { Icon } from '@ui-kit';
import { useApp, useAsync } from '../../app/providers';
import { entityByType } from '../../lib/entities';
import type { AppfwClient, AppfwRecord } from '../../lib/appfwClient';
import { humanizeEnum } from '../../components/ui';

/**
 * Executive dashboard. Dark "portfolio analytics" presentation mirrors the
 * Dev-branch dashboard (KPI row, portfolio status table, my-tasks column,
 * risk summary, meetings). There is no aggregate endpoint on this branch — the
 * figures are composed from App Framework entity queries.
 */

const projectEntity = entityByType('Project');
const approvalEntity = entityByType('ProjectApproval');
const meetingEntity = entityByType('Meeting');

async function countWhere(client: AppfwClient, filter: unknown): Promise<number> {
  const result = await client.queryList(projectEntity, { filter, limit: 1, selection: ['id'] });
  return result.page.queryCount;
}

async function loadDashboard(client: AppfwClient, roles: readonly string[]) {
  const [total, active, completed, onHold, highRisk, recent, approvals, meetings] = await Promise.all([
    countWhere(client, undefined),
    countWhere(client, { status: { _eq: 'ACTIVE' } }),
    countWhere(client, { status: { _eq: 'COMPLETED' } }),
    countWhere(client, { status: { _eq: 'ON_HOLD' } }),
    countWhere(client, { risk_level: { _in: ['HIGH', 'VERY_HIGH'] } }).catch(() => 0),
    client.queryList(projectEntity, {
      limit: 6,
      sort: { created_at: 'desc' },
      selection: ['id', 'project_number', 'project_name', 'business_unit', 'status', 'priority', 'current_stage']
    }),
    roles.length
      ? client
          .queryList(approvalEntity, {
            limit: 5,
            filter: {
              _and: [
                { status: { _eq: 'PENDING' } },
                { assigned_role: { _in: roles.map((r) => r.toUpperCase()) } }
              ]
            },
            sort: { created_at: 'asc' },
            selection: ['id', 'approval_stage', 'assigned_role', 'created_at', 'project_id']
          })
          .catch(() => ({ rows: [] as AppfwRecord[] }))
      : Promise.resolve({ rows: [] as AppfwRecord[] }),
    client
      .queryList(meetingEntity, {
        limit: 3,
        sort: { created_at: 'desc' },
        selection: ['id', 'subject', 'meeting_type', 'status', 'created_at']
      })
      .catch(() => ({ rows: [] as AppfwRecord[] }))
  ]);

  return {
    kpis: { total, active, completed, onHold, highRisk },
    recent: recent.rows,
    approvals: approvals.rows,
    meetings: meetings.rows
  };
}

const cardStyle = {
  background: '#1e293b',
  borderRadius: 16,
  border: '1px solid rgba(255,255,255,0.1)'
} as const;

export function DashboardScreen() {
  const navigate = useNavigate();
  const { auth } = useApp();
  const state = useAsync((client) => loadDashboard(client, auth.roles), [auth.roles.join(',')]);

  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  if (state.status === 'error') {
    return (
      <div style={{ padding: 24, color: '#FCA5A5' }}>
        Failed to load dashboard: {state.error?.message}
      </div>
    );
  }
  if (state.status !== 'ready' || !state.data) {
    return <div style={{ padding: 24, color: '#94A3B8' }}>Loading dashboard…</div>;
  }
  const data = state.data;

  const kpis = [
    { label: 'Active Projects', value: data.kpis.active, icon: 'assignment', color: '#60A5FA', bg: 'rgba(59,130,246,0.2)' },
    { label: 'Completed', value: data.kpis.completed, icon: 'check_circle', color: '#34D399', bg: 'rgba(16,185,129,0.2)' },
    { label: 'On Hold', value: data.kpis.onHold, icon: 'pause_circle', color: '#FB923C', bg: 'rgba(249,115,22,0.2)' },
    { label: 'High Risk', value: data.kpis.highRisk, icon: 'warning', color: '#F87171', bg: 'rgba(239,68,68,0.2)' }
  ];

  return (
    <div className="animate-fade-in" style={{ padding: 24, minHeight: '100%', background: '#0f172a', color: '#f8fafc' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: 'white', letterSpacing: '-0.02em' }}>Executive Dashboard</h1>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="fiber_manual_record" size={12} style={{ color: '#34D399' }} />
            Live portfolio analytics — {today}
          </p>
        </div>
        <Link
          to="/intake"
          style={{
            background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
            color: 'white',
            boxShadow: '0 8px 24px rgba(79,70,229,0.35)',
            padding: '10px 20px',
            borderRadius: 10,
            fontWeight: 700,
            fontSize: 14,
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}
        >
          <Icon name="add" size={18} /> New Proposal
        </Link>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 24, marginBottom: 32 }}>
        {kpis.map((kpi) => (
          <div key={kpi.label} style={{ ...cardStyle, padding: 24, position: 'relative', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 600, color: '#94A3B8' }}>{kpi.label}</p>
                <h3 style={{ margin: 0, fontSize: 36, fontWeight: 800, color: 'white' }}>{kpi.value}</h3>
              </div>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: kpi.color,
                  background: kpi.bg
                }}
              >
                <Icon name={kpi.icon} size={26} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: 32, alignItems: 'start' }}>
        {/* Left: portfolio status */}
        <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              padding: '20px 24px',
              borderBottom: '1px solid rgba(255,255,255,0.1)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'rgba(255,255,255,0.05)',
              borderRadius: '16px 16px 0 0'
            }}
          >
            <h3 style={{ margin: 0, fontWeight: 700, color: 'white', fontSize: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="view_timeline" size={20} style={{ color: '#818CF8' }} /> Portfolio Status
            </h3>
            <Link to="/projects" style={{ fontSize: 13, fontWeight: 600, color: '#60A5FA', textDecoration: 'none' }}>
              View All
            </Link>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94A3B8', fontWeight: 700 }}>
                  <th style={{ padding: '16px 24px' }}>Initiative</th>
                  <th style={{ padding: '16px 24px' }}>Priority</th>
                  <th style={{ padding: '16px 24px' }}>Workflow Stage</th>
                </tr>
              </thead>
              <tbody>
                {data.recent.length > 0 ? (
                  data.recent.map((p) => (
                    <tr key={String(p.id)} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <td style={{ padding: '16px 24px' }}>
                        <Link
                          to={`/projects/${String(p.id)}`}
                          style={{ fontWeight: 700, color: 'white', textDecoration: 'none', display: 'block' }}
                        >
                          {String(p.project_name ?? '—')}
                        </Link>
                        <span style={{ fontSize: 12, color: '#94A3B8' }}>{String(p.business_unit ?? 'Enterprise')}</span>
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            padding: '4px 10px',
                            borderRadius: 9999,
                            fontSize: 12,
                            fontWeight: 700,
                            border: '1px solid rgba(255,255,255,0.1)',
                            background: 'rgba(255,255,255,0.05)',
                            color: '#e2e8f0'
                          }}
                        >
                          {humanizeEnum(p.priority)}
                        </span>
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              background: String(p.status) === 'COMPLETED' ? '#10B981' : '#3B82F6'
                            }}
                          />
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: '#e2e8f0',
                              background: 'rgba(255,255,255,0.05)',
                              border: '1px solid rgba(255,255,255,0.1)',
                              padding: '2px 8px',
                              borderRadius: 4
                            }}
                          >
                            {p.current_stage ? humanizeEnum(p.current_stage) : 'Intake'}
                          </span>
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} style={{ padding: 24, textAlign: 'center', color: '#64748B' }}>
                      No projects yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: 'grid', gap: 32 }}>
          <div style={cardStyle}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', borderRadius: '16px 16px 0 0' }}>
              <h3 style={{ margin: 0, fontWeight: 700, color: 'white', fontSize: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="pending_actions" size={20} style={{ color: '#FB923C' }} /> My Tasks &amp; Reviews
              </h3>
            </div>
            <div style={{ padding: 16, display: 'grid', gap: 12 }}>
              {data.approvals.length > 0 ? (
                data.approvals.map((row) => (
                  <Link
                    key={String(row.id)}
                    to={row.project_id ? `/team-inbox/${String(row.project_id)}/workspace` : '/team-inbox'}
                    style={{
                      display: 'block',
                      padding: 16,
                      borderRadius: 12,
                      border: '1px solid rgba(255,255,255,0.1)',
                      background: '#1e293b',
                      textDecoration: 'none'
                    }}
                  >
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        color: '#93C5FD',
                        background: 'rgba(59,130,246,0.2)',
                        border: '1px solid rgba(59,130,246,0.2)',
                        padding: '2px 8px',
                        borderRadius: 4
                      }}
                    >
                      {row.assigned_role ? humanizeEnum(row.assigned_role) : 'Review'}
                    </span>
                    <h4 style={{ margin: '8px 0 2px', fontSize: 14, fontWeight: 600, color: 'white' }}>
                      {row.approval_stage ? humanizeEnum(row.approval_stage) : 'Approval'}
                    </h4>
                  </Link>
                ))
              ) : (
                <div style={{ fontSize: 14, color: '#64748B', textAlign: 'center', padding: 16 }}>
                  You&apos;re all caught up!
                </div>
              )}
            </div>
          </div>

          <div style={cardStyle}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', borderRadius: '16px 16px 0 0' }}>
              <h3 style={{ margin: 0, fontWeight: 700, color: 'white', fontSize: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="gpp_maybe" size={20} style={{ color: '#F87171' }} /> Risk Summary
              </h3>
            </div>
            <div style={{ padding: 24, display: 'grid', gap: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 14, fontWeight: 600, color: '#cbd5e1' }}>
                  <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#EF4444' }} /> High / very-high risk
                </span>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'white', background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: 4 }}>
                  {data.kpis.highRisk}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 14, fontWeight: 600, color: '#cbd5e1' }}>
                  <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#FBBF24' }} /> Total portfolio
                </span>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'white', background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: 4 }}>
                  {data.kpis.total}
                </span>
              </div>
            </div>
          </div>

          <div style={cardStyle}>
            <div
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid rgba(255,255,255,0.1)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <h3 style={{ margin: 0, fontWeight: 700, color: 'white', fontSize: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="groups" size={20} style={{ color: '#818CF8' }} /> Meetings
              </h3>
              <Link to="/meeting-center" style={{ fontSize: 12, fontWeight: 600, color: '#60A5FA', textDecoration: 'none' }}>
                View All
              </Link>
            </div>
            <div style={{ padding: 16, display: 'grid', gap: 12 }}>
              {data.meetings.length > 0 ? (
                data.meetings.map((m) => (
                  <Link
                    key={String(m.id)}
                    to={`/meeting-center/${String(m.id)}`}
                    style={{
                      padding: 12,
                      border: '1px solid rgba(255,255,255,0.1)',
                      background: 'rgba(30,41,59,0.5)',
                      borderRadius: 10,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      textDecoration: 'none'
                    }}
                  >
                    <span
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'rgba(79,70,229,0.2)',
                        color: '#A5B4FC',
                        border: '1px solid rgba(79,70,229,0.2)'
                      }}
                    >
                      <Icon name="event" size={18} />
                    </span>
                    <span>
                      <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'white' }}>{String(m.subject ?? 'Meeting')}</h4>
                      <p style={{ margin: '2px 0 0', fontSize: 12, color: '#94A3B8' }}>
                        {m.meeting_type ? humanizeEnum(m.meeting_type) : humanizeEnum(m.status)}
                      </p>
                    </span>
                  </Link>
                ))
              ) : (
                <div style={{ fontSize: 14, color: '#64748B', textAlign: 'center', padding: 16 }}>No meetings scheduled</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
