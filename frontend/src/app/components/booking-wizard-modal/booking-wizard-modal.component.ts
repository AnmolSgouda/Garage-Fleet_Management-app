import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { FleetApiService } from '../../services/fleet-api.service';
import {
  GarageConfig,
  InventoryItem,
  JobEstimatedMaterialLine,
  ServiceTemplate,
  Supplier,
  VEHICLE_CATEGORY_META,
  Vehicle,
} from '../../models/fleet.models';

@Component({
  selector: 'app-booking-wizard-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  template: `
    @if (isOpen) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
        <div class="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-3xl w-full overflow-hidden flex flex-col max-h-[88vh]">
          <!-- Wizard Header -->
          <div class="bg-[#071322] text-white px-6 py-4 flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded bg-[#0051a8] text-white flex items-center justify-center shadow-xs">
                <lucide-icon name="wrench" class="w-4 h-4"></lucide-icon>
              </div>
              <div>
                <h3 class="text-sm font-bold tracking-wide uppercase">
                  6-STEP SERVICE BOOKING &amp; MATERIAL ESTIMATION
                </h3>
                <p class="text-[11px] text-slate-400">
                  Step {{ currentStep }} of 6: {{ stepTitles[currentStep - 1] }}
                </p>
              </div>
            </div>

            <button
              type="button"
              (click)="close.emit()"
              class="text-slate-400 hover:text-white p-1 rounded transition-colors"
              aria-label="Close"
            >
              <lucide-icon name="x" class="w-5 h-5"></lucide-icon>
            </button>
          </div>

          <!-- Step Progress Bar -->
          <div class="bg-slate-100 px-6 py-2 border-b border-slate-200 flex items-center justify-between text-[11px] font-mono">
            @for (title of stepTitles; track title; let idx = $index) {
              <div
                [class]="
                  'flex items-center gap-1.5 ' +
                  (idx + 1 === currentStep
                    ? 'text-blue-700 font-bold'
                    : idx + 1 < currentStep
                    ? 'text-emerald-700 font-medium'
                    : 'text-slate-400')
                "
              >
                <span
                  [class]="
                    'w-5 h-5 rounded-full flex items-center justify-center text-[10px] ' +
                    (idx + 1 === currentStep
                      ? 'bg-blue-600 text-white'
                      : idx + 1 < currentStep
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-200 text-slate-600')
                  "
                >
                  {{ idx + 1 < currentStep ? '✓' : idx + 1 }}
                </span>
                <span class="hidden md:inline">{{ title.split(' ')[0] }}</span>
              </div>
            }
          </div>

          <!-- Body -->
          <div class="p-6 overflow-y-auto flex-1 text-xs">
            @if (conflictError) {
              <div class="mb-4 p-3 bg-rose-50 border border-rose-200 rounded text-rose-800 flex items-start gap-2">
                <lucide-icon
                  name="triangle-alert"
                  class="w-4 h-4 text-rose-600 shrink-0 mt-0.5"
                ></lucide-icon>
                <div>
                  <p class="font-bold">Booking Conflict Detected</p>
                  <p class="mt-0.5 leading-snug">{{ conflictError }}</p>
                </div>
              </div>
            }

            <!-- STEP 1: Select Vehicle -->
            @if (currentStep === 1) {
              <div class="space-y-4">
                <div>
                  <h4 class="text-sm font-bold text-slate-900 mb-1">
                    1. Select Target Fleet Vehicle
                  </h4>
                  <p class="text-slate-500 mb-3">
                    Choose from the 6 calibrated vehicle categories in {{ garageConfig.garageName }}
                  </p>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  @for (v of vehicles; track v.id) {
                    <div
                      (click)="handleVehicleSelect(v)"
                      [class]="
                        'p-3 rounded-lg border text-left cursor-pointer transition-all flex items-center gap-3 ' +
                        (selectedVehicleId === v.id
                          ? 'border-[#0051a8] bg-blue-50/50 ring-2 ring-blue-500/20'
                          : 'border-slate-200 hover:border-slate-300 bg-white')
                      "
                    >
                      <div class="w-16 h-12 rounded bg-slate-50 border border-slate-100 flex items-center justify-center p-1 shrink-0">
                        <img
                          [src]="getMeta(v).imagePath"
                          [alt]="getMeta(v).label"
                          referrerPolicy="no-referrer"
                          class="max-h-full max-w-full object-contain mix-blend-multiply"
                        />
                      </div>

                      <div class="flex-1 min-w-0">
                        <div class="flex items-center justify-between">
                          <span class="font-bold font-mono text-slate-900 text-xs">
                            {{ v.registrationNumber }}
                          </span>
                          <span class="text-[10px] font-mono text-slate-500">
                            {{ v.odometer.toLocaleString() }} km
                          </span>
                        </div>
                        <p class="text-[11px] font-semibold text-slate-700 truncate">
                          {{ v.model }}
                        </p>
                        <p class="text-[10px] text-slate-400">
                          {{ getMeta(v).label }} · {{ v.equipmentGroup }}
                        </p>
                      </div>
                    </div>
                  }
                </div>
              </div>
            }

            <!-- STEP 2: Service Type Template Selection -->
            @if (currentStep === 2) {
              <div class="space-y-4">
                <div class="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
                  <div class="flex items-center gap-2.5">
                    <lucide-icon name="warehouse" class="w-4 h-4 text-[#0051a8]"></lucide-icon>
                    <div>
                      <p class="font-bold text-slate-900">{{ garageConfig.garageName }}</p>
                      <p class="text-[11px] text-slate-500">{{ garageConfig.address }}</p>
                    </div>
                  </div>
                  <span class="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Single Garage Active
                  </span>
                </div>

                <div>
                  <h4 class="text-sm font-bold text-slate-900 mb-1">
                    2. Select Service Type (Auto-Predicts Spare Parts)
                  </h4>
                  <p class="text-slate-500 mb-3">
                    Selecting a service type loads its default spare-parts bill of materials and base labour estimate.
                  </p>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  @for (tpl of serviceTemplates; track tpl.id) {
                    <div
                      (click)="handleSelectServiceType(tpl.name)"
                      [class]="
                        'p-3 rounded-lg border cursor-pointer transition-all ' +
                        (selectedServiceType === tpl.name
                          ? 'border-[#0051a8] bg-blue-50/50 ring-2 ring-blue-500/20'
                          : 'border-slate-200 hover:border-slate-300 bg-white')
                      "
                    >
                      <div class="flex items-center justify-between">
                        <h5 class="font-bold text-slate-900">{{ tpl.name }}</h5>
                        <span class="text-[11px] font-mono font-bold text-slate-700">
                          {{ garageConfig.currencySymbol }}{{ tpl.defaultLabourCharge.toLocaleString() }}
                        </span>
                      </div>
                      <p class="text-[11px] text-slate-500 mt-0.5 leading-snug">
                        {{ tpl.description }}
                      </p>
                      <p class="text-[10px] font-mono text-blue-700 mt-1.5 font-semibold">
                        {{ tpl.materials.length }} template part{{ tpl.materials.length === 1 ? '' : 's' }}
                      </p>
                    </div>
                  }
                </div>

                <div class="pt-2">
                  <p class="text-[11px] font-bold text-slate-700 uppercase mb-2">
                    Additional Inspection Activities
                  </p>
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    @for (svc of availablePackages; track svc.id) {
                      <label
                        [class]="
                          'p-2.5 rounded border cursor-pointer flex items-start gap-2.5 ' +
                          (selectedActivities.includes(svc.id)
                            ? 'border-blue-500 bg-blue-50/30'
                            : 'border-slate-200 bg-white hover:border-slate-300')
                        "
                      >
                        <input
                          type="checkbox"
                          [checked]="selectedActivities.includes(svc.id)"
                          (change)="toggleActivity(svc.id)"
                          class="mt-0.5 rounded border-slate-300 text-blue-600"
                        />
                        <div>
                          <div class="font-semibold text-slate-800">{{ svc.id }}</div>
                          <div class="text-[10px] text-slate-500">{{ svc.desc }}</div>
                        </div>
                      </label>
                    }
                  </div>
                </div>
              </div>
            }

            <!-- STEP 3: Preliminary Material Estimation & Stock Comparison -->
            @if (currentStep === 3) {
              <div class="space-y-4">
                <div class="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h4 class="text-sm font-bold text-slate-900 mb-1">
                      3. Preliminary Spare-Parts Estimate ({{ selectedServiceType }})
                    </h4>
                    <p class="text-slate-500">
                      Review estimated quantities against live garage stock before work begins.
                    </p>
                  </div>
                  <span class="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-blue-50 text-blue-800 border border-blue-200 px-2.5 py-1 rounded">
                    <lucide-icon name="package" class="w-3.5 h-3.5"></lucide-icon>
                    <span>Estimation only — Zero stock deduction</span>
                  </span>
                </div>

                @if (hasInsufficient || hasLowWarning) {
                  <div
                    [class]="
                      'p-3 rounded-lg border flex items-start gap-2.5 ' +
                      (hasInsufficient
                        ? 'bg-rose-50 border-rose-200 text-rose-900'
                        : 'bg-amber-50 border-amber-200 text-amber-900')
                    "
                  >
                    <lucide-icon
                      name="shield-alert"
                      [class]="
                        'w-4 h-4 shrink-0 mt-0.5 ' +
                        (hasInsufficient ? 'text-rose-600' : 'text-amber-600')
                      "
                    ></lucide-icon>
                    <div>
                      <p class="font-bold">
                        {{
                          hasInsufficient
                            ? 'Insufficient Inventory Warning'
                            : 'Low Stock Threshold Warning'
                        }}
                      </p>
                      <p class="text-[11px] mt-0.5">
                        {{
                          hasInsufficient
                            ? 'One or more estimated parts exceed current stock on hand. You may still book this service, and order parts from the listed supplier before invoice generation.'
                            : 'Fulfilling this estimate will leave stock below minimum threshold. Consider replenishing soon.'
                        }}
                      </p>
                    </div>
                  </div>
                }

                <div class="border border-slate-200 rounded-lg overflow-hidden">
                  <table class="w-full text-left text-xs">
                    <thead class="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase text-slate-500">
                      <tr>
                        <th class="py-2 px-3">Part / SKU</th>
                        <th class="py-2 px-3 text-right">Estimated Qty</th>
                        <th class="py-2 px-3 text-right">Available</th>
                        <th class="py-2 px-3">Stock Check</th>
                        <th class="py-2 px-3 text-right">Est. Subtotal</th>
                        <th class="py-2 px-2"></th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
                      @if (stockAnalysis.length === 0) {
                        <tr>
                          <td colspan="6" class="py-5 text-center text-slate-400">
                            No template materials pre-selected. Add parts below or continue with labour only.
                          </td>
                        </tr>
                      } @else {
                        @for (row of stockAnalysis; track row.id) {
                          <tr class="hover:bg-slate-50/60">
                            <td class="py-2.5 px-3">
                              <div class="font-semibold text-slate-900">{{ row.partName }}</div>
                              <div class="text-[10px] font-mono text-slate-400">{{ row.sku }}</div>
                            </td>
                            <td class="py-2.5 px-3 text-right">
                              <div class="inline-flex items-center gap-1.5 justify-end">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.5"
                                  [ngModel]="row.estimatedQuantity"
                                  (ngModelChange)="handleUpdateEstQty(row.id, $event)"
                                  class="w-16 text-right font-mono font-bold p-1 border border-slate-300 rounded bg-white"
                                />
                                <span class="text-[11px] text-slate-500 w-12 text-left">
                                  {{ row.unit }}
                                </span>
                              </div>
                            </td>
                            <td class="py-2.5 px-3 text-right font-mono font-semibold text-slate-700">
                              {{ row.available }} {{ row.unit }}
                            </td>
                            <td class="py-2.5 px-3">
                              @if (row.availabilityState === 'sufficient') {
                                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  Sufficient Stock
                                </span>
                              } @else if (row.availabilityState === 'low') {
                                <div>
                                  <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                    Low Stock Warning
                                  </span>
                                  <div class="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1">
                                    <lucide-icon name="phone" class="w-2.5 h-2.5"></lucide-icon>
                                    <span>{{ row.supplierName }} ({{ row.supplierPhone }})</span>
                                  </div>
                                </div>
                              } @else {
                                <div>
                                  <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                    Short by {{ row.shortage }} {{ row.unit }}
                                  </span>
                                  <div class="text-[10px] text-rose-700 mt-0.5 flex items-center gap-1">
                                    <lucide-icon name="phone" class="w-2.5 h-2.5"></lucide-icon>
                                    <span>{{ row.supplierName }} ({{ row.supplierPhone }})</span>
                                  </div>
                                </div>
                              }
                            </td>
                            <td class="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                              {{ garageConfig.currencySymbol }}{{ formatMoney(row.estimatedQuantity * row.unitPrice) }}
                            </td>
                            <td class="py-2.5 px-2 text-right">
                              <button
                                type="button"
                                (click)="handleRemoveEstLine(row.id)"
                                class="p-1 text-slate-400 hover:text-rose-600 rounded"
                                title="Remove item from estimate"
                              >
                                <lucide-icon name="trash-2" class="w-3.5 h-3.5"></lucide-icon>
                              </button>
                            </td>
                          </tr>
                        }
                      }
                    </tbody>
                  </table>
                </div>

                <!-- Add another part to estimate -->
                <div class="p-3 bg-slate-50 rounded-lg border border-slate-200 flex flex-wrap items-end gap-2.5">
                  <div class="flex-1 min-w-[180px]">
                    <label class="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                      Add Part to Estimate
                    </label>
                    <select
                      [(ngModel)]="addPartId"
                      class="w-full text-xs p-2 border border-slate-300 rounded bg-white"
                    >
                      @for (item of activeInventoryItems; track item.id) {
                        <option [value]="item.id">
                          {{ item.partName }} ({{ item.sku }}) — Avail: {{ item.quantityOnHand }} {{ item.unit }}
                        </option>
                      }
                    </select>
                  </div>
                  <div class="w-24">
                    <label class="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                      Qty
                    </label>
                    <input
                      type="number"
                      min="0.1"
                      step="0.5"
                      [(ngModel)]="addPartQty"
                      class="w-full text-xs p-2 border border-slate-300 rounded bg-white font-mono"
                    />
                  </div>
                  <button
                    type="button"
                    (click)="handleAddEstPart()"
                    class="flex items-center gap-1 px-3 py-2 text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 rounded"
                  >
                    <lucide-icon name="plus" class="w-3.5 h-3.5"></lucide-icon>
                    <span>Add Part</span>
                  </button>
                </div>

                <!-- Estimated Cost Summary -->
                <div class="grid grid-cols-3 gap-3 p-3 bg-slate-900 text-white rounded-lg text-xs">
                  <div>
                    <span class="text-slate-400 block text-[10px] uppercase">Est. Materials</span>
                    <span class="font-mono font-bold text-sm">
                      {{ garageConfig.currencySymbol }}{{ formatMoney(estimatedPartsTotal) }}
                    </span>
                  </div>
                  <div>
                    <span class="text-slate-400 block text-[10px] uppercase">Est. Labour</span>
                    <input
                      type="number"
                      min="0"
                      [ngModel]="estimatedLabour"
                      (ngModelChange)="onLabourChange($event)"
                      class="mt-0.5 w-28 px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-white font-mono font-bold text-xs"
                    />
                  </div>
                  <div class="text-right">
                    <span class="text-slate-400 block text-[10px] uppercase">
                      Preliminary Total (Pre-Tax)
                    </span>
                    <span class="font-mono font-bold text-sm text-cyan-300">
                      {{ garageConfig.currencySymbol }}{{ formatMoney(estimatedPartsTotal + estimatedLabour) }}
                    </span>
                  </div>
                </div>
              </div>
            }

            <!-- STEP 4: Date & Time Bay Slot -->
            @if (currentStep === 4) {
              <div class="space-y-4">
                <div>
                  <h4 class="text-sm font-bold text-slate-900 mb-1">
                    4. Schedule Bay Date &amp; Time Window
                  </h4>
                  <p class="text-slate-500 mb-3">
                    System prevents overlapping appointments for the same vehicle
                  </p>
                </div>

                <div class="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-4">
                  <div>
                    <label class="block text-xs font-bold text-slate-700 uppercase mb-1">
                      Booking Date
                    </label>
                    <input
                      type="date"
                      required
                      [(ngModel)]="date"
                      (ngModelChange)="conflictError = null"
                      class="w-full text-xs p-2 border border-slate-300 rounded bg-white font-mono"
                    />
                  </div>

                  <div class="grid grid-cols-2 gap-3">
                    <div>
                      <label class="block text-xs font-bold text-slate-700 uppercase mb-1">
                        Start Slot (07:00 - 17:00)
                      </label>
                      <input
                        type="time"
                        required
                        [(ngModel)]="startTime"
                        (ngModelChange)="conflictError = null"
                        class="w-full text-xs p-2 border border-slate-300 rounded bg-white font-mono"
                      />
                    </div>

                    <div>
                      <label class="block text-xs font-bold text-slate-700 uppercase mb-1">
                        Expected End Slot
                      </label>
                      <input
                        type="time"
                        required
                        [(ngModel)]="endTime"
                        (ngModelChange)="conflictError = null"
                        class="w-full text-xs p-2 border border-slate-300 rounded bg-white font-mono"
                      />
                    </div>
                  </div>

                  <div class="text-[11px] text-slate-500 flex items-center gap-1.5 pt-1">
                    <lucide-icon name="clock" class="w-3.5 h-3.5 text-blue-600"></lucide-icon>
                    <span>Standard service allocation is 2.5 - 4.0 workshop bay hours.</span>
                  </div>
                </div>
              </div>
            }

            <!-- STEP 5: Customer Contact & Defect Notes -->
            @if (currentStep === 5) {
              <div class="space-y-4">
                <div>
                  <h4 class="text-sm font-bold text-slate-900 mb-1">
                    5. Customer Contact &amp; Driver Defect Notes
                  </h4>
                  <p class="text-slate-500 mb-3">
                    Customer contact info will pre-fill the final GST invoice upon job completion.
                  </p>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-slate-50 rounded-lg border border-slate-200">
                  <div>
                    <label class="block text-[11px] font-bold text-slate-700 mb-1">
                      Customer Name *
                    </label>
                    <input
                      type="text"
                      [(ngModel)]="customerName"
                      placeholder="Fleet Owner / Company"
                      class="w-full text-xs p-2 border border-slate-300 rounded bg-white"
                    />
                  </div>
                  <div>
                    <label class="block text-[11px] font-bold text-slate-700 mb-1">
                      Contact Number
                    </label>
                    <input
                      type="text"
                      [(ngModel)]="customerPhone"
                      placeholder="+91 ..."
                      class="w-full text-xs p-2 border border-slate-300 rounded bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label class="block text-[11px] font-bold text-slate-700 mb-1">
                      Billing Email
                    </label>
                    <input
                      type="email"
                      [(ngModel)]="customerEmail"
                      placeholder="accounts@client.in"
                      class="w-full text-xs p-2 border border-slate-300 rounded bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label class="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Driver Remarks / Unplanned Defect Notes
                  </label>
                  <textarea
                    rows="4"
                    placeholder="e.g. Driver reported faint squeal during regenerative braking. Please inspect brake calipers and lubricate coupling pins."
                    [(ngModel)]="unplannedNotes"
                    class="w-full text-xs p-2.5 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  ></textarea>
                </div>
              </div>
            }

            <!-- STEP 6: Review & Submit -->
            @if (currentStep === 6 && currentVehicle; as veh) {
              <div class="space-y-4">
                <div>
                  <h4 class="text-sm font-bold text-slate-900 mb-1">
                    6. Review &amp; Confirm Booking Proposal
                  </h4>
                  <p class="text-slate-500 mb-3">
                    Creates booking in Preliminary Bookings with preliminary material estimate attached. Stock remains untouched.
                  </p>
                </div>

                <div class="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-2.5">
                  <div class="flex items-center justify-between pb-2 border-b border-slate-200">
                    <span class="text-slate-500">Vehicle:</span>
                    <span class="font-mono font-bold text-slate-900 text-sm">
                      {{ veh.registrationNumber }} ({{ veh.model }})
                    </span>
                  </div>
                  <div class="flex items-center justify-between pb-2 border-b border-slate-200">
                    <span class="text-slate-500">Garage Facility:</span>
                    <span class="font-semibold text-slate-800">{{ garageConfig.garageName }}</span>
                  </div>
                  <div class="flex items-center justify-between pb-2 border-b border-slate-200">
                    <span class="text-slate-500">Service Type:</span>
                    <span class="font-bold text-slate-900">{{ selectedServiceType }}</span>
                  </div>
                  <div class="flex items-center justify-between pb-2 border-b border-slate-200">
                    <span class="text-slate-500">Scheduled Slot:</span>
                    <span class="font-mono font-bold text-blue-700">
                      {{ date }} at {{ startTime }} - {{ endTime }}
                    </span>
                  </div>
                  <div class="flex items-center justify-between pb-2 border-b border-slate-200">
                    <span class="text-slate-500">Estimated Materials:</span>
                    <span class="font-mono font-semibold text-slate-800">
                      {{ estimatedMaterials.length }} item(s) · {{ garageConfig.currencySymbol }}{{ formatMoney(estimatedPartsTotal) }}
                    </span>
                  </div>
                  <div class="flex items-center justify-between">
                    <span class="text-slate-500">Estimated Total (Parts + Labour):</span>
                    <span class="font-mono font-bold text-slate-900 text-sm">
                      {{ garageConfig.currencySymbol }}{{ formatMoney(estimatedPartsTotal + estimatedLabour) }}
                    </span>
                  </div>
                </div>
              </div>
            }
          </div>

          <!-- Footer Controls -->
          <div class="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            <button
              type="button"
              [disabled]="currentStep === 1"
              (click)="handlePrevStep()"
              class="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-30 disabled:pointer-events-none rounded border border-slate-300 bg-white"
            >
              <lucide-icon name="chevron-left" class="w-3.5 h-3.5"></lucide-icon>
              <span>Previous</span>
            </button>

            <div class="flex items-center gap-2">
              <button
                type="button"
                (click)="close.emit()"
                class="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800"
              >
                Cancel
              </button>

              @if (currentStep < 6) {
                <button
                  type="button"
                  (click)="handleNextStep()"
                  class="flex items-center gap-1 px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded shadow-xs"
                >
                  <span>Continue</span>
                  <lucide-icon name="chevron-right" class="w-3.5 h-3.5"></lucide-icon>
                </button>
              } @else {
                <button
                  type="button"
                  [disabled]="isSubmitting"
                  (click)="handleFinalSubmit()"
                  class="flex items-center gap-1.5 px-5 py-1.5 text-xs font-bold text-white bg-[#0051a8] hover:bg-[#003d80] rounded shadow-xs disabled:opacity-50"
                >
                  <lucide-icon name="check" class="w-4 h-4"></lucide-icon>
                  <span>{{ isSubmitting ? 'Booking...' : 'Confirm Service Booking' }}</span>
                </button>
              }
            </div>
          </div>
        </div>
      </div>
    }
  `,
})
export class BookingWizardModalComponent implements OnChanges {
  private readonly fleetApi = inject(FleetApiService);

  @Input() isOpen = false;
  @Input() vehicles: Vehicle[] = [];
  @Input() garageConfig!: GarageConfig;
  @Input() serviceTemplates: ServiceTemplate[] = [];
  @Input() inventory: InventoryItem[] = [];
  @Input() suppliers: Supplier[] = [];
  @Input() preselectedVehicleId?: string;
  @Input() prefillDate?: string;
  @Input() prefillStartTime?: string;

  @Output() close = new EventEmitter<void>();

  currentStep = 1;
  selectedVehicleId = '';
  selectedServiceType = 'General Service';
  selectedActivities: string[] = ['Flexible Maintenance', 'M Inspection'];
  estimatedMaterials: JobEstimatedMaterialLine[] = [];
  estimatedLabour = 1800;
  addPartId = '';
  addPartQty = '1';

  customerName = '';
  customerPhone = '';
  customerEmail = '';

  date = '2023-09-27';
  startTime = '08:00';
  endTime = '11:30';
  unplannedNotes = '';
  conflictError: string | null = null;
  isSubmitting = false;

  readonly availablePackages = [
    { id: 'Flexible Maintenance', desc: 'Standard engine, oil, filter & diagnostics service' },
    { id: 'M Inspection', desc: 'Mandatory chassis, steering, and suspension stress audit' },
    { id: 'X Inspection', desc: 'Emission control, exhaust aftertreatment, and brake test' },
    { id: 'Tail Lift & Hydraulics', desc: 'Cylinder pressure test and fluid seal overhaul' },
  ];

  readonly stepTitles = [
    'Vehicle Selection',
    'Service Type & Garage',
    'Material Estimate',
    'Date & Time Slot',
    'Customer & Notes',
    'Review & Submit',
  ];

  ngOnChanges(changes: SimpleChanges): void {
    if (
      changes['isOpen']?.currentValue === true ||
      (this.isOpen &&
        (changes['preselectedVehicleId'] ||
          changes['prefillDate'] ||
          changes['prefillStartTime']))
    ) {
      this.resetWizardState();
    }
  }

  private resetWizardState(): void {
    this.currentStep = 1;
    this.conflictError = null;
    const vId = this.preselectedVehicleId || this.vehicles[0]?.id || '';
    this.selectedVehicleId = vId;
    const veh = this.vehicles.find((v) => v.id === vId);
    if (veh) {
      this.customerName = veh.customerName || '';
      this.customerPhone = veh.customerPhone || '';
      this.customerEmail = veh.customerEmail || '';
    }
    this.date = this.prefillDate || '2023-09-27';
    if (this.prefillStartTime) {
      this.startTime = this.prefillStartTime;
      const [h, m] = this.prefillStartTime.split(':').map(Number);
      const endH = Math.min(17, h + 3);
      this.endTime = `${String(endH).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}`;
    } else {
      this.startTime = '08:00';
      this.endTime = '11:30';
    }
    const defaultType = this.serviceTemplates[0]?.name || 'General Service';
    this.selectedServiceType = defaultType;
    const est = this.fleetApi.buildEstimateFromTemplate(defaultType);
    this.estimatedMaterials = est.estimatedMaterials;
    this.estimatedLabour = est.defaultLabour;
    this.addPartId = this.activeInventoryItems[0]?.id || '';
    this.addPartQty = '1';
    this.unplannedNotes = '';
  }

  get currentVehicle(): Vehicle | undefined {
    return this.vehicles.find((v) => v.id === this.selectedVehicleId) || this.vehicles[0];
  }

  get activeInventoryItems(): InventoryItem[] {
    return this.inventory.filter((i) => i.isActive);
  }

  get estimatedPartsTotal(): number {
    return this.estimatedMaterials.reduce(
      (sum, m) => sum + m.estimatedQuantity * m.unitPrice,
      0
    );
  }

  get stockAnalysis() {
    return this.estimatedMaterials.map((em) => {
      const inv = this.inventory.find((i) => i.id === em.inventoryItemId);
      const available = inv?.quantityOnHand ?? 0;
      const minStock = inv?.minimumStock ?? 0;
      const shortage = Math.max(0, Math.round((em.estimatedQuantity - available) * 100) / 100);
      const supplier = this.suppliers.find((s) => s.id === inv?.supplierId);

      let availabilityState: 'sufficient' | 'low' | 'insufficient' = 'sufficient';
      if (available < em.estimatedQuantity) {
        availabilityState = 'insufficient';
      } else if (available - em.estimatedQuantity < minStock || available < minStock) {
        availabilityState = 'low';
      }

      return {
        ...em,
        available,
        shortage,
        availabilityState,
        supplierName: supplier?.name || inv?.supplierName || '-',
        supplierPhone: supplier?.mobile || '-',
      };
    });
  }

  get hasInsufficient(): boolean {
    return this.stockAnalysis.some((s) => s.availabilityState === 'insufficient');
  }

  get hasLowWarning(): boolean {
    return this.stockAnalysis.some((s) => s.availabilityState === 'low');
  }

  getMeta(v: Vehicle) {
    return VEHICLE_CATEGORY_META[v.category];
  }

  formatMoney(val: number): string {
    return val.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  handleVehicleSelect(v: Vehicle): void {
    this.selectedVehicleId = v.id;
    this.customerName = v.customerName || '';
    this.customerPhone = v.customerPhone || '';
    this.customerEmail = v.customerEmail || '';
  }

  handleSelectServiceType(typeName: string): void {
    this.selectedServiceType = typeName;
    const est = this.fleetApi.buildEstimateFromTemplate(typeName);
    this.estimatedMaterials = est.estimatedMaterials;
    this.estimatedLabour = est.defaultLabour;
  }

  handleUpdateEstQty(lineId: string, qtyVal: number): void {
    const val = Number(qtyVal) || 0;
    this.estimatedMaterials = this.estimatedMaterials.map((m) =>
      m.id === lineId ? { ...m, estimatedQuantity: Math.max(0, Math.round(val * 100) / 100) } : m
    );
  }

  handleRemoveEstLine(lineId: string): void {
    this.estimatedMaterials = this.estimatedMaterials.filter((m) => m.id !== lineId);
  }

  handleAddEstPart(): void {
    const targetId = this.addPartId || this.activeInventoryItems[0]?.id;
    const inv = this.activeInventoryItems.find((i) => i.id === targetId);
    const qty = Math.max(0.1, Math.round((parseFloat(this.addPartQty) || 1) * 100) / 100);
    if (!inv) return;

    const existing = this.estimatedMaterials.find((m) => m.inventoryItemId === inv.id);
    if (existing) {
      this.handleUpdateEstQty(existing.id, existing.estimatedQuantity + qty);
    } else {
      this.estimatedMaterials = [
        ...this.estimatedMaterials,
        {
          id: `est-${Date.now()}`,
          inventoryItemId: inv.id,
          partName: inv.partName,
          sku: inv.sku,
          unit: inv.unit,
          estimatedQuantity: qty,
          unitPrice: inv.sellingPrice,
        },
      ];
    }
    this.addPartQty = '1';
  }

  onLabourChange(val: number): void {
    this.estimatedLabour = Math.max(0, Number(val) || 0);
  }

  toggleActivity(svc: string): void {
    if (this.selectedActivities.includes(svc)) {
      this.selectedActivities = this.selectedActivities.filter((s) => s !== svc);
    } else {
      this.selectedActivities = [...this.selectedActivities, svc];
    }
  }

  handleNextStep(): void {
    if (this.currentStep === 4 && this.startTime >= this.endTime) {
      this.conflictError = 'End time must be after start time.';
      return;
    }
    this.conflictError = null;
    this.currentStep = Math.min(6, this.currentStep + 1);
  }

  handlePrevStep(): void {
    this.conflictError = null;
    this.currentStep = Math.max(1, this.currentStep - 1);
  }

  async handleFinalSubmit(): Promise<void> {
    if (!this.currentVehicle || this.isSubmitting) return;
    this.isSubmitting = true;

    const activitySummary =
      this.selectedActivities.length > 0
        ? `${this.selectedServiceType} — ${this.selectedActivities.join(', ')}`
        : this.selectedServiceType;

    const res = await this.fleetApi.createBooking({
      vehicleId: this.currentVehicle.id,
      vehicleReg: this.currentVehicle.registrationNumber,
      vehicleCategory: this.currentVehicle.category,
      vehicleModel: this.currentVehicle.model,
      equipmentGroup: this.currentVehicle.equipmentGroup,
      title: `${this.currentVehicle.registrationNumber} ${this.selectedServiceType}`,
      serviceType: this.selectedServiceType,
      serviceActivities: activitySummary,
      workshopLocation: this.garageConfig.garageName,
      workflowColumn: 'preliminary_bookings',
      calendarStatus: 'preliminary',
      date: this.date,
      startTime: this.startTime,
      endTime: this.endTime,
      badgeType: 'pending',
      badgeDateStr: `${this.date}, ${this.startTime}`,
      notes: this.unplannedNotes,
      customerName:
        this.customerName.trim() || this.currentVehicle.customerName || 'Fleet Customer',
      customerPhone:
        this.customerPhone.trim() || this.currentVehicle.customerPhone || '-',
      customerEmail:
        this.customerEmail.trim() || this.currentVehicle.customerEmail || '',
      estimatedMaterials: this.estimatedMaterials.filter((m) => m.estimatedQuantity > 0),
      labourCharges: this.estimatedLabour,
    });
    this.isSubmitting = false;

    if (!res.success) {
      this.conflictError =
        res.error || 'Failed to create booking due to schedule conflict.';
      this.currentStep = 4;
      return;
    }

    this.close.emit();
  }
}
