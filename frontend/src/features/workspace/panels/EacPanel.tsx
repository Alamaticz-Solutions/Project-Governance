import { DecisionRow, Field, Select, TextArea, TextInput } from "../fields";

export interface EacData {
  architecturePattern: string;
  standardsConformance: string;
  reviewerNotes: string;
}

export const EAC_DEFAULTS: EacData = {
  architecturePattern: "",
  standardsConformance: "Conforms",
  reviewerNotes: "",
};

export function EacPanel({
  data,
  onChange,
  decision,
  onDecision,
}: {
  data: EacData;
  onChange: (patch: Partial<EacData>) => void;
  decision: string | null;
  onDecision: (d: string) => void;
}) {
  return (
    <div>
      <div className="gw-desc">
        Reviews tech stack, roadmap alignment, and architecture feasibility. Confirms the project
        conforms to best practices before TRC.
      </div>
      <div className="gw-card">
        <div className="gw-grid2">
          <Field label="Architecture pattern reviewed">
            <TextInput value={data.architecturePattern} onChange={(e) => onChange({ architecturePattern: e.target.value })} />
          </Field>
          <Field label="Standards conformance">
            <Select
              value={data.standardsConformance}
              onChange={(e) => onChange({ standardsConformance: e.target.value })}
              options={["Conforms", "Conforms with exceptions", "Does not conform"]}
            />
          </Field>
        </div>
        <Field label="Reviewer notes" full>
          <TextArea value={data.reviewerNotes} onChange={(e) => onChange({ reviewerNotes: e.target.value })} />
        </Field>
        <div className="gw-fieldset-label">Decision</div>
        <DecisionRow value={decision} onChange={onDecision} />
      </div>
    </div>
  );
}
