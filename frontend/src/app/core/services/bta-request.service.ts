import { Injectable, signal, inject } from '@angular/core';
import { ProjectService } from './project.service';

export interface BtaRequest {
  id: string;
  projectId: string;
  projectNumber: string;
  projectName: string;
  projectData: any;
  type: string;
  forwardTo?: string;
  priority: string;
  submittedBy: string;
  submittedDate: string;
}

@Injectable({ providedIn: 'root' })
export class BtaRequestService {
  private projectService = inject(ProjectService);
  private requestsSignal = signal<BtaRequest[]>([]);

  readonly requests = this.requestsSignal.asReadonly();

  constructor() {
    this.refreshRequests();
  }

  refreshRequests() {
    this.projectService.getPendingTasks().subscribe({
      next: (tasks) => {
        const btaTasks = tasks.filter(t => t.type === 'BTA Review');
        this.requestsSignal.set(btaTasks);
      },
      error: (err) => console.error('Failed to load BTA requests', err)
    });
  }

  addRequest(request: BtaRequest) {
    this.refreshRequests();
  }

  removeRequest(projectId: string) {
    this.requestsSignal.update(reqs => reqs.filter(r => r.projectId !== projectId));
  }
}
