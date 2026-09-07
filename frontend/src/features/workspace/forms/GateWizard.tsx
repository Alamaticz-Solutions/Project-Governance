import { type ReactNode, type CSSProperties } from 'react';
import { Button, ProcessStepper, type ProcessStepItem } from '@ui-kit';

/**
 * Shared shell for the Dev-branch bespoke gate review forms (BTA/EAC/Finance/
 * PIC use it; EPMO is a single screen and doesn't). Mirrors Dev's left
 * vertical stepper + right content-card layout
 * (`workspace/forms/*ReviewForm.tsx` on origin/Dev) on this branch's own
 * dark-glass visual language and `@ui-kit` primitives (`ProcessStepper`,
 * `Button`) rather than Tailwind — no new UI toolchain, per the "current
 * framework only" constraint.
 */

export type WizardSection = { id: string; label: string };

const glassCard: CSSProperties = {
  borderRadius: 16,
  background: 'rgba(30,41,59,0.5)',
  backdropFilter: 'blur(12px)',
  border: '1px solid rgba(255,255,255,0.1)'
};

export function GateWizard({
  sections,
  activeSectionId,
  onSectionSelect,
  isFirst,
  isLast,
  onPrevious,
  onNext,
  children
}: {
  sections: readonly WizardSection[];
  activeSectionId: string;
  onSectionSelect: (id: string) => void;
  isFirst: boolean;
  isLast: boolean;
  onPrevious: () => void;
  onNext: () => void;
  children: ReactNode;
}) {
  const steps: ProcessStepItem[] = sections.map((s) => ({
    id: s.id,
    label: s.label,
    status: s.id === activeSectionId ? 'current' : undefined
  }));

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 24, alignItems: 'start' }}>
      <div style={{ ...glassCard, padding: 20, position: 'sticky', top: 24 }}>
        <ProcessStepper
          ariaLabel="Gate review sections"
          orientation="vertical"
          steps={steps}
          currentStepId={activeSectionId}
          onStepSelect={(step) => onSectionSelect(step.id)}
        />
      </div>
      <div style={{ ...glassCard, padding: 28, minHeight: 420 }}>
        {children}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 32, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <Button variant="quiet" onClick={onPrevious} disabled={isFirst}>
            Previous
          </Button>
          <Button variant="secondary" onClick={onNext} disabled={isLast}>
            Next section
          </Button>
        </div>
      </div>
    </div>
  );
}

export function WizardSectionHeading({ title, hint }: { title: string; hint?: string }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'white' }}>{title}</h3>
      {hint ? <p style={{ margin: '4px 0 0', fontSize: 12, color: '#94A3B8' }}>{hint}</p> : null}
    </div>
  );
}

export function FieldGrid({ columns = 2, children }: { columns?: 1 | 2; children: ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: columns === 2 ? 'repeat(auto-fit, minmax(240px, 1fr))' : '1fr', gap: 16 }}>
      {children}
    </div>
  );
}

/** Dev's `YesNoToggle` — two-way radio rendered as a segmented pair. */
export function YesNo({
  label,
  value,
  onChange,
  required
}: {
  label: string;
  value: 'Yes' | 'No' | '';
  onChange: (value: 'Yes' | 'No') => void;
  required?: boolean;
}) {
  return (
    <div>
      <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#CBD5E1', marginBottom: 6 }}>
        {label}
        {required ? <span style={{ color: '#F87171' }}> *</span> : null}
      </span>
      <div style={{ display: 'flex', gap: 8 }}>
        {(['Yes', 'No'] as const).map((option) => {
          const on = value === option;
          return (
            <button
              key={option}
              type="button"
              onClick={() => onChange(option)}
              style={{
                flex: 1,
                padding: '9px 0',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                border: on ? 'none' : '1px solid rgba(255,255,255,0.12)',
                background: on ? 'linear-gradient(135deg,#4F46E5,#7C3AED)' : 'rgba(15,23,42,0.6)',
                color: on ? 'white' : '#94A3B8'
              }}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}
