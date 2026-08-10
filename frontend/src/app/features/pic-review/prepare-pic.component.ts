import { Component, signal, inject, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ProjectService } from '../../core/services/project.service';
import { ConfirmationScreenComponent } from '../../shared/components/confirmation-screen/confirmation-screen.component';
import { GatewayChecklistComponent } from '../../shared/components/gateway-checklist/gateway-checklist.component';

@Component({
  selector: 'app-prepare-pic',
  standalone: true,
  imports: [CommonModule, FormsModule, ConfirmationScreenComponent, GatewayChecklistComponent],
  template: `
    @if (submitted() && !embeddedMode) {
      <app-confirmation-screen
        title="Preparation Submitted"
        message="The PIC preparation packet has been routed to the Project Investment Committee for their final meeting and decision."
        subMessage="You'll be notified once the committee records its decision."
        returnLabel="Return to Pending Reviews"
        returnRoute="/team-inbox">
      </app-confirmation-screen>
    } @else if (!submitted()) {
    <div class="animate-fade-in" [ngClass]="embeddedMode ? '' : 'stepper-layout'">

      <!-- HEADER -->
      @if(!embeddedMode) {
      <div class="stepper-header">
        <button class="back-btn" (click)="goBack()">
          <span class="material-icons">arrow_back</span>
        </button>
        <div class="header-titles">
          <h2>Prepare for PIC</h2>
          <p class="subtitle">Assign to: <span class="assigned-user">PIC Team</span></p>
        </div>
      </div>
      }

      <div class="layout-body" [class.border-t]="!embeddedMode" [ngClass]="!embeddedMode ? 'border-white/10' : ''" [class.pt-6]="!embeddedMode" [style]="embeddedMode ? 'display: block;' : ''">
        <!-- LEFT CONTENT -->
        <div class="content-panel" [ngClass]="embeddedMode ? '' : 'card'">
          <div class="card-body" style="padding:0">
            <!-- EMBEDDED MODE HORIZONTAL TABS -->
            @if(forceReviewScreen) {
              <div class="embedded-mode-tabs flex gap-2 overflow-x-auto pb-4 border-b border-white/10 p-6 pt-4 mb-2">
                <button type="button" *ngFor="let s of sections; let i = index"
                        (click)="setSection(i)"
                        class="px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors border"
                        [ngClass]="currentSectionIndex() === i ?
                          'bg-indigo-500 text-white border-indigo-500' :
                          'bg-white/5 text-slate-400 border-white/10 hover:border-indigo-400/40 hover:text-indigo-300'">
                  {{ s.title }}
                </button>
              </div>
            }

            <!-- STEP 1: Core Project Definition & Justification -->
            @if (currentSectionIndex() === 0) {
              <div class="section-content animate-slide-in">
                <div class="section-header">
                  <h3>Project Identification</h3>
                </div>
                <div class="p-6">
                  <div class="grid grid-cols-2 gap-4">
                    <div class="form-group">
                      <label>Project Name</label>
                      <input type="text" class="form-control" [value]="projectData.name || 'Not provided'" readonly>
                    </div>
                    <div class="form-group">
                      <label>Department / Clinical Specialty</label>
                      <input type="text" class="form-control" [value]="projectData.dept || 'Not provided'" readonly>
                    </div>
                    <div class="form-group">
                      <label>Project ID</label>
                      <input type="text" class="form-control" [value]="projectData.number || 'Not provided'" readonly>
                    </div>
                    <div class="form-group">
                      <label>Submission Date</label>
                      <input type="text" class="form-control" [value]="projectData.due || 'Not provided'" readonly>
                    </div>
                  </div>

                  <div class="form-group mt-4">
                    <label>Problem or Opportunity Statement</label>
                    <textarea class="form-control" rows="4" [(ngModel)]="picData.problemStatement" placeholder="Not provided"></textarea>
                  </div>

                  <div class="form-group mt-4">
                    <label>Scope of Project (High Level)</label>
                    <textarea class="form-control" rows="3" [(ngModel)]="picData.scope" placeholder="Not provided"></textarea>
                  </div>
                </div>
              </div>
            }

            <!-- STEP 2: Vendor Recommendation & Selection -->
            @if (currentSectionIndex() === 1) {
              <div class="section-content animate-slide-in">
                <div class="section-header">
                  <h3>Evaluation Criteria & Vendor Comparison</h3>
                </div>
                <div class="p-6">
                  <div class="form-group">
                    <label>Primary Recommended Vendor</label>
                    <input type="text" class="form-control" [(ngModel)]="picData.vendorName" placeholder="Enter vendor name">
                  </div>
                  <div class="form-group mt-4">
                    <label>Justification for Recommended Vendor</label>
                    <textarea class="form-control" rows="4" [(ngModel)]="picData.vendorJustification" placeholder="Why was this vendor selected over others?"></textarea>
                  </div>
                  <div class="form-group mt-4">
                    <label>Specific Benefits of Recommended Vendor</label>
                    <textarea class="form-control" rows="3" [(ngModel)]="picData.vendorBenefits" placeholder="Additional cost or strategic benefits"></textarea>
                  </div>
                </div>
              </div>
            }

            <!-- STEP 3: Project Evaluation & Benefit -->
            @if (currentSectionIndex() === 2) {
              <div class="section-content animate-slide-in">
                <div class="section-header">
                  <h3>Quantifiable Benefits / Savings</h3>
                </div>
                <div class="p-6">
                  <div class="form-group">
                    <label>Primary Benefit Category</label>
                    <select class="form-control" [(ngModel)]="picData.benefitCategory">
                      <option>Cost Reduction</option>
                      <option>Revenue Generation</option>
                      <option>Compliance Risk Avoidance</option>
                      <option>Clinical Efficiency</option>
                    </select>
                  </div>

                  <div class="grid grid-cols-2 gap-4 mt-4">
                    <div class="form-group">
                      <label>Annual Quantified Value (Year 1)</label>
                      <input type="text" class="form-control" [(ngModel)]="picData.annualValueY1" placeholder="$0.00">
                    </div>
                    <div class="form-group">
                      <label>Annual Quantified Value (Year 2)</label>
                      <input type="text" class="form-control" [(ngModel)]="picData.annualValueY2" placeholder="$0.00">
                    </div>
                  </div>
                  <div class="form-group mt-4">
                    <label>Benefit Calculation Methodology</label>
                    <textarea class="form-control" rows="3" [(ngModel)]="picData.benefitMethodology" placeholder="How were these benefits calculated?"></textarea>
                  </div>
                </div>
              </div>
            }

            <!-- STEP 4: Cost Plan & ROI Analysis -->
            @if (currentSectionIndex() === 3) {
              <div class="section-content animate-slide-in">
                <div class="section-header">
                  <h3>Detailed Cost Plan & ROI</h3>
                </div>
                <div class="p-6">
                  <div class="grid grid-cols-2 gap-4">
                    <div class="form-group">
                      <label>Total Capex (Capital Expenditure)</label>
                      <input type="text" class="form-control" [(ngModel)]="picData.capex" placeholder="$0.00">
                    </div>
                    <div class="form-group">
                      <label>Total Opex (Requested Budget)</label>
                      <input type="text" class="form-control" [value]="projectData.budget || '$0.00'" readonly>
                    </div>
                    <div class="form-group">
                      <label>Net Present Value (NPV)</label>
                      <input type="text" class="form-control" [(ngModel)]="picData.npv" placeholder="$0.00">
                    </div>
                    <div class="form-group">
                      <label>Internal Rate of Return (IRR)</label>
                      <input type="text" class="form-control" [(ngModel)]="picData.irr" placeholder="0%">
                    </div>
                    <div class="form-group">
                      <label>Payback Period (Months)</label>
                      <input type="text" class="form-control" [(ngModel)]="picData.paybackMonths" placeholder="0">
                    </div>
                  </div>
                </div>
              </div>
            }

            <!-- STEP 5: Project Execution & Ask -->
            @if (currentSectionIndex() === 4) {
              <div class="section-content animate-slide-in">
                <div class="section-header">
                  <h3>Project Execution Readiness</h3>
                </div>
                <div class="p-6">
                  <div class="form-group">
                    <label>Milestone Target Dates</label>
                    <textarea class="form-control" rows="4" [(ngModel)]="picData.milestones" placeholder="List key milestones and planned dates"></textarea>
                  </div>
                  <div class="form-group mt-4">
                    <label>Resource Ask (FTE Requirements)</label>
                    <textarea class="form-control" rows="3" [(ngModel)]="picData.resourceAsk" placeholder="What internal resources are required from IT, Clinical, or Operations?"></textarea>
                  </div>
                </div>
              </div>
            }

            <!-- STEP 6: Supporting Information & Resources -->
            @if (currentSectionIndex() === 5) {
              <div class="section-content animate-slide-in">
                <div class="section-header">
                  <h3>Supporting Resources & Final Submission</h3>
                </div>
                <div class="p-6">
                  <div class="form-group">
                    <label>Attachments & References</label>
                    <div style="border: 2px dashed rgba(255,255,255,0.15); padding: 30px; text-align:center; border-radius: 8px; cursor: pointer; color: #94A3B8">
                      <span class="material-icons" style="font-size: 32px">upload_file</span>
                      <p>Drag and drop supporting artifacts here</p>
                    </div>
                  </div>
                  <div class="form-group mt-6">
                     <label>Preparation Comments</label>
                     <textarea class="form-control" rows="4" [(ngModel)]="comments" placeholder="Add any notes for the PIC committee..."></textarea>
                  </div>
                </div>
              </div>
            }

            <!-- STEP 7: PIC Approval Checklist -->
            @if (currentSectionIndex() === 6) {
              <div class="section-content animate-slide-in">
                  <div class="section-header">
                    <h3>PIC Final Gate Review</h3>
                  </div>
                  <div class="p-6">
                    <app-gateway-checklist [projectId]="projectId" gateOwner="PIC"></app-gateway-checklist>
                  </div>
              </div>
            }

            <!-- FOOTER NAVIGATION -->
            @if(!forceReviewScreen) {
            <div class="section-footer flex justify-between items-center p-4">
              <button class="btn btn-secondary" (click)="cancel()">Cancel</button>

              <div class="flex gap-3">
                <button class="btn btn-secondary" (click)="previousSection()" [disabled]="currentSectionIndex() === 0">Previous</button>
                @if (currentSectionIndex() < sections.length - 1) {
                  <button class="btn btn-primary" (click)="nextSection()">Next</button>
                } @else {
                  <button class="btn btn-primary" style="background:#00875A" (click)="submitData()">Verify & Send to PIC Meeting</button>
                }
              </div>
            </div>
            }

          </div>
        </div>

        <!-- RIGHT SIDEBAR (Vertical Stepper) -->
        @if(!forceReviewScreen) {
        <div class="sidebar-panel">
          <div class="card p-4">
            <h3 class="sidebar-title">Step-by-Step Preparation</h3>
            <ul class="vertical-stepper">
              @for (step of sections; track step.title; let i = $index) {
                <li
                  class="step-item"
                  [class.active]="currentSectionIndex() === i"
                  [class.completed]="currentSectionIndex() > i"
                  (click)="setSection(i)">
                  <div class="step-indicator">
                    @if (currentSectionIndex() > i) {
                      <span class="material-icons" style="font-size: 14px;">check</span>
                    } @else {
                      <span class="dot"></span>
                    }
                  </div>
                  <span class="step-title">{{ step.title }}</span>
                </li>
              }
            </ul>
          </div>
        </div>
        }

      </div>
    </div>
    }
  `,
  styles: [`

    /* Premium PIC Layout — dark glass theme */
    .stepper-layout {
      display: flex; flex-direction: column; gap: 20px;
      padding: 28px; max-width: 1400px; margin: 0 auto;
      background-color: transparent; min-height: 100vh;
      font-family: 'Inter', sans-serif;
    }

    .stepper-header { display: flex; align-items: center; gap: 16px; margin-bottom: 8px; }
    .back-btn {
      width: 44px; height: 44px; border-radius: 50%;
      border: 1px solid rgba(255,255,255,0.1); background: rgba(30,41,59,0.7); backdrop-filter: blur(8px);
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2); transition: all 0.2s; color: #94A3B8;
    }
    .back-btn:hover { background: rgba(99,102,241,0.15); color: #A5B4FC; border-color: rgba(129,140,248,0.4); }
    .header-titles h2 { margin: 0; font-size: 24px; font-weight: 800; color: #F1F5F9; font-family: 'Outfit', sans-serif; }
    .subtitle { margin: 4px 0 0; font-size: 13px; font-weight: 500; color: #94A3B8; }
    .assigned-user { color: #818CF8; font-weight: 700; }

    .layout-body { display: grid; grid-template-columns: 1fr 340px; gap: 28px; align-items: start; }

    .content-panel {
      min-height: 500px; display: flex; flex-direction: column;
    }
    .card {
      background: rgba(255,255,255,0.05); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.1);
      border-radius: 18px; box-shadow: 0 8px 32px rgba(0,0,0,0.4);
      overflow: hidden; position: relative;
    }
    .card::before {
      content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
      background: linear-gradient(90deg, #10B981 0%, #059669 50%, #34D399 100%);
    }

    .section-header {
      padding: 20px 28px; border-bottom: 1px solid rgba(255,255,255,0.1);
      background: rgba(255,255,255,0.03); border-radius: 12px 12px 0 0;
    }
    .section-header h3 { margin: 0; font-size: 18px; font-weight: 800; color: #F1F5F9; font-family: 'Outfit', sans-serif; }

    .section-footer {
      border-top: 1px solid rgba(255,255,255,0.1); background: transparent;
      border-radius: 0 0 12px 12px; padding: 20px 28px;
    }

    .sidebar-panel { position: sticky; top: 24px; }
    .sidebar-title {
      font-size: 13px; font-weight: 800; color: #94A3B8; margin: 0 0 16px 0;
      padding-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.1);
      text-transform: uppercase; letter-spacing: 0.5px;
    }

    .vertical-stepper { list-style: none; padding: 0; margin: 0; position: relative; }
    .vertical-stepper::before {
      content: ''; position: absolute; top: 12px; bottom: 30px; left: 11px; width: 2px;
      background: linear-gradient(180deg, #10B981 0%, rgba(255,255,255,0.12) 100%); z-index: 1;
    }

    .step-item {
      display: flex; align-items: flex-start; gap: 14px; margin-bottom: 16px;
      cursor: pointer; position: relative; z-index: 2; opacity: 0.6; transition: all 0.2s;
      padding: 8px 10px; border-radius: 10px;
    }
    .step-item:hover { opacity: 1; background: rgba(16,185,129,0.08); }
    .step-item.active { opacity: 1; background: rgba(16,185,129,0.12); }
    .step-item.completed { opacity: 1; }

    .step-indicator {
      width: 24px; height: 24px; border-radius: 50%; background: rgba(255,255,255,0.05);
      border: 2px solid rgba(255,255,255,0.15); display: flex; align-items: center; justify-content: center; transition: all 0.3s;
      box-shadow: 0 0 0 0 transparent;
    }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: transparent; }

    .step-item.active .step-indicator { border-color: #10B981; box-shadow: 0 0 0 3px rgba(16,185,129,0.2); }
    .step-item.active .dot { background: linear-gradient(135deg, #10B981, #059669); }
    .step-item.active .step-title { color: #34D399; font-weight: 800; }

    .step-item.completed .step-indicator { background: rgba(16,185,129,0.15); border-color: #10B981; color: #34D399; }
    .step-item.completed .step-indicator .material-icons { font-size: 14px; font-weight: bold; }
    .step-title { font-size: 14px; font-weight: 600; color: #94A3B8; margin-top: 2px; }

    /* Form Controls */
    .form-group label { font-size: 11px; font-weight: 700; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 6px; }

    .form-control {
      width: 100%; padding: 10px 14px; font-size: 13px; font-family: 'Inter', sans-serif; font-weight: 500;
      border: 1.5px solid rgba(255,255,255,0.12); border-radius: 10px; background: rgba(30,41,59,0.7); color: #F1F5F9; outline: none; transition: all 0.2s;
    }
    .form-control:focus { border-color: rgba(16,185,129,0.5); box-shadow: 0 0 0 4px rgba(16,185,129,0.15); background: rgba(30,41,59,0.9); }
    .form-control[readonly] { background-color: rgba(255,255,255,0.03); color: #94A3B8; }
    .form-control option { background-color: #1e293b; color: #F1F5F9; }

    .btn { padding: 10px 20px; border-radius: 10px; font-weight: 700; font-size: 13px; cursor: pointer; transition: all 0.2s; font-family: 'Inter', sans-serif; }
    .btn-primary { background: linear-gradient(135deg, #10B981, #059669); color: white; border: none; box-shadow: 0 4px 14px rgba(16,185,129,0.3); }
    .btn-primary:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 20px rgba(16,185,129,0.4); }
    .btn-primary:disabled { background: rgba(255,255,255,0.08); color: #64748B; cursor: not-allowed; box-shadow: none; transform: none; }

    .btn-secondary { background: rgba(30,41,59,0.7); color: #94A3B8; border: 1.5px solid rgba(255,255,255,0.12); }
    .btn-secondary:hover:not(:disabled) { background: rgba(16,185,129,0.1); border-color: rgba(16,185,129,0.4); color: #34D399; }
    .btn-secondary:disabled { opacity: 0.5; cursor: not-allowed; }

  `]
})
export class PreparePicComponent implements OnInit {
  router = inject(Router);
  projectService = inject(ProjectService);

