import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Project, ProjectListResponse } from '../models/models';

import { environment } from '../../../environments/environment';

const API_URL = environment.apiUrl;

@Injectable({ providedIn: 'root' })
export class ProjectService {
  constructor(private http: HttpClient) {}

  getProjects(params?: {
    page?: number; page_size?: number;
    status?: string; priority?: string; search?: string;
  }): Observable<ProjectListResponse> {
    let httpParams = new HttpParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null) httpParams = httpParams.set(k, v);
      });
    }
    return this.http.get<ProjectListResponse>(`${API_URL}/projects`, { params: httpParams });
  }

  getProject(id: string): Observable<Project> {
    return this.http.get<Project>(`${API_URL}/projects/${id}`);
  }

  createProject(payload: Partial<Project>): Observable<Project> {
    return this.http.post<Project>(`${API_URL}/projects`, payload);
  }

  updateProject(id: string, payload: Partial<Project>): Observable<Project> {
    return this.http.patch<Project>(`${API_URL}/projects/${id}`, payload);
  }

  deleteProject(id: string): Observable<void> {
    return this.http.delete<void>(`${API_URL}/projects/${id}`);
  }

  getPendingTasks(): Observable<any[]> {
    return this.http.get<any[]>(`${API_URL}/projects/approvals/pending`);
  }

  submitDecision(projectId: string, stage: string, decision: string, comments?: string, projectUpdates?: any): Observable<any> {
    return this.http.post<any>(`${API_URL}/projects/${projectId}/submit-decision`, {
      stage,
      decision,
      comments,
      project_updates: projectUpdates
    });
  }

  fastTrackComplete(projectId: string): Observable<any> {
    return this.http.post<any>(`${API_URL}/projects/${projectId}/fast-track-complete`, {});
  }
}
