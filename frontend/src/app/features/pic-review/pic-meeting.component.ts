import { Component, signal, inject, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ProjectService } from '../../core/services/project.service';
import { ConfirmationScreenComponent } from '../../shared/components/confirmation-screen/confirmation-screen.component';

@Component({
  selector: 'app-pic-meeting',
  standalone: true,
  imports: [CommonModule, FormsModule, ConfirmationScreenComponent],
  template: `
    <div class="stepper-layout animate-fade-in" [ngClass]="embeddedMode ? 'embedded' : ''">
      @if (!embeddedMode) {
      <!-- HEADER -->
      <div class="stepper-header">
        <button class="back-btn" (click)="goBack()">
          <span class="material-icons">arrow_back</span>
        </button>
        <div class="header">
          <h1 class="title">PIC Meeting</h1>
          <p class="subtitle">Reviewing <span class="assigned-user">{{ projectData?.requestorName || 'Unknown' }}</span>'s Proposal • ID: {{ projectId }}</p>
        </div>
      </div>
      }

      @if (submittedStatus() === null) {
        <div class="layout-body mt-4">
          <!-- Left: Main Content -->
          <div class="card content-panel shadow-sm">
          <div class="card-body" style="padding:0">

            <!-- SECTION 1: Strategic Alignment -->
            @if (currentSectionIndex() === 0) {
              <div class="section-content animate-slide-in">
                <div class="section-header"><h3>Strategic Alignment & Justification</h3></div>
                <div class="p-6">
                  <div class="info-grid">
                    <div class="info-item">
                      <span class="info-label">Project Name</span>
                      <span class="info-value">{{ projectData.name || 'Not provided' }}</span>
                    </div>
                    <div class="info-item">
                      <span class="info-label">Department</span>
                      <span class="info-value">{{ projectData.dept || 'Not provided' }}</span>
                    </div>
                    <div class="info-item">
                      <span class="info-label">Strategic Category</span>
                      <span class="info-value">{{ (projectData.priority | uppercase) || 'MEDIUM' }} Priority</span>
                    </div>
                  </div>

                  <h4 class="mt-6 mb-2 text-sm font-bold text-gray-700">Business Value Summary</h4>
                  <div class="read-only-box">{{ projectData.problemStatement || 'Business justification prepared...' }}</div>

                  @if (projectData.picVendorName) {
                    <h4 class="mt-6 mb-2 text-sm font-bold text-gray-700">Recommended Vendor</h4>
                    <div class="read-only-box">
                      <strong>{{ projectData.picVendorName }}</strong>
                      @if (projectData.picVendorJustification) {
                        <p class="mt-2">{{ projectData.picVendorJustification }}</p>
                      }
                    </div>
                  }
                </div>
              </div>
            }

            <!-- SECTION 2: Financials & ROI -->
            @if (currentSectionIndex() === 1) {
              <div class="section-content animate-slide-in">
                <div class="section-header"><h3>Financial Review & Ask</h3></div>
                <div class="p-6">
                  <div class="info-grid">
                    <div class="info-item">
                      <span class="info-label">Requested Budget</span>
                      <span class="info-value" style="color:#0052CC; font-size:18px;">{{ projectData.budget || '$0.00' }}</span>
                    </div>
                    <div class="info-item">
                      <span class="info-label">Estimated ROI (IRR)</span>
                      <span class="info-value" style="color:#00875A">{{ projectData.picIrr || 'Pending' }}</span>
                    </div>
                    <div class="info-item">
                      <span class="info-label">Total Capex</span>
                      <span class="info-value">{{ projectData.picCapex || 'Not provided' }}</span>
                    </div>
                    <div class="info-item">
                      <span class="info-label">Payback Period</span>
                      <span class="info-value">{{ projectData.picPaybackMonths ? projectData.picPaybackMonths + ' months' : 'Not provided' }}</span>
                    </div>
                  </div>
                  <h4 class="mt-6 mb-2 text-sm font-bold text-gray-700">Benefit Calculation Methodology</h4>
                  <div class="read-only-box">{{ projectData.picBenefitMethodology || 'Not provided by preparer.' }}</div>
                </div>
              </div>
            }

            <!-- SECTION 3: Committee Decision -->
            @if (currentSectionIndex() === 2) {
              <div class="section-content animate-slide-in">
                <div class="section-header"><h3>Committee Decision</h3></div>
                <div class="p-6">
                  <div class="form-group">
                    <label>Meeting Notes & Conditions of Approval</label>
                    <textarea class="form-control" rows="5" [(ngModel)]="comments" placeholder="Capture committee discussion, risks raised, or specific conditions attached to the approval..."></textarea>
                  </div>

                  <div class="mt-6 p-4" style="background:#E3FCEF; border:1px solid #00875A; border-radius:8px">
                    <h4 style="margin:0; color:#00875A; font-size:14px; display:flex; align-items:center; gap:8px">
                      <span class="material-icons">info</span> Final Stage Release
                    </h4>
                    <p style="margin:8px 0 0; font-size:13px; color:#172B4D">
                      Approving this request releases the budget and moves the project to TRC Implementation Vetting.
                    </p>
                  </div>
                </div>
              </div>
            }

            <!-- FOOTER -->
            <div class="section-footer flex justify-between items-center p-4">
              <button class="btn btn-secondary" (click)="cancel()">Cancel</button>

              <div class="flex gap-3">
                <button class="btn btn-secondary" (click)="previousSection()" [disabled]="currentSectionIndex() === 0">Previous</button>
                @if (currentSectionIndex() < sections.length - 1) {
                  <button class="btn btn-primary" (click)="nextSection()">Next</button>
                } @else {
                  <button class="btn btn-secondary" style="color:#DE350B" (click)="submitDecision('Reject')">Defer Initiative</button>
                  <button class="btn btn-primary" style="background:#00875A" (click)="submitDecision('Approve')">Complete PIC Approval</button>
                }
              </div>
            </div>

          </div>
        </div>

        <!-- RIGHT SIDEBAR (Vertical Stepper) -->
        <div class="sidebar-panel">
            <h3 class="sidebar-title uppercase tracking-wider text-muted">Review Workflow</h3>

            <ul class="vertical-stepper">
              @for (section of sections; track $index; let i = $index) {
                <li class="step-item"
                    [class.active]="currentSectionIndex() === i"
                    [class.completed]="i < currentSectionIndex()"
                    (click)="setSection(i)">
                  <div class="step-indicator">
                    <span class="material-icons text-sm font-bold" *ngIf="i < currentSectionIndex()">check</span>
                    <div class="dot" *ngIf="i >= currentSectionIndex()"></div>
                  </div>
                  <div class="step-content">
                    <div class="step-title">{{ section.title }}</div>
                  </div>
                </li>
              }
            </ul>
          </div>
        </div>
      } @else if (!embeddedMode) {
        <app-confirmation-screen
          title="PIC Approval Complete — Request Finished"
          message="The proposal has successfully completed the Project Investment Committee (PIC) review. Budget has been released and the project has moved to TRC Implementation Vetting."
          returnLabel="Return to Pending Reviews"
          returnRoute="/team-inbox">
        </app-confirmation-screen>
      }
    </div>
  `,
  styles: [`

    /* Premium PIC Meeting Layout */
    .stepper-layout {
      display: flex; flex-direction: column; gap: 20px;
      padding: 28px; max-width: 1400px; margin: 0 auto;
      background-color: #F8FAFC; min-height: 100vh;
      font-family: 'Inter', sans-serif;
    }
    .stepper-layout.embedded { padding: 0; min-height: 0; background: transparent; }

    .stepper-header { display: flex; align-items: center; gap: 16px; margin-bottom: 8px; }
    .back-btn {
      width: 44px; height: 44px; border-radius: 50%;
      border: 1px solid rgba(226,232,240,0.8); background: white;
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      box-shadow: 0 2px 8px rgba(79,70,229,0.05); transition: all 0.2s;
    }
    .back-btn:hover { background: rgba(238,242,255,0.7); color: #4F46E5; border-color: #4F46E5; }

    .header { margin-bottom: 12px; }
    .title { margin: 0; font-size: 26px; font-weight: 800; color: #1E293B; letter-spacing: -0.5px; font-family: 'Outfit', sans-serif; }
    .subtitle { margin: 6px 0 0; font-size: 13px; font-weight: 500; color: #64748B; }
    .assigned-user { color: #4F46E5; font-weight: 700; }

    .layout-body { display: grid; grid-template-columns: 1fr 340px; gap: 28px; align-items: start; }

    .content-panel {
      min-height: 500px; display: flex; flex-direction: column;
    }
    .card {
      background: white; border: 1px solid rgba(226,232,240,0.8);
      border-radius: 18px; box-shadow: 0 4px 24px rgba(79,70,229,0.05);
      overflow: hidden; position: relative;
    }
    .card::before {
      content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
      background: linear-gradient(90deg, #10B981 0%, #059669 50%, #34D399 100%);
    }

    .section-header {
      padding: 20px 28px; border-bottom: 1px solid rgba(226,232,240,0.6);
      background: rgba(248,250,252,0.5); border-radius: 12px 12px 0 0;
    }
    .section-header h3 { margin: 0; font-size: 18px; font-weight: 800; color: #1E293B; font-family: 'Outfit', sans-serif; }

    .section-footer {
      border-top: 1px solid rgba(226,232,240,0.6); background: white;
      border-radius: 0 0 12px 12px; padding: 20px 28px;
    }

    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    .info-item { display: flex; flex-direction: column; gap: 8px; }
    .info-label { font-size: 11px; text-transform: uppercase; font-weight: 700; color: #64748B; letter-spacing: 0.5px; }
    .info-value { font-size: 14px; font-weight: 600; color: #1E293B; }

    .read-only-box {
      padding: 14px 18px; background: rgba(248,250,252,0.8);
      border-radius: 10px; color: #334155; font-size: 13px; line-height: 1.6;
      border: 1.5px solid rgba(226,232,240,0.7);
    }

    .sidebar-panel { position: sticky; top: 24px; background: white; padding: 24px; border-radius: 16px; border: 1px solid rgba(226,232,240,0.8); box-shadow: 0 4px 20px rgba(79,70,229,0.04); }
    .sidebar-title {
      font-size: 12px; font-weight: 800; color: #64748B; margin: 0 0 16px 0;
      padding-bottom: 12px; border-bottom: 1px solid rgba(226,232,240,0.6);
      text-transform: uppercase; letter-spacing: 0.5px;
    }

    .vertical-stepper { list-style: none; padding: 0; margin: 0; position: relative; }
    .vertical-stepper::before {
      content: ''; position: absolute; top: 12px; bottom: 30px; left: 11px; width: 2px;
      background: linear-gradient(180deg, #10B981 0%, rgba(226,232,240,0.4) 100%); z-index: 1;
    }

    .step-item {
      display: flex; align-items: flex-start; gap: 14px; margin-bottom: 16px;
      cursor: pointer; position: relative; z-index: 2; opacity: 0.6; transition: all 0.2s;
      padding: 8px 10px; border-radius: 10px;
    }
    .step-item:hover { opacity: 1; background: rgba(240,253,244,0.5); }
    .step-item.active { opacity: 1; background: rgba(240,253,244,0.8); }
    .step-item.completed { opacity: 1; }

    .step-indicator {
      width: 24px; height: 24px; border-radius: 50%; background: white;
      border: 2px solid #E2E8F0; display: flex; align-items: center; justify-content: center; transition: all 0.3s;
      box-shadow: 0 0 0 0 transparent;
    }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: transparent; }

    .step-item.active .step-indicator { border-color: #10B981; box-shadow: 0 0 0 3px rgba(16,185,129,0.2); }
    .step-item.active .dot { background: linear-gradient(135deg, #10B981, #059669); }
    .step-item.active .step-title { color: #10B981; font-weight: 800; }

    .step-item.completed .step-indicator { background: #D1FAE5; border-color: #059669; color: #059669; }
    .step-item.completed .step-indicator .material-icons { font-size: 14px; font-weight: bold; }
    .step-title { font-size: 14px; font-weight: 600; color: #64748B; margin-top: 2px; }

    /* Form Controls */
    .form-group label { font-size: 11px; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 8px; }

    .form-control {
      width: 100%; padding: 12px 16px; font-size: 13px; font-family: 'Inter', sans-serif; font-weight: 500;
      border: 1.5px solid #E2E8F0; border-radius: 10px; background: white; color: #1E293B; outline: none; transition: all 0.2s;
    }
    .form-control:focus { border-color: rgba(16,185,129,0.5); box-shadow: 0 0 0 4px rgba(16,185,129,0.10); }

    .btn { padding: 10px 20px; border-radius: 10px; font-weight: 700; font-size: 13px; cursor: pointer; transition: all 0.2s; font-family: 'Inter', sans-serif; }
    .btn-primary { background: linear-gradient(135deg, #10B981, #059669); color: white; border: none; box-shadow: 0 4px 14px rgba(16,185,129,0.3); }
    .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 8px 20px rgba(16,185,129,0.4); }
    .btn-primary:disabled { background: #E2E8F0; color: #94A3B8; cursor: not-allowed; box-shadow: none; transform: none; }

    .btn-secondary { background: white; color: #64748B; border: 1.5px solid rgba(226,232,240,0.9); }
    .btn-secondary:hover:not(:disabled) { background: rgba(248,250,252,0.9); border-color: rgba(16,185,129,0.3); color: #10B981; }
    .btn-secondary:disabled { opacity: 0.5; cursor: not-allowed; }

  `]
})
export class PicMeetingComponent implements OnInit {
  router = inject(Router);
  projectService = inject(ProjectService);

