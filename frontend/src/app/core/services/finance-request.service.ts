import { Injectable, computed, inject } from '@angular/core';
import { PendingApprovalsService } from './pending-approvals.service';

export interface FinanceRequest {
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
export class FinanceRequestService {
  private pendingApprovals = inject(PendingApprovalsService);

  readonly requests = computed(() => this.pendingApprovals.tasks().filter(t => t.type === 'Finance Review') as FinanceRequest[]);

  refreshRequests() {
    this.pendingApprovals.refresh(true);
  }

  addRequest(request: FinanceRequest) {
    this.refreshRequests();
  }

  removeRequest(projectId: string) {
    this.pendingApprovals.removeTask(projectId, 'Finance Review');
  }
}
