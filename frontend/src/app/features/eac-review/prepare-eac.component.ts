import { Component, signal, inject, computed, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { EacRequestService } from '../../core/services/eac-request.service';
import { PicRequestService } from '../../core/services/pic-request.service';
import { ProjectService } from '../../core/services/project.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-prepare-eac',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  template: `
    <div class="animate-fade-in" [ngClass]="embeddedMode ? '' : 'eac-container'">

      <!-- ══ Top Global Stepper (premium) ══ -->
      @if(!embeddedMode) {
      <div class="global-stepper-container">
        <div class="global-stepper">
          <div class="global-step done">
            <div class="g-step-dot done"><span class="material-icons" style="font-size:12px;">check</span></div>
            <span class="g-step-label">Project Initiation</span>
          </div>
          <div class="g-step-line done"></div>
          <div class="global-step done">
            <div class="g-step-dot done"><span class="material-icons" style="font-size:12px;">check</span></div>
            <span class="g-step-label">Post Project Initiation</span>
          </div>
          <div class="g-step-line done"></div>
          <div class="global-step done">
            <div class="g-step-dot done"><span class="material-icons" style="font-size:12px;">check</span></div>
            <span class="g-step-label">Evaluation</span>
          </div>
          <div class="g-step-line done"></div>
          <div class="global-step active">
            <div class="g-step-dot active"></div>
            <span class="g-step-label">Governance Review</span>
          </div>
          <div class="g-step-line"></div>
          <div class="global-step">
            <div class="g-step-dot"></div>
            <span class="g-step-label">Project Deployment</span>
          </div>
          <div class="g-step-line"></div>
          <div class="global-step">
            <div class="g-step-dot"></div>
            <span class="g-step-label">Post-Implementation Review</span>
          </div>
        </div>
      </div>
      }

      <!-- ══ Main Window Card ══ -->
      <div [ngClass]="embeddedMode ? 'mt-0' : 'eac-window-card mt-4'">

        <!-- Header -->
        @if(!embeddedMode) {
        <div class="window-header">
          <div class="window-title-group">
            <div class="avatar-circle">GU</div>
            <div>
              <h1 class="window-title">Prepare for EAC</h1>
              <div class="window-subtitle">
                Assigned to <span class="text-accent">Gurrammaneesh User</span> &bull; {{ projectId() }} &bull;
                <span class="urgency-chip">Urgency: High</span>
              </div>
            </div>
          </div>
          <div class="window-actions">
            <button type="button" class="win-btn">Link</button>
            <button type="button" class="win-btn">&#9999;</button>
          </div>
        </div>
        }

        @if (!submittedSuccess()) {
        <div class="eac-layout" [class.border-t]="!embeddedMode" [class.single-column]="forceReviewScreen">

          <!-- Left Main Content Area -->
          <div class="main-form-area" [class.border-r]="!embeddedMode" [class.pr-6]="!embeddedMode" [class.mr-6]="!embeddedMode">

            <form [formGroup]="eacForm">

              <!-- EMBEDDED MODE HORIZONTAL TABS -->
              @if(forceReviewScreen) {
                <div class="embedded-tabs">
                  <button type="button" *ngFor="let s of sections; let i = index"
                          (click)="currentSectionIndex.set(i)"
                          class="emb-tab-btn"
                          [class.emb-tab-active]="currentSectionIndex() === i">
                    {{ s.label }}
                  </button>
                </div>
              }

              <!-- STEP 1: Project Overview & Identification -->
              @if (currentSection() === 'identification') {
                <div class="form-section animate-fade-in">
                  <div class="section-header">
                    <div class="section-icon"><span class="material-icons">article</span></div>
                    <div>
                      <h2 class="form-section-title">Project Overview &amp; Identification</h2>
                      <p class="section-subtitle">Basic project details and assignment information</p>
                    </div>
                  </div>
                  <div class="form-row grid-2">
                    <div class="form-group">
                      <label class="field-label">Project Name</label>
                      <input type="text" class="form-control" formControlName="projectName">
                    </div>
                    <div class="form-group">
                      <label class="field-label">Requestor Name</label>
                      <select class="form-control" formControlName="requestorName">
                        <option>Gurrammaneesh User</option>
                      </select>
                    </div>
                  </div>
                  <div class="form-row grid-2">
                    <div class="form-group">
                      <label class="field-label">Requesting Department</label>
                      <select class="form-control" formControlName="requestingDepartment">
                        <option>Business Unit - Specialty</option>
                        <option>Business Unit - Medical</option>
                        <option>Clinical IT</option>
                        <option>Infrastructure</option>
                      </select>
                    </div>
                    <div class="form-group">
                      <label class="field-label">Project Status</label>
                      <select class="form-control" formControlName="projectStatus">
                        <option>Select...</option>
                        <option>Draft</option>
                        <option>In Review</option>
                        <option>EAC Assigned</option>
                      </select>
                    </div>
                  </div>
                  <div class="form-row grid-2">
                    <div class="form-group">
                      <label class="field-label">Project Type</label>
                      <select class="form-control" formControlName="projectType">
                        <option>Select...</option>
                        <option>New Implementation</option>
                        <option>Enhancement</option>
                        <option>Migration</option>
                      </select>
                    </div>
                    <div class="form-group">
                      <label class="field-label">Primary BTA</label>
                      <select class="form-control" formControlName="primaryBTA">
                        <option>Select...</option>
                        <option>John Doe</option>
                        <option>Alice Chen</option>
                      </select>
                    </div>
                  </div>
                  <div class="form-group full-width">
                    <label class="field-label">Target Business Department</label>
                    <textarea class="form-control textarea-input" rows="3" formControlName="targetBusinessDepartment"></textarea>
                  </div>
                </div>
              }

              <!-- STEP 2: Business Justification & Alignment -->
              @if (currentSection() === 'justification') {
                <div class="form-section animate-fade-in">
                  <div class="section-header">
                    <div class="section-icon"><span class="material-icons">lightbulb</span></div>
                    <div>
                      <h2 class="form-section-title">Business Justification &amp; Alignment</h2>
                      <p class="section-subtitle">Define the problem and how this project aligns strategically</p>
                    </div>
                  </div>
                  <div class="form-group full-width">
                    <label class="field-label">Problem or Opportunity Statement</label>
                    <textarea class="form-control textarea-input" rows="3" formControlName="problemStatement"></textarea>
                  </div>
                  <div class="form-group full-width">
                    <label class="field-label">Alignment with Organizational Strategic Goals</label>
                    <div class="editor-toolbar">
                      <button type="button" class="tb-btn">Normal</button>
                      <button type="button" class="tb-btn font-bold">B</button>
                      <button type="button" class="tb-btn italic">I</button>
                      <button type="button" class="tb-btn line-through">S</button>
                      <button type="button" class="tb-btn">≡</button>
                      <button type="button" class="tb-btn">☷</button>
                    </div>
                    <textarea class="form-control textarea-input editor-textarea" rows="3" formControlName="strategicAlignment"></textarea>
                  </div>
                  <div class="form-group full-width">
                    <label class="field-label">Alignment with Enterprise Architecture Principles</label>
                    <div class="editor-toolbar">
                      <button type="button" class="tb-btn">Normal</button>
                      <button type="button" class="tb-btn font-bold">B</button>
                      <button type="button" class="tb-btn italic">I</button>
                      <button type="button" class="tb-btn line-through">S</button>
                      <button type="button" class="tb-btn">≡</button>
                      <button type="button" class="tb-btn">☷</button>
                    </div>
                    <textarea class="form-control textarea-input editor-textarea" rows="3" formControlName="eaPrinciplesAlignment"></textarea>
                  </div>
                </div>
              }

              <!-- STEP 3: Stakeholders -->
              @if (currentSection() === 'stakeholders') {
                <div class="form-section animate-fade-in">
                  <div class="section-header">
                    <div class="section-icon"><span class="material-icons">groups</span></div>
                    <div>
                      <h2 class="form-section-title">Key Stakeholders</h2>
                      <p class="section-subtitle">Identify all project stakeholders and their involvement level</p>
                    </div>
                  </div>
                  
                  <div class="table-container mb-4">
                    <table class="data-table">
                      <thead>
                        <tr>
                          <th>Stakeholder Name</th>
                          <th>Stakeholder Role/Title</th>
                          <th>Department/Organization</th>
                          <th style="width: 150px;">Level of Involvement</th>
                          <th>Key Responsibilities/Interest</th>
                          <th style="width: 40px;"></th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (sh of stakeholders(); track $index; let i = $index) {
                          <tr>
                            <td><input type="text" class="form-control table-input" [(ngModel)]="sh.name" [ngModelOptions]="{standalone: true}"></td>
                            <td><input type="text" class="form-control table-input" [(ngModel)]="sh.role" [ngModelOptions]="{standalone: true}"></td>
                            <td><input type="text" class="form-control table-input" [(ngModel)]="sh.department" [ngModelOptions]="{standalone: true}"></td>
                            <td>
                              <select class="form-control table-input" [(ngModel)]="sh.involvement" [ngModelOptions]="{standalone: true}">
                                <option>High</option>
                                <option>Medium</option>
                                <option>Low</option>
                              </select>
                            </td>
                            <td><input type="text" class="form-control table-input" [(ngModel)]="sh.interest" [ngModelOptions]="{standalone: true}"></td>
                            <td class="text-center">
                              <span class="material-icons text-muted text-sm cursor-pointer hover:text-danger" (click)="removeStakeholder(i)">delete</span>
                            </td>
                          </tr>
                        }
                      </tbody>
                    </table>
                    <div class="p-2 border-t border-gray-200">
                      <button type="button" class="btn btn-link btn-sm text-primary flex items-center gap-1 font-medium" (click)="addStakeholder()">
                        <span class="material-icons text-sm">add</span> Add Stakeholders
                      </button>
                    </div>
                  </div>
                </div>
              }

              <!-- STEP 4: Current State Analysis -->
              @if (currentSection() === 'current_state') {
                <div class="form-section animate-fade-in">
                  <div class="section-header">
                    <div class="section-icon"><span class="material-icons">analytics</span></div>
                    <div>
                      <h2 class="form-section-title">Current State Analysis</h2>
                      <p class="section-subtitle">Describe the current architecture, pain points, and existing systems</p>
                    </div>
                  </div>
                  <div class="form-group full-width">
                    <label class="field-label">Description of Current State Architecture/Processes</label>
                    <div class="editor-toolbar">
                      <button type="button" class="tb-btn">Normal</button>
                      <button type="button" class="tb-btn font-bold">B</button>
                      <button type="button" class="tb-btn italic">I</button>
                      <button type="button" class="tb-btn line-through">S</button>
                      <button type="button" class="tb-btn">≡</button>
                      <button type="button" class="tb-btn">☷</button>
                    </div>
                    <textarea class="form-control textarea-input editor-textarea" rows="4" formControlName="currentStateArchitecture"></textarea>
                  </div>
                  <div class="form-group full-width">
                    <label class="field-label">Identified Pain Points/Challenges in Current State</label>
                    <textarea class="form-control textarea-input" rows="3" formControlName="currentStatePainPoints"></textarea>
                  </div>
                  <div class="form-group full-width">
                    <label class="field-label">Existing Systems/Technologies Involved</label>
                    <textarea class="form-control textarea-input" rows="3" formControlName="currentStateSystems"></textarea>
                  </div>
                </div>
              }

              <!-- STEP 5: Proposed Solution & Technical Details -->
              @if (currentSection() === 'solution') {
                <div class="form-section animate-fade-in">
                  <div class="section-header">
                    <div class="section-icon"><span class="material-icons">dns</span></div>
                    <div>
                      <h2 class="form-section-title">Proposed Solution &amp; Technical Details</h2>
                      <p class="section-subtitle">Detail the technical architecture and implementation approach</p>
                    </div>
                  </div>
                  <div class="form-group full-width">
                    <label class="field-label">Proposed Solution Overview</label>
                    <textarea class="form-control textarea-input" rows="3" formControlName="solutionOverview"></textarea>
                  </div>
                  <div class="form-group full-width">
                    <label class="field-label">Key Technology Stack Components</label>
                    <div class="editor-toolbar">
                      <button type="button" class="tb-btn">Normal</button>
                      <button type="button" class="tb-btn font-bold">B</button>
                      <button type="button" class="tb-btn italic">I</button>
                      <button type="button" class="tb-btn line-through">S</button>
                      <button type="button" class="tb-btn">≡</button>
                      <button type="button" class="tb-btn">☷</button>
                    </div>
                    <textarea class="form-control textarea-input editor-textarea" rows="3" formControlName="techStack"></textarea>
                  </div>
                  <div class="form-group full-width">
                    <label class="field-label">Data Strategy & Considerations</label>
                    <textarea class="form-control textarea-input" rows="2" formControlName="dataStrategy"></textarea>
                  </div>
                  <div class="form-group full-width">
                    <label class="field-label">Security Strategy & Considerations</label>
                    <textarea class="form-control textarea-input" rows="2" formControlName="securityStrategy"></textarea>
                  </div>
                  <div class="form-group full-width">
                    <label class="field-label">Integration & Interoperability Strategy</label>
                    <textarea class="form-control textarea-input" rows="2" formControlName="integrationStrategy"></textarea>
                  </div>
                  <div class="form-group full-width">
                    <label class="field-label">Infrastructure Requirements</label>
                    <textarea class="form-control textarea-input" rows="2" formControlName="infrastructureRequirements"></textarea>
                  </div>
                </div>
              }

              <!-- STEP 6: Risk & Compliance -->
              @if (currentSection() === 'risk') {
                <div class="form-section animate-fade-in">
                  <div class="section-header">
                    <div class="section-icon" style="background:linear-gradient(135deg,#FEF3C7,#FDE68A);color:#D97706;"><span class="material-icons">gpp_maybe</span></div>
                    <div>
                      <h2 class="form-section-title">Risk &amp; Compliance</h2>
                      <p class="section-subtitle">Identify and mitigate project risks and regulatory requirements</p>
                    </div>
                  </div>
                  
                  <div class="form-group full-width mb-4">
                    <label class="field-label">Identified Project Risks</label>
                    <div class="table-container">
                      <table class="data-table">
                        <thead>
                          <tr>
                            <th>Risk Description</th>
                            <th>Mitigation Strategy</th>
                            <th style="width: 120px;">Likelihood</th>
                            <th style="width: 120px;">Impact</th>
                            <th>Mitigation Owner</th>
                            <th style="width: 40px;"></th>
                          </tr>
                        </thead>
                        <tbody>
                          @for (r of risksList(); track $index; let i = $index) {
                            <tr>
                              <td><textarea class="form-control table-input" rows="1" [(ngModel)]="r.description" [ngModelOptions]="{standalone: true}"></textarea></td>
                              <td><textarea class="form-control table-input" rows="1" [(ngModel)]="r.mitigation" [ngModelOptions]="{standalone: true}"></textarea></td>
                              <td>
                                <select class="form-control table-input" [(ngModel)]="r.likelihood" [ngModelOptions]="{standalone: true}">
                                  <option>High</option>
                                  <option>Medium</option>
                                  <option>Low</option>
                                </select>
                              </td>
                              <td>
                                <select class="form-control table-input" [(ngModel)]="r.impact" [ngModelOptions]="{standalone: true}">
                                  <option>High</option>
                                  <option>Medium</option>
                                  <option>Low</option>
                                </select>
                              </td>
                              <td><input type="text" class="form-control table-input" [(ngModel)]="r.owner" [ngModelOptions]="{standalone: true}"></td>
                              <td class="text-center">
                                <span class="material-icons text-muted text-sm cursor-pointer hover:text-danger" (click)="removeRisk(i)">delete</span>
                              </td>
                            </tr>
                          }
                        </tbody>
                      </table>
                      <div class="p-2 border-t border-gray-200">
                        <button type="button" class="btn btn-link btn-sm text-primary flex items-center gap-1 font-medium" (click)="addRisk()">
                          <span class="material-icons text-sm">add</span> Add Risk & Compliance
                        </button>
                      </div>
                    </div>
                  </div>

                  <div class="form-group full-width">
                    <label class="field-label">Relevant Compliance/Regulatory Standards</label>
                    <textarea class="form-control textarea-input" rows="2" formControlName="complianceStandards"></textarea>
                  </div>
                  <div class="form-group full-width">
                    <label class="field-label">How Project Addresses Compliance</label>
                    <textarea class="form-control textarea-input" rows="2" formControlName="howAddressesCompliance"></textarea>
                  </div>
                </div>
              }

              <!-- STEP 7: Timeline & Resources -->
              @if (currentSection() === 'timeline') {
                <div class="form-section animate-fade-in">
                  <div class="section-header">
                    <div class="section-icon" style="background:linear-gradient(135deg,#ECFEFF,#CFFAFE);color:#0891B2;"><span class="material-icons">calendar_month</span></div>
                    <div>
                      <h2 class="form-section-title">Timeline &amp; Resources</h2>
                      <p class="section-subtitle">Set project dates, milestones, budget and human resources</p>
                    </div>
                  </div>
                  <div class="form-row grid-2">
                    <div class="form-group">
                      <label class="field-label">Project Start Date</label>
                      <input type="date" class="form-control" formControlName="startDate">
                    </div>
                    <div class="form-group">
                      <label class="field-label">Project End Date</label>
                      <input type="date" class="form-control" formControlName="endDate">
                    </div>
                  </div>

                  <div class="form-group full-width mt-4 mb-4">
                    <label class="field-label">Key Milestones</label>
                    <div class="table-container">
                      <table class="data-table">
                        <thead>
                          <tr>
                            <th>Milestone Name</th>
                            <th style="width: 160px;">Target Date</th>
                            <th>Key Deliverables</th>
                            <th style="width: 40px;"></th>
                          </tr>
                        </thead>
                        <tbody>
                          @for (m of milestones(); track $index; let i = $index) {
                            <tr>
                              <td><input type="text" class="form-control table-input" [(ngModel)]="m.name" [ngModelOptions]="{standalone: true}"></td>
                              <td><input type="date" class="form-control table-input" [(ngModel)]="m.date" [ngModelOptions]="{standalone: true}"></td>
                              <td><input type="text" class="form-control table-input" [(ngModel)]="m.deliverables" [ngModelOptions]="{standalone: true}"></td>
                              <td class="text-center">
                                <span class="material-icons text-muted text-sm cursor-pointer hover:text-danger" (click)="removeMilestone(i)">delete</span>
                              </td>
                            </tr>
                          }
                        </tbody>
                      </table>
                      <div class="p-2 border-t border-gray-200">
                        <button type="button" class="btn btn-link btn-sm text-primary flex items-center gap-1 font-medium" (click)="addMilestone()">
                          <span class="material-icons text-sm">add</span> Add Timeline
                        </button>
                      </div>
                    </div>
                  </div>

                  <div class="form-row grid-2">
                    <div class="form-group">
                      <label class="field-label">Estimated Total Project Budget</label>
                      <input type="text" class="form-control" formControlName="estimatedBudget">
                    </div>
                    <div class="form-group">
                      <label class="field-label">Funding Source</label>
                      <select class="form-control" formControlName="fundingSource">
                        <option>Operational Budget</option>
                        <option>Capital Budget</option>
                        <option>Grants/External</option>
                      </select>
                    </div>
                  </div>

                  <div class="form-group full-width mt-4">
                    <label class="field-label">Budget BreakDown</label>
                    <div class="editor-toolbar">
                      <button type="button" class="tb-btn font-bold">B</button>
                      <button type="button" class="tb-btn italic">I</button>
                      <button type="button" class="tb-btn">≡</button>
                      <button type="button" class="tb-btn">☷</button>
                    </div>
                    <textarea class="form-control textarea-input editor-textarea" rows="3" formControlName="budgetBreakdown"></textarea>
                  </div>
                  
                  <div class="form-group full-width">
                    <label class="field-label">Required Human Resources</label>
                    <div class="editor-toolbar">
                      <button type="button" class="tb-btn font-bold">B</button>
                      <button type="button" class="tb-btn italic">I</button>
                      <button type="button" class="tb-btn">≡</button>
                      <button type="button" class="tb-btn">☷</button>
                    </div>
                    <textarea class="form-control textarea-input editor-textarea" rows="3" formControlName="humanResources"></textarea>
                  </div>
                </div>
              }

              <!-- STEP 8: Business Impact & Alternatives -->
              @if (currentSection() === 'impact') {
                <div class="form-section animate-fade-in">
                  <div class="section-header">
                    <div class="section-icon" style="background:linear-gradient(135deg,#D1FAE5,#A7F3D0);color:#059669;"><span class="material-icons">trending_up</span></div>
                    <div>
                      <h2 class="form-section-title">Business Impact &amp; Alternatives</h2>
                      <p class="section-subtitle">Quantify business value and document alternative options considered</p>
                    </div>
                  </div>
                  
                  <div class="form-row grid-2">
                    <div class="form-group">
                      <label class="field-label">Impact on Operations</label>
                      <textarea class="form-control textarea-input" rows="2" formControlName="impactOperations"></textarea>
                    </div>
                    <div class="form-group">
                      <label class="field-label">Estimated Revenue Impact</label>
                      <textarea class="form-control textarea-input" rows="2" formControlName="impactRevenue"></textarea>
                    </div>
                  </div>

                  <div class="form-row grid-2">
                    <div class="form-group">
                      <label class="field-label">Estimated Cost Savings</label>
                      <input type="text" class="form-control" formControlName="impactSavings">
                    </div>
                    <div class="form-group">
                      <label class="field-label">Impact on Customer Experience</label>
                      <input type="text" class="form-control" formControlName="impactCustomer">
                    </div>
                  </div>

                  <div class="form-group full-width">
                    <label class="field-label">Impact on Competitive Advantage</label>
                    <textarea class="form-control textarea-input" rows="2" formControlName="impactCompetitive"></textarea>
                  </div>

                  <div class="form-group full-width mb-4">
                    <label class="field-label">Alternative Solutions Considered</label>
                    <div class="table-container">
                      <table class="data-table">
                        <thead>
                          <tr>
                            <th>Alternative Solution Name</th>
                            <th>Alternative Solution Description</th>
                            <th>Reason Not Chosen</th>
                            <th>Pros</th>
                            <th>Cons</th>
                            <th style="width: 40px;"></th>
                          </tr>
                        </thead>
                        <tbody>
                          @for (alt of solutionsConsidered(); track $index; let i = $index) {
                            <tr>
                              <td><input type="text" class="form-control table-input" [(ngModel)]="alt.name" [ngModelOptions]="{standalone: true}"></td>
                              <td><textarea class="form-control table-input" rows="1" [(ngModel)]="alt.description" [ngModelOptions]="{standalone: true}"></textarea></td>
                              <td><textarea class="form-control table-input" rows="1" [(ngModel)]="alt.reasonNotChosen" [ngModelOptions]="{standalone: true}"></textarea></td>
                              <td><input type="text" class="form-control table-input" [(ngModel)]="alt.pros" [ngModelOptions]="{standalone: true}"></td>
                              <td><input type="text" class="form-control table-input" [(ngModel)]="alt.cons" [ngModelOptions]="{standalone: true}"></td>
                              <td class="text-center">
                                <span class="material-icons text-muted text-sm cursor-pointer hover:text-danger" (click)="removeSolution(i)">delete</span>
                              </td>
                            </tr>
                          }
                        </tbody>
                      </table>
                      <div class="p-2 border-t border-gray-200">
                        <button type="button" class="btn btn-link btn-sm text-primary flex items-center gap-1 font-medium" (click)="addSolution()">
                          <span class="material-icons text-sm">add</span> Add Solutions Considered
                        </button>
                      </div>
                    </div>
                  </div>

                  <div class="form-group full-width">
                    <label class="field-label">Rationale for Choosing Proposed Solution</label>
                    <textarea class="form-control textarea-input" rows="3" formControlName="rationale"></textarea>
                  </div>
                </div>
              }

              <!-- STEP 9: Feasibility & Future Readiness -->
              @if (currentSection() === 'readiness') {
                <div class="form-section animate-fade-in">
                  <div class="section-header">
                    <div class="section-icon" style="background:linear-gradient(135deg,#F5F3FF,#EDE9FE);color:#7C3AED;"><span class="material-icons">rocket_launch</span></div>
                    <div>
                      <h2 class="form-section-title">Feasibility &amp; Future Readiness</h2>
                      <p class="section-subtitle">Assess scalability, technical feasibility and capability alignment</p>
                    </div>
                  </div>
                  <div class="form-group full-width">
                    <label class="field-label">Scalability Assessment</label>
                    <textarea class="form-control textarea-input" rows="3" formControlName="scalability"></textarea>
                  </div>
                  <div class="form-group full-width">
                    <label class="field-label">Future Readiness</label>
                    <textarea class="form-control textarea-input" rows="3" formControlName="futureReadiness"></textarea>
                  </div>
                  <div class="form-group full-width">
                    <label class="field-label">Technical Feasibility Statement</label>
                    <textarea class="form-control textarea-input" rows="3" formControlName="feasibilityStatement"></textarea>
                  </div>
                  <div class="form-group full-width">
                    <label class="field-label">Alignment with Current IT Capabilities</label>
                    <textarea class="form-control textarea-input" rows="3" formControlName="itCapabilitiesAlignment"></textarea>
                  </div>
                  <div class="form-group full-width">
                    <label class="field-label">Required New Skills</label>
                    <textarea class="form-control textarea-input" rows="3" formControlName="newSkillsRequired"></textarea>
                  </div>
                </div>
              }

              <!-- STEP 10: EAC Checklist -->
              @if (currentSection() === 'checklist') {
                <div class="form-section animate-fade-in">
                  <div class="section-header">
                    <div class="section-icon" style="background:linear-gradient(135deg,#D1FAE5,#A7F3D0);color:#059669;"><span class="material-icons">fact_check</span></div>
                    <div>
                      <h2 class="form-section-title">EAC Committee Mandatory Checklist</h2>
                      <p class="section-subtitle">Confirm all gate reviewers and mandatory architecture verifications</p>
                    </div>
                  </div>
                  <div class="p-8 bg-gradient-to-br from-[#FAFBFC] to-white border border-gray-200 rounded-2xl shadow-sm mb-8 relative overflow-hidden">
                    <div class="absolute top-0 right-0 w-64 h-64 bg-green-50 rounded-full blur-3xl opacity-50 -mr-10 -mt-10 pointer-events-none"></div>
                    <h3 class="relative z-10 text-[15px] font-extrabold text-[#172B4D] mb-6 uppercase tracking-[0.1em] flex items-center gap-3">
                        <div class="w-8 h-8 rounded-full bg-green-100 text-[#00875A] flex items-center justify-center">
                            <span class="material-icons text-[18px]">group</span> 
                        </div>
                        EAC Committee Gate Reviewers
                    </h3>
                    <div class="grid grid-cols-2 gap-5 relative z-10">
                        <label class="relative flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-[#00875A] hover:shadow-md cursor-pointer transition-all duration-300 overflow-hidden group">
                            <input type="checkbox" class="peer sr-only" checked>
                            <div class="absolute left-0 top-0 bottom-0 w-1.5 bg-[#00875A] translate-x-[-100%] peer-checked:translate-x-0 transition-transform duration-300 ease-out z-0"></div>
                            <div class="absolute inset-0 bg-green-50/20 opacity-0 peer-checked:opacity-100 transition-opacity duration-300 z-0"></div>
                            <div class="flex-shrink-0 w-6 h-6 border-2 border-gray-300 rounded bg-white peer-checked:bg-[#00875A] peer-checked:border-[#00875A] transition-all duration-300 flex items-center justify-center relative z-10">
                                <svg class="w-4 h-4 text-white opacity-0 peer-checked:opacity-100 transition-opacity duration-300 scale-50 peer-checked:scale-100" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" /></svg>
                            </div>
                            <div class="relative z-10 flex-1 pl-1">
                                <span class="block text-[14px] font-bold text-gray-800 group-hover:text-[#00875A] transition-colors">Enterprise Architecture Lead</span>
                            </div>
                        </label>
                        <label class="relative flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-[#00875A] hover:shadow-md cursor-pointer transition-all duration-300 overflow-hidden group">
                            <input type="checkbox" class="peer sr-only" checked>
                            <div class="absolute left-0 top-0 bottom-0 w-1.5 bg-[#00875A] translate-x-[-100%] peer-checked:translate-x-0 transition-transform duration-300 ease-out z-0"></div>
                            <div class="absolute inset-0 bg-green-50/20 opacity-0 peer-checked:opacity-100 transition-opacity duration-300 z-0"></div>
                            <div class="flex-shrink-0 w-6 h-6 border-2 border-gray-300 rounded bg-white peer-checked:bg-[#00875A] peer-checked:border-[#00875A] transition-all duration-300 flex items-center justify-center relative z-10">
                                <svg class="w-4 h-4 text-white opacity-0 peer-checked:opacity-100 transition-opacity duration-300 scale-50 peer-checked:scale-100" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" /></svg>
                            </div>
                            <div class="relative z-10 flex-1 pl-1">
                                <span class="block text-[14px] font-bold text-gray-800 group-hover:text-[#00875A] transition-colors">Data & Analytics Director</span>
                            </div>
                        </label>
                        <label class="relative flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-[#00875A] hover:shadow-md cursor-pointer transition-all duration-300 overflow-hidden group">
                            <input type="checkbox" class="peer sr-only">
                            <div class="absolute left-0 top-0 bottom-0 w-1.5 bg-[#00875A] translate-x-[-100%] peer-checked:translate-x-0 transition-transform duration-300 ease-out z-0"></div>
                            <div class="absolute inset-0 bg-green-50/20 opacity-0 peer-checked:opacity-100 transition-opacity duration-300 z-0"></div>
                            <div class="flex-shrink-0 w-6 h-6 border-2 border-gray-300 rounded bg-white peer-checked:bg-[#00875A] peer-checked:border-[#00875A] transition-all duration-300 flex items-center justify-center relative z-10">
                                <svg class="w-4 h-4 text-white opacity-0 peer-checked:opacity-100 transition-opacity duration-300 scale-50 peer-checked:scale-100" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" /></svg>
                            </div>
                            <div class="relative z-10 flex-1 pl-1">
                                <span class="block text-[14px] font-bold text-gray-800 group-hover:text-[#00875A] transition-colors">Chief Information Security</span>
                            </div>
                        </label>
                        <label class="relative flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-[#00875A] hover:shadow-md cursor-pointer transition-all duration-300 overflow-hidden group">
                            <input type="checkbox" class="peer sr-only">
                            <div class="absolute left-0 top-0 bottom-0 w-1.5 bg-[#00875A] translate-x-[-100%] peer-checked:translate-x-0 transition-transform duration-300 ease-out z-0"></div>
                            <div class="absolute inset-0 bg-green-50/20 opacity-0 peer-checked:opacity-100 transition-opacity duration-300 z-0"></div>
                            <div class="flex-shrink-0 w-6 h-6 border-2 border-gray-300 rounded bg-white peer-checked:bg-[#00875A] peer-checked:border-[#00875A] transition-all duration-300 flex items-center justify-center relative z-10">
                                <svg class="w-4 h-4 text-white opacity-0 peer-checked:opacity-100 transition-opacity duration-300 scale-50 peer-checked:scale-100" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" /></svg>
                            </div>
                            <div class="relative z-10 flex-1 pl-1">
                                <span class="block text-[14px] font-bold text-gray-800 group-hover:text-[#00875A] transition-colors">Infrastructure Operations VP</span>
                            </div>
                        </label>
                    </div>
                  </div>

                  <div class="p-8 bg-[#FAFBFC] border border-[#DFE1E6] rounded-2xl shadow-[inset_0_2px_10px_rgba(0,0,0,0.02)] relative overflow-hidden">
                    <div class="absolute bottom-0 left-0 w-80 h-32 bg-red-50 rounded-full blur-3xl opacity-60 -ml-20 -mb-10 pointer-events-none"></div>
                    <h3 class="relative z-10 text-[15px] font-extrabold text-[#DE350B] mb-6 uppercase tracking-[0.1em] flex items-center gap-3">
                        <div class="w-8 h-8 rounded-full bg-red-100 text-[#DE350B] flex items-center justify-center">
                            <span class="material-icons text-[18px]">verified_user</span>
                        </div>
                        Mandatory EAC Architecture Verification
                    </h3>
                    <div class="flex flex-col gap-4 relative z-10">
                        <label class="relative flex items-start gap-5 p-5 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-[#DE350B] hover:shadow-md cursor-pointer transition-all duration-300 overflow-hidden group">
                            <input type="checkbox" class="peer sr-only">
                            <div class="absolute left-0 top-0 bottom-0 w-1.5 bg-[#DE350B] translate-x-[-100%] peer-checked:translate-x-0 transition-transform duration-300 ease-out z-0"></div>
                            <div class="absolute inset-0 bg-red-50/10 opacity-0 peer-checked:opacity-100 transition-opacity duration-300 z-0"></div>
                            <div class="flex-shrink-0 w-6 h-6 mt-0.5 border-2 border-gray-300 rounded bg-white peer-checked:bg-[#DE350B] peer-checked:border-[#DE350B] transition-all duration-300 flex items-center justify-center relative z-10">
                                <svg class="w-4 h-4 text-white opacity-0 peer-checked:opacity-100 transition-opacity duration-300 scale-50 peer-checked:scale-100" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" /></svg>
                            </div>
                            <div class="relative z-10 flex-1 pl-1">
                                <span class="block text-[15px] font-extrabold text-gray-900 group-hover:text-[#DE350B] transition-colors leading-snug">Business Architecture Alignment Verified</span>
                                <span class="block text-[13px] font-medium text-gray-500 mt-1.5 leading-relaxed">Proposed solution perfectly meets the strategic organizational goals.</span>
                            </div>
                        </label>
                        <label class="relative flex items-start gap-5 p-5 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-[#DE350B] hover:shadow-md cursor-pointer transition-all duration-300 overflow-hidden group">
                            <input type="checkbox" class="peer sr-only">
                            <div class="absolute left-0 top-0 bottom-0 w-1.5 bg-[#DE350B] translate-x-[-100%] peer-checked:translate-x-0 transition-transform duration-300 ease-out z-0"></div>
                            <div class="absolute inset-0 bg-red-50/10 opacity-0 peer-checked:opacity-100 transition-opacity duration-300 z-0"></div>
                            <div class="flex-shrink-0 w-6 h-6 mt-0.5 border-2 border-gray-300 rounded bg-white peer-checked:bg-[#DE350B] peer-checked:border-[#DE350B] transition-all duration-300 flex items-center justify-center relative z-10">
                                <svg class="w-4 h-4 text-white opacity-0 peer-checked:opacity-100 transition-opacity duration-300 scale-50 peer-checked:scale-100" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" /></svg>
                            </div>
                            <div class="relative z-10 flex-1 pl-1">
                                <span class="block text-[15px] font-extrabold text-gray-900 group-hover:text-[#DE350B] transition-colors leading-snug">Data & Integration Blueprints Approved</span>
                                <span class="block text-[13px] font-medium text-gray-500 mt-1.5 leading-relaxed">Siloed systems are correctly bridged with scalable APIs.</span>
                            </div>
                        </label>
                        <label class="relative flex items-start gap-5 p-5 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-[#DE350B] hover:shadow-md cursor-pointer transition-all duration-300 overflow-hidden group">
                            <input type="checkbox" class="peer sr-only">
                            <div class="absolute left-0 top-0 bottom-0 w-1.5 bg-[#DE350B] translate-x-[-100%] peer-checked:translate-x-0 transition-transform duration-300 ease-out z-0"></div>
                            <div class="absolute inset-0 bg-red-50/10 opacity-0 peer-checked:opacity-100 transition-opacity duration-300 z-0"></div>
                            <div class="flex-shrink-0 w-6 h-6 mt-0.5 border-2 border-gray-300 rounded bg-white peer-checked:bg-[#DE350B] peer-checked:border-[#DE350B] transition-all duration-300 flex items-center justify-center relative z-10">
                                <svg class="w-4 h-4 text-white opacity-0 peer-checked:opacity-100 transition-opacity duration-300 scale-50 peer-checked:scale-100" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" /></svg>
                            </div>
                            <div class="relative z-10 flex-1 pl-1">
                                <span class="block text-[15px] font-extrabold text-gray-900 group-hover:text-[#DE350B] transition-colors leading-snug">Core Security Standards Met</span>
                                <span class="block text-[13px] font-medium text-gray-500 mt-1.5 leading-relaxed">Vendor compliance and infrastructure isolation successfully pass standards.</span>
                            </div>
                        </label>
                    </div>
                  </div>
                </div>
              }
            </form>

            <!-- Bottom Action Footer — Fill form with AI & Save for later removed -->
            @if(!forceReviewScreen) {
            <div class="eac-footer">
              <button type="button" class="btn btn-outline" (click)="cancel()">Cancel</button>
              <div class="flex items-center gap-3">
                <button type="button" class="btn btn-outline" (click)="prevSection()" [disabled]="currentSectionIndex() === 0">&#8592; Previous</button>
                <button type="button" class="btn btn-primary" (click)="nextSection()">
                  {{ currentSectionIndex() === sections.length - 1 ? 'Submit EAC Dossier' : 'Next \u2192' }}
                </button>
              </div>
            </div>
            }

          </div>

          <!-- Right Sidebar Stepper -->
          @if(!forceReviewScreen) {
          <div class="right-stepper-area">
            <div class="vertical-stepper">
              @for (section of sections; track section.id; let i = $index) {
                <div class="v-step" 
                     [class.active]="currentSection() === section.id"
                     [class.completed]="i < currentSectionIndex()"
                     (click)="goToSection(section.id)">
                  <div class="v-step-indicator"></div>
                  <div class="v-step-label">{{ section.label }}</div>
                </div>
              }
            </div>
          </div>
          }

        </div>
        } @else {
          <div class="success-screen animate-fade-in flex flex-col items-center justify-center py-16 text-center">
            <div class="success-icon-wrapper mb-6">
              <span class="material-icons success-icon-large" style="font-size: 64px; color: #36B37E">check_circle</span>
            </div>
            <h2 class="text-2xl font-bold text-primary-dark mb-2">EAC Dossier Submitted!</h2>
            <p class="text-muted max-w-md mb-8">
              The EAC prepare phase is complete. It has now been routed to the Project Improvement Committee (PIC).
            </p>
            
            <div class="flex gap-4">
              <button type="button" class="btn btn-outline" (click)="cancel()">Return to Inbox</button>
              
              @if (isAdmin()) {
                <button type="button" class="btn flex items-center gap-2" (click)="adminOverridePic()" style="background: #00875A; color: #FFFFFF; border: none; font-weight: 600; padding: 8px 16px; border-radius: 6px;">
                  <span class="material-icons text-sm">rocket_launch</span> Admin Override: PIC Prepare
                </button>
              }
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    /* ── Premium EAC Design System ──────────────────────────── */
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Outfit:wght@600;700;800&display=swap');

    .eac-container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 20px;
      background: linear-gradient(135deg, #F0F4FF 0%, #FAF5FF 50%, #F0FFFE 100%);
      min-height: calc(100vh - 60px);
      font-family: 'Inter', sans-serif;
    }

    /* ── Global Horizontal Stepper (premium pills) ── */
    .global-stepper-container {
      background: white;
      border: 1px solid rgba(226,232,240,0.8);
      border-radius: 14px;
      padding: 16px 24px;
      margin-bottom: 16px;
      box-shadow: 0 2px 12px rgba(79,70,229,0.06);
    }

    .global-stepper {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
    }

    .global-step {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      font-weight: 600;
      color: #94A3B8;
      &.active { color: #1E293B; }
      &.done  { color: #059669; }
    }

    .g-step-dot {
      width: 22px; height: 22px;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      background: white;
      border: 2px solid #E2E8F0;
      color: #94A3B8;
      flex-shrink: 0;
      transition: all 0.2s;
      &.done  { background: #059669; border-color: #059669; color: white; }
      &.active {
        background: linear-gradient(135deg, #4F46E5, #7C3AED);
        border-color: #4F46E5;
        box-shadow: 0 0 0 3px rgba(79,70,229,0.2);
      }
    }

    .g-step-label { white-space: nowrap; }

    .g-step-line {
      flex: 1;
      height: 2px;
      background: #E2E8F0;
      margin: 0 10px;
      border-radius: 9999px;
      &.done { background: linear-gradient(90deg, #059669, #34D399); }
    }

    /* ── Main Window Card ── */
    .eac-window-card {
      background: white;
      border: 1px solid rgba(226,232,240,0.8);
      border-radius: 18px;
      box-shadow: 0 4px 24px rgba(79,70,229,0.07);
      overflow: hidden;
      position: relative;
      &::before {
        content: '';
        position: absolute;
        top: 0; left: 0; right: 0;
        height: 3px;
        background: linear-gradient(90deg, #4F46E5 0%, #7C3AED 50%, #06B6D4 100%);
      }
    }

    .window-header {
      padding: 18px 28px;
      border-bottom: 1px solid rgba(226,232,240,0.6);
      background: rgba(248,250,252,0.5);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .window-title-group { display: flex; align-items: center; gap: 14px; }

    .avatar-circle {
      width: 40px; height: 40px;
      border-radius: 50%;
      background: linear-gradient(135deg, #4F46E5, #7C3AED);
      color: white;
      display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: 13px;
      box-shadow: 0 2px 8px rgba(79,70,229,0.3);
    }

    .window-title {
      font-size: 16px;
      font-weight: 800;
      color: #1E293B;
      margin: 0;
      font-family: 'Outfit', sans-serif;
    }

    .window-subtitle { font-size: 12px; color: #94A3B8; margin-top: 2px; }
    .text-accent { color: #4F46E5; font-weight: 600; }

    .urgency-chip {
      display: inline-flex;
      padding: 2px 10px;
      border-radius: 9999px;
      background: linear-gradient(135deg, #FEF3C7, #FDE68A);
      color: #D97706;
      font-size: 11px;
      font-weight: 700;
      margin-left: 4px;
    }

    .window-actions { display: flex; gap: 8px; }

    .win-btn {
      padding: 6px 14px;
      border: 1.5px solid rgba(226,232,240,0.9);
      background: white;
      border-radius: 8px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
      color: #64748B;
      transition: all 0.2s;
      &:hover { background: rgba(238,242,255,0.6); border-color: rgba(79,70,229,0.3); color: #4F46E5; }
    }

    /* ── Layout ── */
    .eac-layout {
      display: grid;
      grid-template-columns: 1fr 280px;
      min-height: 500px;
    }
    .eac-layout.single-column { display: block; }

    .main-form-area {
      padding: 28px 28px 0;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }

    .right-stepper-area {
      padding: 28px 20px;
      background: rgba(248,250,252,0.5);
      border-left: 1px solid rgba(226,232,240,0.5);
    }

    /* ── Form Section ── */
    .form-section { padding-bottom: 8px; }

    .section-header {
      display: flex;
      align-items: flex-start;
      gap: 16px;
      margin-bottom: 24px;
      padding-bottom: 20px;
      border-bottom: 1px solid rgba(226,232,240,0.6);
    }

    .section-icon {
      width: 48px; height: 48px;
      border-radius: 14px;
      display: flex; align-items: center; justify-content: center;
      background: linear-gradient(135deg, #EEF2FF, #F5F3FF);
      color: #4F46E5;
      flex-shrink: 0;
      box-shadow: 0 2px 8px rgba(79,70,229,0.15);
      .material-icons { font-size: 22px; }
    }

    .form-section-title {
      font-size: 18px;
      font-weight: 800;
      color: #1E293B;
      margin: 0 0 4px;
      font-family: 'Outfit', sans-serif;
    }

    .section-subtitle {
      font-size: 12px;
      color: #94A3B8;
      margin: 0;
      font-weight: 500;
    }

    .form-row.grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 16px;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .full-width { width: 100%; margin-bottom: 16px; }

    .field-label {
      font-size: 11px;
      font-weight: 700;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    /* ── Input with icon ── */
    .input-wrap {
      position: relative;
      display: flex;
      align-items: center;
    }
    .input-icon {
      position: absolute;
      left: 10px;
      font-size: 18px !important;
      color: #94A3B8;
      pointer-events: none;
      z-index: 1;
    }
    .icon-input { padding-left: 36px !important; }

    .form-control {
      width: 100%;
      padding: 9px 14px;
      font-size: 13px;
      font-family: 'Inter', sans-serif;
      font-weight: 500;
      border: 1.5px solid #E2E8F0;
      border-radius: 10px;
      background: white;
      color: #1E293B;
      outline: none;
      transition: all 0.2s ease;
      &:focus {
        border-color: rgba(79,70,229,0.5);
        background: white;
        box-shadow: 0 0 0 4px rgba(79,70,229,0.10);
      }
      &::placeholder { color: #CBD5E1; }
    }

    .textarea-input { resize: vertical; font-family: 'Inter', sans-serif; }

    /* ── Editor Toolbars ── */
    .editor-toolbar {
      display: flex;
      gap: 3px;
      background: rgba(241,245,249,0.8);
      border: 1.5px solid #E2E8F0;
      border-bottom: none;
      padding: 5px;
      border-radius: 10px 10px 0 0;
    }

    .tb-btn {
      padding: 3px 9px;
      border: 1px solid transparent;
      background: transparent;
      border-radius: 6px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
      color: #64748B;
      min-width: 26px; height: 26px;
      display: flex; align-items: center; justify-content: center;
      transition: all 0.15s;
      &:hover { background: white; border-color: #E2E8F0; color: #1E293B; box-shadow: 0 1px 4px rgba(15,23,42,0.08); }
    }

    .editor-textarea {
      border-radius: 0 0 10px 10px !important;
      border-top-color: #E2E8F0;
    }

    /* ── Tables ── */
    .table-container {
      border: 1.5px solid rgba(226,232,240,0.8);
      border-radius: 12px;
      overflow: hidden;
      background: white;
      box-shadow: 0 2px 8px rgba(79,70,229,0.04);
    }

    .data-table {
      width: 100%;
      border-collapse: collapse;

      th {
        background: rgba(248,250,252,0.9);
        padding: 10px 14px;
        text-align: left;
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.6px;
        color: #64748B;
        border-bottom: 1.5px solid rgba(226,232,240,0.8);
      }

      td {
        padding: 9px 14px;
        border-bottom: 1px solid rgba(226,232,240,0.5);
        vertical-align: middle;
      }

      tr:last-child td { border-bottom: none; }
      tbody tr { transition: background 0.15s; }
      tbody tr:hover { background: rgba(238,242,255,0.3); }
    }

    .table-input {
      padding: 6px 10px !important;
      height: 34px;
      font-size: 12px;
      border-radius: 7px !important;
      background: rgba(248,250,252,0.8) !important;
    }

    .table-add-row {
      padding: 10px 14px;
      border-top: 1px solid rgba(226,232,240,0.6);
      background: rgba(248,250,252,0.5);
    }

    .add-row-btn {
      display: flex; align-items: center; gap: 6px;
      background: none;
      border: none;
      cursor: pointer;
      font-size: 12px;
      font-weight: 700;
      color: #4F46E5;
      padding: 4px 8px;
      border-radius: 7px;
      transition: all 0.15s;
      &:hover { background: rgba(238,242,255,0.7); }
    }

    .del-icon {
      font-size: 17px !important;
      color: #CBD5E1;
      cursor: pointer;
      transition: color 0.15s;
      &:hover { color: #DC2626; }
    }

    /* ── Embedded Tabs ── */
    .embedded-tabs {
      display: flex; gap: 6px;
      overflow-x: auto;
      padding-bottom: 16px;
      margin-bottom: 16px;
      border-bottom: 1px solid rgba(226,232,240,0.6);
    }

    .emb-tab-btn {
      padding: 6px 16px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 700;
      white-space: nowrap;
      cursor: pointer;
      transition: all 0.2s;
      border: 1.5px solid rgba(226,232,240,0.9);
      background: white;
      color: #64748B;
      &:hover { border-color: rgba(79,70,229,0.3); color: #4F46E5; }
    }

    .emb-tab-active {
      background: linear-gradient(135deg, #4F46E5, #7C3AED) !important;
      color: white !important;
      border-color: transparent !important;
      box-shadow: 0 2px 8px rgba(79,70,229,0.3);
    }

    /* ── Buttons ── */
    .btn {
      padding: 9px 20px;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 700;
      font-family: 'Inter', sans-serif;
      cursor: pointer;
      transition: all 0.2s;
      outline: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      border: none;
    }

    .btn-outline {
      background: white;
      border: 1.5px solid rgba(226,232,240,0.9);
      color: #64748B;
      &:hover:not([disabled]) { background: rgba(248,250,252,0.9); border-color: rgba(79,70,229,0.3); color: #4F46E5; }
      &[disabled] { opacity: 0.4; cursor: not-allowed; }
    }

    .btn-primary {
      background: linear-gradient(135deg, #4F46E5, #7C3AED);
      color: white;
      box-shadow: 0 4px 14px rgba(79,70,229,0.35);
      border: none;
      &:hover { transform: translateY(-1px); box-shadow: 0 8px 20px rgba(79,70,229,0.45); }
      &:active { transform: scale(0.98); }
    }

    .btn-link {
      background: transparent;
      border: none;
      padding: 4px 8px;
      &:hover { background: rgba(238,242,255,0.6); border-radius: 7px; }
    }

    /* ── EAC Footer ── */
    .eac-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 0 24px;
      margin-top: 8px;
      border-top: 1px solid rgba(226,232,240,0.6);
    }

    /* ── Right Vertical Stepper (premium) ── */
    .vertical-stepper {
      display: flex;
      flex-direction: column;
      gap: 4px;
      position: relative;

      &::before {
        content: '';
        position: absolute;
        top: 12px; bottom: 12px;
        left: 7px;
        width: 2px;
        background: linear-gradient(180deg, #4F46E5 0%, rgba(226,232,240,0.4) 100%);
        border-radius: 9999px;
        z-index: 0;
      }
    }

    .v-step {
      display: flex;
      align-items: center;
      gap: 12px;
      position: relative;
      z-index: 1;
      cursor: pointer;
      padding: 8px 10px;
      border-radius: 10px;
      transition: background 0.15s;
      &:hover:not(.active) { background: rgba(238,242,255,0.5); }

      .v-step-indicator {
        width: 16px; height: 16px;
        border-radius: 50%;
        background: white;
        border: 2px solid #E2E8F0;
        flex-shrink: 0;
        transition: all 0.2s;
      }

      .v-step-label {
        font-size: 12px;
        font-weight: 500;
        color: #94A3B8;
        line-height: 1.4;
        transition: all 0.2s;
      }

      &.completed {
        .v-step-indicator {
          border-color: #059669;
          background: #D1FAE5;
          &::after {
            content: '';
            display: block;
            width: 6px; height: 6px;
            border-radius: 50%;
            background: #059669;
            margin: auto;
          }
        }
        .v-step-label { color: #64748B; }
      }

      &.active {
        background: rgba(238,242,255,0.7);
        .v-step-indicator {
          background: linear-gradient(135deg, #4F46E5, #7C3AED);
          border-color: #4F46E5;
          box-shadow: 0 0 0 3px rgba(79,70,229,0.2), 0 2px 8px rgba(79,70,229,0.35);
        }
        .v-step-label {
          color: #4F46E5;
          font-weight: 700;
        }
      }
    }

    /* ── Checklist Panels ── */
    .checklist-panel {
      padding: 28px;
      border-radius: 18px;
      position: relative;
      overflow: hidden;
    }

    .green-panel {
      background: linear-gradient(135deg, #F0FDF9, #F5FFFA);
      border: 1px solid rgba(5,150,105,0.15);
    }

    .red-panel {
      background: linear-gradient(135deg, #FFF8F8, #FFF5F5);
      border: 1px solid rgba(220,38,38,0.12);
    }

    .checklist-panel-title {
      font-size: 12px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 20px;
      position: relative;
      z-index: 10;
    }

    .green-title { color: #065F46; }
    .red-title   { color: #991B1B; }

    .checklist-panel-icon {
      width: 30px; height: 30px;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
    }

    .green-icon { background: rgba(5,150,105,0.12); color: #059669; }
    .red-icon   { background: rgba(220,38,38,0.1);  color: #DC2626; }

    .checklist-item {
      position: relative;
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 14px 16px;
      background: white;
      border: 1.5px solid rgba(226,232,240,0.7);
      border-radius: 12px;
      cursor: pointer;
      overflow: hidden;
      transition: all 0.2s;
      &:hover { border-color: rgba(5,150,105,0.35); box-shadow: 0 4px 16px rgba(5,150,105,0.1); }
    }

    .checklist-item-lg {
      position: relative;
      display: flex;
      align-items: flex-start;
      gap: 16px;
      padding: 18px 18px;
      background: white;
      border: 1.5px solid rgba(226,232,240,0.7);
      border-radius: 12px;
      cursor: pointer;
      overflow: hidden;
      transition: all 0.2s;
      &:hover { border-color: rgba(220,38,38,0.3); box-shadow: 0 4px 16px rgba(220,38,38,0.08); }
    }

    .ci-accent-bar {
      position: absolute;
      left: 0; top: 0; bottom: 0;
      width: 4px;
      border-radius: 12px 0 0 12px;
      transform: translateX(-100%);
      transition: transform 0.3s ease;
    }

    .green-bar { background: linear-gradient(180deg, #059669, #047857); }
    .red-bar   { background: linear-gradient(180deg, #DC2626, #B91C1C); }

    .checklist-item input[type=checkbox]:checked ~ .ci-accent-bar,
    .checklist-item-lg input[type=checkbox]:checked ~ .ci-accent-bar {
      transform: translateX(0);
    }

    .ci-checkbox {
      flex-shrink: 0;
      width: 20px; height: 20px;
      border: 2px solid #E2E8F0;
      border-radius: 6px;
      background: white;
      display: flex; align-items: center; justify-content: center;
      transition: all 0.2s;
      position: relative; z-index: 10;
    }

    .ci-checkbox-lg {
      flex-shrink: 0;
      width: 22px; height: 22px;
      margin-top: 2px;
      border: 2px solid #E2E8F0;
      border-radius: 6px;
      background: white;
      display: flex; align-items: center; justify-content: center;
      transition: all 0.2s;
      position: relative; z-index: 10;
    }

    .ci-checked-green { background: #059669 !important; border-color: #059669 !important; }
    .ci-checked-red   { background: #DC2626 !important; border-color: #DC2626 !important; }

    .ci-check {
      width: 12px; height: 12px;
      color: white;
    }

    .ci-label {
      font-size: 13px;
      font-weight: 700;
      color: #1E293B;
      transition: color 0.15s;
      flex: 1;
    }

    .text-primary { color: #4F46E5; }
    .text-muted   { color: #94A3B8; }
    .text-danger  { color: #DC2626; }
    .font-medium  { font-weight: 500; }
  `]
})
export class PrepareEacComponent {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private eacRequestService = inject(EacRequestService);
  private picRequestService = inject(PicRequestService);
  private projectService = inject(ProjectService);
  private authService = inject(AuthService);