  @Input() embeddedMode = false;
  @Input() forceReviewScreen = false;
  @Input() projectId: string = '';
  @Input() projectData: any = {};
  @Output() formSubmitted = new EventEmitter<{ title: string; message: string }>();

  comments: string = '';
  submitted = signal(false);

  picData: any = {
    problemStatement: '',
    scope: '',
    vendorName: '',
    vendorJustification: '',
    vendorBenefits: '',
    benefitCategory: 'Cost Reduction',
    annualValueY1: '',
    annualValueY2: '',
    benefitMethodology: '',
    capex: '',
    npv: '',
    irr: '',
    paybackMonths: '',
    milestones: '',
    resourceAsk: ''
  };

  currentSectionIndex = signal<number>(0);
  sections = [
    { title: 'Core Project Definition & Justification' },
    { title: 'Vendor Recommendation & Selection' },
    { title: 'Project Evaluation & Benefit' },
    { title: 'Cost Plan & ROI Analysis' },
    { title: 'Project Execution & Ask' },
    { title: 'Supporting Information & Resources' },
    { title: 'PIC Approval Checklist' }
  ];

  ngOnInit() {
    if (this.embeddedMode) {
      this.seedFromProjectData();
      return;
    }
    const state = history.state;
    if (state && state.projectId) {
      this.projectId = state.projectId;
      this.projectData = state.projectData || {};
      this.seedFromProjectData();
    } else {
      // For standalone testing without navigating from inbox
      this.cancel();
    }
  }

