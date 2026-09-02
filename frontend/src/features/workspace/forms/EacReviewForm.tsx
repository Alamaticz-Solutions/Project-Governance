import { useEffect, useState } from "react";
import { AIPopulationDropzone } from "../components/AIPopulationDropzone";

export interface EacFormData {
  [key: string]: any;
}

interface EacReviewFormProps {
  projectId: string;
  onFormChange?: (data: EacFormData, isValid: boolean) => void;
}

export function EacReviewForm({ projectId: _projectId, onFormChange }: EacReviewFormProps) {
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);

  const sections = [
    { title: 'Project Overview & Identification', icon: 'article', description: 'Basic project details and assignment information' },
    { title: 'Business Justification', icon: 'lightbulb', description: 'Define the problem and strategic alignment' },
    { title: 'Key Stakeholders', icon: 'groups', description: 'Identify project stakeholders and involvement' },
    { title: 'Current State Analysis', icon: 'analytics', description: 'Describe current architecture and pain points' },
    { title: 'Proposed Solution', icon: 'dns', description: 'Detail the technical architecture approach' },
    { title: 'Risk & Compliance', icon: 'gpp_maybe', description: 'Mitigate project risks and regulations' },
    { title: 'Timeline & Resources', icon: 'calendar_month', description: 'Set dates, milestones, and resources' },
    { title: 'Business Impact', icon: 'trending_up', description: 'Quantify business value and alternatives' },
    { title: 'Feasibility & Readiness', icon: 'rocket_launch', description: 'Assess scalability and feasibility' },
    { title: 'EAC Checklist', icon: 'fact_check', description: 'Confirm mandatory verifications' }
  ];

  const [form, setForm] = useState<any>({
    projectName: '', requestorName: 'Gurrammaneesh User', requestingDepartment: 'Business Unit - Specialty',
    projectStatus: 'EAC Assigned', projectType: '', primaryBTA: '', targetBusinessDepartment: '',
    problemStatement: '', strategicAlignment: '', eaPrinciplesAlignment: '',
    currentStateArchitecture: '', currentStatePainPoints: '', currentStateSystems: '',
    solutionOverview: '', techStack: '', dataStrategy: '', securityStrategy: '', integrationStrategy: '', infrastructureRequirements: '',
    complianceStandards: '', howAddressesCompliance: '',
    startDate: '', endDate: '', estimatedBudget: '', fundingSource: 'Operational Budget', budgetBreakdown: '', humanResources: '',
    impactOperations: '', impactRevenue: '', impactSavings: '', impactCustomer: '', impactCompetitive: '', rationale: '',
    scalability: '', futureReadiness: '', feasibilityStatement: '', itCapabilitiesAlignment: '', newSkillsRequired: '',
    eacChecklist_verified: 'Yes'
  });

  const [stakeholders, setStakeholders] = useState<any[]>([]);

  const isValid = (f: any) => !!(f.problemStatement);

    const handleAIExtraction = (parsedData: Record<string, any>) => {
    const clean = Object.fromEntries(
      Object.entries(parsedData || {}).filter(([, v]) => v !== "" && v !== null && v !== undefined)
    );
    setForm((prev: any) => {
      const next = { ...prev, ...clean };
      if (typeof onFormChange === 'function') {
         onFormChange(next, isValid(next));
      }
      return next;
    });
  };

