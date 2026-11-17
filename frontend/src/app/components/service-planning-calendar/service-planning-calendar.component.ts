import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { FleetApiService } from '../../services/fleet-api.service';
import { CalendarStatus, ServiceBooking, Vehicle } from '../../models/fleet.models';

@Component({
  selector: 'app-service-planning-calendar',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  template: `
    <div class="space-y-4">
      @if (feedbackToast) {
        <div class="fixed top-14 right-6 z-50 bg-[#071322] text-white px-4 py-2.5 rounded-lg shadow-xl border border-slate-700 flex items-center gap-2">
          <lucide-icon name="circle-check" class="w-4 h-4 text-emerald-400"></lucide-icon>
          <span class="text-xs font-semibold">{{ feedbackToast }}</span>
        </div>
      }

      <!-- Top Filter and Toolbar Bar -->
      <div class="flex flex-wrap items-center justify-between gap-4 pb-1">
        <div class="flex items-center gap-3 flex-wrap">
          <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Calendar
          </h1>

          <div class="relative">
            <select
              [ngModel]="equipmentGroup"
              (ngModelChange)="setEquipmentGroup.emit($event)"
              aria-label="Filter calendar by equipment group"
              class="appearance-none bg-white border border-slate-200 hover:border-slate-300 text-slate-700 text-xs font-semibold py-1.5 pl-3 pr-8 rounded shadow-2xs focus:outline-hidden cursor-pointer"
            >
              <option value="All equipment groups">All Groups</option>
              <option value="SMA-AI-MODULES">SMA-AI-MODULES</option>
              <option value="Intermodal Freight">Intermodal Freight</option>
              <option value="Heavy Haulage">Heavy Haulage</option>
              <option value="Urban Distribution">Urban Distribution</option>
              <option value="Ready-Mix Infrastructure">Ready-Mix Infrastructure</option>
              <option value="Hazardous & Bulk Liquid">Hazardous & Bulk Liquid</option>
            </select>
            <lucide-icon
              name="chevron-down"
              class="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
            ></lucide-icon>
          </div>

          <div class="flex items-center gap-1.5 p-1 bg-slate-100 rounded-md border border-slate-200 overflow-x-auto">
            @for (st of statusOptions; track st.id) {
              <button
                type="button"
                (click)="toggleStatusFilter.emit(st.id)"
                [class]="
                  'px-2 py-0.5 rounded text-[11px] font-bold transition-all ' +
                  (statusFilters[st.id]
                    ? statusStyles[st.id].pillBg + ' ' + statusStyles[st.id].pillText + ' ring-1 ring-black/10 shadow-2xs'
                    : 'bg-white/60 text-slate-400 opacity-50 hover:opacity-100')
                "
              >
                {{ st.label }}
              </button>
            }
          </div>

          <lucide-icon
            name="info"
            class="w-4 h-4 text-slate-400 hover:text-slate-600 cursor-pointer"
          ></lucide-icon>
        </div>

        <div class="flex items-center gap-3">
          <div class="relative">
            <input
              type="text"
              placeholder="Search registration, service..."
              [(ngModel)]="calendarSearch"
              class="bg-white border border-slate-200 text-xs py-1.5 pl-3 pr-8 rounded shadow-2xs focus:outline-hidden focus:ring-1 focus:ring-blue-500 w-48 sm:w-60"
            />
            <lucide-icon
              name="search"
              class="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
            ></lucide-icon>
          </div>

          <div class="flex bg-slate-100 p-0.5 rounded border border-slate-200">
            <button
              type="button"
              (click)="setCalendarViewMode.emit('week')"
              [class]="
                'px-3 py-1 rounded text-xs font-semibold transition-colors ' +
                (calendarViewMode === 'week'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-500 hover:text-slate-900')
              "
            >
              Week
            </button>
            <button
              type="button"
              (click)="setCalendarViewMode.emit('month')"
              [class]="
                'px-3 py-1 rounded text-xs font-semibold transition-colors ' +
                (calendarViewMode === 'month'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-500 hover:text-slate-900')
              "
            >
              Month
            </button>
          </div>
        </div>
      </div>

      <!-- Navigation Subheader -->
      <div class="flex items-center justify-between py-2 border-b border-slate-200">
        <div class="flex items-center gap-3">
          <div class="flex items-center gap-2">
            <button
              type="button"
              (click)="navigatePeriod(-1)"
              class="p-1 rounded text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              aria-label="Previous period"
            >
              <lucide-icon name="chevron-left" class="w-4 h-4"></lucide-icon>
            </button>

            <span class="text-sm font-bold text-slate-900">
              {{ calendarHeaderLabel }}
            </span>

            <button
              type="button"
              (click)="navigatePeriod(1)"
              class="p-1 rounded text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              aria-label="Next period"
            >
              <lucide-icon name="chevron-right" class="w-4 h-4"></lucide-icon>
            </button>
          </div>

          <button
            type="button"
            (click)="goToToday()"
            class="text-xs font-semibold px-2.5 py-1 bg-white border border-slate-200 rounded text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
          >
            Today
          </button>
        </div>

        <button
          type="button"
          (click)="openBookingWizard.emit({ prefillDate: '2023-09-26', prefillStartTime: '08:00' })"
          class="flex items-center gap-1.5 text-xs font-bold text-white bg-[#0051a8] hover:bg-[#003d80] px-3 py-1.5 rounded shadow-2xs transition-colors"
        >
          <lucide-icon name="plus" class="w-3.5 h-3.5"></lucide-icon>
          <span>+ Book Garage Slot</span>
        </button>
      </div>

      <!-- WEEK VIEW -->
      @if (calendarViewMode === 'week') {
        <div class="bg-white rounded-lg border border-slate-200 shadow-sm overflow-x-auto">
          <div class="min-w-[980px]">
            <!-- Days Header -->
            <div class="grid grid-cols-[60px_repeat(7,1fr)] border-b border-slate-200 bg-white sticky top-0 z-10">
              <div class="py-2.5 px-2 text-center text-xs font-semibold text-slate-400 border-r border-slate-100">
                GMT
              </div>
              @for (d of weekDays; track d.dateStr) {
                <div class="py-2.5 px-3 text-left border-r border-slate-100 last:border-r-0">
                  <span class="text-sm font-bold font-mono text-slate-900 mr-1.5">
                    {{ d.dayNum }}
                  </span>
                  <span class="text-xs font-semibold text-slate-500">
                    {{ d.name }}
                  </span>
                </div>
              }
            </div>

            <!-- Time Slot Rows (07:00 to 17:00) -->
            <div class="relative">
              @for (h of hours; track h) {
                <div class="grid grid-cols-[60px_repeat(7,1fr)] h-14 border-b border-slate-100 last:border-b-0">
                  <div class="text-[11px] font-mono font-bold text-slate-400 pr-2 pt-1 text-right border-r border-slate-100 select-none">
                    {{ h }}
                  </div>
                  @for (d of weekDays; track d.dateStr) {
                    <div
                      class="border-r border-slate-100 last:border-r-0 hover:bg-blue-50/30 transition-colors cursor-pointer group relative"
                      (click)="openSlotWizard(d.dateStr, h)"
                      [title]="'Click to book slot on ' + d.name + ' at ' + formatHourSlot(h)"
                    >
                      <span class="opacity-0 group-hover:opacity-100 text-[10px] text-blue-700 font-semibold absolute top-1 left-1.5 bg-white/95 px-1.5 py-0.5 rounded shadow-2xs pointer-events-none transition-opacity">
                        + Book {{ formatHourSlot(h) }}
                      </span>
                    </div>
                  }
                </div>
              }

              <!-- Absolute Positioned Event Blocks -->
              <div class="absolute inset-0 grid grid-cols-[60px_repeat(7,1fr)] pointer-events-none">
                <div class="border-r border-transparent"></div>
                @for (d of weekDays; track d.dateStr) {
                  <div class="relative h-full pointer-events-auto px-1">
                    @for (b of bookingsForDate(d.dateStr); track b.id) {
                      <div
                        (click)="$event.stopPropagation(); handleOpenEventModal(b)"
                        [style.top.px]="calculateTopOffset(b.startTime)"
                        [style.height.px]="calculateBlockHeight(b.startTime, b.endTime)"
                        [class]="
                          'absolute left-1 right-1 rounded border p-2 flex flex-col justify-between shadow-xs transition-all hover:shadow-md cursor-pointer z-10 ' +
                          statusStyles[b.calendarStatus].bg + ' ' + statusStyles[b.calendarStatus].border
                        "
                      >
                        <div>
                          <div class="flex items-center justify-between gap-1 mb-0.5">
                            <span [class]="'text-[11px] font-bold capitalize truncate ' + statusStyles[b.calendarStatus].text">
                              {{ b.calendarStatus }} <span class="font-mono text-slate-900">{{ b.vehicleReg }}</span>
                            </span>
                          </div>

                          <p class="text-[10px] text-slate-700 font-medium leading-tight line-clamp-2">
                            {{ b.serviceActivities }}
                          </p>

                          <p class="text-[9px] text-slate-500 truncate mt-0.5">
                            {{ b.workshopLocation }}
                          </p>
                        </div>

                        <div class="text-[9px] font-mono font-semibold text-slate-600 mt-1 flex items-center justify-between">
                          <span>{{ b.startTime }} - {{ b.endTime }}</span>
                          <span class="text-[9px] uppercase font-bold text-slate-500">
                            {{ b.equipmentGroup.split(' ')[0] }}
                          </span>
                        </div>
                      </div>
                    }
                  </div>
                }
              </div>
            </div>
          </div>
        </div>
      } @else {
        <!-- MONTH VIEW -->
        <div class="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
          <div class="grid grid-cols-7 gap-1 text-center py-2 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
            <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
          </div>

          <div class="grid grid-cols-7 gap-1.5 pt-2">
            @for (blank of leadingBlankIndices; track blank) {
              <div class="min-h-[110px] bg-slate-50/40 rounded border border-transparent p-2 text-slate-300 text-xs"></div>
            }

            @for (dayNum of monthDayNumbers; track dayNum) {
              <div
                (click)="openBookingWizard.emit({ prefillDate: formatMonthDate(dayNum), prefillStartTime: '08:30' })"
                class="min-h-[110px] p-2 bg-white rounded border border-slate-200 hover:border-blue-400 hover:bg-slate-50/50 transition-all flex flex-col justify-between cursor-pointer group"
              >
                <div class="flex items-center justify-between mb-1">
                  <span class="text-xs font-mono font-bold text-slate-800">{{ dayNum }}</span>
                  @if (bookingsForDate(formatMonthDate(dayNum)).length > 0) {
                    <span class="text-[10px] font-bold text-blue-700 font-mono bg-blue-50 px-1.5 rounded">
                      {{ bookingsForDate(formatMonthDate(dayNum)).length }}
                    </span>
                  }
                </div>

                <div class="space-y-1 overflow-y-auto max-h-[75px]">
                  @for (b of bookingsForDate(formatMonthDate(dayNum)); track b.id) {
                    <div
                      (click)="$event.stopPropagation(); handleOpenEventModal(b)"
                      [class]="
                        'px-1.5 py-0.5 rounded text-[10px] font-semibold truncate border hover:brightness-95 ' +
                        statusStyles[b.calendarStatus].bg + ' ' + statusStyles[b.calendarStatus].text + ' ' + statusStyles[b.calendarStatus].border
                      "
                    >
                      <span class="font-mono font-bold mr-1">{{ b.vehicleReg }}</span>
                      <span>{{ b.startTime }}</span>
                    </div>
                  }
                </div>

                <span class="text-[9px] text-slate-400 group-hover:text-blue-600 transition-colors">
                  + Book slot
                </span>
              </div>
            }
          </div>
        </div>
      }

      <!-- Event Management & Conflict Validation Modal -->
      @if (selectedBookingForModal; as modalBooking) {
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div class="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden">
            <div class="bg-[#071322] text-white px-5 py-4 flex items-center justify-between">
              <div>
                <span class="text-xs font-mono text-cyan-400 font-bold uppercase">
                  Service Appointment #{{ modalBooking.bookingRef }}
                </span>
                <h3 class="text-base font-bold text-white mt-0.5">
                  {{ modalBooking.vehicleReg }} · {{ modalBooking.vehicleModel }}
                </h3>
              </div>

              <button
                type="button"
                (click)="selectedBookingForModal = null"
                class="text-slate-400 hover:text-white p-1 rounded transition-colors"
                aria-label="Close"
              >
                <lucide-icon name="x" class="w-5 h-5"></lucide-icon>
              </button>
            </div>

            <form (ngSubmit)="handleSaveReschedule()" class="p-5 space-y-4 text-xs">
              @if (rescheduleConflictError) {
                <div class="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2">
                  <lucide-icon name="triangle-alert" class="w-4 h-4 text-rose-600 shrink-0 mt-0.5"></lucide-icon>
                  <p class="leading-snug">{{ rescheduleConflictError }}</p>
                </div>
              }

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Workshop Center
                  </label>
                  <p class="font-semibold text-slate-800 bg-slate-50 p-2 rounded border border-slate-200">
                    {{ modalBooking.workshopLocation }}
                  </p>
                </div>

                <div>
                  <label class="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Current Status &amp; Column
                  </label>
                  <p class="font-semibold text-slate-800 bg-slate-50 p-2 rounded border border-slate-200 capitalize">
                    {{ modalBooking.calendarStatus }} · {{ modalBooking.workflowColumn.replaceAll('_', ' ') }}
                  </p>
                </div>
              </div>

              <div>
                <label class="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Service Checklist
                </label>
                <p class="font-medium text-slate-700 bg-slate-50 p-2 rounded border border-slate-200">
                  {{ modalBooking.serviceActivities }}
                </p>
              </div>

              <div class="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                <span class="font-bold text-slate-900 block">
                  Reschedule / Bay Appointment Slot
                </span>

                <div class="grid grid-cols-3 gap-2">
                  <div>
                    <label class="block text-[10px] text-slate-500 font-semibold mb-1">Date</label>
                    <input
                      type="date"
                      name="rescheduleDate"
                      required
                      [(ngModel)]="rescheduleDate"
                      (ngModelChange)="rescheduleConflictError = null"
                      class="w-full text-xs p-1.5 border border-slate-300 rounded bg-white font-mono"
                    />
                  </div>

                  <div>
                    <label class="block text-[10px] text-slate-500 font-semibold mb-1">Start Time</label>
                    <input
                      type="time"
                      name="rescheduleStartTime"
                      required
                      [(ngModel)]="rescheduleStartTime"
                      (ngModelChange)="rescheduleConflictError = null"
                      class="w-full text-xs p-1.5 border border-slate-300 rounded bg-white font-mono"
                    />
                  </div>

                  <div>
                    <label class="block text-[10px] text-slate-500 font-semibold mb-1">End Time</label>
                    <input
                      type="time"
                      name="rescheduleEndTime"
                      required
                      [(ngModel)]="rescheduleEndTime"
                      (ngModelChange)="rescheduleConflictError = null"
                      class="w-full text-xs p-1.5 border border-slate-300 rounded bg-white font-mono"
                    />
                  </div>
                </div>
              </div>

              <div class="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    [disabled]="isSubmitting"
                    (click)="handleConfirmSlot()"
                    class="px-3 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 rounded border border-emerald-300 transition-colors shadow-2xs"
                  >
                    Confirm Slot
                  </button>

                  <button
                    type="button"
                    [disabled]="isSubmitting"
                    (click)="handleMarkPerformed()"
                    class="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded border border-slate-300 transition-colors"
                  >
                    Mark Performed
                  </button>

                  <button
                    type="button"
                    [disabled]="isSubmitting"
                    (click)="handleCancelSlot()"
                    class="px-2.5 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded border border-rose-300 transition-colors"
                  >
                    Cancel Slot
                  </button>

                  <button
                    type="button"
                    (click)="openMaterialsFromModal(modalBooking.id)"
                    class="px-2.5 py-1.5 text-xs font-bold text-[#0051a8] bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 transition-colors"
                  >
                    Materials / Invoice
                  </button>
                </div>

                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    (click)="selectedBookingForModal = null"
                    class="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    [disabled]="isSubmitting"
                    class="px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded shadow-xs disabled:opacity-50"
                  >
                    Save Reschedule
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      }
    </div>
  `,
})
export class ServicePlanningCalendarComponent {
  private readonly fleetApi = inject(FleetApiService);

