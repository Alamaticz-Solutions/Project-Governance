import { useEffect, useMemo, useState } from 'react';
import { TextArea, TextField } from '@ui-kit';
import { FieldGrid, GateWizard, WizardSectionHeading, YesNo, type WizardSection } from './GateWizard';

/**
 * Finance Review gate form — ported from origin/Dev's `FinanceReviewForm.tsx`
 * (3-section wizard + a dynamic per-fiscal-year cost-items table). No
 * `Finance` stage exists in this branch's real seeded 19-stage workflow
 * (unlike Dev's simplified 6-step pipeline, which has one) — built to spec
 * regardless so the component exists; `ProjectWorkspaceScreen` does not
 * currently render it from any live stage (see workspace screen's stage
 * switch comment).
 */

export type CostItem = {
  name: string;
  justification: string;
  category: string;
  costType: string;
  fy24: string;
  fy25: string;
  fy26: string;
  fy27: string;
};

export type FinanceFormData = {
  totalCapex: string;
  totalOpex: string;
  totalRunCosts: string;
  grandTotal: string;
  memoOpex: string;
  devImplCosts: string;
  softwareLicensing: string;
  annualCosts: string;
  annualBenefits: string;
  netCashFlow: string;
  cumulativeCashFlow: string;
  paybackPeriod: string;
  roiPercentage: string;
  financeNarrative: string;
  financeChecklist_budget: 'Yes' | 'No' | '';
  financeChecklist_capex: 'Yes' | 'No' | '';
};

const EMPTY: FinanceFormData = {
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
  financeChecklist_budget: '',
  financeChecklist_capex: ''
};

const SECTIONS: WizardSection[] = [
  { id: 'cost-plan', label: 'Detailed Cost Plan' },
  { id: 'roi', label: 'ROI Analysis' },
  { id: 'checklist', label: 'Finance Checklist' }
];

function isValid(data: FinanceFormData): boolean {
  return Boolean(data.financeChecklist_budget);
}

