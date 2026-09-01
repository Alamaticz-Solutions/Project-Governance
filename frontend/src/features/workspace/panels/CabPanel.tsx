import { Field, Select, TextArea, TextInput, YesNoToggle } from "../fields";

export interface CabData {
  changeCategory: string;
  requestType: string;
  masterfileEpic: string;
  serviceTransitionTrigger: boolean;
  pdsEnvironment: string;
  deployedToProdDate: string;
  rollbackPlan: string;
  masterChangeTicketRef: string;
}

export const CAB_DEFAULTS: CabData = {
  changeCategory: "Standard",
  requestType: "New deployment",
  masterfileEpic: "",
  serviceTransitionTrigger: false,
  pdsEnvironment: "Production",
  deployedToProdDate: "",
  rollbackPlan: "",
  masterChangeTicketRef: "",
};

export function CabPanel({ data, onChange }: { data: CabData; onChange: (patch: Partial<CabData>) => void }) {
  return (
    <div>
      <div className="gw-desc">The production-change request — maps directly onto the change-ticket process.</div>
      <div className="gw-card">
        <div className="gw-fieldset-label">Classification</div>
        <div className="gw-grid2">
          <Field label="Change category">
            <Select
              value={data.changeCategory}
              onChange={(e) => onChange({ changeCategory: e.target.value })}
              options={["Standard", "Normal", "Emergency"]}
            />
          </Field>
          <Field label="Request type">
            <Select
              value={data.requestType}
              onChange={(e) => onChange({ requestType: e.target.value })}
              options={["New deployment", "Configuration change", "Rollback"]}
            />
          </Field>
        </div>
        <div className="gw-fieldset-label">Scope &amp; deployment</div>
        <div className="gw-grid2">
          <Field label="Masterfile(s) / Epic">
            <TextInput value={data.masterfileEpic} onChange={(e) => onChange({ masterfileEpic: e.target.value })} />
          </Field>
          <Field label="Service transition trigger?">
            <YesNoToggle value={data.serviceTransitionTrigger} onChange={(v) => onChange({ serviceTransitionTrigger: v })} />
          </Field>
          <Field label="PDS environment (target)">
            <Select
              value={data.pdsEnvironment}
              onChange={(e) => onChange({ pdsEnvironment: e.target.value })}
              options={["Production", "Staging"]}
            />
          </Field>
          <Field label="Deployed to prod (date)">
            <TextInput type="date" value={data.deployedToProdDate} onChange={(e) => onChange({ deployedToProdDate: e.target.value })} />
          </Field>
        </div>
        <Field label="Rollback plan" full>
          <TextArea value={data.rollbackPlan} onChange={(e) => onChange({ rollbackPlan: e.target.value })} />
        </Field>
        <Field label="Master change ticket reference" full>
          <TextInput value={data.masterChangeTicketRef} onChange={(e) => onChange({ masterChangeTicketRef: e.target.value })} />
        </Field>
      </div>
    </div>
  );
}
