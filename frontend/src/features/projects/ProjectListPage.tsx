import { useEffect, useState } from "react";
import { Link } from "react-router";
import { projectsApi } from "../../lib/api";
import type { Project } from "../../lib/types";

export function ProjectListPage() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    projectsApi
      .list({ page_size: 100 })
      .then((res) => setProjects(res.items))
      .catch((e) => setError(e.message));
  }, []);

  const filtered = projects?.filter(
    (p) =>
      (!search || p.project_name.toLowerCase().includes(search.toLowerCase()) || p.project_number.toLowerCase().includes(search.toLowerCase())) &&
      (!statusFilter || p.status === statusFilter) &&
      (!priorityFilter || p.priority === priorityFilter)
  );

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("");
    setPriorityFilter("");
  };

  const getPriorityStyle = (p: string) => {
    switch (p?.toLowerCase()) {
      case 'critical': return { bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.3)', color: '#FCA5A5' };
      case 'high':     return { bg: 'rgba(249,115,22,0.15)', border: 'rgba(249,115,22,0.3)', color: '#FDBA74' };
      case 'medium':   return { bg: 'rgba(79,70,229,0.2)',  border: 'rgba(79,70,229,0.35)', color: '#A5B4FC' };
      case 'low':      return { bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.3)', color: '#6EE7B7' };
      default:         return { bg: 'rgba(100,116,139,0.15)', border: 'rgba(100,116,139,0.3)', color: '#94A3B8' };
    }
  };

  const getStageStyle = (stage: string) => {
    const s = stage?.toLowerCase() || '';
    if (s.includes('epmo'))    return { bg: 'rgba(124,58,237,0.2)', border: 'rgba(124,58,237,0.4)', color: '#C4B5FD' };
    if (s.includes('bta'))     return { bg: 'rgba(6,182,212,0.15)',  border: 'rgba(6,182,212,0.35)', color: '#67E8F9'  };
    if (s.includes('finance')) return { bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.3)', color: '#6EE7B7' };
    if (s.includes('eac'))     return { bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.3)', color: '#FCD34D' };
    if (s.includes('pic'))     return { bg: 'rgba(236,72,153,0.15)', border: 'rgba(236,72,153,0.3)', color: '#F9A8D4' };
    return { bg: 'rgba(79,70,229,0.12)', border: 'rgba(79,70,229,0.25)', color: '#818CF8' };
  };

  return (
    <div
      className="animate-fade-in min-h-screen font-sans relative overflow-hidden"
      style={{ background: "#0f172a", color: "#f8fafc" }}
    >
      {/* Background gradient */}
      <div className="absolute inset-0 z-0 pointer-events-none" style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)" }} />
      <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full pointer-events-none z-0" style={{ background: "radial-gradient(circle, rgba(79,70,229,0.08) 0%, transparent 70%)", filter: "blur(60px)" }} />
      <div className="absolute bottom-0 right-1/4 w-80 h-80 rounded-full pointer-events-none z-0" style={{ background: "radial-gradient(circle, rgba(124,58,237,0.06) 0%, transparent 70%)", filter: "blur(60px)" }} />

      <div className="relative z-10 p-6 lg:p-8 max-w-[1800px] mx-auto">

        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-8">
          <div>
            {/* Decorative accent */}
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1 h-8 rounded-full" style={{ background: "linear-gradient(180deg, #4F46E5, #7C3AED)" }} />
              <span className="text-[10px] font-bold tracking-widest uppercase text-indigo-400">PROJECT GOVERNANCE PORTAL</span>
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">All Projects</h1>
            <p className="text-sm font-medium mt-1" style={{ color: "#64748B" }}>
              <span className="font-bold" style={{ color: "#818CF8" }}>{filtered?.length ?? 0}</span>
              <span className="mx-1">of</span>
              <span className="font-bold text-slate-400">{projects?.length ?? 0}</span>
              <span className="ml-1">projects</span>
            </p>
          </div>
          <div className="flex gap-3">
            <button
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#94A3B8" }}
            >
              <span className="material-icons text-[18px]">download</span> Export
            </button>
            <Link
              to="/intake"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all"
              style={{ background: "linear-gradient(135deg, #4F46E5, #7C3AED)", boxShadow: "0 4px 16px rgba(79,70,229,0.4)" }}
            >
              <span className="material-icons text-[18px]">add</span> New Proposal
            </Link>
          </div>
        </div>

        {/* ── Filter Bar ── */}
        <div
          className="rounded-2xl p-4 mb-6 flex flex-wrap gap-3 items-center"
          style={{ background: "rgba(30,41,59,0.5)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <div className="relative flex-1 min-w-[220px]">
            <span className="material-icons absolute left-3 top-2.5 text-[18px]" style={{ color: "#64748B" }}>search</span>
            <input
              type="text"
              placeholder="Search by name or number..."
              className="w-full pl-10 pr-4 py-2 rounded-lg text-sm outline-none transition-all"
              style={{ background: "rgba(15,23,42,0.6)", border: "1px solid rgba(255,255,255,0.08)", color: "#F8FAFC" }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="rounded-lg py-2 px-3 text-sm outline-none transition-all"
            style={{ background: "rgba(15,23,42,0.6)", border: "1px solid rgba(255,255,255,0.08)", color: "#CBD5E1", width: 150 }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
            <option value="on_hold">On Hold</option>
          </select>
          <select
            className="rounded-lg py-2 px-3 text-sm outline-none transition-all"
            style={{ background: "rgba(15,23,42,0.6)", border: "1px solid rgba(255,255,255,0.08)", color: "#CBD5E1", width: 150 }}
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
          >
            <option value="">All Priority</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <button
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-all"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#64748B" }}
            onClick={clearFilters}
          >
            <span className="material-icons text-[18px]">filter_alt_off</span> Clear
          </button>
        </div>

        {/* ── State Feedback ── */}
        {error && (
          <div className="p-4 rounded-xl mb-4 flex items-center gap-3" style={{ background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.25)", color: "#FCA5A5" }}>
            <span className="material-icons">error_outline</span> Failed to load projects: {error}
          </div>
        )}
        {!projects && !error && (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #4F46E5, #7C3AED)" }}>
                <span className="material-icons text-white animate-spin">autorenew</span>
              </div>
              <p className="text-sm font-semibold text-slate-400">Loading projects...</p>
            </div>
          </div>
        )}

        {/* ── Table ── */}
        {filtered && (
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: "rgba(30,41,59,0.5)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(15,23,42,0.4)" }}>
                    {["Project Number", "Project Name", "Department", "Manager", "Budget", "Current Stage", "Pending With", "Priority", "Progress", "Status", "Actions"].map(col => (
                      <th key={col} className="px-5 py-4 text-[10px] font-bold uppercase tracking-widest" style={{ color: "#475569" }}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p, idx) => {
                    const progress = p.status === 'completed' ? 100 : (p.status === 'active' ? 45 : 10);
                    const progressGrad = progress < 30 ? 'linear-gradient(90deg,#EF4444,#DC2626)' : progress < 70 ? 'linear-gradient(90deg,#4F46E5,#7C3AED)' : 'linear-gradient(90deg,#059669,#047857)';
                    const pStyle = getPriorityStyle(p.priority);
                    const stStyle = getStageStyle(p.current_stage || '');

                    return (
                      <tr
                        key={p.id}
                        className="group transition-all duration-150"
                        style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "rgba(79,70,229,0.05)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                      >
                        <td className="px-5 py-4">
                          <span className="font-mono text-xs font-bold" style={{ color: "#818CF8" }}>{p.project_number}</span>
                        </td>
                        <td className="px-5 py-4 max-w-[240px]">
                          <Link
                            to={`/projects/${p.id}`}
                            className="font-bold text-sm leading-snug transition-colors block truncate"
                            style={{ color: "#E2E8F0" }}
                            onMouseEnter={e => (e.currentTarget.style.color = "#818CF8")}
                            onMouseLeave={e => (e.currentTarget.style.color = "#E2E8F0")}
                            title={p.project_name}
                          >
                            {p.project_name}
                          </Link>
                        </td>
                        <td className="px-5 py-4 text-sm" style={{ color: "#94A3B8" }}>{p.business_unit || '—'}</td>
                        <td className="px-5 py-4 text-sm" style={{ color: "#94A3B8" }}>{p.project_manager?.full_name || 'Unassigned'}</td>
                        <td className="px-5 py-4 text-sm font-semibold" style={{ color: "#6EE7B7" }}>
                          {p.budget_estimated ? `$${p.budget_estimated.toLocaleString()}` : <span style={{ color: "#334155" }}>—</span>}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold"
                            style={{ background: stStyle.bg, border: `1px solid ${stStyle.border}`, color: stStyle.color }}
                          >
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: stStyle.color }} />
                            {p.current_stage || 'Intake'}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-xs font-semibold uppercase tracking-wide" style={{ color: "#64748B" }}>
                          {p.current_owner_role || '—'}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold capitalize"
                            style={{ background: pStyle.bg, border: `1px solid ${pStyle.border}`, color: pStyle.color }}
                          >
                            {p.priority}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="w-28">
                            <div className="flex justify-between text-[10px] font-bold mb-1.5">
                              <span style={{ color: "#64748B" }}>Progress</span>
                              <span style={{ color: "#E2E8F0" }}>{progress}%</span>
                            </div>
                            <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
                              <div className="h-full rounded-full" style={{ width: `${progress}%`, background: progressGrad }} />
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1.5">
                            <div className={`w-2 h-2 rounded-full`} style={{ background: p.status === 'completed' ? '#10B981' : p.status === 'active' ? '#4F46E5' : '#475569' }} />
                            <span className="text-xs font-semibold capitalize" style={{ color: p.status === 'completed' ? '#6EE7B7' : p.status === 'active' ? '#A5B4FC' : '#64748B' }}>
                              {p.status}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <Link
                              to={`/projects/${p.id}`}
                              className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200"
                              style={{ background: "rgba(79,70,229,0.12)", border: "1px solid rgba(79,70,229,0.25)", color: "#818CF8" }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#4F46E5"; (e.currentTarget as HTMLElement).style.color = "white"; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(79,70,229,0.12)"; (e.currentTarget as HTMLElement).style.color = "#818CF8"; }}
                              title="View Project (My Requests)"
                            >
                              <span className="material-icons text-[16px]">visibility</span>
                            </Link>
                            {['active', 'pending', 'in_delivery'].includes(p.status.toLowerCase()) && (
                              <Link
                                to={`/projects/${p.id}/workspace`}
                                className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200"
                                style={{ background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.25)", color: "#67E8F9" }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#0891B2"; (e.currentTarget as HTMLElement).style.color = "white"; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(6,182,212,0.1)"; (e.currentTarget as HTMLElement).style.color = "#67E8F9"; }}
                                title="Open Workspace"
                              >
                                <span className="material-icons text-[16px]">open_in_new</span>
                              </Link>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={11}>
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: "rgba(79,70,229,0.1)", border: "1px solid rgba(79,70,229,0.2)" }}>
                            <span className="material-icons text-3xl" style={{ color: "#4F46E5" }}>folder_open</span>
                          </div>
                          <h3 className="text-lg font-bold text-slate-300">No projects found</h3>
                          <p className="text-sm mt-1 text-slate-500">Try adjusting your search or filters</p>
                          <button
                            className="mt-4 text-sm font-bold px-4 py-2 rounded-lg transition-all"
                            style={{ background: "rgba(79,70,229,0.15)", color: "#818CF8", border: "1px solid rgba(79,70,229,0.25)" }}
                            onClick={clearFilters}
                          >
                            Clear all filters
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer Bar */}
            {filtered.length > 0 && (
              <div className="px-5 py-3.5 flex items-center justify-between" style={{ borderTop: "1px solid rgba(255,255,255,0.06)", background: "rgba(15,23,42,0.3)" }}>
                <span className="text-xs font-medium" style={{ color: "#475569" }}>
                  Showing <span className="font-bold text-indigo-400">{filtered.length}</span> projects
                </span>
                <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "#475569" }}>
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#4F46E5" }} />
                  Live Data
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
