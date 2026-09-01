import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router";
import { projectsApi } from "../../lib/api";
import { useAuth } from "../../app/AuthContext";
import type { PendingApprovalItem } from "../../lib/types";

export function TeamInboxPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [tasks, setTasks] = useState<PendingApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [filterAction, setFilterAction] = useState("");

  const teamName = useMemo(() => {
    const role = (user?.role || '').toLowerCase();
    if (role === 'bta') return 'Business Tech Advocate (BTA)';
    if (role === 'admin') return 'BTA ADMIN';
    if (role === 'security') return 'InfoSec';
    if (role === 'finance') return 'Finance';
    if (role === 'eac') return 'Enterprise Architecture Council (EAC)';
    if (role === 'pic') return 'Project Investment Committee (PIC)';
    return user?.role ? user.role.toUpperCase() : 'Team';
  }, [user]);

  const fetchTasks = async (isRefetch = false) => {
    if (isRefetch) setRefreshing(true);
    else setLoading(true);
    
    try {
      const data = await projectsApi.pendingApprovals();
      setTasks(data);
    } catch (err) {
      console.error("Failed to load pending approvals", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const filteredTasks = useMemo(() => {
    let currentTasks = tasks;
    const query = searchQuery.toLowerCase().trim();
    const action = filterAction.toLowerCase().trim();

    if (query) {
      currentTasks = currentTasks.filter(task =>
        (task.projectNumber && task.projectNumber.toLowerCase().includes(query)) ||
        (task.projectName && task.projectName.toLowerCase().includes(query))
      );
    }

    if (action) {
      currentTasks = currentTasks.filter(task =>
        task.type && task.type.toLowerCase().includes(action)
      );
    }

    return currentTasks;
  }, [tasks, searchQuery, filterAction]);

  const getIconForTask = (type: string) => {
    if (type.includes('EPMO')) return 'architecture';
    if (type.includes('BTA')) return 'explore';
    if (type.includes('Finance')) return 'account_balance';
    if (type.includes('Security')) return 'security';
    if (type.includes('Gate')) return 'fact_check';
    if (type.includes('EAC')) return 'groups';
    if (type.includes('PIC')) return 'assured_workload';
    return 'assignment';
  };

  const getPriorityClasses = (priority: string) => {
    const p = (priority || '').toLowerCase();
    if (p === 'critical') return 'bg-rose-500/20 text-rose-300 border border-rose-500/30';
    if (p === 'high') return 'bg-orange-500/20 text-orange-300 border border-orange-500/30';
    if (p === 'medium') return 'bg-blue-500/20 text-blue-300 border border-blue-500/30';
    if (p === 'low') return 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
    return 'bg-slate-500/20 text-slate-300 border border-slate-500/30';
  };

  return (
    <div className="animate-fade-in min-h-[calc(100vh-4rem)] bg-[#0f172a] text-slate-100 relative overflow-hidden font-sans pb-10">
      {/* Deep Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0f172a] via-[#1e1b4b] to-[#0f172a] z-0"></div>
      <div className="absolute top-0 left-0 w-[800px] h-[800px] bg-indigo-600/10 rounded-full blur-3xl mix-blend-screen pointer-events-none transform -translate-x-1/2 -translate-y-1/2"></div>
      <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-3xl mix-blend-screen pointer-events-none transform translate-x-1/3 translate-y-1/3"></div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3 drop-shadow-md">
              <span className="material-icons text-indigo-400 text-[32px]">inbox</span>
              Pending Reviews: {teamName}
              {refreshing && (
                <span className="material-icons text-indigo-400 text-[18px] animate-spin" title="Refreshing...">autorenew</span>
              )}
            </h1>
            <p className="text-sm font-medium text-slate-400 mt-1">Manage and process governance tasks awaiting your team's decision.</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-4">
              {/* Search Bar */}
              <div className="relative group">
                  <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm group-focus-within:text-indigo-400 transition-colors">search</span>
                  <input 
                    type="text" 
                    placeholder="Search by Project ID..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-slate-800/70 border border-white/10 rounded-lg text-slate-100 text-sm font-medium shadow-[inset_0_2px_4px_0_rgba(0,0,0,0.05)] backdrop-blur placeholder-slate-500 focus:border-indigo-500/50 focus:bg-slate-800/90 focus:ring-[3px] focus:ring-indigo-500/20 focus:outline-none transition-all pl-9 pr-4 h-10 w-64"
                  />
                  {searchQuery && (
                    <button className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors" onClick={() => setSearchQuery('')}>
                      <span className="material-icons text-[14px]">close</span>
                    </button>
                  )}
              </div>

              {/* Filter Dropdown */}
              <div className="relative group">
                  <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px] group-focus-within:text-indigo-400 transition-colors">filter_list</span>
                  <select 
                    value={filterAction}
                    onChange={(e) => setFilterAction(e.target.value)}
                    className="bg-slate-800/70 border border-white/10 rounded-lg text-slate-100 text-sm font-medium shadow-[inset_0_2px_4px_0_rgba(0,0,0,0.05)] backdrop-blur placeholder-slate-500 focus:border-indigo-500/50 focus:bg-slate-800/90 focus:ring-[3px] focus:ring-indigo-500/20 focus:outline-none transition-all pl-9 pr-8 h-10 appearance-none cursor-pointer w-48"
                  >
                    <option value="" className="bg-slate-800">All Required Actions</option>
                    <option value="EPMO" className="bg-slate-800">EPMO Review</option>
                    <option value="BTA" className="bg-slate-800">BTA Review</option>
                    <option value="Finance" className="bg-slate-800">Finance Review</option>
                    <option value="EAC" className="bg-slate-800">EAC Review</option>
                    <option value="PIC" className="bg-slate-800">PIC Review</option>
                    <option value="Gate" className="bg-slate-800">Gate Review</option>
                    <option value="Security" className="bg-slate-800">Security Review</option>
                  </select>
                  <span className="material-icons absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px] pointer-events-none">expand_more</span>
              </div>

              <button 
                className="bg-slate-800/70 text-slate-400 border border-white/10 backdrop-blur hover:bg-white/10 hover:text-slate-100 hover:border-white/20 w-10 h-10 rounded-lg flex items-center justify-center transition-all" 
                onClick={() => fetchTasks(true)} 
                title="Refresh Tasks"
              >
                  <span className={`material-icons text-[20px] ${refreshing ? 'animate-spin' : ''}`}>refresh</span>
              </button>
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur-md rounded-2xl shadow-[0_20px_40px_-10px_rgba(0,0,0,0.5),0_0_20px_rgba(99,102,241,0.1)] border border-white/10 overflow-hidden relative">
          {/* Inner subtle glow */}
          <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/10 pointer-events-none"></div>

          <div className="px-6 py-5 border-b border-white/10 bg-slate-900/40 flex justify-between items-center relative z-10">
              <h3 className="font-bold text-white text-lg flex items-center gap-2 drop-shadow-md">
                  Task Queue
                  <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs px-2 py-0.5 rounded-full font-bold ml-2 shadow-sm">{filteredTasks.length} tasks</span>
              </h3>
          </div>

          <div className="overflow-x-auto relative z-10">
              <table className="w-full table-fixed text-left">
                  <thead>
                      <tr className="bg-slate-900/60 border-b border-white/5 text-xs uppercase tracking-wider text-slate-300 font-bold">
                          <th className="px-6 py-4 whitespace-nowrap font-medium tracking-wide w-[15%]">Project ID</th>
                          <th className="px-6 py-4 font-medium tracking-wide w-[25%]">Project Name</th>
                          <th className="px-6 py-4 whitespace-nowrap font-medium tracking-wide w-[18%]">Required Action</th>
                          <th className="px-6 py-4 whitespace-nowrap font-medium tracking-wide w-[10%]">Priority</th>
                          <th className="px-6 py-4 whitespace-nowrap font-medium tracking-wide w-[12%]">Submitted By</th>
                          <th className="px-6 py-4 whitespace-nowrap font-medium tracking-wide w-[10%]">Date</th>
                          <th className="px-6 py-4 text-right font-medium tracking-wide w-[10%]">Action</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-sm">
                      {loading && tasks.length === 0 ? (
                      <tr>
                          <td colSpan={7} className="py-16 px-6">
                              <div className="flex flex-col items-center justify-center gap-3">
                                  <div className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-800/80 border border-white/10">
                                      <span className="material-icons text-indigo-400 text-xl animate-spin">autorenew</span>
                                  </div>
                                  <p className="text-sm font-semibold text-slate-400">Loading tasks...</p>
                              </div>
                          </td>
                      </tr>
                      ) : filteredTasks.length > 0 ? (
                        filteredTasks.map((task) => (
                          <tr key={task.id} className="hover:bg-white/5 transition-all duration-300 cursor-pointer group" onClick={() => navigate(`/team-inbox/${(task as any).project_id || (task as any).projectId}/workspace`)}>
                              {/* 1. Project ID Column */}
                              <td className="px-6 py-4 font-bold text-indigo-300 group-hover:text-indigo-200 transition-colors">{task.projectNumber}</td>
                              
                              {/* 2. Project Name Column */}
                              <td className="px-6 py-4 font-semibold text-slate-200 group-hover:text-white transition-colors truncate" title={task.projectName}>{task.projectName}</td>
                              
                              {/* 3. Required Action Column */}
                              <td className="px-6 py-4">
                                  <div className="flex items-center gap-2">
                                      <span className="flex items-center justify-center rounded-md p-1.5 bg-slate-800 text-slate-400 group-hover:bg-indigo-500/20 group-hover:text-indigo-300 transition-colors border border-white/5 group-hover:border-indigo-500/30">
                                        <span className="material-icons text-[16px]">{getIconForTask(task.type)}</span>
                                      </span>
                                      <span className="font-semibold text-slate-300 group-hover:text-slate-200 transition-colors">{task.type}</span>
                                  </div>
                              </td>
                                                            
                              {/* 4. Priority Column */}
                              <td className="px-6 py-4">
                                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider inline-flex items-center gap-1 shadow-sm backdrop-blur-sm ${getPriorityClasses(task.priority)}`}>
                                      {task.priority || 'MEDIUM'}
                                  </span>
                              </td>
                              
                              {/* 5. Submitted By Column */}
                              <td className="px-6 py-4 text-slate-400 font-medium group-hover:text-slate-300 transition-colors truncate" title={task.submittedBy}>{task.submittedBy}</td>
                              
                              {/* 6. Date Column */}
                              <td className="px-6 py-4 text-slate-400 text-xs font-medium group-hover:text-slate-300 transition-colors whitespace-nowrap">{task.submittedDate || 'Pending'}</td>
                              
                              {/* 7. Action Column */}
                              <td className="px-6 py-4 text-right">
                                  <button className="bg-slate-800/70 text-slate-200 border border-white/10 backdrop-blur-sm transition-all duration-300 group-hover:bg-indigo-500 group-hover:text-white group-hover:border-indigo-500/80 group-hover:-translate-y-[1px] group-hover:shadow-[0_8px_16px_-4px_rgba(99,102,241,0.4)] px-4 py-2 rounded-lg text-xs font-bold shadow-md flex items-center justify-center gap-1 ml-auto">
                                      <span className="material-icons text-[16px]">play_arrow</span> Open Workspace
                                  </button>
                              </td>
                          </tr>
                        ))
                      ) : (
                          <tr>
                              <td colSpan={7} className="py-12 px-6">
                                  <div className="flex flex-col items-center justify-center py-16 px-4 bg-slate-900/30 rounded-2xl border-2 border-dashed border-white/10 transition-all hover:bg-slate-900/50 hover:border-white/20">
                                      {searchQuery || filterAction ? (
                                        <>
                                          <div className="w-20 h-20 rounded-full bg-slate-800/80 shadow-inner flex items-center justify-center mb-5 border border-white/10">
                                              <span className="material-icons text-slate-500 text-[40px]">search_off</span>
                                          </div>
                                          <div className="max-w-sm text-center">
                                              <h3 className="text-xl font-extrabold text-white drop-shadow-sm">No matching tasks found</h3>
                                              <p className="text-sm text-slate-400 mt-2 leading-relaxed">We couldn't find any pending reviews matching your current search or filter criteria.</p>
                                              <button className="mt-6 border border-white/10 text-slate-300 hover:text-white hover:bg-white/5 hover:border-white/20 px-6 py-2.5 rounded-lg text-sm font-bold bg-slate-800/50 transition-all shadow-sm flex items-center justify-center gap-2 mx-auto" onClick={() => { setSearchQuery(''); setFilterAction(''); }}>
                                                <span className="material-icons text-[18px]">filter_alt_off</span> Clear All Filters
                                              </button>
                                          </div>
                                        </>
                                      ) : (
                                        <>
                                          <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center mb-5 border border-emerald-500/20 shadow-inner">
                                              <span className="material-icons text-emerald-400 text-[40px]">task_alt</span>
                                          </div>
                                          <div className="max-w-sm text-center">
                                              <h3 className="text-xl font-extrabold text-white drop-shadow-sm">You're all caught up!</h3>
                                              <p className="text-sm text-slate-400 mt-2 leading-relaxed">Amazing work! There are currently no pending tasks requiring action from the {teamName}.</p>
                                          </div>
                                        </>
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
