import { Injectable, signal, inject } from '@angular/core';
import { ProjectService } from './project.service';

export interface FinanceRequest {
  id: string;
  projectId: string;
  projectNumber: string;
  projectName: string;
  projectData: any;
  type: string;
  priority: string;
  submittedBy: string;
  submittedDate: string;
}

@Injectable({ providedIn: 'root' })
export class FinanceRequestService {
  private projectService = inject(ProjectService);
  private requestsSignal = signal<FinanceRequest[]>([]);

  readonly requests = this.requestsSignal.asReadonly();

  constructor() {
    this.refreshRequests();
  }

  refreshRequests() {
    this.projectService.getPendingTasks().subscribe({
      next: (tasks) => {
        const financeTasks = tasks.filter(t => t.type === 'Finance Review');
        this.requestsSignal.set(financeTasks);
      },
      error: (err) => console.error('Failed to load Finance requests', err)
    });
  }

  addRequest(request: FinanceRequest) {
    this.refreshRequests();
  }

  removeRequest(projectId: string) {
    this.requestsSignal.update(reqs => reqs.filter(r => r.projectId !== projectId));
  }
}
