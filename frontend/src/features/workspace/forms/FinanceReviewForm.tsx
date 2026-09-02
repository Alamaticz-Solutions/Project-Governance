import { useEffect, useState } from "react";
import { AIPopulationDropzone } from "../components/AIPopulationDropzone";

export interface FinanceFormData {
  [key: string]: any;
}

interface FinanceReviewFormProps {
  projectId: string;
  onFormChange?: (data: FinanceFormData, isValid: boolean) => void;
}

export function FinanceReviewForm({ projectId: _projectId, onFormChange }: FinanceReviewFormProps) {
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);

  const sections = [
    { title: 'Detailed Cost Plan', icon: 'table_chart', description: 'Enter all cost line items by fiscal year and category' },
    { title: 'ROI Analysis', icon: 'trending_up', description: 'Quantify the return on investment and payback period' },
    { title: 'Finance Checklist', icon: 'fact_check', description: 'Confirm all mandatory finance approvals and sign-offs' }
  ];

  const [form, setForm] = useState<any>({
    totalCapex: '',
    totalOpex: '',
    totalRunCosts: '',
    grandTotal: '',
    memoOpex: '',
    devImplCosts: '',
    softwareLicensing: '',
    annualCosts: '',
    annualBenefits: '',
    netCashFlow: '',
    cumulativeCashFlow: '',
    paybackPeriod: '',
    roiPercentage: '',
    financeNarrative: '',
    financeChecklist_budget: 'Yes',
    financeChecklist_capex: 'Yes'
  });

  const [costItems, setCostItems] = useState<any[]>([
    { name: '', justification: '', category: '', costType: '', fy24: '', fy25: '', fy26: '', fy27: '' }
  ]);

  const isValid = (f: any) => !!(f.financeChecklist_budget);

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

