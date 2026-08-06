import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { BtaRequestService } from '../../core/services/bta-request.service';
import { EacRequestService } from '../../core/services/eac-request.service';
import { PicRequestService } from '../../core/services/pic-request.service';
import { EpmoRequestService } from '../../core/services/epmo-request.service';
import { FinanceRequestService } from '../../core/services/finance-request.service';

@Component({
  selector: 'app-team-inbox',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="animate-fade-in min-h-[calc(100vh-4rem)] bg-[#0f172a] text-slate-100 relative overflow-hidden font-sans pb-10">
      <!-- Deep Gradient Background -->
      <div class="absolute inset-0 bg-gradient-to-br from-[#0f172a] via-[#1e1b4b] to-[#0f172a] z-0"></div>
      <div class="absolute top-0 left-0 w-[800px] h-[800px] bg-indigo-600/10 rounded-full blur-3xl mix-blend-screen pointer-events-none transform -translate-x-1/2 -translate-y-1/2"></div>
      <div class="absolute bottom-0 right-0 w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-3xl mix-blend-screen pointer-events-none transform translate-x-1/3 translate-y-1/3"></div>

      <div class="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <div class="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h1 class="font-display text-3xl font-bold text-white tracking-tight flex items-center gap-3 drop-shadow-md">
              <span class="material-icons text-indigo-400 text-[32px]">inbox</span>
              Pending Reviews: {{ teamName() }}
            </h1>
            <p class="text-sm font-medium text-slate-400 mt-1">Manage and process governance tasks awaiting your team's decision.</p>
          </div>
          
          <div class="flex flex-wrap items-center gap-4">
              <!-- Search Bar -->
              <div class="relative search-wrapper group">
                  <span class="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm group-focus-within:text-indigo-400 transition-colors">search</span>
                  <input type="text" placeholder="Search by Project ID..." 
                         [(ngModel)]="searchQuery"
                         class="premium-input pl-9 pr-4 h-10 w-64">
                  @if (searchQuery()) {
                    <button class="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors" (click)="searchQuery.set('')">
                      <span class="material-icons text-[14px]">close</span>
                    </button>
                  }
              </div>

              <!-- Filter Dropdown -->
              <div class="relative filter-wrapper group">
                  <span class="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px] group-focus-within:text-indigo-400 transition-colors">filter_list</span>
                  <select [(ngModel)]="filterAction" class="premium-input pl-9 pr-8 h-10 appearance-none cursor-pointer w-48">
                    <option value="">All Required Actions</option>
                    <option value="EPMO">EPMO Review</option>
                    <option value="BTA">BTA Review</option>
                    <option value="Finance">Finance Review</option>
                    <option value="EAC">EAC Review</option>
                    <option value="PIC">PIC Review</option>
                    <option value="Gate">Gate Review</option>
                    <option value="Security">Security Review</option>
                  </select>
                  <span class="material-icons absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px] pointer-events-none">expand_more</span>
              </div>

              <button class="premium-btn-icon w-10 h-10 flex items-center justify-center transition-all" (click)="refresh()" title="Refresh Tasks">
                  <span class="material-icons text-[20px]">refresh</span>
              </button>
          </div>
        </div>

        <div class="bg-white/5 backdrop-blur-md rounded-2xl premium-shadow border border-white/10 overflow-hidden relative">
          <!-- Inner subtle glow -->
          <div class="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/10 pointer-events-none"></div>

          <div class="px-6 py-5 border-b border-white/10 bg-slate-900/40 flex justify-between items-center relative z-10">
              <h3 class="font-bold text-white text-lg flex items-center gap-2 drop-shadow-md">
                  Task Queue
                  <span class="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs px-2 py-0.5 rounded-full font-bold ml-2 shadow-sm">{{ filteredTasks().length }} tasks</span>
              </h3>
          </div>

          <div class="overflow-x-auto relative z-10">
              <table class="w-full table-fixed text-left premium-table">
                  <thead>
                      <tr class="bg-slate-900/60 border-b border-white/5 text-xs uppercase tracking-wider text-slate-300 font-bold">
                          <th class="px-6 py-4 whitespace-nowrap font-medium tracking-wide w-[12%]">Project ID</th>
                          <th class="px-6 py-4 font-medium tracking-wide w-[20%]">Project Name</th>
                          <th class="px-6 py-4 whitespace-nowrap font-medium tracking-wide w-[15%]">Required Action</th>
                          <th class="px-6 py-4 whitespace-nowrap font-medium tracking-wide w-[10%]">Forward</th>
                          <th class="px-6 py-4 whitespace-nowrap font-medium tracking-wide w-[10%]">Priority</th>
                          <th class="px-6 py-4 whitespace-nowrap font-medium tracking-wide w-[12%]">Submitted By</th>
                          <th class="px-6 py-4 whitespace-nowrap font-medium tracking-wide w-[11%]">Date</th>
                          <th class="px-6 py-4 text-right font-medium tracking-wide w-[10%]">Action</th>
                      </tr>
                  </thead>
                  <tbody class="divide-y divide-white/5 text-sm">
                      @for (task of filteredTasks(); track task.id) {
                          <tr class="hover-row transition-all duration-300 cursor-pointer group" (click)="openTask(task)">
                              <!-- 1. Project ID Column -->
                              <td class="px-6 py-4 font-bold text-indigo-300 group-hover:text-indigo-200 transition-colors w-[12%]">{{ task.projectNumber }}</td>
                              
                              <!-- 2. Project Name Column -->
                              <td class="px-6 py-4 font-semibold text-slate-200 group-hover:text-white transition-colors w-[20%] truncate" title="{{ task.projectName }}">{{ task.projectName }}</td>
                              
                              <!-- 3. Required Action Column -->
                              <td class="px-6 py-4 w-[15%]">
                                  <div class="flex items-center gap-2">
                                      <span class="action-icon-wrapper flex items-center justify-center rounded-md p-1.5 bg-slate-800 text-slate-400 group-hover:bg-indigo-500/20 group-hover:text-indigo-300 transition-colors border border-white/5 group-hover:border-indigo-500/30">
                                        <span class="material-icons text-[16px]">{{ getIconForTask(task.type) }}</span>
                                      </span>
                                      <span class="font-semibold text-slate-300 group-hover:text-slate-200 transition-colors">{{ task.type }}</span>
                                  </div>
                              </td>
                              
                              <!-- 4. Forward Column -->
                              <td class="px-6 py-4 font-semibold text-slate-300 group-hover:text-slate-200 transition-colors w-[10%]">{{ task.forwardTo }}</td>
                              
                              <!-- 5. Priority Column -->
                              <td class="px-6 py-4 w-[10%]">
                                  <span class="text-[11px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider inline-flex items-center gap-1 shadow-sm backdrop-blur-sm"
                                        [ngClass]="{
                                          'bg-rose-500/20 text-rose-300 border border-rose-500/30': (task.priority || '').toLowerCase() === 'critical',
                                          'bg-orange-500/20 text-orange-300 border border-orange-500/30': (task.priority || '').toLowerCase() === 'high',
                                          'bg-blue-500/20 text-blue-300 border border-blue-500/30': (task.priority || '').toLowerCase() === 'medium',
                                          'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30': (task.priority || '').toLowerCase() === 'low'
                                        }">
                                      {{ task.priority }}
                                  </span>
                              </td>
                              
                              <!-- 6. Submitted By Column -->
                              <td class="px-6 py-4 text-slate-400 font-medium group-hover:text-slate-300 transition-colors w-[12%] truncate" title="{{ task.submittedBy }}">{{ task.submittedBy }}</td>
                              
                              <!-- 7. Date Column -->
                              <td class="px-6 py-4 text-slate-400 text-xs font-medium group-hover:text-slate-300 transition-colors w-[11%]">{{ task.submittedDate }}</td>
                              
                              <!-- 8. Action Column -->
                              <td class="px-6 py-4 text-right w-[10%]">
                                  <button class="btn-premium-action px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1 ml-auto">
                                      <span class="material-icons text-[16px]">play_arrow</span> Open Workspace
                                  </button>
                              </td>
                          </tr>
                      } @empty {
                          <tr>
                              <td colspan="8" class="py-12 px-6">
                                  <div class="flex flex-col items-center justify-center py-16 px-4 bg-slate-900/30 rounded-2xl border-2 border-dashed border-white/10 transition-all hover:bg-slate-900/50 hover:border-white/20">
                                      @if (searchQuery() || filterAction()) {
                                        <div class="w-20 h-20 rounded-full bg-slate-800/80 shadow-inner flex items-center justify-center mb-5 border border-white/10">
                                            <span class="material-icons text-slate-500 text-[40px]">search_off</span>
                                        </div>
                                        <div class="max-w-sm text-center">
                                            <h3 class="text-xl font-extrabold text-white drop-shadow-sm">No matching tasks found</h3>
                                            <p class="text-sm text-slate-400 mt-2 leading-relaxed">We couldn't find any pending reviews matching your current search or filter criteria.</p>
                                            <button class="mt-6 border border-white/10 text-slate-300 hover:text-white hover:bg-white/5 hover:border-white/20 px-6 py-2.5 rounded-lg text-sm font-bold bg-slate-800/50 transition-all shadow-sm flex items-center justify-center gap-2 mx-auto" (click)="searchQuery.set(''); filterAction.set('')">
                                              <span class="material-icons text-[18px]">filter_alt_off</span> Clear All Filters
                                            </button>
                                        </div>
                                      } @else {
                                        <div class="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center mb-5 border border-emerald-500/20 shadow-inner">
                                            <span class="material-icons text-emerald-400 text-[40px]">task_alt</span>
                                        </div>
                                        <div class="max-w-sm text-center">
                                            <h3 class="text-xl font-extrabold text-white drop-shadow-sm">You're all caught up!</h3>
                                            <p class="text-sm text-slate-400 mt-2 leading-relaxed">Amazing work! There are currently no pending tasks requiring action from the {{ teamName() }}.</p>
                                        </div>
                                      }
                                  </div>
                              </td>
                          </tr>
                      }
                  </tbody>
              </table>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .premium-shadow {
      box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.5), 0 0 20px rgba(99, 102, 241, 0.1);
    }
    
    .premium-input {
      background-color: rgba(30, 41, 59, 0.7);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      color: #f1f5f9;
      font-size: 14px;
      font-weight: 500;
      box-shadow: inset 0 2px 4px 0 rgba(0, 0, 0, 0.05);
      backdrop-filter: blur(8px);
      transition: all 0.2s ease;
      
      &::placeholder {
        color: #64748b;
      }
      
      &:focus {
        border-color: rgba(99, 102, 241, 0.5);
        background-color: rgba(30, 41, 59, 0.9);
        box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
        outline: none;
      }

      option {
        background-color: #1e293b;
        color: #f1f5f9;
      }
    }

    .premium-btn-icon {
      background-color: rgba(30, 41, 59, 0.7);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      color: #94a3b8;
      backdrop-filter: blur(8px);
      
      &:hover {
        background-color: rgba(255, 255, 255, 0.1);
        color: #f8fafc;
        border-color: rgba(255, 255, 255, 0.2);
      }
    }

    .hover-row {
      transition: all 0.3s ease;
      &:hover {
        background-color: rgba(255, 255, 255, 0.05);

        .btn-premium-action {
          background-color: #6366f1;
          color: #ffffff;
          border-color: rgba(99, 102, 241, 0.8);
          transform: translateY(-1px);
          box-shadow: 0 8px 16px -4px rgba(99, 102, 241, 0.4);
        }
      }
    }

    .btn-premium-action {
      background-color: rgba(30, 41, 59, 0.7);
      color: #e2e8f0;
      border: 1px solid rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(4px);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
  `]
})
export class TeamInboxComponent implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);

  userRole = computed(() => this.authService.userRole());

  // Search and Filter State
  searchQuery = signal('');
  filterAction = signal('');

  teamName = computed(() => {
    const role = (this.userRole() || '').toLowerCase();
    if (role === 'bta') return 'Business Tech Advocate (BTA)';
    if (role === 'admin') return 'BTA ADMIN';
    if (role === 'security') return 'InfoSec';
    if (role === 'finance') return 'Finance';
    if (role === 'eac') return 'Enterprise Architecture Council (EAC)';
    if (role === 'pic') return 'Project Investment Committee (PIC)';
    return this.userRole() ? this.userRole()!.toUpperCase() : 'Team';
  });

  private btaRequestService = inject(BtaRequestService);
  private eacRequestService = inject(EacRequestService);
  private picRequestService = inject(PicRequestService);
  private epmoRequestService = inject(EpmoRequestService);
  private financeRequestService = inject(FinanceRequestService);

  tasks = computed(() => {
    const role = (this.userRole() || '').toLowerCase();
    const epmoRequests = this.epmoRequestService.requests();
    const btaRequests = this.btaRequestService.requests();
    const eacRequests = this.eacRequestService.requests();
    const picRequests = this.picRequestService.requests();
    const financeRequests = this.financeRequestService.requests();
    let userTasks: any[] = [];

    if (role === 'admin') {
      userTasks = [...epmoRequests, ...btaRequests, ...financeRequests, ...eacRequests, ...picRequests];
    } else if (role === 'epmo') {
      userTasks = epmoRequests;
    } else if (role === 'bta') {
      userTasks = [...btaRequests, ...eacRequests.filter(r => r.type === 'Prepare for EAC')];
    } else if (role === 'finance') {
      userTasks = financeRequests;
    } else if (role === 'eac') {
      userTasks = eacRequests;
    } else if (role === 'pic') {
      userTasks = picRequests.filter(r => r.type === 'PIC Meeting' || r.type === 'Prepare for PIC');
    } else if (role === 'project_manager') {
      userTasks = eacRequests.filter(r => r.type === 'Prepare for EAC');
    } else {
      userTasks = [...btaRequests, ...financeRequests, ...eacRequests, ...picRequests];
    }
    return userTasks;
  });

  // Derived state that applies active filters
  filteredTasks = computed(() => {
    let currentTasks = this.tasks();
    const query = this.searchQuery().toLowerCase().trim();
    const action = this.filterAction().toLowerCase().trim();

    if (query) {
      currentTasks = currentTasks.filter(task =>
        (task.projectNumber && task.projectNumber.toLowerCase().includes(query)) ||
        (task.projectName && task.projectName.toLowerCase().includes(query))
      );
    }

    if (action) {
      currentTasks = currentTasks.filter(task =>
        task.type && task.type.toLowerCase().includes(action)
      );
    }

    return currentTasks;
  });

  ngOnInit() {
    this.refresh();
  }

  refresh() {
    this.epmoRequestService.refreshRequests();
    this.btaRequestService.refreshRequests();
    this.eacRequestService.refreshRequests();
    this.picRequestService.refreshRequests();
    this.financeRequestService.refreshRequests();
  }

  getIconForTask(type: string): string {
    if (type.includes('EPMO')) return 'architecture';
    if (type.includes('BTA')) return 'explore';
    if (type.includes('Finance')) return 'account_balance';
    if (type.includes('Security')) return 'security';
    if (type.includes('Gate')) return 'fact_check';
    if (type.includes('EAC')) return 'groups';
    if (type.includes('PIC')) return 'assured_workload';
    return 'assignment';
  }

  openTask(task: any) {
    if (task.projectId) {
      this.router.navigate([`/workspace/${task.projectId}`]);
    } else {
      console.log('Navigating to task without direct project ID:', task);
    }
  }
}
