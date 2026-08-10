import { Injectable, computed, inject } from '@angular/core';
import { PendingApprovalsService } from './pending-approvals.service';

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
  private pendingApprovals = inject(PendingApprovalsService);

  readonly requests = computed(() => this.pendingApprovals.tasks().filter(t => t.type === 'EPMO Review') as EpmoRequest[]);

  refreshRequests() {
    this.pendingApprovals.refresh(true);
  }

  addRequest(request: EpmoRequest) {
    this.refreshRequests();
  }

  removeRequest(projectId: string) {
    this.pendingApprovals.removeTask(projectId, 'EPMO Review');
  }
}
