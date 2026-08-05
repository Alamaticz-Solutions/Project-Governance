import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ProjectService } from '../../../core/services/project.service';

@Component({
  selector: 'app-project-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="animate-fade-in" style="padding:48px; text-align:center;" *ngIf="isLoading()">
      <span class="material-icons" style="font-size:48px; color:#0052CC; animation: spin 1s infinite linear;">refresh</span>
      <h3 class="mt-4" style="color:#172B4D">Loading Project Data...</h3>
    </div>

    <div class="animate-fade-in" style="padding:48px; text-align:center;" *ngIf="isNotFound()">
      <span class="material-icons" style="font-size:64px; color:#DE350B;">error_outline</span>
      <h3 class="mt-4" style="color:#172B4D">Project Not Found</h3>
      <p style="color:#505F79">The project you are looking for does not exist or was deleted.</p>
      <a routerLink="/projects" class="btn btn-primary mt-4" style="display:inline-flex">
        Return to All Projects
      </a>
    </div>

    <div class="animate-fade-in" *ngIf="!isLoading() && !isNotFound() && project()">
      <div class="page-header flex items-center justify-between">
        <div>
          <a routerLink="/projects" class="btn btn-ghost btn-sm mb-4" style="display:inline-flex">
            <span class="material-icons">arrow_back</span> All Projects
          </a>
          <h1 class="page-title">{{ project()?.project_name }}</h1>
          <div class="flex gap-3 mt-2">
            <code style="font-size:12px; color:#0052CC; font-weight:700; background:#E3F0FF; padding:2px 8px; border-radius:4px">
              {{ project()?.project_number }}
            </code>
            <span class="badge" [ngClass]="getStatusBadgeClass()">{{ project()?.status }}</span>
            <span class="badge" [ngClass]="getPriorityBadgeClass()">{{ project()?.priority }}</span>
          </div>
        </div>
        <div class="page-actions" *ngIf="userRole() === 'admin' || userRole() === 'epmo'">
          <a [routerLink]="['/gate-review']" [queryParams]="{ projectId: project()?.id }" class="btn btn-primary">
            <span class="material-icons">fact_check</span> Gate Review
          </a>
        </div>
      </div>
      <!-- Tabs Navigation -->
      <div class="flex gap-6 border-b border-gray-200 mt-2 mb-6 overflow-x-auto" style="padding: 0 4px;">
        <button class="pb-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap"
                [ngClass]="activeTab() === 'intake' ? 'border-[#0052CC] text-[#0052CC]' : 'border-transparent text-[#6B778C] hover:text-[#172B4D] hover:border-gray-300'"
                (click)="activeTab.set('intake')">
           Intake Proposal
        </button>
        <button *ngIf="hasEpmoData()" 
                class="pb-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap"
                [ngClass]="activeTab() === 'epmo' ? 'border-[#6B46C1] text-[#6B46C1]' : 'border-transparent text-[#6B778C] hover:text-[#172B4D] hover:border-gray-300'"
                (click)="activeTab.set('epmo')">
           EPMO Review
        </button>
        <button *ngIf="hasBtaData()" 
                class="pb-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap"
                [ngClass]="activeTab() === 'bta' ? 'border-[#FF8B00] text-[#FF8B00]' : 'border-transparent text-[#6B778C] hover:text-[#172B4D] hover:border-gray-300'"
                (click)="activeTab.set('bta')">
           BTA Review
        </button>
        <button *ngIf="hasFinanceData()" 
                class="pb-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap"
                [ngClass]="activeTab() === 'finance' ? 'border-[#00875A] text-[#00875A]' : 'border-transparent text-[#6B778C] hover:text-[#172B4D] hover:border-gray-300'"
                (click)="activeTab.set('finance')">
           Finance Review
        </button>
        <button *ngIf="hasEacData()" 
                class="pb-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap"
                [ngClass]="activeTab() === 'eac' ? 'border-[#0747A6] text-[#0747A6]' : 'border-transparent text-[#6B778C] hover:text-[#172B4D] hover:border-gray-300'"
                (click)="activeTab.set('eac')">
           EAC Architecture
        </button>
        <button *ngIf="hasPicData()" 
                class="pb-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap"
                [ngClass]="activeTab() === 'pic' ? 'border-[#DE350B] text-[#DE350B]' : 'border-transparent text-[#6B778C] hover:text-[#172B4D] hover:border-gray-300'"
                (click)="activeTab.set('pic')">
           PIC Funding
        </button>
      </div>

      <div style="display:flex;flex-direction:column;gap:16px">
          <div class="card">
            <div class="card-header"><h3>Project Details</h3></div>
            <div class="card-body">
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
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
                  <span class="field-value">{{ project()?.project_manager?.full_name || 'Unassigned' }}</span>
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
                  <span class="field-value" style="color:#00875A;font-weight:700">
                    {{ (project()?.budget_estimated) | currency:'USD':'symbol':'1.0-0' }} ({{ project()?.budget_type || 'CAPEX' }})
                  </span>
                </div>
                <div class="detail-field">
                  <span class="field-label">Requested Timeline</span>
                  <span class="field-value">
                    {{ project()?.requested_start_date | date:'MMM yyyy' }} → {{ project()?.requested_end_date | date:'MMM yyyy' }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Intake Proposal Summary Dossier -->
          <div class="card animate-fade-in" *ngIf="activeTab() === 'intake'">
            <div class="card-header" style="display:flex; justify-content:space-between; align-items:center;">
              <h3>Intake Proposal Summary</h3>
              <span style="font-size:10px; font-weight:700; background:#F4F5F7; padding:4px 8px; border-radius:4px; color:#505F79; letter-spacing:0.5px;">READ-ONLY</span>
            </div>
            <div class="card-body" style="display:flex; flex-direction:column; gap:16px;">
              
              <!-- Core Objectives -->
              <div class="dossier-section">
                <h4 class="dossier-heading">Core Objectives</h4>
                <div class="detail-field">
                  <span class="field-label">Problem or Opportunity Statement</span>
                  <p class="field-value dossier-text">{{ project()?.problem_statement || 'N/A' }}</p>
                </div>
                <div class="detail-field mt-4">
                  <span class="field-label">Desired Outcome</span>
                  <p class="field-value dossier-text">{{ project()?.desired_outcome || 'N/A' }}</p>
                </div>
              </div>

              <!-- Current State & Risks -->
              <div class="dossier-section">
                <h4 class="dossier-heading">Current State & Risks</h4>
                <div class="detail-field">
                  <span class="field-label">What Do We Do Today?</span>
                  <p class="field-value dossier-text">{{ project()?.what_do_you_do_today || 'N/A' }}</p>
                </div>
                <div class="detail-field mt-4">
                  <span class="field-label">What Transpires If We Do Nothing?</span>
                  <p class="field-value dossier-text">{{ project()?.what_transpires_if_nothing || 'N/A' }}</p>
                </div>
              </div>

              <!-- Additional Context -->
              <div class="dossier-section" style="border-left-color: #6B46C1;">
                <h4 class="dossier-heading" style="color: #6B46C1;">Additional Context</h4>
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

          <!-- BTA INFORMATION -->
          <div class="card animate-fade-in" *ngIf="activeTab() === 'bta' && hasBtaData()">
            <div class="card-header" style="display:flex; justify-content:space-between; align-items:center;">
              <h3>Business Tech Advocate (BTA) Discovery Dossier</h3>
              <span style="font-size:10px; font-weight:700; background:#FFF4D6; padding:4px 8px; border-radius:4px; color:#FF8B00; letter-spacing:0.5px;">READ-ONLY</span>
            </div>
            <div class="card-body" style="display:flex; flex-direction:column; gap:16px;">
              
              <!-- Scope -->
              <div class="dossier-section" style="border-left-color: #FF8B00;">
                <h4 class="dossier-heading" style="color: #FF8B00;">Scope definition</h4>
                <div class="detail-field">
                  <span class="field-label">In Scope</span>
                  <p class="field-value dossier-text">{{ getAiData('inScope') || 'N/A' }}</p>
                </div>
                <div class="detail-field mt-4">
                  <span class="field-label">Out of Scope</span>
                  <p class="field-value dossier-text">{{ getAiData('outOfScope') || 'N/A' }}</p>
                </div>
              </div>

              <!-- Technical & Vendors -->
              <div class="dossier-section" style="border-left-color: #FF8B00;">
                <h4 class="dossier-heading" style="color: #FF8B00;">Technical Landscape</h4>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
                    <div class="detail-field">
                      <span class="field-label">New Technology Needed?</span>
                      <p class="field-value dossier-text uppercase">{{ getAiData('techNeeded') || 'N/A' }}</p>
                    </div>
                    <div class="detail-field">
                      <span class="field-label">New Vendor Needed?</span>
                      <p class="field-value dossier-text uppercase">{{ getAiData('vendorNeeded') || 'N/A' }}</p>
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

              <!-- Financials -->
              <div class="dossier-section" style="border-left-color: #FF8B00;">
                <h4 class="dossier-heading" style="color: #FF8B00;">Financials & Resources</h4>
                <div class="detail-field">
                  <span class="field-label">Estimated ROI / Benefits</span>
                  <p class="field-value dossier-text">{{ getAiData('estimatedROI') || 'N/A' }}</p>
                </div>
                <div class="detail-field mt-4">
                  <span class="field-label">Human Resource Needs</span>
                  <p class="field-value dossier-text">{{ getAiData('resourceNeeds') || 'N/A' }}</p>
                </div>
              </div>

              <!-- Timeline & Risks -->
              <div class="dossier-section" style="border-left-color: #FF8B00;">
                <h4 class="dossier-heading" style="color: #FF8B00;">Risks & Dependencies</h4>
                <div class="detail-field">
                  <span class="field-label">Project Urgency</span>
                  <p class="field-value dossier-text uppercase font-bold text-red-600">{{ getAiData('projectUrgency') || 'N/A' }}</p>
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
          <div class="card animate-fade-in" *ngIf="activeTab() === 'epmo' && hasEpmoData()">
            <div class="card-header" style="display:flex; justify-content:space-between; align-items:center;">
              <h3>EPMO Governance Check-in Summary</h3>
              <span style="font-size:10px; font-weight:700; background:#F3E8FF; padding:4px 8px; border-radius:4px; color:#6B46C1; letter-spacing:0.5px;">EPMO TEAM</span>
            </div>
            <div class="card-body" style="display:flex; flex-direction:column; gap:16px;">

              <!-- Strategic Alignment -->
              <div class="dossier-section" style="border-left-color:#6B46C1;">
                <h4 class="dossier-heading" style="color:#6B46C1;">Strategic &amp; Portfolio Alignment</h4>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
                  <div class="detail-field">
                    <span class="field-label">Aligned with Organisational Strategy?</span>
                    <p class="field-value dossier-text uppercase font-bold" [style.color]="getAiData('epmo_strategy') === 'Yes' ? '#00875A' : '#DE350B'">
                      {{ getAiData('epmo_strategy') || 'N/A' }}
                    </p>
                  </div>
                  <div class="detail-field">
                    <span class="field-label">PIC (Project Investment Committee) Required?</span>
                    <p class="field-value dossier-text uppercase font-bold" [style.color]="getAiData('epmo_pic_needed') === 'Yes' ? '#0052CC' : '#6B778C'">
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

              <!-- Governance Checklist Summary -->
              <div class="dossier-section" style="border-left-color:#6B46C1;">
                <h4 class="dossier-heading" style="color:#6B46C1;">EPMO Mandatory Evaluation Checklist</h4>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                  <div style="display:flex;align-items:center;gap:8px;">
                    <span class="material-icons" [style.color]="getAiData('epmo_checklist_strategic_fit') ? '#00875A' : '#97A0AF'" style="font-size:18px">
                      {{ getAiData('epmo_checklist_strategic_fit') ? 'check_circle' : 'radio_button_unchecked' }}
                    </span>
                    <span class="field-value" style="font-size:13px;">Strategic Priority Alignment Verified</span>
                  </div>
                  <div style="display:flex;align-items:center;gap:8px;">
                    <span class="material-icons" [style.color]="getAiData('epmo_checklist_roi_validated') ? '#00875A' : '#97A0AF'" style="font-size:18px">
                      {{ getAiData('epmo_checklist_roi_validated') ? 'check_circle' : 'radio_button_unchecked' }}
                    </span>
                    <span class="field-value" style="font-size:13px;">Business Case &amp; ROI Validated</span>
                  </div>
                  <div style="display:flex;align-items:center;gap:8px;">
                    <span class="material-icons" [style.color]="getAiData('epmo_checklist_pm_assigned') ? '#00875A' : '#97A0AF'" style="font-size:18px">
                      {{ getAiData('epmo_checklist_pm_assigned') ? 'check_circle' : 'radio_button_unchecked' }}
                    </span>
                    <span class="field-value" style="font-size:13px;">Dedicated Project Manager Assigned</span>
                  </div>
                  <div style="display:flex;align-items:center;gap:8px;">
                    <span class="material-icons" [style.color]="getAiData('epmo_checklist_capacity_confirmed') ? '#00875A' : '#97A0AF'" style="font-size:18px">
                      {{ getAiData('epmo_checklist_capacity_confirmed') ? 'check_circle' : 'radio_button_unchecked' }}
                    </span>
                    <span class="field-value" style="font-size:13px;">Resource Allocation &amp; Capacity Confirmed</span>
                  </div>
                  <div style="display:flex;align-items:center;gap:8px;">
                    <span class="material-icons" [style.color]="getAiData('epmo_checklist_risk_plan_defined') ? '#00875A' : '#97A0AF'" style="font-size:18px">
                      {{ getAiData('epmo_checklist_risk_plan_defined') ? 'check_circle' : 'radio_button_unchecked' }}
                    </span>
                    <span class="field-value" style="font-size:13px;">Risk Management Plan Mapped</span>
                  </div>
                  <div style="display:flex;align-items:center;gap:8px;">
                    <span class="material-icons" [style.color]="getAiData('epmo_checklist_gate_approval') ? '#00875A' : '#97A0AF'" style="font-size:18px">
                      {{ getAiData('epmo_checklist_gate_approval') ? 'check_circle' : 'radio_button_unchecked' }}
                    </span>
                    <span class="field-value" style="font-size:13px;">EPMO Governance Gate Approved</span>
                  </div>
                </div>
              </div>

              <!-- Comments -->
              <div class="dossier-section" style="border-left-color:#6B46C1;" *ngIf="getAiData('epmo_comments')">
                <h4 class="dossier-heading" style="color:#6B46C1;">EPMO Comments</h4>
                <p class="field-value dossier-text">{{ getAiData('epmo_comments') }}</p>
              </div>

            </div>
          </div>

          <!-- FINANCE REVIEW DOSSIER -->
          <div class="card animate-fade-in" *ngIf="activeTab() === 'finance' && hasFinanceData()">
            <div class="card-header" style="display:flex; justify-content:space-between; align-items:center;">
              <h3>Finance Review &amp; Cost Summary</h3>
              <span style="font-size:10px; font-weight:700; background:#E3FCEF; padding:4px 8px; border-radius:4px; color:#00875A; letter-spacing:0.5px;">FINANCE TEAM</span>
            </div>
            <div class="card-body" style="display:flex; flex-direction:column; gap:16px;">

              <!-- Financial Totals -->
              <div class="dossier-section" style="border-left-color:#00875A;">
                <h4 class="dossier-heading" style="color:#00875A;">Cost Plan Summary</h4>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
                  <div class="detail-field">
                    <span class="field-label">Total CapEx</span>
                    <p class="field-value dossier-text" style="font-size:18px;font-weight:700;color:#00875A;">
                      US$ {{ getAiData('totalCapex') || '—' }}
                    </p>
                  </div>
                  <div class="detail-field">
                    <span class="field-label">Total OpEx</span>
                    <p class="field-value dossier-text" style="font-size:18px;font-weight:700;color:#0052CC;">
                      US$ {{ getAiData('totalOpex') || '—' }}
                    </p>
                  </div>
                  <div class="detail-field">
                    <span class="field-label">Run / Maintain Costs</span>
                    <p class="field-value dossier-text">US$ {{ getAiData('totalRunCosts') || '—' }}</p>
                  </div>
                  <div class="detail-field">
                    <span class="field-label">Grand Total Project Cost</span>
                    <p class="field-value dossier-text" style="font-size:20px;font-weight:800;color:#172B4D;">
                      US$ {{ getAiData('grandTotal') || '—' }}
                    </p>
                  </div>
                </div>
                <div class="detail-field" style="margin-top:12px;" *ngIf="getAiData('memoOpex')">
                  <span class="field-label">Memo: FY OpEx Impact</span>
                  <p class="field-value dossier-text">{{ getAiData('memoOpex') }}</p>
                </div>
              </div>

              <!-- ROI Analysis -->
              <div class="dossier-section" style="border-left-color:#00875A;">
                <h4 class="dossier-heading" style="color:#00875A;">ROI Analysis</h4>
                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px">
                  <div class="detail-field">
                    <span class="field-label">ROI Percentage</span>
                    <p class="field-value dossier-text" style="font-size:22px;font-weight:800;color:#00875A;">
                      {{ getAiData('roiPercentage') || '0' }}%
                    </p>
                  </div>
                  <div class="detail-field">
                    <span class="field-label">Payback Period</span>
                    <p class="field-value dossier-text" style="font-size:22px;font-weight:800;color:#FF8B00;">
                      {{ getAiData('paybackPeriod') || '—' }} yrs
                    </p>
                  </div>
                  <div class="detail-field">
                    <span class="field-label">Annual Benefits</span>
                    <p class="field-value dossier-text" style="font-size:22px;font-weight:800;color:#0052CC;">
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
                <div class="detail-field" style="margin-top:12px;" *ngIf="getAiData('financeNarrative')">
                  <span class="field-label">Finance Narrative / Justification</span>
                  <p class="field-value dossier-text">{{ getAiData('financeNarrative') }}</p>
                </div>
              </div>

            </div>
          </div>

          <!-- EAC INFORMATION -->
          <div class="card animate-fade-in" *ngIf="activeTab() === 'eac' && hasEacData()">
            <div class="card-header" style="display:flex; justify-content:space-between; align-items:center;">
              <h3>EAC Architecture Dossier</h3>
              <span style="font-size:10px; font-weight:700; background:#E3FCEF; padding:4px 8px; border-radius:4px; color:#00875A; letter-spacing:0.5px;">EAC COMMITTEE</span>
            </div>
            <div class="card-body" style="display:flex; flex-direction:column; gap:16px;">
              
              <!-- Business & Current State -->
              <div class="dossier-section" style="border-left-color:#00875A;">
                <h4 class="dossier-heading" style="color:#00875A;">Business Justification & Current State</h4>
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

              <!-- Proposed Solution -->
              <div class="dossier-section" style="border-left-color:#00875A;">
                <h4 class="dossier-heading" style="color:#00875A;">Proposed Solution & Technical Specs</h4>
                <div class="detail-field">
                  <span class="field-label">Solution Overview</span>
                  <p class="field-value dossier-text">{{ getAiData('solutionOverview') || 'N/A' }}</p>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px" class="mt-4">
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

              <!-- Compliance & Impact -->
              <div class="dossier-section" style="border-left-color:#00875A;">
                <h4 class="dossier-heading" style="color:#00875A;">Compliance, Impact & Readiness</h4>
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
          <div class="card animate-fade-in" *ngIf="activeTab() === 'pic' && hasPicData()">
            <div class="card-header" style="display:flex; justify-content:space-between; align-items:center;">
              <h3>PIC Funding & Approval Summary</h3>
              <span style="font-size:10px; font-weight:700; background:#FFEBE6; padding:4px 8px; border-radius:4px; color:#DE350B; letter-spacing:0.5px;">PIC COMMITTEE</span>
            </div>
            <div class="card-body" style="display:flex; flex-direction:column; gap:16px;">
              <div class="dossier-section" style="border-left-color:#DE350B;">
                <h4 class="dossier-heading" style="color:#DE350B;">Financial Overview</h4>
                <div class="detail-field">
                  <span class="field-label">Final Approved Request</span>
                  <p class="field-value dossier-text" style="font-size:24px; font-weight:700; color:#DE350B;">$ {{ getAiData('approvedAmount') || getAiData('requestedAmount') || '0' }}</p>
                </div>
                <div class="detail-field mt-4" *ngIf="getAiData('fundingSource')">
                  <span class="field-label">Funding Source / Cost Center</span>
                  <p class="field-value dossier-text">{{ getAiData('fundingSource') }} / {{ getAiData('costCenter') || 'N/A' }}</p>
                </div>
              </div>
              <div class="dossier-section" style="border-left-color:#DE350B;">
                <h4 class="dossier-heading" style="color:#DE350B;">Sponsor & Executive Notes</h4>
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
    .detail-field { display:flex; flex-direction:column; gap:4px; }
    .field-label { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; color:#97A0AF; }
    .field-value { font-size:14px; color:#172B4D; font-weight:500; }
    
    .dossier-section {
      background: #F7F8FC;
      border-radius: 8px;
      padding: 16px 20px;
      border-left: 4px solid #0052CC;
    }
    .dossier-heading {
      font-size: 13px;
      font-weight: 700;
      color: #0052CC;
      margin: 0 0 12px 0;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .dossier-text {
      white-space: pre-wrap;
      line-height: 1.6;
      color: #344563;
      margin: 0;
    }

    .workflow-stage {
      display:flex; align-items:center; gap:12px; padding:10px 12px;
      border-radius:8px; transition:background 200ms;
      &.active { background:#E3F0FF; }
      &.done { opacity:0.7; }
    }

    .stage-indicator {
      width:28px; height:28px; border-radius:50%; display:flex;
      align-items:center; justify-content:center; background:#DFE3ED;
      flex-shrink:0;
      .material-icons { font-size:16px; color:#97A0AF; }

      &.done { background:#E3FCEF; .material-icons { color:#00875A; } }
      &.active { background:#0052CC; .material-icons { color:#fff; } }
    }

    .stage-name { font-size:13px; font-weight:600; color:#172B4D; }

    .flag-row { display:flex; align-items:center; gap:10px; }

    .integ-row { display:flex; align-items:center; gap:10px; }

    .integ-icon {
      width:36px; height:36px; border-radius:8px; display:flex;
      align-items:center; justify-content:center; font-size:11px;
      font-weight:800; color:#0052CC; flex-shrink:0;
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