const updateForm = (key: string, value: any) => {
    setForm((prev: any) => {
      const next = { ...prev, [key]: value };
      onFormChange?.(next, isValid(next));
      return next;
    });
  };

  useEffect(() => {
    onFormChange?.(form, isValid(form));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addCostItem = () => {
    setCostItems([...costItems, { name: '', justification: '', category: '', costType: '', fy24: '', fy25: '', fy26: '', fy27: '' }]);
  };

  const removeCostItem = (index: number) => {
    setCostItems(costItems.filter((_, i) => i !== index));
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


  // No internal submit — handled by parent via onFormChange

  const annualBenefitsNum = parseFloat(form.annualBenefits.replace(/,/g, '')) || 0;
  const annualCostsNum = parseFloat(form.annualCosts.replace(/,/g, '')) || 0;
  const netBenefitNum = annualBenefitsNum - annualCostsNum;

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
            Finance Review Steps
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
            boxShadow: "0 8px 32px rgba(16,185,129,0.12)"
          }}
        >
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
            {/* ── 1. DETAILED COST PLAN ── */}
            {currentSectionIndex === 0 && (
              <div className="animate-fade-in">
                <AIPopulationDropzone projectId={_projectId} team="FINANCE" onExtractionComplete={handleAIExtraction} />

                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-base font-extrabold text-slate-100 flex items-center gap-2">
                    <span className="material-icons text-indigo-500 text-[20px]">table_chart</span>
                    Cost Plan
                  </h3>
                  <button onClick={addCostItem}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 font-bold text-xs rounded-xl border border-indigo-500/30 transition-all duration-200">
                    <span className="material-icons text-[16px]">add</span> Add Cost Plan
                  </button>
                </div>

                {/* Cost Table */}
                <div className="rounded-xl border border-white/10 overflow-x-auto shadow-sm mb-8 bg-black/20">
                  <table className="w-full text-[12px] whitespace-nowrap">
                    <thead>
                      <tr className="bg-white/5 text-slate-300">
                        <th className="text-left px-4 py-3 font-bold border-b border-white/10 min-w-[150px]">Cost Item Name</th>
                        <th className="text-left px-4 py-3 font-bold border-b border-white/10 min-w-[150px]">Justification</th>
                        <th className="text-left px-4 py-3 font-bold border-b border-white/10 min-w-[130px]">Category</th>
                        <th className="text-left px-4 py-3 font-bold border-b border-white/10 min-w-[100px]">Cost Type</th>
                        <th className="text-left px-4 py-3 font-bold border-b border-white/10 min-w-[110px]">FY24</th>
                        <th className="text-left px-4 py-3 font-bold border-b border-white/10 min-w-[110px]">FY25</th>
                        <th className="text-left px-4 py-3 font-bold border-b border-white/10 min-w-[110px]">FY26</th>
                        <th className="text-left px-4 py-3 font-bold border-b border-white/10 min-w-[110px]">FY27</th>
                        <th className="text-center px-4 py-3 font-bold border-b border-white/10 w-12"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {costItems.map((item, idx) => (
                        <tr key={idx} className="hover:bg-indigo-500/5 transition-colors border-b border-white/10 last:border-0 group">
                          <td className="px-3 py-2">
                            <input type="text" value={item.name} onChange={e => {
                                const newItems = [...costItems];
                                newItems[idx].name = e.target.value;
                                setCostItems(newItems);
                              }}
                              className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-slate-100 outline-none" placeholder="Item name" />
                          </td>
                          <td className="px-3 py-2">
                            <input type="text" value={item.justification} onChange={e => {
                                const newItems = [...costItems];
                                newItems[idx].justification = e.target.value;
                                setCostItems(newItems);
                              }}
                              className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-slate-100 outline-none" placeholder="Justification" />
                          </td>
                          <td className="px-3 py-2">
                            <select value={item.category} onChange={e => {
                                const newItems = [...costItems];
                                newItems[idx].category = e.target.value;
                                setCostItems(newItems);
                              }}
                              className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-slate-100 outline-none">
                              <option className="bg-slate-800 text-white" value="">Select...</option>
                              <option className="bg-slate-800 text-white">Software</option>
                              <option className="bg-slate-800 text-white">Hardware</option>
                              <option className="bg-slate-800 text-white">Services</option>
                              <option className="bg-slate-800 text-white">Infrastructure</option>
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <select value={item.costType} onChange={e => {
                                const newItems = [...costItems];
                                newItems[idx].costType = e.target.value;
                                setCostItems(newItems);
                              }}
                              className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-slate-100 outline-none">
                              <option className="bg-slate-800 text-white" value="">Select...</option>
                              <option className="bg-slate-800 text-white">CapEx</option>
                              <option className="bg-slate-800 text-white">OpEx</option>
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <div className="relative">
                              <span className="absolute left-2 top-1.5 text-slate-500 text-[10px] font-bold">US$</span>
                              <input type="number" value={item.fy24} onChange={e => {
                                const newItems = [...costItems];
                                newItems[idx].fy24 = e.target.value;
                                setCostItems(newItems);
                              }} className="w-full bg-white/5 border border-white/10 rounded-lg pl-7 pr-2 py-1.5 text-slate-100 outline-none" placeholder="0" />
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <div className="relative">
                              <span className="absolute left-2 top-1.5 text-slate-500 text-[10px] font-bold">US$</span>
                              <input type="number" value={item.fy25} onChange={e => {
                                const newItems = [...costItems];
                                newItems[idx].fy25 = e.target.value;
                                setCostItems(newItems);
                              }} className="w-full bg-white/5 border border-white/10 rounded-lg pl-7 pr-2 py-1.5 text-slate-100 outline-none" placeholder="0" />
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <div className="relative">
                              <span className="absolute left-2 top-1.5 text-slate-500 text-[10px] font-bold">US$</span>
                              <input type="number" value={item.fy26} onChange={e => {
                                const newItems = [...costItems];
                                newItems[idx].fy26 = e.target.value;
                                setCostItems(newItems);
                              }} className="w-full bg-white/5 border border-white/10 rounded-lg pl-7 pr-2 py-1.5 text-slate-100 outline-none" placeholder="0" />
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <div className="relative">
                              <span className="absolute left-2 top-1.5 text-slate-500 text-[10px] font-bold">US$</span>
                              <input type="number" value={item.fy27} onChange={e => {
                                const newItems = [...costItems];
                                newItems[idx].fy27 = e.target.value;
                                setCostItems(newItems);
                              }} className="w-full bg-white/5 border border-white/10 rounded-lg pl-7 pr-2 py-1.5 text-slate-100 outline-none" placeholder="0" />
                            </div>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <button onClick={() => removeCostItem(idx)} className="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100">
                              <span className="material-icons text-[16px]">delete</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                      {costItems.length === 0 && (
                        <tr>
                          <td colSpan={9} className="px-4 py-10 text-center">
                            <p className="text-slate-500 text-sm font-medium">No cost items added yet</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Financial Summaries */}
                <div className="p-6 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 mb-6">
                  <div className="flex items-center gap-2 mb-5">
                    <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
                      <span className="material-icons text-white text-[16px]">summarize</span>
                    </div>
                    <h3 className="text-sm font-extrabold text-slate-100 uppercase tracking-wider">Financial Summaries</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Total CapEx</label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-slate-500 text-xs font-bold">US$</span>
                        <input type="text" value={form.totalCapex} onChange={e => updateForm('totalCapex', e.target.value)} placeholder="0.00"
                               className="w-full bg-black/20 border border-indigo-500/30 rounded-xl pl-10 pr-4 py-2 text-sm font-medium text-slate-100 outline-none focus:border-indigo-400" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Total OpEx</label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-slate-500 text-xs font-bold">US$</span>
                        <input type="text" value={form.totalOpex} onChange={e => updateForm('totalOpex', e.target.value)} placeholder="0.00"
                               className="w-full bg-black/20 border border-indigo-500/30 rounded-xl pl-10 pr-4 py-2 text-sm font-medium text-slate-100 outline-none focus:border-indigo-400" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Total Run Costs</label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-slate-500 text-xs font-bold">US$</span>
                        <input type="text" value={form.totalRunCosts} onChange={e => updateForm('totalRunCosts', e.target.value)} placeholder="0.00"
                               className="w-full bg-black/20 border border-indigo-500/30 rounded-xl pl-10 pr-4 py-2 text-sm font-medium text-slate-100 outline-none focus:border-indigo-400" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Grand Total Project Costs</label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-slate-500 text-xs font-bold">US$</span>
                        <input type="text" value={form.grandTotal} onChange={e => updateForm('grandTotal', e.target.value)} placeholder="0.00"
                               className="w-full bg-black/20 border border-indigo-500/30 rounded-xl pl-10 pr-4 py-2 text-sm font-bold text-indigo-300 outline-none focus:border-indigo-400" />
                      </div>
                    </div>
                    <div className="col-span-2">
                       <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Memo: FY OPEX Impact</label>
                       <textarea rows={3} value={form.memoOpex} onChange={e => updateForm('memoOpex', e.target.value)} placeholder="Describe ongoing impact..."
                                 className="w-full bg-black/20 border border-indigo-500/30 rounded-xl px-4 py-3 text-sm font-medium text-slate-100 outline-none focus:border-indigo-400 resize-y"></textarea>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── 2. ROI ANALYSIS ── */}
            {currentSectionIndex === 1 && (
              <div className="animate-fade-in">
                <div className="p-6 rounded-2xl bg-blue-500/10 border border-blue-500/20 mb-6">
                  <div className="flex items-center gap-2 mb-5">
                    <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                      <span className="material-icons text-white text-[16px]">trending_up</span>
                    </div>
                    <h3 className="text-sm font-extrabold text-slate-100 uppercase tracking-wider">ROI Analysis</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-5">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Dev & Impl Costs</label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-slate-500 text-xs font-bold">US$</span>
                        <input type="text" value={form.devImplCosts} onChange={e => updateForm('devImplCosts', e.target.value)} placeholder="0.00"
                               className="w-full bg-black/20 border border-blue-500/30 rounded-xl pl-10 pr-4 py-2 text-sm font-medium text-slate-100 outline-none focus:border-blue-400" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Software Licensing</label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-slate-500 text-xs font-bold">US$</span>
                        <input type="text" value={form.softwareLicensing} onChange={e => updateForm('softwareLicensing', e.target.value)} placeholder="0.00"
                               className="w-full bg-black/20 border border-blue-500/30 rounded-xl pl-10 pr-4 py-2 text-sm font-medium text-slate-100 outline-none focus:border-blue-400" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Annual Costs</label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-slate-500 text-xs font-bold">US$</span>
                        <input type="text" value={form.annualCosts} onChange={e => updateForm('annualCosts', e.target.value)} placeholder="0.00"
                               className="w-full bg-black/20 border border-blue-500/30 rounded-xl pl-10 pr-4 py-2 text-sm font-medium text-slate-100 outline-none focus:border-blue-400" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Annual Benefits</label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-slate-500 text-xs font-bold">US$</span>
                        <input type="text" value={form.annualBenefits} onChange={e => updateForm('annualBenefits', e.target.value)} placeholder="0.00"
                               className="w-full bg-black/20 border border-blue-500/30 rounded-xl pl-10 pr-4 py-2 text-sm font-medium text-slate-100 outline-none focus:border-blue-400" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Payback Period (Yrs)</label>
                      <input type="number" value={form.paybackPeriod} onChange={e => updateForm('paybackPeriod', e.target.value)} placeholder="0"
                             className="w-full bg-black/20 border border-blue-500/30 rounded-xl px-4 py-2 text-sm font-medium text-slate-100 outline-none focus:border-blue-400" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">ROI Percentage (%)</label>
                      <input type="number" value={form.roiPercentage} onChange={e => updateForm('roiPercentage', e.target.value)} placeholder="0"
                             className="w-full bg-black/20 border border-blue-500/30 rounded-xl px-4 py-2 text-sm font-medium text-slate-100 outline-none focus:border-blue-400" />
                    </div>
                  </div>

                  {/* Summary Cards */}
                  <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-white/10">
                    <div className="bg-black/20 rounded-xl p-4 border border-blue-500/20 text-center">
                      <span className="material-icons text-blue-400 text-2xl mb-1">savings</span>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Net Benefit</p>
                      <p className="text-lg font-extrabold text-blue-300">US$ {netBenefitNum.toLocaleString()}</p>
                    </div>
                    <div className="bg-black/20 rounded-xl p-4 border border-indigo-500/20 text-center">
                      <span className="material-icons text-indigo-400 text-2xl mb-1">percent</span>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">ROI</p>
                      <p className="text-lg font-extrabold text-indigo-300">{form.roiPercentage || '0'}%</p>
                    </div>
                    <div className="bg-black/20 rounded-xl p-4 border border-amber-500/20 text-center">
                      <span className="material-icons text-amber-400 text-2xl mb-1">hourglass_bottom</span>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Payback</p>
                      <p className="text-lg font-extrabold text-amber-300">{form.paybackPeriod || '0'} yrs</p>
                    </div>
                  </div>

                  <div className="mt-5">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Finance Narrative</label>
                    <textarea rows={4} value={form.financeNarrative} onChange={e => updateForm('financeNarrative', e.target.value)}
                              className="w-full bg-black/20 border border-blue-500/30 rounded-xl px-4 py-3 text-sm font-medium text-slate-100 outline-none focus:border-blue-400 resize-y" placeholder="Narrative..."></textarea>
                  </div>
                </div>
              </div>
            )}

            {/* ── 3. FINANCE CHECKLIST ── */}
            {currentSectionIndex === 2 && (
               <div className="animate-fade-in space-y-6">
                 <h3 className="text-[13px] font-extrabold uppercase tracking-widest mb-2 text-indigo-400">Finance Mandatory Checklist</h3>
                 <div className="space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between p-5 border border-white/10 rounded-xl bg-white/5 gap-4">
                      <div className="flex items-start gap-4 flex-1">
                        <div className="w-12 h-12 rounded-xl bg-indigo-500/15 text-indigo-300 flex items-center justify-center shrink-0 border border-indigo-500/20">
                          <span className="material-icons text-[24px]">price_check</span>
                        </div>
                        <div>
                          <h3 className="text-[14px] font-bold text-slate-100 mb-1">Budget Alignment Verified?</h3>
                          <p className="text-[12px] text-slate-400 font-medium">Has the budgeting team confirmed funds are allocated in the current FY?</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-8">
                        <label className="flex items-center gap-3 cursor-pointer group">
                          <input type="radio" checked={form.financeChecklist_budget === 'Yes'} onChange={() => updateForm('financeChecklist_budget', 'Yes')} className="w-5 h-5 text-indigo-500 accent-indigo-500" />
                          <span className="text-[14px] font-bold text-slate-300">Yes</span>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer group">
                          <input type="radio" checked={form.financeChecklist_budget === 'No'} onChange={() => updateForm('financeChecklist_budget', 'No')} className="w-5 h-5 text-indigo-500 accent-indigo-500" />
                          <span className="text-[14px] font-bold text-slate-300">No</span>
                        </label>
                      </div>
                    </div>
                </div>
              </div>
            )}
          </div>

          {/* ── NAVIGATION ACTIONS ── */}
          <div className="mt-8 flex items-center justify-between pt-6 border-t border-white/10">
            <button 
               className="px-6 py-2.5 rounded-xl border border-white/10 text-slate-300 font-bold text-[13px] bg-white/5 hover:bg-white/10 transition-colors flex items-center gap-2"
            >
              <span className="material-icons text-[18px]">close</span> Cancel
            </button>

            <div className="flex gap-3">
              <button 
                className={`px-5 py-2.5 rounded-xl border border-white/10 text-slate-300 font-bold text-[13px] bg-white/5 hover:bg-white/10 transition-colors flex items-center gap-2 ${currentSectionIndex === 0 ? 'invisible' : ''}`}
                onClick={prevSection}
              >
                <span className="material-icons text-[18px]">arrow_back</span> Previous
              </button>

              {currentSectionIndex < sections.length - 1 ? (
                <button 
                  className="px-8 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-700 text-white font-bold text-[13px] shadow-md hover:shadow-indigo-300 hover:shadow-lg transition-all flex items-center gap-2"
                  onClick={nextSection}
                >
                  Next <span className="material-icons text-[18px]">arrow_forward</span>
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
