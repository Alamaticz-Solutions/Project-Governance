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
    .gate-layout {
      display: grid;
      grid-template-columns: 360px 1fr;
      gap: 20px;
      align-items: start;
    }

    .gate-list-panel {
      background: #fff;
      border-radius: 12px;
      border: 1px solid #DFE3ED;
      overflow: hidden;
    }

    .list-header {
      display: flex;
      gap: 10px;
      padding: 14px;
      border-bottom: 1px solid #DFE3ED;
      background: #F7F8FC;
    }

    .search-box {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #fff;
      border: 1.5px solid #DFE3ED;
      border-radius: 8px;
      padding: 6px 10px;
    }

    .search-icon { font-size: 16px !important; color: #97A0AF; }

    .search-input {
      border: none;
      background: transparent;
      outline: none;
      font-size: 13px;
      color: #172B4D;
      width: 100%;
      &::placeholder { color: #97A0AF; }
    }

    .gate-cards { max-height: calc(100vh - 240px); overflow-y: auto; }

    .gate-card-item {
      padding: 14px 16px;
      border-bottom: 1px solid #F0F2F7;
      cursor: pointer;
      transition: background 200ms;

      &:hover { background: #F7F8FC; }
      &.selected { background: #E3F0FF; border-left: 3px solid #0052CC; }
      &:last-child { border-bottom: none; }
    }

    .gate-card-top {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }

    .gate-badge-lg {
      width: 36px;
      height: 36px;
      background: #0052CC;
      color: #fff;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      font-weight: 800;
      font-family: 'Outfit', sans-serif;
    }

    .gate-card-project {
      font-size: 13px;
      font-weight: 600;
      color: #172B4D;
      margin-bottom: 6px;
    }

    .gate-card-meta {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      color: #6B778C;
      margin-bottom: 8px;
      .material-icons { font-size: 14px !important; }
    }

    .gate-card-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .days-badge {
      font-size: 10px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 10px;
      background: #FFF4D6;
      color: #FF8B00;
      &.overdue { background: #FFEBE6; color: #DE350B; }
    }

    .gate-hero-code {
      width: 52px;
      height: 52px;
      background: #0089C9;
      color: #fff;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      font-weight: 800;
      font-family: 'Outfit', sans-serif;
    }

    .badge-status {
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.5px;
      &.badge-pending { background: #FEF3C7; color: #D97706; }
      &.badge-needs-info { background: #E0E7FF; color: #4338CA; }
      &.badge-approved { background: #D1FAE5; color: #059669; }
      &.badge-rejected { background: #FEE2E2; color: #DC2626; }
      
      .bg-pending { background-color: #D97706; }
      .bg-needs-info { background-color: #4338CA; }
      .bg-approved { background-color: #059669; }
      .bg-rejected { background-color: #DC2626; }
    }

    .meta-pill {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border: 1px solid #E5E7EB;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 500;
      color: #4B5563;
      .meta-icon { font-size: 15px !important; color: #9CA3AF; }
    }

    .tab-button {
      padding: 12px 20px;
      font-size: 15px;
      font-weight: 700;
      color: #6B7280;
      display: flex;
      align-items: center;
      gap: 8px;
      border: none;
      background: transparent;
      margin-bottom: -3px;
      cursor: pointer;
      border-bottom: 3px solid transparent;
      transition: all 0.2s;
      
      &:hover {
        color: #111827;
      }
      &.active {
        color: #111827;
        border-bottom-color: #111827;
      }
      .material-icons { font-size: 18px !important; }
    }

    .signoff-card {
      background: #FFFFFF;
      border: 1px solid #F3F4F6;
      border-radius: 12px;
      padding: 16px 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.02);
    }

    .action-icon-btn {
      width: 38px;
      height: 38px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 8px;
      border: none;
      background: transparent;
      color: #111827;
      cursor: pointer;
      transition: background 0.2s;
      &:hover { background: #F3F4F6; }

      &.active-reject { background: #F3F4F6; color: #111827; }
      &.active-pending { background: #F3F4F6; color: #111827; }
      &.active-approve { background: #F3F4F6; color: #111827; }
    }

    .btn-action {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 12px 0;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      border: none;
      transition: transform 0.1s, filter 0.2s;
      
      &:hover { filter: brightness(0.95); }
      &:active { transform: translateY(1px); }
      &:disabled { opacity: 0.5; cursor: not-allowed; }
      .material-icons { font-size: 18px !important; }
    }

    .btn-outline {
      border: 1px solid #D1D5DB;
      background: #FFFFFF;
      color: #374151;
    }
    
    .btn-reject {
      background: #EA580C;
      color: #FFFFFF;
    }
    
    .btn-approve {
      background: #059669;
      color: #FFFFFF;
    }

    .action-banner {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px 20px;
      border-radius: 10px;
      font-size: 15px;
      font-weight: 600;
      margin-top: 8px;

      .material-icons { font-size: 22px; }

      &.banner-approved { background: #E3FCEF; color: #00875A; border: 1px solid #ABF5D1; }
      &.banner-rejected { background: #FFEBE6; color: #BF2600; border: 1px solid #FFBDAD; }
      &.banner-needs_info { background: #FFF4D6; color: #974F0C; border: 1px solid #FFE380; }
    }
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