  @Input() embeddedMode = false;
  @Input() forceReviewScreen = false;
  
  eacForm: FormGroup;

  projectId = signal('P-1002');
  currentSectionIndex = signal(0);
  submittedSuccess = signal(false);
  fromAdminOverride = signal(false);
  isAdmin = computed(() => this.authService.hasRole('admin'));

  sections = [
    { id: 'identification', label: 'Project Overview & Identification' },
    { id: 'justification', label: 'Business Justification & Alignment' },
    { id: 'stakeholders', label: 'Stakeholders' },
    { id: 'current_state', label: 'Current State Analysis' },
    { id: 'solution', label: 'Proposed Solution & Technical Details' },
    { id: 'risk', label: 'Risk & Compliance' },
    { id: 'timeline', label: 'Timeline & Resources' },
    { id: 'impact', label: 'Business Impact & Alternatives' },
    { id: 'readiness', label: 'Feasibility & Future Readiness' },
    { id: 'checklist', label: 'EAC Checklist' }
  ];

  // Lists handled by signal arrays for high responsiveness
  stakeholders = signal<any[]>([
    { name: 'John Doe', role: 'Business Owner', department: 'Specialty', involvement: 'High', interest: 'Key sponsor for system automation' }
  ]);

  risksList = signal<any[]>([
    { description: 'Data migration latency and sync errors', mitigation: 'Phase rollout, run checks, and staging databases', likelihood: 'Medium', impact: 'High', owner: 'Maneesh G.' }
  ]);

