import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ProjectService } from '../../core/services/project.service';

interface GateItem {
  id: string; code: string; gateName: string; project: string; projectNumber: string;
  committee: string; status: string; priority: string;
  submittedDate: string; daysOpen: number;
}

const GATE_DATA: GateItem[] = [];

const CHECKLIST_DEFAULTS = [
  { key: 'problem',    label: 'Validate business problem, goals, expected value', status: 'pending', comments: '' },
  { key: 'alignment',  label: 'Ensure project aligns with dept & enterprise capabilities', status: 'pending', comments: '' },
  { key: 'scoping',    label: 'Facilitate early scoping & feasibility', status: 'pending', comments: '' },
  { key: 'stakeholders', label: 'Identify all business/IT stakeholders', status: 'pending', comments: '' },
];

@Component({
  selector: 'app-gate-review',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="animate-fade-in">
      <div class="page-header">
        <h1 class="page-title">Gate Review Center</h1>
        <p class="page-subtitle">{{ pendingCount }} pending reviews require your attention</p>
      </div>

      <div class="gate-layout">
        <!-- Left: Gate List -->
        <div class="gate-list-panel">
          <!-- Search & Filter -->
          <div class="list-header">
            <div class="search-box" style="flex:1">
              <span class="material-icons search-icon">search</span>
              <input type="text" placeholder="Search gates..." class="search-input"
                     [(ngModel)]="searchTerm" (input)="filterGates()" />
            </div>
            <select class="form-control" style="width:130px" [(ngModel)]="statusFilter" (change)="filterGates()">
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="needs-info">Needs Info</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          <!-- Gate Cards -->
          <div class="gate-cards">
            @for (gate of filteredGates; track gate.id) {
              <div
                class="gate-card-item"
                [class.selected]="selectedGate()?.id === gate.id"
                (click)="selectGate(gate)"
              >
                <div class="gate-card-top">
                  <div class="gate-badge-lg">{{ gate.code }}</div>
                  <span class="badge" [class]="'badge-' + gate.status">{{ gate.status }}</span>
                  <span class="badge" [class]="'badge-' + gate.priority" style="margin-left:4px">{{ gate.priority }}</span>
                </div>
                <div class="gate-card-project">
                  @if (gate.projectNumber) {
                    <span class="text-xs font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded mr-1">{{ gate.projectNumber }}</span>
                  }
                  {{ gate.project }}
                </div>
                <div class="gate-card-meta">
                  <span class="material-icons">group</span>
                  {{ gate.committee }}
                </div>
                <div class="gate-card-footer">
                  <span class="text-xs text-muted">Submitted: {{ gate.submittedDate }}</span>
                  @if (gate.daysOpen > 0) {
                    <span class="days-badge" [class.overdue]="gate.daysOpen > 7">
                      {{ gate.daysOpen }}d open
                    </span>
                  }
                </div>
              </div>
            }
          </div>
        </div>

        <!-- Right: Gate Detail -->
        <div class="gate-detail-panel">
          @if (!selectedGate()) {
            <div class="empty-state" style="height:100%;min-height:400px">
              <span class="material-icons empty-icon">fact_check</span>
              <h3>Select a gate to review</h3>
              <p>Click a gate from the list to view details and take action</p>
            </div>
          }

          @if (selectedGate()) {
            <div class="animate-fade-in">
              <!-- Gate Header -->
              <div class="bg-white rounded-[16px] p-6 mb-6 shadow-sm border border-gray-100 relative">
                <div class="flex items-start justify-between">
                  <!-- Title and Code -->
                  <div class="flex items-center gap-4">
                    <div class="gate-hero-code">
                      {{ selectedGate()!.code }}
                    </div>
                    <div>
                      <h2 class="text-[20px] font-extrabold text-[#172B4D] mb-1">
                        Gate {{ selectedGate()!.code }} — {{ selectedGate()!.gateName }}
                      </h2>
                      <div class="text-[14px] font-medium text-[#6B778C]">
                        {{ selectedGate()!.projectNumber }}{{ selectedGate()!.project }}
                      </div>
                    </div>
                  </div>
                  
                  <!-- Status Pill -->
                  <div class="badge-status uppercase flex items-center justify-center gap-1.5"
                       [class]="'badge-' + selectedGate()!.status">
                    <div class="w-1.5 h-1.5 rounded-full" [class]="'bg-' + selectedGate()!.status"></div>
                    {{ selectedGate()!.status }}
                  </div>
                </div>

                <!-- Meta Pills -->
                <div class="flex items-center gap-3 mt-5">
                  <div class="meta-pill">
                    <span class="material-icons meta-icon">group</span>
                    {{ selectedGate()!.committee }}
                  </div>
                  <div class="meta-pill">
                    <span class="material-icons meta-icon">flag</span>
                    {{ selectedGate()!.priority }} priority
                  </div>
                  <div class="meta-pill">
                    <span class="material-icons meta-icon">calendar_today</span>
                    Submitted {{ selectedGate()!.submittedDate }}
                  </div>
                </div>
              </div>

              <!-- Tab Navigation -->
              <div class="flex items-center border-b-[3px] border-[#E9EAF0] mb-6 relative">
                <button class="tab-button"
                  [class.active]="activeTab() === 'dossier'"
                  (click)="activeTab.set('dossier')">
                  <span class="material-icons">description</span> BTA Final Review
                </button>
                <button class="tab-button"
                  [class.active]="activeTab() === 'checklist'"
                  (click)="activeTab.set('checklist')">
                  <span class="material-icons">verified</span> Gateway Approval
                </button>
              </div>

              @if (activeTab() === 'dossier') {
                <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 animate-fade-in mb-4">
                  <h3 class="text-lg font-bold text-[#172B4D] mb-4 border-b border-gray-100 pb-2">Business Objective & Scope</h3>
                  <div class="grid grid-cols-2 gap-6 mb-6">
                    <div><label class="text-xs font-semibold text-gray-500 block mb-1">Project Sponsor</label><p class="text-[14px] m-0 text-gray-800">Sarah Jenkins, VP of Operations</p></div>
                    <div><label class="text-xs font-semibold text-gray-500 block mb-1">Estimated Budget</label><p class="text-[14px] m-0 text-gray-800">$450,000</p></div>
                    <div class="col-span-2"><label class="text-xs font-semibold text-gray-500 block mb-1">Primary Objective</label><p class="text-[14px] m-0 text-gray-800">Standardize and modernize the internal governance workflow to reduce approval latency by 45%. This directly aligns with Q3 enterprise OKRs.</p></div>
                  </div>
                  
                  <h3 class="text-lg font-bold text-[#172B4D] mb-4 border-b border-gray-100 pb-2 pt-4">Vendors & Architecture</h3>
                  <div class="grid grid-cols-2 gap-6 mb-6">
                    <div><label class="text-xs font-semibold text-gray-500 block mb-1">Proposed Vendor</label><p class="text-[14px] m-0 text-gray-800 flex items-center gap-2">Acme Software Corp <span class="badge badge-approved text-[10px] py-0 px-2">Approved Source</span></p></div>
                    <div><label class="text-xs font-semibold text-gray-500 block mb-1">Hosting Env</label><p class="text-[14px] m-0 text-gray-800">AWS Cloud (US-East)</p></div>
                  </div>

                  <h3 class="text-lg font-bold text-[#172B4D] mb-4 border-b border-gray-100 pb-2 pt-4">Key Risks & Dependencies</h3>
                  <div class="grid grid-cols-2 gap-6">
                    <div><label class="text-xs font-semibold text-gray-500 block mb-1">Key Dependency</label><p class="text-[14px] m-0 text-gray-800">Requires completion of Cloud Migration Phase 1 (Target: Aug 15th)</p></div>
                    <div><label class="text-xs font-semibold text-gray-500 block mb-1">Identified Risk</label><p class="text-[14px] m-0 text-red-600">Potential overlap with concurrent CRM patching schedule.</p></div>
                  </div>
                </div>
              }

              @if (activeTab() === 'checklist') {
                <div class="animate-fade-in">
                  <!-- Checklist Sign-off Cards -->
                  <div class="mb-4">
                    <div class="flex justify-between items-center mb-1">
                      <h3 class="text-[16px] font-[900] text-[#172B4D] m-0">Gateway Check List</h3>
                      <div class="text-[14px] font-[800] text-[#6B4AA4]">
                        {{ checkedCount() }} / {{ checklist.length }} Gates Approved
                      </div>
                    </div>
                    
                    <div class="w-full h-2 rounded-full overflow-hidden flex bg-[#EAEAF3] mb-6 border border-[#EAEAF3]">
                      <div class="h-full bg-gradient-to-r from-[#8165ce] to-[#5a45ac] transition-all duration-300" [style.width.%]="checklistProgress()"></div>
                    </div>

                    <div class="flex flex-col gap-4">
                      @for (item of checklist; track item.key) {
                        <div class="signoff-card">
                          <div class="flex justify-between items-center w-full">
                            <div class="flex-1 pr-4">
                              <h4 class="text-[16px] font-extrabold text-[#172B4D] m-0 mb-1 leading-tight">{{ item.label }}</h4>
                              <p class="text-[13px] text-[#6B778C] m-0">{{ item.comments || 'Review the documentation and ensure this requirement is met before proceeding.' }}</p>
                            </div>
                            
                            <div class="flex items-center gap-1 flex-shrink-0">
                              <button class="action-icon-btn" [class.active-reject]="item.status === 'rejected'" (click)="setChecklistStatus(item, 'rejected')">
                                <span class="material-icons text-[20px]">close</span>
                              </button>
                              <button class="action-icon-btn" [class.active-pending]="item.status === 'pending'" (click)="setChecklistStatus(item, 'pending')">
                                <svg class="hourglass-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 22h14"></path><path d="M5 2h14"></path><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"></path><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"></path></svg>
                              </button>
                              <button class="action-icon-btn" [class.active-approve]="item.status === 'approved'" (click)="setChecklistStatus(item, 'approved')">
                                <span class="material-icons text-[20px]">check</span>
                              </button>
                            </div>
                          </div>
                          
                          @if (item.status !== 'pending') {
                            <div class="mt-4 pt-3 border-t border-gray-100 animate-fade-in text-sm">
                               <input type="text" class="w-full bg-[#f9fafb] border border-[#e5e7eb] rounded px-3 py-2 text-gray-700 outline-none focus:border-blue-300" placeholder="Required: leave a comment regarding your decision" [(ngModel)]="item.comments" />
                            </div>
                          }
                        </div>
                      }
                    </div>
                  </div>

                  <!-- Actions -->
                  @if (actionResult()) {
                    <div class="action-banner" [class]="'banner-' + actionResult()!.type">
                      <span class="material-icons">{{ actionResult()!.icon }}</span>
                      <span>{{ actionResult()!.message }}</span>
                    </div>
                  }

                  @if (!actionResult()) {
                    <div class="flex gap-4 mt-8 pb-4">
                      <button class="btn-action btn-outline" (click)="submitDecision('needs_info')">
                        <span class="material-icons font-[600]">help_outline</span>
                        Request More Info
                      </button>
                      <button class="btn-action btn-reject" (click)="submitDecision('rejected')">
                        <span class="material-icons">cancel</span>
                        Reject Gate
                      </button>
                      <button class="btn-action btn-approve" (click)="submitDecision('approved')"
                              [disabled]="checkedCount() < checklist.length">
                        <span class="material-icons">check_circle</span>
                        Approve Gate
                      </button>
                    </div>
                  }
                </div>
              }
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`

    /* Premium Gate Review Layout */
    .page-header { margin-bottom: 24px; padding-bottom: 12px; border-bottom: 1px solid rgba(226,232,240,0.8); }
    .page-title { margin: 0; font-size: 26px; font-weight: 800; color: #1E293B; font-family: 'Outfit', sans-serif; letter-spacing: -0.5px; }
    .page-subtitle { margin: 6px 0 0; font-size: 14px; font-weight: 500; color: #64748B; }

    .gate-layout {
      display: grid;
      grid-template-columns: 360px 1fr;
      gap: 28px;
      align-items: start;
      font-family: 'Inter', sans-serif;
    }

    .gate-list-panel {
      background: white;
      border-radius: 16px;
      border: 1px solid rgba(226,232,240,0.8);
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(79,70,229,0.04);
    }

    .list-header {
      display: flex; gap: 12px; padding: 18px;
      border-bottom: 1px solid rgba(226,232,240,0.8);
      background: rgba(248,250,252,0.8);
    }

    .search-box {
      display: flex; align-items: center; gap: 8px;
      background: white; border: 1.5px solid #E2E8F0;
      border-radius: 10px; padding: 8px 12px; transition: all 0.2s;
    }
    .search-box:focus-within { border-color: rgba(79,70,229,0.5); box-shadow: 0 0 0 4px rgba(79,70,229,0.1); }

    .search-icon { font-size: 16px !important; color: #94A3B8; }

    .search-input {
      border: none; background: transparent; outline: none;
      font-size: 13px; font-weight: 500; color: #1E293B; width: 100%;
    }
    .search-input::placeholder { color: #94A3B8; }

    .gate-cards { max-height: calc(100vh - 240px); overflow-y: auto; }
    .gate-cards::-webkit-scrollbar { width: 6px; }
    .gate-cards::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 10px; }

    .gate-card-item {
      padding: 18px; border-bottom: 1px solid rgba(226,232,240,0.5);
      cursor: pointer; transition: all 0.2s; position: relative;
    }
    .gate-card-item:hover { background: rgba(248,250,252,0.8); padding-left: 22px; }
    .gate-card-item.selected { background: rgba(238,242,255,0.7); }
    .gate-card-item.selected::before {
      content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 4px;
      background: linear-gradient(180deg, #4F46E5, #7C3AED);
    }
    .gate-card-item:last-child { border-bottom: none; }

    .gate-card-top { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }

    .gate-badge-lg {
      width: 40px; height: 40px;
      background: linear-gradient(135deg, #4F46E5, #7C3AED); color: white;
      border-radius: 10px; display: flex; align-items: center; justify-content: center;
      font-size: 14px; font-weight: 800; font-family: 'Outfit', sans-serif;
      box-shadow: 0 2px 8px rgba(79,70,229,0.2);
    }

    .gate-card-project { font-size: 13px; font-weight: 700; color: #1E293B; margin-bottom: 8px; line-height: 1.4; }

    .gate-card-meta {
      display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 500;
      color: #64748B; margin-bottom: 12px;
    }
    .gate-card-meta .material-icons { font-size: 14px !important; }

    .gate-card-footer { display: flex; align-items: center; justify-content: space-between; }

    .days-badge {
      font-size: 10px; font-weight: 800; padding: 4px 8px; border-radius: 12px;
      background: #FEF3C7; color: #D97706; text-transform: uppercase; letter-spacing: 0.5px;
    }
    .days-badge.overdue { background: #FEE2E2; color: #DC2626; }

    .gate-hero-code {
      width: 56px; height: 56px;
      background: linear-gradient(135deg, #0EA5E9, #3B82F6); color: white;
      border-radius: 14px; display: flex; align-items: center; justify-content: center;
      font-size: 22px; font-weight: 800; font-family: 'Outfit', sans-serif;
      box-shadow: 0 4px 12px rgba(14,165,233,0.3);
    }

    .badge-status {
      padding: 6px 14px; border-radius: 20px; font-size: 11px; font-weight: 800; letter-spacing: 0.5px;
    }
    .badge-pending { background: #FEF3C7; color: #D97706; }
    .badge-needs-info { background: #E0E7FF; color: #4338CA; }
    .badge-approved { background: #D1FAE5; color: #059669; }
    .badge-rejected { background: #FEE2E2; color: #DC2626; }
    
    .bg-pending { background-color: #D97706; }
    .bg-needs-info { background-color: #4338CA; }
    .bg-approved { background-color: #059669; }
    .bg-rejected { background-color: #DC2626; }

    .meta-pill {
      display: flex; align-items: center; gap: 8px; padding: 6px 14px;
      border: 1.5px solid #E2E8F0; border-radius: 20px; font-size: 12px; font-weight: 600; color: #475569;
      background: white;
    }
    .meta-pill .meta-icon { font-size: 16px !important; color: #94A3B8; }

    .tab-button {
      padding: 14px 24px; font-size: 14px; font-weight: 700; color: #64748B;
      display: flex; align-items: center; gap: 8px; border: none; background: transparent;
      margin-bottom: -3px; cursor: pointer; border-bottom: 3px solid transparent; transition: all 0.2s;
    }
    .tab-button:hover { color: #1E293B; background: rgba(248,250,252,0.8); border-radius: 8px 8px 0 0; }
    .tab-button.active { color: #4F46E5; border-bottom-color: #4F46E5; }
    .tab-button .material-icons { font-size: 18px !important; }

    .signoff-card {
      background: white; border: 1.5px solid #E2E8F0; border-radius: 14px;
      padding: 20px 24px; box-shadow: 0 2px 12px rgba(79,70,229,0.03); transition: all 0.2s;
    }
    .signoff-card:hover { border-color: rgba(79,70,229,0.2); box-shadow: 0 4px 16px rgba(79,70,229,0.06); }

    .action-icon-btn {
      width: 42px; height: 42px; display: flex; align-items: center; justify-content: center;
      border-radius: 10px; border: 1.5px solid transparent; background: rgba(248,250,252,0.8);
      color: #64748B; cursor: pointer; transition: all 0.2s;
    }
    .action-icon-btn:hover { background: #E2E8F0; color: #1E293B; }

    .action-icon-btn.active-reject { background: #FEE2E2; color: #DC2626; border-color: #FCA5A5; }
    .action-icon-btn.active-pending { background: #FEF3C7; color: #D97706; border-color: #FCD34D; }
    .action-icon-btn.active-approve { background: #D1FAE5; color: #059669; border-color: #6EE7B7; }

    .btn-action {
      flex: 1; display: flex; align-items: center; justify-content: center; gap: 10px;
      padding: 14px 0; border-radius: 12px; font-size: 14px; font-weight: 800; cursor: pointer;
      border: none; transition: all 0.2s; font-family: 'Inter', sans-serif;
    }
    
    .btn-outline { border: 1.5px solid #E2E8F0; background: white; color: #475569; }
    .btn-outline:hover { background: rgba(248,250,252,0.8); border-color: rgba(79,70,229,0.3); color: #4F46E5; }
    
    .btn-reject { background: linear-gradient(135deg, #EF4444, #DC2626); color: white; box-shadow: 0 4px 12px rgba(220,38,38,0.2); }
    .btn-reject:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(220,38,38,0.3); }
    
    .btn-approve { background: linear-gradient(135deg, #10B981, #059669); color: white; box-shadow: 0 4px 12px rgba(16,185,129,0.2); }
    .btn-approve:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(16,185,129,0.3); }
    .btn-approve:disabled { background: #E2E8F0; color: #94A3B8; box-shadow: none; cursor: not-allowed; transform: none; }

    .action-banner {
      display: flex; align-items: center; gap: 14px; padding: 20px 24px;
      border-radius: 12px; font-size: 15px; font-weight: 700; margin-top: 12px;
    }
    .action-banner .material-icons { font-size: 24px; }
    .banner-approved { background: #D1FAE5; color: #065F46; border: 1.5px solid #34D399; }
    .banner-rejected { background: #FEE2E2; color: #991B1B; border: 1.5px solid #F87171; }
    .banner-needs_info { background: #FEF3C7; color: #92400E; border: 1.5px solid #FCD34D; }

  `]
})
export class GateReviewComponent implements OnInit {
  private projectService = inject(ProjectService);
  private router = inject(Router);
  
