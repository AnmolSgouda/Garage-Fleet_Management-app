import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import {
  ServiceBooking,
  ServiceWorkflowColumn,
  VEHICLE_CATEGORY_META,
} from '../../models/fleet.models';

@Component({
  selector: 'app-workflow-columns',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
      @for (col of columns; track col.id) {
        <div class="flex flex-col">
          <!-- Column Header -->
          <div class="bg-[#e4e9f0] text-slate-800 px-3 py-2 rounded-t-md border border-slate-300 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="text-xs font-bold text-slate-900 tracking-tight">
                {{ col.title }}
              </span>
              <span class="bg-white text-slate-800 text-[11px] font-bold px-1.5 py-0.5 rounded-full font-mono shadow-2xs">
                {{ bookingsForColumn(col.id).length }}
              </span>
            </div>

            <div class="relative group cursor-pointer" [title]="col.actionHint">
              <lucide-icon
                name="info"
                class="w-3.5 h-3.5 text-slate-500 hover:text-slate-800 transition-colors"
              ></lucide-icon>
            </div>
          </div>

          <!-- Column Body Container -->
          <div class="bg-[#f2f5f9] p-2.5 rounded-b-md border border-t-0 border-slate-200/90 min-h-[380px] space-y-2.5">
            @if (bookingsForColumn(col.id).length === 0) {
              <div class="bg-white rounded border border-slate-200/90 p-5 text-center text-xs text-slate-400 py-10 shadow-2xs">
                {{ col.emptyText }}
              </div>
            } @else {
              @for (b of bookingsForColumn(col.id); track b.id) {
                <div class="bg-white rounded border border-slate-200 p-3 shadow-2xs hover:shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between group">
                  <!-- Top row: Vehicle Category Image + Reg No -->
                  <div class="flex items-start gap-3 mb-2">
                    <div
                      (click)="selectVehicle.emit(b.vehicleId)"
                      class="w-16 h-11 rounded bg-slate-50 border border-slate-100 flex items-center justify-center p-1 shrink-0 cursor-pointer hover:border-slate-300 transition-colors"
                      title="Click to view Vehicle Profile slide-over"
                    >
                      <img
                        [src]="getMeta(b).imagePath"
                        [alt]="getMeta(b).label"
                        referrerPolicy="no-referrer"
                        class="max-h-full max-w-full object-contain mix-blend-multiply"
                      />
                    </div>

                    <div class="flex-1 min-w-0">
                      <div class="flex items-center justify-between gap-1">
                        <button
                          type="button"
                          (click)="selectVehicle.emit(b.vehicleId)"
                          class="text-xs font-bold font-mono text-slate-900 hover:text-blue-600 transition-colors truncate tracking-tight text-left"
                        >
                          {{ b.vehicleReg }}
                        </button>

                        <div
                          class="w-4 h-4 rounded-xs bg-[#001738] text-[#c9a66b] flex items-center justify-center text-[8px] font-black shrink-0 shadow-2xs"
                          title="Certified Heavy Unit"
                        >
                          S
                        </div>
                      </div>

                      <p class="text-[11px] font-semibold text-slate-700 leading-snug line-clamp-1 mt-0.5">
                        {{ b.serviceActivities }}
                      </p>

                      <p class="text-[10px] text-slate-400 truncate mt-0.5">
                        {{ b.workshopLocation }}
                      </p>
                    </div>
                  </div>

                  <!-- Footer: Status badge & specific column actions -->
                  <div class="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 mt-1">
                    <div>
                      @switch (b.badgeType) {
                        @case ('delayed') {
                          <span class="inline-flex items-center gap-1.5 text-[11px] text-[#e02424] font-semibold">
                            <span class="w-2 h-2 rounded-full bg-[#e02424]"></span>
                            <span>Delayed</span>
                            <span class="text-slate-500 font-mono text-[10px]">{{ b.badgeDateStr }}</span>
                          </span>
                        }
                        @case ('due') {
                          <span class="inline-flex items-center gap-1.5 text-[11px] text-[#0051a8] font-semibold">
                            <span class="w-2 h-2 rounded-full bg-[#0051a8]"></span>
                            <span>Due</span>
                            <span class="text-slate-500 font-mono text-[10px]">{{ b.badgeDateStr }}</span>
                          </span>
                        }
                        @case ('major') {
                          <span class="inline-flex items-center gap-1.5 text-[11px] text-[#e02424] font-semibold">
                            <span class="w-2 h-2 rounded-full bg-[#e02424]"></span>
                            <span>Major</span>
                            <span class="text-slate-500 font-mono text-[10px]">{{ b.badgeDateStr }}</span>
                          </span>
                        }
                        @case ('pending') {
                          <span class="inline-flex items-center gap-1.5 text-[11px] text-[#d97706] font-semibold">
                            <span class="w-2 h-2 rounded-full bg-[#f59e0b]"></span>
                            <span>Pending</span>
                            <span class="text-slate-500 font-mono text-[10px]">{{ b.badgeDateStr }}</span>
                          </span>
                        }
                        @case ('proposal') {
                          <span class="inline-flex items-center gap-1.5 text-[11px] text-[#d97706] font-semibold">
                            <span class="w-2 h-2 rounded-full bg-[#f59e0b]"></span>
                            <span>Proposal</span>
                            <span class="text-slate-500 font-mono text-[10px]">{{ b.badgeDateStr }}</span>
                          </span>
                        }
                        @case ('drop_off') {
                          <span class="inline-flex items-center gap-1.5 text-[11px] text-[#059669] font-semibold">
                            <span class="w-2 h-2 rounded-full bg-[#10b981]"></span>
                            <span>Drop off</span>
                            <span class="text-slate-500 font-mono text-[10px]">{{ b.badgeDateStr }}</span>
                          </span>
                        }
                        @case ('pick_up') {
                          <span class="inline-flex items-center gap-1.5 text-[11px] text-[#0051a8] font-semibold">
                            <span class="w-2 h-2 rounded-full bg-[#0051a8]"></span>
                            <span>Pick up</span>
                            <span class="text-slate-500 font-mono text-[10px]">{{ b.badgeDateStr }}</span>
                          </span>
                        }
                        @default {
                          <span class="inline-flex items-center gap-1.5 text-[11px] text-[#059669] font-semibold">
                            <span class="w-2 h-2 rounded-full bg-[#10b981]"></span>
                            <span>Accepted</span>
                            <span class="text-slate-500 font-mono text-[10px]">{{ b.badgeDateStr }}</span>
                          </span>
                        }
                      }
                    </div>

                    <div class="flex items-center gap-1">
                      @if (col.id === 'service_events_to_book') {
                        <button
                          type="button"
                          (click)="openBookingWizard.emit(b.vehicleId)"
                          class="text-[11px] font-semibold text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-0.5 rounded transition-colors"
                          title="Book service slot for vehicle"
                        >
                          Book slot
                        </button>
                      }

                      @if (col.id === 'preliminary_bookings') {
                        <button
                          type="button"
                          (click)="approvePreliminary.emit(b.id)"
                          class="flex items-center gap-1 text-[10px] font-bold text-emerald-700 hover:text-white hover:bg-emerald-600 bg-emerald-50 px-2 py-1 rounded border border-emerald-200 transition-colors shadow-2xs"
                          title="Approve proposed booking"
                        >
                          <lucide-icon name="check" class="w-3 h-3"></lucide-icon>
                          <span>Approve</span>
                        </button>
                        <button
                          type="button"
                          (click)="rejectPreliminary.emit(b.id)"
                          class="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                          title="Reject proposal"
                          aria-label="Reject booking"
                        >
                          <lucide-icon name="x" class="w-3.5 h-3.5"></lucide-icon>
                        </button>
                      }

                      @if (col.id === 'confirmed_bookings') {
                        <button
                          type="button"
                          (click)="startConfirmed.emit(b.id)"
                          class="flex items-center gap-1 text-[10px] font-bold text-white bg-[#0051a8] hover:bg-[#003d80] px-2.5 py-1 rounded transition-colors shadow-2xs"
                          title="Start workshop bay service"
                        >
                          <lucide-icon name="play" class="w-3 h-3 fill-current"></lucide-icon>
                          <span>Start</span>
                        </button>
                      }

                      @if (col.id === 'in_progress') {
                        <button
                          type="button"
                          (click)="openJobMaterials.emit(b.id)"
                          class="flex items-center gap-1 text-[10px] font-bold text-[#0051a8] hover:bg-blue-50 bg-white px-2 py-1 rounded border border-blue-200 transition-colors"
                          title="Log Actual & Additional Spare Parts Used"
                        >
                          <lucide-icon name="package" class="w-3 h-3"></lucide-icon>
                          <span>Parts</span>
                        </button>
                        <button
                          type="button"
                          (click)="openInvoicePreview.emit(b.id)"
                          class="flex items-center gap-1 text-[10px] font-bold text-white bg-[#166534] hover:bg-[#14532d] px-2 py-1 rounded transition-colors shadow-2xs"
                          title="Preview & Generate Final Invoice (Deducts Stock)"
                        >
                          <lucide-icon name="receipt" class="w-3 h-3"></lucide-icon>
                          <span>Invoice</span>
                        </button>
                        <button
                          type="button"
                          (click)="completeInProgress.emit(b.id)"
                          class="flex items-center gap-1 text-[10px] font-bold text-emerald-800 hover:text-white hover:bg-emerald-600 bg-emerald-100 px-2 py-1 rounded border border-emerald-300 transition-colors shadow-2xs"
                          title="Mark as completed & log into vehicle history"
                        >
                          <lucide-icon name="circle-check" class="w-3 h-3"></lucide-icon>
                          <span>Complete</span>
                        </button>
                      }

                      @if (col.id !== 'in_progress') {
                        <button
                          type="button"
                          (click)="openJobMaterials.emit(b.id)"
                          class="p-1 text-slate-400 hover:text-[#0051a8] rounded transition-colors"
                          title="View Preliminary Material Estimate & Parts"
                          aria-label="View estimated materials"
                        >
                          <lucide-icon name="package" class="w-3.5 h-3.5"></lucide-icon>
                        </button>
                      }

                      <button
                        type="button"
                        (click)="selectVehicle.emit(b.vehicleId)"
                        class="p-1 text-slate-300 hover:text-slate-600 rounded transition-colors"
                        title="Inspect Vehicle Telemetry"
                        aria-label="Inspect vehicle"
                      >
                        <lucide-icon name="file-text" class="w-3.5 h-3.5"></lucide-icon>
                      </button>
                    </div>
                  </div>
                </div>
              }
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class WorkflowColumnsComponent {
  @Input() bookings: ServiceBooking[] = [];
  @Output() selectVehicle = new EventEmitter<string>();
  @Output() approvePreliminary = new EventEmitter<string>();
  @Output() rejectPreliminary = new EventEmitter<string>();
  @Output() startConfirmed = new EventEmitter<string>();
  @Output() completeInProgress = new EventEmitter<string>();
  @Output() openBookingWizard = new EventEmitter<string | undefined>();
  @Output() openJobMaterials = new EventEmitter<string>();
  @Output() openInvoicePreview = new EventEmitter<string>();

  readonly columns: {
    id: ServiceWorkflowColumn;
    title: string;
    emptyText: string;
    actionHint: string;
  }[] = [
    {
      id: 'service_events_to_book',
      title: 'Service events to book',
      emptyText: 'No unbooked service events matching current filter.',
      actionHint: 'Schedule garage appointment',
    },
    {
      id: 'preliminary_bookings',
      title: 'Preliminary Bookings',
      emptyText: 'No preliminary booking requests pending approval.',
      actionHint: 'Approve or Reject proposed slot',
    },
    {
      id: 'confirmed_bookings',
      title: 'Confirmed Bookings',
      emptyText: 'No confirmed bookings found.',
      actionHint: 'Drop off vehicle & start workshop service',
    },
    {
      id: 'in_progress',
      title: 'In Progress',
      emptyText: 'No vehicles currently in workshop bay.',
      actionHint: 'Mark completed to log into Service History',
    },
  ];

  bookingsForColumn(colId: ServiceWorkflowColumn): ServiceBooking[] {
    return this.bookings.filter((b) => b.workflowColumn === colId);
  }

  getMeta(b: ServiceBooking) {
    return VEHICLE_CATEGORY_META[b.vehicleCategory];
  }
}