  milestones = signal<any[]>([
    { name: 'Design Review & Architecture Signoff', date: '2026-08-15', deliverables: 'HLD, LLD documents' },
    { name: 'MVP Development Completion', date: '2026-09-30', deliverables: 'Beta application release' }
  ]);

  solutionsConsidered = signal<any[]>([
    { name: 'Manual Process Staff Increase', description: 'Hire 5 contract workers to input records', reasonNotChosen: 'High long-term cost and potential human-error risk', pros: 'Low initial setup time', cons: 'Inefficient scalability' }
  ]);

  currentSection() {
    return this.sections[this.currentSectionIndex()].id;
  }

  constructor() {
    this.eacForm = this.fb.group({
      projectName: ['Data Entry Automation Initiative'],
      requestorName: ['Gurrammaneesh User'],
      requestingDepartment: ['Business Unit - Specialty'],
      projectStatus: ['EAC Assigned'],
      projectType: ['Enhancement'],
      primaryBTA: ['John Doe'],
      targetBusinessDepartment: ['Operations and Specialist Units'],

      // Justification
      problemStatement: ['Current manual data entry process is time-consuming and error-prone, leading to data quality issues.'],
      strategicAlignment: ['This project directly aligns with the corporate objective of digital transformation and operation automation, improving data-entry throughput.'],
      eaPrinciplesAlignment: ['Promotes reusable API design, cloud-native scalability, and adheres to strict security baselines.'],

      // Current State
      currentStateArchitecture: ['Manual file upload using legacy desktop interface, with local SQL Server parsing scripts. No validation layer before load.'],
      currentStatePainPoints: ['Takes 30+ hours/week of key staff, lacks logging, errors are only caught post-ingestion by users reporting bugs.'],
      currentStateSystems: ['Legacy SQL Uploader Desktop Tool, Local Shared Network Drive, Core Database System'],

      // Solution
      solutionOverview: ['Create a modern web-based intake pipeline using Angular frontend and FastAPI backend with validation rules.'],
      techStack: ['Angular 19, FastAPI, PostgreSQL, AWS S3, TailwindCSS/Vanilla CSS.'],
      dataStrategy: ['Utilize PostgreSQL tables with automated validation schemas. Encrypted storage of tax/PII data.'],
      securityStrategy: ['Enable RBAC (Role-Based Access Control) with OAuth2 flow, secure SSL transfer, and S3 file bucket isolation.'],
      integrationStrategy: ['Direct REST APIs connecting to core systems and webhook support for file notifications.'],
      infrastructureRequirements: ['AWS ECS Fargate containers for backend API, CloudFront + S3 for static frontend hosting.'],

      // Risk extra text
      complianceStandards: ['HIPAA baseline compliance, SOC 2 Type II data-handling protocols.'],
      howAddressesCompliance: ['Full audit logs on user interactions, database level encryption, secure key-rotation schemas.'],

      // Timeline extra text
      startDate: ['2026-08-01'],
      endDate: ['2026-10-31'],
      estimatedBudget: ['$85,000'],
      fundingSource: ['Operational Budget'],
      budgetBreakdown: ['Development: $50,000, QA/Testing: $15,000, Cloud Infrastructure: $20,000'],
      humanResources: ['1 Frontend Architect, 1 Backend Specialist, 0.5 DevOps, 0.5 QA Engineer'],

      // Impact extra text
      impactOperations: ['Reduces manual processing time from 30 hours to 3 hours/week.'],
      impactRevenue: ['Indirect benefit through faster billing cycles, reducing outstanding claims.'],
      impactSavings: ['Saves an estimated $42,000 annually in labor costs and correction fees.'],
      impactCustomer: ['Improved satisfaction through faster response times and accurate statements.'],
      impactCompetitive: ['Standardizes clinical workflow, giving a modern edge to specialized business units.'],
      rationale: ['The proposed web platform gives the highest ROI with a payback period of under 2 years, keeping data highly secure.'],

      // Readiness
      scalability: ['Designed for horizontal scaling using stateless container deployments. Handles 10x current file volume.'],
      futureReadiness: ['Web-app model architecture easily adapts to future AI-driven document extraction modules.'],
      feasibilityStatement: ['High technical feasibility; core libraries are well-established and current team possesses full stack skills.'],
      itCapabilitiesAlignment: ['Aligns with IT initiative to migrate away from local SQL desktop wrappers to enterprise web solutions.'],
      newSkillsRequired: ['AWS Fargate environment management training for the operations/dev team.']
    });

    const state = history.state;
    if (state && state.projectData) {
      if (state.fromAdminOverride) {
        this.fromAdminOverride.set(true);
      }
      const data = state.projectData;
      if (state.projectId) {
        this.projectId.set(state.projectId);
      }
      this.eacForm.patchValue({
        projectName: data.projectName || '',
        requestorName: data.requestorName || 'Gurrammaneesh User',
        requestingDepartment: data.requestingDepartment || 'Business Unit - Specialty',
        problemStatement: data.problemStatement || '',
        desiredOutcome: data.desiredOutcome || ''
      });
    }
  }

