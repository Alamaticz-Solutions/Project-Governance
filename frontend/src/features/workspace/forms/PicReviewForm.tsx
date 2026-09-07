import { useEffect, useState } from 'react';
import { TextArea, TextField } from '@ui-kit';
import { FieldGrid, GateWizard, WizardSectionHeading, YesNo, type WizardSection } from './GateWizard';
import { AIPopulationDropzone } from '../../shared/AIPopulationDropzone';

/**
 * PIC (Project Investment Committee) Review gate form — ported from
 * origin/Dev's `PicReviewForm.tsx` (7-section wizard, Dev's "Prepare for
 * PIC" stage). Field names/validation match Dev exactly.
 */

export type PicFormData = {
  problemStatement: string;
  scope: string;
  vendorName: string;
  vendorJustification: string;
  vendorBenefits: string;
  benefitCategory: string;
  annualValueY1: string;
  annualValueY2: string;
  benefitMethodology: string;
  capex: string;
  npv: string;
  irr: string;
  paybackMonths: string;
  milestones: string;
  resourceAsk: string;
  comments: string;
  picChecklist_verified: 'Yes' | 'No' | '';
};

const EMPTY: PicFormData = {
  problemStatement: '',
  scope: '',
  vendorName: '',
  vendorJustification: '',
  vendorBenefits: '',
  benefitCategory: '',
  annualValueY1: '',
  annualValueY2: '',
  benefitMethodology: '',
  capex: '',
  npv: '',
  irr: '',
  paybackMonths: '',
  milestones: '',
  resourceAsk: '',
  comments: '',
  picChecklist_verified: ''
};

const SECTIONS: WizardSection[] = [
  { id: 'definition', label: 'Core Project Definition' },
  { id: 'vendor', label: 'Vendor Recommendation' },
  { id: 'evaluation', label: 'Project Evaluation & Benefit' },
  { id: 'cost', label: 'Cost Plan & ROI' },
  { id: 'execution', label: 'Project Execution & Ask' },
  { id: 'supporting', label: 'Supporting Information' },
  { id: 'checklist', label: 'PIC Approval Checklist' }
];

function isValid(data: PicFormData): boolean {
  return Boolean(data.problemStatement.trim());
}

export function PicReviewForm({
  initialData,
  projectId,
  onChange
}: {
  initialData?: Partial<PicFormData>;
  projectId?: string;
  onChange: (data: PicFormData, valid: boolean) => void;
}) {
  const [form, setForm] = useState<PicFormData>({ ...EMPTY, ...initialData });
  const [sectionId, setSectionId] = useState(SECTIONS[0].id);

  useEffect(() => {
    onChange(form, isValid(form));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  function set<K extends keyof PicFormData>(key: K, value: PicFormData[K]) {
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
      {sectionId === 'definition' && (
        <>
          <WizardSectionHeading title="Core Project Definition" />
          {projectId && (
            <AIPopulationDropzone
              team="pic"
              projectId={projectId}
              onExtractionComplete={(data) => setForm((prev) => ({ ...prev, ...(data as Partial<PicFormData>) }))}
            />
          )}
          <div style={{ display: 'grid', gap: 16 }}>
            <TextArea label="Problem statement" rows={3} required value={form.problemStatement} onChange={(e) => set('problemStatement', e.target.value)} />
            <TextArea label="Scope" rows={3} value={form.scope} onChange={(e) => set('scope', e.target.value)} />
          </div>
        </>
      )}
      {sectionId === 'vendor' && (
        <>
          <WizardSectionHeading title="Vendor Recommendation" />
          <FieldGrid>
            <TextField label="Vendor name" value={form.vendorName} onChange={(e) => set('vendorName', e.target.value)} />
          </FieldGrid>
          <div style={{ display: 'grid', gap: 16, marginTop: 16 }}>
            <TextArea label="Vendor justification" rows={3} value={form.vendorJustification} onChange={(e) => set('vendorJustification', e.target.value)} />
            <TextArea label="Vendor benefits" rows={3} value={form.vendorBenefits} onChange={(e) => set('vendorBenefits', e.target.value)} />
          </div>
        </>
      )}
      {sectionId === 'evaluation' && (
        <>
          <WizardSectionHeading title="Project Evaluation & Benefit" />
          <FieldGrid>
            <TextField label="Benefit category" value={form.benefitCategory} onChange={(e) => set('benefitCategory', e.target.value)} />
            <TextField label="Annual value (Y1)" value={form.annualValueY1} onChange={(e) => set('annualValueY1', e.target.value)} />
            <TextField label="Annual value (Y2)" value={form.annualValueY2} onChange={(e) => set('annualValueY2', e.target.value)} />
          </FieldGrid>
          <div style={{ marginTop: 16 }}>
            <TextArea label="Benefit methodology" rows={3} value={form.benefitMethodology} onChange={(e) => set('benefitMethodology', e.target.value)} />
          </div>
        </>
      )}
      {sectionId === 'cost' && (
        <>
          <WizardSectionHeading title="Cost Plan & ROI" />
          <FieldGrid>
            <TextField label="CAPEX" value={form.capex} onChange={(e) => set('capex', e.target.value)} />
            <TextField label="NPV" value={form.npv} onChange={(e) => set('npv', e.target.value)} />
            <TextField label="IRR" value={form.irr} onChange={(e) => set('irr', e.target.value)} />
            <TextField label="Payback (months)" value={form.paybackMonths} onChange={(e) => set('paybackMonths', e.target.value)} />
          </FieldGrid>
        </>
      )}
      {sectionId === 'execution' && (
        <>
          <WizardSectionHeading title="Project Execution & Ask" />
          <div style={{ display: 'grid', gap: 16 }}>
            <TextArea label="Milestones" rows={3} value={form.milestones} onChange={(e) => set('milestones', e.target.value)} />
            <TextArea label="Resource ask" rows={3} value={form.resourceAsk} onChange={(e) => set('resourceAsk', e.target.value)} />
          </div>
        </>
      )}
      {sectionId === 'supporting' && (
        <>
          <WizardSectionHeading title="Supporting Information" />
          <TextArea label="Comments" rows={4} value={form.comments} onChange={(e) => set('comments', e.target.value)} />
        </>
      )}
      {sectionId === 'checklist' && (
        <>
          <WizardSectionHeading title="PIC Approval Checklist" />
          <YesNo label="PIC verified?" value={form.picChecklist_verified} onChange={(v) => set('picChecklist_verified', v)} />
        </>
      )}
    </GateWizard>
  );
}
