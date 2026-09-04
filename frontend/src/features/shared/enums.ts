// Option lists mirrored from .appfw/model/schemas/governance/gql_enum_types/*.
// Values are the SCREAMING_SNAKE enum members the API expects; labels are the
// captions from the model.

export type Option = { value: string; label: string };

export const PROJECT_STATUS: Option[] = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'ON_HOLD', label: 'On Hold' },
  { value: 'IN_DELIVERY', label: 'In Delivery' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'ARCHIVED', label: 'Archived' }
];

export const PROJECT_PRIORITY: Option[] = [
  { value: 'CRITICAL', label: 'Critical' },
  { value: 'HIGH', label: 'High' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'LOW', label: 'Low' }
];

export const PROJECT_RISK: Option[] = [
  { value: 'VERY_HIGH', label: 'Very High' },
  { value: 'HIGH', label: 'High' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'LOW', label: 'Low' }
];

export const APPROVAL_DECISION: Option[] = [
  { value: 'APPROVED', label: 'Approve' },
  { value: 'REJECTED', label: 'Reject' },
  { value: 'NEEDS_INFO', label: 'Needs info' },
  { value: 'DEFERRED', label: 'Defer' }
];

export const NOTIFICATION_TYPE: Option[] = [
  { value: 'PROJECT_CREATED', label: 'Project created' },
  { value: 'TASK_ASSIGNED', label: 'Task assigned' },
  { value: 'TASK_COMPLETED', label: 'Task completed' },
  { value: 'APPROVAL_REQUIRED', label: 'Approval required' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'OVERDUE', label: 'Overdue' },
  { value: 'STAGE_ADVANCED', label: 'Stage advanced' },
  { value: 'COMMENT_ADDED', label: 'Comment added' }
];