  gates: GateItem[] = [];
  filteredGates: GateItem[] = [];
  selectedGate = signal<GateItem | null>(null);
  searchTerm = '';
  statusFilter = '';
  reviewComments = '';
  checklist = CHECKLIST_DEFAULTS.map(i => ({ ...i }));
  checkedCount = signal(0);
  checklistProgress = signal(0);
  actionResult = signal<{ type: string; icon: string; message: string } | null>(null);
  activeTab = signal<'dossier' | 'checklist'>('dossier');

  ngOnInit() {
    this.projectService.getPendingTasks().subscribe({
      next: (tasks) => {
        const gateTasks = tasks.filter(t => t.type === 'Gate Review');
        this.gates = gateTasks.map(t => ({
          id: t.projectId,
          code: t.projectNumber ? t.projectNumber.slice(-2) : 'GR',
          gateName: 'BTA Gateway Approval',
          project: t.projectName,
          projectNumber: t.projectNumber,
          committee: 'Business Tech Assessment',
          status: t.status.toLowerCase(),
          priority: t.priority?.toLowerCase() || 'medium',
          submittedDate: t.submittedDate,
          daysOpen: 1
        }));
        this.filterGates();
      },
      error: (e) => console.error("Failed to load gate tasks", e)
    });
  }

  get pendingCount(): number {
    return this.gates.filter(g => g.status === 'pending' || g.status === 'needs-info').length;
  }

