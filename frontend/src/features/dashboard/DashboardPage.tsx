import { useEffect, useState } from "react";
import { Link } from "react-router";
import { dashboardApi, projectsApi } from "../../lib/api";
import type { DashboardResponse, Project } from "../../lib/types";

export function DashboardPage() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      dashboardApi.get(),
      projectsApi.list({ page_size: 10, status: 'active' })
    ])
      .then(([dashData, projData]) => {
        setData(dashData);
        setProjects(projData.items);
      })
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="p-6 text-red-500">Failed to load dashboard: {error}</div>;
  if (!data) return <div className="p-6">Loading dashboard…</div>;

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const kpis = [
    { label: "Active Projects", value: data.active_projects, icon: "assignment", colorCode: "blue", trendUp: true, trendValue: 12, trendText: "vs last month" },
    { label: "Completed", value: data.completed_projects, icon: "check_circle", colorCode: "green", trendUp: true, trendValue: 4, trendText: "vs last month" },
    { label: "On Hold", value: data.on_hold_projects, icon: "pause_circle", colorCode: "orange", trendUp: false, trendValue: 2, trendText: "vs last month" },
    { label: "High Risk", value: data.high_risk_count, icon: "warning", colorCode: "red", trendUp: false, trendValue: 8, trendText: "needs attention" },
  ];

  return (
    <div className="animate-fade-in p-6 bg-enterprise-bg min-h-full">
      {/* Executive Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>Executive Dashboard</h1>
          <p className="text-sm font-medium text-gray-500 mt-1 flex items-center gap-2">
            <span className="material-icons text-sm text-green-500">fiber_manual_record</span>
            Live Portfolio Analytics — {today}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="bg-white border border-gray-200 shadow-sm text-gray-700 px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 hover:bg-gray-50 transition-colors">
            <span className="material-icons text-[18px] text-gray-500">picture_as_pdf</span>
            Executive Summary
          </button>
          <Link to="/intake" className="bg-enterprise-primary hover:bg-blue-700 text-white shadow-lg shadow-blue-500/30 px-5 py-2.5 rounded-lg font-bold text-sm flex items-center gap-2 transition-all hover:-translate-y-0.5">
            <span className="material-icons text-[18px]">add</span>
            New Proposal
          </Link>
        </div>
      </div>

      {/* Governance KPIs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-enterprise-soft hover:shadow-enterprise-hover transition-all duration-300 relative overflow-hidden group">
            <div className={`absolute top-0 right-0 w-24 h-24 bg-${kpi.colorCode}-50 rounded-bl-full opacity-50 group-hover:scale-110 transition-transform`} style={{ background: kpi.colorCode === 'blue' ? '#EFF6FF' : kpi.colorCode === 'green' ? '#F0FDF4' : kpi.colorCode === 'orange' ? '#FFF7ED' : '#FEF2F2' }}></div>
            <div className="flex items-start justify-between relative z-10">
              <div>
                <p className="text-sm font-semibold text-gray-500 mb-1 tracking-wide">{kpi.label}</p>
                <h3 className="text-4xl font-extrabold text-gray-900" style={{ fontFamily: 'var(--font-display)' }}>{kpi.value}</h3>
              </div>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-sm text-${kpi.colorCode}-600`} style={{ background: kpi.colorCode === 'blue' ? '#DBEAFE' : kpi.colorCode === 'green' ? '#DCFCE7' : kpi.colorCode === 'orange' ? '#FFEDD5' : '#FEE2E2', color: kpi.colorCode === 'blue' ? '#2563EB' : kpi.colorCode === 'green' ? '#16A34A' : kpi.colorCode === 'orange' ? '#EA580C' : '#DC2626' }}>
                <span className="material-icons text-[26px]">{kpi.icon}</span>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 relative z-10">
              <span className={`flex items-center text-xs font-bold px-2 py-0.5 rounded-full ${kpi.trendUp ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                <span className="material-icons text-[14px]">{kpi.trendUp ? 'trending_up' : 'trending_down'}</span>
                <span className="ml-1">{kpi.trendValue}%</span>
              </span>
              <span className="text-xs text-gray-400 font-medium">{kpi.trendText}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Center Column (Main Data 2/3 wide) */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* AI Insights Glassmorphism Card */}
          <div className="relative overflow-hidden rounded-2xl p-1 shadow-xl bg-gradient-to-br from-indigo-900 via-enterprise-secondary to-blue-900">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-6 relative z-10 text-white">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/30 flex items-center justify-center">
                  <span className="material-icons text-indigo-200">auto_awesome</span>
                </div>
                <h3 className="font-bold text-lg">AI Governance Insights</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-black/20 rounded-lg p-4 border border-white/5">
                  <p className="text-xs text-indigo-200 font-semibold mb-1 uppercase tracking-wider">Risk Prediction</p>
                  <p className="text-sm font-medium text-white">"Project Overhaul CMDB" shows a 78% likelihood of SLA breach in Gate S due to incomplete vendor documentation.</p>
                </div>
                <div className="bg-black/20 rounded-lg p-4 border border-white/5">
                  <p className="text-xs text-indigo-200 font-semibold mb-1 uppercase tracking-wider">Portfolio Optimization</p>
                  <p className="text-sm font-medium text-white">3 Active Projects overlap in "Cloud Infrastructure". Consider merging them into an Epic for 14% cost efficiency.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Active Requests / Projects Table */}
          <div className="bg-white rounded-2xl shadow-enterprise-soft border border-gray-100 flex flex-col">
            <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 rounded-t-2xl">
              <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                <span className="material-icons text-enterprise-primary">view_timeline</span>
                Portfolio Status
              </h3>
              <Link to="/projects" className="text-sm font-semibold text-enterprise-primary hover:text-blue-700">View All</Link>
            </div>
            <div className="p-0 overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white border-b border-gray-100 text-xs uppercase tracking-wider text-gray-500 font-bold">
                    <th className="px-6 py-4">Initiative</th>
                    <th className="px-6 py-4">Priority</th>
                    <th className="px-6 py-4">Workflow Stage</th>
                    <th className="px-6 py-4">SLA Risk</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {projects.length > 0 ? projects.slice(0,5).map(p => (
                    <tr key={p.id} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <Link to={`/projects/${p.id}`} className="font-bold text-gray-800 group-hover:text-blue-600 transition-colors block">{p.project_name}</Link>
                        <div className="text-xs font-medium text-gray-500">{p.business_unit || 'Enterprise'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border" style={{ borderColor: '#DFE1E6' }}>
                          {p.priority}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${p.status === 'completed' ? 'bg-green-500' : 'bg-blue-500'}`}></div>
                          <span className="text-sm font-semibold text-gray-700 bg-gray-100 px-2 py-0.5 rounded">{p.current_stage || 'Unknown'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex justify-between text-xs font-bold text-gray-600">
                            <span>Progress</span>
                            <span>{p.status === 'completed' ? '100%' : '45%'}</span>
                          </div>
                          <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-1000 ${p.status === 'completed' ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: p.status === 'completed' ? '100%' : '45%' }}></div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan={4} className="p-6 text-center text-gray-500">No active projects found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column (Context & Approvals) */}
        <div className="space-y-8">
          
          {/* Pending Reviews (My Tasks) */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
            <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 rounded-t-2xl">
              <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                <span className="material-icons text-orange-500">pending_actions</span>
                My Tasks & Reviews
              </h3>
            </div>
            <div className="p-4 space-y-3">
              {data.my_pending_tasks.slice(0,4).map(task => (
                <Link to="/team-inbox" key={task.id} className="block p-4 rounded-xl border border-gray-100 hover:border-blue-200 bg-white hover:bg-blue-50/30 transition-all group shadow-sm hover:shadow-md">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-blue-600 bg-blue-100 px-2 py-0.5 rounded">{task.type}</span>
                    <span className="text-[11px] font-medium text-gray-400">{task.submittedDate || 'Recent'}</span>
                  </div>
                  <h4 className="font-semibold text-gray-800 text-sm mb-1 leading-snug group-hover:text-blue-600">{task.projectName}</h4>
                  <p className="text-xs text-gray-500">{task.submittedBy || 'Unknown User'}</p>
                </Link>
              ))}
              {data.my_pending_tasks.length === 0 && <div className="text-sm text-gray-500 text-center py-4">You're all caught up!</div>}
            </div>
          </div>

          {/* Risk Dashboard Summary */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
            <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 rounded-t-2xl">
              <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                <span className="material-icons text-red-500">gpp_maybe</span>
                Executive Risk Heatmap
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full shadow-sm bg-red-500"></div>
                  <span className="text-sm font-semibold text-gray-700">Critical Risk (Gate S)</span>
                </div>
                <span className="text-sm font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded">{data.high_risk_count}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full shadow-sm bg-orange-500"></div>
                  <span className="text-sm font-semibold text-gray-700">High Risk (Gate K)</span>
                </div>
                <span className="text-sm font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded">3</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full shadow-sm bg-yellow-400"></div>
                  <span className="text-sm font-semibold text-gray-700">Medium Risk (Gate C)</span>
                </div>
                <span className="text-sm font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded">12</span>
              </div>
            </div>
          </div>

          {/* Today's Meetings */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden">
            <div className="absolute right-0 top-0 w-16 h-16 bg-blue-50 rounded-bl-full -z-0"></div>
            <div className="px-6 py-5 relative z-10 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                <span className="material-icons text-indigo-500">groups</span>
                Today's Meetings
              </h3>
              <Link to="/meeting-center" className="text-xs font-semibold text-blue-600 hover:underline">View All</Link>
            </div>
            <div className="p-4 relative z-10 space-y-3">
              <div className="p-3 border border-indigo-100 bg-indigo-50/50 rounded-lg flex items-center gap-4">
                <div className="bg-indigo-100 text-indigo-700 w-12 h-12 rounded-lg flex flex-col items-center justify-center flex-shrink-0">
                  <span className="text-[10px] font-bold uppercase">10:00</span>
                  <span className="text-xs font-extrabold">AM</span>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-900">EAC Council Vote</h4>
                  <p className="text-xs text-gray-500 flex items-center gap-1 mt-1"><span className="material-icons text-[12px]">videocam</span> MS Teams</p>
                </div>
              </div>
              <div className="p-3 border border-gray-100 bg-white rounded-lg flex items-center gap-4">
                <div className="bg-gray-100 text-gray-600 w-12 h-12 rounded-lg flex flex-col items-center justify-center flex-shrink-0">
                  <span className="text-[10px] font-bold uppercase">2:30</span>
                  <span className="text-xs font-extrabold">PM</span>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-900">BTA Discovery - Epic A</h4>
                  <p className="text-xs text-gray-500 flex items-center gap-1 mt-1"><span className="material-icons text-[12px]">person</span> In-person (Room 4A)</p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
