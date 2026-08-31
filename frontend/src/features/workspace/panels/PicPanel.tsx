import { DecisionRow, Field, Select, TextArea } from "../fields";

export interface PicData {
  budgetStatus: string;
  timelineStatus: string;
  strategicAlignmentNotes: string;
}

export const PIC_DEFAULTS: PicData = {
  budgetStatus: "On budget",
  timelineStatus: "On schedule",
  strategicAlignmentNotes: "",
};

export function PicPanel({
  data,
  onChange,
  decision,
  onDecision,
}: {
  data: PicData;
  onChange: (patch: Partial<PicData>) => void;
  decision: string | null;
  onDecision: (d: string) => void;
}) {
  return (
    <div>
      <div className="gw-desc">
        Executive decision point: does this project still fit enterprise priorities? This is the final
        gate.
      </div>
      <div className="gw-card">
        <div className="gw-grid2">
          <Field label="Budget status">
            <Select value={data.budgetStatus} onChange={(e) => onChange({ budgetStatus: e.target.value })} options={["On budget", "Over budget"]} />
          </Field>
          <Field label="Timeline status">
            <Select value={data.timelineStatus} onChange={(e) => onChange({ timelineStatus: e.target.value })} options={["On schedule", "Delayed"]} />
          </Field>
        </div>
        <Field label="Strategic alignment notes" full>
          <TextArea value={data.strategicAlignmentNotes} onChange={(e) => onChange({ strategicAlignmentNotes: e.target.value })} />
        </Field>
        <div className="gw-fieldset-label">PIC decision</div>
        <DecisionRow
          value={decision}
          onChange={onDecision}
          options={["approve", "hold", "deprioritize"]}
          labels={{ approve: "Approved to proceed", hold: "Hold for review", deprioritize: "Deprioritize" }}
        />
      </div>
    </div>
  );
}
