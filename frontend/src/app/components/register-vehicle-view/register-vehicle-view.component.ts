import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { FleetApiService } from '../../services/fleet-api.service';
import { VEHICLE_CATEGORY_META, VehicleCategory } from '../../models/fleet.models';

@Component({
  selector: 'app-register-vehicle-view',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  template: `
    <div class="bg-white rounded-lg border border-slate-200 shadow-md overflow-hidden max-w-5xl mx-auto">
      <div class="bg-[#0b1b32] text-white px-6 py-4 flex items-center justify-between">
        <div>
          <h2 class="text-base sm:text-lg font-bold tracking-tight">
            Register New Commercial Vehicle
          </h2>
          <p class="text-[11px] text-slate-300 flex items-center gap-1.5 mt-0.5">
            <lucide-icon name="warehouse" class="w-3.5 h-3.5 text-cyan-400"></lucide-icon>
            <span>Central Garage: {{ garageName }}</span>
          </p>
        </div>

        <button
          type="button"
          (click)="cancel.emit()"
          class="text-slate-400 hover:text-white p-1 rounded transition-colors"
          aria-label="Close"
        >
          <lucide-icon name="x" class="w-5 h-5"></lucide-icon>
        </button>
      </div>

      <form (ngSubmit)="handleSubmit()" class="p-6 space-y-6 text-xs text-slate-800">
        @if (errorMsg) {
          <div class="p-3.5 bg-rose-50 border border-rose-200 rounded-md text-rose-800 flex items-center gap-2">
            <lucide-icon name="circle-alert" class="w-4 h-4 text-rose-600 shrink-0"></lucide-icon>
            <span class="font-semibold">{{ errorMsg }}</span>
          </div>
        }

        @if (successMsg) {
          <div class="p-3.5 bg-emerald-50 border border-emerald-200 rounded-md text-emerald-800 flex items-center gap-2">
            <lucide-icon name="check" class="w-4 h-4 text-emerald-600 shrink-0"></lucide-icon>
            <span class="font-semibold">{{ successMsg }}</span>
          </div>
        }

        <!-- 1. Select Vehicle Category -->
        <div>
          <label class="block text-xs font-bold text-slate-800 mb-2">
            1. Select Vehicle Category (Determines Default Vehicle Asset) *
          </label>

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            @for (cat of categories; track cat.id) {
              <div
                (click)="selectedCategory = cat.id"
                [class]="
                  'p-3.5 rounded-lg border cursor-pointer transition-all flex items-center gap-3.5 ' +
                  (selectedCategory === cat.id
                    ? 'border-[#002f6c] bg-white ring-2 ring-[#002f6c]/20 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white')
                "
              >
                <div class="w-16 h-12 rounded bg-slate-50 border border-slate-100 flex items-center justify-center p-1 shrink-0">
                  <img
                    [src]="getMeta(cat.id).imagePath"
                    [alt]="cat.title"
                    referrerPolicy="no-referrer"
                    class="max-h-full max-w-full object-contain mix-blend-multiply"
                  />
                </div>

                <div class="min-w-0">
                  <h4 class="text-xs font-bold text-slate-900 leading-snug">{{ cat.title }}</h4>
                  <p class="text-[11px] text-blue-600 font-mono mt-0.5">{{ cat.filename }}</p>
                </div>
              </div>
            }
          </div>
        </div>

        <!-- Row 1 -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">
              Registration Number (Unique) *
            </label>
            <input
              type="text"
              name="registrationNumber"
              required
              placeholder="E.G. BVDH839DFM"
              [ngModel]="registrationNumber"
              (ngModelChange)="registrationNumber = $event.toUpperCase()"
              class="w-full text-xs font-mono p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-hidden uppercase placeholder-slate-400 font-semibold"
            />
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">Manufacturer *</label>
            <input
              type="text"
              name="manufacturer"
              required
              [(ngModel)]="manufacturer"
              class="w-full text-xs p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">Vehicle Model *</label>
            <input
              type="text"
              name="model"
              required
              [(ngModel)]="model"
              class="w-full text-xs p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-medium"
            />
          </div>
        </div>

        <!-- Row 2 -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">Manufacturing Year *</label>
            <input
              type="number"
              name="manufacturingYear"
              required
              [(ngModel)]="manufacturingYear"
              class="w-full text-xs p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-mono"
            />
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">Odometer (km) *</label>
            <input
              type="number"
              name="odometer"
              required
              [(ngModel)]="odometer"
              class="w-full text-xs p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-mono"
            />
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">Engine Running Hours *</label>
            <input
              type="number"
              name="engineRunningHours"
              required
              [(ngModel)]="engineRunningHours"
              class="w-full text-xs p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-mono"
            />
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">Equipment Group</label>
            <select
              name="equipmentGroup"
              [(ngModel)]="equipmentGroup"
              class="w-full text-xs p-2 border border-slate-300 rounded bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden cursor-pointer"
            >
              <option value="Heavy Haulage">Heavy Haulage</option>
              <option value="SMA-AI-MODULES">SMA-AI-MODULES</option>
              <option value="Intermodal Freight">Intermodal Freight</option>
              <option value="Urban Distribution">Urban Distribution</option>
              <option value="Ready-Mix Infrastructure">Ready-Mix Infrastructure</option>
              <option value="Hazardous & Bulk Liquid">Hazardous &amp; Bulk Liquid</option>
            </select>
          </div>
        </div>

        <!-- Row 3 -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">Maintenance Plan *</label>
            <input
              type="text"
              name="maintenancePlan"
              required
              [(ngModel)]="maintenancePlan"
              class="w-full text-xs p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-medium"
            />
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">
              Next Scheduled Service Date *
            </label>
            <input
              type="date"
              name="nextScheduledDate"
              required
              [(ngModel)]="nextScheduledDate"
              class="w-full text-xs p-2 border border-slate-300 rounded bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-mono"
            />
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">
              Garage Facility (Single-Garage Mode)
            </label>
            <div class="w-full text-xs p-2 border border-slate-200 rounded bg-slate-50 text-slate-700 font-semibold flex items-center gap-2">
              <lucide-icon name="warehouse" class="w-3.5 h-3.5 text-[#0051a8] shrink-0"></lucide-icon>
              <span class="truncate">{{ garageName }}</span>
            </div>
          </div>
        </div>

        <!-- Row 4: Customer / Fleet Owner Billing Details -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 p-3.5 bg-slate-50 rounded-lg border border-slate-200">
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">
              Customer / Fleet Owner Name
            </label>
            <input
              type="text"
              name="customerName"
              placeholder="e.g. Apex Earthmovers Pvt Ltd"
              [(ngModel)]="customerName"
              class="w-full text-xs p-2 border border-slate-300 rounded bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">
              Customer Contact Number
            </label>
            <input
              type="text"
              name="customerPhone"
              placeholder="e.g. +91 98450 00000"
              [(ngModel)]="customerPhone"
              class="w-full text-xs p-2 border border-slate-300 rounded bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-mono"
            />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">
              Customer Email (For Invoices)
            </label>
            <input
              type="email"
              name="customerEmail"
              placeholder="billing@fleetowner.in"
              [(ngModel)]="customerEmail"
              class="w-full text-xs p-2 border border-slate-300 rounded bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>
        </div>

        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1">Additional Notes</label>
          <textarea
            name="notes"
            rows="3"
            placeholder="Optional chassis notes, telemetry module IDs, or special instructions..."
            [(ngModel)]="notes"
            class="w-full text-xs p-2.5 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-hidden placeholder-slate-400"
          ></textarea>
        </div>

        <div class="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            type="button"
            (click)="cancel.emit()"
            class="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-white border border-slate-300 rounded hover:bg-slate-50 transition-colors shadow-2xs"
          >
            Cancel
          </button>

          <button
            type="submit"
            [disabled]="isSubmitting"
            class="px-5 py-2 text-xs font-bold text-white bg-[#004f9f] hover:bg-[#003d80] rounded shadow-xs transition-colors disabled:opacity-50"
          >
            {{ isSubmitting ? 'Registering...' : 'Register Vehicle' }}
          </button>
        </div>
      </form>
    </div>
  `,
})
export class RegisterVehicleViewComponent {
  private readonly fleetApi = inject(FleetApiService);

