import { useEffect, useState } from "react";
import { Link } from "react-router";


export function TeamInboxPage() {
  const [tasks, setTasks] = useState<any[]>([]);

  useEffect(() => {
    // In a real implementation, we'd fetch actual pending tasks for the team
    setTasks([
      { id: "1", projectId: "123", projectNumber: "REQ-2025-0001", projectName: "Cloud Migration", type: "BTA Review", priority: "High", submittedBy: "John Doe", submittedDate: "Aug 02, 2026" },
      { id: "2", projectId: "124", projectNumber: "REQ-2025-0002", projectName: "New HR System", type: "EAC Review", priority: "Medium", submittedBy: "Jane Smith", submittedDate: "Aug 01, 2026" }
    ]);
  }, []);

  const getIconForTask = (type: string) => {
    if (type.includes("EPMO")) return "architecture";
    if (type.includes("BTA")) return "explore";
    if (type.includes("Finance")) return "account_balance";
    if (type.includes("Security")) return "security";
    if (type.includes("Gate")) return "fact_check";
    if (type.includes("EAC")) return "groups";
    if (type.includes("PIC")) return "assured_workload";
    return "assignment";
  };

  return (
    <div className="animate-fade-in p-6 bg-enterprise-bg min-h-full">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
            <span className="material-icons text-enterprise-primary text-[32px]">inbox</span>
            Pending Reviews: BTA Team
          </h1>
          <p className="text-sm font-medium text-gray-500 mt-1">Manage and process governance tasks awaiting your team's decision.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">search</span>
            <input
              type="text"
              placeholder="Search tasks..."
              className="pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm shadow-sm focus:ring-2 focus:ring-enterprise-primary focus:border-enterprise-primary outline-none transition-all w-64"
            />
          </div>
          <button className="bg-white border border-gray-200 shadow-sm text-gray-700 w-10 h-10 rounded-lg flex items-center justify-center hover:bg-gray-50 transition-colors">
            <span className="material-icons text-[20px]">filter_list</span>
          </button>
          <button className="bg-white border border-gray-200 shadow-sm text-gray-700 w-10 h-10 rounded-lg flex items-center justify-center hover:bg-gray-50 transition-colors">
            <span className="material-icons text-[20px]">refresh</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-enterprise-soft border border-gray-100 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
          <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
            Task Queue
            <span className="bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded-full font-bold ml-2">{tasks.length} tasks</span>
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-white border-b border-gray-100 text-[10px] uppercase tracking-widest text-gray-400 font-extrabold">
                <th className="px-6 py-4">Project ID</th>
                <th className="px-6 py-4 w-1/4">Project Name</th>
                <th className="px-6 py-4">Required Action</th>
                <th className="px-6 py-4">Priority</th>
                <th className="px-6 py-4">Submitted By</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 text-sm">
              {tasks.length > 0 ? (
                tasks.map((task) => (
                  <tr key={task.id} className="hover:bg-indigo-50/50 transition-colors group cursor-pointer">
                    <td className="px-6 py-4 font-bold text-enterprise-primary">{task.projectNumber}</td>
                    <td className="px-6 py-4 font-semibold text-gray-800">{task.projectName}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="material-icons text-gray-400 text-[16px]">{getIconForTask(task.type)}</span>
                        <span className="font-medium text-gray-700">{task.type}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`text-xs font-bold px-2 py-1 rounded-md uppercase tracking-wider inline-flex items-center gap-1 ${
                          task.priority.toLowerCase() === "critical"
                            ? "bg-rose-100 text-rose-700"
                            : task.priority.toLowerCase() === "high"
                            ? "bg-orange-100 text-orange-700"
                            : task.priority.toLowerCase() === "medium"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-green-100 text-green-700"
                        }`}
                      >
                        {task.priority}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600 font-medium">{task.submittedBy}</td>
                    <td className="px-6 py-4 text-gray-500 text-xs">{task.submittedDate}</td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        to={`/workspace/${task.projectId}`}
                        className="btn border border-gray-200 text-gray-700 hover:border-enterprise-primary hover:text-white hover:bg-enterprise-primary px-4 py-2 rounded-lg text-xs font-bold bg-white transition-all shadow-sm flex items-center justify-center gap-1 ml-auto group-hover:bg-enterprise-primary group-hover:text-white group-hover:border-enterprise-primary w-fit"
                      >
                        <span className="material-icons text-[16px]">play_arrow</span> Open Workspace
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center">
                        <span className="material-icons text-green-500 text-[32px]">task_alt</span>
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-800">You're all caught up!</h3>
                        <p className="text-sm text-gray-500 mt-1">There are no pending tasks for the team.</p>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
