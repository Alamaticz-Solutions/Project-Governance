import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { projectsApi, workspaceApi } from "../../lib/api";
import type { GateSubmission, Project } from "../../lib/types";

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [submissions, setSubmissions] = useState<GateSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("Intake Request");

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([projectsApi.get(id), workspaceApi.get(id)])
      .then(([p, w]) => { setProject(p); setSubmissions(w.submissions || []); setLoading(false); })
      .catch(() => {
        projectsApi.get(id)
          .then(p => { setProject(p); setLoading(false); })
          .catch(e => { setError(e.message); setLoading(false); });
      });
  }, [id]);

  if (loading) return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "linear-gradient(135deg,#4F46E5,#7C3AED)" }}>
          <span className="material-icons text-white text-2xl animate-spin">autorenew</span>
        </div>
        <p className="text-sm font-semibold text-slate-400">Loading project history...</p>
      </div>
    </div>
  );

  if (error || !project) return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center text-red-400">
      <div className="bg-red-500/10 p-6 rounded-xl border border-red-500/20 text-center">
        <span className="material-icons text-4xl mb-2">error_outline</span>
        <p>Failed to load project: {error || "Not found"}</p>
      </div>
    </div>
  );

  // Find submissions by stage keyword (status = "approved" OR any status — show what was submitted)
  const getSub = (keyword: string): GateSubmission | undefined =>
    submissions.find(s => s.stage?.toLowerCase().includes(keyword.toLowerCase()));

  const epmoSub = getSub("epmo");
  const btaSub = getSub("bta");
  const financeSub = getSub("finance");
  const eacSub = getSub("eac");
  const picSub = getSub("pic");

  // ─── Stage-Gate pipeline ───────────────────────────────────────────
  const PIPELINE = [
    "EPMO Review", "BTA Review", "Finance Review",
    "EAC Review", "Prepare for EAC", "PIC Team", "Prepare for PIC", "Completed",
  ];
  const currentStage = project.current_stage || "EPMO Review";
  const lastCompleted = project.last_stage_completed || "";

  const isPast = (stageName: string): boolean => {
    const ci = PIPELINE.findIndex(s => s.toLowerCase() === currentStage.toLowerCase());
    const si = PIPELINE.findIndex(s => s.toLowerCase() === stageName.toLowerCase());
    if (ci > si && si !== -1) return true;
    if (lastCompleted.toLowerCase().includes(stageName.toLowerCase())) return true;
    if (currentStage.toLowerCase() === "completed") return true;
    return false;
  };

  const epmoApproved = isPast("EPMO Review") || (epmoSub?.decision?.toLowerCase() === "approve" || epmoSub?.status === "approved");
  const btaApproved = isPast("BTA Review") || (btaSub?.decision?.toLowerCase() === "approve" || btaSub?.status === "approved");
  const financeApproved = isPast("Finance Review") || (financeSub?.decision?.toLowerCase() === "approve" || financeSub?.status === "approved");
  const eacApproved = isPast("EAC Review") || isPast("Prepare for EAC") || (eacSub?.decision?.toLowerCase() === "approve" || eacSub?.status === "approved");
  const picApproved = isPast("PIC Team") || isPast("Prepare for PIC") || (picSub?.decision?.toLowerCase() === "approve" || picSub?.status === "approved");

  const tabs = [
    { name: "Intake Request", icon: "article", visible: true, badge: null },
    { name: "EPMO Review", icon: "fact_check", visible: epmoApproved, badge: "Approved" },
    { name: "BTA Review", icon: "architecture", visible: btaApproved, badge: "Approved" },
    { name: "Finance Review", icon: "payments", visible: financeApproved, badge: "Approved" },
    { name: "EAC Review", icon: "gavel", visible: eacApproved, badge: "Approved" },
    { name: "PIC Team", icon: "stars", visible: picApproved, badge: "Complete" },
  ].filter(t => t.visible);

  const d = (sub: GateSubmission | undefined, key: string): string =>
    (sub?.data?.[key] as string) || "";
  const b = (sub: GateSubmission | undefined, key: string): boolean =>
    !!(sub?.data?.[key]);

  return (
    <div className="animate-fade-in min-h-[calc(100vh-64px)] font-sans p-8 relative overflow-hidden" style={{ background: "#0f172a", color: "#f8fafc" }}>
      <div className="absolute inset-0 z-0 pointer-events-none" style={{ background: "linear-gradient(to bottom right,#0f172a,#1e1b4b,#0f172a)" }} />

      <div className="relative z-10 max-w-[1400px] w-full mx-auto flex flex-col gap-6">

        {/* ── Header Card ── */}
        <div className="rounded-2xl relative overflow-hidden" style={{ background: "rgba(30,41,59,0.5)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 4px 24px rgba(0,0,0,0.2)" }}>
          <div className="absolute top-0 left-0 right-0 h-1" style={{ background: "linear-gradient(90deg,#4F46E5 0%,#7C3AED 50%,#06B6D4 100%)" }} />
          <div className="flex justify-between items-start px-8 pt-6 pb-4">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase" style={{ background: "linear-gradient(135deg,#EEF2FF,#F5F3FF)", color: "#4F46E5" }}>READ ONLY RECORD</span>
                <span className="text-gray-500">·</span>
                <span className="text-[10px] font-bold tracking-widest uppercase text-slate-400">ID: {project.project_number}</span>
              </div>
              <h1 className="text-2xl font-extrabold mb-3 leading-tight text-white">{project.project_name}</h1>
              <div className="flex items-center gap-5 flex-wrap">
                <MetaItem icon="person_outline" value={project.requestor_name || "Unknown"} />
                <MetaItem icon="business" value={project.department || "No Department"} />
                <MetaItem icon="calendar_today" value={project.created_at ? new Date(project.created_at).toLocaleDateString() : "—"} />
              </div>
            </div>
            <div className="flex-shrink-0 px-5 py-3.5 rounded-xl flex flex-col items-center text-center" style={{ background: "rgba(79,70,229,0.1)", border: "1px solid rgba(79,70,229,0.2)" }}>
              <span className="text-[9px] font-bold tracking-widest uppercase mb-1.5 text-indigo-400">Current Stage</span>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full animate-pulse bg-indigo-500" />
                <span className="text-[13px] font-extrabold text-white">{currentStage}</span>
              </div>
            </div>
          </div>

          {/* Pipeline Ribbon */}
          <div className="px-8 pb-6">
            <div className="flex items-center flex-wrap gap-0">
              {[
                { label: "Intake", done: true, active: false },
                { label: "EPMO", done: epmoApproved, active: currentStage === "EPMO Review" },
                { label: "BTA", done: btaApproved, active: currentStage === "BTA Review" },
                { label: "Finance", done: financeApproved, active: currentStage === "Finance Review" },
                { label: "EAC", done: eacApproved, active: currentStage.includes("EAC") },
                { label: "PIC", done: picApproved, active: currentStage.includes("PIC") },
              ].map((step, idx, arr) => (
                <div key={step.label} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold"
                      style={step.done ? { background: "linear-gradient(135deg,#059669,#047857)", boxShadow: "0 0 0 2px rgba(5,150,105,0.25)", color: "white" }
                        : step.active ? { background: "linear-gradient(135deg,#4F46E5,#7C3AED)", boxShadow: "0 0 0 3px rgba(79,70,229,0.3)", color: "white" }
                          : { background: "rgba(30,41,59,0.8)", border: "2px solid rgba(100,116,139,0.4)", color: "#475569" }}>
                      {step.done ? <span className="material-icons text-[14px]">check</span> : idx + 1}
                    </div>
                    <span className="text-[9px] font-bold mt-1 whitespace-nowrap" style={{ color: step.done ? "#6EE7B7" : step.active ? "#A5B4FC" : "#475569" }}>
                      {step.label}
                    </span>
                  </div>
                  {idx < arr.length - 1 && <div className="h-[2px] w-8 mx-1 mb-4 rounded-full" style={{ background: step.done ? "linear-gradient(90deg,#059669,#047857)" : "rgba(100,116,139,0.2)" }} />}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(30,41,59,0.5)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="flex px-2 pt-1 border-b border-white/5 overflow-x-auto">
            {tabs.map(tab => (
              <button key={tab.name} onClick={() => setActiveTab(tab.name)}
                className="flex items-center gap-2 px-5 py-4 text-[13px] font-bold border-b-2 transition-all duration-200 whitespace-nowrap"
                style={activeTab === tab.name
                  ? { color: "#4F46E5", borderColor: "#4F46E5", background: "linear-gradient(180deg,rgba(79,70,229,0.06) 0%,transparent 100%)" }
                  : { color: "#94A3B8", borderColor: "transparent" }}>
                <span className="material-icons text-[18px]">{tab.icon}</span>
                {tab.name}
                {tab.badge && (
                  <span className="ml-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: tab.badge === "Complete" ? "rgba(16,185,129,0.2)" : "rgba(16,185,129,0.15)", color: "#6EE7B7", border: "1px solid rgba(16,185,129,0.25)" }}>
                    {tab.badge === "Approved" ? "✓" : "★"}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── Content ── */}
        <div className="rounded-2xl p-8" style={{ background: "rgba(30,41,59,0.5)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 8px 32px rgba(0,0,0,0.2)" }}>

          {/* ═══════════════ INTAKE REQUEST ═══════════════ */}
          {activeTab === "Intake Request" && (
            <div className="animate-fade-in space-y-8">
              <SH title="Intake Request" sub={`Project ID: ${project.project_number}`} icon="article" />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <Card title="Basic Information" icon="info">
                  <F l="Requestor Name" v={project.requestor_name} />
                  <F l="Requesting Department" v={project.department} />
                  <F l="Business Unit" v={project.business_unit} />
                  <F l="Request Type" v={project.request_type} />
                </Card>
                <Card title="Strategic & Budget" icon="payments">
                  <F l="Budget Type" v={project.budget_type} />
                  <F l="Estimated Budget" v={project.budget_estimated ? `$${project.budget_estimated.toLocaleString()}` : null} />
                  <F l="Priority" v={project.priority} />
                  <F l="Risk Level" v={project.risk_level} />
                </Card>
                <Card title="Compliance & IT" icon="security">
                  <BF l="IT Involvement Required" v={project.it_involvement} />
                  <BF l="External Vendor Solution" v={project.vendor_required} />
                  <BF l="Contains PHI Data" v={project.has_phi_data} />
                  <BF l="Is Clinical" v={project.is_clinical} />
                  <BF l="HIPAA Applicable" v={project.is_hipaa_applicable} />
                </Card>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <LF l="Problem / Opportunity Statement" v={project.problem_statement} />
                <LF l="Desired Outcome" v={project.desired_outcome} />
                <LF l="What Do You Do Today?" v={project.what_do_you_do_today} />
                <LF l="What Transpires If We Do Nothing?" v={project.what_transpires_if_nothing} />
                <LF l="Strategic Alignment & Rationale" v={project.strategic_alignment} />
                <LF l="Additional Notes" v={project.notes} />
              </div>
            </div>
          )}

          {/* ═══════════════ EPMO REVIEW ═══════════════ */}
          {activeTab === "EPMO Review" && (
            <div className="animate-fade-in space-y-6">
              <SH title="EPMO Review" sub={ts(epmoSub)} icon="fact_check" />
              <Banner team="EPMO Review" msg="The EPMO team has reviewed and approved this request for the BTA stage." />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card title="EPMO Assignments" icon="assignment_ind">
                  <F l="Strategy Alignment" v={d(epmoSub, "epmo_strategy")} />
                  <F l="PIC Needed" v={d(epmoSub, "epmo_pic_needed")} />
                  <F l="PM Required" v={d(epmoSub, "epmo_pm_required")} />
                  <F l="Related Project" v={d(epmoSub, "epmo_related_project")} />
                </Card>
                <Card title="EPMO Decision" icon="gavel">
                  <F l="Decision" v={epmoSub?.decision} />
                  <F l="Comments" v={d(epmoSub, "epmo_comments")} />
                  <F l="Submitted At" v={epmoSub?.submitted_at ? new Date(epmoSub.submitted_at).toLocaleString() : "—"} />
                </Card>
              </div>
              <Meta sub={epmoSub} />
            </div>
          )}

          {/* ═══════════════ BTA REVIEW — All 9 Screens ═══════════════ */}
          {activeTab === "BTA Review" && (
            <div className="animate-fade-in space-y-8">
              <SH title="BTA Review" sub={ts(btaSub)} icon="architecture" />
              <Banner team="BTA Review" msg="The BTA team completed their 9-screen architecture review and approved this request for Finance." />

              {/* Screen 1: Project Identification */}
              <Section title="1. Project Identification" icon="architecture">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <F l="Project Name" v={d(btaSub, "projectName")} />
                  <F l="Requestor Name" v={d(btaSub, "requestorName")} />
                  <F l="Requesting Department" v={d(btaSub, "requestingDepartment")} />
                  <F l="Project Status" v={d(btaSub, "projectStatus")} />
                  <F l="Project Type" v={d(btaSub, "projectType")} />
                  <F l="Primary BTA" v={d(btaSub, "primaryBTA")} />
                </div>
                <LF l="Target Business Department" v={d(btaSub, "targetBusinessDepartment")} />
              </Section>

              {/* Screen 2: Business Objectives */}
              <Section title="2. Business Objectives" icon="lightbulb">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <LF l="Problem Statement" v={d(btaSub, "problemStatement")} />
                  <LF l="Business Objective" v={d(btaSub, "businessObjective")} />
                  <LF l="Business Value / ROI" v={d(btaSub, "businessValue")} />
                </div>
              </Section>

              {/* Screen 3: Scope & Requirements */}
              <Section title="3. Scope & Requirements" icon="fact_check">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <LF l="Strategic Alignment" v={d(btaSub, "strategicAlignment")} />
                  <LF l="In Scope Items" v={d(btaSub, "inScope")} />
                  <LF l="Out of Scope Items" v={d(btaSub, "outOfScope")} />
                </div>
              </Section>

              {/* Screen 4: Technical Landscape */}
              <Section title="4. Technical Landscape" icon="dns">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Card title="Solution Type" icon="category">
                    <BF l="Is a New Solution?" v={b(btaSub, "isNewSolution")} />
                    <BF l="IT Involvement Required?" v={b(btaSub, "itInvolvement")} />
                  </Card>
                </div>
                <LF l="Systems Impacted" v={d(btaSub, "systemsImpacted")} />
              </Section>

              {/* Screen 5: Data Security & Privacy */}
              <Section title="5. Data Security & Privacy" icon="security">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Card title="Data Classification" icon="shield">
                    <BF l="Contains PHI/PII Data" v={b(btaSub, "hasPhiData")} />
                    <BF l="HIPAA Compliance Applicable" v={b(btaSub, "isHipaaApplicable")} />
                    <F l="Data Classification Level" v={d(btaSub, "dataClassification")} />
                  </Card>
                </div>
              </Section>

              {/* Screen 6: Financials & Resources */}
              <Section title="6. Financials & Resources" icon="payments">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card title="Budget" icon="account_balance">
                    <F l="Estimated Budget" v={d(btaSub, "budgetEstimated")} />
                    <F l="Budget Type" v={d(btaSub, "budgetType")} />
                    <BF l="Vendor Required?" v={b(btaSub, "vendorRequired")} />
                  </Card>
                </div>
              </Section>

              {/* Screen 7: Timeline & Urgency */}
              <Section title="7. Timeline & Urgency" icon="calendar_month">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <F l="Requested Start Date" v={d(btaSub, "requestedStartDate")} />
                  <F l="Requested End Date" v={d(btaSub, "requestedEndDate")} />
                  <F l="Priority" v={d(btaSub, "priority")} />
                  <F l="Risk Level" v={d(btaSub, "riskLevel")} />
                </div>
              </Section>

              {/* Screen 8: Dependencies & Risks */}
              <Section title="8. Dependencies & Risks" icon="warning">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <LF l="Known Risks & Mitigation Plans" v={d(btaSub, "knownRisks")} />
                  <LF l="Key Dependencies" v={d(btaSub, "dependencies")} />
                </div>
              </Section>

              {/* Screen 9: BTA Checklist */}
              <Section title="9. BTA Gate Checklist" icon="fact_check">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <CheckItem label="Architectural Review Passed?" value={d(btaSub, "btaChecklist_architectural")} />
                  <CheckItem label="Security Sign-off Required?" value={d(btaSub, "btaChecklist_security")} />
                </div>
              </Section>

              <Meta sub={btaSub} />
            </div>
          )}

          {/* ═══════════════ FINANCE REVIEW ═══════════════ */}
          {activeTab === "Finance Review" && (
            <div className="animate-fade-in space-y-8">
              <SH title="Finance Review" sub={ts(financeSub)} icon="payments" />
              <Banner team="Finance Review" msg="Finance team completed ROI and cost analysis and approved this request." />

              {/* Section 1: Detailed Cost Plan */}
              <Section title="1. Detailed Cost Plan" icon="table_chart">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <F l="Total CapEx" v={d(financeSub, "totalCapex")} />
                  <F l="Total OpEx" v={d(financeSub, "totalOpex")} />
                  <F l="Total Run Costs" v={d(financeSub, "totalRunCosts")} />
                  <F l="Grand Total" v={d(financeSub, "grandTotal")} />
                </div>
                <LF l="Memo: FY OpEx Impact" v={d(financeSub, "memoOpex")} />
                {/* Cost Items Table */}
                {Array.isArray(financeSub?.data?.costItems) && (financeSub!.data.costItems as any[]).length > 0 && (
                  <div className="rounded-xl overflow-hidden border border-white/10">
                    <table className="w-full text-xs whitespace-nowrap">
                      <thead>
                        <tr className="bg-white/5 text-slate-400">
                          {["Cost Item", "Justification", "Category", "Type", "FY24", "FY25", "FY26", "FY27"].map(h => (
                            <th key={h} className="text-left px-3 py-2 font-bold border-b border-white/10">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(financeSub!.data.costItems as any[]).map((item: any, i: number) => (
                          <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                            <td className="px-3 py-2 text-slate-200 font-medium">{item.name || "—"}</td>
                            <td className="px-3 py-2 text-slate-400">{item.justification || "—"}</td>
                            <td className="px-3 py-2 text-slate-400">{item.category || "—"}</td>
                            <td className="px-3 py-2"><span className="px-2 py-0.5 rounded text-[10px] font-bold text-emerald-400 bg-emerald-500/10">{item.costType || "—"}</span></td>
                            <td className="px-3 py-2 text-slate-300">{item.fy24 ? `$${Number(item.fy24).toLocaleString()}` : "—"}</td>
                            <td className="px-3 py-2 text-slate-300">{item.fy25 ? `$${Number(item.fy25).toLocaleString()}` : "—"}</td>
                            <td className="px-3 py-2 text-slate-300">{item.fy26 ? `$${Number(item.fy26).toLocaleString()}` : "—"}</td>
                            <td className="px-3 py-2 text-slate-300">{item.fy27 ? `$${Number(item.fy27).toLocaleString()}` : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Section>

              {/* Section 2: ROI Analysis */}
              <Section title="2. ROI Analysis" icon="trending_up">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                  {[
                    { l: "Dev & Impl Costs", k: "devImplCosts" },
                    { l: "Software Licensing", k: "softwareLicensing" },
                    { l: "Annual Costs", k: "annualCosts" },
                    { l: "Annual Benefits", k: "annualBenefits" },
                    { l: "Payback Period (yrs)", k: "paybackPeriod" },
                    { l: "ROI Percentage", k: "roiPercentage" },
                  ].map(({ l, k }) => <F key={k} l={l} v={d(financeSub, k)} />)}
                </div>
                <LF l="Finance Narrative" v={d(financeSub, "financeNarrative")} />
              </Section>

              {/* Section 3: Finance Checklist */}
              <Section title="3. Finance Mandatory Checklist" icon="fact_check">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <CheckItem label="Budget Alignment Verified?" value={d(financeSub, "financeChecklist_budget")} />
                  <CheckItem label="CapEx Approved?" value={d(financeSub, "financeChecklist_capex")} />
                </div>
              </Section>

              <Meta sub={financeSub} />
            </div>
          )}

          {/* ═══════════════ EAC REVIEW ═══════════════ */}
          {activeTab === "EAC Review" && (
            <div className="animate-fade-in space-y-8">
              <SH title="EAC Review (Prepare for EAC)" sub={ts(eacSub)} icon="gavel" />
              <Banner team="EAC Review" msg="Enterprise Architecture Council completed their 10-screen dossier review." />

              <Section title="1. Project Overview & Identification" icon="article">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <F l="Project Name" v={d(eacSub, "projectName")} />
                    <F l="Project Type" v={d(eacSub, "projectType")} />
                    <F l="Requestor Name" v={d(eacSub, "requestorName")} />
                    <F l="Project Status" v={d(eacSub, "projectStatus")} />
                    <F l="Primary BTA" v={d(eacSub, "primaryBTA")} />
                  </div>
                  <LF l="Target Business Department" v={d(eacSub, "targetBusinessDepartment")} />
                </Section>

                <Section title="2. Business Justification" icon="lightbulb">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <LF l="Problem / Opportunity Statement" v={d(eacSub, "problemStatement")} />
                    <LF l="Strategic Alignment" v={d(eacSub, "strategicAlignment")} />
                    <LF l="EA Principles Alignment" v={d(eacSub, "eaPrinciplesAlignment")} />
                  </div>
                </Section>

                <Section title="3. Key Stakeholders" icon="groups">
                  {Array.isArray(eacSub?.data?.stakeholders) && (eacSub!.data.stakeholders as any[]).length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {(eacSub!.data.stakeholders as any[]).map((sh: any, i: number) => (
                        <span key={i} className="bg-indigo-500/10 border border-indigo-500/25 text-indigo-300 px-3 py-1.5 rounded-lg text-xs font-semibold">
                          {sh.name || sh}{sh.role ? ` — ${sh.role}` : ""}
                        </span>
                      ))}
                    </div>
                  ) : <p className="text-slate-500 italic text-sm">No stakeholders documented.</p>}
                </Section>

                <Section title="4. Current State Analysis" icon="analytics">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <LF l="Current State Architecture" v={d(eacSub, "currentStateArchitecture")} />
                    <LF l="Current State Pain Points" v={d(eacSub, "currentStatePainPoints")} />
                    <LF l="Current Systems" v={d(eacSub, "currentStateSystems")} />
                  </div>
                </Section>

                <Section title="5. Proposed Solution" icon="dns">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <LF l="Solution Overview" v={d(eacSub, "solutionOverview")} />
                    <LF l="Tech Stack" v={d(eacSub, "techStack")} />
                    <LF l="Data Strategy" v={d(eacSub, "dataStrategy")} />
                    <LF l="Security Strategy" v={d(eacSub, "securityStrategy")} />
                    <LF l="Integration Strategy" v={d(eacSub, "integrationStrategy")} />
                    <LF l="Infrastructure Requirements" v={d(eacSub, "infrastructureRequirements")} />
                  </div>
                </Section>

                <Section title="6. Risk & Compliance" icon="gpp_maybe">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <LF l="Compliance Standards" v={d(eacSub, "complianceStandards")} />
                    <LF l="How Addresses Compliance" v={d(eacSub, "howAddressesCompliance")} />
                  </div>
                  {Array.isArray(eacSub?.data?.risksList) && (eacSub!.data.risksList as any[]).length > 0 && (
                    <div className="mt-4 rounded-xl overflow-hidden border border-white/10">
                      <table className="w-full text-xs">
                        <thead><tr className="bg-white/5 text-slate-400">
                          {["Risk", "Mitigation", "Likelihood", "Impact", "Owner"].map(h => <th key={h} className="text-left px-3 py-2 font-bold border-b border-white/10">{h}</th>)}
                        </tr></thead>
                        <tbody>
                          {(eacSub!.data.risksList as any[]).map((r: any, i: number) => (
                            <tr key={i} className="border-b border-white/5"><td className="px-3 py-2 text-slate-200">{r.description}</td><td className="px-3 py-2 text-slate-400">{r.mitigation}</td><td className="px-3 py-2 text-amber-400">{r.likelihood}</td><td className="px-3 py-2 text-red-400">{r.impact}</td><td className="px-3 py-2 text-slate-300">{r.owner}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Section>

                <Section title="7. Timeline & Resources" icon="calendar_month">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <F l="Start Date" v={d(eacSub, "startDate")} />
                    <F l="End Date" v={d(eacSub, "endDate")} />
                    <F l="Estimated Budget" v={d(eacSub, "estimatedBudget")} />
                    <F l="Funding Source" v={d(eacSub, "fundingSource")} />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                    <LF l="Budget Breakdown" v={d(eacSub, "budgetBreakdown")} />
                    <LF l="Human Resources" v={d(eacSub, "humanResources")} />
                  </div>
                </Section>

                <Section title="8. Business Impact" icon="trending_up">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <LF l="Operational Impact" v={d(eacSub, "impactOperations")} />
                    <LF l="Revenue Impact" v={d(eacSub, "impactRevenue")} />
                    <LF l="Cost Savings" v={d(eacSub, "impactSavings")} />
                    <LF l="Customer Impact" v={d(eacSub, "impactCustomer")} />
                    <LF l="Competitive Impact" v={d(eacSub, "impactCompetitive")} />
                    <LF l="Project Rationale" v={d(eacSub, "rationale")} />
                  </div>
                </Section>

                <Section title="9. Feasibility & Readiness" icon="rocket_launch">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <LF l="Scalability Plan" v={d(eacSub, "scalability")} />
                    <LF l="Future Readiness" v={d(eacSub, "futureReadiness")} />
                    <LF l="Project Feasibility Statement" v={d(eacSub, "feasibilityStatement")} />
                    <LF l="IT Capabilities Alignment" v={d(eacSub, "itCapabilitiesAlignment")} />
                    <LF l="New Skills Required" v={d(eacSub, "newSkillsRequired")} />
                  </div>
                </Section>

                <Section title="10. EAC Gate Checklist" icon="fact_check">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <CheckItem label="Architecture Verified by EAC Committee?" value={d(eacSub, "eacChecklist_verified")} />
                  </div>
                </Section>

                <Meta sub={eacSub} />
              </div>
          )}

              {/* ═══════════════ PIC TEAM ═══════════════ */}
              {activeTab === "PIC Team" && (
                <div className="animate-fade-in space-y-8">
                  <SH title="PIC Team Review" sub={ts(picSub)} icon="stars" />
                  <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}>
                    <span className="material-icons text-emerald-400 text-xl">emoji_events</span>
                    <div>
                      <p className="text-sm font-bold text-emerald-400">PIC Team — Workflow Complete</p>
                      <p className="text-xs text-slate-400">This project has completed all governance stages and received final PIC approval.</p>
                    </div>
                  </div>

                  <Section title="1. Core Project Definition" icon="article">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <LF l="Problem / Opportunity Statement" v={d(picSub, "problemStatement")} />
                      <LF l="Scope of Project (High Level)" v={d(picSub, "scope")} />
                    </div>
                  </Section>

                  <Section title="2. Vendor Recommendation" icon="storefront">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <F l="Primary Recommended Vendor" v={d(picSub, "vendorName")} />
                      <LF l="Justification for Recommended Vendor" v={d(picSub, "vendorJustification")} />
                      <LF l="Specific Benefits of Recommended Vendor" v={d(picSub, "vendorBenefits")} />
                    </div>
                  </Section>

                  <Section title="3. Project Evaluation & Benefit" icon="trending_up">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <F l="Primary Benefit Category" v={d(picSub, "benefitCategory")} />
                      <F l="Annual Value Year 1" v={d(picSub, "annualValueY1")} />
                      <F l="Annual Value Year 2" v={d(picSub, "annualValueY2")} />
                      <LF l="Benefit Calculation Methodology" v={d(picSub, "benefitMethodology")} />
                    </div>
                  </Section>

                  <Section title="4. Cost Plan & ROI" icon="savings">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <F l="Total CapEx" v={d(picSub, "capex")} />
                      <F l="Net Present Value (NPV)" v={d(picSub, "npv")} />
                      <F l="Internal Rate of Return (IRR)" v={d(picSub, "irr")} />
                      <F l="Payback Period (Months)" v={d(picSub, "paybackMonths")} />
                    </div>
                  </Section>

                  <Section title="5. Project Execution & Ask" icon="engineering">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <LF l="Milestone Target Dates" v={d(picSub, "milestones")} />
                      <LF l="Resource Ask (FTE Requirements)" v={d(picSub, "resourceAsk")} />
                    </div>
                  </Section>

                  <Section title="6. Supporting Information" icon="attach_file">
                    <LF l="Preparation Comments" v={d(picSub, "comments")} />
                  </Section>

                  <Section title="7. PIC Approval Checklist" icon="fact_check">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <CheckItem label="Financial Dossier Attached & Verified?" value={d(picSub, "picChecklist_verified")} />
                    </div>
                  </Section>

                  <Meta sub={picSub} />
                </div>
              )}

            </div>
      </div>
      </div>
      );
}

      // ─── Helper Components ─────────────────────────────────────────────────────────

      function MetaItem({icon, value}: {icon: string; value: string }) {
  return (
      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
        <span className="material-icons text-[14px]">{icon}</span>
        <span className="text-slate-300">{value}</span>
      </div>
      );
}

      function SH({title, sub, icon}: {title: string; sub: string; icon: string }) {
  return (
      <div className="flex items-center gap-4 pb-4 border-b border-slate-700/50">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(79,70,229,0.15)", border: "1px solid rgba(79,70,229,0.25)" }}>
          <span className="material-icons text-indigo-400">{icon}</span>
        </div>
        <div>
          <h2 className="text-lg font-extrabold text-white">{title}</h2>
          <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
        </div>
      </div>
      );
}

      function ts(sub: GateSubmission | undefined): string {
  const dt = sub?.submitted_at ? new Date(sub.submitted_at).toLocaleDateString() : "—";
      return `Reviewed on ${dt} · Decision: ${sub?.decision || "—"}`;
}

      function Banner({team, msg}: {team: string; msg: string }) {
  return (
      <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}>
        <span className="material-icons text-emerald-400 text-xl">verified</span>
        <div>
          <p className="text-sm font-bold text-emerald-400">{team} — Approved</p>
          <p className="text-xs text-slate-400">{msg}</p>
        </div>
      </div>
      );
}

      function Section({title, icon, children}: {title: string; icon: string; children: React.ReactNode }) {
  return (
      <div className="rounded-xl p-6 space-y-4" style={{ background: "rgba(15,23,42,0.4)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-700/40">
          <span className="material-icons text-indigo-400 text-[18px]">{icon}</span>
          <h3 className="text-sm font-bold text-slate-200">{title}</h3>
        </div>
        {children}
      </div>
      );
}

      function Card({title, icon, children}: {title: string; icon: string; children: React.ReactNode }) {
  return (
      <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-700/50 text-slate-300">
          <span className="material-icons text-lg">{icon}</span>
          <h4 className="font-bold text-sm">{title}</h4>
        </div>
        <div className="space-y-3">{children}</div>
      </div>
      );
}

      function Meta({sub}: {sub: GateSubmission | undefined }) {
  if (!sub) return null;
      return (
      <div className="flex items-center gap-4 pt-4 border-t border-slate-700/40 text-xs text-slate-500">
        <span className="flex items-center gap-1"><span className="material-icons text-[14px]">schedule</span>Submitted: {sub.submitted_at ? new Date(sub.submitted_at).toLocaleString() : "—"}</span>
        <span className="flex items-center gap-1"><span className="material-icons text-[14px]">verified</span>Decision: <span className="font-bold text-emerald-400 ml-1">{sub.decision}</span></span>
      </div>
      );
}

      function CheckItem({label, value}: {label: string; value: string }) {
  const isYes = value?.toLowerCase() === "yes";
      return (
      <div className="flex items-center gap-3 bg-slate-800/50 p-3 rounded-lg border border-slate-700">
        <span className={`material-icons ${isYes ? "text-emerald-400" : "text-slate-600"}`}>{isYes ? "check_box" : "check_box_outline_blank"}</span>
        <span className="text-sm font-medium text-slate-300 flex-1">{label}</span>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isYes ? "bg-emerald-500/15 text-emerald-400" : "bg-slate-700 text-slate-500"}`}>{value || "—"}</span>
      </div>
      );
}

      // Short aliases for field components
      function F({l, v}: {l: string; v: any }) {
  return (
      <div>
        <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">{l}</span>
        <span className="block text-sm font-medium text-slate-200">{v || <span className="text-slate-600 italic">Not specified</span>}</span>
      </div>
      );
}

      function BF({l, v}: {l: string; v: any }) {
  return (
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${v ? "bg-emerald-400" : "bg-slate-600"}`} />
        <span className="text-[13px] text-slate-300">{l}</span>
      </div>
      );
}

      function LF({l, v}: {l: string; v: any }) {
  return (
      <div className="bg-slate-800/20 border border-slate-700/40 rounded-xl p-5 hover:shadow-md transition-all">
        <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">{l}</h4>
        <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
          {v || <span className="text-slate-600 italic">No details provided.</span>}
        </div>
      </div>
      );
}


