import { useState, useRef } from "react";
import { useNavigate } from "react-router";
import { projectsApi } from "../../lib/api";
import { ApiError } from "../../lib/apiClient";

interface Step1Form {
  requestorName: string;
  requestingDepartment: string;
  requestType: string;
  projectName: string;
  problemStatement: string;
  desiredOutcome: string;
  whatDoYouDoToday: string;
  whatTranspiresIfWeDoNothing: string;
  notesComments: string;
  sendCopyOfResponses: boolean;
  emailAddress: string;
}

interface Step2Form {
  budgetType: string;
  budgetEstimated: string;
  priority: string;
  riskLevel: string;
  strategicAlignment: string;
}

interface Step3Form {
  itInvolvement: boolean;
  vendorRequired: boolean;
  hasPhiData: boolean;
}

const INITIAL_STEP1: Step1Form = {
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
};

const INITIAL_STEP2: Step2Form = {
  budgetType: "tbd",
  budgetEstimated: "",
  priority: "medium",
  riskLevel: "medium",
  strategicAlignment: "",
};

const INITIAL_STEP3: Step3Form = {
  itInvolvement: false,
  vendorRequired: false,
  hasPhiData: false,
};

export function IntakePage() {
  const navigate = useNavigate();

  const [currentStep, setCurrentStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [createdProjectNumber, setCreatedProjectNumber] = useState("");
  
  const [step1, setStep1] = useState<Step1Form>(INITIAL_STEP1);
  const [step2, setStep2] = useState<Step2Form>(INITIAL_STEP2);
  const [step3, setStep3] = useState<Step3Form>(INITIAL_STEP3);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const steps = [
    { num: 1, label: "Collect Information" },
    { num: 2, label: "Budget & Strategy" },
    { num: 3, label: "IT & Governance" },
    { num: 4, label: "Review & Submit" },
  ];

  const update1 = (k: keyof Step1Form, v: any) => setStep1((p) => ({ ...p, [k]: v }));
  const update2 = (k: keyof Step2Form, v: any) => setStep2((p) => ({ ...p, [k]: v }));
  const update3 = (k: keyof Step3Form, v: any) => setStep3((p) => ({ ...p, [k]: v }));


  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFileName(file.name);
    setIsExtracting(true);
    
    try {
      const { data } = await projectsApi.extractIntake(file);
      setStep1((prev) => ({
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
    } finally {
      setIsExtracting(false);
    }
  }

  async function submitIntake() {
    setSubmitting(true);
    try {
      const payload = {
        project_name: step1.projectName,
        business_unit: step1.requestingDepartment,
        department: step1.requestingDepartment,
        requestor_name: step1.requestorName,
        request_type: step1.requestType,
        problem_statement: step1.problemStatement,
        desired_outcome: step1.desiredOutcome,
        what_do_you_do_today: step1.whatDoYouDoToday,
        what_transpires_if_nothing: step1.whatTranspiresIfWeDoNothing,
        notes: step1.notesComments,
        budget_type: step2.budgetType,
        budget_estimated: step2.budgetEstimated ? parseFloat(step2.budgetEstimated) : undefined,
        priority: step2.priority.toUpperCase(),
        risk_level: step2.riskLevel.toUpperCase(),
        strategic_alignment: step2.strategicAlignment,
        it_involvement: step3.itInvolvement,
        vendor_required: step3.vendorRequired,
        has_phi_data: step3.hasPhiData,
      };

      const project = await projectsApi.create(payload);
      setCreatedProjectNumber(project.project_number);
      setSubmittedSuccess(true);
      
      if (step1.sendCopyOfResponses && step1.emailAddress) {
        await projectsApi.sendIntakeEmail(project.id, step1.emailAddress, payload);
      }
    } catch (err) {
      alert("Error: " + (err instanceof ApiError ? err.message : "Submission failed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="intake-container animate-fade-in min-h-[calc(100vh-64px)] p-8 relative overflow-hidden flex justify-center items-start pt-12" >
      <div className="intake-window-card" >
        
        <div className="window-header flex justify-between items-center" >
          <div>
            <h1 className="window-title" >New Proposal Intake</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="step-header-label" >{steps[currentStep-1].label}</span>
            <div className="flex gap-2">
              <button className="win-btn" title="Minimize">—</button>
              <button className="win-btn" title="Close" onClick={() => navigate("/projects")}>✕</button>
            </div>
          </div>
        </div>

        <div className="progress-bar-wrapper" >
          <div ></div>
          <div ></div>
        </div>

        <div className="intake-content-body" >
          {!submittedSuccess ? (
            <div className="intake-layout" >
              
              <div className="intake-form-panel">
                <div className="steps-pills mb-4 flex gap-2" >
                  {steps.map(step => (
                    <button 
                      key={step.num}
                      className={`step-pill ${currentStep === step.num ? 'active' : currentStep > step.num ? 'done' : ''}`}
                      onClick={() => setCurrentStep(step.num)}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 20,
                        border: `1px solid ${currentStep === step.num ? '#0052CC' : currentStep > step.num ? '#36B37E' : '#DFE1E6'}`,
                        background: currentStep === step.num ? '#DEEBFF' : '#FFF',
                        color: currentStep === step.num ? '#0052CC' : currentStep > step.num ? '#006644' : '#6B778C',
                        fontSize: 12, fontWeight: 600, cursor: 'pointer'
                      }}>
                      <span className="pill-num" style={{
                        width: 18, height: 18, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11,
                        background: currentStep === step.num ? '#0052CC' : currentStep > step.num ? '#36B37E' : '#F4F5F7',
                        color: (currentStep === step.num || currentStep > step.num) ? '#FFF' : '#6B778C'
                      }}>{step.num}</span>
                      <span className="pill-label">{step.label}</span>
                    </button>
                  ))}
                </div>

                {/* Step 1 */}
                {currentStep === 1 && (
                  <div className="form-card animate-fade-in">
                    <h2 className="form-section-main-title" >Project Intake Form</h2>

                    <div className="upload-zone mb-4" onClick={() => fileInputRef.current?.click()} >
                      <span className="material-icons upload-icon" >cloud_upload</span>
                      <div className="upload-info" >
                        <div className="font-semibold text-sm text-primary">Upload Project Document / Attachments (Optional)</div>
                        <div className="text-xs text-muted">AI will automatically extract & pre-fill form details · PDF, DOCX, PPTX</div>
                        {isExtracting && <div className="mt-2 text-xs font-semibold text-blue-500 flex items-center gap-1"><span className="material-icons text-sm animate-spin">sync</span> AI is extracting data...</div>}
                        {uploadedFileName && !isExtracting && <div className="mt-2 text-xs font-semibold text-success flex items-center gap-1"><span className="material-icons text-sm">attach_file</span> Attached: {uploadedFileName}</div>}
                      </div>
                      <button type="button" className="bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded text-sm font-medium hover:bg-gray-50 flex items-center gap-1" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                        <span className="material-icons text-sm">folder_open</span> Browse Files
                      </button>
                      <input ref={fileInputRef} type="file" accept=".pdf,.docx,.pptx,.txt"  onChange={handleFileSelected} />
                    </div>

                    <div className="intake-form-grid" >
                      <div className="form-row grid-2" >
                        <div className="form-group" >
                          <label className="field-label" >Requestor Name <span >*</span></label>
                          <input type="text" className="form-control"  value={step1.requestorName} onChange={e => update1('requestorName', e.target.value)} />
                        </div>
                        <div className="form-group" >
                          <label className="field-label" >Requesting Department <span >*</span></label>
                          <select className="form-control"  value={step1.requestingDepartment} onChange={e => update1('requestingDepartment', e.target.value)}>
                            <option value="">Select...</option>
                            <option value="Clinical IT">Clinical IT</option>
                            <option value="Infrastructure">Infrastructure</option>
                            <option value="Data & Analytics">Data & Analytics</option>
                          </select>
                        </div>
                      </div>

                      <div className="form-row grid-2" >
                        <div className="form-group" >
                          <label className="field-label" >Request Type <span >*</span></label>
                          <select className="form-control"  value={step1.requestType} onChange={e => update1('requestType', e.target.value)}>
                            <option value="Pre-Project Discovery">Pre-Project Discovery</option>
                            <option value="New System Implementation">New System Implementation</option>
                          </select>
                        </div>
                      </div>

                      <div >
                        <h3 >Project Details</h3>
                      </div>

                      <div className="form-group" >
                        <label className="field-label" >Project Name <span >*</span></label>
                        <input type="text" className="form-control"  value={step1.projectName} onChange={e => update1('projectName', e.target.value)} />
                      </div>

                      <div className="form-group" >
                        <label className="field-label" >Problem Statement <span >*</span></label>
                        <textarea className="form-control" rows={3}  value={step1.problemStatement} onChange={e => update1('problemStatement', e.target.value)}></textarea>
                      </div>

                      <div className="form-group" >
                        <label className="field-label" >Desired Outcome <span >*</span></label>
                        <textarea className="form-control" rows={3}  value={step1.desiredOutcome} onChange={e => update1('desiredOutcome', e.target.value)}></textarea>
                      </div>

                      <div className="form-group" >
                        <label className="field-label" >What Do You Do Today?</label>
                        <textarea className="form-control" rows={3}  value={step1.whatDoYouDoToday} onChange={e => update1('whatDoYouDoToday', e.target.value)}></textarea>
                      </div>

                      <div className="form-group" >
                        <label className="field-label" >What Transpires If We Do Nothing?</label>
                        <textarea className="form-control" rows={3}  value={step1.whatTranspiresIfWeDoNothing} onChange={e => update1('whatTranspiresIfWeDoNothing', e.target.value)}></textarea>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 2 */}
                {currentStep === 2 && (
                  <div className="form-card animate-fade-in">
                    <h2 className="form-section-main-title" >Budget & Strategic Alignment</h2>
                    <div className="intake-form-grid" >
                      <div className="form-row grid-2" >
                        <div className="form-group" >
                          <label className="field-label" >Budget Type <span >*</span></label>
                          <select className="form-control"  value={step2.budgetType} onChange={e => update2('budgetType', e.target.value)}>
                            <option value="tbd">TBD</option>
                            <option value="Operational">Operational</option>
                            <option value="Capital">Capital</option>
                          </select>
                        </div>
                        <div className="form-group" >
                          <label className="field-label" >Estimated Budget</label>
                          <input type="text" className="form-control"  value={step2.budgetEstimated} onChange={e => update2('budgetEstimated', e.target.value)} />
                        </div>
                      </div>
                      <div className="form-row grid-2" >
                        <div className="form-group" >
                          <label className="field-label" >Priority <span >*</span></label>
                          <select className="form-control"  value={step2.priority} onChange={e => update2('priority', e.target.value)}>
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                            <option value="critical">Critical</option>
                          </select>
                        </div>
                        <div className="form-group" >
                          <label className="field-label" >Risk Level</label>
                          <select className="form-control"  value={step2.riskLevel} onChange={e => update2('riskLevel', e.target.value)}>
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                          </select>
                        </div>
                      </div>
                      <div className="form-group" >
                        <label className="field-label" >Strategic Alignment & Rationale</label>
                        <textarea className="form-control" rows={4}  value={step2.strategicAlignment} onChange={e => update2('strategicAlignment', e.target.value)}></textarea>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 3 */}
                {currentStep === 3 && (
                  <div className="form-card animate-fade-in">
                    <h2 className="form-section-main-title" >IT & Governance Requirements</h2>
                    <div >
                      <div className="toggle-card" >
                        <div>
                          <div >Dedicated IT Resources Required</div>
                          <div >Will this initiative require active support from corporate/clinical IT teams?</div>
                        </div>
                        <input type="checkbox"  checked={step3.itInvolvement} onChange={e => update3('itInvolvement', e.target.checked)} />
                      </div>
                      <div className="toggle-card" >
                        <div>
                          <div >External Vendor Solution / Products</div>
                          <div >Does this involve procuring hardware, software licenses, or consulting from third parties?</div>
                        </div>
                        <input type="checkbox"  checked={step3.vendorRequired} onChange={e => update3('vendorRequired', e.target.checked)} />
                      </div>
                      <div className="toggle-card" >
                        <div>
                          <div >Contains Protected Health Information (PHI)</div>
                          <div >Will patient information, SSNs, financial details, or HIPAA-regulated data be touched?</div>
                        </div>
                        <input type="checkbox"  checked={step3.hasPhiData} onChange={e => update3('hasPhiData', e.target.checked)} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 4 */}
                {currentStep === 4 && (
                  <div className="form-card animate-fade-in">
                    <h2 className="form-section-main-title" >Review & Submit Proposal</h2>
                    <p >Please verify all information for your project intake request before final submission.</p>
                    
                    <div >
                      <div >
                        <h3 >Project General Details</h3>
                        <div >
                          <div><div >Project Name</div><div >{step1.projectName || '—'}</div></div>
                          <div><div >Request Type</div><div >{step1.requestType || '—'}</div></div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="form-nav-footer mt-6 flex justify-between items-center" >
                  <button type="button" className="px-4 py-2 text-sm font-medium border border-gray-300 rounded hover:bg-gray-50" onClick={() => setCurrentStep(p => p - 1)} disabled={currentStep === 1}>
                    Previous
                  </button>
                  <div className="flex gap-3">
                    <button type="button" className="px-4 py-2 text-sm font-bold rounded text-white"  onClick={submitIntake} disabled={submitting}>
                      {submitting ? 'Submitting...' : '🚀 Submit Proposal'}
                    </button>
                    {currentStep < 4 && (
                      <button type="button" className="px-4 py-2 text-sm font-medium rounded text-white"  onClick={() => setCurrentStep(p => p + 1)}>
                        Next
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Sidebar */}
              <div className="intake-sidebar">
                <div >
                  <div className="flex items-center gap-2 mb-3">
                    <span className="material-icons" >route</span>
                    <h3 >What Happens Next?</h3>
                  </div>
                  <div className="flex flex-col gap-3">
                    {[
                      { n: 1, t: 'BTA Discovery Review', d: 'Business Tech Advocate schedules discovery' },
                      { n: 2, t: 'Prepare for EAC', d: 'Formulate 9-domain architecture dossier' },
                      { n: 3, t: 'EAC Committee Meeting', d: 'Enterprise Architecture Council vote' },
                      { n: 4, t: 'Gate Reviews', d: 'Committee evaluation for funding' }
                    ].map(step => (
                      <div key={step.n} className="flex gap-3">
                        <div >{step.n}</div>
                        <div>
                          <div >{step.t}</div>
                          <div >{step.d}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

            </div>
          ) : (
            <div className="success-screen flex flex-col items-center justify-center py-16 text-center animate-fade-in">
              <div >
                <span className="material-icons" >check_circle</span>
              </div>
              <h2 >Proposal Submitted Successfully!</h2>
              <p >
                Your project proposal <strong>{step1.projectName}</strong> has been officially registered as <strong >{createdProjectNumber}</strong> and routed to the Business Tech Advocate (BTA) team for initial discovery.
              </p>
              <button type="button" className="px-5 py-2 border border-gray-300 rounded font-medium hover:bg-gray-50" onClick={() => navigate("/projects")}>Return to Projects</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}






