import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

const API_URL = environment.apiUrl;

export interface DashboardStats {
  total_portfolio_budget: number;
  active_proposals: number;
  projects_in_delivery: number;
  pending_approvals: number;
  critical_risks: number;
}

export interface PortfolioRow {
  id: string;
  name: string;
  dept: string;
  priority: string;
  stage: string;
  status: string;
  progress: number;
}

export interface DashboardResponse {
  stats: DashboardStats;
  portfolio: PortfolioRow[];
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  constructor(private http: HttpClient) {}

  getDashboard(): Observable<DashboardResponse> {
    return this.http.get<DashboardResponse>(`${API_URL}/dashboard`);
  }
}
