import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { Icon } from '@ui-kit';
import { useAction, useApp, useAsync } from '../../app/providers';
import { entityByType } from '../../lib/entities';
import type { AppfwRecord } from '../../lib/appfwClient';
import { PROJECT_PRIORITY, PROJECT_RISK } from '../shared/enums';

/**
 * New-request intake. Dark glass, sectioned presentation mirrors the
 * Dev-branch "New Proposal Intake" (three sections + "what happens next" rail +
 * success screen). The create flow is this branch's: a Draft assembled into a
 * Project row through the App Framework client, with the manager FK resolved
 * from the seeded users. Document AI pre-fill is shown but inert — the
 * extraction egress boundary does not exist on this branch yet.
 */

const projectEntity = entityByType('Project');
const userEntity = entityByType('User');

function newProjectNumber(): string {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `GOV-${stamp}-${suffix}`;
}

type Draft = {
  project_number: string;
  project_name: string;
  business_unit: string;
  manager_id: string;
  department: string;
  sponsor_name: string;
  sponsor_email: string;
  requestor_name: string;
  request_type: string;
  problem_statement: string;
  business_value: string;
  desired_outcome: string;
  priority: string;
  risk_level: string;
  budget_estimated: string;
  has_phi_data: boolean;
  is_clinical: boolean;
  vendor_required: boolean;
};

function emptyDraft(requestor: string): Draft {
  return {
    project_number: newProjectNumber(),
    project_name: '',
    business_unit: '',
    manager_id: '',
    department: '',
    sponsor_name: '',
    sponsor_email: '',
    requestor_name: requestor,
    request_type: 'Pre-Project Discovery',
    problem_statement: '',
    business_value: '',
    desired_outcome: '',
    priority: 'Medium',
    risk_level: 'Medium',
    budget_estimated: '',
    has_phi_data: false,
    is_clinical: false,
    vendor_required: false
  };
}

const REQUEST_TYPES = [
  'Pre-Project Discovery',
  'New System Implementation',
  'System Enhancement / Upgrade',
  'Infrastructure Hardware',
  'Process Optimization'
];

const NEXT_STEPS = [
  { step: 1, active: true, title: 'BTA Discovery Review', desc: 'A Business Technology Analyst reviews the intake and schedules discovery.' },
  { step: 2, active: false, title: 'Prepare for EAC', desc: 'Architecture alignment dossier is assembled.' },
  { step: 3, active: false, title: 'EAC Committee Meeting', desc: 'Enterprise Architecture Council alignment vote.' },
  { step: 4, active: false, title: 'Gate Reviews', desc: 'Committee evaluation for funding and compliance.' }
];

const sectionCard: CSSProperties = {
  background: 'rgba(15,23,42,0.4)',
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.06)',
  padding: 28
};
const fieldInput: CSSProperties = {
  width: '100%',
  background: '#1e293b',
  border: '1px solid rgba(255,255,255,0.1)',
  color: '#f8fafc',
  borderRadius: 8,
  padding: '10px 14px',
  fontSize: 14,
  outline: 'none'
};

function L({ children, required }: { children: ReactNode; required?: boolean }) {
  return (
    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
      {children}
      {required ? <span style={{ color: '#F87171' }}> *</span> : null}
    </label>
  );
}

function SectionHeader({ icon, tone, children }: { icon: string; tone: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
      <span style={{ padding: 8, borderRadius: 8, background: `${tone}22`, border: `1px solid ${tone}44`, color: tone, display: 'flex' }}>
        <Icon name={icon} size={20} />
      </span>
      <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'white' }}>{children}</h2>
    </div>
  );
}