  // List manipulators
  addStakeholder() {
    this.stakeholders.update(s => [...s, { name: '', role: '', department: '', involvement: 'Medium', interest: '' }]);
  }
  removeStakeholder(index: number) {
    this.stakeholders.update(s => s.filter((_, i) => i !== index));
  }

  addRisk() {
    this.risksList.update(r => [...r, { description: '', mitigation: '', likelihood: 'Medium', impact: 'Medium', owner: '' }]);
  }
  removeRisk(index: number) {
    this.risksList.update(r => r.filter((_, i) => i !== index));
  }

  addMilestone() {
    this.milestones.update(m => [...m, { name: '', date: '', deliverables: '' }]);
  }
  removeMilestone(index: number) {
    this.milestones.update(m => m.filter((_, i) => i !== index));
  }

  addSolution() {
    this.solutionsConsidered.update(s => [...s, { name: '', description: '', reasonNotChosen: '', pros: '', cons: '' }]);
  }
  removeSolution(index: number) {
    this.solutionsConsidered.update(s => s.filter((_, i) => i !== index));
  }

  goToSection(id: string) {
    const index = this.sections.findIndex(s => s.id === id);
    if (index !== -1) {
      this.currentSectionIndex.set(index);
    }
  }

  prevSection() {
    if (this.currentSectionIndex() > 0) {
      this.currentSectionIndex.update(i => i - 1);
    }
  }

