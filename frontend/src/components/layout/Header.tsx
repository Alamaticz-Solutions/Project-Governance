import { useAuth } from "../../app/AuthContext";

export function Header() {
  const { user, logout } = useAuth();

  const userInitials = () => {
    if (!user) return "??";
    return user.full_name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
  };

  return (
    <div className="h-16 flex items-center justify-between px-6 sticky top-0 z-40 transition-all"
         style={{ background: "rgba(255,255,255,0.80)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", borderBottom: "1px solid rgba(79,70,229,0.10)", boxShadow: "0 1px 24px rgba(79,70,229,0.06), 0 1px 4px rgba(0,0,0,0.04)" }}>

      {/* Brand Title */}
      <div className="flex items-center gap-3">
        <div className="flex flex-col">
          <h1 className="text-[15px] font-bold tracking-tight leading-tight" style={{ fontFamily: "'Outfit', sans-serif", background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>Enterprise Governance Portal</h1>
          <span className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: "#94A3B8" }}>AI-Powered Decision Engine</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Premium Search Bar */}
        <div className="relative flex items-center group">
          <div className="absolute inset-0 rounded-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-300 blur-sm pointer-events-none" style={{ background: "linear-gradient(135deg, rgba(79,70,229,0.2), rgba(124,58,237,0.2))" }}></div>
          <span className="material-icons absolute left-3 z-10 transition-colors duration-200 text-[18px]" style={{ color: "#94A3B8" }} id="search-icon">search</span>
          <input type="text" placeholder="Search projects or members..." id="navbar-search"
                 className="relative pl-9 pr-4 py-2 w-68 text-[13px] outline-none transition-all duration-200 rounded-xl focus:bg-white"
                 style={{ background: "rgba(241,245,249,0.8)", border: "1.5px solid rgba(226,232,240,0.8)", color: "#334155", width: "256px" }}
                 onFocus={(e) => {
                   e.currentTarget.style.borderColor = "rgba(79,70,229,0.4)";
                   e.currentTarget.style.boxShadow = "0 0 0 4px rgba(79,70,229,0.10)";
                   document.getElementById("search-icon")!.style.color = "#4F46E5";
                 }}
                 onBlur={(e) => {
                   e.currentTarget.style.borderColor = "rgba(226,232,240,0.8)";
                   e.currentTarget.style.boxShadow = "none";
                   document.getElementById("search-icon")!.style.color = "#94A3B8";
                 }} />
          <div className="absolute right-3 flex items-center gap-0.5 pointer-events-none">
            <kbd className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: "rgba(226,232,240,0.9)", color: "#64748B", border: "1px solid rgba(203,213,225,0.8)" }}>⌘K</kbd>
          </div>
        </div>

        {/* Divider */}
        <div className="h-7 w-px" style={{ background: "rgba(226,232,240,0.9)" }}></div>

        {/* Notification Icon */}
        <button className="relative w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 group hover:bg-indigo-500/10 hover:text-indigo-600 text-slate-500" title="Notifications">
          <span className="material-icons text-[21px]">notifications</span>
          <span className="absolute top-1.5 right-1.5">
            <span className="absolute inline-flex h-2 w-2 rounded-full opacity-75 animate-ping" style={{ background: "#DC2626" }}></span>
            <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: "#DC2626", border: "1.5px solid white" }}></span>
          </span>
        </button>

        {/* Help/Knowledge Base */}
        <button className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 hover:bg-indigo-500/10 hover:text-indigo-600 text-slate-500" title="Knowledge Base">
          <span className="material-icons text-[21px]">help_outline</span>
        </button>

        {/* Divider */}
        <div className="h-7 w-px" style={{ background: "rgba(226,232,240,0.9)" }}></div>

        {/* Premium User Menu */}
        <div className="flex items-center gap-2.5 pl-1 cursor-pointer group">
          <div className="relative flex-shrink-0">
            <div className="absolute inset-0 rounded-full opacity-60 group-hover:opacity-100 transition-opacity" style={{ background: "linear-gradient(135deg, #4F46E5, #7C3AED)", transform: "scale(1.18)", filter: "blur(3px)" }}></div>
            <div className="relative w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-md" style={{ background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)" }}>
              {userInitials()}
            </div>
          </div>
          <div className="flex flex-col">
            <span className="text-[13px] font-semibold leading-tight transition-colors duration-200 group-hover:text-indigo-600" style={{ color: "#1E293B" }}>{user?.full_name}</span>
            <span className="text-[10px] font-medium capitalize" style={{ color: "#94A3B8" }}>{user?.role.replace(/_/g, " ")}</span>
          </div>
          <button onClick={logout} className="ml-1 w-8 h-8 flex items-center justify-center rounded-xl transition-all duration-200 hover:bg-red-500/10 hover:text-red-600 text-slate-400" title="Sign Out">
            <span className="material-icons text-[19px]">logout</span>
          </button>
        </div>
      </div>
    </div>
  );
}
