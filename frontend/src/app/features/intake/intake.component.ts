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
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-intake',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="animate-fade-in min-h-[calc(100vh-4rem)] bg-[#0f172a] text-slate-100 relative overflow-hidden font-sans">
      <!-- Deep Gradient Background (ChatGPT Voice Style) -->
      <div class="absolute inset-0 bg-gradient-to-br from-slate-900 via-[#111827] to-[#1e1b4b] z-0"></div>
      <div class="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] bg-blue-600/20 rounded-full blur-[150px] pointer-events-none mix-blend-screen z-0 animate-pulse-slow"></div>
      <div class="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-purple-600/20 rounded-full blur-[120px] pointer-events-none mix-blend-screen z-0"></div>

      <div class="max-w-7xl mx-auto p-6 lg:p-8 relative z-10">
        <div class="glass-card w-full rounded-2xl border border-slate-700/50 shadow-2xl shadow-indigo-900/50 overflow-hidden flex flex-col">
          
          <!-- Header Bar -->
          <div class="bg-gradient-to-r from-slate-800 to-slate-800/80 px-6 py-4 lg:px-8 lg:py-6 border-b border-slate-700/50 flex justify-between items-center sticky top-0 z-10 backdrop-blur-md">
            <div class="flex flex-col">
              <h1 class="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
                <span class="material-icons text-indigo-400">note_add</span> New Proposal Intake
              </h1>
              <p class="text-sm font-medium text-slate-400 mt-1">Complete all sections below to submit your project for governance review.</p>
            </div>
            <div class="flex gap-2">
              <button type="button" class="w-10 h-10 rounded-xl bg-slate-800/50 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700 transition-all flex items-center justify-center shadow-sm" title="Close" (click)="goBack()">
                <span class="material-icons text-[20px]">close</span>
              </button>
            </div>
          </div>

          <div class="p-6 lg:p-8 bg-slate-900/40">
            @if (!submittedSuccess()) {
              <div class="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8">
                <!-- Main Form Panel -->
                <div class="flex flex-col gap-8">
                
                  <!-- Section 1: Collect Information -->
                  <div class="glass-card-inner rounded-xl border border-slate-700/50 p-6 lg:p-8 animate-fade-in shadow-lg">
                    <div class="flex items-center gap-3 mb-6 pb-4 border-b border-slate-700/50">
                      <div class="bg-indigo-500/20 p-2 rounded-lg border border-indigo-500/30 text-indigo-400 shadow-inner">
                        <span class="material-icons text-xl block">info</span>
                      </div>
                      <h2 class="text-lg font-bold text-white tracking-wide">1. Project Information</h2>
                    </div>

                    <!-- Attachments / Document Upload Zone -->
                    <div class="upload-zone mb-8 group" (click)="fileInput.click()">
                      <div class="w-14 h-14 rounded-full bg-slate-800 border border-slate-700 group-hover:bg-indigo-500/20 group-hover:border-indigo-500/40 group-hover:text-indigo-400 text-slate-400 flex items-center justify-center transition-all duration-300 shadow-md">
                        <span class="material-icons text-2xl">cloud_upload</span>
                      </div>
                      <div class="flex flex-col flex-1">
                        <div class="font-bold text-sm text-slate-200 group-hover:text-indigo-300 transition-colors">Upload Project Document / Attachments (Optional)</div>
                        <div class="text-xs text-slate-500 mt-1">AI will automatically extract & pre-fill form details &bull; PDF, DOCX, PPTX</div>
                        @if (isExtracting()) {
                          <div class="mt-3 text-xs font-bold text-indigo-400 flex items-center gap-2 bg-indigo-900/30 px-3 py-1.5 rounded-lg border border-indigo-500/30 w-fit">
                            <span class="material-icons text-[16px] animate-spin">sync</span> AI is extracting data...
                          </div>
                        }
                        @if (uploadedFileName() && !isExtracting()) {
                          <div class="mt-3 text-xs font-bold text-emerald-400 flex items-center gap-2 bg-emerald-900/30 px-3 py-1.5 rounded-lg border border-emerald-500/30 w-fit">
                            <span class="material-icons text-[16px]">attach_file</span> Attached: {{ uploadedFileName() }}
                          </div>
                        }
                      </div>
                      <button type="button" class="hidden md:flex text-xs font-bold text-indigo-300 hover:text-white items-center gap-1.5 bg-slate-800 hover:bg-indigo-600 px-4 py-2 rounded-xl transition-colors border border-slate-700 hover:border-indigo-500 shadow-sm" (click)="$event.stopPropagation(); fileInput.click()">
                        <span class="material-icons text-[16px]">folder_open</span> Browse
                      </button>
                      <input #fileInput type="file" accept=".pdf,.docx,.pptx,.xlsx" style="display:none" (change)="onFileSelected($event)" />
                    </div>

                    <form [formGroup]="step1Form" class="flex flex-col gap-5">
                      <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div class="form-group">
                          <label class="field-label">Requestor Name <span class="required">*</span></label>
                          <input type="text" class="form-control readonly-input shadow-inner" formControlName="requestorName" placeholder="e.g. Gurrammaneesh User" />
                          @if (isInvalid('step1', 'requestorName')) { <span class="field-error"><span class="material-icons text-[14px]">warning</span> Required field</span> }
                        </div>

                        <div class="form-group">
                          <label class="field-label">Requesting Department <span class="required">*</span></label>
                          <select class="form-control shadow-inner" formControlName="requestingDepartment" [class.field-error-border]="isInvalid('step1', 'requestingDepartment')">
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
                          @if (isInvalid('step1', 'requestingDepartment')) { <span class="field-error"><span class="material-icons text-[14px]">warning</span> Required field</span> }
                        </div>
                      </div>

                      <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div class="form-group">
                          <label class="field-label">Request Type <span class="required">*</span></label>
                          <select class="form-control shadow-inner" formControlName="requestType">
                            <option value="Pre-Project Discovery">Pre-Project Discovery</option>
                            <option value="New System Implementation">New System Implementation</option>
                            <option value="System Enhancement / Upgrade">System Enhancement / Upgrade</option>
                            <option value="Infrastructure Hardware">Infrastructure Hardware</option>
                            <option value="Process Optimization">Process Optimization</option>
                          </select>
                        </div>
                      </div>

                      <div class="form-group mt-2">
                        <label class="field-label">Project Name <span class="required">*</span></label>
                        <input type="text" class="form-control shadow-inner" formControlName="projectName" [class.field-error-border]="isInvalid('step1', 'projectName')" placeholder="Enter project name..." />
                        @if (isInvalid('step1', 'projectName')) { <span class="field-error"><span class="material-icons text-[14px]">warning</span> Required field</span> }
                      </div>

                      <div class="form-group">
                        <label class="field-label">Problem or Opportunity Statement <span class="required">*</span></label>
                        <textarea class="form-control shadow-inner" rows="3" formControlName="problemStatement" [class.field-error-border]="isInvalid('step1', 'problemStatement')" placeholder="Describe the current problem, pain points, or business opportunity..."></textarea>
                        @if (isInvalid('step1', 'problemStatement')) { <span class="field-error"><span class="material-icons text-[14px]">warning</span> Required field</span> }
                      </div>

                      <div class="form-group">
                        <label class="field-label">Desired Outcome <span class="required">*</span></label>
                        <textarea class="form-control shadow-inner" rows="3" formControlName="desiredOutcome" [class.field-error-border]="isInvalid('step1', 'desiredOutcome')" placeholder="Describe the target outcomes and success criteria..."></textarea>
                        @if (isInvalid('step1', 'desiredOutcome')) { <span class="field-error"><span class="material-icons text-[14px]">warning</span> Required field</span> }
                      </div>

                      <div class="form-group">
                        <label class="field-label">What Do You Do Today ?</label>
                        <textarea class="form-control shadow-inner" rows="3" formControlName="whatDoYouDoToday" maxlength="1024" placeholder="Explain the existing process or workaround currently in place..."></textarea>
                        <div class="char-counter">{{ step1Form.value.whatDoYouDoToday?.length || 0 }} of 1024</div>
                      </div>

                      <div class="form-group">
                        <label class="field-label">What Transpires If We Do Nothing ?</label>
                        <textarea class="form-control shadow-inner" rows="3" formControlName="whatTranspiresIfWeDoNothing" maxlength="1024" placeholder="Describe the operational, strategic, or financial impact of inaction..."></textarea>
                        <div class="char-counter">{{ step1Form.value.whatTranspiresIfWeDoNothing?.length || 0 }} of 1024</div>
                      </div>

                      <div class="form-group">
                        <label class="field-label">Notes / Comments</label>
                        <textarea class="form-control shadow-inner" rows="2" formControlName="notesComments" placeholder=""></textarea>
                      </div>

                      <div class="mt-4 pt-4 border-t border-slate-700/50">
                        <label class="flex items-center gap-3 cursor-pointer group w-fit">
                          <input type="checkbox" class="w-5 h-5 rounded border-slate-600 bg-slate-800 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-slate-900 transition-all cursor-pointer shadow-inner" formControlName="sendCopyOfResponses" (change)="toggleCopyEmailValidation()" />
                          <span class="text-sm font-semibold text-slate-300 group-hover:text-white transition-colors">Send me a copy of my responses</span>
                        </label>
                        @if (step1Form.value.sendCopyOfResponses) {
                          <div class="animate-fade-in mt-4 max-w-md">
                            <label class="field-label">Email Address <span class="required">*</span></label>
                            <input type="email" class="form-control shadow-inner" formControlName="emailAddress" [class.field-error-border]="isInvalid('step1', 'emailAddress')" placeholder="john.smith@company.com" />
                            @if (isInvalid('step1', 'emailAddress')) { <span class="field-error"><span class="material-icons text-[14px]">warning</span> Valid email required</span> }
                          </div>
                        }
                      </div>
                    </form>
                  </div>

                  <!-- Section 2: Budget & Strategy -->
                  <div class="glass-card-inner rounded-xl border border-slate-700/50 p-6 lg:p-8 animate-fade-in shadow-lg">
                    <div class="flex items-center gap-3 mb-6 pb-4 border-b border-slate-700/50">
                      <div class="bg-emerald-500/20 p-2 rounded-lg border border-emerald-500/30 text-emerald-400 shadow-inner">
                        <span class="material-icons text-xl block">payments</span>
                      </div>
                      <h2 class="text-lg font-bold text-white tracking-wide">2. Budget & Strategic Alignment</h2>
                    </div>
                    <form [formGroup]="step2Form" class="flex flex-col gap-5">
                      <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div class="form-group">
                          <label class="field-label">Budget Type <span class="required">*</span></label>
                          <select class="form-control shadow-inner" formControlName="budgetType" [class.field-error-border]="isInvalid('step2', 'budgetType')">
                            <option value="tbd">TBD</option>
                            <option value="Operational">Operational</option>
                            <option value="Capital">Capital</option>
                            <option value="Grant">Grant</option>
                          </select>
                          @if (isInvalid('step2', 'budgetType')) { <span class="field-error"><span class="material-icons text-[14px]">warning</span> Required field</span> }
                        </div>

                        <div class="form-group">
                          <label class="field-label">Estimated Total Project Budget</label>
                          <input type="text" class="form-control shadow-inner" formControlName="budgetEstimated" placeholder="e.g. $85,000" />
                        </div>
                      </div>

                      <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div class="form-group">
                          <label class="field-label">Project Priority <span class="required">*</span></label>
                          <select class="form-control shadow-inner" formControlName="priority">
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                            <option value="critical">Critical</option>
                          </select>
                        </div>

                        <div class="form-group">
                          <label class="field-label">Initial Risk Level Assessment</label>
                          <select class="form-control shadow-inner" formControlName="riskLevel">
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                          </select>
                        </div>
                      </div>

                      <div class="form-group">
                        <label class="field-label">Strategic Alignment & Rationale</label>
                        <textarea class="form-control shadow-inner" rows="3" formControlName="strategicAlignment" placeholder="Describe how this project aligns with key business objectives and enterprise standards..."></textarea>
                      </div>
                    </form>
                  </div>

                  <!-- Section 3: IT & Governance Requirements -->
                  <div class="glass-card-inner rounded-xl border border-slate-700/50 p-6 lg:p-8 animate-fade-in shadow-lg">
                    <div class="flex items-center gap-3 mb-6 pb-4 border-b border-slate-700/50">
                      <div class="bg-orange-500/20 p-2 rounded-lg border border-orange-500/30 text-orange-400 shadow-inner">
                        <span class="material-icons text-xl block">security</span>
                      </div>
                      <h2 class="text-lg font-bold text-white tracking-wide">3. IT & Governance Requirements</h2>
                    </div>
                    <form [formGroup]="step3Form" class="flex flex-col gap-4">
                      
                      <label class="flex items-center justify-between p-4 bg-slate-800/40 hover:bg-slate-800/80 rounded-xl border border-slate-700/50 cursor-pointer transition-colors group">
                        <div>
                          <div class="font-bold text-sm text-slate-200 group-hover:text-white transition-colors">Dedicated IT Resources Required</div>
                          <div class="text-xs text-slate-400 mt-0.5">Will this initiative require active support from corporate/clinical IT teams?</div>
                        </div>
                        <input type="checkbox" class="w-6 h-6 rounded border-slate-600 bg-slate-800 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-slate-900 transition-all cursor-pointer shadow-inner" formControlName="itInvolvement" />
                      </label>

                      <label class="flex items-center justify-between p-4 bg-slate-800/40 hover:bg-slate-800/80 rounded-xl border border-slate-700/50 cursor-pointer transition-colors group">
                        <div>
                          <div class="font-bold text-sm text-slate-200 group-hover:text-white transition-colors">External Vendor Solution / Products</div>
                          <div class="text-xs text-slate-400 mt-0.5">Does this involve procuring hardware, software licenses, or consulting from third parties?</div>
                        </div>
                        <input type="checkbox" class="w-6 h-6 rounded border-slate-600 bg-slate-800 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-slate-900 transition-all cursor-pointer shadow-inner" formControlName="vendorRequired" />
                      </label>

                      <label class="flex items-center justify-between p-4 bg-slate-800/40 hover:bg-slate-800/80 rounded-xl border border-slate-700/50 cursor-pointer transition-colors group">
                        <div>
                          <div class="font-bold text-sm text-slate-200 group-hover:text-white transition-colors">Contains Protected Health Information (PHI/PII)</div>
                          <div class="text-xs text-slate-400 mt-0.5">Will patient information, SSNs, financial details, or HIPAA-regulated data be touched?</div>
                        </div>
                        <input type="checkbox" class="w-6 h-6 rounded border-slate-600 bg-slate-800 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-slate-900 transition-all cursor-pointer shadow-inner" formControlName="hasPhiData" />
                      </label>

                    </form>
                  </div>

                  <!-- Error Summary -->
                  @if (hasErrors()) {
                    <div class="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-center gap-3 font-bold text-sm animate-fade-in shadow-md shadow-red-500/5">
                      <span class="material-icons text-xl">error</span>
                      <span>Please fill in all required fields highlighted in red before submitting.</span>
                    </div>
                  }

                  <!-- Action Footer -->
                  <div class="glass-card-inner rounded-xl border border-slate-700/50 p-6 flex justify-end items-center gap-4 mt-2 shadow-lg">
                    <button type="button" class="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-300 hover:text-white hover:bg-slate-700 transition-colors" (click)="goBack()">Cancel</button>
                    <button type="button" class="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white px-8 py-3 rounded-xl text-sm font-bold shadow-lg shadow-indigo-500/25 transition-all flex items-center gap-2 hover:scale-[1.02]" (click)="submitIntake()" [disabled]="submitting()">
                      @if (submitting()) {
                        <span class="material-icons animate-spin">autorenew</span> Submitting...
                      } @else {
                        <span class="material-icons text-[18px]">send</span> Submit Proposal
                      }
                    </button>
                  </div>

                </div>

                <!-- Right Sidebar: What Happens Next & Info -->
                <div class="hidden lg:block relative">
                  <div class="glass-card-inner rounded-xl border border-slate-700/50 p-6 sticky top-28 shadow-lg">
                    <div class="flex items-center gap-3 mb-6 pb-4 border-b border-slate-700/50">
                      <div class="bg-blue-500/20 p-2 rounded-lg border border-blue-500/30 text-blue-400 shadow-inner">
                        <span class="material-icons text-xl block">route</span>
                      </div>
                      <h3 class="text-base font-bold text-white tracking-wide">What Happens Next?</h3>
                    </div>
                    
                    <div class="flex flex-col gap-5 relative pl-4">
                      <!-- Vertical Line -->
                      <div class="absolute left-7 top-4 bottom-8 w-px bg-slate-700"></div>

                      <div class="flex gap-4 relative z-10">
                        <div class="w-7 h-7 rounded-full bg-slate-800 border-2 border-blue-500 text-blue-400 flex items-center justify-center text-xs font-bold shadow-md shrink-0">1</div>
                        <div>
                          <div class="text-sm font-bold text-slate-200">BTA Discovery Review</div>
                          <div class="text-xs text-slate-400 mt-1">Business Tech Advocate schedules discovery and reviews the intake</div>
                        </div>
                      </div>

                      <div class="flex gap-4 relative z-10">
                        <div class="w-7 h-7 rounded-full bg-slate-800 border-2 border-slate-600 text-slate-400 flex items-center justify-center text-xs font-bold shadow-md shrink-0">2</div>
                        <div>
                          <div class="text-sm font-bold text-slate-200">Prepare for EAC</div>
                          <div class="text-xs text-slate-400 mt-1">Formulate 9-domain architecture alignment dossier</div>
                        </div>
                      </div>

                      <div class="flex gap-4 relative z-10">
                        <div class="w-7 h-7 rounded-full bg-slate-800 border-2 border-slate-600 text-slate-400 flex items-center justify-center text-xs font-bold shadow-md shrink-0">3</div>
                        <div>
                          <div class="text-sm font-bold text-slate-200">EAC Committee Meeting</div>
                          <div class="text-xs text-slate-400 mt-1">Enterprise Architecture Council formal alignment vote</div>
                        </div>
                      </div>

                      <div class="flex gap-4 relative z-10">
                        <div class="w-7 h-7 rounded-full bg-slate-800 border-2 border-slate-600 text-slate-400 flex items-center justify-center text-xs font-bold shadow-md shrink-0">4</div>
                        <div>
                          <div class="text-sm font-bold text-slate-200">Gate Reviews</div>
                          <div class="text-xs text-slate-400 mt-1">Committee evaluation for funding and architecture compliance</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            } @else {
              <div class="animate-fade-in flex flex-col items-center justify-center py-20 text-center">
                <div class="w-24 h-24 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mb-6 shadow-lg shadow-emerald-500/10">
                  <span class="material-icons text-6xl text-emerald-400">check_circle</span>
                </div>
                <h2 class="text-3xl font-extrabold text-white mb-3">Proposal Submitted Successfully!</h2>
                <p class="text-slate-300 max-w-lg mb-8 leading-relaxed">
                  Your project proposal <strong class="text-white">{{ step1Form.value.projectName }}</strong> has been officially registered as <strong class="text-indigo-300 bg-indigo-900/40 px-2 py-0.5 rounded border border-indigo-500/30">{{ createdProjectNumber() }}</strong> and routed to the Business Tech Advocate (BTA) team for initial discovery.
                </p>
                
                <div class="flex gap-4 flex-wrap justify-center mt-2">
                  <button type="button" class="px-6 py-3 rounded-xl text-sm font-bold text-slate-300 border border-slate-700 bg-slate-800/50 hover:text-white hover:bg-slate-700 hover:border-slate-600 transition-all shadow-md" (click)="goBack()">Return to Projects</button>
                  
                  @if (isAdmin()) {
                    <button type="button" class="bg-orange-500/20 border border-orange-500/30 text-orange-400 hover:bg-orange-500/30 px-6 py-3 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-md" (click)="adminOverride()">
                      <span class="material-icons text-[18px]">admin_panel_settings</span> Admin Override: BTA Review
                    </button>
                  }
                </div>
              </div>
            }
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
    .glass-card-inner {
      background: rgba(15, 23, 42, 0.4);
      box-shadow: inset 0 1px 0 0 rgba(255, 255, 255, 0.05);
    }
    .upload-zone {
      border: 2px dashed rgba(71, 85, 105, 0.5);
      border-radius: 1rem;
      padding: 1.5rem;
      display: flex;
      align-items: center;
      gap: 1.25rem;
      cursor: pointer;
      background: rgba(15, 23, 42, 0.3);
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .upload-zone:hover {
      border-color: rgba(99, 102, 241, 0.6);
      background: rgba(30, 41, 59, 0.5);
    }
    
    .field-label {
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #94a3b8; /* slate-400 */
      margin-bottom: 0.375rem;
      display: block;
    }
    .field-label .required {
      color: #f87171; /* red-400 */
      margin-left: 2px;
    }

    .form-control {
      width: 100%;
      padding: 0.625rem 1rem;
      font-size: 0.875rem;
      line-height: 1.25rem;
      border: 1px solid #334155; /* slate-700 */
      border-radius: 0.5rem;
      background-color: #1e293b; /* slate-800 */
      color: #f8fafc; /* slate-50 */
      outline: none;
      transition: all 200ms;
    }
    .form-control:focus {
      border-color: #6366f1; /* indigo-500 */
      box-shadow: 0 0 0 1px #6366f1;
    }
    .form-control::placeholder {
      color: #64748b; /* slate-500 */
    }
    /* Select appearance for dark mode */
    select.form-control {
      appearance: none;
      background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%2394a3b8' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
      background-position: right 0.5rem center;
      background-repeat: no-repeat;
      background-size: 1.5em 1.5em;
      padding-right: 2.5rem;
    }
    /* Native <option> popups render in their own compositing layer against the browser's
       default (light) backdrop, not the page — a translucent background here (e.g. from
       .field-error-border below) would show as a pale wash instead of dark. Force solid
       colors on the options themselves so the open dropdown always stays readable. */
    select.form-control option {
      background-color: #1e293b;
      color: #f8fafc;
    }
    /* .field-error-border's translucent red tint is fine for text inputs, but on a <select>
       it composites against the popup's own backdrop (see above) and washes out to pale pink.
       Keep the red border as the error signal; force the select itself back to a solid background. */
    select.form-control.field-error-border {
      background-color: #1e293b;
    }
    .readonly-input {
      background-color: #0f172a; /* slate-900 */
      color: #94a3b8; /* slate-400 */
      cursor: not-allowed;
      border-color: #334155;
    }
    .field-error-border {
      border-color: #f87171 !important; /* red-400 */
      background-color: rgba(239, 68, 68, 0.05); /* red bg tint */
    }
    .field-error {
      color: #f87171;
      font-size: 0.75rem;
      font-weight: 700;
      margin-top: 0.375rem;
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }
    .char-counter {
      font-size: 0.75rem;
      font-weight: 600;
      color: #64748b; /* slate-500 */
      text-align: right;
      margin-top: 0.25rem;
    }
  `]
})
export class IntakeComponent {
  submitting = signal(false);
  submittedSuccess = signal<string | boolean>(false);
  uploadedFileName = signal<string | null>(null);
  isExtracting = signal(false);
  createdProjectId = signal('');
  createdProjectNumber = signal('');
  hasErrors = signal(false);

  private fb = inject(FormBuilder);
  private router = inject(Router);
  private authService = inject(AuthService);
  private btaRequestService = inject(BtaRequestService);
  private eacRequestService = inject(EacRequestService);
  private picRequestService = inject(PicRequestService);
  private http = inject(HttpClient);
  private projectService = inject(ProjectService);

  isAdmin = computed(() => this.authService.hasRole('admin'));

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

  isInvalid(formName: 'step1' | 'step2' | 'step3', field: string): boolean {
    const form = formName === 'step1' ? this.step1Form : formName === 'step2' ? this.step2Form : this.step3Form;
    const ctrl = form.get(field);
    return !!(ctrl && ctrl.invalid && (ctrl.touched || ctrl.dirty));
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

      this.http.post<any>(`${environment.apiUrl}/projects/extract-intake`, formData, {
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
    let invalid = false;
    
    if (this.step1Form.invalid) {
      this.step1Form.markAllAsTouched();
      invalid = true;
    }
    if (this.step2Form.invalid) {
      this.step2Form.markAllAsTouched();
      invalid = true;
    }
    if (this.step3Form.invalid) {
      this.step3Form.markAllAsTouched();
      invalid = true;
    }

    if (invalid) {
      this.hasErrors.set(true);
      return;
    }

    this.hasErrors.set(false);
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
      
      // Step 2 values
      budget_type: formData2.budgetType,
      budget_estimated: formData2.budgetEstimated ? parseFloat(formData2.budgetEstimated) : undefined,
      priority: formData2.priority,
      risk_level: formData2.riskLevel,
      strategic_alignment: formData2.strategicAlignment || '',

      // Step 3 values
      it_involvement: formData3.itInvolvement,
      vendor_required: formData3.vendorRequired,
      has_phi_data: formData3.hasPhiData,
    };

    this.projectService.createProject(payload).subscribe({
      next: (project) => {
        this.submitting.set(false);
        this.createdProjectId.set(project.id);
        if (project.project_number) {
          this.createdProjectNumber.set(project.project_number);
        }
        
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

        if (formData1.sendCopyOfResponses && formData1.emailAddress) {
          this.http.post(`${environment.apiUrl}/projects/send-intake-email`, {
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
}
