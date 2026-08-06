import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { GateReview } from '../models/models';

import { environment } from '../../environments/environment';

const API_URL = environment.apiUrl;

@Injectable({ providedIn: 'root' })
export class GateReviewService {
  constructor(private http: HttpClient) {}

  getGateReviews(): Observable<GateReview[]> {
    return this.http.get<GateReview[]>(`${API_URL}/gate-reviews`);
  }

  getGateReview(id: string): Observable<GateReview> {
    return this.http.get<GateReview>(`${API_URL}/gate-reviews/${id}`);
  }

  submitDecision(id: string, payload: {
    decision: string; notes?: string; checklist_items?: Record<string, boolean>;
  }): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${API_URL}/gate-reviews/${id}/decision`, payload);
  }
}
