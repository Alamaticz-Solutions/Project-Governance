import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

const API_URL = environment.apiUrl;

export interface GatewayChecklistItem {
  result_id: string;
  template_id: string;
  sequence_order: number;
  gate_name: string;
  gate_owner: string;
  checklist_item: string;
  gate_description?: string;
  status: string;
  comments?: string;
  is_completed: boolean;
  completed_by_name?: string;
  completion_date?: string;
  can_edit: boolean;
}

export interface GatewayChecklistUpdate {
  status: 'Approved' | 'Not Approved';
  comments?: string;
}

@Injectable({ providedIn: 'root' })
export class GatewayChecklistService {
  constructor(private http: HttpClient) {}

  getChecklist(projectId: string, team: string): Observable<GatewayChecklistItem[]> {
    return this.http.get<GatewayChecklistItem[]>(`${API_URL}/gateway-checklist/${projectId}`, {
      params: { team }
    });
  }

  updateChecklistItem(resultId: string, payload: GatewayChecklistUpdate): Observable<GatewayChecklistItem> {
    return this.http.patch<GatewayChecklistItem>(`${API_URL}/gateway-checklist/results/${resultId}`, payload);
  }
}