export function FinanceReviewForm({
  initialData,
  initialCostItems,
  onChange
}: {
  initialData?: Partial<FinanceFormData>;
  initialCostItems?: CostItem[];
  onChange: (data: FinanceFormData & { costItems: CostItem[] }, valid: boolean) => void;
}) {
  const [form, setForm] = useState<FinanceFormData>({ ...EMPTY, ...initialData });
  const [costItems, setCostItems] = useState<CostItem[]>(initialCostItems ?? []);
  const [sectionId, setSectionId] = useState(SECTIONS[0].id);

  const netBenefitNum = useMemo(() => {
    const benefits = Number(form.annualBenefits) || 0;
    const costs = Number(form.annualCosts) || 0;
    return benefits - costs;
  }, [form.annualBenefits, form.annualCosts]);

  useEffect(() => {
    onChange({ ...form, costItems }, isValid(form));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, costItems]);

  function set<K extends keyof FinanceFormData>(key: K, value: FinanceFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateItem(i: number, patch: Partial<CostItem>) {
    setCostItems((prev) => prev.map((row, ri) => (ri === i ? { ...row, ...patch } : row)));
  }

  const index = SECTIONS.findIndex((s) => s.id === sectionId);
  const goto = (delta: number) => setSectionId(SECTIONS[Math.min(Math.max(index + delta, 0), SECTIONS.length - 1)].id);

  const costItemCols: (keyof CostItem)[] = ['name', 'justification', 'category', 'costType', 'fy24', 'fy25', 'fy26', 'fy27'];

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
      {sectionId === 'cost-plan' && (
        <>
          <WizardSectionHeading title="Detailed Cost Plan" />
          <FieldGrid>
            <TextField label="Total CAPEX" value={form.totalCapex} onChange={(e) => set('totalCapex', e.target.value)} />
            <TextField label="Total OPEX" value={form.totalOpex} onChange={(e) => set('totalOpex', e.target.value)} />
            <TextField label="Total run costs" value={form.totalRunCosts} onChange={(e) => set('totalRunCosts', e.target.value)} />
            <TextField label="Grand total" value={form.grandTotal} onChange={(e) => set('grandTotal', e.target.value)} />
            <TextField label="Memo OPEX" value={form.memoOpex} onChange={(e) => set('memoOpex', e.target.value)} />
            <TextField label="Dev/impl. costs" value={form.devImplCosts} onChange={(e) => set('devImplCosts', e.target.value)} />
            <TextField label="Software licensing" value={form.softwareLicensing} onChange={(e) => set('softwareLicensing', e.target.value)} />
          </FieldGrid>

          <div style={{ marginTop: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <h4 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: 'white' }}>Cost items by fiscal year</h4>
              <button
                type="button"
                onClick={() =>
                  setCostItems((prev) => [...prev, { name: '', justification: '', category: '', costType: '', fy24: '', fy25: '', fy26: '', fy27: '' }])
                }
                style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: 'rgba(30,41,59,0.8)', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer' }}
              >
                + Add row
              </button>
            </div>
            <div style={{ borderRadius: 12, overflow: 'auto', border: '1px solid rgba(255,255,255,0.08)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'rgba(15,23,42,0.5)' }}>
                    {costItemCols.map((c) => (
                      <th key={c} style={{ textAlign: 'left', padding: '8px 10px', color: '#94A3B8', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        {c}
                      </th>
                    ))}
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {costItems.map((row, i) => (
                    <tr key={i}>
                      {costItemCols.map((c) => (
                        <td key={c} style={{ padding: 4 }}>
                          <input
                            value={row[c]}
                            onChange={(e) => updateItem(i, { [c]: e.target.value } as Partial<CostItem>)}
                            style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.1)', color: '#e2e8f0', fontSize: 12 }}
                          />
                        </td>
                      ))}
                      <td>
                        <button
                          type="button"
                          onClick={() => setCostItems((prev) => prev.filter((_, ri) => ri !== i))}
                          style={{ background: 'transparent', border: 'none', color: '#F87171', cursor: 'pointer', fontSize: 11 }}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                  {costItems.length === 0 && (
                    <tr>
                      <td colSpan={costItemCols.length + 1} style={{ padding: 16, textAlign: 'center', color: '#64748B' }}>
                        No cost items yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
      {sectionId === 'roi' && (
        <>
          <WizardSectionHeading title="ROI Analysis" />
          <FieldGrid>
            <TextField label="Annual costs" value={form.annualCosts} onChange={(e) => set('annualCosts', e.target.value)} />
            <TextField label="Annual benefits" value={form.annualBenefits} onChange={(e) => set('annualBenefits', e.target.value)} />
            <TextField label="Net cash flow" value={form.netCashFlow} onChange={(e) => set('netCashFlow', e.target.value)} />
            <TextField label="Cumulative cash flow" value={form.cumulativeCashFlow} onChange={(e) => set('cumulativeCashFlow', e.target.value)} />
            <TextField label="Payback period" value={form.paybackPeriod} onChange={(e) => set('paybackPeriod', e.target.value)} />
            <TextField label="ROI %" value={form.roiPercentage} onChange={(e) => set('roiPercentage', e.target.value)} />
          </FieldGrid>
          <p style={{ marginTop: 12, fontSize: 12, color: '#94A3B8' }}>
            Computed net benefit: <strong style={{ color: netBenefitNum >= 0 ? '#34D399' : '#F87171' }}>{netBenefitNum.toLocaleString()}</strong>
          </p>
          <div style={{ marginTop: 16 }}>
            <TextArea label="Finance narrative" rows={4} value={form.financeNarrative} onChange={(e) => set('financeNarrative', e.target.value)} />
          </div>
        </>
      )}
      {sectionId === 'checklist' && (
        <>
          <WizardSectionHeading title="Finance Checklist" />
          <FieldGrid>
            <YesNo label="Budget confirmed?" required value={form.financeChecklist_budget} onChange={(v) => set('financeChecklist_budget', v)} />
            <YesNo label="CAPEX/OPEX classification confirmed?" value={form.financeChecklist_capex} onChange={(v) => set('financeChecklist_capex', v)} />
          </FieldGrid>
        </>
      )}
    </GateWizard>
  );
}
