import { Injectable, signal, inject } from '@angular/core';
import { ProjectService } from './project.service';

export interface PicRequest {
  id: string;
  projectId: string;
  projectNumber: string;
  projectName: string;
  projectData: any;
  type: string; // 'Prepare for PIC' or 'PIC Meeting'
  priority: string;
  submittedBy: string;
  submittedDate: string;
  status: string; // 'pending' | 'completed'
}

@Injectable({ providedIn: 'root' })
export class PicRequestService {
  private projectService = inject(ProjectService);
  private requestsSignal = signal<PicRequest[]>([]);

  readonly requests = this.requestsSignal.asReadonly();

  constructor() {
    this.refreshRequests();
  }

  refreshRequests() {
    this.projectService.getPendingTasks().subscribe({
      next: (tasks) => {
        const picTasks = tasks.filter(t => 
          t.type === 'Prepare for PIC' || 
          t.type === 'PIC Meeting'
        );
        this.requestsSignal.set(picTasks);
      },
      error: (err) => console.error('Failed to load PIC requests', err)
    });
  }

  addRequest(request: PicRequest) {
    this.refreshRequests();
  }

  removeRequest(projectId: string, type: string) {
    this.requestsSignal.update(reqs => reqs.filter(r => !(r.projectId === projectId && r.type === type)));
  }

  getRequestsByType(type: string): PicRequest[] {
    return this.requestsSignal().filter(r => r.type === type);
  }
}
