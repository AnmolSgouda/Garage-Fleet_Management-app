import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { ServiceBooking, VEHICLE_CATEGORY_META } from '../../models/fleet.models';

@Component({
  selector: 'app-service-events-view',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  template: `
    <div class="space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-200">
        <div>
          <h2 class="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Service Events &amp; Work Orders
          </h2>
          <p class="text-xs text-slate-500 mt-0.5">
            Complete database of planned inspections, preliminary requests, and active bay sessions
          </p>
        </div>

        <div class="flex items-center gap-3">
          <div class="relative">
            <input
              type="text"
              placeholder="Search registration, workshop..."
              [(ngModel)]="search"
              class="bg-white border border-slate-200 text-xs py-2 pl-3 pr-8 rounded shadow-2xs focus:outline-hidden focus:ring-1 focus:ring-blue-500 w-52 sm:w-64"
            />
            <lucide-icon
              name="search"
              class="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
            ></lucide-icon>
          </div>

          <button
            type="button"
            (click)="openBookingWizard.emit(undefined)"
            class="flex items-center gap-1.5 bg-[#0051a8] hover:bg-[#003d80] text-white text-xs font-bold px-3.5 py-2 rounded shadow-2xs transition-colors whitespace-nowrap"
          >
            <lucide-icon name="plus" class="w-3.5 h-3.5"></lucide-icon>
            <span>Book a Service</span>
          </button>
        </div>
      </div>

      <!-- Filter Tabs -->
      <div class="flex border-b border-slate-200 text-xs font-semibold gap-2 overflow-x-auto">
        @for (tab of tabs; track tab.id) {
          <button
            type="button"
            (click)="columnFilter = tab.id"
            [class]="
              'py-2 px-3 border-b-2 transition-colors whitespace-nowrap ' +
              (columnFilter === tab.id
                ? 'border-blue-600 text-blue-700 font-bold bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800')
            "
          >
            {{ tab.id === 'all' ? 'All Events (' + bookings.length + ')' : tab.label }}
          </button>
        }
      </div>

      <!-- Table view -->
      <div class="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-2xs">
        <table class="w-full text-left text-xs">
          <thead class="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
            <tr>
              <th class="py-2.5 px-3">Vehicle</th>
              <th class="py-2.5 px-3">Category</th>
              <th class="py-2.5 px-3">Service Details</th>
              <th class="py-2.5 px-3">Workshop</th>
              <th class="py-2.5 px-3">Scheduled Slot</th>
              <th class="py-2.5 px-3">Workflow Column</th>
              <th class="py-2.5 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            @for (b of filtered; track b.id) {
              <tr class="hover:bg-slate-50/70 transition-colors">
                <td class="py-3 px-3">
                  <button
                    type="button"
                    (click)="selectVehicle.emit(b.vehicleId)"
                    class="font-mono font-bold text-slate-900 hover:text-blue-600 text-left block"
                  >
                    {{ b.vehicleReg }}
                  </button>
                  <span class="text-[10px] text-slate-400 font-mono">#{{ b.bookingRef }}</span>
                </td>
                <td class="py-3 px-3">
                  <div class="flex items-center gap-2">
                    <div class="w-8 h-6 rounded bg-slate-50 border border-slate-100 flex items-center justify-center p-0.5">
                      <img
                        [src]="getMeta(b).imagePath"
                        [alt]="getMeta(b).label"
                        class="max-h-full max-w-full object-contain mix-blend-multiply"
                      />
                    </div>
                    <span class="text-slate-700 font-medium">{{ getMeta(b).label }}</span>
                  </div>
                </td>
                <td class="py-3 px-3 max-w-xs">
                  <div class="font-semibold text-slate-800 truncate">{{ b.serviceActivities }}</div>
                  <div class="text-[11px] text-slate-400">{{ b.equipmentGroup }}</div>
                </td>
                <td class="py-3 px-3 text-slate-700">{{ b.workshopLocation }}</td>
                <td class="py-3 px-3 font-mono">
                  <div class="text-slate-800 font-medium">{{ b.date }}</div>
                  <div class="text-[10px] text-slate-400">
                    {{ b.startTime }} - {{ b.endTime }}
                  </div>
                </td>
                <td class="py-3 px-3">
                  <span class="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-800 border border-slate-200">
                    {{ b.workflowColumn.replaceAll('_', ' ') }}
                  </span>
                </td>
                <td class="py-3 px-3 text-right whitespace-nowrap">
                  <div class="inline-flex items-center gap-1.5">
                    <button
                      type="button"
                      (click)="openJobMaterials.emit(b.id)"
                      class="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded border border-slate-200"
                      title="Manage Service Materials"
                    >
                      <lucide-icon name="package" class="w-3 h-3"></lucide-icon>
                      <span>Parts</span>
                    </button>
                    @if (b.workflowColumn === 'in_progress' || b.invoiceStatus === 'generated') {
                      <button
                        type="button"
                        (click)="openInvoicePreview.emit(b.id)"
                        class="inline-flex items-center gap-1 text-xs font-bold text-white bg-[#166534] hover:bg-[#14532d] px-2 py-1 rounded"
                      >
                        <lucide-icon name="receipt" class="w-3 h-3"></lucide-icon>
                        <span>{{ b.invoiceNumber || 'Invoice' }}</span>
                      </button>
                    }
                    @if (b.workflowColumn === 'preliminary_bookings') {
                      <button
                        type="button"
                        (click)="approvePreliminary.emit(b.id)"
                        class="text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded border border-emerald-200"
                      >
                        Approve
                      </button>
                    }
                    @if (b.workflowColumn === 'confirmed_bookings') {
                      <button
                        type="button"
                        (click)="startConfirmed.emit(b.id)"
                        class="text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 px-2.5 py-1 rounded shadow-2xs"
                      >
                        Start
                      </button>
                    }
                    @if (b.workflowColumn === 'in_progress') {
                      <button
                        type="button"
                        (click)="completeInProgress.emit(b.id)"
                        class="text-xs font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 px-2.5 py-1 rounded border border-emerald-300"
                      >
                        Complete
                      </button>
                    }
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
})
export class ServiceEventsViewComponent {
  @Input() bookings: ServiceBooking[] = [];
  @Output() selectVehicle = new EventEmitter<string>();
  @Output() openBookingWizard = new EventEmitter<string | undefined>();
  @Output() approvePreliminary = new EventEmitter<string>();
  @Output() startConfirmed = new EventEmitter<string>();
  @Output() completeInProgress = new EventEmitter<string>();
  @Output() openJobMaterials = new EventEmitter<string>();
  @Output() openInvoicePreview = new EventEmitter<string>();

  search = '';
  columnFilter = 'all';

  readonly tabs = [
    { id: 'all', label: 'All Events' },
    { id: 'service_events_to_book', label: 'Unbooked Events' },
    { id: 'preliminary_bookings', label: 'Preliminary Bookings' },
    { id: 'confirmed_bookings', label: 'Confirmed Bookings' },
    { id: 'in_progress', label: 'In Progress' },
  ];

  get filtered(): ServiceBooking[] {
    const q = this.search.trim().toLowerCase();
    return this.bookings.filter((b) => {
      const matchesCol = this.columnFilter === 'all' || b.workflowColumn === this.columnFilter;
      const matchesSearch =
        q === '' ||
        b.vehicleReg.toLowerCase().includes(q) ||
        b.serviceActivities.toLowerCase().includes(q) ||
        b.workshopLocation.toLowerCase().includes(q);
      return matchesCol && matchesSearch;
    });
  }

  getMeta(b: ServiceBooking) {
    return VEHICLE_CATEGORY_META[b.vehicleCategory];
  }
}
