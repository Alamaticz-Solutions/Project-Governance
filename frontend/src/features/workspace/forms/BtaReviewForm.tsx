import { useEffect, useState } from 'react';
import { SelectField, TextArea, TextField } from '@ui-kit';
import { FieldGrid, GateWizard, WizardSectionHeading, YesNo, type WizardSection } from './GateWizard';
import { AIPopulationDropzone } from '../../shared/AIPopulationDropzone';

/**
 * BTA (Business Technology Analyst) Review gate form — ported from
 * origin/Dev's `BtaReviewForm.tsx` (9-section wizard). Field names and
 * validation match Dev exactly; several field names shadow `Project`
 * columns (e.g. `projectName`) but, matching Dev's own behavior, are stored
 * as a parallel copy inside `GateSubmission.data`, not written back onto
 * the `Project` row.
 */

export type BtaFormData = {
  projectName: string;
  requestorName: string;
  requestingDepartment: string;
  projectStatus: string;
  projectType: string;
  primaryBTA: string;
  targetBusinessDepartment: string;
  problemStatement: string;
  businessObjective: string;
  businessValue: string;
  strategicAlignment: string;
  inScope: string;
  outOfScope: string;
  isNewSolution: 'Yes' | 'No' | '';
  itInvolvement: 'Yes' | 'No' | '';
  systemsImpacted: string;
  hasPhiData: 'Yes' | 'No' | '';
  isHipaaApplicable: 'Yes' | 'No' | '';
  dataClassification: string;
  budgetEstimated: string;
  budgetType: string;
  vendorRequired: 'Yes' | 'No' | '';
  requestedStartDate: string;
  requestedEndDate: string;
  priority: string;
  riskLevel: string;
  knownRisks: string;
  dependencies: string;
  btaChecklist_architectural: 'Yes' | 'No' | '';
  btaChecklist_security: 'Yes' | 'No' | '';
};

const EMPTY: BtaFormData = {
  projectName: '',
  requestorName: '',
  requestingDepartment: '',
  projectStatus: '',
  projectType: '',
  primaryBTA: '',
  targetBusinessDepartment: '',
  problemStatement: '',
  businessObjective: '',
  businessValue: '',
  strategicAlignment: '',
  inScope: '',
  outOfScope: '',
  isNewSolution: '',
  itInvolvement: '',
  systemsImpacted: '',
  hasPhiData: '',
  isHipaaApplicable: '',
  dataClassification: '',
  budgetEstimated: '',
  budgetType: '',
  vendorRequired: '',
  requestedStartDate: '',
  requestedEndDate: '',
  priority: '',
  riskLevel: '',
  knownRisks: '',
  dependencies: '',
  btaChecklist_architectural: '',
  btaChecklist_security: ''
};

const SECTIONS: WizardSection[] = [
  { id: 'identification', label: 'Project Identification' },
  { id: 'objective', label: 'Business Objective' },
  { id: 'scope', label: 'Scope & Requirements' },
  { id: 'technical', label: 'Technical Landscape' },
  { id: 'security', label: 'Data Security & Privacy' },
  { id: 'financials', label: 'Financials & Resources' },
  { id: 'timeline', label: 'Timeline & Urgency' },
  { id: 'dependencies', label: 'Dependencies & Risks' },
  { id: 'checklist', label: 'BTA Checklist' }
];

function isValid(data: BtaFormData): boolean {
  return Boolean(data.projectName.trim() && data.requestingDepartment.trim());
}

