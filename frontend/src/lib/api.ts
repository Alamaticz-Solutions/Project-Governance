import { apiRequest } from "./apiClient";
import type {
  DashboardResponse,
  NotificationItem,
  PendingApprovalItem,
  Project,
  ProjectListResponse,
  TokenResponse,
  WorkspaceResponse,
} from "./types";

export const authApi = {
  login: (email: string, password: string) =>
    apiRequest<TokenResponse>("/auth/login", { method: "POST", body: { email, password } }),
  register: (payload: {
    email: string;
    username: string;
    full_name: string;
    password: string;
    department?: string;
    job_title?: string;
  }) => apiRequest("/auth/register", { method: "POST", body: payload }),
};

export const projectsApi = {
  list: (params: Record<string, string | number | undefined> = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== "") query.set(k, String(v));
    });
    return apiRequest<ProjectListResponse>(`/projects?${query.toString()}`);
  },
  get: (idOrNumber: string) => apiRequest<Project>(`/projects/${idOrNumber}`),
  create: (payload: Record<string, unknown>) =>
    apiRequest<Project>("/projects", { method: "POST", body: payload }),
  update: (id: string, payload: Record<string, unknown>) =>
    apiRequest<Project>(`/projects/${id}`, { method: "PATCH", body: payload }),
  pendingApprovals: () => apiRequest<PendingApprovalItem[]>("/projects/approvals/pending"),
  submitDecision: (
    id: string,
    stage: string,
    decision: string,
    comments?: string,
    projectUpdates?: Record<string, unknown>
  ) =>
    apiRequest<Project>(`/projects/${id}/submit-decision`, {
      method: "POST",
      body: { stage, decision, comments, project_updates: projectUpdates },
    }),
  extractIntake: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return apiRequest<{ success: boolean; data: Record<string, string> }>("/projects/extract-intake", {
      method: "POST",
      body: form,
      isForm: true,
    });
  },
  sendIntakeEmail: (projectId: string, email: string, data: Record<string, unknown>) =>
    apiRequest("/projects/send-intake-email", {
      method: "POST",
      body: { project_id: projectId, email, data },
    }),
};

export const workspaceApi = {
  get: (projectId: string) => apiRequest<WorkspaceResponse>(`/projects/${projectId}/workspace`),
  saveStage: (
    projectId: string,
    stage: string,
    payload: { data: Record<string, unknown>; decision?: string; advance: boolean }
  ) =>
    apiRequest<WorkspaceResponse>(`/projects/${projectId}/workspace/${stage}`, {
      method: "POST",
      body: payload,
    }),
};

export const dashboardApi = {
  get: () => apiRequest<DashboardResponse>("/dashboard"),
};

export const notificationsApi = {
  list: () => apiRequest<NotificationItem[]>("/notifications"),
  markAllRead: () => apiRequest("/notifications/mark-all-read", { method: "POST" }),
};
