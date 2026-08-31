import { Component, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';
import { BtaRequestService } from '../../core/services/bta-request.service';
import { EacRequestService } from '../../core/services/eac-request.service';
import { PicRequestService } from '../../core/services/pic-request.service';
import { ProjectService } from '../../core/services/project.service';

@Component({
  selector: 'app-intake',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="animate-fade-in intake-container">
      <!-- Outer Card Window resembling exact screenshot -->
      <div class="intake-window-card">
        
        <!-- Header Bar -->
        <div class="window-header flex justify-between items-center">
          <div class="window-title-group">
            <h1 class="window-title">New Proposal Intake</h1>
          </div>
          <div class="window-actions flex items-center gap-3">
            <span class="step-header-label">Collect Information</span>
            <div class="window-controls flex gap-2">
              <button type="button" class="win-btn" title="Minimize">—</button>
              <button type="button" class="win-btn" title="Close" (click)="goBack()">✕</button>
            </div>
          </div>
        </div>

        <!-- Horizontal Step Progress Bar -->
        <div class="progress-bar-wrapper">
          <div class="progress-bar-track">
            <div class="progress-bar-fill" [style.width.%]="progressPercentage()"></div>
            <div class="progress-bar-node" [style.left.%]="progressPercentage()"></div>
          </div>
        </div>

        <div class="intake-content-body">
          @if (!submittedSuccess()) {
            <div class="intake-layout">
              <!-- Main Form Panel -->
              <div class="intake-form-panel">
              
              <!-- Step Indicator Pills -->
              <div class="steps-pills mb-4 flex gap-2">
                @for (step of steps; track step.num) {
                  <button type="button" 
                          class="step-pill" 
                          [class.active]="currentStep() === step.num"
                          [class.done]="currentStep() > step.num"
                          (click)="goToStep(step.num)">
                    <span class="pill-num">{{ step.num }}</span>
                    <span class="pill-label">{{ step.label }}</span>
                  </button>
                }
              </div>

              <!-- Step 1: Collect Information (Exact layout from user screenshot) -->
              @if (currentStep() === 1) {
                <div class="form-card animate-fade-in">
                  <h2 class="form-section-main-title">Project Intake Form</h2>

                  <!-- Attachments / Document Upload Zone -->
                  <div class="upload-zone mb-4" (click)="fileInput.click()">
                    <span class="material-icons upload-icon">cloud_upload</span>
                    <div class="upload-info">
                      <div class="font-semibold text-sm text-primary">Upload Project Document / Attachments (Optional)</div>
                      <div class="text-xs text-muted">AI will automatically extract & pre-fill form details · PDF, DOCX, PPTX</div>
                      @if (isExtracting()) {
                        <div class="mt-2 text-xs font-semibold text-blue-500 flex items-center gap-1">
                          <span class="material-icons text-sm animate-spin">sync</span> AI is extracting data...
                        </div>
                      }
                      @if (uploadedFileName() && !isExtracting()) {
                        <div class="mt-2 text-xs font-semibold text-success flex items-center gap-1">
                          <span class="material-icons text-sm">attach_file</span> Attached: {{ uploadedFileName() }}
                        </div>
                      }
                    </div>
                    <button type="button" class="btn btn-secondary btn-sm" (click)="$event.stopPropagation(); fileInput.click()">
                      <span class="material-icons text-sm">folder_open</span> Browse Files
                    </button>
                    <input #fileInput type="file" accept=".pdf,.docx,.pptx,.xlsx" style="display:none" (change)="onFileSelected($event)" />
                  </div>

                  <form [formGroup]="step1Form" class="intake-form-grid">
                    <!-- Row 1: Requestor Name & Requesting Department -->
                    <div class="form-row grid-2">
                      <div class="form-group">
                        <label class="field-label">Requestor Name <span class="required">*</span></label>
                        <input 
                          type="text" 
                          class="form-control readonly-input" 
                          formControlName="requestorName" 
                          placeholder="e.g. Gurrammaneesh User" />
                        @if (isInvalid('step1', 'requestorName')) {
                          <span class="field-error"><span class="error-icon">⚠</span> Cannot be blank</span>
                        }
                      </div>

                      <div class="form-group">
                        <label class="field-label">Requesting Department <span class="required">*</span></label>
                        <select 
                          class="form-control" 
                          formControlName="requestingDepartment"
                          [class.field-error-border]="isInvalid('step1', 'requestingDepartment')">
                          <option value="">Select...</option>
                          <option value="Clinical IT">Clinical IT</option>
                          <option value="Infrastructure">Infrastructure</option>
                          <option value="Data & Analytics">Data & Analytics</option>
                          <option value="Innovation">Innovation</option>
                          <option value="HR Technology">HR Technology</option>
                          <option value="IT Operations">IT Operations</option>
                          <option value="Finance Technology">Finance Technology</option>
                          <option value="Compliance">Compliance</option>
                          <option value="InfoSec">InfoSec</option>
                          <option value="Cardiology">Cardiology</option>
                          <option value="Radiology">Radiology</option>
                          <option value="Pharmacy">Pharmacy</option>
                        </select>
                        @if (isInvalid('step1', 'requestingDepartment')) {
                          <span class="field-error"><span class="error-icon">⚠</span> Cannot be blank</span>
                        }
                      </div>
                    </div>

                    <!-- Row 2: Request Type -->
                    <div class="form-row grid-2">
                      <div class="form-group">
                        <label class="field-label">Request Type <span class="required">*</span></label>
                        <select class="form-control" formControlName="requestType">
                          <option value="Pre-Project Discovery">Pre-Project Discovery</option>
                          <option value="New System Implementation">New System Implementation</option>
                          <option value="System Enhancement / Upgrade">System Enhancement / Upgrade</option>
                          <option value="Infrastructure Hardware">Infrastructure Hardware</option>
                          <option value="Process Optimization">Process Optimization</option>
                        </select>
                      </div>
                    </div>

                    <!-- Section Header: Project Details -->
                    <div class="form-section-divider">
                      <h3 class="section-sub-title">Project Details</h3>
                    </div>

                    <!-- Project Name -->
                    <div class="form-group full-width">
                      <label class="field-label">Project Name <span class="required">*</span></label>
                      <input 
                        type="text" 
                        class="form-control" 
                        formControlName="projectName"
                        [class.field-error-border]="isInvalid('step1', 'projectName')"
                        placeholder="Enter project name..." />
                      @if (isInvalid('step1', 'projectName')) {
                        <span class="field-error"><span class="error-icon">⚠</span> Cannot be blank</span>
                      }
                    </div>

                    <!-- Problem or Opportunity Statement -->
                    <div class="form-group full-width">
                      <label class="field-label">Problem or Opportunity Statement <span class="required">*</span></label>
                      <textarea 
                        class="form-control textarea-input" 
                        rows="3" 
                        formControlName="problemStatement"
                        [class.field-error-border]="isInvalid('step1', 'problemStatement')"
                        placeholder="Describe the current problem, pain points, or business opportunity..."></textarea>
                      @if (isInvalid('step1', 'problemStatement')) {
                        <span class="field-error"><span class="error-icon">⚠</span> Cannot be blank</span>
                      }
                    </div>

                    <!-- Desired Outcome -->
                    <div class="form-group full-width">
                      <label class="field-label">Desired Outcome <span class="required">*</span></label>
                      <textarea 
                        class="form-control textarea-input" 
                        rows="3" 
                        formControlName="desiredOutcome"
                        [class.field-error-border]="isInvalid('step1', 'desiredOutcome')"
                        placeholder="Describe the target outcomes and success criteria..."></textarea>
                      @if (isInvalid('step1', 'desiredOutcome')) {
                        <span class="field-error"><span class="error-icon">⚠</span> Cannot be blank</span>
                      }
                    </div>

                    <!-- What Do You Do Today ? -->
                    <div class="form-group full-width">
                      <label class="field-label">What Do You Do Today ?</label>
                      <textarea 
                        class="form-control textarea-input" 
                        rows="3" 
                        formControlName="whatDoYouDoToday"
                        maxlength="1024"
                        placeholder="Explain the existing process or workaround currently in place..."></textarea>
                      <div class="char-counter">
                        {{ step1Form.value.whatDoYouDoToday?.length || 0 }} of 1024
                      </div>
                    </div>

                    <!-- What Transpires If We Do Nothing ? -->
                    <div class="form-group full-width">
                      <label class="field-label">What Transpires If We Do Nothing ?</label>
                      <textarea 
                        class="form-control textarea-input" 
                        rows="3" 
                        formControlName="whatTranspiresIfWeDoNothing"
                        maxlength="1024"
                        placeholder="Describe the operational, strategic, or financial impact of inaction..."></textarea>
                      <div class="char-counter">
                        {{ step1Form.value.whatTranspiresIfWeDoNothing?.length || 0 }} of 1024
                      </div>
                    </div>

                    <!-- Notes / Comments -->
                    <div class="form-group full-width">
                      <label class="field-label">Notes / Comments</label>
                      <textarea 
                        class="form-control textarea-input" 
                        rows="3" 
                        formControlName="notesComments"
                        placeholder=""></textarea>
                      <div class="field-caption">
                        Please provide any other relevant information that could be helpful in reviewing your submission.
                      </div>
                    </div>

                    <!-- Send me a copy of my responses -->
                    <div class="form-group full-width send-copy-wrapper mt-2">
                      <label class="checkbox-flex-label flex items-center gap-2 cursor-pointer">
                        <input 
                          type="checkbox" 
                          class="checkbox-blue-custom" 
                          formControlName="sendCopyOfResponses" 
                          (change)="toggleCopyEmailValidation()" />
                        <span class="send-copy-text font-medium text-sm">Send me a copy of my responses</span>
                      </label>

                      @if (step1Form.value.sendCopyOfResponses) {
                        <div class="email-input-sub-container animate-fade-in mt-3">
                          <label class="field-label">Email Address <span class="required">*</span></label>
                          <input 
                            type="email" 
                            class="form-control" 
                            formControlName="emailAddress"
                            [class.field-error-border]="isInvalid('step1', 'emailAddress')"
                            placeholder="john.smith@company.com" />
                          @if (isInvalid('step1', 'emailAddress')) {
                            <span class="field-error"><span class="error-icon">⚠</span> Valid email address is required</span>
                          }
                        </div>
                      }
                    </div>
                  </form>
                </div>
              }

              <!-- Step 2: Budget & Strategy -->
              @if (currentStep() === 2) {
                <div class="form-card animate-fade-in">
                  <h2 class="form-section-main-title">Budget & Strategic Alignment</h2>
                  <form [formGroup]="step2Form" class="intake-form-grid">
                    <div class="form-row grid-2">
                      <div class="form-group">
                        <label class="field-label">Budget Type <span class="required">*</span></label>
                        <select class="form-control" formControlName="budgetType" [class.field-error-border]="isInvalid('step2', 'budgetType')">
                          <option value="tbd">TBD</option>
                          <option value="Operational">Operational</option>
                          <option value="Capital">Capital</option>
                          <option value="Grant">Grant</option>
                        </select>
                        @if (isInvalid('step2', 'budgetType')) {
                          <span class="field-error"><span class="error-icon">⚠</span> Required field</span>
                        }
                      </div>

                      <div class="form-group">
                        <label class="field-label">Estimated Total Project Budget</label>
                        <input type="text" class="form-control" formControlName="budgetEstimated" placeholder="e.g. $85,000" />
                      </div>
                    </div>

                    <div class="form-row grid-2">
                      <div class="form-group">
                        <label class="field-label">Project Priority <span class="required">*</span></label>
                        <select class="form-control" formControlName="priority">
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                          <option value="critical">Critical</option>
                        </select>
                      </div>

                      <div class="form-group">
                        <label class="field-label">Initial Risk Level Assessment</label>
                        <select class="form-control" formControlName="riskLevel">
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                        </select>
                      </div>
                    </div>

                    <div class="form-group full-width">
                      <label class="field-label">Strategic Alignment & Rationale</label>
                      <textarea class="form-control textarea-input" rows="4" formControlName="strategicAlignment" placeholder="Describe how this project aligns with key business objectives and enterprise standards..."></textarea>
                    </div>
                  </form>
                </div>
              }

              <!-- Step 3: IT & Governance Requirements -->
              @if (currentStep() === 3) {
                <div class="form-card animate-fade-in">
                  <h2 class="form-section-main-title">IT & Governance Requirements</h2>
                  <form [formGroup]="step3Form" class="intake-form-grid">
                    <div class="form-group full-width" style="gap: 16px; margin-top: 10px;">
                      
                      <!-- IT Involvement Toggle -->
                      <div class="toggle-card">
                        <div>
                          <div class="font-semibold text-sm text-dark">Dedicated IT Resources Required</div>
                          <div class="text-xs text-muted">Will this initiative require active support from corporate/clinical IT teams?</div>
                        </div>
                        <input type="checkbox" class="toggle-checkbox" formControlName="itInvolvement" />
                      </div>

                      <!-- Vendor Required Toggle -->
                      <div class="toggle-card">
                        <div>
                          <div class="font-semibold text-sm text-dark">External Vendor Solution / Products</div>
                          <div class="text-xs text-muted">Does this involve procuring hardware, software licenses, or consulting from third parties?</div>
                        </div>
                        <input type="checkbox" class="toggle-checkbox" formControlName="vendorRequired" />
                      </div>

                      <!-- PHI Data Toggle -->
                      <div class="toggle-card">
                        <div>
                          <div class="font-semibold text-sm text-dark">Contains Protected Health Information (PHI/PII)</div>
                          <div class="text-xs text-muted">Will patient information, SSNs, financial details, or HIPAA-regulated data be touched?</div>
                        </div>
                        <input type="checkbox" class="toggle-checkbox" formControlName="hasPhiData" />
                      </div>

                    </div>
                  </form>
                </div>
              }

              <!-- Step 4: Final Review -->
              @if (currentStep() === 4) {
                <div class="form-card animate-fade-in">
                  <h2 class="form-section-main-title">Review & Submit Proposal</h2>
                  <p class="text-xs text-muted mb-4">Please verify all information for your project intake request before final submission.</p>

                  <div class="intake-form-grid" style="gap: 20px;">
                    
                    <!-- Section: General Details -->
                    <div class="review-summary-box">
                      <h3 class="text-xs font-bold uppercase tracking-wider text-primary mb-3">Project General Details</h3>
                      <div class="review-grid">
                        <div class="review-item">
                          <div class="review-lbl">Project Name</div>
                          <div class="review-val">{{ step1Form.value.projectName || '—' }}</div>
                        </div>
                        <div class="review-item">
                          <div class="review-lbl">Request Type</div>
                          <div class="review-val">{{ step1Form.value.requestType || '—' }}</div>
                        </div>
                        <div class="review-item">
                          <div class="review-lbl">Requestor Name</div>
                          <div class="review-val">{{ step1Form.value.requestorName || '—' }}</div>
                        </div>
                        <div class="review-item">
                          <div class="review-lbl">Department</div>
                          <div class="review-val">{{ step1Form.value.requestingDepartment || '—' }}</div>
                        </div>
                      </div>
                    </div>

                    <!-- Section: Problem & Outcomes -->
                    <div class="review-summary-box">
                      <h3 class="text-xs font-bold uppercase tracking-wider text-primary mb-3">Objectives & Scope</h3>
                      <div class="flex flex-col gap-3">
                        <div class="review-item full-width">
                          <div class="review-lbl">Problem Statement</div>
                          <div class="review-val" style="white-space: pre-wrap;">{{ step1Form.value.problemStatement || '—' }}</div>
                        </div>
                        <div class="review-item full-width">
                          <div class="review-lbl">Desired Outcome</div>
                          <div class="review-val" style="white-space: pre-wrap;">{{ step1Form.value.desiredOutcome || '—' }}</div>
                        </div>
                      </div>
                    </div>

                    <!-- Section: Budget & Governance -->
                    <div class="review-summary-box">
                      <h3 class="text-xs font-bold uppercase tracking-wider text-primary mb-3">Budget & Governance Vetting</h3>
                      <div class="review-grid">
                        <div class="review-item">
                          <div class="review-lbl">Budget Type</div>
                          <div class="review-val">{{ step2Form.value.budgetType | uppercase }}</div>
                        </div>
                        <div class="review-item">
                          <div class="review-lbl">Estimated Budget</div>
                          <div class="review-val">{{ step2Form.value.budgetEstimated || '—' }}</div>
                        </div>
                        <div class="review-item">
                          <div class="review-lbl">Priority / Risk</div>
                          <div class="review-val" style="text-transform: capitalize;">{{ step2Form.value.priority }} / {{ step2Form.value.riskLevel }}</div>
                        </div>
                        <div class="review-item">
                          <div class="review-lbl">Governance Flags</div>
                          <div class="review-val">
                            <span class="badge" [class.badge-involvement]="step3Form.value.itInvolvement" style="margin-right: 4px; padding: 2px 6px; border-radius: 4px; font-size: 11px;">IT: {{ step3Form.value.itInvolvement ? 'Yes' : 'No' }}</span>
                            <span class="badge" [class.badge-warning]="step3Form.value.vendorRequired" style="margin-right: 4px; padding: 2px 6px; border-radius: 4px; font-size: 11px;">Vendor: {{ step3Form.value.vendorRequired ? 'Yes' : 'No' }}</span>
                            <span class="badge" [class.badge-danger]="step3Form.value.hasPhiData" style="padding: 2px 6px; border-radius: 4px; font-size: 11px;">PHI: {{ step3Form.value.hasPhiData ? 'Yes' : 'No' }}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
              }

              <!-- Navigation Footer -->
              <div class="form-nav-footer flex justify-between items-center mt-6">
                <button 
                  type="button"
                  class="btn btn-outline" 
                  (click)="prevStep()" 
                  [disabled]="currentStep() === 1">
                  Previous
                </button>
                
                <div class="flex items-center gap-3">
                  <button 
                    type="button"
                    class="btn btn-success" 
                    (click)="submitIntake()" 
                    [disabled]="submitting()">
                    @if (submitting()) {
                      Submitting...
                    } @else {
                      🚀 Submit Proposal
                    }
                  </button>
                  
                  @if (currentStep() < 4) {
                    <button 
                      type="button"
                      class="btn btn-primary" 
                      (click)="nextStep()">
                      Next
                    </button>
                  }
                </div>
              </div>

            </div>

            <!-- Right Sidebar: What Happens Next & Info -->
            <div class="intake-sidebar">
              <div class="info-card">
                <div class="info-card-header flex items-center gap-2">
                  <span class="material-icons info-icon">route</span>
                  <h3>What Happens Next?</h3>
                </div>
                <div class="info-card-body">
                  <div class="timeline-step">
                    <div class="timeline-badge">1</div>
                    <div>
                      <div class="text-sm font-semibold">BTA Discovery Review</div>
                      <div class="text-xs text-muted">Business Tech Advocate schedules discovery and reviews the intake</div>
                    </div>
                  </div>
                  <div class="timeline-step">
                    <div class="timeline-badge">2</div>
                    <div>
                      <div class="text-sm font-semibold">Prepare for EAC</div>
                      <div class="text-xs text-muted">Formulate 9-domain architecture alignment dossier</div>
                    </div>
                  </div>
                  <div class="timeline-step">
                    <div class="timeline-badge">3</div>
                    <div>
                      <div class="text-sm font-semibold">EAC Committee Meeting</div>
                      <div class="text-xs text-muted">Enterprise Architecture Council formal alignment vote</div>
                    </div>
                  </div>
                  <div class="timeline-step">
                    <div class="timeline-badge">4</div>
                    <div>
                      <div class="text-sm font-semibold">Gate Reviews</div>
                      <div class="text-xs text-muted">Committee evaluation for funding and architecture compliance</div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Gate Triggers Info -->
              <div class="info-card mt-4">
                <div class="info-card-header">
                  <h3>Governance Gates</h3>
                </div>
                <div class="info-card-body flex flex-col gap-2">
                  <div class="gate-chip-row flex items-center gap-2">
                    <span class="gate-tag">Gate B</span>
                    <span class="text-xs font-medium">Intake Submission</span>
                  </div>
                  <div class="gate-chip-row flex items-center gap-2">
                    <span class="gate-tag">Gate A</span>
                    <span class="text-xs font-medium">Vendor Risk Entry</span>
                  </div>
                  <div class="gate-chip-row flex items-center gap-2">
                    <span class="gate-tag">Gate K</span>
                    <span class="text-xs font-medium">Security Assurance</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          } @else {
            <div class="success-screen animate-fade-in flex flex-col items-center justify-center py-16 text-center">
              <div class="success-icon-wrapper mb-6">
                <span class="material-icons success-icon-large">check_circle</span>
              </div>
              <h2 class="text-2xl font-bold text-primary-dark mb-2">Proposal Submitted Successfully!</h2>
              <p class="text-muted max-w-md mb-8">
                Your project proposal <strong>{{ step1Form.value.projectName }}</strong> has been officially registered as <strong style="color: #0052CC; background: #E3F0FF; padding: 2px 6px; border-radius: 4px;">{{ createdProjectNumber() }}</strong> and routed to the Business Tech Advocate (BTA) team for initial discovery.
              </p>
              
              <div class="flex gap-4 flex-wrap justify-center mt-4">
                <button type="button" class="btn btn-outline" (click)="goBack()">Return to Projects</button>
                
                @if (isAdmin()) {
                  <button type="button" class="btn btn-warning flex items-center gap-2" (click)="adminOverride()">
                    <span class="material-icons text-sm">admin_panel_settings</span> Admin Override: BTA Review
                  </button>
                  <button type="button" class="btn flex items-center gap-2" (click)="adminOverrideEac()" style="background: #6B46C1; color: #FFFFFF; border: none; font-weight: 600;">
                    <span class="material-icons text-sm">auto_awesome</span> Admin Override: EAC Prepare
                  </button>
                  <button type="button" class="btn flex items-center gap-2" (click)="adminOverridePic()" style="background: #00875A; color: #FFFFFF; border: none; font-weight: 600;">
                    <span class="material-icons text-sm">rocket_launch</span> Admin Override: PIC Prepare
                  </button>
                }
              </div>
            </div>
          }
        </div>

      </div>
    </div>
  `,
  styles: [`
    .intake-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 12px;
    }

    .intake-window-card {
      background: #FFFFFF;
      border: 1px solid #DCDFE6;
      border-radius: 12px;
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.08);
    }

    .window-header {
      padding: 16px 24px;
      background: #FFFFFF;
      border-bottom: 1px solid #F0F2F5;
    }

    .window-title {
      font-size: 20px;
      font-weight: 700;
      color: #172B4D;
      margin: 0;
      font-family: 'Inter', -apple-system, sans-serif;
    }

    .step-header-label {
      font-size: 13px;
      font-weight: 600;
      color: #0052CC;
    }

    .win-btn {
      width: 24px;
      height: 24px;
      border-radius: 4px;
      border: none;
      background: #F4F5F7;
      color: #6B778C;
      font-size: 12px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 150ms;
      &:hover { background: #EBECF0; color: #172B4D; }
    }

    /* Progress bar */
    .progress-bar-wrapper {
      background: #F4F5F7;
      padding: 0;
      position: relative;
    }

    .progress-bar-track {
      height: 6px;
      width: 100%;
      background: #DFE1E6;
      position: relative;
    }

    .progress-bar-fill {
      height: 100%;
      background: #0052CC;
      transition: width 300ms ease-in-out;
    }

    .progress-bar-node {
      position: absolute;
      top: -4px;
      width: 14px;
      height: 14px;
      background: #0052CC;
      border: 2px solid #FFFFFF;
      border-radius: 50%;
      transform: translateX(-50%);
      box-shadow: 0 2px 4px rgba(0,82,204,0.3);
      transition: left 300ms ease-in-out;
    }

    .intake-content-body {
      padding: 24px;
    }

    .intake-layout {
      display: grid;
      grid-template-columns: 1fr 320px;
      gap: 24px;
    }

    .steps-pills {
      border-bottom: 1px solid #EBECF0;
      padding-bottom: 12px;
    }

    .step-pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 14px;
      border-radius: 20px;
      border: 1px solid #DFE1E6;
      background: #FFFFFF;
      color: #6B778C;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 200ms;

      .pill-num {
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: #F4F5F7;
        color: #6B778C;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
      }

      &.active {
        border-color: #0052CC;
        background: #DEEBFF;
        color: #0052CC;
        .pill-num { background: #0052CC; color: #FFF; }
      }

      &.done {
        border-color: #36B37E;
        color: #006644;
        .pill-num { background: #36B37E; color: #FFF; }
      }
    }

    .form-card {
      background: #FFFFFF;
    }

    .form-section-main-title {
      font-size: 17px;
      font-weight: 700;
      color: #172B4D;
      margin-top: 4px;
      margin-bottom: 20px;
    }

    .upload-zone {
      border: 2px dashed #C1C7D0;
      border-radius: 10px;
      padding: 16px 20px;
      display: flex;
      align-items: center;
      gap: 16px;
      cursor: pointer;
      background: #F7F8FC;
      transition: all 200ms;

      &:hover {
        border-color: #0052CC;
        background: #E3F0FF;
      }
    }

    .upload-icon {
      font-size: 32px !important;
      color: #0052CC;
    }

    .upload-info {
      flex: 1;
    }

    .send-copy-wrapper {
      margin-top: 16px;
      padding-top: 12px;
      border-top: 1px dashed #E2E8F0;
    }

    .checkbox-flex-label {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      cursor: pointer;
      user-select: none;
    }

    .checkbox-blue-custom {
      width: 18px;
      height: 18px;
      accent-color: #0052CC;
      border-radius: 4px;
      cursor: pointer;
    }

    .send-copy-text {
      color: #172B4D;
      font-size: 14px;
      font-weight: 500;
    }

    .email-input-sub-container {
      max-width: 480px;
      padding-left: 2px;
    }

    .section-sub-title {
      font-size: 15px;
      font-weight: 700;
      color: #172B4D;
      margin: 16px 0 8px 0;
    }

    .form-section-divider {
      border-top: 1px solid #F0F2F5;
      margin-top: 12px;
      padding-top: 8px;
    }

    .intake-form-grid {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .form-row.grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .field-label {
      font-size: 13px;
      font-weight: 600;
      color: #344563;
      .required { color: #DE350B; font-weight: 700; margin-left: 2px; }
    }

    .form-control {
      width: 100%;
      padding: 9px 12px;
      font-size: 14px;
      border: 1.5px solid #DFE1E6;
      border-radius: 6px;
      background-color: #FFFFFF;
      color: #172B4D;
      outline: none;
      transition: border-color 200ms, box-shadow 200ms;

      &:focus {
        border-color: #4C9AFF;
        box-shadow: 0 0 0 3px rgba(76, 154, 255, 0.2);
      }
    }

    .readonly-input {
      background-color: #F4F5F7;
      color: #172B4D;
      cursor: not-allowed;
    }

    .textarea-input {
      resize: vertical;
      min-height: 85px;
      font-family: inherit;
    }

    .field-error-border {
      border-color: #DE350B !important;
      background-color: #FFFAE6;
    }

    .field-error {
      color: #DE350B;
      font-size: 12px;
      font-weight: 600;
      margin-top: 4px;
      display: flex;
      align-items: center;
      gap: 4px;
      .error-icon { font-size: 13px; font-weight: bold; }
    }

    .char-counter {
      font-size: 12px;
      color: #6B778C;
      text-align: right;
      margin-top: 4px;
    }

    .field-caption {
      font-size: 12px;
      color: #6B778C;
      margin-top: 4px;
    }

    .toggle-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 16px;
      background: #F4F5F7;
      border: 1px solid #DFE1E6;
      border-radius: 8px;
    }

    .toggle-checkbox {
      width: 18px;
      height: 18px;
      accent-color: #0052CC;
      cursor: pointer;
    }

    .form-nav-footer {
      padding-top: 16px;
      border-top: 1px solid #EBECF0;
    }

    /* Sidebar info */
    .info-card {
      background: #FAFBFC;
      border: 1px solid #DFE1E6;
      border-radius: 8px;
      padding: 16px;
    }

    .info-card-header {
      h3 { font-size: 14px; font-weight: 700; color: #172B4D; margin: 0; }
      .info-icon { font-size: 18px; color: #0052CC; }
    }

    .info-card-body {
      margin-top: 12px;
    }

    .timeline-step {
      display: flex;
      gap: 10px;
      margin-bottom: 12px;
      &:last-child { margin-bottom: 0; }
    }

    .timeline-badge {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: #DEEBFF;
      color: #0052CC;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 700;
      flex-shrink: 0;
    }

    .gate-tag {
      padding: 2px 8px;
      background: #0052CC;
      color: #FFF;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 700;
    }

    .review-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
    }

    .review-item {
      background: #F4F5F7;
      padding: 10px 12px;
      border-radius: 6px;
    }

    .review-lbl { font-size: 11px; font-weight: 700; color: #6B778C; text-transform: uppercase; }
    .review-val { font-size: 14px; font-weight: 600; color: #172B4D; margin-top: 2px; }

    .review-summary-box {
      background: #F4F5F7;
      padding: 14px;
      border-radius: 6px;
    }

    @media (max-width: 900px) {
      .intake-layout { grid-template-columns: 1fr; }
      .form-row.grid-2 { grid-template-columns: 1fr; }
    }

    /* Success Screen Styles */
    .success-screen {
      animation: fadeInScale 0.4s ease-out forwards;
    }

    @keyframes fadeInScale {
      from { opacity: 0; transform: scale(0.95); }
      to { opacity: 1; transform: scale(1); }
    }

    .success-icon-wrapper {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: #E3FCEF;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .success-icon-large {
      font-size: 48px;
      color: #36B37E;
    }

    .btn-warning {
      background: #FFAB00;
      color: #172B4D;
      border: none;
      font-weight: 600;
      &:hover { background: #FF991F; }
    }
  `]
})
export class IntakeComponent {
  currentStep = signal(1);
  submitting = signal(false);
  submittedSuccess = signal<string | boolean>(false);
  uploadedFileName = signal<string | null>(null);
  isExtracting = signal(false);
  createdProjectId = signal('');
  createdProjectNumber = signal('');

  private fb = inject(FormBuilder);
  private router = inject(Router);
  private authService = inject(AuthService);
  private btaRequestService = inject(BtaRequestService);
  private eacRequestService = inject(EacRequestService);
  private picRequestService = inject(PicRequestService);
  private http = inject(HttpClient);
  private projectService = inject(ProjectService);

  isAdmin = computed(() => this.authService.hasRole('admin'));

  steps = [
    { num: 1, label: 'Collect Information' },
    { num: 2, label: 'Budget & Strategy' },
    { num: 3, label: 'IT & Governance' },
    { num: 4, label: 'Review & Submit' },
  ];

  step1Form: FormGroup;
  step2Form: FormGroup;
  step3Form: FormGroup;

  constructor() {
    this.step1Form = this.fb.group({
      requestorName: ['Gurrammaneesh User', Validators.required],
      requestingDepartment: ['', Validators.required],
      requestType: ['Pre-Project Discovery', Validators.required],
      projectName: ['', Validators.required],
      problemStatement: ['', Validators.required],
      desiredOutcome: ['', Validators.required],
      whatDoYouDoToday: ['', [Validators.maxLength(1024)]],
      whatTranspiresIfWeDoNothing: ['', [Validators.maxLength(1024)]],
      notesComments: [''],
      sendCopyOfResponses: [false],
      emailAddress: ['john.smith@company.com'],
    });

    this.step2Form = this.fb.group({
      budgetType: ['tbd', Validators.required],
      budgetEstimated: [null],
      priority: ['medium', Validators.required],
      riskLevel: ['medium'],
      strategicAlignment: [''],
    });

    this.step3Form = this.fb.group({
      itInvolvement: [false],
      vendorRequired: [false],
      hasPhiData: [false],
    });
  }

  progressPercentage(): number {
    return (this.currentStep() / 4) * 100;
  }

  isInvalid(formName: 'step1' | 'step2' | 'step3', field: string): boolean {
    const form = formName === 'step1' ? this.step1Form : formName === 'step2' ? this.step2Form : this.step3Form;
    const ctrl = form.get(field);
    return !!(ctrl && ctrl.invalid && (ctrl.touched || ctrl.dirty));
  }

  goToStep(stepNum: number): void {
    if (stepNum < 1 || stepNum > 4) return;
    if (stepNum > this.currentStep()) {
      if (this.currentStep() === 1 && this.step1Form.invalid) {
        this.step1Form.markAllAsTouched();
        return;
      }
      if (this.currentStep() === 2 && this.step2Form.invalid) {
        this.step2Form.markAllAsTouched();
        return;
      }
      if (this.currentStep() === 3 && this.step3Form.invalid) {
        this.step3Form.markAllAsTouched();
        return;
      }
    }
    this.currentStep.set(stepNum);
  }

  nextStep(): void {
    this.goToStep(this.currentStep() + 1);
  }

  prevStep(): void {
    this.goToStep(this.currentStep() - 1);
  }

  goBack(): void {
    this.router.navigate(['/projects']);
  }

  onFileSelected(event: any): void {
    const file = event.target?.files?.[0];
    if (file) {
      this.uploadedFileName.set(file.name);
      this.isExtracting.set(true);

      const formData = new FormData();
      formData.append('file', file);

      this.http.post<any>('http://localhost:8000/api/v1/projects/extract-intake', formData, {
        headers: {
          'Authorization': `Bearer ${this.authService.getToken()}`
        }
      }).subscribe({
        next: (res) => {
          this.isExtracting.set(false);
          if (res.success && res.data) {
            this.step1Form.patchValue({
              projectName: res.data.projectName || this.step1Form.value.projectName,
              problemStatement: res.data.problemStatement || this.step1Form.value.problemStatement,
              desiredOutcome: res.data.desiredOutcome || this.step1Form.value.desiredOutcome,
              whatDoYouDoToday: res.data.whatDoYouDoToday || this.step1Form.value.whatDoYouDoToday,
              whatTranspiresIfWeDoNothing: res.data.whatTranspiresIfWeDoNothing || this.step1Form.value.whatTranspiresIfWeDoNothing,
              notesComments: res.data.notesComments || this.step1Form.value.notesComments
            });
          }
        },
        error: (err) => {
          console.error('Failed to extract data:', err);
          this.isExtracting.set(false);
        }
      });
    }
  }

  toggleCopyEmailValidation(): void {
    const emailCtrl = this.step1Form.get('emailAddress');
    if (this.step1Form.get('sendCopyOfResponses')?.value) {
      emailCtrl?.setValidators([Validators.required, Validators.email]);
    } else {
      emailCtrl?.clearValidators();
    }
    emailCtrl?.updateValueAndValidity();
  }

  submitIntake(): void {
    if (this.step1Form.invalid) {
      this.step1Form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    
    const formData1 = this.step1Form.value;
    const formData2 = this.step2Form.value;
    const formData3 = this.step3Form.value;

    const payload = {
      project_name: formData1.projectName,
      business_unit: formData1.requestingDepartment,
      department: formData1.requestingDepartment,
      requestor_name: formData1.requestorName,
      request_type: formData1.requestType,
      problem_statement: formData1.problemStatement,
      desired_outcome: formData1.desiredOutcome,
      what_do_you_do_today: formData1.whatDoYouDoToday || '',
      what_transpires_if_nothing: formData1.whatTranspiresIfWeDoNothing || '',
      notes: formData1.notesComments || '',
      
      // Step 2 values (from form default values if not editable in UI)
      budget_type: formData2.budgetType,
      budget_estimated: formData2.budgetEstimated ? parseFloat(formData2.budgetEstimated) : undefined,
      priority: formData2.priority,
      risk_level: formData2.riskLevel,
      strategic_alignment: formData2.strategicAlignment || '',

      // Step 3 values (from form default values if not editable in UI)
      it_involvement: formData3.itInvolvement,
      vendor_required: formData3.vendorRequired,
      has_phi_data: formData3.hasPhiData,
    };

    this.projectService.createProject(payload).subscribe({
      next: (project) => {
        this.submitting.set(false);
        // Set the created project's tracking number / ID
        this.createdProjectId.set(project.id);
        if (project.project_number) {
          this.createdProjectNumber.set(project.project_number);
        }
        
        // Add to local BTA request service inbox so BTA list shows it
        this.btaRequestService.addRequest({
          id: 'TSK-' + Math.floor(Math.random() * 9000 + 1000),
          projectId: project.id,
          projectNumber: project.project_number,
          projectName: project.project_name,
          projectData: {
            projectName: project.project_name,
            requestorName: project.requestor_name,
            requestingDepartment: project.business_unit,
            problemStatement: project.problem_statement,
            desiredOutcome: project.desired_outcome,
            whatDoYouDoToday: project.what_do_you_do_today,
            whatTranspiresIfWeDoNothing: project.what_transpires_if_nothing
          },
          type: 'BTA Discovery Review',
          priority: 'High',
          submittedBy: project.requestor_name || 'Gurrammaneesh User',
          submittedDate: 'Just now'
        });

        // If send copy checkbox is checked, trigger the backend intake copy email
        if (formData1.sendCopyOfResponses && formData1.emailAddress) {
          this.http.post('http://localhost:8000/api/v1/projects/send-intake-email', {
            project_id: project.id,
            email: formData1.emailAddress,
            data: formData1
          }).subscribe({
            next: () => console.log('Email successfully sent'),
            error: (err) => console.error('Failed to send email:', err)
          });
        }

        this.submittedSuccess.set(true);
      },
      error: (err) => {
        console.error('Failed to submit project proposal to DB:', err);
        this.submitting.set(false);
        alert('An error occurred while saving the project to the database: ' + (err.error?.detail || err.message));
      }
    });
  }

  adminOverride(): void {
    this.router.navigate(['/bta-review'], {
      state: {
        projectData: this.step1Form.value,
        projectId: this.createdProjectId(),
        fromAdminOverride: true
      }
    });
  }

  adminOverrideEac(): void {
    const formData1 = this.step1Form.value;
    
    // Remove from BTA queue if it got added automatically
    this.btaRequestService.removeRequest(this.createdProjectId());
    
    // Add directly to EAC prepare queue
    this.eacRequestService.addRequest({
      id: 'TSK-' + Math.floor(1000 + Math.random() * 9000),
      projectId: this.createdProjectId(),
      projectNumber: this.createdProjectNumber(),
      projectName: formData1.projectName || 'Data Automation Initiative',
      projectData: {
        projectName: formData1.projectName || 'Data Automation Initiative',
        requestorName: formData1.requestorName || 'Gurrammaneesh User',
        requestingDepartment: formData1.requestingDepartment || 'Clinical IT',
        problemStatement: formData1.problemStatement || '',
        desiredOutcome: formData1.desiredOutcome || ''
      },
      type: 'Prepare for EAC',
      priority: 'High',
      submittedBy: formData1.requestorName || 'Gurrammaneesh User',
      submittedDate: 'Today, ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'pending'
    });

    this.router.navigate(['/prepare-eac'], {
      state: {
        projectData: {
          projectName: formData1.projectName,
          requestorName: formData1.requestorName,
          requestingDepartment: formData1.requestingDepartment,
          problemStatement: formData1.problemStatement,
          desiredOutcome: formData1.desiredOutcome
        },
        projectId: this.createdProjectId(),
        fromAdminOverride: true
      }
    });
  }

  adminOverridePic(): void {
    const formData = this.step1Form.value;
    
    // Remove from BTA queue if it got added automatically
    this.btaRequestService.removeRequest(this.createdProjectId());
    
    // Mock the PIC creation via PIC service so the inbox updates cleanly
    this.picRequestService.addRequest({
      id: 'TSK-' + Math.floor(1000 + Math.random() * 9000),
      projectId: this.createdProjectId(),
      projectNumber: this.createdProjectNumber(),
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
        projectId: this.createdProjectId(),
        fromAdminOverride: true
      }
    });
  }
}
