import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { EacRequestService } from '../../core/services/eac-request.service';
import { ProjectService } from '../../core/services/project.service';
import { AuthService } from '../../core/services/auth.service';
import { computed } from '@angular/core';
import { ConfirmationScreenComponent } from '../../shared/components/confirmation-screen/confirmation-screen.component';

@Component({
  selector: 'app-eac-meeting',
  standalone: true,
  imports: [CommonModule, FormsModule, ConfirmationScreenComponent],
  template: `
    <div class="animate-fade-in eac-container">
      @if (submittedStatus() === null) {
      
      <!-- Top Global Stepper -->
      <div class="global-stepper-container">
        <div class="global-stepper">
          <div class="global-step done">
            <span class="material-icons text-sm">check</span>
            <span class="g-step-label">Project Initiation</span>
          </div>
          <div class="g-step-line done"></div>
          <div class="global-step done">
            <span class="material-icons text-sm">check</span>
            <span class="g-step-label">Post Project Initiation</span>
          </div>
          <div class="g-step-line done"></div>
          <div class="global-step done">
            <span class="material-icons text-sm">check</span>
            <span class="g-step-label">Evaluation</span>
          </div>
          <div class="g-step-line done"></div>
          <div class="global-step active">
            <span class="g-step-label">Governance Review</span>
          </div>
          <div class="g-step-line"></div>
          <div class="global-step">
            <span class="g-step-label">Project Deployment</span>
          </div>
          <div class="g-step-line"></div>
          <div class="global-step">
            <span class="g-step-label">Post-Implementation Review</span>
          </div>
        </div>
      </div>

      <!-- Main Window Card -->
      <div class="eac-window-card mt-4">
        
        <!-- Header -->
        <div class="window-header flex justify-between items-center">
          <div class="window-title-group flex items-center gap-3">
            <div class="avatar-circle">EAC</div>
            <div>
              <h1 class="window-title">EAC Meeting</h1>
              <div class="text-xs text-muted mt-1">
                Assigned to <span class="text-primary font-medium">{{ projectData?.requestorName || 'Team' }}</span> • In {{ projectId() }} • Priority {{ projectData?.priority || 'Normal' }}
              </div>
            </div>
          </div>
          <div class="window-actions flex gap-2">
            <button type="button" class="win-btn" title="Link">Link</button>
            <button type="button" class="win-btn" title="Edit">✏️</button>
          </div>
        </div>

        <div class="eac-layout">
          
          <!-- Left Main Content Area -->
          <div class="main-form-area">
            
            <div class="flex justify-between items-center mb-4 border-b border-gray-200 pb-2">
              <h2 class="section-main-title">Enterprise Architecture Council Review</h2>
              <span class="smart-sheet-link flex items-center gap-1 cursor-pointer">
                Smart Sheet <span class="material-icons text-xs">open_in_new</span>
              </span>
            </div>
              
            <!-- STEP 1: Project Identification -->
            @if (currentSection() === 'identification') {
              <div class="form-section animate-fade-in">
                <h3 class="pane-title">Project Overview & Identification</h3>
                <div class="details-grid grid-2">
                  <div class="detail-group">
                    <label class="detail-label">Project Name</label>
                    <input type="text" class="form-control-static" readonly [value]="projectData?.projectName || ''">
                  </div>
                  <div class="detail-group">
                    <label class="detail-label">Requestor Name</label>
                    <input type="text" class="form-control-static" readonly [value]="projectData?.requestorName || ''">
                  </div>
                  <div class="detail-group">
                    <label class="detail-label">Requesting Department</label>
                    <input type="text" class="form-control-static" readonly [value]="projectData?.department || ''">
                  </div>
                  <div class="detail-group">
                    <label class="detail-label">Project Priority</label>
                    <input type="text" class="form-control-static" readonly [value]="projectData?.priority || ''">
                  </div>
                  <div class="detail-group">
                    <label class="detail-label">Project Type</label>
                    <input type="text" class="form-control-static" readonly [value]="projectData?.requestType || ''">
                  </div>
                  <div class="detail-group">
                    <label class="detail-label">Sponsor</label>
                    <input type="text" class="form-control-static" readonly [value]="projectData?.sponsorName || ''">
                  </div>
                  <div class="detail-group full-width">
                    <label class="detail-label">Problem Statement</label>
                    <textarea class="form-control-static textarea-static" readonly rows="2">{{ projectData?.problemStatement || '' }}</textarea>
                  </div>
                </div>
              </div>
            }

            <!-- STEP 2: Architecture & Technical Details -->
            @if (currentSection() === 'architecture') {
              <div class="form-section animate-fade-in">
                <h3 class="pane-title">Architecture & Technical Details</h3>
                <div class="details-grid">
                  <div class="detail-group full-width">
                    <label class="detail-label">Current State Architecture</label>
                    <div class="static-rich-text">{{ projectData?.currentStateArchitecture || 'Not Provided' }}</div>
                  </div>
                  <div class="detail-group full-width">
                    <label class="detail-label">Proposed Solution Overview</label>
                    <textarea class="form-control-static textarea-static" readonly rows="2">{{ projectData?.solutionOverview || 'Not Provided' }}</textarea>
                  </div>
                  <div class="detail-group full-width">
                    <label class="detail-label">Proposed Tech Stack</label>
                    <div class="static-rich-text">{{ projectData?.techStack || 'Not Provided' }}</div>
                  </div>
                </div>
              </div>
            }

            <!-- STEP 3: EAC Checklists -->
            @if (currentSection() === 'checklist') {
              <div class="form-section animate-fade-in">
                <h3 class="pane-title text-primary">EACGateway Details & Vetting</h3>
                <div class="card p-4 mb-6" style="border: 1px solid #DFE1E6; border-radius: 8px; background: #FAFBFC; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                  <h4 class="text-xs font-bold mb-3 uppercase tracking-wider text-muted">Design and Technical Vetting - EAC Checklist</h4>
                  <div class="table-container">
                    <table class="data-table">
                      <thead>
                        <tr>
                          <th style="width: 250px;">Checklist</th>
                          <th>Description</th>
                          <th style="width: 140px;">Review Status</th>
                          <th>Review Comments</th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (item of checklistItems(); track $index) {
                          <tr>
                            <td class="font-medium text-dark">{{ item.name }}</td>
                            <td class="text-sm text-muted">{{ item.desc }}</td>
                            <td>
                              <select [(ngModel)]="item.status" class="form-control">
                                <option value="--">--</option>
                                <option value="Approved">Approved</option>
                                <option value="Rejected">Rejected</option>
                                <option value="Conditional">Conditional</option>
                              </select>
                            </td>
                            <td>
                              <input type="text" [(ngModel)]="item.comments" placeholder="Add remarks..." class="form-control" />
                            </td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                </div>

                <div class="form-group full-width mt-6">
                  <label class="detail-label mb-2">EAC Meeting Notes / Transcript</label>
                  <textarea class="form-control" rows="4" [(ngModel)]="notesTranscript" placeholder="Enter meeting notes or transcript here..."></textarea>
                </div>
              </div>
            }

            <!-- STEP 4: Final Review -->
            @if (currentSection() === 'review') {
              <div class="form-section animate-fade-in">
                <h2 class="form-section-title text-success flex items-center gap-2">
                  <span class="material-icons">verified</span> Final Review & Approval
                </h2>
                <p class="text-sm text-muted mb-6">Review all project details and EAC vetting decisions before submitting your final approval.</p>
                
                <!-- Review Tabs (reused pattern) -->
                <div class="review-tabs">
                  <div class="review-tab" [class.active]="activeReviewTab() === 'project'" (click)="activeReviewTab.set('project')">Project Data</div>
                  <div class="review-tab" [class.active]="activeReviewTab() === 'vetting'" (click)="activeReviewTab.set('vetting')">EAC Vetting Results</div>
                </div>
                
                <div class="review-content-area p-4 border border-gray-200 rounded-md bg-gray-50">
                  @if (activeReviewTab() === 'project') {
                    <div class="review-data-grid">
                      <div class="review-data-card">
                        <div class="r-label">Project Name</div>
                        <div class="r-value">{{ projectData?.projectName || '—' }}</div>
                      </div>
                      <div class="review-data-card">
                        <div class="r-label">Department</div>
                        <div class="r-value">{{ projectData?.department || '—' }}</div>
                      </div>
                      <div class="review-data-card full-width-card">
                        <div class="r-label">Problem Statement</div>
                        <div class="r-value">{{ projectData?.problemStatement || '—' }}</div>
                      </div>
                      <div class="review-data-card full-width-card">
                        <div class="r-label">Technical Stack Proposed</div>
                        <div class="r-value">{{ projectData?.techStack || '—' }}</div>
                      </div>
                    </div>
                  } @else {
                    <div class="table-container shadow-sm">
                      <table class="data-table">
                        <thead>
                          <tr>
                            <th>Checklist Item</th>
                            <th>Decision Status</th>
                            <th>Comments</th>
                          </tr>
                        </thead>
                        <tbody>
                          @for (item of checklistItems(); track $index) {
                            <tr>
                              <td class="font-medium">{{ item.name }}</td>
                              <td>
                                <span class="badge" 
                                  [class.badge-success]="item.status === 'Approved'"
                                  [class.badge-warning]="item.status === 'Conditional'"
                                  [class.badge-danger]="item.status === 'Rejected'">
                                  {{ item.status }}
                                </span>
                              </td>
                              <td class="text-sm italic text-muted">{{ item.comments || 'No comment provided' }}</td>
                            </tr>
                          }
                        </tbody>
                      </table>
                    </div>
                    <div class="mt-4 p-4 bg-white border border-gray-200 rounded-md">
                      <div class="r-label">Meeting Notes/Transcript</div>
                      <div class="r-value mt-2">{{ notesTranscript || 'No meeting notes provided.' }}</div>
                    </div>
                  }
                </div>
              </div>
            }

            <!-- Bottom Action Footer -->
            <div class="eac-footer flex justify-between items-center mt-6 pt-4 border-t border-gray-200">
              <button type="button" class="btn btn-outline" (click)="cancel()">Cancel</button>
              
              <div class="flex items-center gap-3">
                @if (currentSectionIndex() === sections.length - 1) {
                  <button type="button" class="btn btn-warning-outline" (click)="deferProject()">Defer</button>
                  <button type="button" class="btn btn-info-outline" (click)="requestMoreInfo()">Request Clarification</button>
                }
                
                <button type="button" class="btn btn-outline" (click)="prevSection()" [disabled]="currentSectionIndex() === 0">Previous</button>
                <button type="button" class="btn btn-primary" (click)="nextSection()">
                  {{ currentSectionIndex() === sections.length - 1 ? 'Complete Approval' : 'Next' }}
                </button>
              </div>
            </div>

          </div>

          <!-- Right Sidebar Stepper -->
          <div class="right-stepper-area">
            <h3 class="text-xs font-bold text-muted uppercase tracking-wider mb-4">EAC Workflow</h3>
            <div class="vertical-stepper">
              @for (section of sections; track section.id; let i = $index) {
                <div class="v-step" 
                     [class.active]="currentSection() === section.id"
                     [class.completed]="i < currentSectionIndex()"
                     (click)="goToSection(section.id)">
                  <div class="v-step-indicator">
                    <span class="material-icons" *ngIf="i < currentSectionIndex()">check</span>
                  </div>
                  <div class="v-step-label">{{ section.label }}</div>
                </div>
              }
            </div>
          </div>

        </div>
      </div>
      } @else {
        <!-- Success Confirmation Screen -->
        <app-confirmation-screen
          [title]="successTitle()"
          [message]="successMessage()"
          [iconName]="successIcon()"
          [iconColor]="successIconColor()"
          [iconBg]="successIconBg()"
          returnLabel="Return to Projects"
          returnRoute="/dashboard">
          @if (isAdmin()) {
            <button type="button" class="btn flex items-center gap-2" (click)="adminOverridePic()" style="background: #00875A; color: #FFFFFF; border: none; font-weight: 600; padding: 12px 28px; border-radius: 10px; cursor: pointer;">
              <span class="material-icons text-sm">rocket_launch</span> Admin Override: PIC Prepare
            </button>
          }
        </app-confirmation-screen>
      }
    </div>
  `,
  styles: [`

    .eac-container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 24px;
      background-color: #F8FAFC;
      min-height: calc(100vh - 60px);
      font-family: 'Inter', sans-serif;
    }

    /* Global Horizontal Stepper */
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
      max-width: 900px;
      margin: 0 auto;
    }

    .global-step {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      font-weight: 600;
      color: #94A3B8;
    }
    .global-step.active {
      color: #1E293B;
      font-weight: 700;
    }
    .global-step.done {
      color: #059669;
    }
    .global-step .material-icons {
      background: #059669;
      color: white;
      border-radius: 50%;
      padding: 2px;
      font-size: 14px;
    }
    
    .g-step-line {
      flex: 1;
      height: 2px;
      background: #E2E8F0;
      margin: 0 12px;
      border-radius: 9999px;
    }
    .g-step-line.done {
      background: linear-gradient(90deg, #059669, #34D399);
    }

    /* Main Window */
    .eac-window-card {
      background: white;
      border: 1px solid rgba(226,232,240,0.8);
      border-radius: 18px;
      box-shadow: 0 4px 24px rgba(79,70,229,0.07);
      overflow: hidden;
      position: relative;
    }
    .eac-window-card::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 3px;
      background: linear-gradient(90deg, #4F46E5 0%, #7C3AED 50%, #06B6D4 100%);
    }

    .window-header {
      padding: 18px 28px;
      border-bottom: 1px solid rgba(226,232,240,0.6);
      background: rgba(248,250,252,0.5);
    }

    .avatar-circle {
      width: 40px; height: 40px;
      border-radius: 50%;
      background: linear-gradient(135deg, #4F46E5, #7C3AED);
      color: white;
      display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: 14px;
      box-shadow: 0 2px 8px rgba(79,70,229,0.3);
    }

    .window-title {
      font-size: 18px;
      font-weight: 800;
      color: #1E293B;
      margin: 0;
      font-family: 'Outfit', sans-serif;
    }

    .text-muted { color: #94A3B8; }
    .text-primary { color: #4F46E5; }
    .text-success { color: #059669; }

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
    }
    .win-btn:hover { background: rgba(238,242,255,0.6); border-color: rgba(79,70,229,0.3); color: #4F46E5; }

    /* Layout */
    .eac-layout {
      display: grid;
      grid-template-columns: 1fr 300px;
      min-height: 500px;
    }

    .main-form-area {
      padding: 28px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }

    .right-stepper-area {
      padding: 28px 24px;
      background: rgba(248,250,252,0.5);
      border-left: 1px solid rgba(226,232,240,0.5);
    }

    /* Form Styles */
    .section-main-title {
      font-size: 20px;
      font-weight: 800;
      color: #1E293B;
      margin: 0;
      font-family: 'Outfit', sans-serif;
    }
    
    .smart-sheet-link {
      font-size: 12px;
      font-weight: 600;
      color: #4F46E5;
      padding: 6px 12px;
      background: rgba(238,242,255,0.8);
      border-radius: 20px;
      transition: background 0.2s;
    }
    .smart-sheet-link:hover { background: #E0E7FF; }

    .pane-title {
      font-size: 15px;
      font-weight: 700;
      color: #1E293B;
      margin-bottom: 24px;
      padding-bottom: 12px;
      border-bottom: 1px solid rgba(226,232,240,0.6);
    }

    .details-grid {
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    .details-grid.grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
    }

    .detail-group { display: flex; flex-direction: column; gap: 6px; }
    .detail-group.full-width { grid-column: span 2; }

    .detail-label {
      font-size: 11px;
      font-weight: 700;
      color: #64748B;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .form-control-static {
      width: 100%;
      padding: 10px 14px;
      font-size: 13px;
      font-weight: 500;
      border: 1.5px solid #E2E8F0;
      border-radius: 10px;
      background-color: #F8FAFC;
      color: #1E293B;
      outline: none;
    }

    .textarea-static { resize: none; font-family: 'Inter', sans-serif; }

    .static-rich-text {
      padding: 14px 16px;
      border: 1.5px solid #E2E8F0;
      border-radius: 10px;
      background-color: #F8FAFC;
      color: #1E293B;
      font-size: 13px;
      line-height: 1.6;
      font-weight: 500;
      min-height: 60px;
      white-space: pre-wrap;
    }
    
    .form-control {
      width: 100%;
      padding: 10px 14px;
      font-size: 13px;
      font-weight: 500;
      border: 1.5px solid #E2E8F0;
      border-radius: 10px;
      background: white;
      color: #1E293B;
      outline: none;
      transition: all 0.2s;
    }
    .form-control:focus {
      border-color: rgba(79,70,229,0.5);
      box-shadow: 0 0 0 4px rgba(79,70,229,0.10);
    }

    /* Vertical Stepper */
    .vertical-stepper {
      display: flex;
      flex-direction: column;
      gap: 4px;
      position: relative;
    }
    .vertical-stepper::before {
      content: '';
      position: absolute;
      top: 16px; bottom: 16px;
      left: 19px;
      width: 2px;
      background: linear-gradient(180deg, #4F46E5 0%, rgba(226,232,240,0.4) 100%);
      z-index: 0;
    }

    .v-step {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 12px;
      border-radius: 10px;
      cursor: pointer;
      position: relative;
      z-index: 1;
      transition: all 0.2s;
    }
    .v-step:hover:not(.active) { background: rgba(238,242,255,0.5); }

    .v-step-indicator {
      width: 16px; height: 16px;
      border-radius: 50%;
      border: 2px solid #E2E8F0;
      background: white;
      display: flex; align-items: center; justify-content: center;
      transition: all 0.2s;
    }

    .v-step-label {
      font-size: 13px;
      font-weight: 500;
      color: #94A3B8;
    }

    .v-step.active {
      background: rgba(238,242,255,0.7);
    }
    .v-step.active .v-step-indicator {
      background: linear-gradient(135deg, #4F46E5, #7C3AED);
      border-color: #4F46E5;
      box-shadow: 0 0 0 3px rgba(79,70,229,0.2), 0 2px 8px rgba(79,70,229,0.35);
    }
    .v-step.active .v-step-label {
      color: #4F46E5;
      font-weight: 700;
    }

    .v-step.completed .v-step-indicator {
      background: #D1FAE5;
      border-color: #059669;
    }
    .v-step.completed .v-step-indicator .material-icons {
      font-size: 12px;
      color: #059669;
      font-weight: bold;
    }
    .v-step.completed .v-step-label { color: #64748B; }

    /* Tables */
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
    }
    .data-table th {
      background: rgba(248,250,252,0.9);
      padding: 12px 16px;
      text-align: left;
      font-size: 11px;
      font-weight: 700;
      color: #64748B;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      border-bottom: 1.5px solid rgba(226,232,240,0.8);
    }
    .data-table td {
      padding: 12px 16px;
      border-bottom: 1px solid rgba(226,232,240,0.5);
      vertical-align: middle;
      font-size: 13px;
      color: #1E293B;
    }
    .data-table tr:last-child td { border-bottom: none; }
    .data-table tbody tr:hover { background: rgba(238,242,255,0.3); }

    /* Tabs inside review */
    .review-tabs {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-bottom: 24px;
      border-bottom: 1px solid rgba(226,232,240,0.6);
      padding-bottom: 12px;
    }
    
    .review-tab {
      padding: 8px 16px;
      border-radius: 9999px;
      background: white;
      color: #64748B;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      border: 1.5px solid rgba(226,232,240,0.9);
      transition: all 0.2s;
    }
    .review-tab:hover { border-color: rgba(79,70,229,0.3); color: #4F46E5; }
    .review-tab.active {
      background: linear-gradient(135deg, #4F46E5, #7C3AED);
      color: white;
      border-color: transparent;
      box-shadow: 0 2px 8px rgba(79,70,229,0.3);
    }

    .review-data-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;
    }

    .review-data-card {
      background: white;
      border: 1.5px solid rgba(226,232,240,0.8);
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 2px 12px rgba(79,70,229,0.03);
    }
    .review-data-card.full-width-card {
      grid-column: 1 / -1;
      background: rgba(248,250,252,0.4);
    }

    .r-label {
      font-size: 11px;
      font-weight: 700;
      color: #64748B;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }

    .r-value {
      font-size: 14px;
      font-weight: 600;
      color: #1E293B;
      line-height: 1.6;
      white-space: pre-wrap;
    }

    /* Badges */
    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
    }
    .badge-success { background: #D1FAE5; color: #065F46; border: 1px solid #34D399; }
    .badge-warning { background: #FEF3C7; color: #92400E; border: 1px solid #FCD34D; }
    .badge-danger { background: #FEE2E2; color: #991B1B; border: 1px solid #F87171; }

    /* Buttons */
    .btn {
      padding: 10px 20px;
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
    }
    .btn-outline:hover { background: rgba(248,250,252,0.9); border-color: rgba(79,70,229,0.3); color: #4F46E5; }

    .btn-primary {
      background: linear-gradient(135deg, #4F46E5, #7C3AED);
      color: white;
      box-shadow: 0 4px 14px rgba(79,70,229,0.35);
    }
    .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 8px 20px rgba(79,70,229,0.45); }
    .btn-primary:disabled {
      background: #E2E8F0;
      color: #94A3B8;
      box-shadow: none;
      cursor: not-allowed;
      transform: none;
    }

    .btn-warning-outline {
      background: transparent;
      border: 1.5px solid #F59E0B;
      color: #D97706;
    }
    .btn-warning-outline:hover { background: #FEF3C7; }

    .btn-info-outline {
      background: transparent;
      border: 1.5px solid #3B82F6;
      color: #2563EB;
    }
    .btn-info-outline:hover { background: #DBEAFE; }
    
    .eac-footer {
      border-top: 1px solid rgba(226,232,240,0.6);
      padding-top: 24px;
    }

  `]
})
export class EacMeetingComponent {
  private router = inject(Router);
  private eacRequestService = inject(EacRequestService);
  private projectService = inject(ProjectService);
  private authService = inject(AuthService);

