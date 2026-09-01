export type UserRole =
  | "admin"
  | "project_manager"
  | "bta"
  | "epmo"
  | "finance"
  | "vendor_screening"
  | "analysis_team"
  | "eac"
  | "cab"
  | "security"
  | "taf"
  | "trc"
  | "pic"
  | "viewer";

export interface User {
  id: string;
  email: string;
  username: string;
  full_name: string;
  role: UserRole;
  department?: string | null;
  job_title?: string | null;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
}

export interface ProjectManagerSummary {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

export interface Project {
  id: string;
  project_number: string;
  project_name: string;
  business_unit: string;
  department?: string | null;
  requestor_name?: string | null;
  request_type?: string | null;
  strategic_alignment?: string | null;
  sponsor_name?: string | null;
  sponsor_email?: string | null;
  description?: string | null;
  problem_statement?: string | null;
  desired_outcome?: string | null;
  what_do_you_do_today?: string | null;
  what_transpires_if_nothing?: string | null;
  notes?: string | null;
  business_value?: string | null;
  budget_estimated?: number | null;
  budget_approved?: number | null;
  budget_type?: string | null;
  priority: string;
  risk_level?: string | null;
  status: string;
  it_involvement: boolean;
  vendor_required: boolean;
  has_phi_data: boolean;
  is_clinical: boolean;
  is_hipaa_applicable: boolean;
  requested_start_date?: string | null;
  requested_end_date?: string | null;
  submitted_at?: string | null;
  current_stage?: string | null;
  current_status?: string | null;
  current_owner_role?: string | null;
  last_stage_completed?: string | null;
  workflow_status?: string | null;
  created_at: string;
  updated_at?: string | null;
  ai_extracted_data?: Record<string, unknown> | null;
  project_manager?: ProjectManagerSummary | null;
}

export interface ProjectListResponse {
  items: Project[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface PendingApprovalItem {
  id: string;
  projectId: string;
  projectNumber: string;
  projectName: string;
  type: string;
  priority: string;
  submittedBy: string;
  submittedDate: string;
  status: string;
  approvalId: string;
  projectData: Record<string, unknown>;
}

export interface DashboardResponse {
  active_projects: number;
  completed_projects: number;
  on_hold_projects: number;
  total_projects: number;
  status_breakdown: Record<string, number>;
  priority_breakdown: Record<string, number>;
  high_risk_count: number;
  recent_gate_reviews: GateReview[];
  my_pending_tasks: PendingApprovalItem[];
}

export interface GateReview {
  id: string;
  project_id: string;
  gate_code: string;
  gate_name: string;
  committee?: string | null;
  status?: string | null;
  decision?: string | null;
  submitted_at?: string | null;
}

export interface NotificationItem {
  id: string;
  project_id?: string | null;
  notification_type: string;
  title: string;
  message: string;
  action_url?: string | null;
  is_read: boolean;
  created_at?: string | null;
}

export interface GateSubmission {
  stage: string;
  status: string;
  decision: string | null;
  data: Record<string, unknown>;
  submitted_at?: string | null;
}

export interface WorkspaceResponse {
  project: Project;
  stage_order: string[];
  submissions: GateSubmission[];
}
