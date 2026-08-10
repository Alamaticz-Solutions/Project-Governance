import { Component, Input, OnChanges, SimpleChanges, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GatewayChecklistService, GatewayChecklistItem } from '../../../core/services/gateway-checklist.service';

@Component({
  selector: 'app-gateway-checklist',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="relative">

      @if (loading()) {
        <div class="py-10 text-center text-[13px] font-semibold text-slate-400">Loading checklist…</div>
      } @else if (error()) {
        <div class="py-10 text-center text-[13px] font-semibold text-rose-400">{{ error() }}</div>
      } @else if (items().length === 0) {
        <div class="py-10 text-center text-[13px] font-semibold text-slate-400">No checklist items configured for {{ gateOwner }} yet.</div>
      } @else {
        <div class="premium-card overflow-hidden">
          <table class="premium-table relative z-10">
            <thead>
              <tr>
                <th style="width: 56px;">S.No</th>
                <th>Gate Name</th>
                <th>Checklist Item</th>
                <th>Description</th>
                <th style="width: 140px;">Is Completed?</th>
                <th style="width: 150px;">Completion Date</th>
                <th style="width: 80px;"></th>
              </tr>
            </thead>
            <tbody>
              @for (item of items(); track item.result_id; let i = $index) {
                <tr>
                  <td class="font-semibold text-slate-300">{{ i + 1 }}</td>
                  <td class="font-medium text-slate-300">{{ item.gate_name }}</td>
                  <td class="font-bold text-slate-100">{{ item.checklist_item }}</td>
                  <td class="text-slate-400">{{ item.gate_description || '—' }}</td>
                  <td>
                    <span class="text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide border"
                          [ngClass]="{
                            'bg-emerald-500/10 text-emerald-300 border-emerald-500/30': item.status === 'Approved',
                            'bg-rose-500/10 text-rose-300 border-rose-500/30': item.status === 'Not Approved',
                            'bg-white/5 text-slate-400 border-white/10': item.status === 'Pending'
                          }">
                      {{ item.status }}
                    </span>
                  </td>
                  <td class="text-slate-400">{{ item.completion_date ? (item.completion_date | date:'MMM d, y') : '—' }}</td>
                  <td class="text-right">
                    @if (item.can_edit) {
                      <button type="button" class="text-[12px] font-bold px-3 py-1.5 rounded-lg transition-colors bg-indigo-500/15 text-indigo-300 hover:bg-indigo-500/25"
                              (click)="openEdit(item)">
                        Edit
                      </button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      @if (editing()) {
        <div class="fixed inset-0 flex items-center justify-center z-50" style="background: rgba(2,6,23,0.6);" (click)="closeEdit()">
          <div class="premium-card w-full max-w-md mx-4 p-6" style="background: rgba(15,23,42,0.95);" (click)="$event.stopPropagation()">
            <h3 class="text-[15px] font-extrabold mb-1 text-white relative z-10">{{ editing()!.checklist_item }}</h3>
            <p class="text-[12px] font-medium mb-5 text-slate-400 relative z-10">{{ editing()!.gate_description }}</p>

            <label class="premium-label block mb-1.5 relative z-10">Status</label>
            <select [(ngModel)]="editStatus" class="premium-select mb-4 relative z-10">
              <option value="Approved">Approved</option>
              <option value="Not Approved">Not Approved</option>
            </select>

            <label class="premium-label block mb-1.5 relative z-10">Comments</label>
            <textarea [(ngModel)]="editComments" rows="4"
                      class="premium-textarea mb-5 relative z-10"
                      placeholder="Add review comments..."></textarea>

            @if (saveError()) {
              <p class="text-[12px] font-semibold mb-4 text-rose-400 relative z-10">{{ saveError() }}</p>
            }

            <div class="flex items-center justify-end gap-3 relative z-10">
              <button type="button" class="premium-btn-secondary px-5 py-2.5 text-[13px] font-bold"
                      (click)="closeEdit()">
                Cancel
              </button>
              <button type="button" class="premium-btn-primary px-5 py-2.5 text-[13px] font-bold"
                      [disabled]="saving()"
                      (click)="save()">
                {{ saving() ? 'Saving…' : 'Save' }}
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `
})
export class GatewayChecklistComponent implements OnChanges {
  @Input({ required: true }) projectId!: string;
  @Input({ required: true }) gateOwner!: string;

  private checklistService = inject(GatewayChecklistService);

  readonly items = signal<GatewayChecklistItem[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly editing = signal<GatewayChecklistItem | null>(null);
  readonly saving = signal(false);
  readonly saveError = signal<string | null>(null);
  editStatus: 'Approved' | 'Not Approved' = 'Approved';
  editComments = '';

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['projectId'] || changes['gateOwner']) && this.projectId && this.gateOwner) {
      this.load();
    }
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.checklistService.getChecklist(this.projectId, this.gateOwner).subscribe({
      next: (items) => { this.items.set(items); this.loading.set(false); },
      error: () => { this.error.set('Unable to load checklist.'); this.loading.set(false); }
    });
  }

  openEdit(item: GatewayChecklistItem): void {
    this.editing.set(item);
    this.editStatus = (item.status === 'Not Approved' ? 'Not Approved' : 'Approved');
    this.editComments = item.comments || '';
    this.saveError.set(null);
  }

  closeEdit(): void {
    this.editing.set(null);
  }

  save(): void {
    const item = this.editing();
    if (!item) return;
    this.saving.set(true);
    this.saveError.set(null);
    this.checklistService.updateChecklistItem(item.result_id, {
      status: this.editStatus,
      comments: this.editComments
    }).subscribe({
      next: (updated) => {
        this.items.update(list => list.map(i => i.result_id === updated.result_id ? updated : i));
        this.saving.set(false);
        this.closeEdit();
      },
      error: (err) => {
        this.saveError.set(err?.error?.detail || 'Unable to save changes.');
        this.saving.set(false);
      }
    });
  }
}