  nextSection() {
    if (this.currentSectionIndex() < this.sections.length - 1) {
      this.currentSectionIndex.update(i => i + 1);
    } else {
      // Submit EAC form / Dossier details
      const payload = {
        ...this.eacForm.value,
        stakeholders: this.stakeholders(),
        risksList: this.risksList(),
        milestones: this.milestones(),
        solutionsConsidered: this.solutionsConsidered()
      };

      this.projectService.submitDecision(this.projectId(), 'Prepare for EAC', 'Complete', 'EAC Dossier submitted.', payload).subscribe({
        next: () => {
          if (this.fromAdminOverride()) {
            this.eacRequestService.refreshRequests();
            this.submittedSuccess.set(true);
          } else {
            alert('EAC Review Completed. Next it is Moving to PIC Review');
            this.eacRequestService.refreshRequests();
            this.router.navigate(['/team-inbox']);
          }
        },
        error: (err) => console.error('Failed to submit Prepare for EAC', err)
      });
    }
  }

  adminOverridePic(): void {
    const formData = this.eacForm.value;
    // Mock the PIC creation via PIC service so the inbox updates cleanly
    this.picRequestService.addRequest({
      id: 'TSK-' + Math.floor(1000 + Math.random() * 9000),
      projectId: this.projectId(),
      projectNumber: '',
      projectName: formData.projectName || 'Data Automation Initiative',
      projectData: {
        name: formData.projectName,
        dept: formData.requestingDepartment,
        problemStatement: formData.problemStatement,
        scope: formData.desiredOutcome
      },
      type: 'Prepare for PIC',
      priority: 'High',
      submittedBy: formData.requestorName || 'Gurrammaneesh User',
      submittedDate: 'Today, ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'pending'
    });

    this.router.navigate(['/prepare-pic'], {
      state: {
        projectData: {
          name: formData.projectName,
          dept: formData.requestingDepartment,
          problemStatement: formData.problemStatement,
          scope: formData.desiredOutcome
        },
        projectId: this.projectId(),
        fromAdminOverride: true
      }
    });
  }

  autofillAI() {
    // Mock GenAI filling features
    this.eacForm.patchValue({
      strategicAlignment: 'AI generated: Automatically coordinates with Strategic Pillar 4 (Operational Excellence) by removing document friction.',
      eaPrinciplesAlignment: 'AI generated: Adheres to the principle of "Data as an Asset" by securing intake schemas early.',
      currentStateArchitecture: 'AI generated: Scattered local upload tools. Network-reliant, insecure endpoints.',
      techStack: 'AI generated: Angular 19, FastAPI, PostgreSQL, AWS S3, TailwindCSS.',
      budgetBreakdown: 'AI generated: Dev: $50,000, Testing: $15,000, Ops: $20,000',
      humanResources: 'AI generated: 1 Lead Architect, 2 Software Engineers, 1 QA Dev'
    });
  }

  saveLater() {
    this.router.navigate(['/dashboard']);
  }

  cancel() {
    this.router.navigate(['/dashboard']);
  }
}
