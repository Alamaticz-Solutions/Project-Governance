import { useState, useEffect } from "react";
import { projectsApi } from "../../../lib/api";
import { AIPopulationDropzone } from "../components/AIPopulationDropzone";

interface BtaReviewFormProps {
  projectId: string;
  onSuccess?: () => void;
  onFormChange?: (data: any, isValid: boolean) => void;
}

export function BtaReviewForm({ projectId, onSuccess, onFormChange }: BtaReviewFormProps) {
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);

  const sections = [
    { title: 'Project Identification', icon: 'architecture', description: 'Provide basic information about your project' },
    { title: 'Business Objective', icon: 'lightbulb', description: 'Define the core problem and expected business value' },
    { title: 'Scope & Requirements', icon: 'fact_check', description: 'Outline what is included and excluded from this initiative' },
    { title: 'Technical Landscape', icon: 'dns', description: 'Detail the system architecture and IT involvement' },
    { title: 'Data Security & Privacy', icon: 'security', description: 'Declare data classifications and strict compliance requirements' },
    { title: 'Financials & Resources', icon: 'payments', description: 'Estimate capital and operational budget resources needed' },
    { title: 'Timeline & Urgency', icon: 'calendar_month', description: 'Set targeted dates and priority levels' },
    { title: 'Dependencies & Risks', icon: 'warning', description: 'Highlight any blocking dependencies or risk factors' },
    { title: 'BTA Checklist', icon: 'fact_check', description: 'Confirm all mandatory BTA approvals and verification items' }
  ];

  const [form, setForm] = useState<any>({
    projectName: 'Data Automation Initiative',
    requestorName: 'John Doe',
    requestingDepartment: 'Business Unit - Medical',
    projectStatus: 'New Request',
    projectType: 'Digital Transformation',
    primaryBTA: 'Select Primary BTA',
    targetBusinessDepartment: 'Operations, Quality Assurance, and Compliance',
    problemStatement: '',
    businessObjective: '',
    businessValue: '',
    strategicAlignment: '',
    inScope: '',
    outOfScope: '',
    isNewSolution: true,
    itInvolvement: true,
    systemsImpacted: '',
    hasPhiData: false,
    isHipaaApplicable: false,
    dataClassification: '',
    budgetEstimated: '',
    budgetType: 'tbd',
    vendorRequired: false,
    requestedStartDate: '',
    requestedEndDate: '',
    priority: 'MEDIUM',
    riskLevel: 'MEDIUM',
    knownRisks: '',
    dependencies: '',
    // Mocking the BTA Gateway Checklist fields at the end
    btaChecklist_architectural: 'Yes',
    btaChecklist_security: 'Yes'
  });

  const isValid = (f: any) => !!(f.projectName && f.requestingDepartment);

  useEffect(() => {
    onFormChange?.(form, isValid(form));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateForm = (key: string, value: any) => {
    setForm((prev: any) => {
      const next = { ...prev, [key]: value };
      onFormChange?.(next, isValid(next));
      return next;
    });
  };

  const handleAIExtraction = (parsedData: Record<string, any>) => {
    const clean = Object.fromEntries(
      Object.entries(parsedData || {}).filter(([, v]) => v !== "" && v !== null && v !== undefined)
    );
    setForm((prev: any) => {
      const next = { ...prev, ...clean };
      onFormChange?.(next, isValid(next));
      return next;
    });
  };

  const nextSection = () => {
    if (currentSectionIndex < sections.length - 1) {
      setCurrentSectionIndex((i) => i + 1);
    }
  };

  const prevSection = () => {
    if (currentSectionIndex > 0) {
      setCurrentSectionIndex((i) => i - 1);
    }
  };

  const submitData = async () => {
    try {
      if (!projectId) {
        alert("Completed Review (Mock)");
        return;
      }
      await projectsApi.submitDecision(
        projectId,
        "BTA Review",
        "Approve",
        "BTA Verified and passed to Finance.",
        form
      );
      if (onSuccess) onSuccess();
    } catch (e) {
      console.error(e);
      alert("Error submitting BTA form.");
    }
  };

  const inputStyle = {
    background: "rgba(30,41,59,0.7)",
    borderColor: "rgba(255,255,255,0.12)",
    color: "#F1F5F9"
  };

  return (
    <div className="animate-fade-in w-full font-sans">
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8 items-start">
        
        {/* ══ VERTICAL STEPPER SIDEBAR ══ */}
        <div 
          className="rounded-2xl p-5 sticky top-6 hidden lg:block"
          style={{
            background: "rgba(30, 41, 59, 0.5)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-5 px-2 relative z-10">
            BTA Review Steps
          </h3>
          <div className="flex flex-col relative space-y-1 z-10">
             {/* Connecting Line */}
             <div className="absolute left-[23px] top-4 bottom-6 w-[2px] bg-white/10 z-0"></div>

             {sections.map((step, i) => (
               <div 
                 key={i} 
                 className={`flex items-center gap-4 relative z-10 p-2 cursor-pointer rounded-lg transition-colors ${currentSectionIndex === i ? 'bg-white/5' : 'hover:bg-white/5'}`}
                 onClick={() => setCurrentSectionIndex(i)}
               >
                 {/* Step Circle */}
                 <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 transition-all border-2 
                      ${currentSectionIndex === i ? 'bg-indigo-500 text-white border-indigo-500 shadow-md scale-110' : 
                       (currentSectionIndex > i ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/40' : 'bg-white/5 text-slate-500 border-white/10')}`}>
                   {currentSectionIndex <= i ? (
                     <span>{i + 1}</span>
                   ) : (
                     <span className="material-icons text-[16px]">check</span>
                   )}
                 </div>
                 {/* Step Label */}
                 <div className="flex flex-col justify-center">
                   <span className={`text-[13px] font-bold leading-snug transition-colors ${currentSectionIndex === i ? 'text-white' : 'text-slate-400'}`}>
                     {step.title}
                   </span>
                 </div>
               </div>
             ))}
          </div>
        </div>

        {/* ══ FORM CONTENT CARD ══ */}
        <div 
          className="rounded-2xl p-8 min-h-[600px] transition-shadow relative overflow-hidden flex flex-col"
          style={{
            background: "rgba(30, 41, 59, 0.5)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.2)"
          }}
        >
          {/* Subtle background glow */}
          <div className="absolute top-0 right-0 w-80 h-48 pointer-events-none opacity-40" style={{ background: "radial-gradient(ellipse at 100% 0%, rgba(99,102,241,0.25) 0%, transparent 70%)" }}></div>

          {/* Section Title & Icon */}
          <div className="flex items-start gap-4 mb-8 pb-6 border-b border-white/10 relative z-10">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-indigo-500 shadow-sm text-white">
              <span className="material-icons text-[24px]">{sections[currentSectionIndex].icon}</span>
            </div>
            <div className="mt-1 flex-1">
              <h2 className="text-2xl font-extrabold text-white">{sections[currentSectionIndex].title}</h2>
              <p className="text-[14px] text-slate-400 mt-1">{sections[currentSectionIndex].description}</p>
            </div>
            {/* Step indicator pill */}
            <div className="flex-shrink-0 px-3 py-1.5 rounded-full text-[12px] font-bold bg-white/5 text-slate-300 border border-white/10">
              Step {currentSectionIndex + 1} / {sections.length}
            </div>
          </div>

          <div className="relative z-10 flex-1">
            {/* ── 1. PROJECT IDENTIFICATION ── */}
            {currentSectionIndex === 0 && (
              <>
                <AIPopulationDropzone projectId={projectId} team="BTA" onExtractionComplete={handleAIExtraction} />

                <div className="grid grid-cols-2 gap-x-6 gap-y-5 animate-fade-in">
                  <div>
                    <label className="block text-xs font-bold mb-1.5 text-slate-300">Project Name <span className="text-red-500">*</span></label>
                    <input type="text" value={form.projectName} onChange={e => updateForm('projectName', e.target.value)}
                           className="w-full border rounded-xl px-4 py-2.5 text-[13px] font-medium outline-none transition-all duration-200"
                           style={inputStyle} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1.5 text-slate-300">Requestor Name <span className="text-red-500">*</span></label>
                    <input type="text" value={form.requestorName} onChange={e => updateForm('requestorName', e.target.value)}
                           className="w-full border rounded-xl px-4 py-2.5 text-[13px] font-medium outline-none transition-all duration-200"
                           style={inputStyle} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1.5 text-slate-300">Requesting Department <span className="text-red-500">*</span></label>
                    <input type="text" value={form.requestingDepartment} onChange={e => updateForm('requestingDepartment', e.target.value)}
                           className="w-full border rounded-xl px-4 py-2.5 text-[13px] font-medium outline-none transition-all duration-200"
                           style={inputStyle} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1.5 text-slate-300">Project Status <span className="text-red-500">*</span></label>
                    <select value={form.projectStatus} onChange={e => updateForm('projectStatus', e.target.value)}
                            className="w-full border rounded-xl px-4 py-2.5 text-[13px] font-medium outline-none transition-all duration-200"
                            style={{...inputStyle}}>
                      <option>New Request</option>
                      <option>In Progress</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1.5 text-slate-300">Project Type <span className="text-red-500">*</span></label>
                    <select value={form.projectType} onChange={e => updateForm('projectType', e.target.value)}
                            className="w-full border rounded-xl px-4 py-2.5 text-[13px] font-medium outline-none transition-all duration-200"
                            style={{...inputStyle}}>
                      <option>Digital Transformation</option>
                      <option>Infrastructure</option>
                      <option>Software Development</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1.5 text-slate-300">Primary BTA <span className="text-red-500">*</span></label>
                    <select value={form.primaryBTA} onChange={e => updateForm('primaryBTA', e.target.value)}
                            className="w-full border rounded-xl px-4 py-2.5 text-[13px] font-medium outline-none transition-all duration-200"
                            style={{...inputStyle}}>
                      <option>Select Primary BTA</option>
                      <option>Jane Architecture</option>
                      <option>Bob System</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-bold mb-1.5 text-slate-300">Target Business Department <span className="text-red-500">*</span></label>
                    <textarea value={form.targetBusinessDepartment} onChange={e => updateForm('targetBusinessDepartment', e.target.value)} rows={3}
                              className="w-full border rounded-xl px-4 py-3 text-[13px] font-medium outline-none transition-all duration-200 resize-y"
                              style={inputStyle}></textarea>
                  </div>
                </div>
              </>
            )}

            {/* ── 2. BUSINESS OBJECTIVES ── */}
            {currentSectionIndex === 1 && (
              <div className="grid grid-cols-1 gap-5 animate-fade-in">
                <div>
                  <label className="block text-xs font-bold mb-1.5 text-slate-300">Problem Statement <span className="text-red-500">*</span></label>
                  <textarea value={form.problemStatement} onChange={e => updateForm('problemStatement', e.target.value)} rows={4}
                            className="w-full border rounded-xl px-4 py-3 text-[13px] font-medium outline-none transition-all duration-200 resize-y"
                            style={inputStyle}></textarea>
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1.5 text-slate-300">Business Objective <span className="text-red-500">*</span></label>
                  <textarea value={form.businessObjective} onChange={e => updateForm('businessObjective', e.target.value)} rows={4}
                            className="w-full border rounded-xl px-4 py-3 text-[13px] font-medium outline-none transition-all duration-200 resize-y"
                            style={inputStyle}></textarea>
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1.5 text-slate-300">Business Value / ROI</label>
                  <textarea value={form.businessValue} onChange={e => updateForm('businessValue', e.target.value)} rows={4}
                            className="w-full border rounded-xl px-4 py-3 text-[13px] font-medium outline-none transition-all duration-200 resize-y"
                            style={inputStyle}></textarea>
                </div>
              </div>
            )}

            {/* ── 3. SCOPE & REQUIREMENTS ── */}
            {currentSectionIndex === 2 && (
              <div className="grid grid-cols-1 gap-5 animate-fade-in">
                <div>
                  <label className="block text-xs font-bold mb-1.5 text-slate-300">Strategic Alignment</label>
                  <textarea value={form.strategicAlignment} onChange={e => updateForm('strategicAlignment', e.target.value)} rows={3}
                            className="w-full border rounded-xl px-4 py-3 text-[13px] font-medium outline-none transition-all duration-200 resize-y"
                            style={inputStyle}></textarea>
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1.5 text-slate-300">In Scope Items <span className="text-red-500">*</span></label>
                  <textarea value={form.inScope} onChange={e => updateForm('inScope', e.target.value)} rows={3}
                            className="w-full border rounded-xl px-4 py-3 text-[13px] font-medium outline-none transition-all duration-200 resize-y"
                            style={inputStyle}></textarea>
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1.5 text-slate-300">Out of Scope Items</label>
                  <textarea value={form.outOfScope} onChange={e => updateForm('outOfScope', e.target.value)} rows={3}
                            className="w-full border rounded-xl px-4 py-3 text-[13px] font-medium outline-none transition-all duration-200 resize-y"
                            style={inputStyle}></textarea>
                </div>
              </div>
            )}

            {/* ── 4. TECHNICAL LANDSCAPE ── */}
            {currentSectionIndex === 3 && (
              <div className="grid grid-cols-2 gap-5 animate-fade-in">
                <div className="p-5 rounded-xl bg-slate-800/50 border border-white/10">
                  <label className="block text-sm font-bold mb-4 text-center text-slate-300">Is this a new solution?</label>
                  <div className="flex items-center justify-center gap-5">
                    <label className="flex items-center gap-2 text-sm cursor-pointer text-slate-300">
                      <input type="radio" checked={form.isNewSolution === true} onChange={() => updateForm('isNewSolution', true)} className="w-4 h-4 accent-indigo-500" /> New
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer text-slate-300">
                      <input type="radio" checked={form.isNewSolution === false} onChange={() => updateForm('isNewSolution', false)} className="w-4 h-4 accent-indigo-500" /> Existing
                    </label>
                  </div>
                </div>
                <div className="p-5 rounded-xl bg-slate-800/50 border border-white/10">
                  <label className="block text-sm font-bold mb-4 text-center text-slate-300">IT Involvement Required?</label>
                  <div className="flex items-center justify-center gap-5">
                    <label className="flex items-center gap-2 text-sm cursor-pointer text-slate-300">
                      <input type="radio" checked={form.itInvolvement === true} onChange={() => updateForm('itInvolvement', true)} className="w-4 h-4 accent-indigo-500" /> Yes
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer text-slate-300">
                      <input type="radio" checked={form.itInvolvement === false} onChange={() => updateForm('itInvolvement', false)} className="w-4 h-4 accent-indigo-500" /> No
                    </label>
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold mb-1.5 text-slate-300">Systems Impacted</label>
                  <textarea value={form.systemsImpacted} onChange={e => updateForm('systemsImpacted', e.target.value)} rows={3}
                            className="w-full border rounded-xl px-4 py-3 text-[13px] font-medium outline-none transition-all duration-200 resize-y"
                            style={inputStyle}></textarea>
                </div>
              </div>
            )}

            {/* ── 5. DATA SECURITY & PRIVACY ── */}
            {currentSectionIndex === 4 && (
              <div className="grid grid-cols-2 gap-5 animate-fade-in">
                <div className="p-5 rounded-xl bg-slate-800/50 border border-white/10">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={form.hasPhiData} onChange={e => updateForm('hasPhiData', e.target.checked)} className="w-5 h-5 rounded accent-indigo-500" />
                    <div>
                      <span className="block text-sm font-bold text-slate-100">Contains PHI/PII Data</span>
                      <span className="block text-xs mt-0.5 text-slate-400">Protected Health Information or Personally Identifiable Info</span>
                    </div>
                  </label>
                </div>
                <div className="p-5 rounded-xl bg-slate-800/50 border border-white/10">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={form.isHipaaApplicable} onChange={e => updateForm('isHipaaApplicable', e.target.checked)} className="w-5 h-5 rounded accent-indigo-500" />
                    <div>
                      <span className="block text-sm font-bold text-slate-100">HIPAA Compliance Applicable</span>
                      <span className="block text-xs mt-0.5 text-slate-400">Requires strict audit logging and encryption at rest</span>
                    </div>
                  </label>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold mb-1.5 text-slate-300">Data Classification <span className="text-red-500">*</span></label>
                  <select value={form.dataClassification} onChange={e => updateForm('dataClassification', e.target.value)}
                          className="w-full border rounded-xl px-4 py-2.5 text-[13px] font-medium outline-none transition-all duration-200"
                          style={{...inputStyle}}>
                    <option value="">Select Data Classification</option>
                    <option value="restricted">Restricted / Confidential</option>
                    <option value="internal">Internal Restricted</option>
                    <option value="public">Public</option>
                  </select>
                </div>
              </div>
            )}

            {/* ── 6. FINANCIALS & RESOURCES ── */}
            {currentSectionIndex === 5 && (
              <div className="grid grid-cols-2 gap-5 animate-fade-in">
                <div>
                  <label className="block text-xs font-bold mb-1.5 text-slate-300">Estimated Budget <span className="text-red-500">*</span></label>
                  <input type="number" value={form.budgetEstimated} onChange={e => updateForm('budgetEstimated', e.target.value)}
                         className="w-full border rounded-xl px-4 py-2.5 text-[13px] font-medium outline-none transition-all duration-200"
                         style={inputStyle} />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1.5 text-slate-300">Budget Type <span className="text-red-500">*</span></label>
                  <select value={form.budgetType} onChange={e => updateForm('budgetType', e.target.value)}
                          className="w-full border rounded-xl px-4 py-2.5 text-[13px] font-medium outline-none transition-all duration-200"
                          style={{...inputStyle}}>
                    <option value="capex">CapEx (Capital Expenditure)</option>
                    <option value="opex">OpEx (Operational Expenditure)</option>
                    <option value="tbd">To Be Determined</option>
                  </select>
                </div>
              </div>
            )}

            {/* ── 7. TIMELINE & URGENCY ── */}
            {currentSectionIndex === 6 && (
              <div className="grid grid-cols-2 gap-5 animate-fade-in">
                <div>
                  <label className="block text-xs font-bold mb-1.5 text-slate-300">Requested Start Date <span className="text-red-500">*</span></label>
                  <input type="date" value={form.requestedStartDate} onChange={e => updateForm('requestedStartDate', e.target.value)}
                         className="w-full border rounded-xl px-4 py-2.5 text-[13px] font-medium outline-none transition-all duration-200 filter invert-[0.85]"
                         style={inputStyle} />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1.5 text-slate-300">Requested End Date <span className="text-red-500">*</span></label>
                  <input type="date" value={form.requestedEndDate} onChange={e => updateForm('requestedEndDate', e.target.value)}
                         className="w-full border rounded-xl px-4 py-2.5 text-[13px] font-medium outline-none transition-all duration-200 filter invert-[0.85]"
                         style={inputStyle} />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold mb-1.5 text-slate-300">Project Priority <span className="text-red-500">*</span></label>
                  <select value={form.priority} onChange={e => updateForm('priority', e.target.value)}
                          className="w-full border rounded-xl px-4 py-2.5 text-[13px] font-medium outline-none transition-all duration-200"
                          style={{...inputStyle}}>
                    <option value="CRITICAL">Critical</option>
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                  </select>
                </div>
              </div>
            )}

            {/* ── 8. DEPENDENCIES & RISKS ── */}
            {currentSectionIndex === 7 && (
               <div className="grid grid-cols-1 gap-5 animate-fade-in">
                 <div>
                   <label className="block text-xs font-bold mb-1.5 text-slate-300">Risk Level <span className="text-red-500">*</span></label>
                   <select value={form.riskLevel} onChange={e => updateForm('riskLevel', e.target.value)}
                           className="w-full border rounded-xl px-4 py-2.5 text-[13px] font-medium outline-none transition-all duration-200"
                           style={{...inputStyle}}>
                     <option value="HIGH">High Risk</option>
                     <option value="MEDIUM">Medium Risk</option>
                     <option value="LOW">Low Risk</option>
                   </select>
                 </div>
                 <div>
                   <label className="block text-xs font-bold mb-1.5 text-slate-300">Known Risks & Mitigation Plans</label>
                   <textarea value={form.knownRisks} onChange={e => updateForm('knownRisks', e.target.value)} rows={3}
                             className="w-full border rounded-xl px-4 py-3 text-[13px] font-medium outline-none transition-all duration-200 resize-y"
                             style={inputStyle}></textarea>
                 </div>
                 <div>
                   <label className="block text-xs font-bold mb-1.5 text-slate-300">Key Dependencies</label>
                   <textarea value={form.dependencies} onChange={e => updateForm('dependencies', e.target.value)} rows={3}
                             className="w-full border rounded-xl px-4 py-3 text-[13px] font-medium outline-none transition-all duration-200 resize-y"
                             style={inputStyle}></textarea>
                 </div>
               </div>
            )}

            {/* ── 9. BTA CHECKLIST ── */}
            {currentSectionIndex === 8 && (
               <div className="animate-fade-in space-y-6">
                 <h3 className="text-[13px] font-extrabold uppercase tracking-widest mb-2 text-emerald-400">BTA Gate Reviewer Checklist</h3>
                 <div className="space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between p-5 border border-white/10 rounded-xl bg-white/5 gap-4">
                      <div className="flex items-start gap-4 flex-1">
                        <div className="w-12 h-12 rounded-xl bg-indigo-500/15 text-indigo-300 flex items-center justify-center shrink-0 border border-indigo-500/20">
                          <span className="material-icons text-[24px]">architecture</span>
                        </div>
                        <div>
                          <h3 className="text-[14px] font-bold text-slate-100 mb-1">Architectural Review Passed?</h3>
                          <p className="text-[12px] text-slate-400 font-medium">Has the enterprise architecture team reviewed the proposed solution pattern?</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-8">
                        <label className="flex items-center gap-3 cursor-pointer group">
                          <input type="radio" checked={form.btaChecklist_architectural === 'Yes'} onChange={() => updateForm('btaChecklist_architectural', "Yes")} className="w-5 h-5 text-indigo-500 accent-indigo-500" />
                          <span className="text-[14px] font-bold text-slate-300">Yes</span>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer group">
                          <input type="radio" checked={form.btaChecklist_architectural === 'No'} onChange={() => updateForm('btaChecklist_architectural', "No")} className="w-5 h-5 text-indigo-500 accent-indigo-500" />
                          <span className="text-[14px] font-bold text-slate-300">No</span>
                        </label>
                      </div>
                    </div>

                    <div className="flex flex-col md:flex-row md:items-center justify-between p-5 border border-white/10 rounded-xl bg-white/5 gap-4">
                      <div className="flex items-start gap-4 flex-1">
                        <div className="w-12 h-12 rounded-xl bg-indigo-500/15 text-indigo-300 flex items-center justify-center shrink-0 border border-indigo-500/20">
                          <span className="material-icons text-[24px]">security</span>
                        </div>
                        <div>
                          <h3 className="text-[14px] font-bold text-slate-100 mb-1">Security Sign-off Required?</h3>
                          <p className="text-[12px] text-slate-400 font-medium">Does InfoSec need to approve the data pipeline?</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-8">
                        <label className="flex items-center gap-3 cursor-pointer group">
                          <input type="radio" checked={form.btaChecklist_security === 'Yes'} onChange={() => updateForm('btaChecklist_security', "Yes")} className="w-5 h-5 text-indigo-500 accent-indigo-500" />
                          <span className="text-[14px] font-bold text-slate-300">Yes</span>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer group">
                          <input type="radio" checked={form.btaChecklist_security === 'No'} onChange={() => updateForm('btaChecklist_security', "No")} className="w-5 h-5 text-indigo-500 accent-indigo-500" />
                          <span className="text-[14px] font-bold text-slate-300">No</span>
                        </label>
                      </div>
                    </div>
                 </div>
               </div>
            )}
          </div>

          {/* ── NAVIGATION ACTIONS ── */}
          <div className="mt-10 flex items-center justify-between" style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "24px" }}>
            <button 
               className="px-6 py-2.5 rounded-xl text-[13px] font-bold transition-all duration-200 border border-white/10 bg-white/5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 hover:border-red-400/40"
            >
              Cancel
            </button>

            <div className="flex gap-3">
              <button 
                className={`px-6 py-2.5 rounded-xl text-[13px] font-bold transition-all duration-200 border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 ${currentSectionIndex === 0 ? 'invisible' : ''}`}
                onClick={prevSection}
              >
                ← Previous
              </button>

              {currentSectionIndex < sections.length - 1 ? (
                <button 
                  className="px-8 py-2.5 rounded-xl text-white text-[13px] font-bold transition-all duration-200 flex items-center gap-2 hover:-translate-y-0.5"
                  style={{ background: "linear-gradient(135deg, #4F46E5, #7C3AED)", boxShadow: "0 4px 14px rgba(79,70,229,0.35)" }}
                  onClick={nextSection}
                >
                  Next <span className="material-icons text-[16px]">arrow_forward</span>
                </button>
              ) : (
                <button 
                  className="px-8 py-2.5 rounded-xl text-white text-[13px] font-bold transition-all duration-200 flex items-center gap-2 hover:-translate-y-0.5"
                  style={{ background: "linear-gradient(135deg, #059669, #047857)", boxShadow: "0 4px 14px rgba(5,150,105,0.35)" }}
                  onClick={submitData}
                >
                  <span className="material-icons text-[16px]">check_circle_outline</span> Complete Review
                </button>
              )}
            </div>
          </div>

        </div> 
      </div> 
    </div>
  );
}
