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

  const progressPercentage = (currentStep / 4) * 100;

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
        priority: step2.priority,
        risk_level: step2.riskLevel,
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
    <div className="intake-container animate-fade-in" style={{ maxWidth: 1200, margin: '0 auto', padding: 12 }}>
      <div className="intake-window-card" style={{ background: '#FFF', borderRadius: 12, border: '1px solid #DCDFE6', boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }}>
        
        <div className="window-header flex justify-between items-center" style={{ padding: '16px 24px', borderBottom: '1px solid #F0F2F5' }}>
          <div>
            <h1 className="window-title" style={{ fontSize: 20, fontWeight: 700, color: '#172B4D', margin: 0 }}>New Proposal Intake</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="step-header-label" style={{ fontSize: 13, fontWeight: 600, color: '#0052CC' }}>{steps[currentStep-1].label}</span>
            <div className="flex gap-2">
              <button className="win-btn" title="Minimize">—</button>
              <button className="win-btn" title="Close" onClick={() => navigate("/projects")}>✕</button>
            </div>
          </div>
        </div>

        <div className="progress-bar-wrapper" style={{ height: 6, background: '#DFE1E6', position: 'relative' }}>
          <div style={{ height: '100%', width: `${progressPercentage}%`, background: '#0052CC', transition: 'width 0.3s' }}></div>
          <div style={{ position: 'absolute', top: -4, width: 14, height: 14, borderRadius: '50%', background: '#0052CC', border: '2px solid #FFF', left: `${progressPercentage}%`, transform: 'translateX(-50%)', transition: 'left 0.3s' }}></div>
        </div>

        <div className="intake-content-body" style={{ padding: 24 }}>
          {!submittedSuccess ? (
            <div className="intake-layout" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24 }}>
              
              <div className="intake-form-panel">
                <div className="steps-pills mb-4 flex gap-2" style={{ borderBottom: '1px solid #EBECF0', paddingBottom: 12 }}>
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
                    <h2 className="form-section-main-title" style={{ fontSize: 17, fontWeight: 700, color: '#172B4D', marginBottom: 20 }}>Project Intake Form</h2>

                    <div className="upload-zone mb-4" onClick={() => fileInputRef.current?.click()} style={{ border: '2px dashed #C1C7D0', borderRadius: 10, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer', background: '#F7F8FC' }}>
                      <span className="material-icons upload-icon" style={{ fontSize: 32, color: '#0052CC' }}>cloud_upload</span>
                      <div className="upload-info" style={{ flex: 1 }}>
                        <div className="font-semibold text-sm text-primary">Upload Project Document / Attachments (Optional)</div>
                        <div className="text-xs text-muted">AI will automatically extract & pre-fill form details · PDF, DOCX, PPTX</div>
                        {isExtracting && <div className="mt-2 text-xs font-semibold text-blue-500 flex items-center gap-1"><span className="material-icons text-sm animate-spin">sync</span> AI is extracting data...</div>}
                        {uploadedFileName && !isExtracting && <div className="mt-2 text-xs font-semibold text-success flex items-center gap-1"><span className="material-icons text-sm">attach_file</span> Attached: {uploadedFileName}</div>}
                      </div>
                      <button type="button" className="bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded text-sm font-medium hover:bg-gray-50 flex items-center gap-1" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                        <span className="material-icons text-sm">folder_open</span> Browse Files
                      </button>
                      <input ref={fileInputRef} type="file" accept=".pdf,.docx,.pptx,.txt" style={{ display: 'none' }} onChange={handleFileSelected} />
                    </div>

                    <div className="intake-form-grid" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <div className="form-row grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <label className="field-label" style={{ fontSize: 13, fontWeight: 600, color: '#344563' }}>Requestor Name <span style={{ color: '#DE350B' }}>*</span></label>
                          <input type="text" className="form-control" style={inputStyle} value={step1.requestorName} onChange={e => update1('requestorName', e.target.value)} />
                        </div>
                        <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <label className="field-label" style={{ fontSize: 13, fontWeight: 600, color: '#344563' }}>Requesting Department <span style={{ color: '#DE350B' }}>*</span></label>
                          <select className="form-control" style={inputStyle} value={step1.requestingDepartment} onChange={e => update1('requestingDepartment', e.target.value)}>
                            <option value="">Select...</option>
                            <option value="Clinical IT">Clinical IT</option>
                            <option value="Infrastructure">Infrastructure</option>
                            <option value="Data & Analytics">Data & Analytics</option>
                          </select>
                        </div>
                      </div>

                      <div className="form-row grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <label className="field-label" style={{ fontSize: 13, fontWeight: 600, color: '#344563' }}>Request Type <span style={{ color: '#DE350B' }}>*</span></label>
                          <select className="form-control" style={inputStyle} value={step1.requestType} onChange={e => update1('requestType', e.target.value)}>
                            <option value="Pre-Project Discovery">Pre-Project Discovery</option>
                            <option value="New System Implementation">New System Implementation</option>
                          </select>
                        </div>
                      </div>

                      <div style={{ borderTop: '1px solid #F0F2F5', marginTop: 12, paddingTop: 8 }}>
                        <h3 style={{ fontSize: 15, fontWeight: 700, color: '#172B4D', margin: '16px 0 8px 0' }}>Project Details</h3>
                      </div>

                      <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <label className="field-label" style={{ fontSize: 13, fontWeight: 600, color: '#344563' }}>Project Name <span style={{ color: '#DE350B' }}>*</span></label>
                        <input type="text" className="form-control" style={inputStyle} value={step1.projectName} onChange={e => update1('projectName', e.target.value)} />
                      </div>

                      <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <label className="field-label" style={{ fontSize: 13, fontWeight: 600, color: '#344563' }}>Problem Statement <span style={{ color: '#DE350B' }}>*</span></label>
                        <textarea className="form-control" rows={3} style={{ ...inputStyle, resize: 'vertical' }} value={step1.problemStatement} onChange={e => update1('problemStatement', e.target.value)}></textarea>
                      </div>

                      <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <label className="field-label" style={{ fontSize: 13, fontWeight: 600, color: '#344563' }}>Desired Outcome <span style={{ color: '#DE350B' }}>*</span></label>
                        <textarea className="form-control" rows={3} style={{ ...inputStyle, resize: 'vertical' }} value={step1.desiredOutcome} onChange={e => update1('desiredOutcome', e.target.value)}></textarea>
                      </div>

                      <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <label className="field-label" style={{ fontSize: 13, fontWeight: 600, color: '#344563' }}>What Do You Do Today?</label>
                        <textarea className="form-control" rows={3} style={{ ...inputStyle, resize: 'vertical' }} value={step1.whatDoYouDoToday} onChange={e => update1('whatDoYouDoToday', e.target.value)}></textarea>
                      </div>

                      <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <label className="field-label" style={{ fontSize: 13, fontWeight: 600, color: '#344563' }}>What Transpires If We Do Nothing?</label>
                        <textarea className="form-control" rows={3} style={{ ...inputStyle, resize: 'vertical' }} value={step1.whatTranspiresIfWeDoNothing} onChange={e => update1('whatTranspiresIfWeDoNothing', e.target.value)}></textarea>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 2 */}
                {currentStep === 2 && (
                  <div className="form-card animate-fade-in">
                    <h2 className="form-section-main-title" style={{ fontSize: 17, fontWeight: 700, color: '#172B4D', marginBottom: 20 }}>Budget & Strategic Alignment</h2>
                    <div className="intake-form-grid" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <div className="form-row grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <label className="field-label" style={{ fontSize: 13, fontWeight: 600, color: '#344563' }}>Budget Type <span style={{ color: '#DE350B' }}>*</span></label>
                          <select className="form-control" style={inputStyle} value={step2.budgetType} onChange={e => update2('budgetType', e.target.value)}>
                            <option value="tbd">TBD</option>
                            <option value="Operational">Operational</option>
                            <option value="Capital">Capital</option>
                          </select>
                        </div>
                        <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <label className="field-label" style={{ fontSize: 13, fontWeight: 600, color: '#344563' }}>Estimated Budget</label>
                          <input type="text" className="form-control" style={inputStyle} value={step2.budgetEstimated} onChange={e => update2('budgetEstimated', e.target.value)} />
                        </div>
                      </div>
                      <div className="form-row grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <label className="field-label" style={{ fontSize: 13, fontWeight: 600, color: '#344563' }}>Priority <span style={{ color: '#DE350B' }}>*</span></label>
                          <select className="form-control" style={inputStyle} value={step2.priority} onChange={e => update2('priority', e.target.value)}>
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                            <option value="critical">Critical</option>
                          </select>
                        </div>
                        <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <label className="field-label" style={{ fontSize: 13, fontWeight: 600, color: '#344563' }}>Risk Level</label>
                          <select className="form-control" style={inputStyle} value={step2.riskLevel} onChange={e => update2('riskLevel', e.target.value)}>
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                          </select>
                        </div>
                      </div>
                      <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <label className="field-label" style={{ fontSize: 13, fontWeight: 600, color: '#344563' }}>Strategic Alignment & Rationale</label>
                        <textarea className="form-control" rows={4} style={{ ...inputStyle, resize: 'vertical' }} value={step2.strategicAlignment} onChange={e => update2('strategicAlignment', e.target.value)}></textarea>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 3 */}
                {currentStep === 3 && (
                  <div className="form-card animate-fade-in">
                    <h2 className="form-section-main-title" style={{ fontSize: 17, fontWeight: 700, color: '#172B4D', marginBottom: 20 }}>IT & Governance Requirements</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 10 }}>
                      <div className="toggle-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: '#F4F5F7', border: '1px solid #DFE1E6', borderRadius: 8 }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: '#172B4D' }}>Dedicated IT Resources Required</div>
                          <div style={{ fontSize: 12, color: '#6B778C' }}>Will this initiative require active support from corporate/clinical IT teams?</div>
                        </div>
                        <input type="checkbox" style={{ width: 18, height: 18 }} checked={step3.itInvolvement} onChange={e => update3('itInvolvement', e.target.checked)} />
                      </div>
                      <div className="toggle-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: '#F4F5F7', border: '1px solid #DFE1E6', borderRadius: 8 }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: '#172B4D' }}>External Vendor Solution / Products</div>
                          <div style={{ fontSize: 12, color: '#6B778C' }}>Does this involve procuring hardware, software licenses, or consulting from third parties?</div>
                        </div>
                        <input type="checkbox" style={{ width: 18, height: 18 }} checked={step3.vendorRequired} onChange={e => update3('vendorRequired', e.target.checked)} />
                      </div>
                      <div className="toggle-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: '#F4F5F7', border: '1px solid #DFE1E6', borderRadius: 8 }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: '#172B4D' }}>Contains Protected Health Information (PHI)</div>
                          <div style={{ fontSize: 12, color: '#6B778C' }}>Will patient information, SSNs, financial details, or HIPAA-regulated data be touched?</div>
                        </div>
                        <input type="checkbox" style={{ width: 18, height: 18 }} checked={step3.hasPhiData} onChange={e => update3('hasPhiData', e.target.checked)} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 4 */}
                {currentStep === 4 && (
                  <div className="form-card animate-fade-in">
                    <h2 className="form-section-main-title" style={{ fontSize: 17, fontWeight: 700, color: '#172B4D', marginBottom: 20 }}>Review & Submit Proposal</h2>
                    <p style={{ fontSize: 12, color: '#6B778C', marginBottom: 16 }}>Please verify all information for your project intake request before final submission.</p>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                      <div style={{ background: '#F4F5F7', padding: 14, borderRadius: 6 }}>
                        <h3 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#0052CC', marginBottom: 12 }}>Project General Details</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                          <div><div style={lblStyle}>Project Name</div><div style={valStyle}>{step1.projectName || '—'}</div></div>
                          <div><div style={lblStyle}>Request Type</div><div style={valStyle}>{step1.requestType || '—'}</div></div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="form-nav-footer mt-6 flex justify-between items-center" style={{ paddingTop: 16, borderTop: '1px solid #EBECF0' }}>
                  <button type="button" className="px-4 py-2 text-sm font-medium border border-gray-300 rounded hover:bg-gray-50" onClick={() => setCurrentStep(p => p - 1)} disabled={currentStep === 1}>
                    Previous
                  </button>
                  <div className="flex gap-3">
                    <button type="button" className="px-4 py-2 text-sm font-bold rounded text-white" style={{ background: '#36B37E' }} onClick={submitIntake} disabled={submitting}>
                      {submitting ? 'Submitting...' : '🚀 Submit Proposal'}
                    </button>
                    {currentStep < 4 && (
                      <button type="button" className="px-4 py-2 text-sm font-medium rounded text-white" style={{ background: '#0052CC' }} onClick={() => setCurrentStep(p => p + 1)}>
                        Next
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Sidebar */}
              <div className="intake-sidebar">
                <div style={{ background: '#FAFBFC', border: '1px solid #DFE1E6', borderRadius: 8, padding: 16 }}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="material-icons" style={{ color: '#0052CC' }}>route</span>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: '#172B4D', margin: 0 }}>What Happens Next?</h3>
                  </div>
                  <div className="flex flex-col gap-3">
                    {[
                      { n: 1, t: 'BTA Discovery Review', d: 'Business Tech Advocate schedules discovery' },
                      { n: 2, t: 'Prepare for EAC', d: 'Formulate 9-domain architecture dossier' },
                      { n: 3, t: 'EAC Committee Meeting', d: 'Enterprise Architecture Council vote' },
                      { n: 4, t: 'Gate Reviews', d: 'Committee evaluation for funding' }
                    ].map(step => (
                      <div key={step.n} className="flex gap-3">
                        <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#DEEBFF', color: '#0052CC', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{step.n}</div>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: '#172B4D' }}>{step.t}</div>
                          <div style={{ fontSize: 12, color: '#6B778C' }}>{step.d}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

            </div>
          ) : (
            <div className="success-screen flex flex-col items-center justify-center py-16 text-center animate-fade-in">
              <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#E3FCEF', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
                <span className="material-icons" style={{ fontSize: 48, color: '#36B37E' }}>check_circle</span>
              </div>
              <h2 style={{ fontSize: 24, fontWeight: 700, color: '#172B4D', marginBottom: 8 }}>Proposal Submitted Successfully!</h2>
              <p style={{ color: '#6B778C', maxWidth: 480, marginBottom: 32 }}>
                Your project proposal <strong>{step1.projectName}</strong> has been officially registered as <strong style={{ color: '#0052CC', background: '#E3F0FF', padding: '2px 6px', borderRadius: 4 }}>{createdProjectNumber}</strong> and routed to the Business Tech Advocate (BTA) team for initial discovery.
              </p>
              <button type="button" className="px-5 py-2 border border-gray-300 rounded font-medium hover:bg-gray-50" onClick={() => navigate("/projects")}>Return to Projects</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%',
  padding: '9px 12px',
  fontSize: 14,
  border: '1.5px solid #DFE1E6',
  borderRadius: 6,
  backgroundColor: '#FFFFFF',
  color: '#172B4D',
  outline: 'none',
};

const lblStyle = { fontSize: 11, fontWeight: 700, color: '#6B778C', textTransform: 'uppercase' as const };
const valStyle = { fontSize: 14, fontWeight: 600, color: '#172B4D', marginTop: 2 };
