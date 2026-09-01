import { useState } from "react";
import { DecisionRow, Field, TextArea, TextInput } from "../fields";

export interface TrcData {
  requester: string;
  email: string;
  requestedDate: string;
  roadmap: string;
  businessContinuityProcedure: string;
  historicalDataMigrationPlan: string;
}

export const TRC_DEFAULTS: TrcData = {
  requester: "",
  email: "",
  requestedDate: "",
  roadmap: "",
  businessContinuityProcedure: "",
  historicalDataMigrationPlan: "",
};

export function TrcPanel({
  data,
  onChange,
  decision,
  onDecision,
}: {
  data: TrcData;
  onChange: (patch: Partial<TrcData>) => void;
  decision: string | null;
  onDecision: (d: string) => void;
}) {
  const [tab, setTab] = useState<"meeting" | "deck">("meeting");

  return (
    <div>
      <div className="gw-desc">
        Reserve a slot at the Technology Review Committee, then present the deck sections for this
        project type.
      </div>
      <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "1px solid var(--gw-border)" }}>
        {(["meeting", "deck"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              background: "none", border: "none", padding: "9px 4px", marginRight: 20, fontSize: ".88rem",
              fontWeight: 600, cursor: "pointer",
              color: tab === t ? "var(--gw-accent-dark)" : "var(--gw-ink-muted)",
              borderBottom: tab === t ? "2px solid var(--gw-accent)" : "2px solid transparent",
            }}
          >
            {t === "meeting" ? "Meeting Request" : "Deck Sections"}
          </button>
        ))}
      </div>

      {tab === "meeting" && (
        <div className="gw-card">
          <div className="gw-grid2">
            <Field label="Requester">
              <TextInput value={data.requester} onChange={(e) => onChange({ requester: e.target.value })} />
            </Field>
            <Field label="Email">
              <TextInput type="email" value={data.email} onChange={(e) => onChange({ email: e.target.value })} />
            </Field>
            <Field label="Requested date">
              <TextInput type="date" value={data.requestedDate} onChange={(e) => onChange({ requestedDate: e.target.value })} />
            </Field>
          </div>
        </div>
      )}

      {tab === "deck" && (
        <div className="gw-card">
          <Field label="Roadmap" full>
            <TextArea value={data.roadmap} onChange={(e) => onChange({ roadmap: e.target.value })} />
          </Field>
          <Field label="Business continuity procedure" full>
            <TextArea value={data.businessContinuityProcedure} onChange={(e) => onChange({ businessContinuityProcedure: e.target.value })} />
          </Field>
          <Field label="Historical data migration plan" full>
            <TextArea value={data.historicalDataMigrationPlan} onChange={(e) => onChange({ historicalDataMigrationPlan: e.target.value })} />
          </Field>
          <div className="gw-fieldset-label">TRC decision outcome</div>
          <DecisionRow value={decision} onChange={onDecision} />
        </div>
      )}
    </div>
  );
}
