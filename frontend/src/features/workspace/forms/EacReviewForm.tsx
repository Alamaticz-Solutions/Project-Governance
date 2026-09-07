import { useEffect, useState } from 'react';
import { TextArea, TextField } from '@ui-kit';
import { FieldGrid, GateWizard, WizardSectionHeading, YesNo, type WizardSection } from './GateWizard';
import { AIPopulationDropzone } from '../../shared/AIPopulationDropzone';

/**
 * EAC (Enterprise Architecture Committee) Review gate form — ported from
 * origin/Dev's `EacReviewForm.tsx` (10-section wizard). Matches Dev's own
 * state exactly, including that sections 5-9 have no real inputs there
 * either (Dev itself only wires 1-4 and 10; the rest render an
 * "attach docs elsewhere" placeholder) — reproduced faithfully rather than
 * "finished" on Dev's behalf. Dev's `stakeholders` array is tracked in Dev
 * but never merged into the submitted payload (a real gap in Dev itself);
 * kept as local-only state here too rather than silently fixing Dev's bug.
 */

export type EacFormData = {
  projectName: string;
  projectType: string;
  requestorName: string;
  projectStatus: string;
  primaryBTA: string;
  targetBusinessDepartment: string;
  problemStatement: string;
  strategicAlignment: string;
  eaPrinciplesAlignment: string;
  currentStateArchitecture: string;
  currentStatePainPoints: string;
  currentStateSystems: string;
  solutionOverview: string;
  techStack: string;
  eacChecklist_verified: 'Yes' | 'No' | '';
};

type Stakeholder = { name: string; role: string; department: string; involvement: string; interest: string };

const EMPTY: EacFormData = {
  projectName: '',
  projectType: '',
  requestorName: '',
  projectStatus: '',
  primaryBTA: '',
  targetBusinessDepartment: '',
  problemStatement: '',
  strategicAlignment: '',
  eaPrinciplesAlignment: '',
  currentStateArchitecture: '',
  currentStatePainPoints: '',
  currentStateSystems: '',
  solutionOverview: '',
  techStack: '',
  eacChecklist_verified: ''
};

const SECTIONS: WizardSection[] = [
  { id: 'overview', label: 'Project Overview & Identification' },
  { id: 'justification', label: 'Business Justification' },
  { id: 'stakeholders', label: 'Key Stakeholders' },
  { id: 'current-state', label: 'Current State Analysis' },
  { id: 'proposed', label: 'Proposed Solution' },
  { id: 'risk', label: 'Risk & Compliance' },
  { id: 'timeline', label: 'Timeline & Resources' },
  { id: 'impact', label: 'Business Impact' },
  { id: 'feasibility', label: 'Feasibility & Readiness' },
  { id: 'checklist', label: 'EAC Checklist' }
];

const UNWIRED_SECTIONS = new Set(['risk', 'timeline', 'impact', 'feasibility']);

function isValid(data: EacFormData): boolean {
  return Boolean(data.problemStatement.trim());
}

