import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import {
  GarageConfig,
  ServiceBooking,
  VEHICLE_CATEGORY_META,
  Vehicle,
} from '../../models/fleet.models';

@Component({
  selector: 'app-vehicle-profile-slide-over',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  template: `
    @if (vehicle; as v) {
      <div class="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-2xs flex justify-end">
        <div class="w-full max-w-2xl bg-white shadow-2xl h-full overflow-y-auto flex flex-col justify-between">
          <div>
            <!-- Header -->
            <div class="p-6 border-b border-slate-200 flex items-start justify-between">
              <div class="flex items-start gap-4">
                <div class="w-24 h-16 rounded bg-slate-50 border border-slate-200 flex items-center justify-center p-1.5 shrink-0">
                  <img
                    [src]="getMeta(v).imagePath"
                    [alt]="getMeta(v).label"
                    referrerPolicy="no-referrer"
                    class="max-h-full max-w-full object-contain mix-blend-multiply"
                  />
                </div>

                <div>
                  <h2 class="text-xl font-bold font-mono text-slate-900 tracking-tight">
                    {{ v.registrationNumber }}
                  </h2>
                  <p class="text-xs font-semibold text-slate-600 mt-0.5">{{ v.model }}</p>
                  <p class="text-xs font-mono text-slate-400">
                    {{ v.equipmentGroup }} · {{ getMeta(v).label }}
                  </p>
                  @if (v.customerName) {
                    <p class="text-[11px] text-slate-500 mt-0.5">
                      Customer: <span class="font-semibold text-slate-700">{{ v.customerName }}</span>
                      ({{ v.customerPhone || '-' }})
                    </p>
                  }
                </div>
              </div>

              <div class="flex items-center gap-2">
                <button
                  type="button"
                  (click)="openBookingWizard.emit(v.id)"
                  class="text-xs font-bold bg-[#0051a8] hover:bg-[#003d80] text-white px-3 py-1.5 rounded transition-colors shadow-2xs whitespace-nowrap"
                >
                  + Book Service
                </button>
                <button
                  type="button"
                  (click)="close.emit()"
                  class="text-slate-400 hover:text-slate-700 p-1.5 rounded hover:bg-slate-100 transition-colors"
                  aria-label="Close slide-over"
                >
                  <lucide-icon name="x" class="w-5 h-5"></lucide-icon>
                </button>
              </div>
            </div>

            <!-- Telemetry Block -->
            <div class="p-6 bg-slate-50/70 border-b border-slate-200">
              <div class="grid grid-cols-2 sm:grid-cols-3 gap-y-4 gap-x-6 text-xs">
                <div>
                  <span class="text-slate-500 font-medium block mb-0.5">Odometer</span>
                  <span class="text-sm font-bold font-mono text-slate-900">
                    {{ v.odometer.toLocaleString() }} km
                  </span>
                </div>
                <div>
                  <span class="text-slate-500 font-medium block mb-0.5">Engine Running Time</span>
                  <span class="text-sm font-bold font-mono text-slate-900">
                    {{ v.engineRunningHours }} hours
                  </span>
                </div>
                <div>
                  <span class="text-slate-500 font-medium block mb-0.5">Next service</span>
                  <span class="text-sm font-bold font-mono text-slate-900">
                    {{ v.nextServiceDate }}
                  </span>
                </div>
                <div class="col-span-2">
                  <span class="text-slate-500 font-medium block mb-0.5">Maintenance Plan</span>
                  <a
                    href="#"
                    (click)="$event.preventDefault()"
                    class="text-blue-600 hover:text-blue-800 underline font-semibold flex items-center gap-1"
                  >
                    <span>{{ v.maintenancePlan }}</span>
                    <lucide-icon name="external-link" class="w-3 h-3"></lucide-icon>
                  </a>
                </div>
                <div>
                  <span class="text-slate-500 font-medium block mb-0.5">Garage</span>
                  <span class="font-semibold text-slate-700">{{ garageConfig.garageName }}</span>
                </div>
              </div>
            </div>

            <!-- Service Material Consumption (A, B, C) -->
            <div class="border-b border-slate-200">
              <button
                type="button"
                (click)="isConsumptionExpanded = !isConsumptionExpanded"
                class="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50/80 transition-colors text-left"
              >
                <div class="flex items-center gap-2">
                  <lucide-icon name="package" class="w-4 h-4 text-[#0051a8]"></lucide-icon>
                  <h3 class="text-sm font-bold text-slate-900">Service Material Consumption</h3>
                  @if (activeJob; as job) {
                    <span class="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-mono font-bold px-2 py-0.5 rounded">
                      #{{ job.bookingRef }}
                    </span>
                  }
                </div>
                <lucide-icon
                  [name]="isConsumptionExpanded ? 'chevron-up' : 'chevron-down'"
                  class="w-4 h-4 text-slate-400"
                ></lucide-icon>
              </button>

              @if (isConsumptionExpanded) {
                <div class="px-6 pb-5 space-y-3 text-xs">
                  @if (!activeJob) {
                    <p class="text-slate-400 py-1">
                      No active repair job for this vehicle. Book a service to generate a preliminary material estimate.
                    </p>
                  } @else {
                    @if (activeJob; as job) {
                      <div class="flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-3 rounded border border-slate-200">
                        <div>
                          <p class="font-bold text-slate-900">{{ job.serviceType }}</p>
                          <p class="text-[11px] text-slate-500">
                            {{
                              job.invoiceStatus === 'generated'
                                ? 'Billed via ' + job.invoiceNumber + ' (Stock Deducted)'
                                : 'Zero stock deduction until final invoice is generated'
                            }}
                          </p>
                        </div>
                        <div class="flex items-center gap-2">
                          <button
                            type="button"
                            (click)="openJobMaterials.emit(job.id)"
                            class="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-white bg-[#0051a8] hover:bg-[#003d80] rounded"
                          >
                            <lucide-icon name="wrench" class="w-3 h-3"></lucide-icon>
                            <span>Edit Materials</span>
                          </button>
                          <button
                            type="button"
                            (click)="openInvoicePreview.emit(job.id)"
                            class="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-white bg-[#166534] hover:bg-[#14532d] rounded"
                          >
                            <lucide-icon name="receipt" class="w-3 h-3"></lucide-icon>
                            <span>
                              {{ job.invoiceStatus === 'generated' ? 'View Invoice' : 'Generate Invoice' }}
                            </span>
                          </button>
                        </div>
                      </div>

                      <div class="border border-slate-200 rounded p-2.5">
                        <p class="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                          A. Estimated Materials ({{ (job.estimatedMaterials || []).length }})
                        </p>
                        @if ((job.estimatedMaterials || []).length === 0) {
                          <p class="text-[11px] text-slate-400">None pre-estimated.</p>
                        } @else {
                          <div class="flex flex-wrap gap-1.5">
                            @for (em of job.estimatedMaterials; track em.id) {
                              <span class="text-[11px] font-mono bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
                                {{ em.partName }}: {{ em.estimatedQuantity }} {{ em.unit }}
                              </span>
                            }
                          </div>
                        }
                      </div>

                      <div class="border border-slate-200 rounded p-2.5">
                        <p class="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                          B. Actual Materials Used ({{ (job.actualMaterials || []).length }})
                        </p>
                        @if ((job.actualMaterials || []).length === 0) {
                          <p class="text-[11px] text-slate-400">No actual usage recorded yet.</p>
                        } @else {
                          <div class="space-y-1">
                            @for (am of job.actualMaterials; track am.id) {
                              <div class="flex items-center justify-between text-[11px] py-0.5 border-b border-slate-100 last:border-0">
                                <span class="font-medium text-slate-800">{{ am.partName }}</span>
                                <span class="font-mono font-bold text-slate-900">
                                  {{ am.actualQuantity }} {{ am.unit }} (Est: {{ am.estimatedQuantity }})
                                </span>
                              </div>
                            }
                          </div>
                        }
                      </div>

                      <div class="border border-slate-200 rounded p-2.5">
                        <p class="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                          C. Additional Materials ({{ (job.additionalMaterials || []).length }})
                        </p>
                        @if ((job.additionalMaterials || []).length === 0) {
                          <p class="text-[11px] text-slate-400">
                            No unplanned parts added. Click &ldquo;Edit Materials&rdquo; to log extra parts.
                          </p>
                        } @else {
                          <div class="space-y-1">
                            @for (ad of job.additionalMaterials; track ad.id) {
                              <div class="flex items-center justify-between text-[11px] py-0.5 border-b border-slate-100 last:border-0">
                                <div>
                                  <span class="font-medium text-slate-800">{{ ad.partName }}</span>
                                  <span class="text-[10px] text-slate-500 ml-1.5">({{ ad.reason }})</span>
                                </div>
                                <span class="font-mono font-bold text-amber-800">
                                  +{{ ad.quantity }} {{ ad.unit }}
                                </span>
                              </div>
                            }
                          </div>
                        }
                      </div>
                    }
                  }
                </div>
              }
            </div>

            <!-- Expandable Bookings Accordion -->
            <div class="border-b border-slate-200">
              <button
                type="button"
                (click)="isBookingsExpanded = !isBookingsExpanded"
                class="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50/80 transition-colors text-left"
              >
                <div class="flex items-center gap-2">
                  <h3 class="text-sm font-bold text-slate-900">Bookings</h3>
                  <span class="bg-slate-100 text-slate-700 text-xs font-mono font-bold px-2 py-0.5 rounded-full">
                    {{ vehicleBookings.length }}
                  </span>
                </div>
                <lucide-icon
                  [name]="isBookingsExpanded ? 'chevron-up' : 'chevron-down'"
                  class="w-4 h-4 text-slate-400"
                ></lucide-icon>
              </button>

              @if (isBookingsExpanded) {
                <div class="px-6 pb-4 space-y-2">
                  @if (vehicleBookings.length === 0) {
                    <p class="text-xs text-slate-400 py-2">No active bookings for this vehicle.</p>
                  } @else {
                    @for (bk of vehicleBookings; track bk.id) {
                      <div class="p-3 bg-white rounded border border-slate-200 flex items-center justify-between shadow-2xs gap-2">
                        <div class="min-w-0">
                          <div class="flex items-center gap-2">
                            <span class="font-mono text-xs font-bold text-slate-900">
                              #{{ bk.bookingRef }}
                            </span>
                            <span class="text-xs font-semibold text-slate-700 truncate">
                              {{ bk.serviceActivities }}
                            </span>
                          </div>
                          <p class="text-[11px] text-slate-500 mt-0.5">
                            {{ bk.workshopLocation }} · {{ bk.date }} ({{ bk.startTime }} - {{ bk.endTime }})
                          </p>
                        </div>

                        <div class="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            (click)="openJobMaterials.emit(bk.id)"
                            class="text-[10px] font-bold px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700"
                          >
                            Materials
                          </button>
                          <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                            {{ bk.workflowColumn.replaceAll('_', ' ') }}
                          </span>
                        </div>
                      </div>
                    }
                  }
                </div>
              }
            </div>

            <!-- Maintenance Checklist -->
            <div class="p-6 border-b border-slate-200">
              <div class="flex items-center justify-between mb-3">
                <h3 class="text-sm font-bold text-slate-900">Maintenance</h3>
                <button
                  type="button"
                  (click)="isAddActivityModalOpen = true"
                  class="flex items-center gap-1 text-xs font-semibold text-slate-800 hover:text-slate-900 px-3 py-1.5 rounded border border-slate-300 hover:border-slate-400 bg-white transition-colors shadow-2xs"
                >
                  <span>Add an unplanned activity</span>
                  <lucide-icon name="plus" class="w-3.5 h-3.5"></lucide-icon>
                </button>
              </div>

              <div class="space-y-2.5">
                @for (item of v.maintenanceChecklist; track item.id) {
                  <div
                    (click)="toggleMaintenance(item.id)"
                    class="flex items-center justify-between py-2 border-b border-slate-100 last:border-b-0 cursor-pointer group"
                  >
                    <div class="flex items-center gap-3">
                      <input
                        type="checkbox"
                        [checked]="checkedMaintenance[item.id] || false"
                        class="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer pointer-events-none"
                      />
                      <span
                        [class]="
                          'text-xs font-medium transition-colors ' +
                          (checkedMaintenance[item.id] ? 'line-through text-slate-400' : 'text-slate-800')
                        "
                      >
                        {{ item.name }}
                      </span>
                    </div>

                    <span class="inline-flex items-center gap-1.5 text-[11px] text-[#e02424] font-semibold bg-rose-50 px-2 py-0.5 rounded">
                      <span class="w-2 h-2 rounded-full bg-[#e02424]"></span>
                      <span>{{ item.status }}</span>
                      <span class="text-slate-500 font-mono text-[10px]">
                        {{ item.dueDate }}{{ item.dueTime ? ', ' + item.dueTime : '' }}
                      </span>
                    </span>
                  </div>
                }
              </div>
            </div>

            <!-- Repair Checklist -->
            <div class="p-6 border-b border-slate-200">
              <div class="flex items-center justify-between mb-3">
                <h3 class="text-sm font-bold text-slate-900">Repair</h3>
                <button
                  type="button"
                  (click)="isAddRepairModalOpen = true"
                  class="flex items-center gap-1 text-xs font-semibold text-slate-800 hover:text-slate-900 px-3 py-1.5 rounded border border-slate-300 hover:border-slate-400 bg-white transition-colors shadow-2xs"
                >
                  <span>Add an unplanned repair</span>
                  <lucide-icon name="plus" class="w-3.5 h-3.5"></lucide-icon>
                </button>
              </div>

              <div class="space-y-2.5">
                @if (v.repairChecklist.length === 0) {
                  <p class="text-xs text-slate-400 py-1">No active repairs logged.</p>
                } @else {
                  @for (rep of v.repairChecklist; track rep.id) {
                    <div
                      (click)="toggleRepair(rep.id)"
                      class="flex items-center justify-between py-2 border-b border-slate-100 last:border-b-0 cursor-pointer"
                    >
                      <div class="flex items-center gap-3">
                        <input
                          type="checkbox"
                          [checked]="checkedRepairs[rep.id] || false"
                          class="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer pointer-events-none"
                        />
                        <span
                          [class]="
                            'text-xs font-medium transition-colors ' +
                            (checkedRepairs[rep.id] ? 'line-through text-slate-400' : 'text-slate-800')
                          "
                        >
                          {{ rep.issue }}
                        </span>
                      </div>

                      <span class="inline-flex items-center gap-1.5 text-[11px] text-[#e02424] font-semibold bg-rose-50 px-2 py-0.5 rounded">
                        <span class="w-2 h-2 rounded-full bg-[#f59e0b]"></span>
                        <span class="capitalize">{{ rep.severity }}</span>
                        <span class="text-slate-500 font-mono text-[10px]">
                          {{ rep.reportedDate }}, {{ rep.reportedTime }}
                        </span>
                      </span>
                    </div>
                  }
                }
              </div>
            </div>

            <!-- Service History -->
            <div class="p-6">
              <h3 class="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                <lucide-icon name="history" class="w-4 h-4 text-slate-500"></lucide-icon>
                <span>Service History</span>
              </h3>

              @if (v.serviceHistory.length === 0) {
                <p class="text-xs text-slate-400 py-1">No recorded completed services yet.</p>
              } @else {
                <div class="space-y-3">
                  @for (hist of v.serviceHistory; track hist.id) {
                    <div class="p-3 bg-slate-50 rounded border border-slate-200 text-xs">
                      <div class="flex items-center justify-between mb-1">
                        <span class="font-bold text-slate-900">{{ hist.serviceTitle }}</span>
                        <span class="font-mono text-emerald-700 font-semibold">
                          {{ hist.completedDate }}
                        </span>
                      </div>
                      <p class="text-slate-600 leading-snug">{{ hist.notes }}</p>
                      <div class="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-200 text-[11px] text-slate-500">
                        <span>
                          {{ hist.workshopLocation }} · {{ hist.performedBy }}{{ hist.invoiceNumber ? ' · ' + hist.invoiceNumber : '' }}
                        </span>
                        <span class="font-mono font-bold text-slate-800">{{ hist.costEstimate }}</span>
                      </div>
                    </div>
                  }
                </div>
              }
            </div>
          </div>

          <!-- Footer -->
          <div class="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="w-6 h-6 rounded bg-[#001738] text-[#c9a66b] flex items-center justify-center text-[10px] font-black shadow-xs">
                G
              </div>
              <span class="text-[11px] font-semibold text-slate-600">
                {{ garageConfig.garageName }}
              </span>
            </div>

            <button
              type="button"
              (click)="close.emit()"
              class="px-4 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white border border-slate-300 rounded shadow-2xs hover:bg-slate-50"
            >
              Close Panel
            </button>
          </div>
        </div>

        <!-- Add Unplanned Activity Modal -->
        @if (isAddActivityModalOpen) {
          <div class="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/40">
            <div class="bg-white rounded-lg shadow-xl border border-slate-200 p-5 max-w-md w-full">
              <h4 class="text-sm font-bold text-slate-900 mb-2">Add Unplanned Activity</h4>
              <form (ngSubmit)="handleAddActivitySubmit(v.id)" class="space-y-3">
                <div>
                  <label class="block text-xs font-semibold text-slate-700 mb-1">
                    Activity Name / Inspection Point
                  </label>
                  <input
                    type="text"
                    name="newActivityName"
                    required
                    placeholder="e.g. Brake pad wear sensor recalibration"
                    [(ngModel)]="newActivityName"
                    class="w-full text-xs p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>

                <div class="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    (click)="isAddActivityModalOpen = false"
                    class="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    class="px-4 py-1.5 text-xs font-bold text-white bg-blue-600 rounded hover:bg-blue-500"
                  >
                    Save Activity
                  </button>
                </div>
              </form>
            </div>
          </div>
        }

        <!-- Add Unplanned Repair Modal -->
        @if (isAddRepairModalOpen) {
          <div class="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/40">
            <div class="bg-white rounded-lg shadow-xl border border-slate-200 p-5 max-w-md w-full">
              <h4 class="text-sm font-bold text-slate-900 mb-2">Add Unplanned Repair</h4>
              <form (ngSubmit)="handleAddRepairSubmit(v.id)" class="space-y-3">
                <div>
                  <label class="block text-xs font-semibold text-slate-700 mb-1">
                    Defect / Symptom Issue
                  </label>
                  <input
                    type="text"
                    name="newRepairIssue"
                    required
                    placeholder="e.g. Coolant reservoir slow pressure drop"
                    [(ngModel)]="newRepairIssue"
                    class="w-full text-xs p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label class="block text-xs font-semibold text-slate-700 mb-1">
                    Severity Level
                  </label>
                  <select
                    name="newRepairSeverity"
                    [(ngModel)]="newRepairSeverity"
                    class="w-full text-xs p-2 border border-slate-300 rounded bg-white"
                  >
                    <option value="major">Major (Delayed / Immediate)</option>
                    <option value="critical">Critical (Workshop Bay Grounded)</option>
                    <option value="minor">Minor (Monitor during next oil swap)</option>
                  </select>
                </div>

                <div class="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    (click)="isAddRepairModalOpen = false"
                    class="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    class="px-4 py-1.5 text-xs font-bold text-white bg-blue-600 rounded hover:bg-blue-500"
                  >
                    Add Repair Item
                  </button>
                </div>
              </form>
            </div>
          </div>
        }
      </div>
    }
  `,
})
export class VehicleProfileSlideOverComponent {
  @Input() vehicle: Vehicle | null = null;
  @Input() bookings: ServiceBooking[] = [];
  @Input() garageConfig!: GarageConfig;

