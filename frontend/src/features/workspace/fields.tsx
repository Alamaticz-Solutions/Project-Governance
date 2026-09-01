/** Shared field primitives for every governance workspace panel — matches
 * the reference mockup's controls (yes/no toggle, chip multi-select,
 * decision row, DFD coverage tracker) so panels stay thin and consistent. */

export function Field({
  label,
  full,
  children,
}: {
  label: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`gw-field${full ? " full" : ""}`}>
      <label>{label}</label>
      {children}
    </div>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input type="text" {...props} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} />;
}

export function Select({
  options,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { options: string[] }) {
  return (
    <select {...props}>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

export function YesNoToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="gw-yn">
      <button type="button" className={`yes${value ? " on" : ""}`} onClick={() => onChange(true)}>
        Yes
      </button>
      <button type="button" className={`no${!value ? " on" : ""}`} onClick={() => onChange(false)}>
        No
      </button>
    </div>
  );
}

export function ChipToggleRow({
  options,
  selected,
  onChange,
}: {
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="gw-chips">
      {options.map((opt) => {
        const on = selected.includes(opt);
        return (
          <span
            key={opt}
            className={`gw-chip${on ? " on" : ""}`}
            onClick={() => onChange(on ? selected.filter((s) => s !== opt) : [...selected, opt])}
          >
            {opt}
          </span>
        );
      })}
    </div>
  );
}

export type DfdStatus = "verified" | "in_progress" | "confirm" | "tbd";

export const DFD_COMPONENTS = [
  "Source & destination systems",
  "Data types & classification",
  "Transfer protocols & encryption in transit",
  "Integration points & interfaces",
  "Data validation & transformation flows",
  "Access controls & authentication checkpoints",
  "Legacy system architecture components",
  "Cloud architecture",
  "Network segmentation & security zones",
  "Identity and Access Management (IAM) layers",
  "Encryption at rest & key management",
  "High availability & backup components",
];

export function DfdTracker({
  statuses,
  onChange,
}: {
  statuses: DfdStatus[];
  onChange: (next: DfdStatus[]) => void;
}) {
  return (
    <div className="gw-dfd-grid">
      {DFD_COMPONENTS.map((label, i) => (
        <div className="gw-dfd-item" key={label}>
          <div className="t">
            {i + 1}. {label}
          </div>
          <select
            value={statuses[i] ?? "tbd"}
            onChange={(e) => {
              const next = [...statuses];
              next[i] = e.target.value as DfdStatus;
              onChange(next);
            }}
          >
            <option value="verified">Verified</option>
            <option value="in_progress">In progress</option>
            <option value="confirm">Confirm</option>
            <option value="tbd">TBD</option>
          </select>
        </div>
      ))}
    </div>
  );
}

export function DecisionRow({
  value,
  onChange,
  options = ["approve", "conditional", "reject"],
  labels = { approve: "Approved", conditional: "Conditional", reject: "Rejected" },
}: {
  value: string | null;
  onChange: (v: string) => void;
  options?: string[];
  labels?: Record<string, string>;
}) {
  return (
    <div className="gw-decision-row">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          className={`gw-decision-btn ${opt}${value === opt ? " on" : ""}`}
          onClick={() => onChange(opt)}
        >
          {labels[opt] ?? opt}
        </button>
      ))}
    </div>
  );
}