export function BtaReviewForm({
  initialData,
  projectId,
  onChange
}: {
  initialData?: Partial<BtaFormData>;
  projectId?: string;
  onChange: (data: BtaFormData, valid: boolean) => void;
}) {
  const [form, setForm] = useState<BtaFormData>({ ...EMPTY, ...initialData });
  const [sectionId, setSectionId] = useState(SECTIONS[0].id);

  useEffect(() => {
    onChange(form, isValid(form));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  function set<K extends keyof BtaFormData>(key: K, value: BtaFormData[K]) {
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
      {sectionId === 'identification' && (
        <>
          <WizardSectionHeading title="Project Identification" />
          {projectId && (
            <AIPopulationDropzone
              team="bta"
              projectId={projectId}
              onExtractionComplete={(data) => setForm((prev) => ({ ...prev, ...(data as Partial<BtaFormData>) }))}
            />
          )}
          <FieldGrid>
            <TextField label="Project name" required value={form.projectName} onChange={(e) => set('projectName', e.target.value)} />
            <TextField label="Requestor name" value={form.requestorName} onChange={(e) => set('requestorName', e.target.value)} />
            <TextField label="Requesting department" required value={form.requestingDepartment} onChange={(e) => set('requestingDepartment', e.target.value)} />
            <TextField label="Project status" value={form.projectStatus} onChange={(e) => set('projectStatus', e.target.value)} />
            <TextField label="Project type" value={form.projectType} onChange={(e) => set('projectType', e.target.value)} />
            <TextField label="Primary BTA" value={form.primaryBTA} onChange={(e) => set('primaryBTA', e.target.value)} />
            <TextField label="Target business department" value={form.targetBusinessDepartment} onChange={(e) => set('targetBusinessDepartment', e.target.value)} />
          </FieldGrid>
        </>
      )}
      {sectionId === 'objective' && (
        <>
          <WizardSectionHeading title="Business Objective" />
          <div style={{ display: 'grid', gap: 16 }}>
            <TextArea label="Problem statement" rows={3} value={form.problemStatement} onChange={(e) => set('problemStatement', e.target.value)} />
            <TextArea label="Business objective" rows={3} value={form.businessObjective} onChange={(e) => set('businessObjective', e.target.value)} />
            <TextArea label="Business value" rows={3} value={form.businessValue} onChange={(e) => set('businessValue', e.target.value)} />
            <TextArea label="Strategic alignment" rows={3} value={form.strategicAlignment} onChange={(e) => set('strategicAlignment', e.target.value)} />
          </div>
        </>
      )}
      {sectionId === 'scope' && (
        <>
          <WizardSectionHeading title="Scope & Requirements" />
          <div style={{ display: 'grid', gap: 16 }}>
            <TextArea label="In scope" rows={3} value={form.inScope} onChange={(e) => set('inScope', e.target.value)} />
            <TextArea label="Out of scope" rows={3} value={form.outOfScope} onChange={(e) => set('outOfScope', e.target.value)} />
          </div>
        </>
      )}
      {sectionId === 'technical' && (
        <>
          <WizardSectionHeading title="Technical Landscape" />
          <FieldGrid>
            <YesNo label="Is this a new solution?" value={form.isNewSolution} onChange={(v) => set('isNewSolution', v)} />
            <YesNo label="Requires IT involvement?" value={form.itInvolvement} onChange={(v) => set('itInvolvement', v)} />
          </FieldGrid>
          <div style={{ marginTop: 16 }}>
            <TextArea label="Systems impacted" rows={3} value={form.systemsImpacted} onChange={(e) => set('systemsImpacted', e.target.value)} />
          </div>
        </>
      )}
      {sectionId === 'security' && (
        <>
          <WizardSectionHeading title="Data Security & Privacy" />
          <FieldGrid>
            <YesNo label="Involves PHI data?" value={form.hasPhiData} onChange={(v) => set('hasPhiData', v)} />
            <YesNo label="Is HIPAA applicable?" value={form.isHipaaApplicable} onChange={(v) => set('isHipaaApplicable', v)} />
            <TextField label="Data classification" value={form.dataClassification} onChange={(e) => set('dataClassification', e.target.value)} />
          </FieldGrid>
        </>
      )}
      {sectionId === 'financials' && (
        <>
          <WizardSectionHeading title="Financials & Resources" />
          <FieldGrid>
            <TextField label="Estimated budget" value={form.budgetEstimated} onChange={(e) => set('budgetEstimated', e.target.value)} />
            <TextField label="Budget type" value={form.budgetType} onChange={(e) => set('budgetType', e.target.value)} />
            <YesNo label="Vendor required?" value={form.vendorRequired} onChange={(v) => set('vendorRequired', v)} />
          </FieldGrid>
        </>
      )}
      {sectionId === 'timeline' && (
        <>
          <WizardSectionHeading title="Timeline & Urgency" />
          <FieldGrid>
            <TextField label="Requested start date" type="date" value={form.requestedStartDate} onChange={(e) => set('requestedStartDate', e.target.value)} />
            <TextField label="Requested end date" type="date" value={form.requestedEndDate} onChange={(e) => set('requestedEndDate', e.target.value)} />
            <SelectField
              label="Priority"
              value={form.priority}
              onChange={(e) => set('priority', e.target.value)}
              options={[
                { value: 'Critical', label: 'Critical' },
                { value: 'High', label: 'High' },
                { value: 'Medium', label: 'Medium' },
                { value: 'Low', label: 'Low' }
              ]}
            />
          </FieldGrid>
        </>
      )}
      {sectionId === 'dependencies' && (
        <>
          <WizardSectionHeading title="Dependencies & Risks" />
          <FieldGrid>
            <SelectField
              label="Risk level"
              value={form.riskLevel}
              onChange={(e) => set('riskLevel', e.target.value)}
              options={[
                { value: 'VeryHigh', label: 'Very High' },
                { value: 'High', label: 'High' },
                { value: 'Medium', label: 'Medium' },
                { value: 'Low', label: 'Low' }
              ]}
            />
          </FieldGrid>
          <div style={{ display: 'grid', gap: 16, marginTop: 16 }}>
            <TextArea label="Known risks" rows={3} value={form.knownRisks} onChange={(e) => set('knownRisks', e.target.value)} />
            <TextArea label="Dependencies" rows={3} value={form.dependencies} onChange={(e) => set('dependencies', e.target.value)} />
          </div>
        </>
      )}
      {sectionId === 'checklist' && (
        <>
          <WizardSectionHeading title="BTA Checklist" />
          <FieldGrid>
            <YesNo label="Architectural review complete?" value={form.btaChecklist_architectural} onChange={(v) => set('btaChecklist_architectural', v)} />
            <YesNo label="Security review complete?" value={form.btaChecklist_security} onChange={(v) => set('btaChecklist_security', v)} />
          </FieldGrid>
        </>
      )}
    </GateWizard>
  );
}
