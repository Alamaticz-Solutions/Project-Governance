import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-knowledge-base',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="animate-fade-in">
      <div class="page-header">
        <h1 class="page-title">Knowledge Base</h1>
        <p class="page-subtitle">Governance templates, policies, standards, and past decisions</p>
      </div>

      <!-- Hero Search -->
      <div class="kb-hero card mb-6">
        <div class="card-body" style="padding:40px;text-align:center">
          <h2 style="font-family:'Outfit';font-size:28px;font-weight:800;color:#172B4D;margin-bottom:8px">
            Find Governance Resources
          </h2>
          <p class="text-muted mb-6">Search templates, policies, committee guidelines, and past decisions</p>
          <div class="kb-search">
            <span class="material-icons">search</span>
            <input type="text" class="kb-input" placeholder="e.g. EAC Architecture Review, HIPAA checklist, CAB RFC guide..."
                   [(ngModel)]="searchTerm" />
            <button class="btn btn-primary">Search</button>
          </div>
          <!-- Quick Links -->
          <div class="quick-links">
            @for (chip of quickLinks; track chip) {
              <button class="chip" (click)="searchTerm = chip">{{ chip }}</button>
            }
          </div>
        </div>
      </div>

      <!-- Categories Grid -->
      <div class="kb-grid">
        @for (cat of categories; track cat.title) {
          <div class="card kb-category-card">
            <div class="card-header">
              <div class="flex items-center gap-3">
                <div class="cat-icon" [style.background]="cat.iconBg">
                  <span class="material-icons" [style.color]="cat.iconColor">{{ cat.icon }}</span>
                </div>
                <div>
                  <h3 style="font-size:15px">{{ cat.title }}</h3>
                  <div class="text-xs text-muted">{{ cat.count }} resources</div>
                </div>
              </div>
            </div>
            <div class="card-body" style="padding:16px">
              <ul style="list-style:none;display:flex;flex-direction:column;gap:8px">
                @for (doc of cat.docs; track doc.title) {
                  <li>
                    <a href="#" class="doc-link" (click)="$event.preventDefault()">
                      <span class="material-icons doc-icon">{{ doc.icon }}</span>
                      <span>{{ doc.title }}</span>
                      <span class="material-icons arrow">chevron_right</span>
                    </a>
                  </li>
                }
              </ul>
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .kb-hero { background: linear-gradient(135deg, #F7F8FC, #E3F0FF); }
    .mb-6 { margin-bottom: 24px; }

    .kb-search {
      display: flex;
      align-items: center;
      gap: 12px;
      background: #fff;
      border: 2px solid #DFE3ED;
      border-radius: 12px;
      padding: 12px 20px;
      max-width: 640px;
      margin: 0 auto 20px;
      box-shadow: 0 2px 8px rgba(9,30,66,0.08);
      transition: all 200ms;

      &:focus-within {
        border-color: #0052CC;
        box-shadow: 0 0 0 4px rgba(0,82,204,0.12);
      }

      .material-icons { font-size: 22px; color: #97A0AF; }
    }

    .kb-input {
      flex: 1;
      border: none;
      outline: none;
      font-size: 15px;
      color: #172B4D;
      font-family: 'Inter', sans-serif;
      &::placeholder { color: #97A0AF; }
    }

    .quick-links {
      display: flex;
      gap: 8px;
      justify-content: center;
      flex-wrap: wrap;
    }

    .chip {
      padding: 5px 16px;
      background: rgba(0,82,204,0.08);
      color: #0052CC;
      border: 1px solid rgba(0,82,204,0.2);
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      font-family: 'Inter', sans-serif;
      transition: all 200ms;

      &:hover { background: #0052CC; color: #fff; }
    }

    .kb-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;

      @media (max-width: 1100px) { grid-template-columns: repeat(2, 1fr); }
      @media (max-width: 700px)  { grid-template-columns: 1fr; }
    }

    .kb-category-card { transition: all 200ms; &:hover { box-shadow: 0 8px 24px rgba(9,30,66,0.12); transform: translateY(-2px); } }

    .cat-icon {
      width: 44px;
      height: 44px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      .material-icons { font-size: 22px; }
    }

    .doc-link {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 10px;
      border-radius: 6px;
      color: #344563;
      text-decoration: none;
      font-size: 13px;
      font-weight: 500;
      transition: all 200ms;

      &:hover { background: #E3F0FF; color: #0052CC; .arrow { opacity: 1; } }
    }

    .doc-icon { font-size: 16px !important; color: #0052CC; flex-shrink: 0; }
    .arrow { font-size: 16px !important; margin-left: auto; opacity: 0; transition: opacity 200ms; }
  `]
})
export class KnowledgeBaseComponent {
  searchTerm = '';
  quickLinks = ['TAF Process', 'EAC Standards', 'CAB Requirements', 'HIPAA Baseline', 'Service Transition', 'VCR Checklist'];

  categories = [
    {
      title: 'Governance Committees',
      icon: 'groups', iconBg: '#E3F0FF', iconColor: '#0052CC', count: 12,
      docs: [
        { title: 'TAF Intake Template',      icon: 'description' },
        { title: 'EAC Review Process',       icon: 'account_tree' },
        { title: 'PIC Decision Framework',   icon: 'gavel' },
        { title: 'CAB RFC Guide',            icon: 'checklist' },
      ]
    },
    {
      title: 'Security & Compliance',
      icon: 'security', iconBg: '#FFEBE6', iconColor: '#DE350B', count: 8,
      docs: [
        { title: 'ISO 27001 Baseline',       icon: 'verified_user' },
        { title: 'HIPAA Data Classification', icon: 'health_and_safety' },
        { title: 'Vendor SRA Checklist',     icon: 'fact_check' },
        { title: 'Security Review SLA',      icon: 'schedule' },
      ]
    },
    {
      title: 'Architecture Standards',
      icon: 'architecture', iconBg: '#E3FCEF', iconColor: '#00875A', count: 10,
      docs: [
        { title: 'Buy vs. Build Matrix',     icon: 'compare' },
        { title: 'Cloud Strategy Guide',     icon: 'cloud' },
        { title: 'VLAN Tier Standards',      icon: 'device_hub' },
        { title: 'API Integration Patterns', icon: 'api' },
      ]
    },
    {
      title: 'Project Templates',
      icon: 'folder_special', iconBg: '#FFF4D6', iconColor: '#FF8B00', count: 9,
      docs: [
        { title: 'Project Charter Template', icon: 'assignment' },
        { title: 'Service Transition Runbook', icon: 'menu_book' },
        { title: 'ROM Worksheet',            icon: 'calculate' },
        { title: 'Lessons Learned Log',      icon: 'lightbulb' },
      ]
    },
    {
      title: 'Vendor Management',
      icon: 'business', iconBg: '#F3E8FF', iconColor: '#7B2FF7', count: 7,
      docs: [
        { title: 'VCR Submission Guide',     icon: 'send' },
        { title: 'TPRM Risk Criteria',       icon: 'warning' },
        { title: 'BAA Template',             icon: 'handshake' },
        { title: 'Vendor Onboarding Checklist', icon: 'playlist_add_check' },
      ]
    },
    {
      title: 'Past Decisions',
      icon: 'history', iconBg: '#E8F5E9', iconColor: '#2E7D32', count: 24,
      docs: [
        { title: 'EAC: Epic Integration Decision', icon: 'record_voice_over' },
        { title: 'TAF: Multi-Cloud Strategy',   icon: 'cloud_done' },
        { title: 'PIC: Q3 2026 Approvals',       icon: 'approval' },
        { title: 'ITSC: Storage Policy Update',  icon: 'storage' },
      ]
    },
  ];
}