  projectId = signal('');
  projectData: any = {};
  isAdmin = computed(() => this.authService.hasRole('admin'));

  sections = [
    { id: 'identification', label: 'Project Review' },
    { id: 'architecture', label: 'Architecture & Details' },
    { id: 'checklist', label: 'EAC Vetting (Checklists)' },
    { id: 'review', label: 'Final Review' }
  ];

  currentSectionIndex = signal(0);
  activeReviewTab = signal('project');

  currentSection() {
    return this.sections[this.currentSectionIndex()].id;
  }

  checklistItems = signal([
    { name: 'Architecture feasibility', desc: 'Review architecture diagrams & integration points', status: '--', comments: '' },
    { name: 'Tech stack approval', desc: 'Ensure selected technology aligns with EA standards', status: '--', comments: '' },
    { name: 'Risk identification', desc: 'Identify architectural or scalability risks', status: '--', comments: '' },
    { name: 'Roadmap alignment', desc: 'Check alignment with long-term enterprise roadmap', status: '--', comments: '' }
  ]);

  notesTranscript = '';
  submittedStatus = signal<'approved' | 'deferred' | 'clarification' | null>(null);

  successTitle = computed(() => {
    const s = this.submittedStatus();
    if (s === 'approved') return 'EAC Review Completed Successfully!';
    if (s === 'deferred') return 'EAC Alignment Deferred';
    if (s === 'clarification') return 'Clarification Requested';
    return '';
  });
  successMessage = computed(() => {
    const s = this.submittedStatus();
    if (s === 'approved') return 'The proposal has successfully completed the Enterprise Architecture Committee (EAC) review and is ready for PIC preparation.';
    if (s === 'deferred') return `Project ${this.projectId()} has been marked as Deferred.`;
    if (s === 'clarification') return 'A request for clarification has been dispatched to the project owner.';
    return '';
  });
  successIcon = computed(() => {
    const s = this.submittedStatus();
    if (s === 'deferred') return 'pause_circle';
    if (s === 'clarification') return 'info';
    return 'check_circle';
  });
  successIconColor = computed(() => {
    const s = this.submittedStatus();
    if (s === 'deferred') return '#FFAB00';
    if (s === 'clarification') return '#0052CC';
    return '#36B37E';
  });
  successIconBg = computed(() => {
    const s = this.submittedStatus();
    if (s === 'deferred') return '#FFF0B3';
    if (s === 'clarification') return '#DEEBFF';
    return '#E3FCEF';
  });

