import { useState } from "react";
import { ChipToggleRow, DecisionRow, DfdTracker, Field, YesNoToggle, type DfdStatus } from "../fields";

export interface SraDfdData {
  phiFlag: boolean;
  piiFlag: boolean;
  piiCategories: string[];
  financialFlag: boolean;
  confidentialFlag: boolean;
  childrensInfoFlag: boolean;
  employeeInfoFlag: boolean;
  techIdentifiersFlag: boolean;
  dfdComponents: DfdStatus[];
  securityBaselineDone: boolean;
  architectureOverviewDone: boolean;
  accessControlPlanDone: boolean;
}

export const SRA_DFD_DEFAULTS: SraDfdData = {
  phiFlag: false,
  piiFlag: false,
  piiCategories: [],
  financialFlag: false,
  confidentialFlag: false,
  childrensInfoFlag: false,
  employeeInfoFlag: false,
  techIdentifiersFlag: false,
  dfdComponents: Array(12).fill("tbd"),
  securityBaselineDone: false,
  architectureOverviewDone: false,
  accessControlPlanDone: false,
};

export function SraDfdPanel({
  data,
  onChange,
  decision,
  onDecision,
}: {
  data: SraDfdData;
  onChange: (patch: Partial<SraDfdData>) => void;
  decision: string | null;
  onDecision: (d: string) => void;
}) {
  const [tab, setTab] = useState<"classification" | "dfd" | "docs">("classification");
  const openCount = data.dfdComponents.filter((s) => s !== "verified").length;

  return (
    <div>
      <div className="gw-desc">
        Security's review of a new system: what sensitive data is involved, then a Data Flow Diagram
        showing exactly how that data moves, broken into 12 required components.
      </div>

      <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "1px solid var(--gw-border)" }}>
        {(["classification", "dfd", "docs"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              background: "none",
              border: "none",
              padding: "9px 4px",
              marginRight: 20,
              fontSize: ".88rem",
              fontWeight: 600,
              color: tab === t ? "var(--gw-accent-dark)" : "var(--gw-ink-muted)",
              borderBottom: tab === t ? "2px solid var(--gw-accent)" : "2px solid transparent",
              cursor: "pointer",
            }}
          >
            {t === "classification" ? "Data Classification" : t === "dfd" ? "Data Flow Diagram" : "Other Artifacts"}
          </button>
        ))}
      </div>

      {tab === "classification" && (
        <div className="gw-card">
          <div className="gw-grid2">
            <Field label="PHI data flag">
              <YesNoToggle value={data.phiFlag} onChange={(v) => onChange({ phiFlag: v })} />
            </Field>
            <Field label="PII data flag">
              <YesNoToggle value={data.piiFlag} onChange={(v) => onChange({ piiFlag: v })} />
            </Field>
            <Field label="PII category detail" full>
              <ChipToggleRow
                options={["Name", "DOB", "Address", "SSN", "Provider ID", "Biometric"]}
                selected={data.piiCategories}
                onChange={(v) => onChange({ piiCategories: v })}
              />
            </Field>
            <Field label="Financial data flag">
              <YesNoToggle value={data.financialFlag} onChange={(v) => onChange({ financialFlag: v })} />
            </Field>
            <Field label="Company confidential flag">
              <YesNoToggle value={data.confidentialFlag} onChange={(v) => onChange({ confidentialFlag: v })} />
            </Field>
            <Field label="Children's information flag">
              <YesNoToggle value={data.childrensInfoFlag} onChange={(v) => onChange({ childrensInfoFlag: v })} />
            </Field>
            <Field label="Employee information flag">
              <YesNoToggle value={data.employeeInfoFlag} onChange={(v) => onChange({ employeeInfoFlag: v })} />
            </Field>
            <Field label="Technology systems identifiers flag">
              <YesNoToggle value={data.techIdentifiersFlag} onChange={(v) => onChange({ techIdentifiersFlag: v })} />
            </Field>
          </div>
        </div>
      )}

      {tab === "dfd" && (
        <div className="gw-card">
          <h3 style={{ fontSize: "1rem", marginBottom: 4 }}>12-component coverage tracker</h3>
          <DfdTracker statuses={data.dfdComponents} onChange={(v) => onChange({ dfdComponents: v })} />
          {openCount > 0 && (
            <div className="gw-note" style={{ marginTop: 16, background: "var(--gw-warn-soft)", borderLeftColor: "var(--gw-warn)", color: "#7a5a1f" }}>
              {openCount} of 12 components still need attention. The SRA SLA clock does not start until the
              DFD is fully accepted.
            </div>
          )}
        </div>
      )}

      {tab === "docs" && (
        <div className="gw-card">
          <Field label="Security Baseline questionnaire completed">
            <YesNoToggle value={data.securityBaselineDone} onChange={(v) => onChange({ securityBaselineDone: v })} />
          </Field>
          <Field label="Architecture overview / solution design attached">
            <YesNoToggle value={data.architectureOverviewDone} onChange={(v) => onChange({ architectureOverviewDone: v })} />
          </Field>
          <Field label="Access control plan attached">
            <YesNoToggle value={data.accessControlPlanDone} onChange={(v) => onChange({ accessControlPlanDone: v })} />
          </Field>
          <div className="gw-fieldset-label">SRA decision outcome</div>
          <DecisionRow value={decision} onChange={onDecision} />
        </div>
      )}
    </div>
  );
}
