import { Injectable, computed, inject } from '@angular/core';
import { PendingApprovalsService } from './pending-approvals.service';

export interface PicRequest {
  id: string;
  projectId: string;
  projectNumber: string;
  projectName: string;
  projectData: any;
  type: string;
  forwardTo?: string; // 'Prepare for PIC' or 'PIC Meeting'
  priority: string;
  submittedBy: string;
  submittedDate: string;
  status: string; // 'pending' | 'completed'
}

@Injectable({ providedIn: 'root' })
export class PicRequestService {
  private pendingApprovals = inject(PendingApprovalsService);

  readonly requests = computed(() => this.pendingApprovals.tasks()
    .filter(t => t.type === 'Prepare for PIC' || t.type === 'PIC Meeting') as PicRequest[]);

  refreshRequests() {
    this.pendingApprovals.refresh(true);
  }

  addRequest(request: PicRequest) {
    this.refreshRequests();
  }

  removeRequest(projectId: string, type: string) {
    this.pendingApprovals.removeTask(projectId, type);
  }

  getRequestsByType(type: string): PicRequest[] {
    return this.requests().filter(r => r.type === type);
  }
}
