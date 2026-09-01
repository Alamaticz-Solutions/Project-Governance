import { useState } from "react";
import { useNavigate } from "react-router";
import { projectsApi } from "../../../lib/api";

interface EpmoReviewFormProps {
  projectId: string;
  onSuccess?: () => void;
}

export function EpmoReviewForm({ projectId, onSuccess }: EpmoReviewFormProps) {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    epmo_strategy: "",
    epmo_pic_needed: "",
    epmo_pm_required: "",
    epmo_related_project: "",
    epmo_comments: "",
  });

  const [touched, setTouched] = useState(false);

  const isValid = form.epmo_strategy !== "" && form.epmo_pic_needed !== "";

  const updateForm = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (decision: string) => {
    if (!projectId) {
      alert("No active Project ID found.");
      return;
    }

    setTouched(true);

    if (decision === "Approve" && !isValid) {
      alert("Please fill in all mandatory fields before approving.");
      return;
    }

    setSubmitting(true);

    try {
      await projectsApi.submitDecision(
        projectId,
        "EPMO Review",
        decision,
        form.epmo_comments || "EPMO Review Completed via Dashboard.",
        form
      );
      
      if (onSuccess) {
        onSuccess();
      } else {
        alert("EPMO Review Successfully Submitted! Project routed to BTA.");
        navigate("/team-inbox");
      }
    } catch (err: any) {
      console.error(err);
      alert("Failed to submit EPMO decision: " + (err.message || "Unknown error"));
    } finally {
      setSubmitting(false);
    }
  };

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
              Please complete the checklist below to evaluate project alignment and governance readiness.
            </p>
          </div>
          <div className="flex items-center gap-2 border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 rounded-full text-emerald-300 text-[11px] font-bold tracking-wide">
            <span className="material-icons text-[14px]">check_circle</span>
            Ready for input
          </div>
        </div>

        <div className="space-y-4">
          {/* Card 1: Strategy */}
          <div className="flex flex-col md:flex-row md:items-center justify-between p-5 border border-white/10 rounded-xl hover:border-indigo-400/40 transition-colors bg-white/5 gap-4">
            <div className="flex items-start gap-4 flex-1">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/15 text-indigo-300 flex items-center justify-center shrink-0 border border-indigo-500/20">
                <span className="material-icons text-[24px]">track_changes</span>
              </div>
              <div>
                <h3 className="text-[14px] font-bold text-slate-100 mb-1">
                  Is aligned with strategy? <span className="text-red-500">*</span>
                </h3>
                <p className="text-[12px] text-slate-400 font-medium leading-relaxed">
                  Does this project align with organizational strategy and business objectives?
                </p>
                {touched && !form.epmo_strategy && <p className="text-xs text-red-400 mt-1">Required</p>}
              </div>
            </div>
            <div className="flex items-center gap-6 md:gap-14 shrink-0 mt-2 md:mt-0">
              <div className="flex items-center gap-8">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="radio"
                    name="epmo_strategy"
                    value="Yes"
                    checked={form.epmo_strategy === "Yes"}
                    onChange={(e) => updateForm("epmo_strategy", e.target.value)}
                    className="w-5 h-5 text-indigo-500 bg-transparent border-white/20 focus:ring-indigo-500 cursor-pointer accent-indigo-500"
                  />
                  <span className="text-[14px] font-bold text-slate-300 group-hover:text-indigo-400 transition-colors">Yes</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="radio"
                    name="epmo_strategy"
                    value="No"
                    checked={form.epmo_strategy === "No"}
                    onChange={(e) => updateForm("epmo_strategy", e.target.value)}
                    className="w-5 h-5 text-indigo-500 bg-transparent border-white/20 focus:ring-indigo-500 cursor-pointer accent-indigo-500"
                  />
                  <span className="text-[14px] font-bold text-slate-300 group-hover:text-indigo-400 transition-colors">No</span>
                </label>
              </div>
              <button
                type="button"
                className="w-9 h-9 rounded-lg border border-white/10 text-slate-500 hover:text-indigo-300 hover:border-indigo-400/40 hover:bg-indigo-500/10 flex items-center justify-center transition-all bg-white/5"
              >
                <span className="material-icons text-[18px]">chat_bubble_outline</span>
              </button>
            </div>
          </div>

          {/* Card 2: PIC */}
          <div className="flex flex-col md:flex-row md:items-center justify-between p-5 border border-white/10 rounded-xl hover:border-indigo-400/40 transition-colors bg-white/5 gap-4">
            <div className="flex items-start gap-4 flex-1">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/15 text-indigo-300 flex items-center justify-center shrink-0 border border-indigo-500/20">
                <span className="material-icons text-[24px]">groups</span>
              </div>
              <div>
                <h3 className="text-[14px] font-bold text-slate-100 mb-1">
                  PIC Needed? <span className="text-red-500">*</span>
                </h3>
                <p className="text-[12px] text-slate-400 font-medium leading-relaxed">
                  Is Project Investment Committee (PIC) approval required for this project?
                </p>
                {touched && !form.epmo_pic_needed && <p className="text-xs text-red-400 mt-1">Required</p>}
              </div>
            </div>
            <div className="flex items-center gap-6 md:gap-14 shrink-0 mt-2 md:mt-0">
              <div className="flex items-center gap-8">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="radio"
                    name="epmo_pic_needed"
                    value="Yes"
                    checked={form.epmo_pic_needed === "Yes"}
                    onChange={(e) => updateForm("epmo_pic_needed", e.target.value)}
                    className="w-5 h-5 text-indigo-500 bg-transparent border-white/20 focus:ring-indigo-500 cursor-pointer accent-indigo-500"
                  />
                  <span className="text-[14px] font-bold text-slate-300 group-hover:text-indigo-400 transition-colors">Yes</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="radio"
                    name="epmo_pic_needed"
                    value="No"
                    checked={form.epmo_pic_needed === "No"}
                    onChange={(e) => updateForm("epmo_pic_needed", e.target.value)}
                    className="w-5 h-5 text-indigo-500 bg-transparent border-white/20 focus:ring-indigo-500 cursor-pointer accent-indigo-500"
                  />
                  <span className="text-[14px] font-bold text-slate-300 group-hover:text-indigo-400 transition-colors">No</span>
                </label>
              </div>
              <button
                type="button"
                className="w-9 h-9 rounded-lg border border-white/10 text-slate-500 hover:text-indigo-300 hover:border-indigo-400/40 hover:bg-indigo-500/10 flex items-center justify-center transition-all bg-white/5"
              >
                <span className="material-icons text-[18px]">chat_bubble_outline</span>
              </button>
            </div>
          </div>

          {/* Card 3: PM */}
          <div className="flex flex-col md:flex-row md:items-center justify-between p-5 border border-white/10 rounded-xl hover:border-indigo-400/40 transition-colors bg-white/5 gap-4">
            <div className="flex items-start gap-4 flex-1">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/15 text-indigo-300 flex items-center justify-center shrink-0 border border-indigo-500/20">
                <span className="material-icons text-[24px]">person_outline</span>
              </div>
              <div>
                <h3 className="text-[14px] font-bold text-slate-100 mb-1">Is Project Manager Required?</h3>
                <p className="text-[12px] text-slate-400 font-medium leading-relaxed">
                  Do we need to assign a dedicated project manager for this initiative?
                </p>
              </div>
            </div>
            <div className="flex items-center gap-6 md:gap-14 shrink-0 mt-2 md:mt-0">
              <div className="flex items-center gap-8">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="radio"
                    name="epmo_pm_required"
                    value="Yes"
                    checked={form.epmo_pm_required === "Yes"}
                    onChange={(e) => updateForm("epmo_pm_required", e.target.value)}
                    className="w-5 h-5 text-indigo-500 bg-transparent border-white/20 focus:ring-indigo-500 cursor-pointer accent-indigo-500"
                  />
                  <span className="text-[14px] font-bold text-slate-300 group-hover:text-indigo-400 transition-colors">Yes</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="radio"
                    name="epmo_pm_required"
                    value="No"
                    checked={form.epmo_pm_required === "No"}
                    onChange={(e) => updateForm("epmo_pm_required", e.target.value)}
                    className="w-5 h-5 text-indigo-500 bg-transparent border-white/20 focus:ring-indigo-500 cursor-pointer accent-indigo-500"
                  />
                  <span className="text-[14px] font-bold text-slate-300 group-hover:text-indigo-400 transition-colors">No</span>
                </label>
              </div>
              <button
                type="button"
                className="w-9 h-9 rounded-lg border border-white/10 text-slate-500 hover:text-indigo-300 hover:border-indigo-400/40 hover:bg-indigo-500/10 flex items-center justify-center transition-all bg-white/5"
              >
                <span className="material-icons text-[18px]">chat_bubble_outline</span>
              </button>
            </div>
          </div>

          {/* Card 4: Related Project */}
          <div className="flex flex-col md:flex-row md:items-center justify-between p-5 border border-white/10 rounded-xl hover:border-indigo-400/40 transition-colors bg-white/5 gap-4">
            <div className="flex items-start gap-4 flex-1">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/15 text-indigo-300 flex items-center justify-center shrink-0 border border-indigo-500/20">
                <span className="material-icons text-[24px]">link</span>
              </div>
              <div>
                <h3 className="text-[14px] font-bold text-slate-100 mb-1">Related to Existing Project?</h3>
                <p className="text-[12px] text-slate-400 font-medium leading-relaxed">
                  Is this project related to or dependent on any existing projects or initiatives?
                </p>
              </div>
            </div>
            <div className="flex items-center gap-6 md:gap-14 shrink-0 mt-2 md:mt-0">
              <div className="flex items-center gap-8">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="radio"
                    name="epmo_related_project"
                    value="Yes"
                    checked={form.epmo_related_project === "Yes"}
                    onChange={(e) => updateForm("epmo_related_project", e.target.value)}
                    className="w-5 h-5 text-indigo-500 bg-transparent border-white/20 focus:ring-indigo-500 cursor-pointer accent-indigo-500"
                  />
                  <span className="text-[14px] font-bold text-slate-300 group-hover:text-indigo-400 transition-colors">Yes</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="radio"
                    name="epmo_related_project"
                    value="No"
                    checked={form.epmo_related_project === "No"}
                    onChange={(e) => updateForm("epmo_related_project", e.target.value)}
                    className="w-5 h-5 text-indigo-500 bg-transparent border-white/20 focus:ring-indigo-500 cursor-pointer accent-indigo-500"
                  />
                  <span className="text-[14px] font-bold text-slate-300 group-hover:text-indigo-400 transition-colors">No</span>
                </label>
              </div>
              <button
                type="button"
                className="w-9 h-9 rounded-lg border border-white/10 text-slate-500 hover:text-indigo-300 hover:border-indigo-400/40 hover:bg-indigo-500/10 flex items-center justify-center transition-all bg-white/5"
              >
                <span className="material-icons text-[18px]">chat_bubble_outline</span>
              </button>
            </div>
          </div>

          {/* Text Area */}
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

          {/* Footer Buttons */}
          <div className="flex justify-between items-center mt-10 pt-4 border-t border-slate-700/50">
            {/* Back Button */}
            <button
              type="button"
              onClick={() => navigate("/team-inbox")}
              className="px-5 py-2.5 rounded-lg border border-white/10 text-slate-300 font-bold text-[13px] hover:bg-white/10 flex items-center gap-2 transition-colors bg-white/5"
            >
              <span className="material-icons text-[16px]">arrow_back</span>
              Back
            </button>

            {/* Save & Continue Button */}
            <button
              type="button"
              disabled={!isValid || submitting}
              onClick={() => handleSubmit("Approve")}
              className="px-6 py-2.5 rounded-lg bg-[#533BED] hover:bg-[#432BC2] text-white font-bold text-[13px] flex items-center gap-2 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Saving..." : "Save & Continue"}
              {!submitting && <span className="material-icons text-[16px]">arrow_forward</span>}
              {submitting && <span className="material-icons text-[16px] animate-spin">refresh</span>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
