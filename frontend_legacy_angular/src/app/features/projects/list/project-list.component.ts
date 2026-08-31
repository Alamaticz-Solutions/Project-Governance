import { Component, signal, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ProjectService } from '../../../core/services/project.service';

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
    <div class="animate-fade-in">
      <!-- Header -->
      <div class="page-header flex items-center justify-between">
        <div>
          <h1 class="page-title">All Projects</h1>
          <p class="page-subtitle">{{ filtered().length }} of {{ projects.length }} projects</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-secondary">
            <span class="material-icons">download</span>
            Export
          </button>
          <a routerLink="/intake" class="btn btn-primary">
            <span class="material-icons">add</span>
            New Proposal
          </a>
        </div>
      </div>

      <!-- Filters -->
      <div class="filter-bar card mb-6">
        <div class="card-body" style="padding: 16px 20px; display:flex; gap:12px; align-items:center; flex-wrap:wrap">
          <div class="search-box" style="flex:1; min-width:200px">
            <span class="material-icons search-icon">search</span>
            <input
              type="text"
              placeholder="Search projects..."
              class="search-input"
              [(ngModel)]="searchTerm"
              (input)="applyFilters()"
            />
          </div>

          <select class="form-control" style="width:150px" [(ngModel)]="statusFilter" (change)="applyFilters()">
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
            <option value="on_hold">On Hold</option>
          </select>

          <select class="form-control" style="width:150px" [(ngModel)]="priorityFilter" (change)="applyFilters()">
            <option value="">All Priority</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          <button class="btn btn-secondary btn-sm" (click)="clearFilters()">
            <span class="material-icons">filter_alt_off</span>
            Clear
          </button>
        </div>
      </div>

      <!-- Table -->
      <div class="card">
        <table class="data-table">
          <thead>
            <tr>
              <th>Project Number</th>
              <th>Project Name</th>
              <th>Department</th>
              <th>Manager</th>
              <th>Budget</th>
              <th>Current Stage</th>
              <th>Pending With</th>
              <th>Priority</th>
              <th>Progress</th>
              <th>Status</th>
              <th>Due Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            @if (filtered().length === 0) {
              <tr>
                <td colspan="11">
                  <div class="empty-state" style="padding: 48px">
                    <span class="material-icons empty-icon">folder_open</span>
                    <h3>No projects found</h3>
                    <p>Try adjusting your filters or create a new proposal</p>
                  </div>
                </td>
              </tr>
            }
            @for (p of filtered(); track p.id) {
              <tr>
                <td>
                  <code style="font-size:11px; color:#0052CC; font-weight:700">{{ p.number }}</code>
                </td>
                <td>
                  <a [routerLink]="['/projects', p.number]" style="font-weight:600; color:#172B4D; text-decoration:none"
                     class="project-link">{{ p.name }}</a>
                </td>
                <td class="text-sm text-secondary">{{ p.dept }}</td>
                <td class="text-sm">{{ p.manager }}</td>
                <td class="text-sm font-semibold">{{ p.budget }}</td>
                <td>
                  <div class="gate-pill">{{ p.gate }}</div>
                </td>
                <td>
                  <span class="team-badge">{{ p.pendingWith }}</span>
                </td>
                <td><span class="badge" [class]="'badge-' + p.priority">{{ p.priority }}</span></td>
                <td style="min-width:120px">
                  <div class="progress-bar">
                    <div class="progress-fill" [style.width.%]="p.progress"></div>
                  </div>
                  <div class="text-xs text-muted" style="margin-top:4px">{{ p.progress }}%</div>
                </td>
                <td><span class="badge" [class]="'badge-' + p.status">{{ p.status }}</span></td>
                <td class="text-sm text-secondary">{{ p.due }}</td>
                <td>
                  <div class="flex gap-2">
                    <a [routerLink]="['/projects', p.number]" class="icon-action" title="View">
                      <span class="material-icons">visibility</span>
                    </a>
                    <a [routerLink]="['/gate-review']" [queryParams]="{ projectId: p.id }" class="icon-action" title="Gate Review">
                      <span class="material-icons">fact_check</span>
                    </a>
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: [`
    .search-box {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #F7F8FC;
      border: 1.5px solid #DFE3ED;
      border-radius: 8px;
      padding: 6px 12px;

      &:focus-within {
        border-color: #0052CC;
        background: #fff;
        box-shadow: 0 0 0 3px rgba(0,82,204,0.1);
      }
    }

    .search-icon { font-size: 18px; color: #97A0AF; }

    .search-input {
      border: none;
      background: transparent;
      outline: none;
      font-size: 13px;
      color: #172B4D;
      width: 100%;
      &::placeholder { color: #97A0AF; }
    }

    .gate-pill {
      display: inline-flex;
      align-items: center;
      padding: 3px 10px;
      background: #E3F0FF;
      color: #0052CC;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 800;
      font-family: 'Outfit', sans-serif;
      letter-spacing: 0.3px;
    }

    .team-badge {
      display: inline-block;
      padding: 3px 8px;
      background: #F4F5F7;
      color: #42526E;
      border: 1px solid #DFE1E6;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
    }

    .project-link:hover { color: #0052CC; text-decoration: underline; }

    .icon-action {
      width: 30px;
      height: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 6px;
      border: 1px solid #DFE3ED;
      background: transparent;
      cursor: pointer;
      color: #6B778C;
      text-decoration: none;
      transition: all 200ms;

      .material-icons { font-size: 16px; }
      &:hover { background: #E3F0FF; color: #0052CC; border-color: #0052CC; }
    }
  `]
})
export class ProjectListComponent implements OnInit {
  private projectService = inject(ProjectService);
  projects: MappedProject[] = [];
  filtered = signal<MappedProject[]>([]);
  searchTerm = '';
  statusFilter = '';
  priorityFilter = '';

  ngOnInit(): void {
    this.loadProjects();
  }

  loadProjects(): void {
    this.projectService.getProjects({ page_size: 100 }).subscribe({
      next: (res) => {
        this.projects = res.items.map(p => {
          // Calculate progress percentage based on stage
          const stageOrders: { [key: string]: number } = {
            'BTA Review': 1,
            'Prepare for EAC': 2,
            'EAC Committee Review': 3,
            'EAC Review': 3,
            'EAC Meeting': 3,
            'TRC Vetting & Gate Review': 4
          };
          const currentStage = p.current_stage || 'BTA Review';
          const order = stageOrders[currentStage] || 1;
          const isCompleted = p.status?.toLowerCase() === 'completed';
          const progress = isCompleted ? 100 : Math.round((order / 5) * 100);

          let formattedBudget = 'N/A';
          if (p.budget_estimated) {
            formattedBudget = p.budget_estimated >= 1000000 
              ? `$${(p.budget_estimated / 1000000).toFixed(1)}M`
              : `$${Math.round(p.budget_estimated / 1000)}K`;
          }

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
        });
        this.applyFilters();
      },
      error: (err) => console.error('Failed to load projects', err)
    });
  }

  applyFilters(): void {
    this.filtered.set(
      this.projects.filter(p => {
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
