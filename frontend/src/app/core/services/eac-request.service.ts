import { Injectable, signal, inject } from '@angular/core';
import { ProjectService } from './project.service';

export interface EacRequest {
  id: string;
  projectId: string;
  projectNumber: string;
  projectName: string;
  projectData: any;
  type: string;
  forwardTo?: string; // 'Prepare for EAC' or 'EAC Meeting'
  priority: string;
  submittedBy: string;
  submittedDate: string;
  status: string; // 'pending' | 'completed'
}

@Injectable({ providedIn: 'root' })
export class EacRequestService {
  private projectService = inject(ProjectService);
  private requestsSignal = signal<EacRequest[]>([]);

  readonly requests = this.requestsSignal.asReadonly();

  constructor() {
    this.refreshRequests();
  }

  refreshRequests() {
    this.projectService.getPendingTasks().subscribe({
      next: (tasks) => {
        // Support matching 'EAC Meeting' and 'EAC Committee Review'
        const eacTasks = tasks.filter(t => 
          t.type === 'Prepare for EAC' || 
          t.type === 'EAC Committee Review' || 
          t.type === 'EAC Meeting'
        ).map(t => {
          // Normalize type if backend sends EAC Committee Review to EAC Meeting
          if (t.type === 'EAC Committee Review') {
            t.type = 'EAC Meeting';
          }
          return t;
        });
        this.requestsSignal.set(eacTasks);
      },
      error: (err) => console.error('Failed to load EAC requests', err)
    });
  }

  addRequest(request: EacRequest) {
    this.refreshRequests();
  }

  removeRequest(projectId: string, type: string) {
    this.requestsSignal.update(reqs => reqs.filter(r => !(r.projectId === projectId && r.type === type)));
  }

  getRequestsByType(type: string): EacRequest[] {
    return this.requestsSignal().filter(r => r.type === type);
  }
}
