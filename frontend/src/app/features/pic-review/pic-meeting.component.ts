import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ProjectService } from '../../core/services/project.service';

@Component({
  selector: 'app-pic-meeting',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="stepper-layout animate-fade-in">
      <!-- HEADER -->
      <div class="stepper-header">
        <button class="back-btn" (click)="goBack()">
          <span class="material-icons">arrow_back</span>
        </button>
        <div class="header">
        <h1 class="title">PIC Meeting</h1>
        <p class="subtitle">Reviewing <span class="assigned-user">{{ projectData?.requestorName || 'Unknown' }}</span>'s Proposal • ID: {{ projectId }}</p>
      </div>

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
                      <span class="info-value">{{ projectData.name }}</span>
                    </div>
                    <div class="info-item">
                      <span class="info-label">Department</span>
                      <span class="info-value">{{ projectData.dept }}</span>
                    </div>
                    <div class="info-item">
                      <span class="info-label">Strategic Category</span>
                      <span class="info-value">{{ projectData.priority | uppercase }} Priority</span>
                    </div>
                  </div>
                  
                  <h4 class="mt-6 mb-2 text-sm font-bold text-gray-700">Business Value Summary</h4>
                  <div class="read-only-box">{{ projectData.problemStatement || 'Business justification prepared...' }}</div>
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
                      <span class="info-label">Estimated ROI</span>
                      <span class="info-value" style="color:#00875A">Pending</span>
                    </div>
                  </div>
                  <h4 class="mt-6 mb-2 text-sm font-bold text-gray-700">Financial Comments</h4>
                  <div class="read-only-box">Reviewed standard capex vs opex split. Internal rate of return meets threshold.</div>
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
      } @else {
        <!-- Success Confirmation Screen -->
        <div class="success-screen animate-fade-in flex flex-col items-center justify-center py-16 text-center" style="max-width: 650px; margin: 40px auto; padding: 40px; background: #FFFFFF; border: 1px solid #DFE1E6; border-radius: 8px; box-shadow: 0 4px 12px rgba(9, 30, 66, 0.08);">
          <div class="success-icon-wrapper mb-6" style="width: 80px; height: 80px; border-radius: 50%; background: #E3FCEF; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px;">
            <span class="material-icons text-success" style="font-size: 48px; color: #36B37E;">check_circle</span>
          </div>
          <h2 class="text-2xl font-bold text-dark mb-2" style="color: #172B4D; font-size: 24px; margin-bottom: 8px;">PIC Review Completed Successfully!</h2>
          <p class="text-muted max-w-md mb-8" style="color: #6B778C; font-size: 15px; line-height: 1.5; margin-bottom: 24px;">
            The proposal has successfully completed the Project Investment Committee (PIC) review.
          </p>
          <div class="flex justify-center" style="display: flex; justify-content: center;">
            <button type="button" class="btn btn-outline" (click)="goBackToDashboard()" style="padding: 10px 20px; border: 1px solid #DFE1E6; border-radius: 4px; background: #FFFFFF; color: #505F79; font-weight: 600; cursor: pointer;">Return to Projects</button>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .page-container { max-width: 1200px; margin: 0 auto; padding: 24px; }
    .header { margin-bottom: 24px; border-bottom: 1px solid #EBECF0; padding-bottom: 16px; }
    .title { margin: 0; font-size: 24px; font-weight: 700; color: #172B4D; letter-spacing: -0.5px; }
    .subtitle { margin: 4px 0 0; font-size: 13px; color: #6B778C; }
    .assigned-user { color: #0052CC; font-weight: 600; }

    .layout-body { display: grid; grid-template-columns: 1fr 340px; gap: 24px; align-items: start; }
    .content-panel { min-height: 500px; display: flex; flex-direction: column; }
    
    .section-header { padding: 16px 24px; border-bottom: 1px solid #EBECF0; background: #FAFBFC; border-radius: 12px 12px 0 0; }
    .section-header h3 { margin: 0; font-size: 16px; font-weight: 600; color: #172B4D; }
    .section-footer { border-top: 1px solid #EBECF0; background: #fff; border-radius: 0 0 12px 12px; }

    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    .info-item { display: flex; flex-direction: column; gap: 6px; }
    .info-label { font-size: 11px; text-transform: uppercase; font-weight: 700; color: #6B778C; letter-spacing: 0.5px; }
    .info-value { font-size: 14px; font-weight: 600; color: #172B4D; }
    .read-only-box { padding: 12px 16px; background: #F4F5F7; border-radius: 6px; color: #42526E; font-size: 13px; line-height: 1.5; }

    .sidebar-panel { position: sticky; top: 24px; }
    .sidebar-title { font-size: 14px; font-weight: 700; color: #172B4D; margin: 0 0 16px 0; padding-bottom: 12px; border-bottom: 1px solid #EBECF0; }

    .vertical-stepper { list-style: none; padding: 0; margin: 0; position: relative; }
    .vertical-stepper::before { content: ''; position: absolute; top: 12px; bottom: 30px; left: 11px; width: 2px; background: #DFE1E6; z-index: 1; }
    
    .step-item { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 24px; cursor: pointer; position: relative; z-index: 2; opacity: 0.6; transition: all 200ms; }
    .step-item:hover, .step-item.active, .step-item.completed { opacity: 1; }
    .step-indicator { width: 24px; height: 24px; border-radius: 50%; background: #fff; border: 2px solid #DFE1E6; display: flex; align-items: center; justify-content: center; transition: all 300ms; }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: transparent; }
    .step-item.active .step-indicator { border-color: #00875A; }
    .step-item.active .dot { background: #00875A; }
    .step-item.active .step-title { color: #00875A; font-weight: 700; }
    .step-item.completed .step-indicator { background: #0052CC; border-color: #0052CC; color: #fff; }
    .step-title { font-size: 14px; font-weight: 500; color: #42526E; margin-top: 2px; }

    .btn { padding: 8px 16px; border-radius: 6px; font-weight: 600; font-size: 14px; cursor: pointer; transition: all 200ms; }
    .btn-primary { background: #0052CC; color: #fff; border: none; }
    .btn-primary:hover { background: #0047B3; }
    .btn-secondary { background: #F4F5F7; color: #42526E; border: none; }
    .btn-secondary:hover { background: #EBECF0; color: #172B4D; }
  `]
})
export class PicMeetingComponent {
  router = inject(Router);
  projectService = inject(ProjectService);
  
  projectId: string = '';
  projectData: any = {};
  comments: string = '';
  
  currentSectionIndex = signal<number>(0);
  submittedStatus = signal<string | null>(null);
  sections = [
    { title: 'Strategic Alignment' },
    { title: 'Financials & ROI' },
    { title: 'Committee Decision' }
  ];

  constructor() {
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
        },
        error: (err) => alert("Error submitting request.")
      });
  }
  
  cancel() { this.router.navigate(['/team-inbox']); }
  goBack() { this.cancel(); }
  goBackToDashboard() { this.router.navigate(['/dashboard']); }
}