  @Output() close = new EventEmitter<void>();
  @Output() addUnplannedActivity = new EventEmitter<{ vehicleId: string; name: string }>();
  @Output() addUnplannedRepair = new EventEmitter<{
    vehicleId: string;
    issue: string;
    severity: 'major' | 'minor' | 'critical';
  }>();
  @Output() openBookingWizard = new EventEmitter<string | undefined>();
  @Output() openJobMaterials = new EventEmitter<string>();
  @Output() openInvoicePreview = new EventEmitter<string>();

  isBookingsExpanded = true;
  isConsumptionExpanded = true;
  isAddActivityModalOpen = false;
  newActivityName = '';
  isAddRepairModalOpen = false;
  newRepairIssue = '';
  newRepairSeverity: 'major' | 'minor' | 'critical' = 'major';

  checkedMaintenance: Record<string, boolean> = {};
  checkedRepairs: Record<string, boolean> = {};

  getMeta(v: Vehicle) {
    return VEHICLE_CATEGORY_META[v.category];
  }

  get vehicleBookings(): ServiceBooking[] {
    if (!this.vehicle) return [];
    return this.bookings.filter((b) => b.vehicleId === this.vehicle!.id);
  }

  get activeJob(): ServiceBooking | null {
    const vb = this.vehicleBookings;
    return (
      vb.find((b) => b.workflowColumn === 'in_progress') ||
      vb.find((b) => b.workflowColumn === 'confirmed_bookings') ||
      vb[0] ||
      null
    );
  }

  toggleMaintenance(id: string): void {
    this.checkedMaintenance = {
      ...this.checkedMaintenance,
      [id]: !this.checkedMaintenance[id],
    };
  }

  toggleRepair(id: string): void {
    this.checkedRepairs = {
      ...this.checkedRepairs,
      [id]: !this.checkedRepairs[id],
    };
  }

  handleAddActivitySubmit(vehicleId: string): void {
    if (!this.newActivityName.trim()) return;
    this.addUnplannedActivity.emit({ vehicleId, name: this.newActivityName.trim() });
    this.newActivityName = '';
    this.isAddActivityModalOpen = false;
  }

  handleAddRepairSubmit(vehicleId: string): void {
    if (!this.newRepairIssue.trim()) return;
    this.addUnplannedRepair.emit({
      vehicleId,
      issue: this.newRepairIssue.trim(),
      severity: this.newRepairSeverity,
    });
    this.newRepairIssue = '';
    this.isAddRepairModalOpen = false;
  }
}
