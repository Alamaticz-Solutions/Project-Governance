import { useEffect } from "react";
import { useState } from "react";
import { AIPopulationDropzone } from "../components/AIPopulationDropzone";

export interface EpmoFormData {
  epmo_strategy: string;
  epmo_pic_needed: string;
  epmo_pm_required: string;
  epmo_related_project: string;
  epmo_comments: string;
  [key: string]: unknown;
}

interface EpmoReviewFormProps {
  projectId: string;
  /** Called whenever any field changes — parent reads this to get current state */
  onFormChange: (data: EpmoFormData, isValid: boolean) => void;
}

export function EpmoReviewForm({ projectId: _projectId, onFormChange }: EpmoReviewFormProps) {
  const [touched, setTouched] = useState(false);
  const [form, setForm] = useState<EpmoFormData>({
    epmo_strategy: "",
    epmo_pic_needed: "",
    epmo_pm_required: "",
    epmo_related_project: "",
    epmo_comments: "",
  });

  const isValid = form.epmo_strategy !== "" && form.epmo_pic_needed !== "";

    const handleAIExtraction = (parsedData: Record<string, any>) => {
    const clean = Object.fromEntries(
      Object.entries(parsedData || {}).filter(([, v]) => v !== "" && v !== null && v !== undefined)
    );
    setForm((prev: any) => {
      const next = { ...prev, ...clean };
      if (typeof onFormChange === 'function') {
         onFormChange(next, next.epmo_strategy !== "" && next.epmo_pic_needed !== "");
      }
      return next;
    });
  };

const updateForm = (key: keyof EpmoFormData, value: string) => {
    const next = { ...form, [key]: value };
    setForm(next);
    const nextValid = next.epmo_strategy !== "" && next.epmo_pic_needed !== "";
    onFormChange(next, nextValid);
  };

  // Emit initial state on mount
  useEffect(() => {
    onFormChange(form, isValid);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Expose touched setter so parent can trigger validation display
  const markTouched = () => setTouched(true);
  (window as any).__epmoMarkTouched = markTouched;

  const RadioGroup = ({
    name,
    value,
    onChange,
    label,
    description,
    icon,
    required,
    error,
  }: {
    name: keyof EpmoFormData;
    value: string;
    onChange: (v: string) => void;
    label: string;
    description: string;
    icon: string;
    required?: boolean;
    error?: boolean;
  }) => (
    <div className="flex flex-col md:flex-row md:items-center justify-between p-5 border border-white/10 rounded-xl hover:border-indigo-400/40 transition-colors bg-white/5 gap-4">
      <div className="flex items-start gap-4 flex-1">
        <div className="w-12 h-12 rounded-xl bg-indigo-500/15 text-indigo-300 flex items-center justify-center shrink-0 border border-indigo-500/20">
          <span className="material-icons text-[24px]">{icon}</span>
        </div>
        <div>
          <h3 className="text-[14px] font-bold text-slate-100 mb-1">
            {label} {required && <span className="text-red-500">*</span>}
          </h3>
          <p className="text-[12px] text-slate-400 font-medium leading-relaxed">{description}</p>
          {touched && error && <p className="text-xs text-red-400 mt-1">This field is required</p>}
        </div>
      </div>
      <div className="flex items-center gap-6 md:gap-14 shrink-0 mt-2 md:mt-0">
        <div className="flex items-center gap-8">
          <label className="flex items-center gap-3 cursor-pointer group">
            <input
              type="radio"
              name={name as string}
              value="Yes"
              checked={value === "Yes"}
              onChange={(e) => onChange(e.target.value)}
              className="w-5 h-5 text-indigo-500 bg-transparent border-white/20 focus:ring-indigo-500 cursor-pointer accent-indigo-500"
            />
            <span className="text-[14px] font-bold text-slate-300 group-hover:text-indigo-400 transition-colors">Yes</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer group">
            <input
              type="radio"
              name={name as string}
              value="No"
              checked={value === "No"}
              onChange={(e) => onChange(e.target.value)}
              className="w-5 h-5 text-indigo-500 bg-transparent border-white/20 focus:ring-indigo-500 cursor-pointer accent-indigo-500"
            />
            <span className="text-[14px] font-bold text-slate-300 group-hover:text-indigo-400 transition-colors">No</span>
          </label>
        </div>
      </div>
    </div>
  );

  return (
    <div className="w-full bg-[#0f172a] rounded-2xl shadow-[0_20px_40px_-10px_rgba(0,0,0,0.5),0_0_20px_rgba(99,102,241,0.1)] overflow-hidden font-sans border border-slate-700/50">
      <div className="p-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-8 relative z-10">
          <div>
            <h1 className="text-[20px] font-extrabold text-white flex items-center gap-3">
              <span className="material-icons text-indigo-300 bg-indigo-500/15 p-1.5 rounded-lg text-[20px]">
                assignment_turned_in
              </span>
              Conduct EPMO Check-in
            </h1>
            <p className="text-[13px] font-medium text-slate-400 mt-2">
              Please complete the checklist below. Use the sidebar <strong className="text-indigo-300">Approve</strong> or <strong className="text-red-400">Reject</strong> buttons to submit your decision.
            </p>
          </div>
          <div className="flex items-center gap-2 border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 rounded-full text-emerald-300 text-[11px] font-bold tracking-wide">
            <span className="material-icons text-[14px]">check_circle</span>
            Ready for input
          </div>
        </div>

        <AIPopulationDropzone projectId={_projectId} team="EPMO" onExtractionComplete={handleAIExtraction} />

        <div className="space-y-4">
          <RadioGroup
            name="epmo_strategy"
            value={form.epmo_strategy}
            onChange={(v) => updateForm("epmo_strategy", v)}
            label="Is aligned with strategy?"
            description="Does this project align with organizational strategy and business objectives?"
            icon="track_changes"
            required
            error={!form.epmo_strategy}
          />

          <RadioGroup
            name="epmo_pic_needed"
            value={form.epmo_pic_needed}
            onChange={(v) => updateForm("epmo_pic_needed", v)}
            label="PIC Needed?"
            description="Is Project Investment Committee (PIC) approval required for this project?"
            icon="groups"
            required
            error={!form.epmo_pic_needed}
          />

          <RadioGroup
            name="epmo_pm_required"
            value={form.epmo_pm_required}
            onChange={(v) => updateForm("epmo_pm_required", v)}
            label="Is Project Manager Required?"
            description="Do we need to assign a dedicated project manager for this initiative?"
            icon="person_outline"
          />

          <RadioGroup
            name="epmo_related_project"
            value={form.epmo_related_project}
            onChange={(v) => updateForm("epmo_related_project", v)}
            label="Related to Existing Project?"
            description="Is this project related to or dependent on any existing projects or initiatives?"
            icon="link"
          />

          {/* Comments */}
          <div className="mt-8 border border-white/10 rounded-xl p-5 bg-white/5">
            <h3 className="text-[13px] font-bold text-slate-100 mb-1">Additional Comments (Optional)</h3>
            <p className="text-[12px] text-slate-400 font-medium mb-3">Provide any additional context or observations...</p>
            <textarea
              name="epmo_comments"
              rows={3}
              value={form.epmo_comments}
              onChange={(e) => updateForm("epmo_comments", e.target.value)}
              className="w-full resize-none border-none outline-none text-[13px] bg-transparent text-slate-300 placeholder-slate-500 leading-relaxed font-medium"
              placeholder="Start typing here..."
            ></textarea>
            <div className="flex justify-end mt-2">
              <span className="text-[11px] text-slate-500 font-bold tracking-wide">
                {form.epmo_comments.length} / 1000
              </span>
            </div>
          </div>

          {/* Validation summary — shown when touched but not valid */}
          {touched && !isValid && (
            <div className="flex items-center gap-3 p-4 rounded-xl border border-red-500/30 bg-red-500/10 mt-4">
              <span className="material-icons text-red-400 text-[20px]">error_outline</span>
              <p className="text-sm font-bold text-red-400">
                Please answer all mandatory fields (marked <span className="text-red-300">*</span>) before approving.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
