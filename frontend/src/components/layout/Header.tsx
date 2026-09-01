import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../../app/AuthContext";
import { notificationsApi } from "../../lib/api";
import type { NotificationItem } from "../../lib/types";

export function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval>;

    const fetchAlerts = () => {
      if (user) {
        notificationsApi.list().then(setNotifications).catch(console.error);
      }
    };

    // Initial fetch
    fetchAlerts();

    // Poll every 30 seconds for new notifications
    if (user) {
      intervalId = setInterval(fetchAlerts, 30000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [user]);

  useEffect(() => {
    // Also fetch immediately when dropdown is opened to ensure freshness
    if (user && showDropdown) {
      notificationsApi.list().then(setNotifications).catch(console.error);
    }
  }, [user, showDropdown]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const displayCount = unreadCount > 10 ? "10+" : unreadCount.toString();

  const handleNotificationClick = (n: NotificationItem) => {
    setShowDropdown(false);

    // Navigate based on the type of notification.
    // If it requires a workflow action from a team member, route to the team inbox workspace.
    // Ensure we handle URL transitions for pending reviews appropriately.
    if (
      n.project_id &&
      (n.title.toLowerCase().includes("required") ||
       n.title.toLowerCase().includes("review") ||
       n.notification_type === "ApprovalRequired")
    ) {
      navigate(`/team-inbox/${n.project_id}/workspace`);
    } else if (n.action_url) {
      navigate(n.action_url);
    } else if (n.project_id) {
      navigate(`/projects/${n.project_id}`);
    }
  };

  const markAllRead = async () => {
    try {
      await notificationsApi.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (e) {
      console.error("Failed to mark notifications as read", e);
    }
  };

  const userInitials = () => {
    if (!user) return "??";
    return user.full_name
      .split(" ")
      .map((name) => name[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
  };

  const getIconForType = (n: NotificationItem) => {
    const t = n.title.toLowerCase();
    if (t.includes("approved")) return "check_circle";
    if (t.includes("rejected")) return "cancel";
    if (t.includes("submitted")) return "publish";
    return "notifications";
  };

  return (
    <div
      className="h-16 flex items-center justify-between px-6 sticky top-0 z-40 transition-all"
      style={{
        background: "rgba(255,255,255,0.80)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(79,70,229,0.10)",
        boxShadow: "0 1px 24px rgba(79,70,229,0.06), 0 1px 4px rgba(0,0,0,0.04)",
      }}
    >
      {/* Brand Title */}
      <div className="flex items-center gap-3">
        <div className="flex flex-col">
          <h1
            className="text-[15px] font-bold tracking-tight leading-tight"
            style={{
              fontFamily: "'Outfit', sans-serif",
              background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Enterprise Governance Portal
          </h1>
          <span
            className="text-[10px] font-semibold tracking-widest uppercase"
            style={{ color: "#94A3B8" }}
          >
            AI-Powered Decision Engine
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Premium Search Bar */}
        <div className="relative flex items-center group">
          <div
            className="absolute inset-0 rounded-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-300 blur-sm pointer-events-none"
            style={{
              background: "linear-gradient(135deg, rgba(79,70,229,0.2), rgba(124,58,237,0.2))",
            }}
          ></div>
          <span
            className="material-icons absolute left-3 z-10 transition-colors duration-200 text-[18px]"
            style={{ color: "#94A3B8" }}
            id="search-icon"
          >
            search
          </span>
          <input
            type="text"
            placeholder="Search projects or members..."
            id="navbar-search"
            className="relative pl-9 pr-4 py-2 w-68 text-[13px] outline-none transition-all duration-200 rounded-xl focus:bg-white"
            style={{
              background: "rgba(241,245,249,0.8)",
              border: "1.5px solid rgba(226,232,240,0.8)",
              color: "#334155",
              width: "256px",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "rgba(79,70,229,0.4)";
              e.currentTarget.style.boxShadow = "0 0 0 4px rgba(79,70,229,0.10)";
              document.getElementById("search-icon")!.style.color = "#4F46E5";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "rgba(226,232,240,0.8)";
              e.currentTarget.style.boxShadow = "none";
              document.getElementById("search-icon")!.style.color = "#94A3B8";
            }}
          />
          <div className="absolute right-3 flex items-center gap-0.5 pointer-events-none">
            <kbd
              className="text-[9px] font-bold px-1.5 py-0.5 rounded"
              style={{
                background: "rgba(226,232,240,0.9)",
                color: "#64748B",
                border: "1px solid rgba(203,213,225,0.8)",
              }}
            >
              ⌘K
            </kbd>
          </div>
        </div>

        {/* Divider */}
        <div className="h-7 w-px" style={{ background: "rgba(226,232,240,0.9)" }}></div>

        {/* Notification Icon & Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="relative w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 group hover:bg-indigo-500/10 hover:text-indigo-600 text-slate-500 bg-transparent"
            title="Notifications"
          >
            <span className="material-icons text-[21px]">notifications</span>
            {unreadCount > 0 && (
              <span className="absolute top-0 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#DC2626] px-1 text-[9px] font-bold text-white shadow-sm ring-2 ring-white">
                {displayCount}
              </span>
            )}
          </button>

          {showDropdown && (
            <div
              className="absolute right-0 mt-3 w-80 rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.2)] border border-slate-200 overflow-hidden z-50 animate-fade-in origin-top-right"
              style={{ background: "#ffffff" }}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/80">
                <h3 className="text-sm font-extrabold text-slate-800">Notifications</h3>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                  >
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-96 overflow-y-auto custom-scrollbar">
                {notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center text-slate-400 text-sm">
                    <span className="material-icons text-4xl mb-2 text-slate-200">
                      notifications_none
                    </span>
                    <p className="font-medium">You're all caught up!</p>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => handleNotificationClick(n)}
                      className={`px-4 py-3 border-b border-slate-50 cursor-pointer transition-colors hover:bg-slate-50 flex gap-3 ${
                        !n.is_read ? "bg-indigo-50/40" : ""
                      }`}
                    >
                      <div
                        className={`w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5 ${
                          !n.is_read
                            ? "bg-indigo-100 text-indigo-600"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        <span className="material-icons text-[18px]">
                          {getIconForType(n)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-0.5">
                          <h4
                            className={`text-sm font-bold truncate pr-3 ${
                              !n.is_read ? "text-slate-900" : "text-slate-700"
                            }`}
                          >
                            {n.title}
                          </h4>
                          {/* Optional dot for unread status */}
                          {!n.is_read && (
                            <span className="w-2.5 h-2.5 bg-indigo-500 rounded-full flex-shrink-0 mt-1 shadow-sm"></span>
                          )}
                        </div>
                        <p
                          className={`text-xs line-clamp-2 leading-relaxed ${
                            !n.is_read ? "text-slate-700 font-medium" : "text-slate-500"
                          }`}
                        >
                          {n.message}
                        </p>
                        <span className="block mt-1.5 text-[10px] font-semibold text-slate-400">
                          {n.created_at ? new Date(n.created_at).toLocaleString() : ""}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="p-2 border-t border-slate-100 bg-slate-50 text-center">
                <button
                  onClick={() => navigate("/notifications")}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors w-full cursor-pointer py-1"
                >
                  View all notifications
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Help/Knowledge Base */}
        <button
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 hover:bg-indigo-500/10 hover:text-indigo-600 text-slate-500 bg-transparent"
          title="Knowledge Base"
        >
          <span className="material-icons text-[21px]">help_outline</span>
        </button>

        {/* Divider */}
        <div className="h-7 w-px" style={{ background: "rgba(226,232,240,0.9)" }}></div>

        {/* Premium User Menu */}
        <div className="flex items-center gap-2.5 pl-1 cursor-pointer group">
          <div className="relative flex-shrink-0">
            <div
              className="absolute inset-0 rounded-full opacity-60 group-hover:opacity-100 transition-opacity"
              style={{
                background: "linear-gradient(135deg, #4F46E5, #7C3AED)",
                transform: "scale(1.18)",
                filter: "blur(3px)",
              }}
            ></div>
            <div
              className="relative w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-md"
              style={{ background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)" }}
            >
              {userInitials()}
            </div>
          </div>
          <div className="flex flex-col">
            <span
              className="text-[13px] font-semibold leading-tight transition-colors duration-200 group-hover:text-indigo-600"
              style={{ color: "#1E293B" }}
            >
              {user?.full_name}
            </span>
            <span
              className="text-[10px] font-medium capitalize"
              style={{ color: "#94A3B8" }}
            >
              {user?.role.replace(/_/g, " ")}
            </span>
          </div>
          <button
            onClick={logout}
            className="ml-1 w-8 h-8 flex items-center justify-center rounded-xl transition-all duration-200 hover:bg-red-500/10 hover:text-red-600 text-slate-400 bg-transparent"
            title="Sign Out"
          >
            <span className="material-icons text-[19px]">logout</span>
          </button>
        </div>
      </div>
    </div>
  );
}