export function EacReviewForm({
  initialData,
  projectId,
  onChange
}: {
  initialData?: Partial<EacFormData>;
  projectId?: string;
  onChange: (data: EacFormData, valid: boolean) => void;
}) {
  const [form, setForm] = useState<EacFormData>({ ...EMPTY, ...initialData });
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [sectionId, setSectionId] = useState(SECTIONS[0].id);

  useEffect(() => {
    onChange(form, isValid(form));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  function set<K extends keyof EacFormData>(key: K, value: EacFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const index = SECTIONS.findIndex((s) => s.id === sectionId);
  const goto = (delta: number) => setSectionId(SECTIONS[Math.min(Math.max(index + delta, 0), SECTIONS.length - 1)].id);

  return (
    <GateWizard
      sections={SECTIONS}
      activeSectionId={sectionId}
      onSectionSelect={setSectionId}
      isFirst={index === 0}
      isLast={index === SECTIONS.length - 1}
      onPrevious={() => goto(-1)}
      onNext={() => goto(1)}
    >
      {sectionId === 'overview' && (
        <>
          <WizardSectionHeading title="Project Overview & Identification" />
          {projectId && (
            <AIPopulationDropzone
              team="eac"
              projectId={projectId}
              onExtractionComplete={(data) => setForm((prev) => ({ ...prev, ...(data as Partial<EacFormData>) }))}
            />
          )}
          <FieldGrid>
            <TextField label="Project name" value={form.projectName} onChange={(e) => set('projectName', e.target.value)} />
            <TextField label="Project type" value={form.projectType} onChange={(e) => set('projectType', e.target.value)} />
            <TextField label="Requestor name" value={form.requestorName} onChange={(e) => set('requestorName', e.target.value)} />
            <TextField label="Project status" value={form.projectStatus} onChange={(e) => set('projectStatus', e.target.value)} />
            <TextField label="Primary BTA" value={form.primaryBTA} onChange={(e) => set('primaryBTA', e.target.value)} />
            <TextField label="Target business department" value={form.targetBusinessDepartment} onChange={(e) => set('targetBusinessDepartment', e.target.value)} />
          </FieldGrid>
        </>
      )}
      {sectionId === 'justification' && (
        <>
          <WizardSectionHeading title="Business Justification" />
          <div style={{ display: 'grid', gap: 16 }}>
            <TextArea label="Problem statement" rows={3} required value={form.problemStatement} onChange={(e) => set('problemStatement', e.target.value)} />
            <TextArea label="Strategic alignment" rows={3} value={form.strategicAlignment} onChange={(e) => set('strategicAlignment', e.target.value)} />
            <TextArea label="EA principles alignment" rows={3} value={form.eaPrinciplesAlignment} onChange={(e) => set('eaPrinciplesAlignment', e.target.value)} />
          </div>
        </>
      )}
      {sectionId === 'stakeholders' && (
        <>
          <WizardSectionHeading title="Key Stakeholders" hint="Tracked locally; matches Dev, which does not submit this list either." />
          <div style={{ display: 'grid', gap: 12 }}>
            {stakeholders.map((s, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr) auto', gap: 8, alignItems: 'center' }}>
                <TextField label="Name" value={s.name} onChange={(e) => setStakeholders((prev) => prev.map((row, ri) => (ri === i ? { ...row, name: e.target.value } : row)))} />
                <TextField label="Role" value={s.role} onChange={(e) => setStakeholders((prev) => prev.map((row, ri) => (ri === i ? { ...row, role: e.target.value } : row)))} />
                <TextField label="Department" value={s.department} onChange={(e) => setStakeholders((prev) => prev.map((row, ri) => (ri === i ? { ...row, department: e.target.value } : row)))} />
                <TextField label="Involvement" value={s.involvement} onChange={(e) => setStakeholders((prev) => prev.map((row, ri) => (ri === i ? { ...row, involvement: e.target.value } : row)))} />
                <TextField label="Interest" value={s.interest} onChange={(e) => setStakeholders((prev) => prev.map((row, ri) => (ri === i ? { ...row, interest: e.target.value } : row)))} />
                <button
                  type="button"
                  onClick={() => setStakeholders((prev) => prev.filter((_, ri) => ri !== i))}
                  style={{ background: 'transparent', border: 'none', color: '#F87171', cursor: 'pointer', fontSize: 12, marginTop: 18 }}
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setStakeholders((prev) => [...prev, { name: '', role: '', department: '', involvement: '', interest: '' }])}
              style={{ padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: 'rgba(30,41,59,0.8)', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer', justifySelf: 'start' }}
            >
              + Add stakeholder
            </button>
          </div>
        </>
      )}
      {sectionId === 'current-state' && (
        <>
          <WizardSectionHeading title="Current State Analysis" />
          <div style={{ display: 'grid', gap: 16 }}>
            <TextArea label="Current state architecture" rows={3} value={form.currentStateArchitecture} onChange={(e) => set('currentStateArchitecture', e.target.value)} />
            <TextArea label="Current state pain points" rows={3} value={form.currentStatePainPoints} onChange={(e) => set('currentStatePainPoints', e.target.value)} />
            <TextArea label="Current state systems" rows={3} value={form.currentStateSystems} onChange={(e) => set('currentStateSystems', e.target.value)} />
          </div>
        </>
      )}
      {sectionId === 'proposed' && (
        <>
          <WizardSectionHeading title="Proposed Solution" />
          <div style={{ display: 'grid', gap: 16 }}>
            <TextArea label="Solution overview" rows={3} value={form.solutionOverview} onChange={(e) => set('solutionOverview', e.target.value)} />
            <TextArea label="Tech stack" rows={3} value={form.techStack} onChange={(e) => set('techStack', e.target.value)} />
          </div>
        </>
      )}
      {UNWIRED_SECTIONS.has(sectionId) && (
        <>
          <WizardSectionHeading title={SECTIONS.find((s) => s.id === sectionId)?.label ?? ''} />
          <p style={{ color: '#64748B', fontSize: 13 }}>Attach supporting documentation elsewhere for this section (unwired in Dev itself).</p>
        </>
      )}
      {sectionId === 'checklist' && (
        <>
          <WizardSectionHeading title="EAC Checklist" />
          <YesNo label="Architecture verified?" value={form.eacChecklist_verified} onChange={(v) => set('eacChecklist_verified', v)} />
        </>
      )}
    </GateWizard>
  );
}
