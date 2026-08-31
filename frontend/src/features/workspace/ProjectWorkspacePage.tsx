import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { workspaceApi } from "../../lib/api";
import { ApiError } from "../../lib/apiClient";
import type { WorkspaceResponse } from "../../lib/types";
import "./workspace.css";

import { SraDfdPanel, SRA_DFD_DEFAULTS, type SraDfdData } from "./panels/SraDfdPanel";
import { VcrVraPanel, VCR_VRA_DEFAULTS, type VcrVraData } from "./panels/VcrVraPanel";
import { EacPanel, EAC_DEFAULTS, type EacData } from "./panels/EacPanel";
import { TrcPanel, TRC_DEFAULTS, type TrcData } from "./panels/TrcPanel";
import { CabPanel, CAB_DEFAULTS, type CabData } from "./panels/CabPanel";
import { StRunbookPanel, ST_RUNBOOK_DEFAULTS, type StRunbookData } from "./panels/StRunbookPanel";
import { PicPanel, PIC_DEFAULTS, type PicData } from "./panels/PicPanel";

const GATES = [
  { name: "Intake", stages: ["intake"] },
  { name: "Review", stages: ["sra_dfd", "vcr_vra"] },
  { name: "Design", stages: ["eac", "trc"] },
  { name: "Operations", stages: ["cab", "st_runbook"] },
  { name: "Stakeholders", stages: ["pic"] },
];

const STAGE_LABEL: Record<string, string> = {
  intake: "Intake",
  sra_dfd: "SRA / DFD",
  vcr_vra: "VCR / VRA",
  eac: "EAC Review",
  trc: "TRC Review",
  cab: "CAB Change Ticket",
  st_runbook: "ST-Runbook",
  pic: "PIC Review",
};

type StageData = {
  sra_dfd: SraDfdData;
  vcr_vra: VcrVraData;
  eac: EacData;
  trc: TrcData;
  cab: CabData;
  st_runbook: StRunbookData;
  pic: PicData;
};

const STAGE_DEFAULTS: StageData = {
  sra_dfd: SRA_DFD_DEFAULTS,
  vcr_vra: VCR_VRA_DEFAULTS,
  eac: EAC_DEFAULTS,
  trc: TRC_DEFAULTS,
  cab: CAB_DEFAULTS,
  st_runbook: ST_RUNBOOK_DEFAULTS,
  pic: PIC_DEFAULTS,
};

