import { Injectable, computed, inject } from '@angular/core';
import { PendingApprovalsService } from './pending-approvals.service';

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
  private pendingApprovals = inject(PendingApprovalsService);

  // Support matching 'EAC Meeting' and 'EAC Committee Review'; normalize the latter to 'EAC Meeting'.
  readonly requests = computed(() => this.pendingApprovals.tasks()
    .filter(t => t.type === 'Prepare for EAC' || t.type === 'EAC Committee Review' || t.type === 'EAC Meeting')
    .map(t => t.type === 'EAC Committee Review' ? { ...t, type: 'EAC Meeting' } : t) as EacRequest[]);

  refreshRequests() {
    this.pendingApprovals.refresh(true);
  }

  addRequest(request: EacRequest) {
    this.refreshRequests();
  }

  removeRequest(projectId: string, type: string) {
    this.pendingApprovals.removeTask(projectId, type);
  }

  getRequestsByType(type: string): EacRequest[] {
    return this.requests().filter(r => r.type === type);
  }
}