  constructor() {
    const state = history.state;
    if (state && state.projectData) {
      this.projectData = state.projectData;
      if (state.projectId) {
        this.projectId.set(state.projectId);
      }
    }
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
      // Completed, Submit!
      this.approveProject();
    }
  }

  approveProject() {
    this.projectService.submitDecision(this.projectId(), 'EAC Committee Review', 'Approve', 'Approved by EAC', {
      checklist: this.checklistItems(),
      notes: this.notesTranscript
    }).subscribe({
      next: () => {
        alert('EAC Governance Approval Completed successfully.');
        this.eacRequestService.refreshRequests();
        this.submittedStatus.set('approved');
      },
      error: (err) => alert('Failed to approve project')
    });
  }

  requestMoreInfo() {
    this.projectService.submitDecision(this.projectId(), 'EAC Committee Review', 'Return for Clarification', 'EAC requires more information', {
      notes: this.notesTranscript
    }).subscribe({
      next: () => {
        this.eacRequestService.refreshRequests();
        this.submittedStatus.set('clarification');
      },
      error: (err) => console.error('Failed to request more info', err)
    });
  }

  deferProject() {
    this.projectService.submitDecision(this.projectId(), 'EAC Committee Review', 'Defer', 'EAC deferred the project review', {
      notes: this.notesTranscript
    }).subscribe({
      next: () => {
        this.eacRequestService.refreshRequests();
        this.submittedStatus.set('deferred');
      },
      error: (err) => console.error('Failed to defer project', err)
    });
  }

  cancel() {
    this.router.navigate(['/team-inbox']);
  }

  goBackToDashboard() {
    this.router.navigate(['/dashboard']);
  }

  goBackToTeamInbox() {
    this.router.navigate(['/team-inbox']);
  }

  adminOverridePic(): void {
    const formData = this.projectData || {};

    this.router.navigate(['/prepare-pic'], {
      state: {
        projectData: {
          name: formData.projectName,
          dept: formData.department,
          problemStatement: formData.problemStatement,
          scope: formData.desiredOutcome
        },
        projectId: this.projectId(),
        fromAdminOverride: true
      }
    });
  }
}