export function IntakeScreen() {
  const navigate = useNavigate();
  const { auth } = useApp();
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(auth.displayName || auth.userName || ''));
  const [errors, setErrors] = useState<string[]>([]);
  const [aiNote, setAiNote] = useState(false);
  const [done, setDone] = useState<{ id: string; number: string } | null>(null);

  const create = useAction((client, input: AppfwRecord) => client.saveRecord(projectEntity, 'create', input));

  const managers = useAsync(
    (client) =>
      client.queryList(userEntity, { limit: 100, sort: { full_name: 'asc' }, selection: ['id', 'full_name', 'email', 'role'] }),
    []
  );
  useEffect(() => {
    if (managers.status === 'ready' && !draft.manager_id) {
      const first = managers.data?.rows[0];
      if (first && typeof first.id === 'string') set('manager_id', first.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [managers.status]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((prev) => ({ ...prev, [key]: value }));

  const managerOptions = (managers.data?.rows ?? []).map((row) => ({
    value: String(row.id),
    label: `${String(row.full_name ?? row.email ?? row.id)}${row.role ? ` (${String(row.role)})` : ''}`
  }));

  async function submit() {
    const errs: string[] = [];
    if (!draft.project_number.trim()) errs.push('Project number is required.');
    if (!draft.project_name.trim()) errs.push('Project name is required.');
    if (!draft.business_unit.trim()) errs.push('Business unit is required.');
    if (!draft.manager_id) errs.push('A manager is required.');
    if (!draft.problem_statement.trim()) errs.push('Problem statement is required.');
    if (!draft.desired_outcome.trim()) errs.push('Desired outcome is required.');
    setErrors(errs);
    if (errs.length) return;

    const input: AppfwRecord = {
      project_number: draft.project_number.trim(),
      project_name: draft.project_name.trim(),
      business_unit: draft.business_unit.trim(),
      manager_id: draft.manager_id,
      department: draft.department.trim() || null,
      sponsor_name: draft.sponsor_name.trim() || null,
      sponsor_email: draft.sponsor_email.trim() || null,
      requestor_name: draft.requestor_name.trim() || null,
      request_type: draft.request_type.trim() || null,
      problem_statement: draft.problem_statement.trim(),
      business_value: draft.business_value.trim() || null,
      desired_outcome: draft.desired_outcome.trim() || null,
      priority: draft.priority,
      risk_level: draft.risk_level || null,
      budget_estimated: draft.budget_estimated ? Number(draft.budget_estimated) : null,
      has_phi_data: draft.has_phi_data,
      is_clinical: draft.is_clinical,
      vendor_required: draft.vendor_required,
      status: 'Draft',
      created_at: new Date().toISOString()
    };
    const created = await create.run(input);
    if (created && typeof created.id === 'string') {
      setDone({ id: created.id, number: String(created.project_number ?? draft.project_number) });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  return (
    <div className="animate-fade-in" style={{ minHeight: '100%', background: '#0f172a', color: '#f1f5f9', position: 'relative' }}>
      <div style={{ position: 'absolute', inset: 0, zIndex: 0, background: 'linear-gradient(to bottom right, #0f172a, #111827, #1e1b4b)' }} />
      <div style={{ position: 'relative', zIndex: 1, maxWidth: 1200, margin: '0 auto', padding: 32 }}>
        <div
          style={{
            background: 'rgba(30,41,59,0.7)',
            backdropFilter: 'blur(16px)',
            borderRadius: 16,
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 25px 50px -12px rgba(49,46,129,0.5)',
            overflow: 'hidden'
          }}
        >
          <div
            style={{
              padding: '20px 32px',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'linear-gradient(90deg, #1e293b, rgba(30,41,59,0.8))'
            }}
          >
            <div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', gap: 12 }}>
                <Icon name="note_add" size={26} style={{ color: '#818CF8' }} /> New Proposal Intake
              </h1>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#94A3B8' }}>
                Complete all sections to submit your project for governance review.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: '#94A3B8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Icon name="close" size={20} />
            </button>
          </div>

          <div style={{ padding: 32, background: 'rgba(15,23,42,0.4)' }}>
            {done ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '64px 0', textAlign: 'center' }}>
                <div style={{ width: 96, height: 96, borderRadius: '50%', background: 'rgba(16,185,129,0.2)', border: '1px solid rgba(16,185,129,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
                  <Icon name="check_circle" size={56} style={{ color: '#34d399' }} />
                </div>
                <h2 style={{ margin: '0 0 12px', fontSize: 28, fontWeight: 800, color: 'white' }}>Proposal submitted</h2>
                <p style={{ maxWidth: 520, color: '#cbd5e1', lineHeight: 1.6, margin: '0 0 32px' }}>
                  <strong style={{ color: 'white' }}>{draft.project_name}</strong> is registered as{' '}
                  <strong style={{ color: '#A5B4FC', background: 'rgba(79,70,229,0.25)', padding: '2px 8px', borderRadius: 6, border: '1px solid rgba(79,70,229,0.3)' }}>{done.number}</strong>{' '}
                  and enters the gate workflow in Draft.
                </p>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <button type="button" onClick={() => navigate('/projects')} style={{ padding: '12px 24px', borderRadius: 10, fontSize: 14, fontWeight: 700, color: '#cbd5e1', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(30,41,59,0.5)', cursor: 'pointer' }}>
                    Return to projects
                  </button>
                  <button type="button" onClick={() => navigate(`/projects/${done.id}`)} style={{ padding: '12px 24px', borderRadius: 10, fontSize: 14, fontWeight: 700, color: 'white', border: 'none', background: 'linear-gradient(135deg,#4F46E5,#7C3AED)', cursor: 'pointer' }}>
                    View project
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 32, alignItems: 'start' }}>
                <div style={{ display: 'grid', gap: 32 }}>
                  {/* Section 1 */}
                  <div style={sectionCard}>
                    <SectionHeader icon="info" tone="#818CF8">1. Project Information</SectionHeader>

                    <button
                      type="button"
                      onClick={() => setAiNote(true)}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 20,
                        border: '2px dashed rgba(255,255,255,0.15)',
                        borderRadius: 16,
                        padding: 20,
                        marginBottom: 28,
                        background: 'rgba(15,23,42,0.3)',
                        cursor: 'pointer',
                        textAlign: 'left'
                      }}
                    >
                      <span style={{ width: 56, height: 56, borderRadius: '50%', background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', color: '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Icon name="cloud_upload" size={24} />
                      </span>
                      <span style={{ flex: 1 }}>
                        <span style={{ display: 'block', fontWeight: 700, fontSize: 14, color: '#e2e8f0' }}>Upload a project document (optional)</span>
                        <span style={{ display: 'block', fontSize: 12, color: '#64748B', marginTop: 4 }}>
                          {aiNote
                            ? 'AI extraction is gated pending the document-egress boundary — enter details manually for now.'
                            : 'AI pre-fill · PDF, DOCX, TXT'}
                        </span>
                      </span>
                    </button>

                    <div style={{ display: 'grid', gap: 20 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
                        <div>
                          <L required>Project number</L>
                          <input style={fieldInput} value={draft.project_number} onChange={(e) => set('project_number', e.target.value)} />
                        </div>
                        <div>
                          <L required>Project name</L>
                          <input style={fieldInput} placeholder="Enter project name…" value={draft.project_name} onChange={(e) => set('project_name', e.target.value)} />
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
                        <div>
                          <L>Request type</L>
                          <select style={fieldInput} value={draft.request_type} onChange={(e) => set('request_type', e.target.value)}>
                            {REQUEST_TYPES.map((t) => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <L>Requestor name</L>
                          <input style={fieldInput} value={draft.requestor_name} onChange={(e) => set('requestor_name', e.target.value)} />
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
                        <div>
                          <L required>Business unit</L>
                          <input style={fieldInput} value={draft.business_unit} onChange={(e) => set('business_unit', e.target.value)} />
                        </div>
                        <div>
                          <L>Department</L>
                          <input style={fieldInput} value={draft.department} onChange={(e) => set('department', e.target.value)} />
                        </div>
                        <div>
                          <L required>Manager</L>
                          <select style={fieldInput} value={draft.manager_id} onChange={(e) => set('manager_id', e.target.value)}>
                            <option value="">{managers.status === 'loading' ? 'Loading users…' : 'Select a manager'}</option>
                            {managerOptions.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div>
                        <L required>Problem or opportunity statement</L>
                        <textarea style={{ ...fieldInput, resize: 'vertical' }} rows={3} placeholder="Describe the current problem, pain points, or opportunity…" value={draft.problem_statement} onChange={(e) => set('problem_statement', e.target.value)} />
                      </div>
                      <div>
                        <L required>Desired outcome</L>
                        <textarea style={{ ...fieldInput, resize: 'vertical' }} rows={3} placeholder="Describe the target outcomes and success criteria…" value={draft.desired_outcome} onChange={(e) => set('desired_outcome', e.target.value)} />
                      </div>
                      <div>
                        <L>Business value</L>
                        <textarea style={{ ...fieldInput, resize: 'vertical' }} rows={2} value={draft.business_value} onChange={(e) => set('business_value', e.target.value)} />
                      </div>
                    </div>
                  </div>

                  {/* Section 2 */}
                  <div style={sectionCard}>
                    <SectionHeader icon="payments" tone="#34D399">2. Budget &amp; Strategic Alignment</SectionHeader>
                    <div style={{ display: 'grid', gap: 20 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20 }}>
                        <div>
                          <L>Estimated budget (USD)</L>
                          <input style={fieldInput} type="number" placeholder="e.g. 85000" value={draft.budget_estimated} onChange={(e) => set('budget_estimated', e.target.value)} />
                        </div>
                        <div>
                          <L required>Priority</L>
                          <select style={fieldInput} value={draft.priority} onChange={(e) => set('priority', e.target.value)}>
                            {PROJECT_PRIORITY.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <L>Initial risk level</L>
                          <select style={fieldInput} value={draft.risk_level} onChange={(e) => set('risk_level', e.target.value)}>
                            {PROJECT_RISK.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
                        <div>
                          <L>Sponsor name</L>
                          <input style={fieldInput} value={draft.sponsor_name} onChange={(e) => set('sponsor_name', e.target.value)} />
                        </div>
                        <div>
                          <L>Sponsor email</L>
                          <input style={fieldInput} type="email" value={draft.sponsor_email} onChange={(e) => set('sponsor_email', e.target.value)} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section 3 */}
                  <div style={sectionCard}>
                    <SectionHeader icon="security" tone="#FB923C">3. IT &amp; Governance Requirements</SectionHeader>
                    <div style={{ display: 'grid', gap: 12 }}>
                      {[
                        { k: 'has_phi_data' as const, t: 'Contains Protected Health Information (PHI/PII)', d: 'Patient data, SSNs, financial details, or HIPAA-regulated data.' },
                        { k: 'is_clinical' as const, t: 'Clinical initiative', d: 'Directly involves clinical workflows or care delivery.' },
                        { k: 'vendor_required' as const, t: 'External vendor solution / products', d: 'Procuring hardware, licenses, or third-party consulting.' }
                      ].map((item) => (
                        <label
                          key={item.k}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: 16,
                            background: 'rgba(30,41,59,0.4)',
                            borderRadius: 12,
                            border: '1px solid rgba(255,255,255,0.06)',
                            cursor: 'pointer'
                          }}
                        >
                          <span>
                            <span style={{ display: 'block', fontWeight: 700, fontSize: 14, color: '#e2e8f0' }}>{item.t}</span>
                            <span style={{ display: 'block', fontSize: 12, color: '#94A3B8', marginTop: 2 }}>{item.d}</span>
                          </span>
                          <input
                            type="checkbox"
                            checked={draft[item.k]}
                            onChange={(e) => set(item.k, e.target.checked)}
                            style={{ width: 22, height: 22, accentColor: '#4F46E5', cursor: 'pointer', flexShrink: 0 }}
                          />
                        </label>
                      ))}
                    </div>
                  </div>

                  {errors.length > 0 && (
                    <div style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.25)', color: '#FCA5A5', padding: 16, borderRadius: 12, fontSize: 13, fontWeight: 600 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <Icon name="error" size={20} /> Fix the following before submitting:
                      </div>
                      <ul style={{ margin: '4px 0 0', paddingLeft: 24 }}>
                        {errors.map((e, i) => (
                          <li key={i}>{e}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {create.error && (
                    <div style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.25)', color: '#FCA5A5', padding: 16, borderRadius: 12, fontSize: 13, fontWeight: 600 }}>
                      {create.error.details.category === 'policy_denied'
                        ? 'You do not have permission to create a project.'
                        : `Create failed: ${create.error.message}`}
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 16, padding: 20, background: 'rgba(15,23,42,0.4)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
                    <button type="button" onClick={() => navigate('/dashboard')} style={{ padding: '10px 20px', borderRadius: 10, fontSize: 14, fontWeight: 700, color: '#cbd5e1', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={submit}
                      disabled={create.pending}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '12px 28px',
                        borderRadius: 10,
                        fontSize: 14,
                        fontWeight: 700,
                        color: 'white',
                        border: 'none',
                        cursor: 'pointer',
                        background: 'linear-gradient(135deg,#4F46E5,#7C3AED)',
                        boxShadow: '0 8px 24px rgba(79,70,229,0.3)',
                        opacity: create.pending ? 0.7 : 1
                      }}
                    >
                      <Icon name="send" size={18} /> {create.pending ? 'Submitting…' : 'Submit proposal'}
                    </button>
                  </div>
                </div>

                {/* What happens next */}
                <div style={{ ...sectionCard, position: 'sticky', top: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <span style={{ padding: 8, borderRadius: 8, background: 'rgba(59,130,246,0.2)', border: '1px solid rgba(59,130,246,0.3)', color: '#60A5FA', display: 'flex' }}>
                      <Icon name="route" size={20} />
                    </span>
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'white' }}>What happens next?</h3>
                  </div>
                  <div style={{ display: 'grid', gap: 20 }}>
                    {NEXT_STEPS.map((s) => (
                      <div key={s.step} style={{ display: 'flex', gap: 14 }}>
                        <span
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            flexShrink: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 12,
                            fontWeight: 700,
                            background: '#1e293b',
                            border: `2px solid ${s.active ? '#60A5FA' : 'rgba(100,116,139,0.5)'}`,
                            color: s.active ? '#60A5FA' : '#94A3B8'
                          }}
                        >
                          {s.step}
                        </span>
                        <span>
                          <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>{s.title}</span>
                          <span style={{ display: 'block', fontSize: 12, color: '#94A3B8', marginTop: 2 }}>{s.desc}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
