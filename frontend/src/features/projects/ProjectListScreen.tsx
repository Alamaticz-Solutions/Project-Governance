import { useMemo, useState, type CSSProperties } from 'react';
import { Link } from 'react-router';
import { Icon } from '@ui-kit';
import { useAsync } from '../../app/providers';
import { entityByType } from '../../lib/entities';
import type { AppfwRecord } from '../../lib/appfwClient';
import { canonicalEnumKey, humanizeEnum, toEnumFilterValue } from '../../components/ui';

/**
 * Portfolio list. Dark "command console" presentation mirrors the Dev-branch
 * All Projects screen (gradient canvas, glass filter bar, wide status table).
 * Rows come from the App Framework Project connection with server-side
 * filtering; progress is a status-derived indicator, as on Dev.
 */

const projectEntity = entityByType('Project');

type Row = AppfwRecord & { id: string };

function toneForPriority(p: string) {
  switch (p.toLowerCase()) {
    case 'critical':
      return { bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.3)', color: '#FCA5A5' };
    case 'high':
      return { bg: 'rgba(249,115,22,0.15)', border: 'rgba(249,115,22,0.3)', color: '#FDBA74' };
    case 'medium':
      return { bg: 'rgba(79,70,229,0.2)', border: 'rgba(79,70,229,0.35)', color: '#A5B4FC' };
    case 'low':
      return { bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.3)', color: '#6EE7B7' };
    default:
      return { bg: 'rgba(100,116,139,0.15)', border: 'rgba(100,116,139,0.3)', color: '#94A3B8' };
  }
}

function toneForStage(stage: string) {
  const s = stage.toLowerCase();
  if (s.includes('epmo')) return { bg: 'rgba(124,58,237,0.2)', border: 'rgba(124,58,237,0.4)', color: '#C4B5FD' };
  if (s.includes('bta')) return { bg: 'rgba(6,182,212,0.15)', border: 'rgba(6,182,212,0.35)', color: '#67E8F9' };
  if (s.includes('finance')) return { bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.3)', color: '#6EE7B7' };
  if (s.includes('eac')) return { bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.3)', color: '#FCD34D' };
  if (s.includes('pic')) return { bg: 'rgba(236,72,153,0.15)', border: 'rgba(236,72,153,0.3)', color: '#F9A8D4' };
  return { bg: 'rgba(79,70,229,0.12)', border: 'rgba(79,70,229,0.25)', color: '#818CF8' };
}

function progressFor(status: string): number {
  const s = status.toLowerCase();
  if (s === 'completed') return 100;
  if (s === 'active' || s === 'in_delivery') return 45;
  return 10;
}

const darkSelectStyle: CSSProperties = {
  borderRadius: 8,
  padding: '8px 12px',
  fontSize: 13,
  outline: 'none',
  background: 'rgba(15,23,42,0.6)',
  border: '1px solid rgba(255,255,255,0.08)',
  color: '#CBD5E1',
  width: 150
};

const COLUMNS = [
  'Project Number',
  'Project Name',
  'Business Unit',
  'Budget',
  'Current Stage',
  'Pending With',
  'Priority',
  'Progress',
  'Status',
  ''
];

