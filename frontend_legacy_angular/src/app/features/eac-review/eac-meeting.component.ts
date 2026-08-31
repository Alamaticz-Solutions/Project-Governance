import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { EacRequestService } from '../../core/services/eac-request.service';
import { ProjectService } from '../../core/services/project.service';
import { AuthService } from '../../core/services/auth.service';
import { computed } from '@angular/core';

@Component({
  selector: 'app-eac-meeting',
  standalone: true,
  imports: [CommonModule, FormsModule],
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
        <div class="success-screen animate-fade-in flex flex-col items-center justify-center py-16 text-center" style="max-width: 650px; margin: 40px auto; padding: 40px; background: #FFFFFF; border: 1px solid #DFE1E6; border-radius: 8px; box-shadow: 0 4px 12px rgba(9, 30, 66, 0.08);">
          
          @if (submittedStatus() === 'approved') {
            <div class="success-icon-wrapper mb-6" style="width: 80px; height: 80px; border-radius: 50%; background: #E3FCEF; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px;">
              <span class="material-icons text-success" style="font-size: 48px; color: #36B37E;">check_circle</span>
            </div>
            <h2 class="text-2xl font-bold text-dark mb-2" style="color: #172B4D; font-size: 24px; margin-bottom: 8px;">EAC Review Completed Successfully!</h2>
            <p class="text-muted max-w-md mb-8" style="color: #6B778C; font-size: 15px; line-height: 1.5; margin-bottom: 24px;">
              The proposal has successfully completed the Enterprise Architecture Committee (EAC) review and is ready for PIC preparation.
            </p>
          } @else if (submittedStatus() === 'deferred') {
            <div class="success-icon-wrapper mb-6" style="width: 80px; height: 80px; border-radius: 50%; background: #FFF0B3; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px;">
              <span class="material-icons text-warning" style="font-size: 48px; color: #FFAB00;">pause_circle</span>
            </div>
            <h2 class="text-2xl font-bold text-dark mb-2" style="color: #172B4D; font-size: 24px; margin-bottom: 8px;">EAC Alignment Deferred</h2>
            <p class="text-muted max-w-md mb-8" style="color: #6B778C; font-size: 15px; line-height: 1.5; margin-bottom: 24px;">
              Project <strong>{{ projectId() }}</strong> has been marked as <strong>Deferred</strong>.
            </p>
          } @else if (submittedStatus() === 'clarification') {
            <div class="success-icon-wrapper mb-6" style="width: 80px; height: 80px; border-radius: 50%; background: #DEEBFF; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px;">
              <span class="material-icons text-info" style="font-size: 48px; color: #0052CC;">info</span>
            </div>
            <h2 class="text-2xl font-bold text-dark mb-2" style="color: #172B4D; font-size: 24px; margin-bottom: 8px;">Clarification Requested</h2>
            <p class="text-muted max-w-md mb-8" style="color: #6B778C; font-size: 15px; line-height: 1.5; margin-bottom: 24px;">
              A request for clarification has been dispatched to the project owner.
            </p>
          }

          <div class="flex gap-4 justify-center" style="display: flex; gap: 16px; justify-content: center;">
            <button type="button" class="btn btn-outline" (click)="goBackToDashboard()" style="padding: 10px 20px; border: 1px solid #DFE1E6; border-radius: 4px; background: #FFFFFF; color: #505F79; font-weight: 600; cursor: pointer;">Return to Projects</button>
            @if (isAdmin()) {
              <button type="button" class="btn flex items-center gap-2" (click)="adminOverridePic()" style="background: #00875A; color: #FFFFFF; border: none; font-weight: 600; padding: 10px 20px; border-radius: 6px;">
                <span class="material-icons text-sm">rocket_launch</span> Admin Override: PIC Prepare
              </button>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .eac-container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 16px;
      background-color: #F8FAFC;
      min-height: calc(100vh - 60px);
    }

    /* Global Horizontal Stepper */
    .global-stepper-container {
      background: transparent;
      padding: 10px 0;
      width: 100%;
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
      gap: 6px;
      font-size: 13px;
      font-weight: 500;
      color: #8C98A4;
      
      &.active {
        color: #172B4D;
        font-weight: 700;
      }
      &.done {
        color: #36B37E;
      }
    }
    
    .g-step-line {
      flex: 1;
      height: 1px;
      background: #DFE1E6;
      margin: 0 12px;
      &.done {
        background: #36B37E;
      }
    }

    /* Main Window */
    .eac-window-card {
      background: #FFFFFF;
      border: 1px solid #DFE1E6;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
      overflow: hidden;
    }

    .window-header {
      padding: 16px 24px;
      border-bottom: 1px solid #EBECF0;
      background: #FFFFFF;
    }

    .avatar-circle {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: #4C9AFF;
      color: #FFF;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 14px;
    }

    .window-title {
      font-size: 16px;
      font-weight: 600;
      color: #172B4D;
      margin: 0;
    }

    .win-btn {
      padding: 4px 8px;
      border: 1px solid #DFE1E6;
      background: #FFF;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      color: #505F79;
      &:hover { background: #F4F5F7; }
    }

    /* Layout */
    .eac-layout {
      display: grid;
      grid-template-columns: 1fr 300px;
      min-height: 500px;
    }

    .main-form-area {
      padding: 24px;
      border-right: 1px solid #EBECF0;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }

    .right-stepper-area {
      padding: 32px 24px;
      background: #FAFBFC;
    }

    /* Form Styles */
    .form-section-title {
      font-size: 18px;
      font-weight: 700;
      color: #172B4D;
      margin-bottom: 20px;
      margin-top: 0;
    }

    .pane-title {
      font-size: 16px;
      font-weight: 700;
      color: #172B4D;
      margin-bottom: 20px;
      border-bottom: 1px dashed #DFE1E6;
      padding-bottom: 8px;
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

    .detail-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .detail-group.full-width {
      grid-column: span 2;
    }

    .detail-label {
      font-size: 12px;
      font-weight: 700;
      color: #505F79;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .form-control-static {
      width: 100%;
      padding: 10px 14px;
      font-size: 14px;
      border: 1px solid #DFE1E6;
      border-radius: 6px;
      background-color: #FAFBFC;
      color: #172B4D;
      font-weight: 500;
      outline: none;
    }

    .textarea-static {
      resize: none;
      font-family: inherit;
    }

    .static-rich-text {
      padding: 12px 16px;
      border: 1px solid #DFE1E6;
      border-radius: 6px;
      background-color: #FAFBFC;
      color: #172B4D;
      font-size: 14px;
      line-height: 1.6;
      font-weight: 500;
      min-height: 60px;
      white-space: pre-wrap;
    }
    
    .form-control {
      width: 100%;
      padding: 8px 12px;
      font-size: 14px;
      border: 1px solid #DFE1E6;
      border-radius: 4px;
      outline: none;
      transition: all 0.2s;
      
      &:focus {
        border-color: #4C9AFF;
        box-shadow: 0 0 0 2px rgba(76, 154, 255, 0.2);
      }
    }

    /* Vertical Stepper */
    .vertical-stepper {
      display: flex;
      flex-direction: column;
      gap: 0;
    }

    .v-step {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 16px 12px;
      border-radius: 8px;
      cursor: pointer;
      position: relative;
      transition: all 0.2s;

      /* Connecting lines */
      &:not(:last-child)::after {
        content: '';
        position: absolute;
        left: 23px; /* Center of the 24px indicator circle */
        top: 40px; /* Start below the current indicator */
        bottom: -8px; /* Extend into the next step */
        width: 2px;
        background: #DFE1E6;
        z-index: 1;
      }

      &:hover {
        background: #EBECF0;
      }

      &.active {
        background: #E3FCEF;
        .v-step-indicator {
          background: #36B37E;
          border-color: #36B37E;
          box-shadow: 0 0 0 4px rgba(54, 179, 126, 0.2);
        }
        .v-step-label {
          color: #172B4D;
          font-weight: 700;
        }
      }

      &.completed {
        .v-step-indicator {
          background: #0052CC;
          border-color: #0052CC;
          color: #FFF;
          .material-icons {
            font-size: 14px;
            font-weight: bold;
          }
        }
        &::after {
          background: #0052CC; /* Blue contiguous line for completed steps */
        }
      }
    }

    .v-step-indicator {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      border: 2px solid #C1C7D0;
      background: #FFFFFF;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2; /* Keep above the line */
      margin-top: -2px; /* Align precisely */
    }

    .v-step-label {
      font-size: 14px;
      font-weight: 500;
      color: #505F79;
      line-height: 1.4;
    }

    /* Tables */
    .table-container {
      border: 1px solid #DFE1E6;
      border-radius: 6px;
      overflow: hidden;
      background: #FFF;
    }

    .data-table {
      width: 100%;
      border-collapse: collapse;

      th {
        background: #FAFBFC;
        padding: 12px 16px;
        text-align: left;
        font-size: 12px;
        font-weight: 700;
        color: #505F79;
        text-transform: uppercase;
        border-bottom: 1px solid #DFE1E6;
      }

      td {
        padding: 12px 16px;
        border-bottom: 1px solid #EBECF0;
        vertical-align: middle;
        font-size: 14px;
        color: #172B4D;
      }
      
      tr:last-child td {
        border-bottom: none;
      }
    }

    /* Tabs inside review */
    .review-tabs {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 16px;
      border-bottom: 1px solid #DFE1E6;
      padding-bottom: 8px;
    }
    
    .review-tab {
      padding: 6px 12px;
      border-radius: 16px;
      background: #FAFBFC;
      color: #505F79;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      border: 1px solid #DFE1E6;
      transition: all 0.2s;
      
      &:hover { background: #EBECF0; }
      &.active {
        background: #0052CC;
        color: #FFFFFF;
        border-color: #0052CC;
      }
    }

    .review-data-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
    }

    .review-data-card {
      background: #FFFFFF;
      border: 1px solid #DFE1E6;
      border-radius: 8px;
      padding: 16px;
      
      &.full-width-card {
        grid-column: 1 / -1;
        background: #FAFBFC;
      }
    }

    .r-label {
      font-size: 11px;
      font-weight: 700;
      color: #6B778C;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 6px;
    }

    .r-value {
      font-size: 14px;
      font-weight: 600;
      color: #172B4D;
      line-height: 1.5;
      white-space: pre-wrap;
    }

    /* Badges */
    .badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
    }

    .badge-success { background: #E3FCEF; color: #006644; border: 1px solid #ABF5D1; }
    .badge-warning { background: #FFF0B3; color: #974F0C; border: 1px solid #FFC400; }
    .badge-danger { background: #FFEBE6; color: #BF2600; border: 1px solid #FF8F73; }

    /* Buttons */
    .btn {
      padding: 8px 16px;
      border-radius: 4px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      outline: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .btn-outline {
      background: #FFFFFF;
      border: 1px solid #DFE1E6;
      color: #505F79;
      
      &:hover {
        background: #F4F5F7;
      }
    }

    .btn-primary {
      background: #0052CC;
      border: 1px solid #0052CC;
      color: #FFFFFF;
      
      &:hover {
        background: #0047B3;
      }
      
      &:disabled {
        background: #DFE1E6;
        border-color: #DFE1E6;
        color: #97A0AF;
        cursor: not-allowed;
      }
    }

    .btn-warning-outline {
      background: transparent;
      border: 1px solid #FFAB00;
      color: #FF8B00;
      &:hover { background: #FFF0B3; }
    }

    .btn-info-outline {
      background: transparent;
      border: 1px solid #4C9AFF;
      color: #0052CC;
      &:hover { background: #DEEBFF; }
    }

    .text-primary { color: #0052CC; }
    .text-success { color: #36B37E; }
    .text-muted { color: #6B778C; }
    .font-medium { font-weight: 500; }
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
