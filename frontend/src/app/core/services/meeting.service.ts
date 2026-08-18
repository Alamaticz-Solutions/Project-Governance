import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';

import { environment } from '../../../environments/environment';

const API_URL = environment.apiUrl;

export interface ActionItem {
  text: string;
  assignee: string;
}

export interface AgendaItem {
  project: string;
  department: string | null;
}

export interface MeetingArtifact {
  id: string;
  file_name: string;
  file_type: string;
  s3_url: string | null;
  transcript: string | null;
  processing_status: string;
  error_message: string | null;
  uploaded_at: string | null;
}

export interface SessionFinding {
  finding_type: string;
  description: string;
  speaker: string;
}

export interface ProcessObservation {
  capability_area: string;
  bpmn_file_affected: string | null;
  observation: string;
  diverges_from_normative: string;
}

export interface StakeholderStatement {
  speaker: string;
  topic_tag: string;
  paraphrase: string;
  transcript_timestamp: string | null;
}

export interface AnalystNotes {
  session_quality: string;
  session_quality_reason: string;
  stakeholder_candor: string;
  group_dynamics: string | null;
  follow_up_recommended: boolean;
  follow_up_reason: string | null;
  methodological_flags: string | null;
}

export interface SessionDependency {
  dependency: string;
  dependency_type: string;
  action: string;
}

export interface SessionSynthesis {
  participants: string[];
  session_purpose: string;
  deferred_items: string[];
  unexpected_findings: string[];
  findings: SessionFinding[];
  process_observations: ProcessObservation[];
  stakeholder_voice: StakeholderStatement[];
  analyst_notes: AnalystNotes;
  next_session_dependencies: SessionDependency[];
}

export interface Meeting {
  id: string;
  title: string;
  meeting_type: string | null;
  meeting_date: string | null;
  meeting_time: string | null;
  status: string;
  summary: string | null;
  decisions: string[];
  action_items: ActionItem[];
  agenda_items: AgendaItem[];
  contains_process_flow: boolean;
  process_name: string | null;
  bpmn_xml: string | null;
  bpmn_status: string | null;
  session_synthesis: SessionSynthesis | null;
  session_synthesis_markdown: string | null;
  session_synthesis_status: string;
  project_id: string | null;
  project_number: string | null;
  project_name: string | null;
  artifacts: MeetingArtifact[];
  created_at: string | null;
}

export interface QuoteEntry {
  id: string;
  meeting_id: string;
  meeting_title: string;
  meeting_date: string | null;
  speaker: string;
  topic_tag: string;
  paraphrase: string;
  transcript_timestamp: string | null;
  corroborating_speakers: string[];
  created_at: string;
}

export interface TopicSummary {
  topic_tag: string;
  speakers: string[];
  entry_count: number;
  is_convergent: boolean;
}

export interface QuoteIndexResponse {
  items: QuoteEntry[];
  total: number;
  topics: TopicSummary[];
  speakers: string[];
}

export interface TrackerItem {
  id: string;
  meeting_id: string;
  meeting_title: string;
  meeting_date: string | null;
  item_type: string;
  description: string;
  speaker: string;
  created_at: string;
}

export interface TrackerGroupSummary {
  item_type: string;
  count: number;
}

export interface TrackerResponse {
  items: TrackerItem[];
  total: number;
  counts_by_type: TrackerGroupSummary[];
}

@Injectable({ providedIn: 'root' })
export class MeetingService {
  constructor(private http: HttpClient) {}

  // Root-scoped cache of the unfiltered meeting list — a routed component gets destroyed
  // and recreated on every navigation, so without this, opening the global Meeting Center
  // a second time re-triggers a full "loading" state even though nothing changed. Consumers
  // read allMeetingsCache() synchronously for an instant render, then call
  // refreshAllMeetings() to pick up anything created elsewhere since the last fetch.
  private allMeetingsCacheSignal = signal<Meeting[] | null>(null);
  readonly allMeetingsCache = this.allMeetingsCacheSignal.asReadonly();

  refreshAllMeetings(): Observable<Meeting[]> {
    return this.listMeetings().pipe(
      map(res => res.items),
      tap(items => this.allMeetingsCacheSignal.set(items))
    );
  }

  listMeetings(projectId?: string): Observable<{ items: Meeting[]; total: number }> {
    return this.http.get<{ items: Meeting[]; total: number }>(`${API_URL}/meetings`, {
      params: this.cleanParams({ project_id: projectId }),
    });
  }

  linkToProject(meetingId: string, projectId: string): Observable<Meeting> {
    return this.http.post<Meeting>(`${API_URL}/meetings/${meetingId}/link-project`, { project_id: projectId });
  }

  unlinkFromProject(meetingId: string): Observable<Meeting> {
    return this.http.post<Meeting>(`${API_URL}/meetings/${meetingId}/unlink-project`, {});
  }

  getMeeting(id: string): Observable<Meeting> {
    return this.http.get<Meeting>(`${API_URL}/meetings/${id}`);
  }

  createMeeting(payload: { title: string; meeting_type?: string; meeting_date?: string; meeting_time?: string; project_id?: string }): Observable<Meeting> {
    return this.http.post<Meeting>(`${API_URL}/meetings`, payload);
  }

  uploadArtifact(meetingId: string, file: File): Observable<Meeting> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<Meeting>(`${API_URL}/meetings/${meetingId}/upload`, formData);
  }

  approveSynthesis(meetingId: string): Observable<Meeting> {
    return this.http.post<Meeting>(`${API_URL}/meetings/${meetingId}/approve-synthesis`, {});
  }

  private cleanParams(params: Record<string, string | boolean | undefined>): Record<string, string> {
    const cleaned: Record<string, string> = {};
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        cleaned[key] = String(value);
      }
    }
    return cleaned;
  }

  getQuoteIndex(params: { speaker?: string; topic_tag?: string; meeting_id?: string; project_id?: string; convergent_only?: boolean } = {}): Observable<QuoteIndexResponse> {
    return this.http.get<QuoteIndexResponse>(`${API_URL}/meetings/quote-index`, { params: this.cleanParams(params) });
  }

  getTracker(params: { item_type?: string; speaker?: string; meeting_id?: string; project_id?: string } = {}): Observable<TrackerResponse> {
    return this.http.get<TrackerResponse>(`${API_URL}/meetings/tracker`, { params: this.cleanParams(params) });
  }
}