export function ProjectListScreen() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');

  const filter = useMemo(() => {
    const clauses: unknown[] = [];
    if (status) clauses.push({ status: { _eq: toEnumFilterValue(status) } });
    if (priority) clauses.push({ priority: { _eq: toEnumFilterValue(priority) } });
    if (search.trim()) {
      clauses.push({
        _or: [
          { project_name: { _ilike: `%${search.trim()}%` } },
          { project_number: { _ilike: `%${search.trim()}%` } }
        ]
      });
    }
    return clauses.length ? { _and: clauses } : undefined;
  }, [status, priority, search]);

  const state = useAsync(
    (client) =>
      client.queryList(projectEntity, {
        limit: 200,
        filter,
        sort: { created_at: 'desc' },
        selection: [
          'id',
          'project_number',
          'project_name',
          'business_unit',
          'priority',
          'status',
          'current_stage',
          'current_owner_role',
          'budget_estimated'
        ]
      }),
    [filter]
  );

  const rows = (state.data?.rows ?? []) as Row[];
  const total = state.data?.page.queryCount ?? rows.length;

  const clearFilters = () => {
    setSearch('');
    setStatus('');
    setPriority('');
  };

  return (
    <div
      className="animate-fade-in"
      style={{ minHeight: '100%', position: 'relative', overflow: 'hidden', background: '#0f172a', color: '#f8fafc' }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)'
        }}
      />
      <div style={{ position: 'relative', zIndex: 10, padding: 32, maxWidth: 1800, margin: '0 auto' }}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 32,
            flexWrap: 'wrap',
            gap: 16
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ width: 4, height: 32, borderRadius: 9999, background: 'linear-gradient(180deg, #4F46E5, #7C3AED)' }} />
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#818CF8' }}>
                Project Governance Portal
              </span>
            </div>
            <h1 style={{ margin: 0, fontSize: 30, fontWeight: 800, color: 'white', letterSpacing: '-0.02em' }}>All Projects</h1>
            <p style={{ margin: '4px 0 0', fontSize: 14, color: '#64748B' }}>
              <strong style={{ color: '#818CF8' }}>{rows.length}</strong>
              <span style={{ margin: '0 4px' }}>of</span>
              <strong style={{ color: '#94A3B8' }}>{total}</strong> projects
            </p>
          </div>
          <Link
            to="/intake"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 20px',
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 700,
              color: 'white',
              textDecoration: 'none',
              background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
              boxShadow: '0 4px 16px rgba(79,70,229,0.4)'
            }}
          >
            <Icon name="add" size={18} /> New Proposal
          </Link>
        </div>

        {/* Filter bar */}
        <div
          style={{
            borderRadius: 16,
            padding: 16,
            marginBottom: 24,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            alignItems: 'center',
            background: 'rgba(30,41,59,0.5)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.08)'
          }}
        >
          <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
            <Icon name="search" size={18} style={{ position: 'absolute', left: 12, top: 10, color: '#64748B' }} />
            <input
              type="text"
              placeholder="Search by name or number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                paddingLeft: 38,
                paddingRight: 16,
                paddingTop: 8,
                paddingBottom: 8,
                borderRadius: 8,
                fontSize: 13,
                outline: 'none',
                background: 'rgba(15,23,42,0.6)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: '#F8FAFC'
              }}
            />
          </div>
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={darkSelectStyle} aria-label="Filter by status">
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="pending_approval">Pending Approval</option>
            <option value="in_delivery">In Delivery</option>
            <option value="completed">Completed</option>
            <option value="on_hold">On Hold</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select value={priority} onChange={(e) => setPriority(e.target.value)} style={darkSelectStyle} aria-label="Filter by priority">
            <option value="">All Priority</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <button
            type="button"
            onClick={clearFilters}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#64748B'
            }}
          >
            <Icon name="filter_alt_off" size={18} /> Clear
          </button>
        </div>

        {/* Feedback */}
        {state.status === 'error' && (
          <div
            style={{
              padding: 16,
              borderRadius: 12,
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              background: 'rgba(220,38,38,0.1)',
              border: '1px solid rgba(220,38,38,0.25)',
              color: '#FCA5A5'
            }}
          >
            <Icon name="error_outline" size={20} /> Failed to load projects: {state.error?.message}
          </div>
        )}
        {(state.status === 'loading' || state.status === 'idle') && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0', color: '#64748B', fontSize: 14, fontWeight: 600 }}>
            Loading projects…
          </div>
        )}

        {/* Table */}
        {state.status === 'ready' && (
          <div
            style={{
              borderRadius: 16,
              overflow: 'hidden',
              background: 'rgba(30,41,59,0.5)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.08)'
            }}
          >
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', whiteSpace: 'nowrap' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(15,23,42,0.4)' }}>
                    {COLUMNS.map((col, i) => (
                      <th
                        key={col || i}
                        style={{ padding: '16px 20px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#475569' }}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => {
                    // Reads come back PascalCase (async-graphql rename); normalise
                    // to the model's SCREAMING_SNAKE before comparing.
                    const st = canonicalEnumKey(String(p.status ?? ''));
                    const stage = String(p.current_stage ?? '');
                    const progress = progressFor(st);
                    const pTone = toneForPriority(String(p.priority ?? ''));
                    const sTone = toneForStage(stage);
                    const budget = typeof p.budget_estimated === 'number' ? p.budget_estimated : null;
                    return (
                      <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '16px 20px' }}>
                          <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: '#818CF8' }}>
                            {String(p.project_number ?? '—')}
                          </span>
                        </td>
                        <td style={{ padding: '16px 20px', maxWidth: 240 }}>
                          <Link
                            to={`/projects/${p.id}`}
                            style={{ fontWeight: 700, fontSize: 14, color: '#E2E8F0', textDecoration: 'none', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}
                            title={String(p.project_name ?? '')}
                          >
                            {String(p.project_name ?? '—')}
                          </Link>
                        </td>
                        <td style={{ padding: '16px 20px', fontSize: 14, color: '#94A3B8' }}>{String(p.business_unit ?? '—')}</td>
                        <td style={{ padding: '16px 20px', fontSize: 14, fontWeight: 600, color: budget ? '#6EE7B7' : '#334155' }}>
                          {budget ? `$${budget.toLocaleString()}` : '—'}
                        </td>
                        <td style={{ padding: '16px 20px' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              padding: '4px 10px',
                              borderRadius: 9999,
                              fontSize: 10,
                              fontWeight: 700,
                              background: sTone.bg,
                              border: `1px solid ${sTone.border}`,
                              color: sTone.color
                            }}
                          >
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: sTone.color }} />
                            {stage ? humanizeEnum(stage) : 'Intake'}
                          </span>
                        </td>
                        <td style={{ padding: '16px 20px', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748B' }}>
                          {p.current_owner_role ? humanizeEnum(p.current_owner_role) : '—'}
                        </td>
                        <td style={{ padding: '16px 20px' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              padding: '4px 10px',
                              borderRadius: 9999,
                              fontSize: 10,
                              fontWeight: 700,
                              textTransform: 'capitalize',
                              background: pTone.bg,
                              border: `1px solid ${pTone.border}`,
                              color: pTone.color
                            }}
                          >
                            {humanizeEnum(p.priority)}
                          </span>
                        </td>
                        <td style={{ padding: '16px 20px' }}>
                          <div style={{ width: 112 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 700, marginBottom: 6 }}>
                              <span style={{ color: '#64748B' }}>Progress</span>
                              <span style={{ color: '#E2E8F0' }}>{progress}%</span>
                            </div>
                            <div style={{ height: 6, width: '100%', borderRadius: 9999, overflow: 'hidden', background: 'rgba(255,255,255,0.07)' }}>
                              <div
                                style={{
                                  height: '100%',
                                  width: `${progress}%`,
                                  borderRadius: 9999,
                                  background:
                                    progress < 30
                                      ? 'linear-gradient(90deg,#EF4444,#DC2626)'
                                      : progress < 70
                                        ? 'linear-gradient(90deg,#4F46E5,#7C3AED)'
                                        : 'linear-gradient(90deg,#059669,#047857)'
                                }}
                              />
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '16px 20px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <span
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                background: st === 'COMPLETED' ? '#10B981' : st === 'ACTIVE' ? '#4F46E5' : '#475569'
                              }}
                            />
                            <span style={{ fontSize: 12, fontWeight: 600, color: st === 'COMPLETED' ? '#6EE7B7' : st === 'ACTIVE' ? '#A5B4FC' : '#64748B' }}>
                              {humanizeEnum(st)}
                            </span>
                          </span>
                        </td>
                        <td style={{ padding: '16px 20px' }}>
                          <span style={{ display: 'flex', gap: 8 }}>
                            <Link
                              to={`/projects/${p.id}`}
                              title="View project"
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: 8,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: 'rgba(79,70,229,0.12)',
                                border: '1px solid rgba(79,70,229,0.25)',
                                color: '#818CF8'
                              }}
                            >
                              <Icon name="visibility" size={16} />
                            </Link>
                            {['ACTIVE', 'PENDING_APPROVAL', 'IN_DELIVERY'].includes(st) && (
                              <Link
                                to={`/projects/${p.id}/workspace`}
                                title="Open workspace"
                                style={{
                                  width: 32,
                                  height: 32,
                                  borderRadius: 8,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  background: 'rgba(6,182,212,0.1)',
                                  border: '1px solid rgba(6,182,212,0.25)',
                                  color: '#67E8F9'
                                }}
                              >
                                <Icon name="open_in_new" size={16} />
                              </Link>
                            )}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={COLUMNS.length}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '80px 0', textAlign: 'center' }}>
                          <div
                            style={{
                              width: 64,
                              height: 64,
                              borderRadius: 16,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              marginBottom: 16,
                              background: 'rgba(79,70,229,0.1)',
                              border: '1px solid rgba(79,70,229,0.2)'
                            }}
                          >
                            <Icon name="folder_open" size={30} style={{ color: '#4F46E5' }} />
                          </div>
                          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#cbd5e1' }}>No projects found</h3>
                          <p style={{ margin: '4px 0 0', fontSize: 14, color: '#64748b' }}>Try adjusting your search or filters</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {rows.length > 0 && (
              <div
                style={{
                  padding: '14px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderTop: '1px solid rgba(255,255,255,0.06)',
                  background: 'rgba(15,23,42,0.3)'
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 500, color: '#475569' }}>
                  Showing <strong style={{ color: '#818CF8' }}>{rows.length}</strong> projects
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#475569' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4F46E5' }} />
                  Live data
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