  filterGates(): void {
    this.filteredGates = this.gates.filter(g => {
      const matchSearch = !this.searchTerm ||
        g.project.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        g.committee.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        g.code.toLowerCase().includes(this.searchTerm.toLowerCase());
      const matchStatus = !this.statusFilter || g.status === this.statusFilter;
      return matchSearch && matchStatus;
    });
  }

  selectGate(gate: GateItem): void {
    this.selectedGate.set(gate);
    this.checklist = CHECKLIST_DEFAULTS.map(i => ({ ...i }));
    this.reviewComments = '';
    this.actionResult.set(null);
    this.updateChecked();
  }

  updateChecked(): void {
    const count = this.checklist.filter(i => i.status === 'approved').length;
    this.checkedCount.set(count);
    this.checklistProgress.set(Math.round((count / this.checklist.length) * 100));
  }

  setChecklistStatus(item: any, status: 'approved' | 'rejected' | 'pending') {
    item.status = status;
    this.updateChecked();
  }

  submitDecision(decision: 'approved' | 'rejected' | 'needs_info'): void {
    const messages: Record<string, { type: string; icon: string; message: string }> = {
      approved:    { type: 'approved',    icon: 'check_circle',  message: `Gate ${this.selectedGate()!.code} has been fully APPROVED. The project has successfully routed to the EAC Meeting queue.` },
      rejected:    { type: 'rejected',    icon: 'cancel',         message: `Gate ${this.selectedGate()!.code} has been REJECTED. The project manager has been notified.` },
      needs_info:  { type: 'needs_info',  icon: 'help',           message: `More information requested for Gate ${this.selectedGate()!.code}. A notification has been sent to the project manager.` },
    };
    
    // We send payload to backend to transition it towards EAC 
    if (decision === 'approved') {
      this.projectService.submitDecision(this.selectedGate()!.id, 'Gate Review', 'Approve').subscribe({
        next: () => {
          this.actionResult.set(messages[decision]);
          setTimeout(() => {
            alert('Gate Approval Complete. The project has moved to the EAC queue.');
            this.router.navigate(['/team-inbox']);
          }, 800);
        },
        error: (err) => console.error(err)
      });
    } else {
      this.actionResult.set(messages[decision]);
    }
  }
}
