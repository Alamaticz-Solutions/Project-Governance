import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { Badge, Card, PageHeader, StateView } from "../../components/ui";
import { projectsApi } from "../../lib/api";
import type { Project } from "../../lib/types";

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    projectsApi
      .get(id)
      .then(setProject)
      .catch((e) => setError(e.message));
  }, [id]);

  if (error) return <StateView label={`Failed to load project: ${error}`} />;
  if (!project) return <StateView label="Loading project…" />;

  const fields: [string, string | number | null | undefined][] = [
    ["Business Unit", project.business_unit],
    ["Department", project.department],
    ["Sponsor", project.sponsor_name],
    ["Project Manager", project.project_manager?.full_name],
    ["Budget (Estimated)", project.budget_estimated ? `$${project.budget_estimated.toLocaleString()}` : null],
    ["Risk Level", project.risk_level],
    ["Current Owner", project.current_owner_role],
    ["Workflow Status", project.workflow_status],
  ];

  return (
    <div>
      <PageHeader
        title={project.project_name}
        subtitle={project.project_number}
        actions={
          <Link
            to={`/projects/${project.id}/workspace`}
            className="brand-gradient text-white text-sm px-4 py-2 rounded-lg"
          >
            Open Governance Workspace
          </Link>
        }
      />

      <div className="flex gap-2 mb-6">
        <Badge label={project.status} />
        <Badge label={project.priority} />
        {project.current_stage && <Badge label={project.current_stage} />}
      </div>

      <div className="grid grid-cols-2 gap-6">
        <Card>
          <h2 className="font-medium mb-3">Project Details</h2>
          <dl className="space-y-2 text-sm">
            {fields.map(([label, value]) => (
              <div key={label} className="flex justify-between border-b last:border-0 py-1.5">
                <dt className="text-slate-500">{label}</dt>
                <dd className="font-medium">{value ?? "—"}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card>
          <h2 className="font-medium mb-3">Problem &amp; Outcome</h2>
          <p className="text-sm text-slate-600 whitespace-pre-wrap">
            {project.problem_statement || "No problem statement provided."}
          </p>
          <h3 className="font-medium mt-4 mb-1 text-sm">Desired Outcome</h3>
          <p className="text-sm text-slate-600 whitespace-pre-wrap">
            {project.desired_outcome || "—"}
          </p>
        </Card>
      </div>
    </div>
  );
}
