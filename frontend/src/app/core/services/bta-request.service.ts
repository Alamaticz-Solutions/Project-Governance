import { Injectable, computed, inject } from '@angular/core';
import { PendingApprovalsService } from './pending-approvals.service';

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
  private pendingApprovals = inject(PendingApprovalsService);

  readonly requests = computed(() => this.pendingApprovals.tasks().filter(t => t.type === 'BTA Review') as BtaRequest[]);

  refreshRequests() {
    this.pendingApprovals.refresh(true);
  }

  addRequest(request: BtaRequest) {
    this.refreshRequests();
  }

  removeRequest(projectId: string) {
    this.pendingApprovals.removeTask(projectId, 'BTA Review');
  }
}
