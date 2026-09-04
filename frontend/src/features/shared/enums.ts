// Option lists mirrored from .appfw/model/schemas/governance/gql_enum_types/*.
//
// The model authors SCREAMING_SNAKE enum members, but the generated GraphQL
// schema (async-graphql's default enum rename) exposes them as PascalCase —
// confirmed against the live schema via introspection (`__type(name: "...")
// { enumValues { name } }`). These option lists use the wire values, not the
// model's authoring casing. This resolves open decision Q7 empirically.
export type Option = { value: string; label: string };

export const PROJECT_STATUS: Option[] = [
  { value: 'Draft', label: 'Draft' },
  { value: 'Active', label: 'Active' },
  { value: 'OnHold', label: 'On Hold' },
  { value: 'InDelivery', label: 'In Delivery' },
  { value: 'Completed', label: 'Completed' },
  { value: 'Cancelled', label: 'Cancelled' },
  { value: 'Archived', label: 'Archived' }
];

export const PROJECT_PRIORITY: Option[] = [
  { value: 'Critical', label: 'Critical' },
  { value: 'High', label: 'High' },
  { value: 'Medium', label: 'Medium' },
  { value: 'Low', label: 'Low' }
];

export const PROJECT_RISK: Option[] = [
  { value: 'VeryHigh', label: 'Very High' },
  { value: 'High', label: 'High' },
  { value: 'Medium', label: 'Medium' },
  { value: 'Low', label: 'Low' }
];

// `WorkflowStage.status` (the real WorkflowStageStatus GraphQL enum, PascalCase
// wire values). Used by the workspace screen's per-stage transition guards.
export const WORKFLOW_STAGE_STATUS = {
  LOCKED: 'Locked',
  ELIGIBLE: 'Eligible',
  IN_PROGRESS: 'InProgress',
  PENDING_APPROVAL: 'PendingApproval',
  APPROVED: 'Approved',
  CHANGES_REQUESTED: 'ChangesRequested',
  REJECTED: 'Rejected',
  SKIPPED: 'Skipped'
} as const;

// `decision` payload text for the submit_decision / decide custom methods.
// These are NOT the ApprovalDecision GraphQL enum — the service lowercases and
// pattern-matches this string itself (approval_state_machine::submit_decision,
// gate_review::decide), so the values here stay lowercase-matchable regardless
// of wire enum casing.
export const APPROVAL_DECISION: Option[] = [
  { value: 'APPROVED', label: 'Approve' },
  { value: 'REJECTED', label: 'Reject' },
  { value: 'NEEDS_INFO', label: 'Needs info / return' }
];

export const NOTIFICATION_TYPE: Option[] = [
  { value: 'ProjectCreated', label: 'Project created' },
  { value: 'TaskAssigned', label: 'Task assigned' },
  { value: 'TaskCompleted', label: 'Task completed' },
  { value: 'ApprovalRequired', label: 'Approval required' },
  { value: 'Approved', label: 'Approved' },
  { value: 'Rejected', label: 'Rejected' },
  { value: 'Overdue', label: 'Overdue' },
  { value: 'StageAdvanced', label: 'Stage advanced' },
  { value: 'CommentAdded', label: 'Comment added' }
];
