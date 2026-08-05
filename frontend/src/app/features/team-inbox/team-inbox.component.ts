import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
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
  imports: [CommonModule],
  template: `
    <div class="animate-fade-in p-6 bg-enterprise-bg min-h-full">
      <div class="flex items-center justify-between mb-8">
        <div>
          <h1 class="font-display text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
            <span class="material-icons text-enterprise-primary text-[32px]">inbox</span>
            Pending Reviews: {{ teamName() }}
          </h1>
          <p class="text-sm font-medium text-gray-500 mt-1">Manage and process governance tasks awaiting your team's decision.</p>
        </div>
        <div class="flex items-center gap-4">
            <div class="relative">
                <span class="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">search</span>
                <input type="text" placeholder="Search tasks..." 
                       class="pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm shadow-sm focus:ring-2 focus:ring-enterprise-primary focus:border-enterprise-primary outline-none transition-all w-64">
            </div>
            <button class="bg-white border border-gray-200 shadow-sm text-gray-700 w-10 h-10 rounded-lg flex items-center justify-center hover:bg-gray-50 transition-colors">
                <span class="material-icons text-[20px]">filter_list</span>
            </button>
            <button class="bg-white border border-gray-200 shadow-sm text-gray-700 w-10 h-10 rounded-lg flex items-center justify-center hover:bg-gray-50 transition-colors" (click)="refresh()">
                <span class="material-icons text-[20px]">refresh</span>
            </button>
        </div>
      </div>

      <div class="bg-white rounded-2xl shadow-enterprise-soft border border-gray-100 overflow-hidden">
        <div class="px-6 py-5 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
            <h3 class="font-bold text-gray-800 text-lg flex items-center gap-2">
                Task Queue
                <span class="bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded-full font-bold ml-2">{{ tasks().length }} tasks</span>
            </h3>
        </div>

        <div class="overflow-x-auto">
            <table class="w-full text-left">
                <thead>
                    <tr class="bg-white border-b border-gray-100 text-[10px] uppercase tracking-widest text-gray-400 font-extrabold">
                        <th class="px-6 py-4">Project ID</th>
                        <th class="px-6 py-4 w-1/4">Project Name</th>
                        <th class="px-6 py-4">Required Action</th>
                        <th class="px-6 py-4">Priority</th>
                        <th class="px-6 py-4">Submitted By</th>
                        <th class="px-6 py-4">Date</th>
                        <th class="px-6 py-4 text-right">Action</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-50 text-sm">
                    @for (task of tasks(); track task.id) {
                        <tr class="hover:bg-indigo-50/50 transition-colors group cursor-pointer" (click)="openTask(task)">
                            <td class="px-6 py-4 font-bold text-enterprise-primary">{{ task.projectNumber }}</td>
                            <td class="px-6 py-4 font-semibold text-gray-800">{{ task.projectName }}</td>
                            <td class="px-6 py-4">
                                <div class="flex items-center gap-2">
                                    <span class="material-icons text-gray-400 text-[16px]">{{ getIconForTask(task.type) }}</span>
                                    <span class="font-medium text-gray-700">{{ task.type }}</span>
                                </div>
                            </td>
                            <td class="px-6 py-4">
                                <span class="text-xs font-bold px-2 py-1 rounded-md uppercase tracking-wider inline-flex items-center gap-1"
                                      [ngClass]="{
                                        'bg-rose-100 text-rose-700': task.priority.toLowerCase() === 'critical',
                                        'bg-orange-100 text-orange-700': task.priority.toLowerCase() === 'high',
                                        'bg-blue-100 text-blue-700': task.priority.toLowerCase() === 'medium',
                                        'bg-green-100 text-green-700': task.priority.toLowerCase() === 'low'
                                      }">
                                    {{ task.priority }}
                                </span>
                            </td>
                            <td class="px-6 py-4 text-gray-600 font-medium">{{ task.submittedBy }}</td>
                            <td class="px-6 py-4 text-gray-500 text-xs">{{ task.submittedDate }}</td>
                            <td class="px-6 py-4 text-right">
                                <button class="btn border border-gray-200 text-gray-700 hover:border-enterprise-primary hover:text-white hover:bg-enterprise-primary px-4 py-2 rounded-lg text-xs font-bold bg-white transition-all shadow-sm flex items-center justify-center gap-1 ml-auto group-hover:bg-enterprise-primary group-hover:text-white group-hover:border-enterprise-primary">
                                    <span class="material-icons text-[16px]">play_arrow</span> Open Workspace
                                </button>
                            </td>
                        </tr>
                    } @empty {
                        <tr>
                            <td colspan="7" class="py-16 text-center">
                                <div class="flex flex-col items-center gap-4">
                                    <div class="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center">
                                        <span class="material-icons text-green-500 text-[32px]">task_alt</span>
                                    </div>
                                    <div>
                                        <h3 class="text-lg font-bold text-gray-800">You're all caught up!</h3>
                                        <p class="text-sm text-gray-500 mt-1">There are no pending tasks for the {{ teamName() }}.</p>
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
  `,
  styles: []
})
export class TeamInboxComponent implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);

  userRole = computed(() => this.authService.userRole());

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
