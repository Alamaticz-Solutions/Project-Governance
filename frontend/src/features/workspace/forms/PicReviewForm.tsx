import { useState } from "react";
import { projectsApi } from "../../../lib/api";

interface PicReviewFormProps {
  projectId: string;
  onSuccess?: () => void;
}

export function PicReviewForm({ projectId, onSuccess }: PicReviewFormProps) {
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);

  const sections = [
    { title: 'Core Project Definition', icon: 'article', description: 'Basic project details and problem statement' },
    { title: 'Vendor Recommendation', icon: 'storefront', description: 'Vendor selection and justification' },
    { title: 'Project Evaluation & Benefit', icon: 'trending_up', description: 'Quantifiable benefits and savings' },
    { title: 'Cost Plan & ROI', icon: 'savings', description: 'Capex, Opex, NPV, IRR calculation' },
    { title: 'Project Execution & Ask', icon: 'engineering', description: 'Milestones and FTE resource asks' },
    { title: 'Supporting Information', icon: 'attach_file', description: 'Final artifacts and preparation comments' },
    { title: 'PIC Approval Checklist', icon: 'fact_check', description: 'Final Gateway verification' }
  ];

  const [form, setForm] = useState<any>({
    problemStatement: '', scope: '', 
    vendorName: '', vendorJustification: '', vendorBenefits: '',
    benefitCategory: 'Cost Reduction', annualValueY1: '', annualValueY2: '', benefitMethodology: '',
    capex: '', npv: '', irr: '', paybackMonths: '',
    milestones: '', resourceAsk: '',
    comments: '',
    picChecklist_verified: 'Yes'
  });

  const updateForm = (key: string, value: string) => setForm({ ...form, [key]: value });

  const nextSection = () => { if (currentSectionIndex < sections.length - 1) setCurrentSectionIndex(i => i + 1); };
  const prevSection = () => { if (currentSectionIndex > 0) setCurrentSectionIndex(i => i - 1); };

  const autofillAI = () => {
    setForm({
      ...form,
      problemStatement: 'AI Generated: Legacy systems are costing $40k/mo in operational drag.',
      scope: 'Enterprise-wide rollout of new automated workflow system over 6 months.',
      vendorName: 'Acme Cloud Solutions',
      vendorJustification: 'Lowest TCO (Total Cost of Ownership) mapped over 3 years and immediate HIPAA compliance.',
      vendorBenefits: 'Free premium support included on Tier 2 licensing.',
      annualValueY1: '$150,000',
      annualValueY2: '$250,000',
      benefitMethodology: 'Calculated by displacing 15,000 hours of manual labor at blended rate of $35/hr.',
      capex: '$1.2M',
      npv: '$430,000',
      irr: '24%',
      paybackMonths: '18',
      milestones: 'Q1: Vendor signed. Q2: Design complete. Q3: UAT. Q4: Go-Live.',
      resourceAsk: 'Need 1.5 FTE from CloudOps and 0.5 FTE from Security.',
      comments: 'Dossier fully prepared and ready for the PIC executive committee review.'
    });
  };

  const submitData = async () => {
    try {
      if (!projectId) { alert("Mock Submit"); return; }
      // Sends "Prepare for PIC" exactly like the Angular application
      await projectsApi.submitDecision(
        projectId,
        "Prepare for PIC", 
        "Approve",
        form.comments || "PIC preparation packet submitted.",
        form
      );
      if (onSuccess) onSuccess();
    } catch (e) {
      console.error(e);
      alert("Error submitting PIC review");
    }
  };

  return (
    <div className="animate-fade-in w-full font-sans">
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8 items-start">
        
        {/* ══ VERTICAL STEPPER SIDEBAR ══ */}
        <div className="rounded-2xl p-5 sticky top-6 hidden lg:block" style={{ background: "rgba(30, 41, 59, 0.5)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-5 px-2 relative z-10">Prepare for PIC</h3>
          <div className="flex flex-col relative space-y-1 z-10">
             <div className="absolute left-[23px] top-4 bottom-6 w-[2px] bg-white/10 z-0"></div>
             {sections.map((step, i) => (
               <div key={i} className={`flex items-center gap-4 relative z-10 p-2 cursor-pointer rounded-lg transition-colors ${currentSectionIndex === i ? 'bg-white/5' : 'hover:bg-white/5'}`} onClick={() => setCurrentSectionIndex(i)}>
                 <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 transition-all border-2 ${currentSectionIndex === i ? 'bg-[#059669] text-white border-[#059669] shadow-md scale-110' : (currentSectionIndex > i ? 'bg-[#059669]/15 text-[#34D399] border-[#059669]/40' : 'bg-white/5 text-slate-500 border-white/10')}`}>
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
        <div className="rounded-2xl p-8 min-h-[600px] flex flex-col" style={{ background: "rgba(30, 41, 59, 0.5)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 8px 32px rgba(5,150,105,0.12)" }}>
          <div className="flex items-start gap-4 mb-8 pb-6 border-b border-white/10">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-[#059669] shadow-sm text-white">
              <span className="material-icons text-[24px]">{sections[currentSectionIndex].icon}</span>
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-extrabold text-white">{sections[currentSectionIndex].title}</h2>
              <p className="text-[14px] text-slate-400 mt-1">{sections[currentSectionIndex].description}</p>
            </div>
            <div className="px-3 py-1.5 rounded-full text-[12px] font-bold bg-white/5 text-slate-300 border border-white/10">Step {currentSectionIndex + 1} / {sections.length}</div>
          </div>

          <div className="flex-1 space-y-5">
            {/* 1. Core Project Def */}
            {currentSectionIndex === 0 && (
              <div className="animate-fade-in space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Problem or Opportunity Statement</label>
                  <textarea rows={4} className="w-full bg-black/20 border border-[#059669]/30 rounded-xl px-4 py-3 text-sm text-slate-100 outline-none resize-y focus:border-[#10B981]" value={form.problemStatement} onChange={(e) => updateForm('problemStatement', e.target.value)}></textarea>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Scope of Project (High Level)</label>
                  <textarea rows={3} className="w-full bg-black/20 border border-[#059669]/30 rounded-xl px-4 py-3 text-sm text-slate-100 outline-none resize-y focus:border-[#10B981]" value={form.scope} onChange={(e) => updateForm('scope', e.target.value)}></textarea>
                </div>
              </div>
            )}

            {/* 2. Vendor */}
            {currentSectionIndex === 1 && (
              <div className="animate-fade-in space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Primary Recommended Vendor</label>
                  <input className="w-full bg-black/20 border border-[#059669]/30 rounded-xl px-4 py-3 text-sm text-slate-100 outline-none focus:border-[#10B981]" value={form.vendorName} onChange={(e) => updateForm('vendorName', e.target.value)} />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Justification for Recommended Vendor</label>
                  <textarea rows={4} className="w-full bg-black/20 border border-[#059669]/30 rounded-xl px-4 py-3 text-sm text-slate-100 outline-none resize-y focus:border-[#10B981]" value={form.vendorJustification} onChange={(e) => updateForm('vendorJustification', e.target.value)}></textarea>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Specific Benefits of Recommended Vendor</label>
                  <textarea rows={3} className="w-full bg-black/20 border border-[#059669]/30 rounded-xl px-4 py-3 text-sm text-slate-100 outline-none resize-y focus:border-[#10B981]" value={form.vendorBenefits} onChange={(e) => updateForm('vendorBenefits', e.target.value)}></textarea>
                </div>
              </div>
            )}

            {/* 3. Evaluation */}
            {currentSectionIndex === 2 && (
              <div className="animate-fade-in space-y-4">
                 <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Primary Benefit Category</label>
                    <select value={form.benefitCategory} onChange={(e) => updateForm('benefitCategory', e.target.value)} className="w-full bg-black/20 border border-[#059669]/30 rounded-xl px-4 py-3 text-sm text-slate-100 outline-none focus:border-[#10B981]">
                      <option className="bg-[#1e293b]">Cost Reduction</option>
                      <option className="bg-[#1e293b]">Revenue Generation</option>
                      <option className="bg-[#1e293b]">Compliance Risk Avoidance</option>
                      <option className="bg-[#1e293b]">Clinical Efficiency</option>
                    </select>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                   <div>
                     <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Annual Quantified Value (Year 1)</label>
                     <input className="w-full bg-black/20 border border-[#059669]/30 rounded-xl px-4 py-3 text-sm text-slate-100 outline-none focus:border-[#10B981]" value={form.annualValueY1} onChange={(e) => updateForm('annualValueY1', e.target.value)} />
                   </div>
                   <div>
                     <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Annual Quantified Value (Year 2)</label>
                     <input className="w-full bg-black/20 border border-[#059669]/30 rounded-xl px-4 py-3 text-sm text-slate-100 outline-none focus:border-[#10B981]" value={form.annualValueY2} onChange={(e) => updateForm('annualValueY2', e.target.value)} />
                   </div>
                 </div>
                 <div>
                   <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Benefit Calculation Methodology</label>
                   <textarea rows={3} className="w-full bg-black/20 border border-[#059669]/30 rounded-xl px-4 py-3 text-sm text-slate-100 outline-none resize-y focus:border-[#10B981]" value={form.benefitMethodology} onChange={(e) => updateForm('benefitMethodology', e.target.value)}></textarea>
                 </div>
              </div>
            )}

            {/* 4. Cost Plan */}
            {currentSectionIndex === 3 && (
              <div className="animate-fade-in grid grid-cols-2 gap-4">
                 <div>
                   <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Total Capex</label>
                   <input className="w-full bg-black/20 border border-[#059669]/30 rounded-xl px-4 py-3 text-sm text-slate-100 outline-none focus:border-[#10B981]" value={form.capex} onChange={(e) => updateForm('capex', e.target.value)} />
                 </div>
                 <div>
                   <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Net Present Value (NPV)</label>
                   <input className="w-full bg-black/20 border border-[#059669]/30 rounded-xl px-4 py-3 text-sm text-slate-100 outline-none focus:border-[#10B981]" value={form.npv} onChange={(e) => updateForm('npv', e.target.value)} />
                 </div>
                 <div>
                   <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Internal Rate of Return (IRR)</label>
                   <input className="w-full bg-black/20 border border-[#059669]/30 rounded-xl px-4 py-3 text-sm text-slate-100 outline-none focus:border-[#10B981]" value={form.irr} onChange={(e) => updateForm('irr', e.target.value)} />
                 </div>
                 <div>
                   <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Payback Period (Months)</label>
                   <input className="w-full bg-black/20 border border-[#059669]/30 rounded-xl px-4 py-3 text-sm text-slate-100 outline-none focus:border-[#10B981]" value={form.paybackMonths} onChange={(e) => updateForm('paybackMonths', e.target.value)} />
                 </div>
              </div>
            )}
            
            {/* 5. Execution */}
            {currentSectionIndex === 4 && (
              <div className="animate-fade-in space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Milestone Target Dates</label>
                  <textarea rows={4} className="w-full bg-black/20 border border-[#059669]/30 rounded-xl px-4 py-3 text-sm text-slate-100 outline-none resize-y focus:border-[#10B981]" value={form.milestones} onChange={(e) => updateForm('milestones', e.target.value)}></textarea>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Resource Ask (FTE Requirements)</label>
                  <textarea rows={3} className="w-full bg-black/20 border border-[#059669]/30 rounded-xl px-4 py-3 text-sm text-slate-100 outline-none resize-y focus:border-[#10B981]" value={form.resourceAsk} onChange={(e) => updateForm('resourceAsk', e.target.value)}></textarea>
                </div>
              </div>
            )}

            {/* 6. Supporting Info */}
            {currentSectionIndex === 5 && (
              <div className="animate-fade-in space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Preparation Comments</label>
                  <textarea rows={5} className="w-full bg-black/20 border border-[#059669]/30 rounded-xl px-4 py-3 text-sm text-slate-100 outline-none resize-y focus:border-[#10B981]" value={form.comments} onChange={(e) => updateForm('comments', e.target.value)} placeholder="Add any notes for the PIC committee..."></textarea>
                </div>
              </div>
            )}

            {/* 7. PIC Checklist */}
            {currentSectionIndex === 6 && (
              <div className="animate-fade-in space-y-4">
                 <div className="flex flex-col md:flex-row md:items-center justify-between p-5 border border-white/10 rounded-xl bg-white/5 gap-4">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="w-12 h-12 rounded-xl bg-[#059669]/15 text-[#34D399] flex items-center justify-center shrink-0 border border-[#059669]/20">
                        <span className="material-icons text-[24px]">price_check</span>
                      </div>
                      <div>
                        <h3 className="text-[14px] font-bold text-slate-100 mb-1">Financial Dossier Attached?</h3>
                        <p className="text-[12px] text-slate-400 font-medium">Has the budgeting team confirmed the presentation?</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-8">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input type="radio" checked={form.picChecklist_verified === 'Yes'} onChange={() => updateForm('picChecklist_verified', 'Yes')} className="w-5 h-5 accent-[#059669]" />
                        <span className="text-[14px] font-bold text-slate-300">Yes</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input type="radio" checked={form.picChecklist_verified === 'No'} onChange={() => updateForm('picChecklist_verified', 'No')} className="w-5 h-5 accent-[#059669]" />
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
              <button onClick={autofillAI} className="px-5 py-2.5 rounded-xl border border-[#059669]/30 text-[#34D399] font-bold text-[13px] bg-[#059669]/10 hover:bg-[#059669]/20 transition-colors">
                Fill with AI
              </button>
              {currentSectionIndex < sections.length - 1 ? (
                <button onClick={nextSection} className="px-8 py-2.5 rounded-xl bg-gradient-to-r from-[#10B981] to-[#059669] text-white font-bold text-[13px] shadow-md hover:shadow-[#34D399] transition-all">
                  Next
                </button>
              ) : (
                <button onClick={submitData} className="px-8 py-2.5 rounded-xl bg-gradient-to-r from-[#10B981] to-[#059669] text-white font-bold text-[13px] shadow-md hover:shadow-[#34D399] transition-all">
                  Verify & Send to PIC Meeting
                </button>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
