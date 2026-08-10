import { Component, signal, computed, effect, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ProjectListCacheService } from '../../../core/services/project-list-cache.service';
import { Project } from '../../../core/models/models';
import { calculateProjectProgress, formatBudget } from '../../../core/utils/project-display.util';

interface MappedProject {
  id: string; number: string; name: string; dept: string;
  manager: string; budget: string; gate: string;
  priority: string; status: string; progress: number; due: string;
  pendingWith: string;
}

@Component({
  selector: 'app-project-list',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  template: `
    <div class="animate-fade-in min-h-[calc(100vh-4rem)] bg-[#0f172a] text-slate-100 relative overflow-hidden font-sans pb-10">
      <!-- Deep Gradient Background (ChatGPT Voice Style) -->
      <div class="absolute inset-0 bg-gradient-to-br from-slate-900 via-[#111827] to-[#1e1b4b] z-0"></div>
      <div class="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] bg-blue-600/20 rounded-full blur-[150px] pointer-events-none mix-blend-screen z-0 animate-pulse-slow"></div>
      <div class="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-purple-600/20 rounded-full blur-[120px] pointer-events-none mix-blend-screen z-0"></div>

      <div class="max-w-7xl mx-auto p-6 lg:p-8 relative z-10">
        <!-- Header -->
        <div class="flex items-center justify-between mb-8 border-b border-slate-700/50 pb-6">
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-inner">
              <span class="material-icons text-2xl">list_alt</span>
            </div>
            <div>
              <h1 class="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
                All Projects
                @if (refreshing()) {
                  <span class="material-icons text-indigo-400 text-[18px] animate-spin" title="Refreshing...">autorenew</span>
                }
              </h1>
              <p class="text-sm font-medium text-slate-400 mt-1">{{ filtered().length }} of {{ projects().length }} projects</p>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <button class="bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 px-4 py-2 rounded-xl text-sm font-bold shadow-md transition-all flex items-center gap-2">
              <span class="material-icons text-[18px]">download</span> Export
            </button>
            <a routerLink="/intake" class="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white px-5 py-2 rounded-xl text-sm font-bold shadow-lg shadow-indigo-500/25 transition-all flex items-center gap-2 hover:scale-[1.02]">
              <span class="material-icons text-[18px]">add</span> New Proposal
            </a>
          </div>
        </div>

        <!-- Filters -->
        <div class="glass-card rounded-2xl border border-slate-700/50 shadow-xl mb-6 p-4">
          <div class="flex flex-wrap items-center gap-4">
            <div class="flex-1 min-w-[200px] relative">
              <span class="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-[20px]">search</span>
              <input
                type="text"
                placeholder="Search projects..."
                class="w-full bg-slate-900/50 border border-slate-700 text-white pl-10 pr-4 py-2.5 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder-slate-500 shadow-inner"
                [(ngModel)]="searchTerm"
                (input)="applyFilters()"
              />
            </div>

            <select class="custom-select bg-slate-900/50 border border-slate-700 text-slate-200 py-2.5 px-4 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all w-[160px] shadow-inner" [(ngModel)]="statusFilter" (change)="applyFilters()">
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="in_delivery">In Delivery</option>
              <option value="completed">Completed</option>
              <option value="on_hold">On Hold</option>
            </select>

            <select class="custom-select bg-slate-900/50 border border-slate-700 text-slate-200 py-2.5 px-4 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all w-[160px] shadow-inner" [(ngModel)]="priorityFilter" (change)="applyFilters()">
              <option value="">All Priority</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            <button class="bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700 hover:border-slate-600 px-4 py-2.5 rounded-xl text-sm font-bold shadow-md transition-all flex items-center gap-2" (click)="clearFilters()">
              <span class="material-icons text-[18px]">filter_alt_off</span> Clear
            </button>
          </div>
        </div>

        <!-- Table -->
        <div class="glass-card rounded-2xl border border-slate-700/50 shadow-2xl overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="bg-slate-800/80 border-b border-slate-700/50 text-[11px] uppercase tracking-wider text-slate-400 font-bold">
                  <th class="px-5 py-4 whitespace-nowrap">Project Number</th>
                  <th class="px-5 py-4">Project Name</th>
                  <th class="px-5 py-4">Department</th>
                  <th class="px-5 py-4 whitespace-nowrap">Budget</th>
                  <th class="px-5 py-4 whitespace-nowrap">Current Stage</th>
                  <th class="px-5 py-4 whitespace-nowrap">Pending With</th>
                  <th class="px-5 py-4">Priority</th>
                  <th class="px-5 py-4 whitespace-nowrap">Status</th>
                  <th class="px-5 py-4 whitespace-nowrap text-center">Actions</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-700/50">
                @if (loading() && filtered().length === 0) {
                  <tr>
                    <td colspan="9">
                      <div class="flex flex-col items-center justify-center p-16 text-center gap-3">
                        <div class="w-12 h-12 rounded-full flex items-center justify-center bg-slate-800 border border-slate-700">
                          <span class="material-icons text-indigo-400 text-2xl animate-spin">autorenew</span>
                        </div>
                        <p class="text-sm font-semibold text-slate-400">Loading projects...</p>
                      </div>
                    </td>
                  </tr>
                } @else if (filtered().length === 0) {
                  <tr>
                    <td colspan="9">
                      <div class="flex flex-col items-center justify-center p-16 text-center">
                        <div class="w-16 h-16 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center mb-4 text-slate-500">
                          <span class="material-icons text-3xl">folder_off</span>
                        </div>
                        <h3 class="text-lg font-bold text-slate-200">No projects found</h3>
                        <p class="text-slate-400 text-sm mt-1">Try adjusting your filters or create a new proposal</p>
                      </div>
                    </td>
                  </tr>
                } @else {
                @for (p of filtered(); track p.id) {
                  <tr class="hover:bg-slate-800/40 transition-colors group">
                    <td class="px-5 py-4">
                      <code class="text-[11px] font-bold text-indigo-300 bg-indigo-900/30 px-2 py-1 rounded border border-indigo-500/20 whitespace-nowrap">{{ p.number }}</code>
                    </td>
                    <td class="px-5 py-4">
                      <a [routerLink]="['/projects', p.number]" class="font-bold text-slate-200 hover:text-white transition-colors block min-w-[200px]">
                        {{ p.name }}
                      </a>
                      <div class="text-[11px] text-slate-500 mt-1 flex items-center gap-1"><span class="material-icons text-[12px]">person</span> {{ p.manager }}</div>
                    </td>
                    <td class="px-5 py-4 text-sm text-slate-400">{{ p.dept }}</td>
                    <td class="px-5 py-4 text-sm font-bold text-emerald-400 whitespace-nowrap">{{ p.budget }}</td>
                    <td class="px-5 py-4">
                      <div class="inline-flex items-center px-2.5 py-1 bg-blue-900/30 text-blue-300 border border-blue-500/20 rounded-md text-[11px] font-bold tracking-wide whitespace-nowrap">
                        {{ p.gate }}
                      </div>
                    </td>
                    <td class="px-5 py-4">
                      <span class="inline-block px-2.5 py-1 bg-slate-800 border border-slate-700 text-slate-300 rounded-md text-[11px] font-bold whitespace-nowrap shadow-sm">
                        {{ p.pendingWith }}
                      </span>
                    </td>
                    <td class="px-5 py-4">
                      <span class="inline-flex px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider border whitespace-nowrap"
                            [ngClass]="{
                              'bg-red-900/30 text-red-300 border-red-500/30': p.priority === 'critical',
                              'bg-orange-900/30 text-orange-300 border-orange-500/30': p.priority === 'high',
                              'bg-yellow-900/30 text-yellow-300 border-yellow-500/30': p.priority === 'medium',
                              'bg-slate-800 text-slate-400 border-slate-700': p.priority === 'low'
                            }">
                        {{ p.priority }}
                      </span>
                    </td>
                    <td class="px-5 py-4">
                      <span class="inline-flex px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider border whitespace-nowrap"
                            [ngClass]="{
                              'bg-emerald-900/30 text-emerald-400 border-emerald-500/30': p.status.toLowerCase() === 'completed',
                              'bg-amber-900/30 text-amber-400 border-amber-500/30': p.status.toLowerCase() === 'pending',
                              'bg-indigo-900/30 text-indigo-300 border-indigo-500/30': p.status.toLowerCase() === 'active',
                              'bg-violet-900/30 text-violet-300 border-violet-500/30': p.status.toLowerCase() === 'in_delivery',
                              'bg-slate-800 text-slate-400 border-slate-700': p.status.toLowerCase() === 'on_hold'
                            }">
                        {{ p.status }}
                      </span>
                      <div class="w-full bg-slate-800 rounded-full h-1.5 mt-2.5 overflow-hidden border border-slate-700">
                        <div class="bg-gradient-to-r from-indigo-500 to-purple-500 h-1.5 rounded-full" [style.width.%]="p.progress"></div>
                      </div>
                    </td>
                    <td class="px-5 py-4">
                      <div class="flex items-center justify-center gap-2">
                        <a [routerLink]="['/projects', p.number]" class="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:bg-indigo-600 hover:border-indigo-500 flex items-center justify-center transition-all shadow-sm" title="View Details">
                          <span class="material-icons text-[16px]">visibility</span>
                        </a>
                        <a [routerLink]="['/gate-review']" [queryParams]="{ projectId: p.id }" class="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:bg-emerald-600 hover:border-emerald-500 flex items-center justify-center transition-all shadow-sm" title="Gate Review">
                          <span class="material-icons text-[16px]">fact_check</span>
                        </a>
                      </div>
                    </td>
                  </tr>
                }
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .animate-pulse-slow {
      animation: pulse 8s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: .7; transform: scale(1.05); }
    }
    .glass-card {
      background: rgba(30, 41, 59, 0.7);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
    }
    .custom-select {
      appearance: none;
      background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%2394a3b8' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
      background-position: right 0.75rem center;
      background-repeat: no-repeat;
      background-size: 1.25em 1.25em;
    }
  `]
})
export class ProjectListComponent implements OnInit {
  private cache = inject(ProjectListCacheService);

