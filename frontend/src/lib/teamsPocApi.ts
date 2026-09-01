import { apiRequest } from "./apiClient";

export interface PocActionItem {
  text: string;
  assignee: string;
}

export interface PocAgendaItem {
  project: string;
  department: string | null;
}

export interface PocMeeting {
  id: string;
  subject: string;
  source: "local_stub" | "flow_scheduled" | "flow_ingest" | "manual_ingest";
  status: "scheduled" | "processing" | "completed" | "failed" | "cancelled";
  start_time: string | null;
  end_time: string | null;
  organizer_email: string | null;
  external_ref: string | null;
  join_url: string | null;
  transcript_text: string | null;
  summary: string | null;
  decisions: string[];
  action_items: PocActionItem[];
  agenda_items: PocAgendaItem[];
  contains_process_flow: boolean;
  process_name: string | null;
  bpmn_xml: string | null;
  bpmn_status: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string | null;
}

export const teamsPocApi = {
  list: () => apiRequest<PocMeeting[]>("/teams-poc/meetings"),
  get: (id: string) => apiRequest<PocMeeting>(`/teams-poc/meetings/${id}`),
  schedule: (payload: {
    subject: string;
    start_time: string;
    end_time: string;
    organizer_email?: string;
  }) => apiRequest<PocMeeting>("/teams-poc/meetings", { method: "POST", body: payload }),
  ingestTranscript: (id: string, vttText: string) =>
    apiRequest<PocMeeting>(`/teams-poc/meetings/${id}/ingest-transcript`, {
      method: "POST",
      body: { vtt_text: vttText },
    }),
  remove: (id: string) =>
    apiRequest<void>(`/teams-poc/meetings/${id}`, { method: "DELETE" }),
  cancel: (id: string) =>
    apiRequest<PocMeeting>(`/teams-poc/meetings/${id}/cancel`, { method: "POST" }),
};
