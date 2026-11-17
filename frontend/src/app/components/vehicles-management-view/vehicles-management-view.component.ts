import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import {
  VEHICLE_CATEGORY_META,
  Vehicle,
  VehicleCategory,
} from '../../models/fleet.models';

@Component({
  selector: 'app-vehicles-management-view',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  template: `
    <div class="space-y-5">
      <!-- View Header -->
      <div class="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-200">
        <div>
          <h2 class="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Vehicles Fleet Registry
          </h2>
          <p class="text-xs text-slate-500 mt-0.5">
            Active telemetry and service lifecycle across the 6 calibrated vehicle categories
          </p>
        </div>

        <div class="flex items-center gap-3 flex-wrap">
          <div class="relative">
            <input
              type="text"
              placeholder="Search registration or model..."
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
            class="flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-bold px-3 py-2 rounded shadow-2xs transition-colors whitespace-nowrap"
          >
            <lucide-icon name="plus" class="w-3.5 h-3.5"></lucide-icon>
            <span>Book a Service</span>
          </button>

          <button
            type="button"
            (click)="navigateAddVehicle.emit()"
            class="flex items-center gap-1.5 bg-[#0051a8] hover:bg-[#003d80] text-white text-xs font-bold px-3.5 py-2 rounded shadow-2xs transition-colors whitespace-nowrap"
          >
            <lucide-icon name="plus" class="w-3.5 h-3.5"></lucide-icon>
            <span>+ Register Vehicle</span>
          </button>
        </div>
      </div>

      <!-- 6 Category Filter Bar with Image Thumbnails -->
      <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        @for (cat of categories; track cat.id) {
          <button
            type="button"
            (click)="categoryFilter = cat.id"
            [class]="
              'p-2 rounded-lg border text-left flex flex-col justify-between transition-all ' +
              (categoryFilter === cat.id
                ? 'border-blue-600 bg-blue-50/50 shadow-2xs ring-1 ring-blue-500'
                : 'border-slate-200 hover:border-slate-300 bg-white')
            "
          >
            <div class="h-8 flex items-center justify-center mb-1">
              @if (cat.id !== 'all') {
                <img
                  [src]="getCategoryMeta(cat.id).imagePath"
                  [alt]="getCategoryMeta(cat.id).label"
                  referrerPolicy="no-referrer"
                  class="max-h-full max-w-full object-contain mix-blend-multiply"
                />
              } @else {
                <lucide-icon name="truck" class="w-5 h-5 text-slate-400"></lucide-icon>
              }
            </div>
            <span class="text-[11px] font-bold text-slate-800 truncate">
              {{ cat.label }}
            </span>
          </button>
        }
      </div>

      <!-- Vehicles Grid Cards -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        @for (v of filteredVehicles; track v.id) {
          <div class="bg-white rounded-lg border border-slate-200 p-4 shadow-2xs hover:shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between">
            <div>
              <div class="flex items-start gap-3 mb-3">
                <div
                  (click)="selectVehicle.emit(v.id)"
                  class="w-20 h-14 rounded bg-slate-50 border border-slate-100 flex items-center justify-center p-1 shrink-0 cursor-pointer hover:border-slate-300"
                >
                  <img
                    [src]="getCategoryMeta(v.category).imagePath"
                    [alt]="getCategoryMeta(v.category).label"
                    referrerPolicy="no-referrer"
                    class="max-h-full max-w-full object-contain mix-blend-multiply"
                  />
                </div>

                <div class="flex-1 min-w-0">
                  <div class="flex items-center justify-between gap-1">
                    <button
                      type="button"
                      (click)="selectVehicle.emit(v.id)"
                      class="text-sm font-bold font-mono text-slate-900 hover:text-blue-600 transition-colors tracking-tight"
                    >
                      {{ v.registrationNumber }}
                    </button>
                    <span class="text-[10px] font-mono font-semibold text-slate-400 uppercase bg-slate-100 px-1.5 py-0.5 rounded">
                      {{ getCategoryMeta(v.category).label }}
                    </span>
                  </div>

                  <p class="text-xs font-semibold text-slate-700 mt-0.5">{{ v.model }}</p>
                  <p class="text-[11px] font-mono text-slate-400">{{ v.equipmentGroup }}</p>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-2 py-2 border-y border-slate-100 text-[11px] mb-3">
                <div>
                  <span class="text-slate-400 block">Odometer</span>
                  <span class="font-mono font-bold text-slate-800">
                    {{ v.odometer.toLocaleString() }} km
                  </span>
                </div>

                <div>
                  <span class="text-slate-400 block">Next Service</span>
                  <span class="font-mono font-bold text-slate-800">
                    {{ v.nextServiceDate }}
                  </span>
                </div>
              </div>

              <div class="flex items-center gap-2 mb-2 flex-wrap">
                @if (getDelayedCount(v) > 0) {
                  <span class="text-[10px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
                    {{ getDelayedCount(v) }} Delayed Activities
                  </span>
                }
                @if (getRepairCount(v) > 0) {
                  <span class="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                    {{ getRepairCount(v) }} Repairs Pending
                  </span>
                }
                @if (getDelayedCount(v) === 0 && getRepairCount(v) === 0) {
                  <span class="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                    Fully In Service
                  </span>
                }
              </div>
            </div>

            <div class="pt-3 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                (click)="selectVehicle.emit(v.id)"
                class="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <span>Vehicle Profile</span>
                <lucide-icon name="chevron-right" class="w-3.5 h-3.5"></lucide-icon>
              </button>

              <button
                type="button"
                (click)="openBookingWizard.emit(v.id)"
                class="px-2.5 py-1 text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded transition-colors"
              >
                Book Service
              </button>
            </div>
          </div>
        }
      </div>
    </div>
  `,
})
export class VehiclesManagementViewComponent {
  @Input() vehicles: Vehicle[] = [];
  @Output() selectVehicle = new EventEmitter<string>();
  @Output() openBookingWizard = new EventEmitter<string | undefined>();
  @Output() navigateAddVehicle = new EventEmitter<void>();

  categoryFilter: 'all' | VehicleCategory = 'all';
  search = '';

  readonly categories: { id: 'all' | VehicleCategory; label: string }[] = [
    { id: 'all', label: 'All Fleet Categories' },
    { id: 'box_truck', label: 'Box Truck' },
    { id: 'container_truck', label: 'Container Truck' },
    { id: 'dump_truck', label: 'Dump Truck' },
    { id: 'concrete_mixer', label: 'Concrete Mixer' },
    { id: 'flatbed_trailer', label: 'Flatbed Trailer' },
    { id: 'tanker_truck', label: 'Tanker Truck' },
  ];

  get filteredVehicles(): Vehicle[] {
    const q = this.search.trim().toLowerCase();
    return this.vehicles.filter((v) => {
      const matchesCategory = this.categoryFilter === 'all' || v.category === this.categoryFilter;
      const matchesSearch =
        q === '' ||
        v.registrationNumber.toLowerCase().includes(q) ||
        v.model.toLowerCase().includes(q) ||
        v.equipmentGroup.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }

  getCategoryMeta(cat: VehicleCategory) {
    return VEHICLE_CATEGORY_META[cat];
  }

  getDelayedCount(v: Vehicle): number {
    return v.maintenanceChecklist.filter((m) => m.status === 'delayed').length;
  }

  getRepairCount(v: Vehicle): number {
    return v.repairChecklist.filter((r) => !r.resolved).length;
  }
}
