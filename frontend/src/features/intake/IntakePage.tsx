import { useState, useRef } from "react";
import { useNavigate } from "react-router";
import { projectsApi } from "../../lib/api";
import { ApiError } from "../../lib/apiClient";
import { useAuth } from "../../app/AuthContext";

export function IntakePage() {
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const isAdmin = hasRole(['admin']);

  const [submitting, setSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [createdProjectId, setCreatedProjectId] = useState("");
  const [createdProjectNumber, setCreatedProjectNumber] = useState("");
  const [hasErrors, setHasErrors] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form State
  const [form, setForm] = useState({
    // Step 1
    requestorName: "Gurrammaneesh User",
    requestingDepartment: "",
    requestType: "Pre-Project Discovery",
    projectName: "",
    problemStatement: "",
    desiredOutcome: "",
    whatDoYouDoToday: "",
    whatTranspiresIfWeDoNothing: "",
    notesComments: "",
    sendCopyOfResponses: false,
    emailAddress: "john.smith@company.com",
    // Step 2
    budgetType: "tbd",
    budgetEstimated: "",
    priority: "medium",
    riskLevel: "medium",
    strategicAlignment: "",
    // Step 3
    itInvolvement: false,
    vendorRequired: false,
    hasPhiData: false,
  });

  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const updateForm = (field: string, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const markTouched = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  const isInvalid = (field: keyof typeof form, required = true) => {
    if (!touched[field] && !hasErrors) return false;
    if (required) {
      if (typeof form[field] === 'string' && (form[field] as string).trim() === '') return true;
      if (form[field] === null || form[field] === undefined) return true;
    }
    return false;
  };

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFileName(file.name);
    setIsExtracting(true);
    
    try {
      const { data } = await projectsApi.extractIntake(file);
      setForm(prev => ({
        ...prev,
        projectName: data.projectName || prev.projectName,
        problemStatement: data.problemStatement || prev.problemStatement,
        desiredOutcome: data.desiredOutcome || prev.desiredOutcome,
        whatDoYouDoToday: data.whatDoYouDoToday || prev.whatDoYouDoToday,
        whatTranspiresIfWeDoNothing: data.whatTranspiresIfWeDoNothing || prev.whatTranspiresIfWeDoNothing,
        notesComments: data.notesComments || prev.notesComments,
      }));
    } catch (err) {
      console.error(err);
      alert("AI Extraction Failed: " + (err instanceof ApiError ? err.message : "Unknown error"));
    } finally {
      setIsExtracting(false);
    }
  }

  async function submitIntake(e: React.FormEvent) {
    e.preventDefault();
    
    // Validate required fields
    const requiredFields = [
      'requestorName', 'requestingDepartment', 'requestType', 'projectName',
      'problemStatement', 'desiredOutcome', 'budgetType', 'priority'
    ];
    
    let invalid = false;
    requiredFields.forEach(f => {
      if ((form[f as keyof typeof form] as string).trim() === '') invalid = true;
    });

    if (form.sendCopyOfResponses && !form.emailAddress.includes('@')) {
      invalid = true;
    }

    if (invalid) {
      setHasErrors(true);
      return;
    }

    setHasErrors(false);
    setSubmitting(true);
    
    try {
      const payload = {
        project_name: form.projectName,
        business_unit: form.requestingDepartment,
        department: form.requestingDepartment,
        requestor_name: form.requestorName,
        request_type: form.requestType,
        problem_statement: form.problemStatement,
        desired_outcome: form.desiredOutcome,
        what_do_you_do_today: form.whatDoYouDoToday,
        what_transpires_if_nothing: form.whatTranspiresIfWeDoNothing,
        notes: form.notesComments,
        budget_type: form.budgetType,
        budget_estimated: form.budgetEstimated ? parseFloat(form.budgetEstimated.replace(/[^0-9.]/g, '')) : undefined,
        priority: form.priority.toUpperCase(),
        risk_level: form.riskLevel.toUpperCase(),
        strategic_alignment: form.strategicAlignment,
        it_involvement: form.itInvolvement,
        vendor_required: form.vendorRequired,
        has_phi_data: form.hasPhiData,
      };

      const project = await projectsApi.create(payload);
      setCreatedProjectId(project.id);
      setCreatedProjectNumber(project.project_number);
      setSubmittedSuccess(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      
      if (form.sendCopyOfResponses && form.emailAddress) {
        await projectsApi.sendIntakeEmail(project.id, form.emailAddress, payload);
      }
    } catch (err) {
      alert("Error: " + (err instanceof ApiError ? err.message : "Submission failed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="animate-fade-in min-h-[calc(100vh-4rem)] bg-[#0f172a] text-slate-100 relative overflow-hidden font-sans">
      {/* Background Gradients */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-[#111827] to-[#1e1b4b] z-0"></div>
      <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] bg-blue-600/20 rounded-full blur-[150px] pointer-events-none mix-blend-screen z-0 animate-pulse transition-opacity duration-1000"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-purple-600/20 rounded-full blur-[120px] pointer-events-none mix-blend-screen z-0"></div>

      <div className="max-w-7xl mx-auto p-6 lg:p-8 relative z-10">
        <div className="bg-slate-800/70 backdrop-blur-xl w-full rounded-2xl border border-slate-700/50 shadow-[0_25px_50px_-12px_rgba(49,46,129,0.5)] overflow-hidden flex flex-col">
          
          {/* Header Bar */}
          <div className="bg-gradient-to-r from-slate-800 to-slate-800/80 px-6 py-4 lg:px-8 lg:py-6 border-b border-slate-700/50 flex justify-between items-center sticky top-0 z-10 backdrop-blur-md shadow-sm">
            <div className="flex flex-col">
              <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
                <span className="material-icons text-indigo-400">note_add</span> New Proposal Intake
              </h1>
              <p className="text-sm font-medium text-slate-400 mt-1">Complete all sections below to submit your project for governance review.</p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => navigate("/dashboard")} className="w-10 h-10 rounded-xl bg-slate-800/50 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700 transition-all flex items-center justify-center shadow-sm">
                <span className="material-icons text-[20px]">close</span>
              </button>
            </div>
          </div>

          <div className="p-6 lg:p-8 bg-slate-900/40">
            {!submittedSuccess ? (
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8">
                
                {/* Main Form Panel */}
                <div className="flex flex-col gap-8">
                  
                  {/* Section 1: Project Information */}
                  <div className="bg-slate-900/40 rounded-xl border border-slate-700/50 p-6 lg:p-8 shadow-inner shadow-slate-800">
                    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-700/50">
                      <div className="bg-indigo-500/20 p-2 rounded-lg border border-indigo-500/30 text-indigo-400 shadow-inner">
                        <span className="material-icons text-xl block">info</span>
                      </div>
                      <h2 className="text-lg font-bold text-white tracking-wide">1. Project Information</h2>
                    </div>

                    <div 
                      className="border-2 border-dashed border-slate-600/50 rounded-2xl p-6 mb-8 group bg-slate-900/30 hover:border-indigo-500/60 hover:bg-slate-800/50 transition-all cursor-pointer flex items-center gap-5"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <div className="w-14 h-14 rounded-full bg-slate-800 border border-slate-700 group-hover:bg-indigo-500/20 group-hover:border-indigo-500/40 group-hover:text-indigo-400 text-slate-400 flex items-center justify-center transition-all duration-300 shadow-md">
                        <span className="material-icons text-2xl">cloud_upload</span>
                      </div>
                      <div className="flex flex-col flex-1">
                        <div className="font-bold text-sm text-slate-200 group-hover:text-indigo-300 transition-colors">Upload Project Document / Attachments (Optional)</div>
                        <div className="text-xs text-slate-500 mt-1">AI will automatically extract & pre-fill form details &bull; PDF, DOCX, TXT</div>
                        {isExtracting && (
                          <div className="mt-3 text-xs font-bold text-indigo-400 flex items-center gap-2 bg-indigo-900/30 px-3 py-1.5 rounded-lg border border-indigo-500/30 w-fit">
                            <span className="material-icons text-[16px] animate-spin">sync</span> AI is extracting data...
                          </div>
                        )}
                        {uploadedFileName && !isExtracting && (
                          <div className="mt-3 text-xs font-bold text-emerald-400 flex items-center gap-2 bg-emerald-900/30 px-3 py-1.5 rounded-lg border border-emerald-500/30 w-fit">
                            <span className="material-icons text-[16px]">attach_file</span> Attached: {uploadedFileName}
                          </div>
                        )}
                      </div>
                      <button className="hidden md:flex text-xs font-bold text-indigo-300 hover:text-white items-center gap-1.5 bg-slate-800 hover:bg-indigo-600 px-4 py-2 rounded-xl transition-colors border border-slate-700 hover:border-indigo-500 shadow-sm">
                        <span className="material-icons text-[16px]">folder_open</span> Browse
                      </button>
                      <input ref={fileInputRef} type="file" accept=".pdf,.docx,.txt" className="hidden" onChange={handleFileSelected} />
                    </div>

                    <div className="flex flex-col gap-5">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Requestor Name <span className="text-red-400">*</span></label>
                          <input type="text" className="w-full bg-slate-900/80 border border-slate-700 text-slate-400 rounded-lg px-4 py-2.5 text-sm cursor-not-allowed" value={form.requestorName} readOnly />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Requesting Department <span className="text-red-400">*</span></label>
                          <select 
                            className={`w-full bg-slate-800 border text-slate-50 rounded-lg px-4 py-2.5 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all ${isInvalid('requestingDepartment') ? 'border-red-400 bg-red-500/5' : 'border-slate-700'}`}
                            value={form.requestingDepartment}
                            onChange={(e) => updateForm('requestingDepartment', e.target.value)}
                            onBlur={() => markTouched('requestingDepartment')}
                            style={{ appearance: 'none', backgroundImage: 'url("data:image/svg+xml,%3csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3e%3cpath stroke=\'%2394a3b8\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'M6 8l4 4 4-4\'/%3e%3c/svg%3e")', backgroundPosition: 'right 0.75rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.25em 1.25em' }}
                          >
                            <option value="" className="bg-slate-800">Select...</option>
                            {["Clinical IT", "Infrastructure", "Data & Analytics", "Innovation", "HR Technology", "IT Operations", "Finance Technology", "Compliance", "InfoSec", "Cardiology", "Radiology", "Pharmacy"].map(dept => (
                              <option key={dept} value={dept} className="bg-slate-800">{dept}</option>
                            ))}
                          </select>
                          {isInvalid('requestingDepartment') && <div className="text-red-400 text-xs font-bold mt-1.5 flex items-center gap-1"><span className="material-icons text-[14px]">warning</span> Required field</div>}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Request Type <span className="text-red-400">*</span></label>
                          <select 
                            className="w-full bg-slate-800 border border-slate-700 text-slate-50 rounded-lg px-4 py-2.5 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                            value={form.requestType}
                            onChange={(e) => updateForm('requestType', e.target.value)}
                            style={{ appearance: 'none', backgroundImage: 'url("data:image/svg+xml,%3csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3e%3cpath stroke=\'%2394a3b8\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'M6 8l4 4 4-4\'/%3e%3c/svg%3e")', backgroundPosition: 'right 0.75rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.25em 1.25em' }}
                          >
                            {["Pre-Project Discovery", "New System Implementation", "System Enhancement / Upgrade", "Infrastructure Hardware", "Process Optimization"].map(t => <option key={t} value={t} className="bg-slate-800">{t}</option>)}
                          </select>
                        </div>
                      </div>

                      <div className="mt-2">
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Project Name <span className="text-red-400">*</span></label>
                        <input 
                          type="text" 
                          className={`w-full bg-slate-800 border text-slate-50 rounded-lg px-4 py-2.5 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder-slate-500 ${isInvalid('projectName') ? 'border-red-400 bg-red-500/5' : 'border-slate-700'}`}
                          placeholder="Enter project name..."
                          value={form.projectName}
                          onChange={(e) => updateForm('projectName', e.target.value)}
                          onBlur={() => markTouched('projectName')}
                        />
                        {isInvalid('projectName') && <div className="text-red-400 text-xs font-bold mt-1.5 flex items-center gap-1"><span className="material-icons text-[14px]">warning</span> Required field</div>}
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Problem or Opportunity Statement <span className="text-red-400">*</span></label>
                        <textarea 
                          rows={3}
                          className={`w-full bg-slate-800 border text-slate-50 rounded-lg px-4 py-2.5 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder-slate-500 ${isInvalid('problemStatement') ? 'border-red-400 bg-red-500/5' : 'border-slate-700'}`}
                          placeholder="Describe the current problem, pain points, or business opportunity..."
                          value={form.problemStatement}
                          onChange={(e) => updateForm('problemStatement', e.target.value)}
                          onBlur={() => markTouched('problemStatement')}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Desired Outcome <span className="text-red-400">*</span></label>
                        <textarea 
                          rows={3}
                          className={`w-full bg-slate-800 border text-slate-50 rounded-lg px-4 py-2.5 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder-slate-500 ${isInvalid('desiredOutcome') ? 'border-red-400 bg-red-500/5' : 'border-slate-700'}`}
                          placeholder="Describe the target outcomes and success criteria..."
                          value={form.desiredOutcome}
                          onChange={(e) => updateForm('desiredOutcome', e.target.value)}
                          onBlur={() => markTouched('desiredOutcome')}
                        />
                      </div>
                      
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">What Do You Do Today?</label>
                        <textarea 
                          rows={3}
                          maxLength={1024}
                          className="w-full bg-slate-800 border border-slate-700 text-slate-50 rounded-lg px-4 py-2.5 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder-slate-500"
                          value={form.whatDoYouDoToday}
                          onChange={(e) => updateForm('whatDoYouDoToday', e.target.value)}
                        />
                        <div className="text-right text-xs font-semibold text-slate-500 mt-1">{form.whatDoYouDoToday.length} of 1024</div>
                      </div>

                      <div>
                         <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">What Transpires If We Do Nothing?</label>
                        <textarea 
                          rows={3}
                          maxLength={1024}
                          className="w-full bg-slate-800 border border-slate-700 text-slate-50 rounded-lg px-4 py-2.5 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder-slate-500"
                          value={form.whatTranspiresIfWeDoNothing}
                          onChange={(e) => updateForm('whatTranspiresIfWeDoNothing', e.target.value)}
                        />
                      </div>
                      
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Notes / Comments</label>
                        <textarea 
                          rows={2}
                          className="w-full bg-slate-800 border border-slate-700 text-slate-50 rounded-lg px-4 py-2.5 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                          value={form.notesComments}
                          onChange={(e) => updateForm('notesComments', e.target.value)}
                        />
                      </div>

                      <div className="mt-4 pt-4 border-t border-slate-700/50">
                        <label className="flex items-center gap-3 cursor-pointer group w-fit">
                          <input 
                            type="checkbox" 
                            className="w-5 h-5 rounded border-slate-600 bg-slate-800 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-slate-900 transition-all cursor-pointer accent-indigo-500" 
                            checked={form.sendCopyOfResponses}
                            onChange={(e) => updateForm('sendCopyOfResponses', e.target.checked)}
                          />
                          <span className="text-sm font-semibold text-slate-300 group-hover:text-white transition-colors">Send me a copy of my responses</span>
                        </label>
                        {form.sendCopyOfResponses && (
                          <div className="animate-fade-in mt-4 max-w-md">
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Email Address <span className="text-red-400">*</span></label>
                            <input 
                              type="email" 
                              className={`w-full bg-slate-800 border text-slate-50 rounded-lg px-4 py-2.5 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder-slate-500 ${isInvalid('emailAddress') ? 'border-red-400 bg-red-500/5' : 'border-slate-700'}`}
                              placeholder="john.smith@company.com"
                              value={form.emailAddress}
                              onChange={(e) => updateForm('emailAddress', e.target.value)}
                              onBlur={() => markTouched('emailAddress')}
                            />
                             {isInvalid('emailAddress') && <div className="text-red-400 text-xs font-bold mt-1.5 flex items-center gap-1"><span className="material-icons text-[14px]">warning</span> Valid email required</div>}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Budget & Strategy */}
                  <div className="bg-slate-900/40 rounded-xl border border-slate-700/50 p-6 lg:p-8 shadow-inner shadow-slate-800">
                    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-700/50">
                      <div className="bg-emerald-500/20 p-2 rounded-lg border border-emerald-500/30 text-emerald-400 shadow-inner">
                        <span className="material-icons text-xl block">payments</span>
                      </div>
                      <h2 className="text-lg font-bold text-white tracking-wide">2. Budget & Strategic Alignment</h2>
                    </div>

                    <div className="flex flex-col gap-5">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Budget Type <span className="text-red-400">*</span></label>
                          <select 
                            className="w-full bg-slate-800 border border-slate-700 text-slate-50 rounded-lg px-4 py-2.5 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                            value={form.budgetType} onChange={(e) => updateForm('budgetType', e.target.value)}
                            style={{ appearance: 'none', backgroundImage: 'url("data:image/svg+xml,%3csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3e%3cpath stroke=\'%2394a3b8\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'M6 8l4 4 4-4\'/%3e%3c/svg%3e")', backgroundPosition: 'right 0.75rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.25em 1.25em' }}
                          >
                            {["tbd", "Operational", "Capital", "Grant"].map(t => <option key={t} value={t} className="bg-slate-800 uppercase">{t}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Estimated Total Project Budget</label>
                          <input type="text" className="w-full bg-slate-800 border border-slate-700 text-slate-50 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500" placeholder="e.g. $85,000" value={form.budgetEstimated} onChange={(e) => updateForm('budgetEstimated', e.target.value)}/>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Project Priority <span className="text-red-400">*</span></label>
                          <select 
                            className="w-full bg-slate-800 border border-slate-700 text-slate-50 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                            value={form.priority} onChange={(e) => updateForm('priority', e.target.value)}
                            style={{ appearance: 'none', backgroundImage: 'url("data:image/svg+xml,%3csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3e%3cpath stroke=\'%2394a3b8\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'M6 8l4 4 4-4\'/%3e%3c/svg%3e")', backgroundPosition: 'right 0.75rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.25em 1.25em' }}
                          >
                            {["low", "medium", "high", "critical"].map(t => <option key={t} value={t} className="bg-slate-800 capitalize">{t}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Initial Risk Level Assessment</label>
                         <select 
                            className="w-full bg-slate-800 border border-slate-700 text-slate-50 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                            value={form.riskLevel} onChange={(e) => updateForm('riskLevel', e.target.value)}
                            style={{ appearance: 'none', backgroundImage: 'url("data:image/svg+xml,%3csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3e%3cpath stroke=\'%2394a3b8\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'M6 8l4 4 4-4\'/%3e%3c/svg%3e")', backgroundPosition: 'right 0.75rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.25em 1.25em' }}
                          >
                            {["low", "medium", "high"].map(t => <option key={t} value={t} className="bg-slate-800 capitalize">{t}</option>)}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Strategic Alignment & Rationale</label>
                        <textarea 
                          rows={3}
                          className="w-full bg-slate-800 border border-slate-700 text-slate-50 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500 placeholder-slate-500"
                          placeholder="Describe how this project aligns with key business objectives and enterprise standards..."
                          value={form.strategicAlignment} onChange={(e) => updateForm('strategicAlignment', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Section 3: IT & Governance Requirements */}
                  <div className="bg-slate-900/40 rounded-xl border border-slate-700/50 p-6 lg:p-8 shadow-inner shadow-slate-800">
                    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-700/50">
                      <div className="bg-orange-500/20 p-2 rounded-lg border border-orange-500/30 text-orange-400 shadow-inner">
                        <span className="material-icons text-xl block">security</span>
                      </div>
                      <h2 className="text-lg font-bold text-white tracking-wide">3. IT & Governance Requirements</h2>
                    </div>

                    <div className="flex flex-col gap-4">
                      {[ 
                        { k: 'itInvolvement', t: 'Dedicated IT Resources Required', d: 'Will this initiative require active support from corporate/clinical IT teams?' },
                        { k: 'vendorRequired', t: 'External Vendor Solution / Products', d: 'Does this involve procuring hardware, software licenses, or consulting from third parties?' },
                        { k: 'hasPhiData', t: 'Contains Protected Health Information (PHI/PII)', d: 'Will patient information, SSNs, financial details, or HIPAA-regulated data be touched?' }
                      ].map((item, idx) => (
                         <label key={idx} className="flex items-center justify-between p-4 bg-slate-800/40 hover:bg-slate-800/80 rounded-xl border border-slate-700/50 cursor-pointer transition-colors group">
                           <div>
                             <div className="font-bold text-sm text-slate-200 group-hover:text-white transition-colors">{item.t}</div>
                             <div className="text-xs text-slate-400 mt-0.5">{item.d}</div>
                           </div>
                           <input type="checkbox" className="w-6 h-6 rounded border-slate-600 bg-slate-800 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-slate-900 transition-all cursor-pointer accent-indigo-500" checked={form[item.k as keyof typeof form] as boolean} onChange={(e) => updateForm(item.k, e.target.checked)} />
                         </label>
                      ))}
                    </div>
                  </div>

                  {hasErrors && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-center gap-3 font-bold text-sm animate-fade-in shadow-md shadow-red-500/5">
                      <span className="material-icons text-xl">error</span>
                      <span>Please fill in all required fields highlighted in red before submitting.</span>
                    </div>
                  )}

                  <div className="bg-slate-900/40 rounded-xl border border-slate-700/50 p-6 flex justify-end items-center gap-4 mt-2 shadow-lg">
                    <button type="button" onClick={() => navigate("/dashboard")} className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-300 hover:text-white hover:bg-slate-700 transition-colors">Cancel</button>
                    <button type="button" onClick={submitIntake} disabled={submitting} className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white px-8 py-3 rounded-xl text-sm font-bold shadow-lg shadow-indigo-500/25 transition-all flex items-center gap-2 hover:scale-[1.02]">
                      {submitting ? <span className="material-icons animate-spin">autorenew</span> : <span className="material-icons text-[18px]">send</span>}
                      {submitting ? 'Submitting...' : 'Submit Proposal'}
                    </button>
                  </div>

                </div>

                {/* Right Sidebar */}
                <div className="hidden lg:block relative">
                   <div className="bg-slate-900/40 rounded-xl border border-slate-700/50 p-6 sticky top-28 shadow-lg">
                     <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-700/50">
                       <div className="bg-blue-500/20 p-2 rounded-lg border border-blue-500/30 text-blue-400 shadow-inner">
                         <span className="material-icons text-xl block">route</span>
                       </div>
                       <h3 className="text-base font-bold text-white tracking-wide">What Happens Next?</h3>
                     </div>

                     <div className="flex flex-col gap-5 relative pl-4">
                       <div className="absolute left-7 top-4 bottom-8 w-px bg-slate-700"></div>

                       {[
                         { step: 1, c: 'border-blue-500 text-blue-400', title: 'BTA Discovery Review', desc: 'Business Tech Advocate schedules discovery and reviews the intake' },
                         { step: 2, c: 'border-slate-600 text-slate-400', title: 'Prepare for EAC', desc: 'Formulate 9-domain architecture alignment dossier' },
                         { step: 3, c: 'border-slate-600 text-slate-400', title: 'EAC Committee Meeting', desc: 'Enterprise Architecture Council formal alignment vote' },
                         { step: 4, c: 'border-slate-600 text-slate-400', title: 'Gate Reviews', desc: 'Committee evaluation for funding and architecture compliance' },
                       ].map(s => (
                         <div key={s.step} className="flex gap-4 relative z-10">
                           <div className={`w-7 h-7 rounded-full bg-slate-800 border-2 ${s.c} flex items-center justify-center text-xs font-bold shadow-md shrink-0`}>{s.step}</div>
                           <div>
                             <div className="text-sm font-bold text-slate-200">{s.title}</div>
                             <div className="text-xs text-slate-400 mt-1">{s.desc}</div>
                           </div>
                         </div>
                       ))}
                     </div>
                   </div>
                </div>

              </div>
            ) : (
              <div className="animate-fade-in flex flex-col items-center justify-center py-20 text-center">
                 <div className="w-24 h-24 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mb-6 shadow-lg shadow-emerald-500/10">
                   <span className="material-icons text-6xl text-emerald-400">check_circle</span>
                 </div>
                 <h2 className="text-3xl font-extrabold text-white mb-3">Proposal Submitted Successfully!</h2>
                 <p className="text-slate-300 max-w-lg mb-8 leading-relaxed">
                   Your project proposal <strong className="text-white">{form.projectName}</strong> has been officially registered as <strong className="text-indigo-300 bg-indigo-900/40 px-2 py-0.5 rounded border border-indigo-500/30 whitespace-nowrap">{createdProjectNumber}</strong> and routed to the Business Tech Advocate (BTA) team for initial discovery.
                 </p>
                 <div className="flex gap-4 flex-wrap justify-center mt-2">
                   <button type="button" onClick={() => navigate("/projects")} className="px-6 py-3 rounded-xl text-sm font-bold text-slate-300 border border-slate-700 bg-slate-800/50 hover:text-white hover:bg-slate-700 hover:border-slate-600 transition-all shadow-md">Return to Projects</button>
                   {isAdmin && (
                     <button 
                      type="button" 
                      onClick={() => navigate(`/projects/${createdProjectId}/workspace`, { state: { projectData: form, projectId: createdProjectId, fromAdminOverride: true } })} 
                      className="bg-orange-500/20 border border-orange-500/30 text-orange-400 hover:bg-orange-500/30 px-6 py-3 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-md"
                     >
                       <span className="material-icons text-[18px]">admin_panel_settings</span> Admin Override: BTA Review
                     </button>
                   )}
                 </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
