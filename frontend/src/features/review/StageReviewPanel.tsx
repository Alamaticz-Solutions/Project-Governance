import { useState } from "react";
import { Button, Card, TextArea } from "../../components/ui";
import { ApiError } from "../../lib/apiClient";
import { projectsApi } from "../../lib/api";
import type { PendingApprovalItem } from "../../lib/types";

/** Single reusable decision panel for every governance stage (EPMO, BTA,
 * Finance, EAC, PIC, Gate Review) — the legacy Angular app hand-rolled a
 * near-identical wizard per stage; this component covers the one action
 * that's actually load-bearing across all of them: submit-decision. */
export function StageReviewPanel({
  task,
  onDecided,
}: {
  task: PendingApprovalItem;
  onDecided: () => void;
}) {
  const [comments, setComments] = useState("");
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: string) {
    setSubmitting(decision);
    setError(null);
    try {
      await projectsApi.submitDecision(task.projectId, task.type, decision, comments);
      onDecided();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to submit decision");
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <Card className="mt-3 border-indigo-200">
      <h3 className="font-medium mb-1">{task.projectName}</h3>
      <p className="text-xs text-slate-500 mb-4">
        {task.projectNumber} &middot; {task.type} &middot; submitted by {task.submittedBy}
      </p>

      <TextArea label="Comments" value={comments} onChange={(e) => setComments(e.target.value)} />

      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}

      <div className="flex gap-2 mt-4">
        <Button variant="primary" disabled={!!submitting} onClick={() => decide("approve")}>
          {submitting === "approve" ? "Approving…" : "Approve"}
        </Button>
        <Button variant="secondary" disabled={!!submitting} onClick={() => decide("need more information")}>
          Need More Information
        </Button>
        <Button variant="danger" disabled={!!submitting} onClick={() => decide("reject")}>
          Reject
        </Button>
      </div>
    </Card>
  );
}
