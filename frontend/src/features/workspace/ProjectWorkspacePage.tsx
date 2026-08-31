import { useState, useEffect } from "react";
import { useParams } from "react-router";
import { projectsApi } from "../../lib/api";

export function ProjectWorkspacePage() {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("Form Engine");

  
  const [workspaceData, setWorkspaceData] = useState<any>({
    project_details: {
      id: id,
      name: "Enterprise AI Agentic Implementation",
      department: "Innovation & Strategy",
      submitted_at: new Date().toISOString(),
      requestorName: "John Doe"
    },
    workflow: {
      current_stage: "BTA Review"
    },
    ai_assistant: {
      recommended_action: "Approve"
    },
    documents: [],
    comments: [
      { initials: "JS", author: "Jane Smith", date: "Yesterday, 10:45 AM", text: "Does this budget include licensing costs for year 2?" },
      { initials: "MK", author: "Mike Kumar", date: "Today, 8:12 AM", text: "Yes, embedded in the OpEx projection." }
    ],
    audit_logs: [
      { user: "Sarah Connor", action: "changed SLA rules for project.", timestamp: "Aug 03 12:45 UTC", hash: "8f4c-1e2b" },
      { user: "System (AI)", action: "extracted form values from uploaded PDF.", timestamp: "Aug 03 12:50 UTC", hash: "3e9a-7b0d" }
    ],
    timeline: [
      { stage: "Intake", status: "Approved", action_date: new Date().toISOString(), actor: "System" },
      { stage: "BTA Review", status: "In Progress", action_date: null, actor: "Pending BTA" }
    ]
  });

  useEffect(() => {
    projectsApi.get(id!).then((res: any) => {
      setWorkspaceData((prev: any) => ({
        ...prev,
        project_details: {
          ...prev.project_details,
          id: res.id,
          name: res.project_name,
          department: res.department,
          submitted_at: res.submitted_at
        },
        workflow: {
          current_stage: res.current_stage || "BTA Review"
        },
        timeline: [
          { stage: "Intake", status: "Approved", action_date: new Date().toISOString(), actor: "System" },
          { stage: res.current_stage || "BTA Review", status: "In Progress", action_date: null, actor: "Pending Team" }
        ]
      }));
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
  }, [id]);

  const tabs = [
    { key: "Form Engine", label: "Intake Forms", icon: "article", count: undefined },
    { key: "Documents", label: "Documents", icon: "folder", count: workspaceData.documents.length },
    { key: "Comments", label: "Comments", icon: "chat_bubble_outline", count: workspaceData.comments.length },
    { key: "Overview", label: "Overview", icon: "find_in_page", count: undefined },
    { key: "Audit", label: "Audit Trail", icon: "history", count: undefined },
  ];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newDocs = Array.from(e.target.files).map((file) => ({
        name: file.name,
        author: "You (Current User)",
        date: "Just now",
      }));
      setWorkspaceData((prev: any) => ({
        ...prev,
        documents: [...newDocs, ...prev.documents],
      }));
    }
  };

  const deleteDocument = (index: number) => {
    if (window.confirm("Are you sure you want to permanently delete this document?")) {
      setWorkspaceData((prev: any) => {
        const newDocs = [...prev.documents];
        newDocs.splice(index, 1);
        return { ...prev, documents: newDocs };
      });
    }
  };

  const submitAction = (action: string) => {
    if (window.confirm(`Are you sure you want to ${action} this proposal?`)) {
      alert(`Simulation Fallback: Successfully recorded ${action}. Flowing to next sequence.`);
    }
  };

  return (
    <div
      className="animate-fade-in min-h-[calc(100vh-64px)] flex gap-5 font-sans p-6"
      style={{ background: "linear-gradient(135deg, #F0F4FF 0%, #FAF5FF 50%, #F0FFFE 100%)" }}
    >
      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, #4F46E5, #7C3AED)",
                boxShadow: "0 8px 24px rgba(79,70,229,0.35)",
              }}
            >
              <span className="material-icons text-white text-2xl animate-spin">autorenew</span>
            </div>
            <p className="text-sm font-semibold" style={{ color: "#64748B" }}>
              Loading workspace...
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* ══ Main Workspace (Left Column) ══ */}
          <div className="flex-1 flex flex-col gap-4 min-w-0">
            {/* ── Premium Header Card ── */}
            <div
              className="rounded-2xl relative overflow-hidden"
              style={{
                background: "white",
                border: "1px solid rgba(226,232,240,0.8)",
                boxShadow: "0 4px 24px rgba(79,70,229,0.08), 0 1px 4px rgba(0,0,0,0.04)",
              }}
            >
              {/* Top gradient accent bar */}
              <div
                className="absolute top-0 left-0 right-0 h-1"
                style={{ background: "linear-gradient(90deg, #4F46E5 0%, #7C3AED 50%, #06B6D4 100%)" }}
              ></div>
              {/* Subtle ambient glow */}
              <div
                className="absolute top-0 right-0 w-64 h-32 pointer-events-none"
                style={{
                  background: "radial-gradient(ellipse at 100% 0%, rgba(79,70,229,0.06) 0%, transparent 70%)",
                }}
              ></div>

              <div className="flex justify-between items-start px-8 pt-6 pb-6 relative z-10">
                <div>
                  {/* Stage breadcrumb */}
                  <div className="flex items-center gap-2 mb-3">
                    <span
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase"
                      style={{
                        background: "linear-gradient(135deg, #EEF2FF, #F5F3FF)",
                        color: "#4F46E5",
                        border: "1px solid rgba(79,70,229,0.15)",
                      }}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full animate-pulse"
                        style={{ background: "#4F46E5" }}
                      ></span>
                      {workspaceData.workflow.current_stage}
                    </span>
                    <span className="text-gray-300">·</span>
                    <span
                      className="text-[10px] font-bold tracking-widest uppercase"
                      style={{ color: "#94A3B8" }}
                    >
                      ASSIGNED TO: UNASSIGNED
                    </span>
                  </div>

                  {/* Project title */}
                  <h1
                    className="text-2xl font-extrabold mb-4 leading-tight"
                    style={{ fontFamily: "'Outfit', sans-serif", color: "#1E293B" }}
                  >
                    {workspaceData.project_details.name}
                  </h1>

                  {/* Meta chips */}
                  <div className="flex items-center gap-5 flex-wrap">
                    <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: "#64748B" }}>
                      <span className="material-icons text-[14px]" style={{ color: "#94A3B8" }}>
                        tag
                      </span>
                      <span>REQ-2025-000123</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: "#64748B" }}>
                      <span className="material-icons text-[14px]" style={{ color: "#94A3B8" }}>
                        person_outline
                      </span>
                      <span className="font-semibold" style={{ color: "#334155" }}>
                        {workspaceData.project_details.requestorName || "Gurrammaneesh User"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: "#64748B" }}>
                      <span className="material-icons text-[14px]" style={{ color: "#94A3B8" }}>
                        calendar_today
                      </span>
                      <span>Aug 31, 2026</span>
                    </div>
                  </div>
                </div>

                {/* Current Stage badge (right) */}
                <div
                  className="flex-shrink-0 px-5 py-3.5 rounded-xl flex flex-col items-center justify-center"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(79,70,229,0.08) 0%, rgba(124,58,237,0.06) 100%)",
                    border: "1px solid rgba(79,70,229,0.15)",
                  }}
                >
                  <span
                    className="text-[9px] font-bold tracking-widest uppercase mb-1.5"
                    style={{ color: "#818CF8" }}
                  >
                    Current Stage
                  </span>
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-2 h-2 rounded-full animate-pulse"
                      style={{ background: "linear-gradient(135deg, #4F46E5, #7C3AED)" }}
                    ></div>
                    <span className="text-[13px] font-extrabold" style={{ color: "#1E293B" }}>
                      {workspaceData.workflow.current_stage}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Premium Tab Navigation ── */}
            <div
              className="rounded-2xl overflow-hidden"
              style={{
                background: "white",
                border: "1px solid rgba(226,232,240,0.8)",
                boxShadow: "0 2px 12px rgba(79,70,229,0.06)",
              }}
            >
              <div className="flex px-2 pt-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className="flex items-center gap-2 px-4 py-3.5 text-[13px] font-bold border-b-2 transition-all duration-200 relative rounded-t-xl mx-1"
                    style={
                      activeTab === tab.key
                        ? {
                            color: "#4F46E5",
                            borderColor: "#4F46E5",
                            background: "linear-gradient(180deg, rgba(79,70,229,0.06) 0%, transparent 100%)",
                          }
                        : {
                            color: "#94A3B8",
                            borderColor: "transparent",
                          }
                    }
                    onMouseEnter={(e) => {
                      if (activeTab !== tab.key) e.currentTarget.style.color = "#475569";
                    }}
                    onMouseLeave={(e) => {
                      if (activeTab !== tab.key) e.currentTarget.style.color = "#94A3B8";
                    }}
                  >
                    <span className="material-icons text-[17px]">{tab.icon}</span>
                    {tab.label}
                    {tab.count !== undefined && (
                      <span
                        className="ml-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={
                          activeTab === tab.key
                            ? { background: "linear-gradient(135deg, #4F46E5, #7C3AED)", color: "white" }
                            : { background: "rgba(241,245,249,0.9)", color: "#64748B" }
                        }
                      >
                        {tab.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Form Engine Container ── */}
            <div
              style={{ display: activeTab === "Form Engine" || activeTab === "Overview" ? "block" : "none" }}
              className="animate-fade-in w-full"
            >
              <div className="p-10 text-center bg-white rounded-2xl border border-gray-200">
                <span className="material-icons text-6xl text-gray-300 mb-4">description</span>
                <h3 className="text-xl font-bold text-gray-800">Review Form Engine</h3>
                <p className="text-gray-500 mt-2">The specific review forms for this stage will be rendered here.</p>
              </div>
            </div>

            {/* ── Other Tab Content ── */}
            {activeTab !== "Form Engine" && activeTab !== "Overview" && (
              <div
                className="rounded-2xl p-8 min-h-[400px]"
                style={{
                  background: "white",
                  border: "1px solid rgba(226,232,240,0.8)",
                  boxShadow: "0 4px 20px rgba(79,70,229,0.06)",
                }}
              >
                {/* DOCUMENTS TAB */}
                {activeTab === "Documents" && (
                  <div className="animate-fade-in space-y-3">
                    <div className="flex justify-between items-center mb-6">
                      <div>
                        <h3 className="text-lg font-bold" style={{ color: "#1E293B" }}>
                          Project Documents
                        </h3>
                        <p className="text-[12px] mt-0.5" style={{ color: "#94A3B8" }}>
                          {workspaceData.documents.length} files attached
                        </p>
                      </div>
                      <input
                        type="file"
                        id="fileUpload"
                        className="hidden"
                        multiple
                        onChange={handleFileUpload}
                      />
                      <label
                        htmlFor="fileUpload"
                        className="cursor-pointer flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200"
                        style={{
                          background: "linear-gradient(135deg, #4F46E5, #7C3AED)",
                          color: "white",
                          boxShadow: "0 4px 14px rgba(79,70,229,0.3)",
                        }}
                      >
                        <span className="material-icons text-[18px]">cloud_upload</span>
                        Upload File
                      </label>
                    </div>

                    {workspaceData.documents.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div
                          className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                          style={{ background: "linear-gradient(135deg, #EEF2FF, #F5F3FF)" }}
                        >
                          <span className="material-icons text-3xl" style={{ color: "#818CF8" }}>
                            folder_open
                          </span>
                        </div>
                        <p className="font-semibold text-sm" style={{ color: "#64748B" }}>
                          No documents uploaded yet
                        </p>
                        <p className="text-xs mt-1" style={{ color: "#94A3B8" }}>
                          Upload documents to attach them to this review
                        </p>
                      </div>
                    )}

                    {workspaceData.documents.map((doc: any, i: number) => (
                      <div
                        key={i}
                        className="flex justify-between items-center p-4 rounded-xl transition-all duration-200 group"
                        style={{
                          border: "1px solid rgba(226,232,240,0.8)",
                          background: "rgba(248,250,252,0.6)",
                        }}
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className="w-11 h-11 rounded-xl flex items-center justify-center"
                            style={{ background: "linear-gradient(135deg, #FEF3C7, #FDE68A)" }}
                          >
                            <span className="material-icons text-[22px]" style={{ color: "#D97706" }}>
                              picture_as_pdf
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-bold" style={{ color: "#1E293B" }}>
                              {doc.name}
                            </p>
                            <p className="text-[11px] font-medium mt-0.5" style={{ color: "#94A3B8" }}>
                              Uploaded by {doc.author} · {doc.date}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200"
                            style={{ color: "#94A3B8" }}
                          >
                            <span className="material-icons text-[18px]">download</span>
                          </button>
                          <button
                            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200"
                            style={{ color: "#94A3B8" }}
                            onClick={() => deleteDocument(i)}
                          >
                            <span className="material-icons text-[18px]">delete_outline</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* COMMENTS TAB */}
                {activeTab === "Comments" && (
                  <div className="animate-fade-in flex flex-col h-full space-y-5">
                    <div>
                      <h3 className="text-lg font-bold" style={{ color: "#1E293B" }}>
                        Discussion Thread
                      </h3>
                      <p className="text-[12px] mt-0.5" style={{ color: "#94A3B8" }}>
                        {workspaceData.comments.length} messages in this review
                      </p>
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-5">
                      {workspaceData.comments.map((comment: any, i: number) => (
                        <div key={i} className="flex gap-4">
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 text-white"
                            style={{
                              background: "linear-gradient(135deg, #4F46E5, #7C3AED)",
                              boxShadow: "0 2px 8px rgba(79,70,229,0.25)",
                            }}
                          >
                            {comment.initials}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1.5">
                              <p className="text-[13px] font-bold" style={{ color: "#1E293B" }}>
                                {comment.author}
                              </p>
                              <span className="text-[11px] font-medium" style={{ color: "#94A3B8" }}>
                                {comment.date}
                              </span>
                            </div>
                            <p
                              className="text-[13px] leading-relaxed p-4 rounded-2xl rounded-tl-sm"
                              style={{
                                color: "#475569",
                                background: "rgba(241,245,249,0.8)",
                                border: "1px solid rgba(226,232,240,0.6)",
                              }}
                            >
                              {comment.text}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-3 pt-4" style={{ borderTop: "1px solid rgba(226,232,240,0.6)" }}>
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 text-white"
                        style={{ background: "linear-gradient(135deg, #64748B, #475569)" }}
                      >
                        ME
                      </div>
                      <input
                        type="text"
                        placeholder="Add a comment... (Press Enter to post)"
                        className="flex-1 px-4 py-2.5 rounded-xl text-[13px] outline-none transition-all duration-200 focus:bg-white focus:border-[rgba(79,70,229,0.4)] focus:ring-[rgba(79,70,229,0.08)]"
                        style={{
                          background: "rgba(241,245,249,0.8)",
                          border: "1.5px solid rgba(226,232,240,0.8)",
                          color: "#334155",
                        }}
                      />
                      <button
                        className="px-5 rounded-xl font-bold text-[13px] text-white transition-all duration-200"
                        style={{
                          background: "linear-gradient(135deg, #4F46E5, #7C3AED)",
                          boxShadow: "0 4px 12px rgba(79,70,229,0.3)",
                        }}
                      >
                        Post
                      </button>
                    </div>
                  </div>
                )}

                {/* AUDIT TRAIL TAB */}
                {activeTab === "Audit" && (
                  <div className="animate-fade-in">
                    <div className="mb-6">
                      <h3 className="text-lg font-bold" style={{ color: "#1E293B" }}>
                        Action History
                      </h3>
                      <p className="text-[12px] mt-0.5" style={{ color: "#94A3B8" }}>
                        Immutable audit trail — tamper-evident blockchain hashes
                      </p>
                    </div>
                    <div className="relative ml-2">
                      <div
                        className="absolute left-[11px] top-4 bottom-4 w-[2px] rounded-full"
                        style={{
                          background:
                            "linear-gradient(180deg, #4F46E5 0%, #7C3AED 50%, rgba(226,232,240,0.5) 100%)",
                        }}
                      ></div>
                      {workspaceData.audit_logs.map((log: any, i: number) => (
                        <div key={i} className="relative flex gap-5 mb-6 z-10">
                          <div
                            className="w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 bg-white"
                            style={{
                              borderColor: "#4F46E5",
                              boxShadow: "0 0 0 3px rgba(79,70,229,0.15)",
                            }}
                          >
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{ background: "linear-gradient(135deg, #4F46E5, #7C3AED)" }}
                            ></div>
                          </div>
                          <div
                            className="flex-1 p-4 rounded-xl"
                            style={{
                              background: "rgba(248,250,252,0.8)",
                              border: "1px solid rgba(226,232,240,0.6)",
                            }}
                          >
                            <p className="text-[13px]" style={{ color: "#1E293B" }}>
                              <span className="font-bold">{log.user}</span> {log.action}
                            </p>
                            <div className="flex items-center gap-3 mt-1.5">
                              <p
                                className="text-[11px] font-semibold uppercase tracking-wider"
                                style={{ color: "#94A3B8" }}
                              >
                                {log.timestamp}
                              </p>
                              <span
                                className="text-[11px] font-mono px-2 py-0.5 rounded-md"
                                style={{ background: "rgba(79,70,229,0.08)", color: "#4F46E5" }}
                              >
                                {log.hash}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ══ Right Sidebar (Action Widgets) ══ */}
          <div className="w-[340px] flex flex-col gap-4 shrink-0">
            {/* AI Recommendation Panel */}
            <div
              className="rounded-2xl p-6 relative overflow-hidden"
              style={{
                background: "linear-gradient(135deg, #1E1B4B 0%, #2D1B69 100%)",
                border: "1px solid rgba(129,140,248,0.2)",
                boxShadow: "0 8px 32px rgba(79,70,229,0.25)",
              }}
            >
              {/* Ambient glow circles */}
              <div
                className="absolute -top-8 -right-8 w-32 h-32 rounded-full pointer-events-none"
                style={{ background: "radial-gradient(circle, rgba(167,139,250,0.25) 0%, transparent 70%)" }}
              ></div>
              <div
                className="absolute -bottom-6 -left-6 w-24 h-24 rounded-full pointer-events-none"
                style={{ background: "radial-gradient(circle, rgba(79,70,229,0.2) 0%, transparent 70%)" }}
              ></div>

              <div className="relative z-10">
                <div className="flex items-center gap-2.5 mb-5">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{
                      background: "rgba(167,139,250,0.2)",
                      border: "1px solid rgba(167,139,250,0.3)",
                    }}
                  >
                    <span className="material-icons text-[18px]" style={{ color: "#A78BFA" }}>
                      auto_awesome
                    </span>
                  </div>
                  <h3 className="text-[14px] font-extrabold text-white">AI Recommendation</h3>
                </div>

                {/* Confidence bar */}
                <div className="mb-5">
                  <div className="flex justify-between items-center mb-2">
                    <span
                      className="text-[11px] font-bold uppercase tracking-wider"
                      style={{ color: "rgba(148,163,184,0.9)" }}
                    >
                      Confidence Score
                    </span>
                    <span
                      className="text-[13px] font-extrabold"
                      style={{
                        background: "linear-gradient(90deg, #818CF8, #A78BFA)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                      }}
                    >
                      87%
                    </span>
                  </div>
                  <div
                    className="h-2 rounded-full overflow-hidden"
                    style={{ background: "rgba(255,255,255,0.1)" }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: "87%",
                        background: "linear-gradient(90deg, #4F46E5, #7C3AED, #A78BFA)",
                      }}
                    ></div>
                  </div>
                </div>

                {/* Recommendation chip */}
                <div
                  className="flex items-center gap-2.5 p-3 rounded-xl mb-4"
                  style={{
                    background: "rgba(5,150,105,0.15)",
                    border: "1px solid rgba(5,150,105,0.25)",
                  }}
                >
                  <span className="material-icons text-[18px]" style={{ color: "#34D399" }}>
                    check_circle
                  </span>
                  <span className="font-bold text-sm" style={{ color: "#6EE7B7" }}>
                    {workspaceData.ai_assistant.recommended_action || "Approve"}
                  </span>
                </div>

                <p
                  className="text-[12px] leading-relaxed mb-4"
                  style={{ color: "rgba(148,163,184,0.9)" }}
                >
                  This project aligns well with organizational goals and has strong business justification.
                </p>

                <a
                  href="#"
                  className="flex items-center gap-1.5 text-[12px] font-bold transition-colors"
                  style={{ color: "#818CF8" }}
                >
                  View Full Analysis
                  <span className="material-icons text-[14px]">arrow_forward</span>
                </a>
              </div>
            </div>

            {/* Required Decision Panel */}
            <div
              className="rounded-2xl p-6"
              style={{
                background: "white",
                border: "1px solid rgba(226,232,240,0.8)",
                boxShadow: "0 4px 20px rgba(79,70,229,0.06)",
              }}
            >
              <div className="flex items-center gap-2 mb-5">
                <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#DC2626" }}></div>
                <h3 className="text-[14px] font-extrabold" style={{ color: "#1E293B" }}>
                  Required Decision
                </h3>
                <span
                  className="ml-auto text-[10px] font-bold px-2.5 py-1 rounded-full"
                  style={{
                    background: "linear-gradient(135deg, #EEF2FF, #F5F3FF)",
                    color: "#4F46E5",
                    border: "1px solid rgba(79,70,229,0.15)",
                  }}
                >
                  {workspaceData.workflow.current_stage}
                </span>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  onClick={() => submitAction("Approve")}
                  className="w-full py-3 rounded-xl flex items-center justify-center gap-2.5 font-bold text-[13px] text-white transition-all duration-200"
                  style={{
                    background: "linear-gradient(135deg, #059669, #047857)",
                    boxShadow: "0 4px 16px rgba(5,150,105,0.3)",
                  }}
                >
                  <span className="material-icons text-[18px]">check_circle_outline</span>
                  Approve
                </button>

                <button
                  onClick={() => submitAction("Reject")}
                  className="w-full py-3 rounded-xl flex items-center justify-center gap-2.5 font-bold text-[13px] text-white transition-all duration-200"
                  style={{
                    background: "linear-gradient(135deg, #DC2626, #B91C1C)",
                    boxShadow: "0 4px 16px rgba(220,38,38,0.3)",
                  }}
                >
                  <span className="material-icons text-[18px]">highlight_off</span>
                  Reject
                </button>

                <button
                  onClick={() => submitAction("Need More Information")}
                  className="w-full py-3 rounded-xl flex items-center justify-center gap-2.5 font-bold text-[13px] transition-all duration-200"
                  style={{
                    background: "white",
                    color: "#475569",
                    border: "1.5px solid rgba(226,232,240,0.9)",
                    boxShadow: "0 2px 8px rgba(15,23,42,0.06)",
                  }}
                >
                  <span className="material-icons text-[18px]">help_outline</span>
                  Need More Information
                </button>
              </div>
            </div>

            {/* Approval Timeline Panel */}
            <div
              className="rounded-2xl p-6 flex-1"
              style={{
                background: "white",
                border: "1px solid rgba(226,232,240,0.8)",
                boxShadow: "0 4px 20px rgba(79,70,229,0.06)",
              }}
            >
              <h3 className="text-[14px] font-extrabold mb-6" style={{ color: "#1E293B" }}>
                Approval Timeline
              </h3>

              <div className="relative ml-2 mt-2">
                <div
                  className="absolute top-[8px] bottom-0 left-[7px] w-[2px] rounded-full"
                  style={{
                    background: "linear-gradient(180deg, #4F46E5 0%, rgba(226,232,240,0.5) 100%)",
                  }}
                ></div>

                {workspaceData.timeline.map((node: any, i: number) => (
                  <div key={i} className="relative flex items-start gap-4 mb-5 z-10">
                    <div
                      className="w-4 h-4 rounded-full shrink-0 mt-0.5 flex items-center justify-center relative"
                      style={
                        node.status === "Approved"
                          ? {
                              background: "linear-gradient(135deg, #059669, #047857)",
                              boxShadow: "0 0 0 3px rgba(5,150,105,0.15), 0 2px 8px rgba(5,150,105,0.3)",
                            }
                          : node.status === "In Progress"
                          ? {
                              background: "linear-gradient(135deg, #4F46E5, #7C3AED)",
                              boxShadow: "0 0 0 4px rgba(79,70,229,0.15), 0 2px 8px rgba(79,70,229,0.35)",
                            }
                          : { background: "white", border: "2px solid #E2E8F0" }
                      }
                    >
                      {node.status === "Approved" && (
                        <span className="material-icons text-white" style={{ fontSize: "10px", lineHeight: 1 }}>
                          check
                        </span>
                      )}
                      {node.status === "In Progress" && (
                        <div
                          className="w-2 h-2 rounded-full animate-pulse"
                          style={{ background: "rgba(255,255,255,0.9)" }}
                        ></div>
                      )}
                    </div>
                    <div className="flex-1 -mt-0.5">
                      <p
                        className="text-[13px] font-bold"
                        style={{
                          color:
                            node.status === "In Progress"
                              ? "#1E293B"
                              : node.status === "Approved"
                              ? "#374151"
                              : "#94A3B8",
                        }}
                      >
                        {node.stage}
                      </p>
                      <p
                        className="text-[11px] font-semibold mt-0.5"
                        style={{
                          color:
                            node.status === "Approved"
                              ? "#059669"
                              : node.status === "In Progress"
                              ? "#4F46E5"
                              : "#CBD5E1",
                        }}
                      >
                        {node.status}
                        {node.actor && <span> — {node.actor}</span>}
                      </p>
                      {node.action_date && (
                        <p className="text-[11px] font-medium mt-0.5" style={{ color: "#94A3B8" }}>
                          {new Date(node.action_date).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
