import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

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
  artifacts: MeetingArtifact[];
  created_at: string | null;
}

@Injectable({ providedIn: 'root' })
export class MeetingService {
  constructor(private http: HttpClient) {}

  listMeetings(): Observable<{ items: Meeting[]; total: number }> {
    return this.http.get<{ items: Meeting[]; total: number }>(`${API_URL}/meetings`);
  }

  getMeeting(id: string): Observable<Meeting> {
    return this.http.get<Meeting>(`${API_URL}/meetings/${id}`);
  }

  createMeeting(payload: { title: string; meeting_type?: string; meeting_date?: string; meeting_time?: string }): Observable<Meeting> {
    return this.http.post<Meeting>(`${API_URL}/meetings`, payload);
  }

  uploadArtifact(meetingId: string, file: File): Observable<Meeting> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<Meeting>(`${API_URL}/meetings/${meetingId}/upload`, formData);
  }
}