export function ProjectWorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [ws, setWs] = useState<WorkspaceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [viewStage, setViewStage] = useState<string | null>(null);
  const [stageData, setStageData] = useState<StageData>(STAGE_DEFAULTS);
  const [decisions, setDecisions] = useState<Record<string, string | null>>({});

  useEffect(() => {
    if (!id) return;
    workspaceApi
      .get(id)
      .then((res) => {
        setWs(res);
        setViewStage(res.project.current_stage ?? "sra_dfd");
        const nextData = { ...STAGE_DEFAULTS };
        const nextDecisions: Record<string, string | null> = {};
        for (const sub of res.submissions) {
          if (sub.stage in nextData) {
            (nextData as any)[sub.stage] = { ...(nextData as any)[sub.stage], ...sub.data };
          }
          nextDecisions[sub.stage] = sub.decision;
        }
        setStageData(nextData);
        setDecisions(nextDecisions);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  if (error) return <div className="p-6 text-red-600">Failed to load workspace: {error}</div>;
  if (!ws || !viewStage) return <div className="p-6">Loading workspace…</div>;

  const currentStage = ws.project.current_stage ?? "sra_dfd";
  const isComplete = currentStage === "complete";
  const currentIdx = ws.stage_order.indexOf(currentStage);
  const viewIdx = ws.stage_order.indexOf(viewStage);
  const gateIndexForStage = (stage: string) => GATES.findIndex((g) => g.stages.includes(stage));

  async function handleSaveContinue() {
    const stage = viewStage;
    if (!id || !stage || stage === "intake" || viewIdx === -1) return;
    setSaving(true);
    setError(null);
    try {
      const res = await workspaceApi.saveStage(id, stage, {
        data: (stageData as any)[stage],
        decision: decisions[stage] ?? undefined,
        advance: true,
      });
      setWs(res);
      setViewStage(res.project.current_stage ?? viewStage);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  function patchStage<K extends keyof StageData>(stage: K, patch: Partial<StageData[K]>) {
    setStageData((prev) => ({ ...prev, [stage]: { ...prev[stage], ...patch } }));
  }

  function renderPanel() {
    if (isComplete || viewStage === "complete") {
      return (
        <div className="gw-complete">
          <div className="gw-check">✓</div>
          <h2>All governance gates cleared</h2>
          <p>Intake → SRA/DFD → VCR/VRA → EAC → TRC → CAB → ST-Runbook → PIC — every gate logged with who approved what, and when.</p>
        </div>
      );
    }
    switch (viewStage) {
      case "sra_dfd":
        return (
          <SraDfdPanel
            data={stageData.sra_dfd}
            onChange={(p) => patchStage("sra_dfd", p)}
            decision={decisions.sra_dfd ?? null}
            onDecision={(d) => setDecisions((p) => ({ ...p, sra_dfd: d }))}
          />
        );
      case "vcr_vra":
        return <VcrVraPanel data={stageData.vcr_vra} onChange={(p) => patchStage("vcr_vra", p)} />;
      case "eac":
        return (
          <EacPanel
            data={stageData.eac}
            onChange={(p) => patchStage("eac", p)}
            decision={decisions.eac ?? null}
            onDecision={(d) => setDecisions((p) => ({ ...p, eac: d }))}
          />
        );
      case "trc":
        return (
          <TrcPanel
            data={stageData.trc}
            onChange={(p) => patchStage("trc", p)}
            decision={decisions.trc ?? null}
            onDecision={(d) => setDecisions((p) => ({ ...p, trc: d }))}
          />
        );
      case "cab":
        return <CabPanel data={stageData.cab} onChange={(p) => patchStage("cab", p)} />;
      case "st_runbook":
        return <StRunbookPanel data={stageData.st_runbook} onChange={(p) => patchStage("st_runbook", p)} />;
      case "pic":
        return (
          <PicPanel
            data={stageData.pic}
            onChange={(p) => patchStage("pic", p)}
            decision={decisions.pic ?? null}
            onDecision={(d) => setDecisions((p) => ({ ...p, pic: d }))}
          />
        );
      default:
        return null;
    }
  }

  const isViewingCurrent = viewStage === currentStage;
  const owner = STAGE_LABEL[currentStage] ?? currentStage;

  return (
    <div className="gov-workspace" style={{ minHeight: "calc(100vh - 120px)" }}>
      <nav className="gw-gatenav">
        <div className="gw-gatenav-title">{ws.project.project_number} · Gates</div>
        {GATES.map((gate, gi) => {
          const allDone = gate.stages.every((s) => {
            const idx = ws.stage_order.indexOf(s);
            return s === "intake" || (idx !== -1 && idx < currentIdx) || isComplete;
          });
          const isCurrentGate = gate.stages.includes(currentStage);
          return (
            <div key={gate.name} className={`gw-gate ${allDone ? "done" : isCurrentGate ? "current" : ""}`}>
              <div className="gw-gate-head">
                <span className="gw-gdot">{allDone ? "✓" : gi + 1}</span>
                {gate.name}
              </div>
              <div className="gw-sub">
                {gate.stages.map((s) => {
                  const idx = ws.stage_order.indexOf(s);
                  const done = s === "intake" || (idx !== -1 && idx < currentIdx) || isComplete;
                  const reachable = s === "intake" || idx <= currentIdx || isComplete;
                  return (
                    <button
                      key={s}
                      className={`gw-subitem ${viewStage === s ? "active" : ""}`}
                      disabled={!reachable}
                      style={{ opacity: reachable ? 1 : 0.4, cursor: reachable ? "pointer" : "not-allowed" }}
                      onClick={() => reachable && setViewStage(s)}
                    >
                      <span>{STAGE_LABEL[s]}</span>
                      {done && <span className="chk">✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="gw-main">
        <div className="gw-stepper">
          {GATES.map((gate, gi) => {
            const allDone = gate.stages.every((s) => {
              const idx = ws.stage_order.indexOf(s);
              return s === "intake" || (idx !== -1 && idx < currentIdx) || isComplete;
            });
            const isCurrent = gate.stages.includes(currentStage);
            return (
              <div key={gate.name} style={{ display: "flex", alignItems: "center" }}>
                <div className={`gw-step ${allDone ? "done" : isCurrent ? "current" : ""}`}>
                  <div className="gw-circle">{allDone ? "✓" : gi + 1}</div>
                  <div className="gw-label">{gate.name}</div>
                </div>
                {gi < GATES.length - 1 && <div className={`gw-step-line ${allDone ? "done" : ""}`} />}
              </div>
            );
          })}
        </div>

        {!isComplete && viewStage !== "intake" && (
          <div className="gw-head">
            <div>
              <div className="gw-eyebrow">
                Gate {gateIndexForStage(viewStage) + 1} · {GATES[gateIndexForStage(viewStage)]?.name}
              </div>
              <h2>{STAGE_LABEL[viewStage]}</h2>
            </div>
            <span className="gw-owner-chip">Owner: {owner}</span>
          </div>
        )}

        {renderPanel()}

        {!isComplete && isViewingCurrent && viewStage !== "intake" && (
          <div className="gw-footer">
            <span className="gw-save-hint">{saving ? "Saving…" : "Not yet saved"}</span>
            <button className="gw-btn-primary" disabled={saving} onClick={handleSaveContinue}>
              {saving ? "Saving…" : currentStage === "pic" ? "Complete PIC review →" : "Save & continue →"}
            </button>
          </div>
        )}

        {isComplete && (
          <div className="gw-footer" style={{ justifyContent: "center", border: "none" }}>
            <button className="gw-btn-primary" onClick={() => navigate("/projects")}>
              Back to projects
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
