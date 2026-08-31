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

  const getPriorityClasses = (p: string) => {
    switch(p?.toLowerCase()) {
      case 'critical': return 'text-red-700 bg-red-100 border-red-200';
      case 'high': return 'text-orange-700 bg-orange-100 border-orange-200';
      case 'medium': return 'text-blue-700 bg-blue-100 border-blue-200';
      case 'low': return 'text-green-700 bg-green-100 border-green-200';
      default: return 'text-gray-700 bg-gray-100 border-gray-200';
    }
  };

  return (
    <div className="animate-fade-in p-6 bg-enterprise-bg min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>All Projects</h1>
          <p className="text-sm font-medium text-gray-500 mt-1">{filtered?.length || 0} of {projects?.length || 0} projects</p>
        </div>
        <div className="flex gap-3">
          <button className="bg-white border border-gray-300 shadow-sm text-gray-700 px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 hover:bg-gray-50 transition-colors">
            <span className="material-icons text-[18px]">download</span> Export
          </button>
          <Link to="/intake" className="bg-enterprise-primary hover:bg-blue-700 text-white shadow-sm px-5 py-2.5 rounded-lg font-bold text-sm flex items-center gap-2 transition-all">
            <span className="material-icons text-[18px]">add</span> New Proposal
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-enterprise-soft border border-gray-100 mb-6 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <span className="material-icons absolute left-3 top-2.5 text-gray-400">search</span>
          <input
            type="text"
            placeholder="Search projects..."
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="border border-gray-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-blue-500" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ width: 150 }}>
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="pending">Pending</option>
          <option value="completed">Completed</option>
          <option value="on_hold">On Hold</option>
        </select>
        <select className="border border-gray-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-blue-500" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} style={{ width: 150 }}>
          <option value="">All Priority</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <button className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1 transition-colors" onClick={clearFilters}>
          <span className="material-icons text-[18px]">filter_alt_off</span> Clear
        </button>
      </div>

      {/* Table */}
      {error && <div className="p-6 text-red-500">Failed to load projects: {error}</div>}
      {!projects && !error && <div className="p-6">Loading projects…</div>}

      {filtered && (
        <div className="bg-white rounded-xl shadow-enterprise-soft border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-[11px] uppercase tracking-wider text-gray-500 font-bold">
                  <th className="px-5 py-4">Project Number</th>
                  <th className="px-5 py-4">Project Name</th>
                  <th className="px-5 py-4">Department</th>
                  <th className="px-5 py-4">Manager</th>
                  <th className="px-5 py-4">Budget</th>
                  <th className="px-5 py-4">Current Stage</th>
                  <th className="px-5 py-4">Pending With</th>
                  <th className="px-5 py-4">Priority</th>
                  <th className="px-5 py-4">Progress</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(p => {
                  const progress = p.status === 'completed' ? 100 : (p.status === 'active' ? 45 : 10);
                  const progressColor = progress < 30 ? 'bg-red-500' : progress < 70 ? 'bg-blue-500' : 'bg-green-500';
                  
                  return (
                    <tr key={p.id} className="hover:bg-blue-50/30 transition-colors group">
                      <td className="px-5 py-4 font-mono text-xs font-semibold text-gray-600">{p.project_number}</td>
                      <td className="px-5 py-4">
                        <Link to={`/projects/${p.id}`} className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{p.project_name}</Link>
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-600">{p.business_unit || '—'}</td>
                      <td className="px-5 py-4 text-sm text-gray-600">{p.project_manager?.full_name || 'Unassigned'}</td>
                      <td className="px-5 py-4 text-sm text-gray-600 font-medium">{p.budget_estimated ? `$${p.budget_estimated.toLocaleString()}` : '—'}</td>
                      <td className="px-5 py-4">
                        <span className="text-[11px] font-bold text-gray-700 bg-gray-100 px-2.5 py-1 rounded-md border border-gray-200">
                          {p.current_stage || 'Intake'}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-500">{p.current_owner_role || '—'}</td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold border ${getPriorityClasses(p.priority)}`}>
                          {p.priority}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="w-24">
                          <div className="flex justify-between text-[10px] font-bold text-gray-500 mb-1">
                            <span>{progress}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                            <div className={`h-full ${progressColor}`} style={{ width: `${progress}%` }}></div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5">
                          <div className={`w-2 h-2 rounded-full ${p.status === 'completed' ? 'bg-green-500' : p.status === 'active' ? 'bg-blue-500' : 'bg-gray-400'}`}></div>
                          <span className="text-sm font-medium text-gray-700 capitalize">{p.status}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <button className="text-gray-400 hover:text-blue-600 transition-colors p-1" title="More Actions">
                          <span className="material-icons text-[20px]">more_vert</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={11}>
                      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                        <span className="material-icons text-5xl mb-3 opacity-50">folder_open</span>
                        <h3 className="text-lg font-medium text-gray-600">No projects found</h3>
                        <p className="text-sm mt-1">Try adjusting your search or filters</p>
                        <button className="mt-4 text-blue-600 font-medium text-sm hover:underline" onClick={clearFilters}>Clear all filters</button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
