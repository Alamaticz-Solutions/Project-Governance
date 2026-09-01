import { Field, Select, TextArea, TextInput, YesNoToggle } from "../fields";

export interface VcrVraData {
  riskTier: string;
  decisionOutcome: string;
  evaluationNarrative: string;
  vendorName: string;
  contractLink: string;
  accountManager: string;
  supportSla: string;
  hasDependencies: boolean;
}

export const VCR_VRA_DEFAULTS: VcrVraData = {
  riskTier: "Tier 3 / Moderate — 5 days",
  decisionOutcome: "Pending review",
  evaluationNarrative: "",
  vendorName: "",
  contractLink: "",
  accountManager: "",
  supportSla: "",
  hasDependencies: false,
};

export function VcrVraPanel({ data, onChange }: { data: VcrVraData; onChange: (patch: Partial<VcrVraData>) => void }) {
  return (
    <div>
      <div className="gw-desc">
        Two teams, one screen: VCR is Legal reviewing the contract; VRA is Security rating whether the
        vendor is safe to use.
      </div>
      <div className="gw-card">
        <div className="gw-fieldset-label">Vendor Risk Assessment (VRA)</div>
        <div className="gw-grid2">
          <Field label="Risk tier classification">
            <Select
              value={data.riskTier}
              onChange={(e) => onChange({ riskTier: e.target.value })}
              options={["Tier 3 / Moderate — 5 days", "Tier 2 / High — 7 days", "Tier 1 / Critical — 10 days"]}
            />
          </Field>
          <Field label="Decision outcome">
            <Select
              value={data.decisionOutcome}
              onChange={(e) => onChange({ decisionOutcome: e.target.value })}
              options={["Pending review", "Approved", "Approved with conditions", "Declined"]}
            />
          </Field>
        </div>
        <Field label="Evaluation areas — narrative" full>
          <TextArea value={data.evaluationNarrative} onChange={(e) => onChange({ evaluationNarrative: e.target.value })} />
        </Field>

        <div className="gw-fieldset-label">Vendor profile</div>
        <div className="gw-grid2">
          <Field label="Vendor name">
            <TextInput value={data.vendorName} onChange={(e) => onChange({ vendorName: e.target.value })} />
          </Field>
          <Field label="Contract link">
            <TextInput value={data.contractLink} onChange={(e) => onChange({ contractLink: e.target.value })} />
          </Field>
          <Field label="Account manager">
            <TextInput value={data.accountManager} onChange={(e) => onChange({ accountManager: e.target.value })} />
          </Field>
          <Field label="Support response SLA">
            <TextInput value={data.supportSla} onChange={(e) => onChange({ supportSla: e.target.value })} />
          </Field>
          <Field label="Parent/child vendor dependencies">
            <YesNoToggle value={data.hasDependencies} onChange={(v) => onChange({ hasDependencies: v })} />
          </Field>
        </div>
      </div>
    </div>
  );
}