  private seedFromProjectData() {
    this.picData.problemStatement = this.projectData?.problemStatement || '';
    this.picData.scope = this.projectData?.scope || '';
  }

  setSection(index: number) { this.currentSectionIndex.set(index); }
  nextSection() { if (this.currentSectionIndex() < this.sections.length - 1) this.currentSectionIndex.update(i => i + 1); }
  previousSection() { if (this.currentSectionIndex() > 0) this.currentSectionIndex.update(i => i - 1); }

  private buildProjectUpdates() {
    return {
      problemStatement: this.picData.problemStatement,
      scope: this.picData.scope,
      pic_vendor_name: this.picData.vendorName,
      pic_vendor_justification: this.picData.vendorJustification,
      pic_vendor_benefits: this.picData.vendorBenefits,
      pic_benefit_category: this.picData.benefitCategory,
      pic_annual_value_y1: this.picData.annualValueY1,
      pic_annual_value_y2: this.picData.annualValueY2,
      pic_benefit_methodology: this.picData.benefitMethodology,
      pic_capex: this.picData.capex,
      pic_npv: this.picData.npv,
      pic_irr: this.picData.irr,
      pic_payback_months: this.picData.paybackMonths,
      pic_milestones: this.picData.milestones,
      pic_resource_ask: this.picData.resourceAsk,
    };
  }

  submitData() {
    this.projectService.submitDecision(this.projectId, 'Prepare for PIC', 'Complete', this.comments, this.buildProjectUpdates())
      .subscribe({
        next: () => {
          this.submitted.set(true);
          if (this.embeddedMode) {
            this.formSubmitted.emit({
              title: 'Preparation Submitted',
              message: 'The PIC preparation packet has been routed to the Project Investment Committee for their final meeting and decision.'
            });
          }
        },
        error: (err) => alert("Error submitting request.")
      });
  }

  cancel() {
    this.router.navigate(['/team-inbox']);
  }

  goBack() {
    this.cancel();
  }
}