  @Input() bookings: ServiceBooking[] = [];
  @Input() vehicles: Vehicle[] = [];
  @Input() calendarViewMode: 'week' | 'month' = 'week';
  @Input() calendarDate: Date = new Date('2023-09-26T12:00:00');
  @Input() statusFilters: Record<CalendarStatus, boolean> = {
    delayed: true,
    due: true,
    preliminary: true,
    performed: true,
    confirmed: true,
    planned: true,
  };
  @Input() equipmentGroup = 'All equipment groups';

  @Output() setCalendarViewMode = new EventEmitter<'week' | 'month'>();
  @Output() setCalendarDate = new EventEmitter<Date>();
  @Output() toggleStatusFilter = new EventEmitter<CalendarStatus>();
  @Output() setEquipmentGroup = new EventEmitter<string>();
  @Output() selectVehicle = new EventEmitter<string>();
  @Output() openBookingWizard = new EventEmitter<{
    preselectedVehicleId?: string;
    prefillDate?: string;
    prefillStartTime?: string;
  }>();
  @Output() openJobMaterials = new EventEmitter<string>();

  calendarSearch = '';
  selectedBookingForModal: ServiceBooking | null = null;
  rescheduleDate = '';
  rescheduleStartTime = '';
  rescheduleEndTime = '';
  rescheduleConflictError: string | null = null;
  feedbackToast: string | null = null;
  isSubmitting = false;

