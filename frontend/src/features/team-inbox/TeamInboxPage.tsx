import { useEffect, useState } from "react";
import { Badge, Card, PageHeader, StateView } from "../../components/ui";
import { StageReviewPanel } from "../review/StageReviewPanel";
import { projectsApi } from "../../lib/api";
import type { PendingApprovalItem } from "../../lib/types";

export function TeamInboxPage() {
  const [tasks, setTasks] = useState<PendingApprovalItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  function load() {
    projectsApi
      .pendingApprovals()
      .then(setTasks)
      .catch((e) => setError(e.message));
  }

  useEffect(load, []);

  return (
    <div>
      <PageHeader title="Team Inbox" subtitle="Tasks waiting on your review" />

      {error && <StateView label={`Failed to load tasks: ${error}`} />}
      {!tasks && !error && <StateView label="Loading tasks…" />}
      {tasks && tasks.length === 0 && <StateView label="You're all caught up!" />}

      <div className="space-y-3">
        {tasks?.map((task) => (
          <div key={task.id}>
            <Card
              className="cursor-pointer hover:border-indigo-300"
              onClick={() => setOpenId(openId === task.id ? null : task.id)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{task.projectName}</div>
                  <div className="text-xs text-slate-500">
                    {task.projectNumber} &middot; {task.type}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge label={task.priority} />
                  <span className="text-xs text-slate-400">{task.submittedDate}</span>
                </div>
              </div>
            </Card>
            {openId === task.id && (
              <StageReviewPanel
                task={task}
                onDecided={() => {
                  setOpenId(null);
                  load();
                }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