  // "loading" only reflects the state relevant to showing the blocking spinner
  // (i.e. true first load) — a background refresh with data already on screen
  // surfaces as the small "refreshing" indicator instead, never a blocking spinner.
  loading = computed(() => this.cache.loading());
  refreshing = computed(() => this.cache.loading() && this.cache.items().length > 0);

  projects = computed<MappedProject[]>(() => this.cache.items().map(p => mapProjectToRow(p)));
  filtered = signal<MappedProject[]>([]);

  searchTerm = '';
  statusFilter = '';
  priorityFilter = '';

  constructor() {
    // Re-apply filters whenever the underlying (cached or freshly-fetched) project list changes.
    effect(() => {
      this.applyFilters(this.projects());
    });
  }

  ngOnInit(): void {
    this.cache.refresh();
  }

  applyFilters(source: MappedProject[] = this.projects()): void {
    this.filtered.set(
      source.filter(p => {
        const matchSearch = !this.searchTerm ||
          p.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
          p.number.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
          p.dept.toLowerCase().includes(this.searchTerm.toLowerCase());
        const matchStatus = !this.statusFilter || p.status.toLowerCase() === this.statusFilter.toLowerCase();
        const matchPriority = !this.priorityFilter || p.priority.toLowerCase() === this.priorityFilter.toLowerCase();
        return matchSearch && matchStatus && matchPriority;
      })
    );
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.statusFilter = '';
    this.priorityFilter = '';
    this.applyFilters();
  }
}

