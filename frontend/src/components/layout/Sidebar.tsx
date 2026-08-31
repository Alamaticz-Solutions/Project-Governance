import { NavLink } from "react-router";

export function Sidebar() {
  const navMain = [
    { label: "Overview Dashboard", icon: "dashboard", route: "/dashboard" },
    { label: "New Request", icon: "add_circle", route: "/intake" },
    { label: "My Requests", icon: "list_alt", route: "/projects" },
  ];

  const navGovernance = [
    { label: "Pending Reviews", icon: "pending_actions", route: "/team-inbox", badge: 4 },
    { label: "Meeting Center", icon: "groups", route: "/meeting-center" },
    { label: "Teams + VTT (POC)", icon: "smart_toy", route: "/teams-poc" },
    { label: "Analytics", icon: "insights", route: "/analytics" },
  ];

  return (
    <nav
      className="flex flex-col h-full w-64 relative overflow-hidden shrink-0"
      style={{
        background: "linear-gradient(180deg, #0D0F1A 0%, #111827 100%)",
        borderRight: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* Ambient glow background effects */}
      <div
        className="absolute top-0 left-0 w-full h-64 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at 30% 0%, rgba(79,70,229,0.18) 0%, transparent 70%)",
          zIndex: 0,
        }}
      ></div>
      <div
        className="absolute bottom-0 right-0 w-48 h-48 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at 100% 100%, rgba(124,58,237,0.12) 0%, transparent 70%)",
          zIndex: 0,
        }}
      ></div>

      {/* Premium Logo Section */}
      <div
        className="relative z-10 flex items-center gap-3 px-5 py-5 min-h-[72px]"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="relative flex-shrink-0">
          <div
            className="absolute inset-0 rounded-xl blur-md opacity-70"
            style={{
              background: "linear-gradient(135deg, #4F46E5, #7C3AED)",
              transform: "scale(1.15)",
            }}
          ></div>
          <div
            className="relative w-10 h-10 rounded-xl flex items-center justify-center shadow-lg"
            style={{ background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)" }}
          >
            <span className="material-icons text-white" style={{ fontSize: "20px" }}>
              account_tree
            </span>
          </div>
        </div>
        <div className="flex flex-col overflow-hidden">
          <span
            className="text-sm font-bold text-white whitespace-nowrap tracking-wide"
            style={{ fontFamily: "'Outfit', sans-serif", letterSpacing: "0.01em" }}
          >
            Governance Portal
          </span>
          <span
            className="text-[10px] font-bold tracking-widest uppercase"
            style={{
              background: "linear-gradient(90deg, #818CF8, #A78BFA)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Enterprise AI
          </span>
        </div>
      </div>

      {/* Scrollable Navigation */}
      <div className="flex-1 overflow-y-auto py-4 relative z-10 custom-scrollbar">
        {/* Workspace Section */}
        <div className="mb-5">
          <span
            className="px-5 pb-2 block text-[10px] font-bold tracking-widest uppercase"
            style={{ color: "rgba(148,163,184,0.5)" }}
          >
            Workspace
          </span>
          <ul className="space-y-0.5">
            {navMain.map((item) => (
              <li key={item.route}>
                <NavLink
                  to={item.route}
                  className={({ isActive }) =>
                    `mx-3 px-3 py-2.5 rounded-xl flex items-center gap-3 text-[13px] font-semibold transition-all duration-200 group relative ${
                      isActive ? "active" : ""
                    }`
                  }
                  style={({ isActive }) =>
                    isActive
                      ? {
                          background:
                            "linear-gradient(135deg, rgba(79,70,229,0.25) 0%, rgba(124,58,237,0.15) 100%)",
                          color: "white",
                          border: "1px solid rgba(79,70,229,0.3)",
                          boxShadow: "0 2px 12px rgba(79,70,229,0.15)",
                        }
                      : { color: "rgba(148,163,184,0.8)", border: "1px solid transparent" }
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <div
                          className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full"
                          style={{ background: "linear-gradient(180deg, #818CF8, #A78BFA)" }}
                        ></div>
                      )}
                      <span
                        className={`material-icons transition-all duration-200 ${
                          !isActive ? "group-hover:text-[#818CF8]" : ""
                        }`}
                        style={{ fontSize: "19px", color: isActive ? "#818CF8" : undefined }}
                      >
                        {item.icon}
                      </span>
                      <span className="flex-1">{item.label}</span>
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>

        {/* Governance Engine Section */}
        <div className="mb-5">
          <span
            className="px-5 pb-2 block text-[10px] font-bold tracking-widest uppercase"
            style={{ color: "rgba(148,163,184,0.5)" }}
          >
            Governance Engine
          </span>
          <ul className="space-y-0.5">
            {navGovernance.map((item) => (
              <li key={item.route}>
                <NavLink
                  to={item.route}
                  className={({ isActive }) =>
                    `mx-3 px-3 py-2.5 rounded-xl flex items-center gap-3 text-[13px] font-semibold transition-all duration-200 group relative ${
                      isActive ? "active" : ""
                    }`
                  }
                  style={({ isActive }) =>
                    isActive
                      ? {
                          background:
                            "linear-gradient(135deg, rgba(79,70,229,0.25) 0%, rgba(124,58,237,0.15) 100%)",
                          color: "white",
                          border: "1px solid rgba(79,70,229,0.3)",
                          boxShadow: "0 2px 12px rgba(79,70,229,0.15)",
                        }
                      : { color: "rgba(148,163,184,0.8)", border: "1px solid transparent" }
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <div
                          className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full"
                          style={{ background: "linear-gradient(180deg, #818CF8, #A78BFA)" }}
                        ></div>
                      )}
                      <span
                        className={`material-icons transition-all duration-200 ${
                          !isActive ? "group-hover:text-[#818CF8]" : ""
                        }`}
                        style={{ fontSize: "19px", color: isActive ? "#818CF8" : undefined }}
                      >
                        {item.icon}
                      </span>
                      <span className="flex-1">{item.label}</span>
                      {item.badge && (
                        <span
                          className="text-white text-[10px] font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center"
                          style={{
                            background: "linear-gradient(135deg, #4F46E5, #7C3AED)",
                            boxShadow: "0 2px 8px rgba(79,70,229,0.4)",
                          }}
                        >
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* User Footer Profile Box */}
      <div
        className="relative z-10 p-4"
        style={{
          borderTop: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(0,0,0,0.2)",
        }}
      >
        <div
          className="flex items-center gap-3 p-2.5 rounded-xl transition-all duration-200 cursor-pointer group hover:bg-[rgba(255,255,255,0.06)] hover:border-[rgba(255,255,255,0.08)]"
          style={{ border: "1px solid transparent" }}
        >
          <div className="relative flex-shrink-0">
            <div
              className="absolute inset-0 rounded-full blur-sm"
              style={{
                background: "linear-gradient(135deg, #4F46E5, #7C3AED)",
                transform: "scale(1.2)",
                opacity: 0.6,
              }}
            ></div>
            <div
              className="relative w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white"
              style={{ background: "linear-gradient(135deg, #4F46E5, #7C3AED)" }}
            >
              JD
            </div>
          </div>
          <div className="overflow-hidden flex-1">
            <span className="block text-sm font-semibold text-white truncate">John Doe</span>
            <span
              className="block text-[11px] capitalize"
              style={{ color: "rgba(148,163,184,0.7)" }}
            >
              Project Manager
            </span>
          </div>
          <span
            className="material-icons text-sm opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ color: "rgba(148,163,184,0.6)", fontSize: "16px" }}
          >
            settings
          </span>
        </div>
      </div>
    </nav>
  );
}
