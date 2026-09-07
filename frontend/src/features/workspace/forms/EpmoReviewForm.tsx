import { useEffect, useState } from 'react';
import { TextArea } from '@ui-kit';
import { YesNo } from './GateWizard';
import { AIPopulationDropzone } from '../../shared/AIPopulationDropzone';

/**
 * EPMO Review gate form — ported from origin/Dev's `EpmoReviewForm.tsx`
 * (single-screen 4-question checklist, no stepper). Fields/validation match
 * Dev exactly; storage is this branch's `GateSubmission.data` JSON (Dev's
 * own contract already matches, no backend change needed).
 */

export type EpmoFormData = {
  epmo_strategy: 'Yes' | 'No' | '';
  epmo_pic_needed: 'Yes' | 'No' | '';
  epmo_pm_required: 'Yes' | 'No' | '';
  epmo_related_project: 'Yes' | 'No' | '';
  epmo_comments: string;
};

const EMPTY: EpmoFormData = {
  epmo_strategy: '',
  epmo_pic_needed: '',
  epmo_pm_required: '',
  epmo_related_project: '',
  epmo_comments: ''
};

function isValid(data: EpmoFormData): boolean {
  return Boolean(data.epmo_strategy && data.epmo_pic_needed);
}

export function EpmoReviewForm({
  initialData,
  projectId,
  onChange
}: {
  initialData?: Partial<EpmoFormData>;
  projectId?: string;
  onChange: (data: EpmoFormData, valid: boolean) => void;
}) {
  const [form, setForm] = useState<EpmoFormData>({ ...EMPTY, ...initialData });

  useEffect(() => {
    onChange(form, isValid(form));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  function set<K extends keyof EpmoFormData>(key: K, value: EpmoFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div>
        <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800, color: 'white' }}>EPMO Review</h3>
        <p style={{ margin: 0, fontSize: 12, color: '#94A3B8' }}>Enterprise PMO intake checklist.</p>
      </div>
      {projectId && (
        <AIPopulationDropzone
          team="epmo"
          projectId={projectId}
          onExtractionComplete={(data) => setForm((prev) => ({ ...prev, ...(data as Partial<EpmoFormData>) }))}
        />
      )}
      <YesNo label="Does this align with strategy?" required value={form.epmo_strategy} onChange={(v) => set('epmo_strategy', v)} />
      <YesNo label="Is a PIC review needed?" required value={form.epmo_pic_needed} onChange={(v) => set('epmo_pic_needed', v)} />
      <YesNo label="Is a dedicated Project Manager required?" value={form.epmo_pm_required} onChange={(v) => set('epmo_pm_required', v)} />
      <YesNo label="Is this related to an existing project?" value={form.epmo_related_project} onChange={(v) => set('epmo_related_project', v)} />
      <TextArea
        label="Comments"
        rows={5}
        maxLength={1000}
        value={form.epmo_comments}
        onChange={(e) => set('epmo_comments', e.target.value)}
        hint={`${form.epmo_comments.length}/1000`}
      />
    </div>
  );
}
