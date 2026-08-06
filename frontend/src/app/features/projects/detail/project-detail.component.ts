import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ProjectService } from '../../../core/services/project.service';

@Component({
  selector: 'app-project-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="animate-fade-in min-h-[calc(100vh-4rem)] bg-[#0f172a] text-slate-100 relative overflow-hidden font-sans pb-10">
      <!-- Deep Gradient Background -->
      <div class="absolute inset-0 bg-gradient-to-br from-slate-900 via-[#111827] to-[#1e1b4b] z-0 fixed"></div>
      <div class="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] bg-blue-600/20 rounded-full blur-[150px] pointer-events-none mix-blend-screen z-0 animate-pulse-slow fixed"></div>
      <div class="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-purple-600/20 rounded-full blur-[120px] pointer-events-none mix-blend-screen z-0 fixed"></div>

      <!-- Loading State -->
      <div class="relative z-10 flex flex-col items-center justify-center p-24" *ngIf="isLoading()">
        <span class="material-icons text-indigo-400 text-6xl animate-spin">refresh</span>
        <h3 class="mt-4 text-xl font-bold text-slate-200">Loading Project Data...</h3>
      </div>

      <!-- Error State -->
      <div class="relative z-10 flex flex-col items-center justify-center p-24" *ngIf="isNotFound()">
        <span class="material-icons text-red-400 text-7xl">error_outline</span>
        <h3 class="mt-4 text-2xl font-bold text-white">Project Not Found</h3>
        <p class="text-slate-400 mt-2">The project you are looking for does not exist or was deleted.</p>
        <a routerLink="/projects" class="mt-6 bg-slate-800 border border-slate-700 text-white px-6 py-3 rounded-xl font-bold hover:bg-slate-700 transition-colors shadow-md inline-flex items-center gap-2">
          <span class="material-icons text-xl">arrow_back</span> Return to All Projects
        </a>
      </div>

      <div class="max-w-7xl mx-auto p-6 lg:p-8 relative z-10" *ngIf="!isLoading() && !isNotFound() && project()">
        
        <!-- Header -->
        <div class="flex flex-col md:flex-row md:items-center justify-between mb-8 pb-6 border-b border-slate-700/50">
          <div>
            <a routerLink="/projects" class="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-bold mb-4">
              <span class="material-icons text-lg">arrow_back</span> All Projects
            </a>
            <h1 class="text-3xl font-extrabold text-white tracking-tight">{{ project()?.project_name }}</h1>
            <div class="flex flex-wrap gap-3 mt-3 items-center">
              <code class="text-xs font-bold text-indigo-300 bg-indigo-900/30 px-2.5 py-1 rounded-md border border-indigo-500/20">
                {{ project()?.project_number }}
              </code>
              <span class="px-2.5 py-1 rounded-md text-[10px] font-extrabold uppercase tracking-wider border whitespace-nowrap"
                    [ngClass]="{
                      'bg-emerald-900/30 text-emerald-400 border-emerald-500/30': project()?.status?.toLowerCase() === 'completed',
                      'bg-amber-900/30 text-amber-400 border-amber-500/30': project()?.status?.toLowerCase() === 'pending',
                      'bg-indigo-900/30 text-indigo-300 border-indigo-500/30': project()?.status?.toLowerCase() === 'active',
                      'bg-slate-800 text-slate-400 border-slate-700': project()?.status?.toLowerCase() === 'on_hold',
                      'bg-red-900/30 text-red-400 border-red-500/30': project()?.status?.toLowerCase() === 'cancelled' || project()?.status?.toLowerCase() === 'rejected'
                    }">
                {{ project()?.status }}
              </span>
              <span class="px-2.5 py-1 rounded-md text-[10px] font-extrabold uppercase tracking-wider border whitespace-nowrap"
                    [ngClass]="{
                      'bg-red-900/30 text-red-300 border-red-500/30': project()?.priority?.toLowerCase() === 'critical',
                      'bg-orange-900/30 text-orange-300 border-orange-500/30': project()?.priority?.toLowerCase() === 'high',
                      'bg-yellow-900/30 text-yellow-300 border-yellow-500/30': project()?.priority?.toLowerCase() === 'medium',
                      'bg-slate-800 text-slate-400 border-slate-700': project()?.priority?.toLowerCase() === 'low'
                    }">
                {{ project()?.priority }}
              </span>
            </div>
          </div>
          <div class="mt-6 md:mt-0" *ngIf="userRole() === 'admin' || userRole() === 'epmo'">
            <a [routerLink]="['/gate-review']" [queryParams]="{ projectId: project()?.id }" class="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-emerald-500/25 transition-all flex items-center gap-2 hover:scale-[1.02]">
              <span class="material-icons text-[18px]">fact_check</span> Gate Review
            </a>
          </div>
        </div>

        <!-- Tabs Navigation -->
        <div class="flex gap-2 mb-8 overflow-x-auto pb-2 scrollbar-hide">
          <button class="px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap border"
                  [ngClass]="activeTab() === 'intake' ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-500/25' : 'bg-slate-800/50 text-slate-400 border-slate-700/50 hover:bg-slate-700/50 hover:text-slate-200'"
                  (click)="activeTab.set('intake')">
             Intake Proposal
          </button>
          <button *ngIf="hasEpmoData()" 
                  class="px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap border"
                  [ngClass]="activeTab() === 'epmo' ? 'bg-purple-600 text-white border-purple-500 shadow-lg shadow-purple-500/25' : 'bg-slate-800/50 text-slate-400 border-slate-700/50 hover:bg-slate-700/50 hover:text-slate-200'"
                  (click)="activeTab.set('epmo')">
             EPMO Review
          </button>
          <button *ngIf="hasBtaData()" 
                  class="px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap border"
                  [ngClass]="activeTab() === 'bta' ? 'bg-orange-600 text-white border-orange-500 shadow-lg shadow-orange-500/25' : 'bg-slate-800/50 text-slate-400 border-slate-700/50 hover:bg-slate-700/50 hover:text-slate-200'"
                  (click)="activeTab.set('bta')">
             BTA Review
          </button>
          <button *ngIf="hasFinanceData()" 
                  class="px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap border"
                  [ngClass]="activeTab() === 'finance' ? 'bg-emerald-600 text-white border-emerald-500 shadow-lg shadow-emerald-500/25' : 'bg-slate-800/50 text-slate-400 border-slate-700/50 hover:bg-slate-700/50 hover:text-slate-200'"
                  (click)="activeTab.set('finance')">
             Finance Review
          </button>
          <button *ngIf="hasEacData()" 
                  class="px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap border"
                  [ngClass]="activeTab() === 'eac' ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-500/25' : 'bg-slate-800/50 text-slate-400 border-slate-700/50 hover:bg-slate-700/50 hover:text-slate-200'"
                  (click)="activeTab.set('eac')">
             EAC Architecture
          </button>
          <button *ngIf="hasPicData()" 
                  class="px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap border"
                  [ngClass]="activeTab() === 'pic' ? 'bg-rose-600 text-white border-rose-500 shadow-lg shadow-rose-500/25' : 'bg-slate-800/50 text-slate-400 border-slate-700/50 hover:bg-slate-700/50 hover:text-slate-200'"
                  (click)="activeTab.set('pic')">
             PIC Funding
          </button>
        </div>

        <div class="flex flex-col gap-6">
          
          <!-- Project Details Card -->
          <div class="glass-card rounded-2xl border border-slate-700/50 shadow-xl overflow-hidden">
            <div class="bg-slate-800/80 border-b border-slate-700/50 px-6 py-4">
              <h3 class="text-lg font-bold text-white">Project Details</h3>
            </div>
            <div class="p-6">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="detail-field">
                  <span class="field-label">Business Unit</span>
                  <span class="field-value">{{ project()?.business_unit }}</span>
                </div>
                <div class="detail-field">
                  <span class="field-label">Department</span>
                  <span class="field-value">{{ project()?.department || 'N/A' }}</span>
                </div>
                <div class="detail-field">
                  <span class="field-label">Project Sponsor</span>
                  <span class="field-value">{{ project()?.sponsor_name || 'N/A' }}</span>
                </div>
                <div class="detail-field">
                  <span class="field-label">Project Manager</span>
                  <span class="field-value flex items-center gap-2"><span class="material-icons text-sm text-slate-400">person</span> {{ project()?.project_manager?.full_name || 'Unassigned' }}</span>
                </div>
                <div class="detail-field">
                  <span class="field-label">Requestor Name</span>
                  <span class="field-value">{{ project()?.requestor_name || 'N/A' }}</span>
                </div>
                <div class="detail-field">
                  <span class="field-label">Request Type</span>
                  <span class="field-value">{{ project()?.request_type || 'N/A' }}</span>
                </div>
                <div class="detail-field">
                  <span class="field-label">Estimated Budget</span>
                  <span class="text-emerald-400 font-bold text-[15px]">
                    {{ (project()?.budget_estimated) | currency:'USD':'symbol':'1.0-0' }} <span class="text-slate-400 font-normal text-sm">({{ project()?.budget_type || 'CAPEX' }})</span>
                  </span>
                </div>
                <div class="detail-field">
                  <span class="field-label">Requested Timeline</span>
                  <span class="field-value">
                    {{ project()?.requested_start_date | date:'MMM yyyy' }} <span class="text-slate-500 mx-1">→</span> {{ project()?.requested_end_date | date:'MMM yyyy' }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- INTAKE DOSSIER -->
          <div class="glass-card rounded-2xl border border-slate-700/50 shadow-xl overflow-hidden animate-fade-in" *ngIf="activeTab() === 'intake'">
            <div class="bg-slate-800/80 border-b border-slate-700/50 px-6 py-4 flex justify-between items-center">
              <h3 class="text-lg font-bold text-white">Intake Proposal Summary</h3>
              <span class="px-2.5 py-1 rounded text-[10px] font-extrabold uppercase tracking-wider border bg-slate-800 text-slate-400 border-slate-700">READ-ONLY</span>
            </div>
            <div class="p-6 flex flex-col gap-6">
              
              <div class="dossier-section border-indigo-500">
                <h4 class="dossier-heading text-indigo-400">Core Objectives</h4>
                <div class="detail-field">
                  <span class="field-label">Problem or Opportunity Statement</span>
                  <p class="field-value dossier-text">{{ project()?.problem_statement || 'N/A' }}</p>
                </div>
                <div class="detail-field mt-4">
                  <span class="field-label">Desired Outcome</span>
                  <p class="field-value dossier-text">{{ project()?.desired_outcome || 'N/A' }}</p>
                </div>
              </div>

              <div class="dossier-section border-indigo-500">
                <h4 class="dossier-heading text-indigo-400">Current State & Risks</h4>
                <div class="detail-field">
                  <span class="field-label">What Do We Do Today?</span>
                  <p class="field-value dossier-text">{{ project()?.what_do_you_do_today || 'N/A' }}</p>
                </div>
                <div class="detail-field mt-4">
                  <span class="field-label">What Transpires If We Do Nothing?</span>
                  <p class="field-value dossier-text">{{ project()?.what_transpires_if_nothing || 'N/A' }}</p>
                </div>
              </div>

              <div class="dossier-section border-purple-500">
                <h4 class="dossier-heading text-purple-400">Additional Context</h4>
                <div class="detail-field">
                  <span class="field-label">Strategic Alignment & Rationale</span>
                  <p class="field-value dossier-text">{{ project()?.strategic_alignment || 'N/A' }}</p>
                </div>
                <div class="detail-field mt-4" *ngIf="project()?.notes">
                  <span class="field-label">Notes / Comments</span>
                  <p class="field-value dossier-text">{{ project()?.notes }}</p>
                </div>
              </div>
            </div>
          </div>

          <!-- BTA DOSSIER -->
          <div class="glass-card rounded-2xl border border-slate-700/50 shadow-xl overflow-hidden animate-fade-in" *ngIf="activeTab() === 'bta' && hasBtaData()">
            <div class="bg-slate-800/80 border-b border-slate-700/50 px-6 py-4 flex justify-between items-center">
              <h3 class="text-lg font-bold text-white">Business Tech Advocate (BTA) Discovery Dossier</h3>
              <span class="px-2.5 py-1 rounded text-[10px] font-extrabold uppercase tracking-wider border bg-orange-900/30 text-orange-400 border-orange-500/30">READ-ONLY</span>
            </div>
            <div class="p-6 flex flex-col gap-6">
              
              <div class="dossier-section border-orange-500">
                <h4 class="dossier-heading text-orange-400">Scope definition</h4>
                <div class="detail-field">
                  <span class="field-label">In Scope</span>
                  <p class="field-value dossier-text">{{ getAiData('inScope') || 'N/A' }}</p>
                </div>
                <div class="detail-field mt-4">
                  <span class="field-label">Out of Scope</span>
                  <p class="field-value dossier-text">{{ getAiData('outOfScope') || 'N/A' }}</p>
                </div>
              </div>

              <div class="dossier-section border-orange-500">
                <h4 class="dossier-heading text-orange-400">Technical Landscape</h4>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="detail-field">
                      <span class="field-label">New Technology Needed?</span>
                      <p class="field-value dossier-text uppercase text-white font-bold">{{ getAiData('techNeeded') || 'N/A' }}</p>
                    </div>
                    <div class="detail-field">
                      <span class="field-label">New Vendor Needed?</span>
                      <p class="field-value dossier-text uppercase text-white font-bold">{{ getAiData('vendorNeeded') || 'N/A' }}</p>
                    </div>
                </div>
                <div class="detail-field mt-4">
                  <span class="field-label">Systems Involved</span>
                  <p class="field-value dossier-text">{{ getAiData('systemsInvolved') || 'N/A' }}</p>
                </div>
                <div class="detail-field mt-4">
                  <span class="field-label">Integration Requirements</span>
                  <p class="field-value dossier-text">{{ getAiData('integrationNeeds') || 'N/A' }}</p>
                </div>
              </div>

              <div class="dossier-section border-orange-500">
                <h4 class="dossier-heading text-orange-400">Financials & Resources</h4>
                <div class="detail-field">
                  <span class="field-label">Estimated ROI / Benefits</span>
                  <p class="field-value dossier-text">{{ getAiData('estimatedROI') || 'N/A' }}</p>
                </div>
                <div class="detail-field mt-4">
                  <span class="field-label">Human Resource Needs</span>
                  <p class="field-value dossier-text">{{ getAiData('resourceNeeds') || 'N/A' }}</p>
                </div>
              </div>

              <div class="dossier-section border-orange-500">
                <h4 class="dossier-heading text-orange-400">Risks & Dependencies</h4>
                <div class="detail-field">
                  <span class="field-label">Project Urgency</span>
                  <p class="field-value dossier-text uppercase font-bold text-rose-400">{{ getAiData('projectUrgency') || 'N/A' }}</p>
                </div>
                <div class="detail-field mt-4">
                  <span class="field-label">Justification for Urgency</span>
                  <p class="field-value dossier-text">{{ getAiData('justificationForUrgency') || 'N/A' }}</p>
                </div>
                <div class="detail-field mt-4">
                  <span class="field-label">Known Dependencies</span>
                  <p class="field-value dossier-text">{{ getAiData('dependencies') || 'N/A' }}</p>
                </div>
                <div class="detail-field mt-4">
                  <span class="field-label">Identified Risks</span>
                  <p class="field-value dossier-text">{{ getAiData('risks') || 'N/A' }}</p>
                </div>
              </div>

            </div>
          </div>

          <!-- EPMO REVIEW DOSSIER -->
          <div class="glass-card rounded-2xl border border-slate-700/50 shadow-xl overflow-hidden animate-fade-in" *ngIf="activeTab() === 'epmo' && hasEpmoData()">
            <div class="bg-slate-800/80 border-b border-slate-700/50 px-6 py-4 flex justify-between items-center">
              <h3 class="text-lg font-bold text-white">EPMO Governance Check-in Summary</h3>
              <span class="px-2.5 py-1 rounded text-[10px] font-extrabold uppercase tracking-wider border bg-purple-900/30 text-purple-300 border-purple-500/30">EPMO TEAM</span>
            </div>
            <div class="p-6 flex flex-col gap-6">

              <div class="dossier-section border-purple-500">
                <h4 class="dossier-heading text-purple-400">Strategic &amp; Portfolio Alignment</h4>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div class="detail-field">
                    <span class="field-label">Aligned with Organisational Strategy?</span>
                    <p class="field-value dossier-text uppercase font-bold" [ngClass]="getAiData('epmo_strategy') === 'Yes' ? 'text-emerald-400' : 'text-rose-400'">
                      {{ getAiData('epmo_strategy') || 'N/A' }}
                    </p>
                  </div>
                  <div class="detail-field">
                    <span class="field-label">PIC (Project Investment Committee) Required?</span>
                    <p class="field-value dossier-text uppercase font-bold" [ngClass]="getAiData('epmo_pic_needed') === 'Yes' ? 'text-indigo-400' : 'text-slate-400'">
                      {{ getAiData('epmo_pic_needed') || 'N/A' }}
                    </p>
                  </div>
                  <div class="detail-field">
                    <span class="field-label">Dedicated Project Manager Required?</span>
                    <p class="field-value dossier-text uppercase">{{ getAiData('epmo_pm_required') || 'N/A' }}</p>
                  </div>
                  <div class="detail-field">
                    <span class="field-label">Related to an Existing Project?</span>
                    <p class="field-value dossier-text uppercase">{{ getAiData('epmo_related_project') || 'N/A' }}</p>
                  </div>
                </div>
              </div>

              <div class="dossier-section border-purple-500">
                <h4 class="dossier-heading text-purple-400">EPMO Mandatory Evaluation Checklist</h4>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div class="flex items-center gap-3">
                    <span class="material-icons text-xl" [ngClass]="getAiData('epmo_checklist_strategic_fit') ? 'text-emerald-400' : 'text-slate-600'">
                      {{ getAiData('epmo_checklist_strategic_fit') ? 'check_circle' : 'radio_button_unchecked' }}
                    </span>
                    <span class="field-value text-sm">Strategic Priority Alignment Verified</span>
                  </div>
                  <div class="flex items-center gap-3">
                    <span class="material-icons text-xl" [ngClass]="getAiData('epmo_checklist_roi_validated') ? 'text-emerald-400' : 'text-slate-600'">
                      {{ getAiData('epmo_checklist_roi_validated') ? 'check_circle' : 'radio_button_unchecked' }}
                    </span>
                    <span class="field-value text-sm">Business Case &amp; ROI Validated</span>
                  </div>
                  <div class="flex items-center gap-3">
                    <span class="material-icons text-xl" [ngClass]="getAiData('epmo_checklist_pm_assigned') ? 'text-emerald-400' : 'text-slate-600'">
                      {{ getAiData('epmo_checklist_pm_assigned') ? 'check_circle' : 'radio_button_unchecked' }}
                    </span>
                    <span class="field-value text-sm">Dedicated Project Manager Assigned</span>
                  </div>
                  <div class="flex items-center gap-3">
                    <span class="material-icons text-xl" [ngClass]="getAiData('epmo_checklist_capacity_confirmed') ? 'text-emerald-400' : 'text-slate-600'">
                      {{ getAiData('epmo_checklist_capacity_confirmed') ? 'check_circle' : 'radio_button_unchecked' }}
                    </span>
                    <span class="field-value text-sm">Resource Allocation &amp; Capacity Confirmed</span>
                  </div>
                  <div class="flex items-center gap-3">
                    <span class="material-icons text-xl" [ngClass]="getAiData('epmo_checklist_risk_plan_defined') ? 'text-emerald-400' : 'text-slate-600'">
                      {{ getAiData('epmo_checklist_risk_plan_defined') ? 'check_circle' : 'radio_button_unchecked' }}
                    </span>
                    <span class="field-value text-sm">Risk Management Plan Mapped</span>
                  </div>
                  <div class="flex items-center gap-3">
                    <span class="material-icons text-xl" [ngClass]="getAiData('epmo_checklist_gate_approval') ? 'text-emerald-400' : 'text-slate-600'">
                      {{ getAiData('epmo_checklist_gate_approval') ? 'check_circle' : 'radio_button_unchecked' }}
                    </span>
                    <span class="field-value text-sm">EPMO Governance Gate Approved</span>
                  </div>
                </div>
              </div>

              <div class="dossier-section border-purple-500" *ngIf="getAiData('epmo_comments')">
                <h4 class="dossier-heading text-purple-400">EPMO Comments</h4>
                <p class="field-value dossier-text">{{ getAiData('epmo_comments') }}</p>
              </div>

            </div>
          </div>

          <!-- FINANCE REVIEW DOSSIER -->
          <div class="glass-card rounded-2xl border border-slate-700/50 shadow-xl overflow-hidden animate-fade-in" *ngIf="activeTab() === 'finance' && hasFinanceData()">
            <div class="bg-slate-800/80 border-b border-slate-700/50 px-6 py-4 flex justify-between items-center">
              <h3 class="text-lg font-bold text-white">Finance Review &amp; Cost Summary</h3>
              <span class="px-2.5 py-1 rounded text-[10px] font-extrabold uppercase tracking-wider border bg-emerald-900/30 text-emerald-400 border-emerald-500/30">FINANCE TEAM</span>
            </div>
            <div class="p-6 flex flex-col gap-6">

              <div class="dossier-section border-emerald-500">
                <h4 class="dossier-heading text-emerald-400">Cost Plan Summary</h4>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div class="detail-field">
                    <span class="field-label">Total CapEx</span>
                    <p class="field-value dossier-text text-xl font-bold text-emerald-400">
                      US$ {{ getAiData('totalCapex') || '—' }}
                    </p>
                  </div>
                  <div class="detail-field">
                    <span class="field-label">Total OpEx</span>
                    <p class="field-value dossier-text text-xl font-bold text-indigo-400">
                      US$ {{ getAiData('totalOpex') || '—' }}
                    </p>
                  </div>
                  <div class="detail-field">
                    <span class="field-label">Run / Maintain Costs</span>
                    <p class="field-value dossier-text">US$ {{ getAiData('totalRunCosts') || '—' }}</p>
                  </div>
                  <div class="detail-field">
                    <span class="field-label">Grand Total Project Cost</span>
                    <p class="field-value dossier-text text-2xl font-extrabold text-white">
                      US$ {{ getAiData('grandTotal') || '—' }}
                    </p>
                  </div>
                </div>
                <div class="detail-field mt-4" *ngIf="getAiData('memoOpex')">
                  <span class="field-label">Memo: FY OpEx Impact</span>
                  <p class="field-value dossier-text">{{ getAiData('memoOpex') }}</p>
                </div>
              </div>

              <div class="dossier-section border-emerald-500">
                <h4 class="dossier-heading text-emerald-400">ROI Analysis</h4>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div class="detail-field">
                    <span class="field-label">ROI Percentage</span>
                    <p class="field-value dossier-text text-2xl font-extrabold text-emerald-400">
                      {{ getAiData('roiPercentage') || '0' }}%
                    </p>
                  </div>
                  <div class="detail-field">
                    <span class="field-label">Payback Period</span>
                    <p class="field-value dossier-text text-2xl font-extrabold text-orange-400">
                      {{ getAiData('paybackPeriod') || '—' }} yrs
                    </p>
                  </div>
                  <div class="detail-field">
                    <span class="field-label">Annual Benefits</span>
                    <p class="field-value dossier-text text-2xl font-extrabold text-indigo-400">
                      US$ {{ getAiData('annualBenefits') || '—' }}
                    </p>
                  </div>
                  <div class="detail-field">
                    <span class="field-label">Annual Costs</span>
                    <p class="field-value dossier-text">US$ {{ getAiData('annualCosts') || '—' }}</p>
                  </div>
                  <div class="detail-field">
                    <span class="field-label">Dev &amp; Implementation Costs</span>
                    <p class="field-value dossier-text">US$ {{ getAiData('devImplCosts') || '—' }}</p>
                  </div>
                  <div class="detail-field">
                    <span class="field-label">Net Cash Flow</span>
                    <p class="field-value dossier-text">US$ {{ getAiData('netCashFlow') || '—' }}</p>
                  </div>
                </div>
                <div class="detail-field mt-4" *ngIf="getAiData('financeNarrative')">
                  <span class="field-label">Finance Narrative / Justification</span>
                  <p class="field-value dossier-text">{{ getAiData('financeNarrative') }}</p>
                </div>
              </div>

            </div>
          </div>

          <!-- EAC INFORMATION -->
          <div class="glass-card rounded-2xl border border-slate-700/50 shadow-xl overflow-hidden animate-fade-in" *ngIf="activeTab() === 'eac' && hasEacData()">
            <div class="bg-slate-800/80 border-b border-slate-700/50 px-6 py-4 flex justify-between items-center">
              <h3 class="text-lg font-bold text-white">EAC Architecture Dossier</h3>
              <span class="px-2.5 py-1 rounded text-[10px] font-extrabold uppercase tracking-wider border bg-blue-900/30 text-blue-400 border-blue-500/30">EAC COMMITTEE</span>
            </div>
            <div class="p-6 flex flex-col gap-6">
              
              <div class="dossier-section border-blue-500">
                <h4 class="dossier-heading text-blue-400">Business Justification & Current State</h4>
                <div class="detail-field">
                  <span class="field-label">EA Principles Alignment</span>
                  <p class="field-value dossier-text">{{ getAiData('eaPrinciplesAlignment') || 'N/A' }}</p>
                </div>
                <div class="detail-field mt-4">
                  <span class="field-label">Current State Architecture</span>
                  <p class="field-value dossier-text">{{ getAiData('currentStateArchitecture') || 'N/A' }}</p>
                </div>
                <div class="detail-field mt-4">
                  <span class="field-label">Current State Pain Points</span>
                  <p class="field-value dossier-text">{{ getAiData('currentStatePainPoints') || 'N/A' }}</p>
                </div>
              </div>

              <div class="dossier-section border-blue-500">
                <h4 class="dossier-heading text-blue-400">Proposed Solution & Technical Specs</h4>
                <div class="detail-field">
                  <span class="field-label">Solution Overview</span>
                  <p class="field-value dossier-text">{{ getAiData('solutionOverview') || 'N/A' }}</p>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                    <div class="detail-field">
                      <span class="field-label">Tech Stack</span>
                      <p class="field-value dossier-text">{{ getAiData('techStack') || 'N/A' }}</p>
                    </div>
                    <div class="detail-field">
                      <span class="field-label">Infrastructure</span>
                      <p class="field-value dossier-text">{{ getAiData('infrastructureRequirements') || 'N/A' }}</p>
                    </div>
                </div>
                <div class="detail-field mt-4">
                  <span class="field-label">Data Strategy</span>
                  <p class="field-value dossier-text">{{ getAiData('dataStrategy') || 'N/A' }}</p>
                </div>
                <div class="detail-field mt-4">
                  <span class="field-label">Integration & Security Strategy</span>
                  <p class="field-value dossier-text">{{ getAiData('integrationStrategy') || 'N/A' }} / {{ getAiData('securityStrategy') || 'N/A' }}</p>
                </div>
              </div>

              <div class="dossier-section border-blue-500">
                <h4 class="dossier-heading text-blue-400">Compliance, Impact & Readiness</h4>
                <div class="detail-field">
                  <span class="field-label">Compliance Standards</span>
                  <p class="field-value dossier-text">{{ getAiData('complianceStandards') || 'N/A' }}</p>
                </div>
                <div class="detail-field mt-4">
                  <span class="field-label">Impact on Operations</span>
                  <p class="field-value dossier-text">{{ getAiData('impactOperations') || 'N/A' }}</p>
                </div>
                <div class="detail-field mt-4">
                  <span class="field-label">Scalability & Future Readiness</span>
                  <p class="field-value dossier-text">{{ getAiData('scalability') || 'N/A' }} ({{ getAiData('futureReadiness') || 'N/A' }})</p>
                </div>
              </div>

            </div>
          </div>

          <!-- PIC INFORMATION -->
          <div class="glass-card rounded-2xl border border-slate-700/50 shadow-xl overflow-hidden animate-fade-in" *ngIf="activeTab() === 'pic' && hasPicData()">
            <div class="bg-slate-800/80 border-b border-slate-700/50 px-6 py-4 flex justify-between items-center">
              <h3 class="text-lg font-bold text-white">PIC Funding & Approval Summary</h3>
              <span class="px-2.5 py-1 rounded text-[10px] font-extrabold uppercase tracking-wider border bg-rose-900/30 text-rose-400 border-rose-500/30">PIC COMMITTEE</span>
            </div>
            <div class="p-6 flex flex-col gap-6">
              <div class="dossier-section border-rose-500">
                <h4 class="dossier-heading text-rose-400">Financial Overview</h4>
                <div class="detail-field">
                  <span class="field-label">Final Approved Request</span>
                  <p class="field-value dossier-text text-3xl font-extrabold text-rose-400">$ {{ getAiData('approvedAmount') || getAiData('requestedAmount') || '0' }}</p>
                </div>
                <div class="detail-field mt-4" *ngIf="getAiData('fundingSource')">
                  <span class="field-label">Funding Source / Cost Center</span>
                  <p class="field-value dossier-text">{{ getAiData('fundingSource') }} / {{ getAiData('costCenter') || 'N/A' }}</p>
                </div>
              </div>
              <div class="dossier-section border-rose-500">
                <h4 class="dossier-heading text-rose-400">Sponsor & Executive Notes</h4>
                <div class="detail-field">
                  <span class="field-label">Executive Sponsor</span>
                  <p class="field-value dossier-text">{{ getAiData('executiveSponsor') || 'N/A' }}</p>
                </div>
                <div class="detail-field mt-4" *ngIf="getAiData('meetingNotes')">
                  <span class="field-label">Final Meeting Notes</span>
                  <p class="field-value dossier-text">{{ getAiData('meetingNotes') }}</p>
                </div>
              </div>
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
    .scrollbar-hide::-webkit-scrollbar {
        display: none;
    }
    .scrollbar-hide {
        -ms-overflow-style: none;
        scrollbar-width: none;
    }

    .detail-field { display:flex; flex-direction:column; gap:6px; }
    .field-label { font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; color:#94a3b8; }
    .field-value { font-size:14px; color:#f1f5f9; font-weight:500; }
    
    .dossier-section {
      background: rgba(30, 41, 59, 0.5);
      border-radius: 12px;
      padding: 20px 24px;
      border-left-width: 4px;
      border-top: 1px solid rgba(51, 65, 85, 0.5);
      border-right: 1px solid rgba(51, 65, 85, 0.5);
      border-bottom: 1px solid rgba(51, 65, 85, 0.5);
      box-shadow: inset 0 2px 4px 0 rgba(0, 0, 0, 0.05);
    }
    .dossier-heading {
      font-size: 14px;
      font-weight: 800;
      margin: 0 0 16px 0;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .dossier-text {
      white-space: pre-wrap;
      line-height: 1.6;
      margin: 0;
    }
  `]
})
export class ProjectDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private projectService = inject(ProjectService);
  project = signal<any | null>(null);
  userRole = signal<string>('project_manager');
  isLoading = signal<boolean>(true);
  isNotFound = signal<boolean>(false);
  activeTab = signal<string>('intake');

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.projectService.getProject(id).subscribe({
        next: (p) => {
          this.project.set(p);
          this.isLoading.set(false);
        },
        error: (err) => {
          console.error('Failed to load project details', err);
          this.isNotFound.set(true);
          this.isLoading.set(false);
        }
      });
    } else {
      this.isNotFound.set(true);
      this.isLoading.set(false);
    }
    
    if (typeof localStorage !== 'undefined') {
      const userRaw = localStorage.getItem('gov_user');
      if (userRaw) {
        try {
          const user = JSON.parse(userRaw);
          this.userRole.set(user.role || 'project_manager');
        } catch {}
      }
    }
  }

  getStatusBadgeClass() {
    const s = this.project()?.status?.toLowerCase();
    if (s === 'active') return 'badge-active';
    if (s === 'completed') return 'badge-done';
    if (s === 'cancelled' || s === 'rejected') return 'badge-cancelled';
    return 'badge-pending';
  }

  getPriorityBadgeClass() {
    const p = this.project()?.priority?.toLowerCase();
    if (p === 'critical' || p === 'high') return 'badge-critical';
    if (p === 'medium') return 'badge-medium';
    return 'badge-low';
  }

  getWorkflowStages() {
    const current = this.project()?.current_stage || 'Admin Review';
    const isCompleted = this.project()?.status?.toLowerCase() === 'completed';
    
    const stageOrders: { [key: string]: number } = {
      'Admin Review': 1,
      'BTA Review': 2,
      'Prepare for EAC': 3,
      'EAC Committee Review': 4,
      'EAC Review': 4,
      'EAC Meeting': 4,
      'TRC Vetting & Gate Review': 5
    };
    
    const currentOrder = stageOrders[current] || 1;

    return [
      { code:'1', name:'Admin Review',              desc:'Initial intake and Admin assessment', status: currentOrder > 1 ? 'done' : (currentOrder === 1 ? 'active' : 'pending') },
      { code:'2', name:'BTA Review',                desc:'Business Tech Advocate evaluation complete', status: currentOrder > 2 ? 'done' : (currentOrder === 2 ? 'active' : 'pending') },
      { code:'3', name:'Prepare for EAC',           desc:'Architecture dossier preparation in progress', status: currentOrder > 3 ? 'done' : (currentOrder === 3 ? 'active' : 'pending') },
      { code:'4', name:'EAC Committee Review',      desc:'Enterprise Architecture Council formal alignment vote', status: currentOrder > 4 ? 'done' : (currentOrder === 4 ? 'active' : 'pending') },
      { code:'5', name:'TRC Vetting & Gate Review', desc:'TRC Technical Review and compliance checks', status: isCompleted ? 'done' : (currentOrder === 5 ? 'active' : 'pending') },
      { code:'6', name:'Project Deployment',        desc:'CAB approval and go-live', status: isCompleted ? 'done' : 'pending' },
    ];
  }

  getCompletionPercentage(): number {
    const stages = this.getWorkflowStages();
    const doneCount = stages.filter(s => s.status === 'done').length;
    return Math.round((doneCount / stages.length) * 100);
  }

  getProjectFlags() {
    const p = this.project();
    return [
      { label:'IT Involvement',        enabled: p?.it_involvement || false },
      { label:'Vendor Required',       enabled: p?.vendor_required || false },
      { label:'PHI Data Involved',     enabled: p?.has_phi_data || false },
      { label:'HIPAA Applicable',      enabled: p?.is_hipaa_applicable || false },
      { label:'Clinical Office Impact', enabled: p?.is_clinical || false },
    ];
  }

  getAiData(key: string): any {
    const data = this.project()?.ai_extracted_data;
    return data ? data[key] : null;
  }

  getCurrentStageOrder(): number {
    const current = this.project()?.current_stage || 'EPMO Review';
    const stageOrders: { [key: string]: number } = {
      'EPMO Review':            1,
      'BTA Review':             2,
      'Finance Review':         3,
      'Prepare for EAC':        4,
      'EAC Committee Review':   5,
      'EAC Review':             5,
      'EAC Meeting':            5,
      'Prepare for PIC':        6,
      'PIC Meeting':            6,
      'TRC Vetting & Gate Review': 7
    };
    return stageOrders[current] || 1;
  }

  /** Stage order: EPMO=1, BTA=2, Finance=3, EAC=4, PIC=5 */
  hasEpmoData(): boolean {
    // EPMO data available once project moves past EPMO stage
    const stage = this.project()?.last_stage_completed;
    const completedStages = ['EPMO Review', 'BTA Review', 'Finance Review', 'Prepare for EAC',
      'EAC Committee Review', 'EAC Review', 'EAC Meeting', 'Prepare for PIC', 'PIC Meeting'];
    return completedStages.includes(stage) || this.getCurrentStageOrder() > 1
      || this.project()?.status?.toLowerCase() === 'completed';
  }

  hasBtaData(): boolean {
    return this.getCurrentStageOrder() > 2 || this.project()?.status?.toLowerCase() === 'completed';
  }

  hasFinanceData(): boolean {
    return this.getCurrentStageOrder() > 3 || this.project()?.status?.toLowerCase() === 'completed';
  }

  hasEacData(): boolean {
    return this.getCurrentStageOrder() > 4 || this.project()?.status?.toLowerCase() === 'completed';
  }

  hasPicData(): boolean {
    return this.getCurrentStageOrder() > 5 || this.project()?.status?.toLowerCase() === 'completed';
  }
}
