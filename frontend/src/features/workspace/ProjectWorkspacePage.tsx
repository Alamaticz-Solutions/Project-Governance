import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router";
import { projectsApi } from "../../lib/api";
import { EpmoReviewForm } from "./forms/EpmoReviewForm";
import { BtaReviewForm } from "./forms/BtaReviewForm";
import { FinanceReviewForm } from "./forms/FinanceReviewForm";
import { EacReviewForm } from "./forms/EacReviewForm";
import { PicReviewForm } from "./forms/PicReviewForm";
import { ConfirmationScreen } from "../../shared/components/ConfirmationScreen";
import type { MeetingCard } from "../../shared/components/MeetingDetail";

export function ProjectWorkspacePage() {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [isSuccess, setIsSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState("Intake Forms");
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Holds the LIVE form data from whichever review form is currently mounted
  const activeFormDataRef = useRef<Record<string, unknown>>({});
  const activeFormValidRef = useRef<boolean>(false);
  const [, forceUpdate] = useState(0); // used to trigger re-render after ref changes

  const handleFormChange = (data: Record<string, unknown>, isValid: boolean) => {
    activeFormDataRef.current = data;
    activeFormValidRef.current = isValid;
    forceUpdate(n => n + 1);
  };

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
    ],
    linkedMeetings: [
      {
        id: 1,
        title: "EPMO Stage Kickoff",
        type: "EPMO Review",
        date: "Aug 31, 2026",
        time: "10:00 AM - 11:30 AM",
        actions: [
          { id: 1, text: "Verify licensing models with vendor", assignee: "Sarah Connor" },
          { id: 2, text: "Check SLA compliance for new architecture", assignee: "Mike K." }
        ],
        summary: "The committee reviewed the initial Intake Request. There was widespread agreement that the AI Agentic Implementation aligns strongly with the Q3 Objectives. We noted a dependency on the cloud infrastructure team and discussed budget constraints for year 2.",
        decisions: [
          "Proceed with EPMO Review phase",
          "Require Cloud Infrastructure sign-off before PIC",
          "Set target deployment date to Q4"
        ],
        containsProcessFlow: true,
        processName: "EPMO Intake Process",
        bpmnStatus: "generated",
        bpmnXml: `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="Definitions_0zxhp6c" targetNamespace="http://bpmn.io/schema/bpmn" exporter="bpmn-js" exporterVersion="12.0.0">
  <process id="Process_1" isExecutable="false">
    <startEvent id="StartEvent_1" name="Intake Submitted">
      <outgoing>Flow_1</outgoing>
    </startEvent>
    <task id="Task_1" name="EPMO Review">
      <incoming>Flow_1</incoming>
      <outgoing>Flow_2</outgoing>
    </task>
    <sequenceFlow id="Flow_1" sourceRef="StartEvent_1" targetRef="Task_1" />
    <endEvent id="EndEvent_1" name="Approved">
      <incoming>Flow_2</incoming>
    </endEvent>
    <sequenceFlow id="Flow_2" sourceRef="Task_1" targetRef="EndEvent_1" />
  </process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="_BPMNShape_StartEvent_2" bpmnElement="StartEvent_1">
        <dc:Bounds x="150" y="100" width="36" height="36" />
        <bpmndi:BPMNLabel>
          <dc:Bounds x="134" y="143" width="69" height="27" />
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_1_di" bpmnElement="Task_1">
        <dc:Bounds x="250" y="78" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="EndEvent_1_di" bpmnElement="EndEvent_1">
        <dc:Bounds x="420" y="100" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_1_di" bpmnElement="Flow_1">
        <di:waypoint x="186" y="118" />
        <di:waypoint x="250" y="118" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_2_di" bpmnElement="Flow_2">
        <di:waypoint x="350" y="118" />
        <di:waypoint x="420" y="118" />
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</definitions>`
      }
    ] as MeetingCard[]
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

  useEffect(() => {
    if (activeTab === "Documents" && id) {
      projectsApi.listDocuments(id).then((docs: any[]) => {
        setWorkspaceData((prev: any) => ({
          ...prev,
          documents: docs.map((d: any) => ({
            id: d.id,
            name: d.filename,
            author: "Automated Upload",
            date: new Date(d.uploadedAt).toLocaleString(),
            url: d.url
          }))
        }));
      }).catch(console.error);
    }
  }, [activeTab, id]);



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

  const submitAction = async (action: string) => {
    if (action === "Approve") {
      // Validate mandatory fields first
      if (!activeFormValidRef.current) {
        setSubmitError("Please complete all required fields in the form before approving.");
        // Trigger the touched state on the EPMO form if visible
        if ((window as any).__epmoMarkTouched) (window as any).__epmoMarkTouched();
        return;
      }
    }
    setSubmitError(null);

    if (window.confirm(`Are you sure you want to ${action} this proposal?`)) {
      if (action === "Approve" || action === "Reject") {
        try {
          const currentStage = workspaceData.workflow.current_stage;
          const formData = action === "Approve" ? activeFormDataRef.current : {};
          await projectsApi.submitDecision(
            id!,
            currentStage,
            action,
            action === "Reject"
              ? `${currentStage} rejected via decision panel.`
              : `${currentStage} approved with complete form data.`,
            formData
          );

          if (action === "Approve") {
            setIsSuccess(true);
          } else {
            alert(`Project successfully marked as ${action}ed.`);
          }
        } catch (err: any) {
          console.error(err);
          alert(`Submit failed: ${err.message || "Unknown error"}`);
        }
      } else {
        alert(`Simulation Fallback: Recorded ${action}.`);
      }
    }
  };

  if (isSuccess) {
    const stage = workspaceData.workflow.current_stage;
    const isEpmo = stage === "EPMO Review";
    const isBta = stage === "BTA Review";
    const isFinance = stage === "Finance Review";
    const isEac = stage === "EAC Review" || stage === "Prepare for EAC";
    const isPic = stage === "PIC Team" || stage === "Prepare for PIC";

    let titlePrefix = isEpmo ? "EPMO" : (isBta ? "BTA" : (isFinance ? "Finance" : (isEac ? "EAC" : (isPic ? "PIC" : ""))));
    let nextStageStr = isEpmo ? "BTA Review" : (isBta ? "Finance Review" : (isFinance ? "Prepare for EAC" : (isEac ? "PIC Team" : (isPic ? "Completed" : ""))));

    return (
      <div
        className="min-h-[calc(100vh-64px)] w-full flex items-center justify-center p-6 bg-[#0f172a]"
      >
        <ConfirmationScreen
          title={`${titlePrefix} Review Submitted!`}
          message="Your review has been successfully submitted."
          subMessage={`The project will now flow to the ${nextStageStr} stage in the pipeline.`}
        />
      </div>
    );
  }

  return (
    <div
      className="animate-fade-in min-h-[calc(100vh-64px)] font-sans p-8 relative overflow-hidden"
      style={{ background: "#0f172a", color: "#f8fafc" }}
    >
      <div className="absolute inset-0 z-0 pointer-events-none" style={{ background: "linear-gradient(to bottom right, #0f172a, #1e1b4b, #0f172a)" }}></div>

      {loading ? (
        <div className="relative z-10 flex flex-1 items-center justify-center min-h-[60vh]">
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
        <div className="relative z-10 max-w-[1600px] w-full mx-auto flex flex-col gap-6">
          {/* ══ Main Workspace (Top Column) ══ */}
          <div className="w-full flex-col flex gap-4 min-w-0">
            {/* ── Premium Header Card ── */}
            <div
              className="rounded-2xl relative overflow-hidden"
              style={{
                background: "rgba(30, 41, 59, 0.5)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                boxShadow: "0 4px 24px rgba(0,0,0,0.2)"
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
                    <span className="text-gray-500">·</span>
                    <span
                      className="text-[10px] font-bold tracking-widest uppercase text-slate-400"
                    >
                      ASSIGNED TO: UNASSIGNED
                    </span>
                  </div>

                  {/* Project title */}
                  <h1
                    className="text-2xl font-extrabold mb-4 leading-tight text-white"
                    style={{ fontFamily: "'Outfit', sans-serif" }}
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



            {/* ── Tabs Navigation ── */}
            <div className="flex border-b border-[rgba(255,255,255,0.08)] overflow-x-auto mt-4 px-2" style={{ scrollbarWidth: "none" }}>
              {[
                { id: "Intake Forms", icon: "add_box" },
                { id: "Documents", icon: "folder", count: workspaceData.documents.length },
                { id: "Comments", icon: "chat_bubble_outline", count: workspaceData.comments.length },
                { id: "Overview", icon: "description" },
                { id: "Meeting Center", icon: "videocam", count: workspaceData.linkedMeetings.length },
                { id: "Audit Trail", icon: "history" }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-6 py-4 flex items-center gap-2 font-bold text-[13px] whitespace-nowrap transition-colors relative
                    ${activeTab === tab.id ? "text-white" : "text-slate-400 hover:text-slate-200"}`}
                >
                  <span className="material-icons text-[18px] opacity-80">{tab.icon}</span>
                  {tab.id}
                  {tab.count !== undefined && (
                    <span className="ml-1 px-2 py-0.5 rounded-full text-[11px] font-extrabold" style={{ background: activeTab === tab.id ? "rgba(79,70,229,0.2)" : "rgba(255,255,255,0.05)", color: activeTab === tab.id ? "#818CF8" : "#94A3B8" }}>
                      {tab.count}
                    </span>
                  )}
                  {activeTab === tab.id && (
                    <div className="absolute bottom-0 left-0 right-0 h-[3px] rounded-t-full" style={{ background: "linear-gradient(90deg, #4F46E5, #7C3AED)" }} />
                  )}
                </button>
              ))}
            </div>

            {/* ── Tab Content Area ── */}
            <div className="animate-fade-in w-full min-h-[400px]">
              {activeTab === "Intake Forms" && (
                workspaceData.workflow.current_stage === "EPMO Review" ? (
                  <EpmoReviewForm projectId={id || ""} onFormChange={handleFormChange} />
                ) : workspaceData.workflow.current_stage === "BTA Review" ? (
                  <BtaReviewForm projectId={id || ""} onFormChange={handleFormChange} />
                ) : workspaceData.workflow.current_stage === "Finance Review" ? (
                  <FinanceReviewForm projectId={id || ""} onFormChange={handleFormChange} />
                ) : (workspaceData.workflow.current_stage === "EAC Review" || workspaceData.workflow.current_stage === "Prepare for EAC") ? (
                  <EacReviewForm projectId={id || ""} onFormChange={handleFormChange} />
                ) : (workspaceData.workflow.current_stage === "PIC Team" || workspaceData.workflow.current_stage === "Prepare for PIC") ? (
                  <PicReviewForm projectId={id || ""} onFormChange={handleFormChange} />
                ) : (
                  <div className="p-10 text-center bg-[#1E293B] rounded-2xl border border-[rgba(255,255,255,0.08)]">
                    <span className="material-icons text-6xl text-slate-500 mb-4">description</span>
                    <h3 className="text-xl font-bold text-white">Review Form Engine</h3>
                    <p className="text-slate-400 mt-2">The specific review forms for this stage will be rendered here.</p>
                  </div>
                )
              )}

              {activeTab === "Documents" && (
                <div className="p-10 text-center rounded-2xl border border-[rgba(255,255,255,0.05)] bg-[rgba(30,41,59,0.5)] flex flex-col items-center justify-center min-h-[300px]">
                  <div style={{ background: "rgba(79,70,229,0.1)" }} className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 border border-[rgba(79,70,229,0.2)]">
                    <span className="material-icons text-3xl" style={{ color: "#818CF8" }}>folder</span>
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">No documents uploaded yet</h3>
                  <p className="text-sm text-slate-400 mb-6 max-w-md">Upload documents to attach them to this review.</p>
                  <label className="cursor-pointer px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all shadow-lg hover:shadow-indigo-500/20" style={{ background: "linear-gradient(135deg, #4F46E5, #7C3AED)" }}>
                    Upload File
                    <input type="file" multiple className="hidden" onChange={handleFileUpload} />
                  </label>

                  {workspaceData.documents.length > 0 && (
                    <div className="w-full mt-10 text-left">
                      <h4 className="text-white font-bold mb-4">Project Documents</h4>
                      <div className="grid gap-3">
                        {workspaceData.documents.map((doc: any, i: number) => (
                          <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-[rgba(15,23,42,0.6)] border border-[rgba(255,255,255,0.05)]">
                            <div className="flex items-center gap-3">
                              <span className="material-icons text-slate-400">insert_drive_file</span>
                              <div>
                                <p className="text-white text-sm font-bold">{doc.name}</p>
                                <p className="text-xs text-slate-400">Uploaded by {doc.author} • {doc.date}</p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              {doc.url && (
                                <>
                                  <a href={doc.url} target="_blank" rel="noreferrer" className="text-indigo-400 hover:text-indigo-300 transition-colors px-3 py-1.5 text-xs font-bold bg-indigo-500/10 rounded-lg flex items-center gap-1"><span className="material-icons text-[14px]">preview</span> Preview</a>
                                  <a href={doc.url} download className="text-indigo-400 hover:text-indigo-300 transition-colors px-3 py-1.5 text-xs font-bold bg-indigo-500/10 rounded-lg flex items-center gap-1"><span className="material-icons text-[14px]">download</span> Download</a>
                                </>
                              )}
                              <button onClick={() => deleteDocument(i)} className="text-slate-400 hover:text-red-400 transition-colors px-2 py-1.5 flex items-center">
                                <span className="material-icons text-[20px]">delete_outline</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "Comments" && (
                <div className="rounded-2xl border border-[rgba(255,255,255,0.05)] bg-[rgba(30,41,59,0.5)] p-6">
                  <h3 className="text-white font-extrabold text-lg mb-1">Discussion Thread</h3>
                  <p className="text-slate-400 text-xs mb-6 font-semibold">{workspaceData.comments.length} messages in this review</p>

                  <div className="flex flex-col gap-6 mb-6">
                    {workspaceData.comments.map((comment: any, i: number) => (
                      <div key={i} className="flex gap-4">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0" style={{ background: i % 2 === 0 ? "linear-gradient(135deg, #4F46E5, #7C3AED)" : "linear-gradient(135deg, #06B6D4, #3B82F6)", color: "white" }}>
                          {comment.initials}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-baseline gap-2 mb-1">
                            <span className="text-white text-[13px] font-bold">{comment.author}</span>
                            <span className="text-slate-500 text-[11px]">{comment.date}</span>
                          </div>
                          <div className="bg-[rgba(15,23,42,0.6)] border border-[rgba(255,255,255,0.05)] rounded-2xl rounded-tl-none p-4 text-sm text-slate-300">
                            {comment.text}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-4 items-start relative mt-8">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0" style={{ background: "rgba(255,255,255,0.1)", color: "white" }}>
                      ME
                    </div>
                    <div className="flex-1 relative">
                      <input type="text" placeholder="Add a comment... (Press Enter to post)" className="w-full bg-[rgba(15,23,42,0.6)] border border-[rgba(255,255,255,0.1)] rounded-xl py-3.5 px-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#818CF8]" />
                      <button className="absolute right-2 top-1.5 bottom-1.5 px-4 bg-[#4F46E5] hover:bg-[#4338CA] transition-colors rounded-lg text-white font-bold text-[13px]">Post</button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "Overview" && (
                <div className="rounded-2xl border border-[rgba(255,255,255,0.05)] bg-[rgba(30,41,59,0.5)] p-10 flex flex-col items-center justify-center min-h-[300px]">
                  <span className="material-icons text-5xl text-slate-500 mb-4">dashboard</span>
                  <h3 className="text-white font-bold text-lg mb-2">Project Overview</h3>
                  <p className="text-slate-400 text-sm">General project details and executive summary overview.</p>
                </div>
              )}

              {activeTab === "Meeting Center" && (
                <div className="rounded-2xl border border-[rgba(255,255,255,0.05)] bg-[rgba(30,41,59,0.5)] p-6 min-h-[400px] flex flex-col">
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h3 className="text-white font-extrabold text-lg mb-1">Meeting Center</h3>
                      <p className="text-slate-400 text-xs font-semibold">Meetings linked to this request • {workspaceData.linkedMeetings.length} linked</p>
                    </div>
                    <div className="flex gap-3">
                      <button className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[rgba(255,255,255,0.1)] text-white text-[13px] font-bold hover:bg-[rgba(255,255,255,0.05)] transition-colors">
                        <span className="material-icons text-[16px]">upload_file</span>
                        Upload recording (.vtt)
                      </button>
                      <div className="flex rounded-xl overflow-hidden border border-[rgba(99,102,241,0.5)]">
                        <select className="bg-[rgba(15,23,42,0.8)] text-white text-[13px] px-3 py-2 border-r border-[rgba(99,102,241,0.3)] focus:outline-none appearance-none">
                          <option>Or link an existing meeting</option>
                        </select>
                        <button className="bg-[rgba(79,70,229,0.15)] text-[#818CF8] hover:bg-[rgba(79,70,229,0.25)] transition-colors px-4 py-2 text-[13px] font-bold flex items-center gap-2">
                          <span className="material-icons text-[16px]">link</span>
                          Link
                        </button>
                      </div>
                    </div>
                  </div>

                  {workspaceData.linkedMeetings.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-[rgba(255,255,255,0.1)] rounded-xl bg-[rgba(15,23,42,0.3)] min-h-[200px]">
                      <div className="w-12 h-12 rounded-xl bg-[rgba(79,70,229,0.1)] border border-[rgba(79,70,229,0.2)] flex items-center justify-center mb-3">
                        <span className="material-icons text-[#818CF8]">videocam</span>
                      </div>
                      <h4 className="text-white font-bold text-sm mb-1">No meetings linked to this request yet</h4>
                      <p className="text-slate-400 text-xs">Link an existing meeting above, or upload a new one from the global Meeting Center and link it here.</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      {workspaceData.linkedMeetings.map((meeting: any) => (
                        <div key={meeting.id} className="p-4 rounded-xl border border-[rgba(255,255,255,0.05)] bg-[rgba(15,23,42,0.6)] flex justify-between items-center">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-[rgba(79,70,229,0.15)] flex items-center justify-center text-[#818CF8]">
                              <span className="material-icons">event</span>
                            </div>
                            <div>
                              <h4 className="text-white font-bold text-sm">{meeting.title}</h4>
                              <p className="text-slate-400 text-xs">{meeting.date} • {meeting.time}</p>
                            </div>
                          </div>
                          <button className="px-4 py-2 rounded-lg bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.1)] text-white text-[12px] font-bold transition-colors">
                            View Details
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4 mt-6 mt-auto pt-6">
                    <div className="p-4 rounded-xl border border-[rgba(255,255,255,0.05)] bg-[rgba(15,23,42,0.4)] flex justify-between items-center cursor-pointer hover:bg-[rgba(15,23,42,0.6)] transition-colors">
                      <div className="flex items-center gap-3">
                        <span className="material-icons text-[#34D399]">format_quote</span>
                        <span className="text-white font-bold text-sm">Quote index</span>
                      </div>
                      <span className="material-icons text-slate-500">chevron_right</span>
                    </div>
                    <div className="p-4 rounded-xl border border-[rgba(255,255,255,0.05)] bg-[rgba(15,23,42,0.4)] flex justify-between items-center cursor-pointer hover:bg-[rgba(15,23,42,0.6)] transition-colors">
                      <div className="flex items-center gap-3">
                        <span className="material-icons text-[#F59E0B]">track_changes</span>
                        <span className="text-white font-bold text-sm">Tracker</span>
                      </div>
                      <span className="material-icons text-slate-500">chevron_right</span>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "Audit Trail" && (
                <div className="rounded-2xl border border-[rgba(255,255,255,0.05)] bg-[rgba(30,41,59,0.5)] p-6">
                  <h3 className="text-white font-extrabold text-lg mb-1">Action History</h3>
                  <p className="text-slate-400 text-xs mb-8">Immutable audit trail — tamper-evident blockchain hashes</p>

                  <div className="relative pl-4 border-l-2 border-[#1E293B] flex flex-col gap-8">
                    {workspaceData.audit_logs.map((log: any, i: number) => (
                      <div key={i} className="relative">
                        <div className="absolute -left-[25px] w-5 h-5 rounded-full border-[3px] border-[#0f172a] flex items-center justify-center top-0" style={{ background: i === 0 ? "linear-gradient(135deg, #4F46E5, #7C3AED)" : "#1E293B" }}>
                          {i === 0 && <span className="w-1.5 h-1.5 rounded-full bg-white"></span>}
                        </div>
                        <div className="bg-[rgba(15,23,42,0.6)] border border-[rgba(255,255,255,0.02)] rounded-xl p-4 ml-4">
                          <p className="text-sm text-slate-300">
                            <span className="text-white font-bold mr-1">{log.user}</span>
                            {log.action}
                          </p>
                          <div className="flex items-center gap-3 mt-2">
                            <span className="text-[10px] font-bold text-slate-500 uppercase">{log.timestamp}</span>
                            <span className="text-[10px] bg-[rgba(79,70,229,0.1)] text-[#818CF8] px-2 py-0.5 rounded border border-[rgba(79,70,229,0.2)] font-mono">{log.hash}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* ══ Bottom Row (Action Widgets) ══ */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full">
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
                background: "rgba(30, 41, 59, 0.5)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(255,255,255,0.08)",
                boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
              }}
            >
              <div className="flex items-center gap-2 mb-5">
                <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#DC2626" }}></div>
                <h3 className="text-[14px] font-extrabold text-white">
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
                    background: "rgba(255,255,255,0.05)",
                    color: "#E2E8F0",
                    border: "1.5px solid rgba(255,255,255,0.1)",
                    boxShadow: "0 2px 8px rgba(15,23,42,0.06)",
                  }}
                >
                  <span className="material-icons text-[18px]">help_outline</span>
                  Need More Information
                </button>
              </div>

              {/* Validation error shown when Approve clicked without complete form */}
              {submitError && (
                <div className="mt-3 flex items-start gap-2 p-3 rounded-xl border border-red-500/30 bg-red-500/10">
                  <span className="material-icons text-red-400 text-[16px] mt-0.5 shrink-0">error_outline</span>
                  <p className="text-[12px] font-bold text-red-400 leading-snug">{submitError}</p>
                </div>
              )}
            </div>

            {/* Approval Timeline Panel */}
            <div
              className="rounded-2xl p-6 flex-1"
              style={{
                background: "rgba(30, 41, 59, 0.5)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(255,255,255,0.08)",
                boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
              }}
            >
              <h3 className="text-[14px] font-extrabold mb-6 text-white">
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
                              ? "#F8FAFC"
                              : node.status === "Approved"
                                ? "#94A3B8"
                                : "#64748B",
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
        </div>
      )}
    </div>
  );
}
