import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { FleetNotification } from '../../models/fleet.models';

@Component({
  selector: 'app-notifications-panel',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <div class="bg-white rounded-md border border-slate-200 p-3.5 mb-5 shadow-2xs">
      <!-- Top Controls Row -->
      <div class="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div class="flex items-center gap-3">
          <span class="text-[11px] font-extrabold uppercase tracking-widest text-slate-900 whitespace-nowrap">
            NEW UPDATES
          </span>
          <div class="h-4 w-px bg-slate-200 hidden sm:block"></div>

          <div class="flex items-center gap-1.5">
            <button
              type="button"
              (click)="setFilter('all')"
              [class]="
                'px-3 py-1 rounded-full text-xs font-semibold transition-colors whitespace-nowrap ' +
                (filterMode === 'all'
                  ? 'bg-[#004f9f] text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100')
              "
            >
              All Updates
            </button>
            <button
              type="button"
              (click)="setFilter('dismissed')"
              [class]="
                'px-3 py-1 rounded-full text-xs font-semibold transition-colors whitespace-nowrap ' +
                (filterMode === 'dismissed'
                  ? 'bg-slate-700 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100')
              "
            >
              Dismissed
            </button>
          </div>
        </div>

        <div class="flex items-center gap-3">
          @if (filterMode === 'all' && filtered.length > 0) {
            <button
              type="button"
              (click)="dismissAll.emit()"
              class="text-xs font-medium text-slate-700 hover:text-slate-900 px-2.5 py-1 rounded border border-slate-300 hover:border-slate-400 bg-white transition-colors whitespace-nowrap shadow-2xs"
            >
              Dismiss all
            </button>
          }

          @if (filtered.length === 0 && filterMode === 'all') {
            <button
              type="button"
              (click)="reset.emit()"
              class="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 px-2.5 py-1 rounded border border-blue-200 hover:bg-blue-50 transition-colors"
            >
              <lucide-icon name="refresh-cw" class="w-3 h-3"></lucide-icon>
              <span>Restore updates</span>
            </button>
          }

          <div class="flex items-center gap-1 text-xs text-slate-500 font-mono tabular-nums">
            <span>{{ paginationLabel }}</span>

            <div class="flex items-center ml-1">
              <button
                type="button"
                [disabled]="currentPage === 0"
                (click)="prevPage()"
                class="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30 disabled:pointer-events-none rounded hover:bg-slate-100"
                aria-label="Previous updates"
              >
                <lucide-icon name="chevron-left" class="w-3.5 h-3.5"></lucide-icon>
              </button>
              <button
                type="button"
                [disabled]="currentPage >= totalPages - 1"
                (click)="nextPage()"
                class="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30 disabled:pointer-events-none rounded hover:bg-slate-100"
                aria-label="Next updates"
              >
                <lucide-icon name="chevron-right" class="w-3.5 h-3.5"></lucide-icon>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Cards Row -->
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 pt-3">
        @if (displayed.length === 0) {
          <div class="col-span-full py-6 text-center text-xs text-slate-400">
            {{
              filterMode === 'all'
                ? 'No active notifications to display.'
                : 'No dismissed notifications found.'
            }}
          </div>
        } @else {
          @for (item of displayed; track item.id) {
            <div class="bg-white rounded border border-slate-200 p-2.5 flex flex-col justify-between hover:border-slate-300 transition-all hover:shadow-2xs relative">
              <div>
                <div class="flex items-center justify-between mb-1.5">
                  <div class="flex items-center gap-2">
                    <div class="flex items-center gap-1">
                      <div [class]="'w-3 h-1 rounded-xs ' + getIndicatorColor(item.type)"></div>
                      <div [class]="'w-3 h-1 rounded-xs ' + getIndicatorColor(item.type)"></div>
                      <div [class]="'w-3 h-1 rounded-xs opacity-40 ' + getIndicatorColor(item.type)"></div>
                    </div>
                    <span class="text-[11px] font-semibold text-slate-800 capitalize">
                      {{ item.title }}
                    </span>
                  </div>

                  @if (!item.dismissed) {
                    <button
                      type="button"
                      (click)="dismiss.emit(item.id)"
                      class="text-slate-400 hover:text-slate-700 p-0.5 rounded hover:bg-slate-100 transition-colors"
                      aria-label="Dismiss notification"
                    >
                      <lucide-icon name="x" class="w-3 h-3"></lucide-icon>
                    </button>
                  }
                </div>

                <p class="text-[11px] text-slate-600 leading-snug font-sans line-clamp-3 mb-2">
                  {{ item.message }}
                </p>
              </div>

              <div class="text-[10px] text-slate-400 pt-1.5 border-t border-slate-100 flex items-center justify-between">
                <span>{{ item.timeAgo }}</span>
                @if (item.bookingRef) {
                  <span class="font-mono text-slate-400 font-semibold">
                    #{{ item.bookingRef }}
                  </span>
                }
              </div>
            </div>
          }
        }
      </div>
    </div>
  `,
})
export class NotificationsPanelComponent {
  @Input() notifications: FleetNotification[] = [];
  @Output() dismiss = new EventEmitter<string>();
  @Output() dismissAll = new EventEmitter<void>();
  @Output() reset = new EventEmitter<void>();

  filterMode: 'all' | 'dismissed' = 'all';
  page = 0;
  readonly itemsPerPage = 5;

  get filtered(): FleetNotification[] {
    return this.notifications.filter((n) =>
      this.filterMode === 'all' ? !n.dismissed : n.dismissed
    );
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filtered.length / this.itemsPerPage));
  }

  get currentPage(): number {
    return Math.min(this.page, this.totalPages - 1);
  }

  get displayed(): FleetNotification[] {
    return this.filtered.slice(
      this.currentPage * this.itemsPerPage,
      (this.currentPage + 1) * this.itemsPerPage
    );
  }

  get paginationLabel(): string {
    if (this.filtered.length === 0) return '0 Updates';
    const start = this.currentPage * this.itemsPerPage + 1;
    const end = Math.min((this.currentPage + 1) * this.itemsPerPage, this.filtered.length);
    return `${start} - ${end} of ${this.filtered.length} Updates`;
  }

  setFilter(mode: 'all' | 'dismissed'): void {
    this.filterMode = mode;
    this.page = 0;
  }

  prevPage(): void {
    this.page = Math.max(0, this.currentPage - 1);
  }

  nextPage(): void {
    this.page = Math.min(this.totalPages - 1, this.currentPage + 1);
  }

  getIndicatorColor(type: FleetNotification['type']): string {
    switch (type) {
      case 'proposal':
        return 'bg-[#f59e0b]';
      case 'confirmed':
        return 'bg-[#10b981]';
      case 'performed':
        return 'bg-[#334155]';
      case 'delayed':
        return 'bg-[#ef4444]';
      case 'repair':
        return 'bg-[#dc2626]';
      case 'low_stock':
        return 'bg-[#d97706]';
      default:
        return 'bg-blue-500';
    }
  }
}