  readonly hours = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17];
  readonly weekDays = [
    { name: 'Sunday', dateStr: '2023-09-24', dayNum: 24 },
    { name: 'Monday', dateStr: '2023-09-25', dayNum: 25 },
    { name: 'Tuesday', dateStr: '2023-09-26', dayNum: 26 },
    { name: 'Wednesday', dateStr: '2023-09-27', dayNum: 27 },
    { name: 'Thursday', dateStr: '2023-09-28', dayNum: 28 },
    { name: 'Friday', dateStr: '2023-09-29', dayNum: 29 },
    { name: 'Saturday', dateStr: '2023-09-30', dayNum: 30 },
  ];

  readonly monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  readonly statusOptions: { id: CalendarStatus; label: string }[] = [
    { id: 'delayed', label: 'Delayed' },
    { id: 'due', label: 'Due' },
    { id: 'preliminary', label: 'Preliminary' },
    { id: 'performed', label: 'Performed' },
    { id: 'confirmed', label: 'Confirmed' },
    { id: 'planned', label: 'Planned' },
  ];

  readonly statusStyles: Record<
    CalendarStatus,
    { bg: string; text: string; border: string; pillBg: string; pillText: string }
  > = {
    delayed: {
      bg: 'bg-[#fee2e2]',
      text: 'text-[#991b1b]',
      border: 'border-[#fca5a5]',
      pillBg: 'bg-[#fee2e2]',
      pillText: 'text-[#b91c1c]',
    },
    due: {
      bg: 'bg-[#dbeafe]',
      text: 'text-[#1e40af]',
      border: 'border-[#93c5fd]',
      pillBg: 'bg-[#dbeafe]',
      pillText: 'text-[#1d4ed8]',
    },
    preliminary: {
      bg: 'bg-[#fef3c7]',
      text: 'text-[#92400e]',
      border: 'border-[#fde68a]',
      pillBg: 'bg-[#fef3c7]',
      pillText: 'text-[#b45309]',
    },
    performed: {
      bg: 'bg-[#e2e8f0]',
      text: 'text-[#334155]',
      border: 'border-[#cbd5e1]',
      pillBg: 'bg-[#334155]',
      pillText: 'text-white',
    },
    confirmed: {
      bg: 'bg-[#dcfce7]',
      text: 'text-[#166534]',
      border: 'border-[#86efac]',
      pillBg: 'bg-[#dcfce7]',
      pillText: 'text-[#15803d]',
    },
    planned: {
      bg: 'bg-[#f1f5f9]',
      text: 'text-[#475569]',
      border: 'border-[#cbd5e1]',
      pillBg: 'bg-[#f1f5f9]',
      pillText: 'text-[#475569]',
    },
  };

  get calendarHeaderLabel(): string {
    if (this.calendarViewMode === 'week') {
      return 'September 2023, Week 39';
    }
    return `${this.monthNames[this.calendarDate.getMonth()]} ${this.calendarDate.getFullYear()}`;
  }

  get leadingBlankIndices(): number[] {
    const firstDay = new Date(
      this.calendarDate.getFullYear(),
      this.calendarDate.getMonth(),
      1
    ).getDay();
    return Array.from({ length: firstDay }, (_, i) => i);
  }

  get monthDayNumbers(): number[] {
    const days = new Date(
      this.calendarDate.getFullYear(),
      this.calendarDate.getMonth() + 1,
      0
    ).getDate();
    return Array.from({ length: days }, (_, i) => i + 1);
  }

  formatMonthDate(dayNum: number): string {
    const yr = this.calendarDate.getFullYear();
    const mo = String(this.calendarDate.getMonth() + 1).padStart(2, '0');
    const dy = String(dayNum).padStart(2, '0');
    return `${yr}-${mo}-${dy}`;
  }

  formatHourSlot(hour: number): string {
    return `${String(hour).padStart(2, '0')}:00`;
  }

  openSlotWizard(dateStr: string, hour: number): void {
    this.openBookingWizard.emit({
      prefillDate: dateStr,
      prefillStartTime: this.formatHourSlot(hour),
    });
  }

  navigatePeriod(direction: -1 | 1): void {
    const d = new Date(this.calendarDate);
    if (this.calendarViewMode === 'week') {
      d.setDate(d.getDate() + direction * 7);
    } else {
      d.setMonth(d.getMonth() + direction);
    }
    this.setCalendarDate.emit(d);
  }

  goToToday(): void {
    this.setCalendarDate.emit(new Date('2023-09-26T12:00:00'));
  }

  get filteredBookings(): ServiceBooking[] {
    const q = this.calendarSearch.trim().toLowerCase();
    return this.bookings.filter((b) => {
      const matchesStatus = this.statusFilters[b.calendarStatus] !== false;
      const matchesGroup =
        this.equipmentGroup === 'All equipment groups' || b.equipmentGroup === this.equipmentGroup;
      const matchesSearch =
        q === '' ||
        b.vehicleReg.toLowerCase().includes(q) ||
        b.serviceActivities.toLowerCase().includes(q);
      return matchesStatus && matchesGroup && matchesSearch;
    });
  }

  bookingsForDate(dateStr: string): ServiceBooking[] {
    return this.filteredBookings.filter((b) => b.date === dateStr);
  }

  private timeToMinutesFromStart(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return (h - 7) * 60 + (m || 0);
  }

  calculateTopOffset(startTime: string): number {
    const mins = Math.max(0, this.timeToMinutesFromStart(startTime));
    return (mins / 60) * 56;
  }

  calculateBlockHeight(startTime: string, endTime: string): number {
    const startMins = this.timeToMinutesFromStart(startTime);
    const endMins = this.timeToMinutesFromStart(endTime);
    const diff = Math.max(45, endMins - startMins);
    return (diff / 60) * 56;
  }

  private showToast(msg: string): void {
    this.feedbackToast = msg;
    setTimeout(() => {
      this.feedbackToast = null;
    }, 3000);
  }

  handleOpenEventModal(b: ServiceBooking): void {
    this.selectedBookingForModal = b;
    this.rescheduleDate = b.date;
    this.rescheduleStartTime = b.startTime;
    this.rescheduleEndTime = b.endTime;
    this.rescheduleConflictError = null;
  }

  openMaterialsFromModal(bookingId: string): void {
    this.selectedBookingForModal = null;
    this.openJobMaterials.emit(bookingId);
  }

  async handleConfirmSlot(): Promise<void> {
    if (!this.selectedBookingForModal || this.isSubmitting) return;
    this.isSubmitting = true;
    const target = this.selectedBookingForModal;
    const res = await this.fleetApi.updateBooking({
      ...target,
      calendarStatus: 'confirmed',
      workflowColumn: 'confirmed_bookings',
      badgeType: 'drop_off',
      badgeDateStr: `${target.date}, ${target.startTime}`,
    });
    this.isSubmitting = false;

    if (res.success) {
      this.showToast(`Slot confirmed for ${target.vehicleReg}! Moved to Confirmed Bookings.`);
      this.selectedBookingForModal = null;
    } else {
      this.rescheduleConflictError = res.error || 'Failed to confirm slot.';
    }
  }

  async handleMarkPerformed(): Promise<void> {
    if (!this.selectedBookingForModal || this.isSubmitting) return;
    this.isSubmitting = true;
    const target = this.selectedBookingForModal;
    const res = await this.fleetApi.updateBooking({
      ...target,
      calendarStatus: 'performed',
      workflowColumn: 'service_events_to_book',
      badgeType: 'accepted',
      badgeDateStr: 'Completed & Logged to History',
    });
    this.isSubmitting = false;

    if (res.success) {
      this.showToast(`Service for ${target.vehicleReg} marked as Performed!`);
      this.selectedBookingForModal = null;
    } else {
      this.rescheduleConflictError = res.error || 'Failed to update.';
    }
  }

  async handleCancelSlot(): Promise<void> {
    if (!this.selectedBookingForModal || this.isSubmitting) return;
    this.isSubmitting = true;
    const target = this.selectedBookingForModal;
    await this.fleetApi.cancelBooking(target.id);
    this.isSubmitting = false;
    this.showToast(`Slot #${target.bookingRef} cancelled.`);
    this.selectedBookingForModal = null;
  }

  async handleSaveReschedule(): Promise<void> {
    if (!this.selectedBookingForModal || this.isSubmitting) return;
    if (this.rescheduleStartTime >= this.rescheduleEndTime) {
      this.rescheduleConflictError = 'End time must be after start time.';
      return;
    }

    this.isSubmitting = true;
    const target = this.selectedBookingForModal;
    const res = await this.fleetApi.updateBooking({
      ...target,
      date: this.rescheduleDate,
      startTime: this.rescheduleStartTime,
      endTime: this.rescheduleEndTime,
    });
    this.isSubmitting = false;

    if (!res.success) {
      this.rescheduleConflictError = res.error || 'Conflict detected.';
    } else {
      this.showToast(
        `Rescheduled ${target.vehicleReg} to ${this.rescheduleDate} (${this.rescheduleStartTime}-${this.rescheduleEndTime})!`
      );
      this.selectedBookingForModal = null;
    }
  }
}