  @Input() embeddedMode = false;
  @Input() projectId: string = '';
  @Input() projectData: any = {};
  @Output() formSubmitted = new EventEmitter<{ title: string; message: string }>();

  comments: string = '';

  currentSectionIndex = signal<number>(0);
  submittedStatus = signal<string | null>(null);
  sections = [
    { title: 'Strategic Alignment' },
    { title: 'Financials & ROI' },
    { title: 'Committee Decision' }
  ];

  ngOnInit() {
    if (this.embeddedMode) {
      return;
    }
    const state = history.state;
    if (state && state.projectId) {
      this.projectId = state.projectId;
      this.projectData = state.projectData || {};
    } else {
      this.cancel();
    }
  }

  setSection(index: number) { this.currentSectionIndex.set(index); }
  nextSection() { if (this.currentSectionIndex() < this.sections.length - 1) this.currentSectionIndex.update(i => i + 1); }
  previousSection() { if (this.currentSectionIndex() > 0) this.currentSectionIndex.update(i => i - 1); }

  submitDecision(decision: string) {
    this.projectService.submitDecision(this.projectId, 'PIC Meeting', decision, this.comments, {})
      .subscribe({
        next: () => {
          this.submittedStatus.set('completed');
          if (this.embeddedMode) {
            const approved = decision === 'Approve';
            this.formSubmitted.emit({
              title: approved ? 'PIC Approval Complete — Request Finished' : 'Initiative Deferred',
              message: approved
                ? 'The proposal has successfully completed the Project Investment Committee (PIC) review. Budget has been released and the project has moved to TRC Implementation Vetting.'
                : 'The initiative has been deferred by the PIC committee. The project owner has been notified.'
            });
          }
        },
        error: (err) => alert("Error submitting request.")
      });
  }

  cancel() { this.router.navigate(['/team-inbox']); }
  goBack() { this.cancel(); }
  goBackToDashboard() { this.router.navigate(['/dashboard']); }
}