  @Input() garageName = '';
  @Output() cancel = new EventEmitter<void>();
  @Output() successNavigate = new EventEmitter<string>();

  selectedCategory: VehicleCategory = 'container_truck';
  registrationNumber = '';
  manufacturer = 'Scania';
  model = 'R 500 A6x2NA';
  manufacturingYear = '2024';
  odometer = '25000';
  engineRunningHours = '640';
  equipmentGroup = 'Heavy Haulage';
  maintenancePlan = 'Flexible Maintenance, M inspection';
  nextScheduledDate = '2026-11-15';
  customerName = '';
  customerPhone = '';
  customerEmail = '';
  notes = '';
  errorMsg: string | null = null;
  successMsg: string | null = null;
  isSubmitting = false;

  readonly categories: { id: VehicleCategory; title: string; filename: string }[] = [
    { id: 'container_truck', title: 'Container Truck', filename: 'container_truck.png' },
    { id: 'dump_truck', title: 'Dump Truck', filename: 'dump_truck.png' },
    { id: 'box_truck', title: 'Box Truck', filename: 'box_truck.png' },
    { id: 'concrete_mixer', title: 'Concrete Mixer', filename: 'concrete_mixer.png' },
    { id: 'tanker_truck', title: 'Tanker Truck', filename: 'tanker_truck.png' },
    { id: 'flatbed_trailer', title: 'Flatbed Trailer', filename: 'flatbed_trailer.png' },
  ];

  getMeta(cat: VehicleCategory) {
    return VEHICLE_CATEGORY_META[cat];
  }

  async handleSubmit(): Promise<void> {
    if (this.isSubmitting) return;
    this.errorMsg = null;

    if (!this.registrationNumber.trim()) {
      this.errorMsg = 'Registration Number is required.';
      return;
    }

    this.isSubmitting = true;
    const res = await this.fleetApi.registerVehicle({
      registrationNumber: this.registrationNumber.trim(),
      category: this.selectedCategory,
      manufacturer: this.manufacturer,
      model: this.model,
      manufacturingYear: parseInt(this.manufacturingYear, 10) || 2024,
      odometer: parseInt(this.odometer, 10) || 0,
      engineRunningHours: parseInt(this.engineRunningHours, 10) || 0,
      equipmentGroup: this.equipmentGroup,
      maintenancePlan: this.maintenancePlan,
      nextServiceDate: this.nextScheduledDate,
      customerName: this.customerName.trim() || undefined,
      customerPhone: this.customerPhone.trim() || undefined,
      customerEmail: this.customerEmail.trim() || undefined,
      notes: this.notes,
    });
    this.isSubmitting = false;

    if (!res.success) {
      this.errorMsg = res.error || 'Failed to register vehicle.';
    } else {
      this.successMsg = `Vehicle ${this.registrationNumber.toUpperCase()} successfully registered!`;
      if (res.vehicleId) {
        const vehId = res.vehicleId;
        setTimeout(() => {
          this.successNavigate.emit(vehId);
        }, 900);
      }
    }
  }
}