const updateForm = (key: string, value: string) => {
    const next = { ...form, [key]: value };
    setForm(next);
    onFormChange?.(next, isValid(next));
  };

  useEffect(() => {
    onFormChange?.(form, isValid(form));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nextSection = () => { if (currentSectionIndex < sections.length - 1) setCurrentSectionIndex(i => i + 1); };
  const prevSection = () => { if (currentSectionIndex > 0) setCurrentSectionIndex(i => i - 1); };

  const addStakeholder = () => setStakeholders([...stakeholders, { name: '', role: '', department: '', involvement: 'Medium', interest: '' }]);
  const removeStakeholder = (i: number) => setStakeholders(stakeholders.filter((_, idx) => idx !== i));
  const updateStakeholder = (i: number, key: string, value: string) => {
    const list = [...stakeholders];
    list[i][key] = value;
    setStakeholders(list);
  };

  const autofillAI = () => {
    setForm({
      ...form,
      projectName: 'Enterprise AI Implementation',
      problemStatement: 'Current manual data entry process is time-consuming and error-prone.',
      strategicAlignment: 'AI generated: Automatically coordinates with Strategic Pillar 4 (Operational Excellence).',
      eaPrinciplesAlignment: 'AI generated: Adheres to the principle of "Data as an Asset".',
      currentStateArchitecture: 'AI generated: Scattered local upload tools, insecure endpoints.',
      techStack: 'AI generated: React, Rust, PostgreSQL, AWS S3, TailwindCSS.',
      budgetBreakdown: 'AI generated: Dev: $50,000, Testing: $15,000, Ops: $20,000',
      humanResources: 'AI generated: 1 Lead Architect, 2 Software Engineers, 1 QA Dev'
    });
  };

  // No internal submit — handled by parent via onFormChange


  return (
    <div className="animate-fade-in w-full font-sans">
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8 items-start">
        
        {/* ══ VERTICAL STEPPER SIDEBAR ══ */}
        <div className="rounded-2xl p-5 sticky top-6 hidden lg:block" style={{ background: "rgba(30, 41, 59, 0.5)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-5 px-2 relative z-10">Prepare for EAC</h3>
          <div className="flex flex-col relative space-y-1 z-10">
             <div className="absolute left-[23px] top-4 bottom-6 w-[2px] bg-white/10 z-0"></div>
             {sections.map((step, i) => (
               <div key={i} className={`flex items-center gap-4 relative z-10 p-2 cursor-pointer rounded-lg transition-colors ${currentSectionIndex === i ? 'bg-white/5' : 'hover:bg-white/5'}`} onClick={() => setCurrentSectionIndex(i)}>
                 <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 transition-all border-2 ${currentSectionIndex === i ? 'bg-indigo-500 text-white border-indigo-500 shadow-md scale-110' : (currentSectionIndex > i ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/40' : 'bg-white/5 text-slate-500 border-white/10')}`}>
                   {currentSectionIndex <= i ? <span>{i + 1}</span> : <span className="material-icons text-[16px]">check</span>}
                 </div>
                 <div className="flex flex-col justify-center">
                   <span className={`text-[13px] font-bold leading-snug transition-colors ${currentSectionIndex === i ? 'text-white' : 'text-slate-400'}`}>{step.title}</span>
                 </div>
               </div>
             ))}
          </div>
        </div>

        {/* ══ FORM CONTENT CARD ══ */}
        <div className="rounded-2xl p-8 min-h-[600px] flex flex-col" style={{ background: "rgba(30, 41, 59, 0.5)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 8px 32px rgba(99,102,241,0.12)" }}>
          <div className="flex items-start gap-4 mb-8 pb-6 border-b border-white/10">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-indigo-500 shadow-sm text-white">
              <span className="material-icons text-[24px]">{sections[currentSectionIndex].icon}</span>
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-extrabold text-white">{sections[currentSectionIndex].title}</h2>
              <p className="text-[14px] text-slate-400 mt-1">{sections[currentSectionIndex].description}</p>
            </div>
            <div className="px-3 py-1.5 rounded-full text-[12px] font-bold bg-white/5 text-slate-300 border border-white/10">Step {currentSectionIndex + 1} / {sections.length}</div>
          </div>

          <div className="flex-1 space-y-5">
            {/* 1. Project Overview */}
            {currentSectionIndex === 0 && (
              <div className="animate-fade-in space-y-4">
                <AIPopulationDropzone projectId={_projectId} team="EAC" onExtractionComplete={handleAIExtraction} />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Project Name</label>
                    <input className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-100 outline-none focus:border-indigo-400" value={form.projectName} onChange={(e) => updateForm('projectName', e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Project Type</label>
                    <input className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-100 outline-none focus:border-indigo-400" value={form.projectType} onChange={(e) => updateForm('projectType', e.target.value)} />
                  </div>
                </div>
                <div>
                   <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Target Business Department</label>
                   <textarea rows={3} className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-100 outline-none resize-y focus:border-indigo-400" value={form.targetBusinessDepartment} onChange={(e) => updateForm('targetBusinessDepartment', e.target.value)}></textarea>
                </div>
              </div>
            )}

            {/* 2. Business Justification */}
            {currentSectionIndex === 1 && (
              <div className="animate-fade-in space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Problem or Opportunity Statement</label>
                  <textarea rows={3} className="w-full bg-black/20 border border-indigo-500/30 rounded-xl px-4 py-3 text-sm text-slate-100 outline-none resize-y focus:border-indigo-400" value={form.problemStatement} onChange={(e) => updateForm('problemStatement', e.target.value)}></textarea>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Strategic Alignment</label>
                  <textarea rows={3} className="w-full bg-black/20 border border-indigo-500/30 rounded-xl px-4 py-3 text-sm text-slate-100 outline-none resize-y focus:border-indigo-400" value={form.strategicAlignment} onChange={(e) => updateForm('strategicAlignment', e.target.value)}></textarea>
                </div>
              </div>
            )}

            {/* 3. Stakeholders */}
            {currentSectionIndex === 2 && (
              <div className="animate-fade-in space-y-4">
                 <button onClick={addStakeholder} className="px-4 py-2 bg-indigo-500/10 text-indigo-400 font-bold text-xs rounded-xl border border-indigo-500/30 hover:bg-indigo-500/20">
                   + Add Stakeholder
                 </button>
                 {stakeholders.map((sh, idx) => (
                   <div key={idx} className="p-4 bg-white/5 border border-white/10 rounded-xl flex gap-4">
                     <div className="flex-1 space-y-2">
                       <input placeholder="Name" value={sh.name} onChange={e => updateStakeholder(idx, 'name', e.target.value)} className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none" />
                       <input placeholder="Role" value={sh.role} onChange={e => updateStakeholder(idx, 'role', e.target.value)} className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none" />
                     </div>
                     <button onClick={() => removeStakeholder(idx)} className="text-red-400">X</button>
                   </div>
                 ))}
              </div>
            )}

            {/* 4. Current State */}
            {currentSectionIndex === 3 && (
              <div className="animate-fade-in space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Current State Architecture</label>
                  <textarea rows={4} className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-100 outline-none resize-y focus:border-indigo-400" value={form.currentStateArchitecture} onChange={(e) => updateForm('currentStateArchitecture', e.target.value)}></textarea>
                </div>
              </div>
            )}
            
            {/* 5-9 omitted for brevity but represent textual steps... */}
            {[4, 5, 6, 7, 8].includes(currentSectionIndex) && (
              <div className="animate-fade-in p-10 text-center bg-white/5 rounded-2xl border border-white/10">
                <span className="material-icons text-4xl text-slate-500 mb-3">edit_note</span>
                <p className="text-slate-300 font-bold mb-1">{sections[currentSectionIndex].title}</p>
                <p className="text-slate-500 text-sm">Please provide all detailed analysis documents in the repository.</p>
              </div>
            )}

            {/* 10. EAC Checklist */}
            {currentSectionIndex === 9 && (
              <div className="animate-fade-in space-y-4">
                 <div className="flex flex-col md:flex-row md:items-center justify-between p-5 border border-white/10 rounded-xl bg-white/5 gap-4">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="w-12 h-12 rounded-xl bg-indigo-500/15 text-indigo-300 flex items-center justify-center shrink-0 border border-indigo-500/20">
                        <span className="material-icons text-[24px]">verified</span>
                      </div>
                      <div>
                        <h3 className="text-[14px] font-bold text-slate-100 mb-1">Architecture Verified?</h3>
                        <p className="text-[12px] text-slate-400 font-medium">Has the EAC committee approved the technical footprint?</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-8">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input type="radio" checked={form.eacChecklist_verified === 'Yes'} onChange={() => updateForm('eacChecklist_verified', 'Yes')} className="w-5 h-5 accent-indigo-500" />
                        <span className="text-[14px] font-bold text-slate-300">Yes</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input type="radio" checked={form.eacChecklist_verified === 'No'} onChange={() => updateForm('eacChecklist_verified', 'No')} className="w-5 h-5 accent-indigo-500" />
                        <span className="text-[14px] font-bold text-slate-300">No</span>
                      </label>
                    </div>
                  </div>
              </div>
            )}
          </div>

          <div className="mt-8 flex items-center justify-between pt-6 border-t border-white/10">
            <button className="px-6 py-2.5 rounded-xl border border-white/10 text-slate-300 font-bold text-[13px] bg-white/5 hover:bg-white/10 transition-colors">
              Cancel
            </button>
            <div className="flex gap-3">
              <button onClick={prevSection} className={`px-5 py-2.5 rounded-xl border border-white/10 text-slate-300 font-bold text-[13px] bg-white/5 hover:bg-white/10 transition-colors ${currentSectionIndex === 0 ? 'invisible' : ''}`}>
                Previous
              </button>
              <button onClick={autofillAI} className="px-5 py-2.5 rounded-xl border border-indigo-500/30 text-indigo-300 font-bold text-[13px] bg-indigo-500/10 hover:bg-indigo-500/20 transition-colors">
                Fill with AI
              </button>
              {currentSectionIndex < sections.length - 1 ? (
                <button onClick={nextSection} className="px-8 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-700 text-white font-bold text-[13px] shadow-md hover:shadow-indigo-300 hover:shadow-lg transition-all">
                  Next
                </button>
              ) : (
                <p className="text-xs text-slate-400 italic flex items-center gap-1.5">
                  <span className="material-icons text-[14px] text-indigo-400">info</span>
                  Use the <strong className="text-white mx-1">Approve</strong> button on the right panel to submit.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
