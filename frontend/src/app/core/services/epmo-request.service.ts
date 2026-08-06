import { Injectable, signal, inject } from '@angular/core';
import { ProjectService } from './project.service';

export interface EpmoRequest {
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
export class EpmoRequestService {
  private projectService = inject(ProjectService);
  private requestsSignal = signal<EpmoRequest[]>([]);

  readonly requests = this.requestsSignal.asReadonly();

  constructor() {
    this.refreshRequests();
  }

  refreshRequests() {
    this.projectService.getPendingTasks().subscribe({
      next: (tasks) => {
        const epmoTasks = tasks.filter(t => t.type === 'EPMO Review');
        this.requestsSignal.set(epmoTasks);
      },
      error: (err) => console.error('Failed to load EPMO requests', err)
    });
  }

  addRequest(request: EpmoRequest) {
    this.refreshRequests();
  }

  removeRequest(projectId: string) {
    this.requestsSignal.update(reqs => reqs.filter(r => r.projectId !== projectId));
  }
}