function mapProjectToRow(p: Project): MappedProject {
  const progress = calculateProjectProgress(p.current_stage, p.status);
  const isCompleted = ['completed', 'in_delivery'].includes(p.status?.toLowerCase() || '');
  const formattedBudget = formatBudget(p.budget_estimated);

  let dueDate = 'N/A';
  if (p.requested_end_date) {
    dueDate = new Date(p.requested_end_date).toISOString().split('T')[0];
  }

  let pendingTeam = 'Unknown';
  const role = (p.current_owner_role || '').toLowerCase();
  if (role === 'bta') pendingTeam = 'BTA Team';
  else if (role === 'eac') pendingTeam = 'EAC Team';
  else if (role === 'trc') pendingTeam = 'TRC Team';
  else if (role === 'admin') pendingTeam = 'Admin';
  else if (role === 'project_manager') pendingTeam = 'Project Manager';
  else if (isCompleted) pendingTeam = 'None';
  else pendingTeam = role.toUpperCase() || 'BTA Team';

  return {
    id: p.id,
    number: p.project_number,
    name: p.project_name,
    dept: p.department || p.business_unit || 'N/A',
    manager: p.project_manager?.full_name || 'Unassigned',
    budget: formattedBudget,
    gate: p.current_stage || 'Intake',
    priority: p.priority || 'medium',
    status: p.status || 'pending',
    progress: progress,
    due: dueDate,
    pendingWith: pendingTeam
  };
}
