import { ChipToggleRow, Field, Select, TextInput, YesNoToggle } from "../fields";

export interface StRunbookData {
  tierDesignation: string;
  bluedolphinCompletionPct: string;
  whoIsImpacted: string[];
  hostingEnvironment: string;
  deploymentToProdDate: string;
  supportGoLiveDate: string;
  estLongTermUsers: string;
  hardwareSoftwareRequired: boolean;
}

export const ST_RUNBOOK_DEFAULTS: StRunbookData = {
  tierDesignation: "Tier 2",
  bluedolphinCompletionPct: "",
  whoIsImpacted: [],
  hostingEnvironment: "Cloud — AWS",
  deploymentToProdDate: "",
  supportGoLiveDate: "",
  estLongTermUsers: "",
  hardwareSoftwareRequired: false,
};

export function StRunbookPanel({
  data,
  onChange,
}: {
  data: StRunbookData;
  onChange: (patch: Partial<StRunbookData>) => void;
}) {
  return (
    <div>
      <div className="gw-desc">
        The operational-readiness runbook. A handful of sections carry structured fields; the rest
        stays free-text in Confluence.
      </div>
      <div className="gw-card">
        <div className="gw-fieldset-label">Planning &amp; support</div>
        <div className="gw-grid2">
          <Field label="Tier designation">
            <Select
              value={data.tierDesignation}
              onChange={(e) => onChange({ tierDesignation: e.target.value })}
              options={["Tier 0", "Tier 1", "Tier 2", "Tier 3"]}
            />
          </Field>
          <Field label="BlueDolphin completion %">
            <TextInput value={data.bluedolphinCompletionPct} onChange={(e) => onChange({ bluedolphinCompletionPct: e.target.value })} />
          </Field>
          <Field label="Who is impacted" full>
            <ChipToggleRow
              options={["Providers", "Care coordinators", "Patients", "IT support"]}
              selected={data.whoIsImpacted}
              onChange={(v) => onChange({ whoIsImpacted: v })}
            />
          </Field>
          <Field label="Hosting environment">
            <Select
              value={data.hostingEnvironment}
              onChange={(e) => onChange({ hostingEnvironment: e.target.value })}
              options={["Cloud — AWS", "On-prem", "Hybrid"]}
            />
          </Field>
        </div>
        <div className="gw-fieldset-label">Key dates &amp; assets</div>
        <div className="gw-grid2">
          <Field label="Deployment to prod date">
            <TextInput type="date" value={data.deploymentToProdDate} onChange={(e) => onChange({ deploymentToProdDate: e.target.value })} />
          </Field>
          <Field label="Support go-live date">
            <TextInput type="date" value={data.supportGoLiveDate} onChange={(e) => onChange({ supportGoLiveDate: e.target.value })} />
          </Field>
          <Field label="Est. long-term users">
            <TextInput value={data.estLongTermUsers} onChange={(e) => onChange({ estLongTermUsers: e.target.value })} />
          </Field>
          <Field label="Hardware/software required?">
            <YesNoToggle value={data.hardwareSoftwareRequired} onChange={(v) => onChange({ hardwareSoftwareRequired: v })} />
          </Field>
        </div>
      </div>
    </div>
  );
}
