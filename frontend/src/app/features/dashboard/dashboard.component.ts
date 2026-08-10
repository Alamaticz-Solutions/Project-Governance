import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DashboardService, DashboardResponse } from '../../core/services/dashboard.service';
import { PendingApprovalsService } from '../../core/services/pending-approvals.service';

interface KpiTile {
  label: string;
  value: string;
  icon: string;
  colorCode: string;
}

function formatPortfolioBudget(amount: number): string {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `$${Math.round(amount / 1000)}K`;
  return `$${Math.round(amount)}`;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="animate-fade-in min-h-full relative overflow-hidden bg-[#0f172a] text-slate-100 p-6">
      <!-- Ambient background glow -->
      <div class="absolute top-[-15%] left-[-10%] w-[60%] h-[60%] bg-indigo-600/10 rounded-full blur-[150px] pointer-events-none"></div>
      <div class="absolute bottom-[-15%] right-[-10%] w-[50%] h-[50%] bg-purple-600/10 rounded-full blur-[130px] pointer-events-none"></div>

      <div class="relative z-10">
        <!-- Executive Header -->
        <div class="flex items-center justify-between mb-8">
          <div>
            <h1 class="font-display text-3xl font-bold text-white tracking-tight">Executive Dashboard</h1>
            <p class="text-sm font-medium text-slate-400 mt-1 flex items-center gap-2">
              <span class="material-icons text-sm text-green-500">fiber_manual_record</span>
              Live Portfolio Analytics — {{ today }}
            </p>
          </div>
          <div class="flex items-center gap-3">
            <a routerLink="/intake" class="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/25 px-5 py-2.5 rounded-lg font-bold text-sm flex items-center gap-2 transition-all hover:-translate-y-0.5">
              <span class="material-icons text-[18px]">add</span>
              New Proposal
            </a>
          </div>
        </div>

        @if (loading()) {
          <div class="flex items-center justify-center p-20 text-slate-400">
            <span class="material-icons animate-spin mr-2">autorenew</span> Loading dashboard...
          </div>
        } @else {
          <!-- Governance KPIs Grid -->
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            @for (kpi of kpis(); track kpi.label) {
              <div class="premium-card p-6 relative overflow-hidden group">
                <div class="flex items-start justify-between relative z-10">
                  <div>
                    <p class="text-sm font-semibold text-slate-400 mb-1 tracking-wide">{{ kpi.label }}</p>
                    <h3 class="font-display text-4xl font-extrabold text-white">{{ kpi.value }}</h3>
                  </div>
                  <div class="w-12 h-12 rounded-xl flex items-center justify-center"
                       [ngClass]="'bg-' + kpi.colorCode + '-500/10 text-' + kpi.colorCode + '-400'">
                    <span class="material-icons text-[26px]">{{ kpi.icon }}</span>
                  </div>
                </div>
              </div>
            }
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">

            <!-- Center Column (Main Data 2/3 wide) -->
            <div class="lg:col-span-2 space-y-8">

              <!-- Active Requests / Projects Table -->
              <div class="premium-card overflow-hidden flex flex-col">
                <div class="px-6 py-5 flex justify-between items-center" style="border-bottom: 1px solid rgba(255,255,255,0.08);">
                  <h3 class="font-bold text-white text-lg flex items-center gap-2">
                    <span class="material-icons text-indigo-400">view_timeline</span>
                    Portfolio Status
                  </h3>
                  <a routerLink="/projects" class="text-sm font-semibold text-indigo-400 hover:text-indigo-300">View All</a>
                </div>
                <div class="p-0 overflow-x-auto">
                  <table class="premium-table w-full">
                    <thead>
                      <tr>
                        <th>Initiative</th>
                        <th>Priority</th>
                        <th>Workflow Stage</th>
                        <th>Progress</th>
                      </tr>
                    </thead>
                    <tbody>
                      @if (dashboard()?.portfolio?.length === 0) {
                        <tr><td colspan="4" class="!text-center !text-slate-500 py-10">No active projects in the portfolio yet.</td></tr>
                      }
                      @for (p of dashboard()?.portfolio ?? []; track p.id) {
                        <tr class="cursor-pointer group" [routerLink]="['/workspace', p.id]">
                          <td>
                            <div class="font-bold text-slate-100 group-hover:text-indigo-400 transition-colors">{{ p.name }}</div>
                            <div class="text-xs font-medium text-slate-500">{{ p.dept }}</div>
                          </td>
                          <td>
                            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border"
                                  [ngClass]="getPriorityClasses(p.priority)">
                              {{ p.priority }}
                            </span>
                          </td>
                          <td>
                            <div class="flex items-center gap-2">
                              <div class="w-2 h-2 rounded-full" [ngClass]="p.status === 'in_delivery' ? 'bg-violet-500' : 'bg-blue-500'"></div>
                              <span class="text-sm font-semibold text-slate-300 bg-white/5 px-2 py-0.5 rounded">{{ p.stage }}</span>
                            </div>
                          </td>
                          <td>
                            <div class="flex flex-col gap-1.5 min-w-[100px]">
                              <div class="flex justify-between text-xs font-bold text-slate-400">
                                <span>{{ p.progress }}%</span>
                              </div>
                              <div class="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                                <div class="h-full rounded-full transition-all duration-1000"
                                     [ngClass]="p.progress < 30 ? 'bg-red-500' : (p.progress < 70 ? 'bg-blue-500' : 'bg-green-500')"
                                     [style.width.%]="p.progress"></div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <!-- Right Column (Context & Approvals) -->
            <div class="space-y-8">

              <!-- Pending Reviews (My Tasks) -->
              <div class="premium-card overflow-hidden">
                <div class="px-6 py-5 flex justify-between items-center" style="border-bottom: 1px solid rgba(255,255,255,0.08);">
                  <h3 class="font-bold text-white text-lg flex items-center gap-2">
                    <span class="material-icons text-orange-400">pending_actions</span>
                    My Tasks & Reviews
                  </h3>
                  <a routerLink="/team-inbox" class="text-sm font-semibold text-indigo-400 hover:text-indigo-300">View All</a>
                </div>
                <div class="p-4 space-y-3">
                  @if (myTasks().length === 0) {
                    <p class="text-sm text-slate-500 text-center py-6">You're all caught up — no pending reviews.</p>
                  }
                  @for (task of myTasks(); track task.approval_id) {
                    <div class="p-4 rounded-xl border transition-all cursor-pointer group"
                         style="border-color: rgba(255,255,255,0.08); background: rgba(255,255,255,0.02);"
                         onmouseenter="this.style.background='rgba(99,102,241,0.08)'; this.style.borderColor='rgba(99,102,241,0.3)';"
                         onmouseleave="this.style.background='rgba(255,255,255,0.02)'; this.style.borderColor='rgba(255,255,255,0.08)';"
                         [routerLink]="['/workspace', task.projectId]">
                      <div class="flex justify-between items-start mb-2">
                        <span class="text-[10px] font-extrabold uppercase tracking-widest text-indigo-300 bg-indigo-500/15 px-2 py-0.5 rounded">{{ task.type }}</span>
                        <span class="text-[11px] font-medium text-slate-500">{{ task.submittedDate }}</span>
                      </div>
                      <h4 class="font-semibold text-slate-100 text-sm mb-1 leading-snug group-hover:text-indigo-400">{{ task.projectName }}</h4>
                      <p class="text-xs text-slate-500">Submitted by {{ task.submittedBy }}</p>
                    </div>
                  }
                </div>
              </div>

            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: []
})
export class DashboardComponent implements OnInit {
  today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  private dashboardService = inject(DashboardService);
  private pendingApprovals = inject(PendingApprovalsService);

  dashboard = signal<DashboardResponse | null>(null);
  loading = signal(true);

  myTasks = computed(() => this.pendingApprovals.tasks().slice(0, 5));

  kpis = computed<KpiTile[]>(() => {
    const stats = this.dashboard()?.stats;
    if (!stats) return [];
    return [
      { label: 'Total Portfolio Budget', value: formatPortfolioBudget(stats.total_portfolio_budget), icon: 'account_balance', colorCode: 'blue' },
      { label: 'Pending Approvals', value: String(stats.pending_approvals), icon: 'timelapse', colorCode: 'orange' },
      { label: 'Active Proposals', value: String(stats.active_proposals), icon: 'lightbulb', colorCode: 'indigo' },
      { label: 'Critical Risks', value: String(stats.critical_risks), icon: 'warning_amber', colorCode: 'red' },
    ];
  });

  ngOnInit(): void {
    this.dashboardService.getDashboard().subscribe({
      next: (res) => {
        this.dashboard.set(res);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load dashboard', err);
        this.loading.set(false);
      }
    });
  }

  getPriorityClasses(p: string): string {
    switch (p.toLowerCase()) {
      case 'critical': return 'bg-red-900/30 text-red-400 border-red-500/30';
      case 'high': return 'bg-orange-900/30 text-orange-400 border-orange-500/30';
      case 'medium': return 'bg-blue-900/30 text-blue-300 border-blue-500/30';
      default: return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  }
}
