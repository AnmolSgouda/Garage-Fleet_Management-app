import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { FleetApiService } from '../../services/fleet-api.service';
import {
  GarageConfig,
  InventoryItem,
  ServiceBooking,
  Vehicle,
} from '../../models/fleet.models';

@Component({
  selector: 'app-repair-job-consumption-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  template: `
    @if (isOpen && booking; as bk) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
        <div class="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-4xl w-full overflow-hidden flex flex-col max-h-[90vh]">
          <!-- Header -->
          <div class="bg-[#071322] text-white px-6 py-4 flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded bg-[#0051a8] flex items-center justify-center">
                <lucide-icon name="wrench" class="w-4 h-4"></lucide-icon>
              </div>
              <div>
                <h3 class="text-sm font-bold tracking-wide uppercase">
                  Service Material Consumption · #{{ bk.bookingRef }}
                </h3>
                <p class="text-[11px] text-slate-300 font-mono">
                  {{ bk.vehicleReg }} ({{ bk.vehicleModel }}) · {{ bk.serviceType || 'General Service' }}
                </p>
              </div>
            </div>
            <button
              type="button"
              (click)="close.emit()"
              class="text-slate-400 hover:text-white p-1"
            >
              <lucide-icon name="x" class="w-5 h-5"></lucide-icon>
            </button>
          </div>

          <!-- Body -->
          <div class="p-6 overflow-y-auto space-y-6 text-xs">
            <div
              [class]="
                'p-3 rounded-lg border flex items-center justify-between gap-3 ' +
                (isLocked
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-blue-50 border-blue-200 text-blue-900')
              "
            >
              <div class="flex items-center gap-2">
                @if (isLocked) {
                  <lucide-icon name="circle-check" class="w-4 h-4 text-emerald-600 shrink-0"></lucide-icon>
                } @else {
                  <lucide-icon name="info" class="w-4 h-4 text-blue-600 shrink-0"></lucide-icon>
                }
                <span class="font-semibold">
                  {{
                    isLocked
                      ? 'Invoice ' + bk.invoiceNumber + ' has been generated and stock has been deducted. Material records are locked.'
                      : 'Mechanic Consumption Log: Inventory is NOT deducted while adding or editing materials here. Stock deducts only upon Final Invoice confirmation.'
                  }}
                </span>
              </div>
            </div>

            @if (!isLocked && stockShortages.length > 0) {
              <div class="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-900 flex items-start gap-2">
                <lucide-icon
                  name="triangle-alert"
                  class="w-4 h-4 text-rose-600 shrink-0 mt-0.5"
                ></lucide-icon>
                <div>
                  <p class="font-bold">Stock Shortage Detected for Current Quantities:</p>
                  <ul class="list-disc pl-4 mt-1 space-y-0.5 text-[11px]">
                    @for (s of stockShortages; track s) {
                      <li>{{ s }}</li>
                    }
                  </ul>
                </div>
              </div>
            }

            <!-- SECTION A & B: Estimated Materials vs Actual Materials Used -->
            <div class="border border-slate-200 rounded-lg overflow-hidden">
              <div class="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h4 class="font-bold text-slate-900 text-xs uppercase tracking-wider">
                    A. Estimated Materials &amp; B. Actual Materials Used
                  </h4>
                  <p class="text-[11px] text-slate-500">
                    Compare service estimate against actual quantities consumed by the mechanic
                  </p>
                </div>
                <span class="font-mono font-bold text-slate-800">
                  Subtotal: {{ garageConfig.currencySymbol }}{{ formatMoney(estActualSubtotal) }}
                </span>
              </div>

              <table class="w-full text-left text-xs">
                <thead class="bg-slate-50/70 border-b border-slate-200 text-[10px] font-bold uppercase text-slate-500">
                  <tr>
                    <th class="py-2 px-4">Part / SKU</th>
                    <th class="py-2 px-3 text-right">A. Estimated Qty</th>
                    <th class="py-2 px-3 text-right">B. Actual Used Qty</th>
                    <th class="py-2 px-3 text-right">In Stock</th>
                    <th class="py-2 px-3 text-right">Unit Price</th>
                    <th class="py-2 px-4 text-right">Line Total</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  @if ((bk.actualMaterials || []).length === 0) {
                    <tr>
                      <td colspan="6" class="py-5 text-center text-slate-400">
                        No preliminary estimated materials attached to this job. Use Additional Materials below.
                      </td>
                    </tr>
                  } @else {
                    @for (act of bk.actualMaterials; track act.id) {
                      <tr class="hover:bg-slate-50/50">
                        <td class="py-2.5 px-4">
                          <div class="font-semibold text-slate-900">{{ act.partName }}</div>
                          <div class="text-[10px] font-mono text-slate-400">{{ act.sku }}</div>
                        </td>
                        <td class="py-2.5 px-3 text-right font-mono text-slate-500">
                          {{ act.estimatedQuantity }} {{ act.unit }}
                        </td>
                        <td class="py-2.5 px-3 text-right">
                          <div class="inline-flex items-center gap-1.5 justify-end">
                            <input
                              type="number"
                              min="0"
                              step="0.5"
                              [disabled]="isLocked"
                              [ngModel]="act.actualQuantity"
                              (ngModelChange)="updateActualQty(bk.id, act.id, $event)"
                              [class]="
                                'w-16 text-right font-mono font-bold p-1 border rounded ' +
                                (isOverStock(act.inventoryItemId, act.actualQuantity)
                                  ? 'border-rose-400 bg-rose-50 text-rose-800'
                                  : 'border-slate-300 bg-white')
                              "
                            />
                            <span class="text-[11px] text-slate-500 w-12 text-left">
                              {{ act.unit }}
                            </span>
                          </div>
                        </td>
                        <td
                          [class]="
                            'py-2.5 px-3 text-right font-mono font-semibold ' +
                            (isOverStock(act.inventoryItemId, act.actualQuantity)
                              ? 'text-rose-600'
                              : 'text-slate-600')
                          "
                        >
                          {{ getAvailableStock(act.inventoryItemId) }} {{ act.unit }}
                        </td>
                        <td class="py-2.5 px-3 text-right font-mono text-slate-700">
                          {{ garageConfig.currencySymbol }}{{ act.unitPrice.toLocaleString('en-IN') }}
                        </td>
                        <td class="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                          {{ garageConfig.currencySymbol }}{{ formatMoney(act.actualQuantity * act.unitPrice) }}
                        </td>
                      </tr>
                    }
                  }
                </tbody>
              </table>
            </div>

            <!-- SECTION C: Additional Materials -->
            <div class="border border-slate-200 rounded-lg overflow-hidden">
              <div class="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h4 class="font-bold text-slate-900 text-xs uppercase tracking-wider">
                    C. Additional Materials Used (Unplanned / Extra)
                  </h4>
                  <p class="text-[11px] text-slate-500">
                    Extra spare parts added by the mechanic during repair — editable until invoice confirmation
                  </p>
                </div>
                <span class="font-mono font-bold text-slate-800">
                  Subtotal: {{ garageConfig.currencySymbol }}{{ formatMoney(additionalSubtotal) }}
                </span>
              </div>

              @if (bk.additionalMaterials.length > 0) {
                <table class="w-full text-left text-xs border-b border-slate-200">
                  <thead class="bg-slate-50/70 border-b border-slate-200 text-[10px] font-bold uppercase text-slate-500">
                    <tr>
                      <th class="py-2 px-4">Part / SKU</th>
                      <th class="py-2 px-3">Reason / Description</th>
                      <th class="py-2 px-3 text-right">Qty Used</th>
                      <th class="py-2 px-3 text-right">Unit Price</th>
                      <th class="py-2 px-3 text-right">Total</th>
                      <th class="py-2 px-2"></th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100">
                    @for (add of bk.additionalMaterials; track add.id) {
                      <tr>
                        <td class="py-2.5 px-4">
                          <div class="font-semibold text-slate-900">{{ add.partName }}</div>
                          <div class="text-[10px] font-mono text-slate-400">{{ add.sku }}</div>
                        </td>
                        <td class="py-2.5 px-3">
                          <input
                            type="text"
                            [disabled]="isLocked"
                            [ngModel]="add.reason"
                            (ngModelChange)="updateAdditionalMaterial(bk.id, add.id, { reason: $event })"
                            class="w-full p-1 border border-slate-200 rounded bg-white text-slate-700"
                          />
                        </td>
                        <td class="py-2.5 px-3 text-right">
                          <input
                            type="number"
                            min="0.5"
                            step="0.5"
                            [disabled]="isLocked"
                            [ngModel]="add.quantity"
                            (ngModelChange)="updateAdditionalMaterial(bk.id, add.id, { quantity: $event })"
                            class="w-16 text-right font-mono font-bold p-1 border border-slate-300 rounded"
                          />
                          <span class="text-[11px] text-slate-500 ml-1">{{ add.unit }}</span>
                        </td>
                        <td class="py-2.5 px-3 text-right font-mono">
                          <input
                            type="number"
                            min="0"
                            [disabled]="isLocked"
                            [ngModel]="add.unitPrice"
                            (ngModelChange)="updateAdditionalMaterial(bk.id, add.id, { unitPrice: $event })"
                            class="w-20 text-right font-mono p-1 border border-slate-300 rounded"
                          />
                        </td>
                        <td class="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                          {{ garageConfig.currencySymbol }}{{ formatMoney(add.quantity * add.unitPrice) }}
                        </td>
                        <td class="py-2.5 px-2 text-right">
                          @if (!isLocked) {
                            <button
                              type="button"
                              (click)="removeAdditionalMaterial(bk.id, add.id)"
                              class="p-1 text-slate-400 hover:text-rose-600 rounded"
                              title="Remove additional part"
                            >
                              <lucide-icon name="trash-2" class="w-3.5 h-3.5"></lucide-icon>
                            </button>
                          }
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              }

              @if (!isLocked) {
                <form (ngSubmit)="handleAddAdditional(bk.id)" class="p-4 bg-slate-50/70 space-y-3">
                  @if (addError) {
                    <div class="p-2 bg-rose-50 border border-rose-200 rounded text-rose-800 font-semibold">
                      {{ addError }}
                    </div>
                  }
                  <div class="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                    <div class="sm:col-span-4">
                      <label class="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                        Search &amp; Select Inventory Item
                      </label>
                      <input
                        type="text"
                        name="searchPart"
                        placeholder="Filter parts..."
                        [(ngModel)]="searchPart"
                        class="w-full p-1.5 mb-1 border border-slate-200 rounded bg-white text-[11px]"
                      />
                      <select
                        name="selectedPartId"
                        [ngModel]="selectedPartId"
                        (ngModelChange)="handleSelectPartChange($event)"
                        class="w-full p-2 border border-slate-300 rounded bg-white"
                      >
                        @for (item of filteredParts; track item.id) {
                          <option [value]="item.id">
                            {{ item.partName }} ({{ item.sku }}) · Stock: {{ item.quantityOnHand }} {{ item.unit }}
                          </option>
                        }
                      </select>
                    </div>
                    <div class="sm:col-span-2">
                      <label class="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                        Qty Used
                      </label>
                      <input
                        type="number"
                        name="addQty"
                        min="0.1"
                        step="0.5"
                        required
                        [(ngModel)]="addQty"
                        class="w-full p-2 border border-slate-300 rounded bg-white font-mono"
                      />
                    </div>
                    <div class="sm:col-span-2">
                      <label class="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                        Unit Price ({{ garageConfig.currencySymbol }})
                      </label>
                      <input
                        type="number"
                        name="addPrice"
                        min="0"
                        step="0.01"
                        [(ngModel)]="addPrice"
                        class="w-full p-2 border border-slate-300 rounded bg-white font-mono"
                      />
                    </div>
                    <div class="sm:col-span-4">
                      <label class="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                        Reason / Repair Note
                      </label>
                      <div class="flex gap-2">
                        <input
                          type="text"
                          name="addReason"
                          placeholder="e.g. Worn fuel filter discovered"
                          [(ngModel)]="addReason"
                          class="flex-1 p-2 border border-slate-300 rounded bg-white"
                        />
                        <button
                          type="submit"
                          [disabled]="isAddingPart"
                          class="flex items-center gap-1 px-3 py-2 bg-[#0051a8] hover:bg-[#003d80] text-white font-bold rounded shrink-0 disabled:opacity-50"
                        >
                          <lucide-icon name="plus" class="w-3.5 h-3.5"></lucide-icon>
                          <span>Add</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </form>
              }
            </div>

            <!-- Labour, Additional Charges, Discount & Work Description -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                <h4 class="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                  Customer &amp; Work Performed
                </h4>
                <div class="grid grid-cols-2 gap-2.5">
                  <div>
                    <label class="block text-[10px] font-bold text-slate-600 mb-1">
                      Customer Name
                    </label>
                    <input
                      type="text"
                      [disabled]="isLocked"
                      [ngModel]="bk.customerName || vehicle?.customerName || ''"
                      (ngModelChange)="updateCharges(bk.id, { customerName: $event })"
                      class="w-full p-2 border border-slate-300 rounded bg-white"
                    />
                  </div>
                  <div>
                    <label class="block text-[10px] font-bold text-slate-600 mb-1">
                      Customer Phone
                    </label>
                    <input
                      type="text"
                      [disabled]="isLocked"
                      [ngModel]="bk.customerPhone || vehicle?.customerPhone || ''"
                      (ngModelChange)="updateCharges(bk.id, { customerPhone: $event })"
                      class="w-full p-2 border border-slate-300 rounded bg-white font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label class="block text-[10px] font-bold text-slate-600 mb-1">
                    Description of Work Performed
                  </label>
                  <textarea
                    rows="3"
                    [disabled]="isLocked"
                    [ngModel]="bk.workPerformedDescription ?? bk.serviceActivities"
                    (ngModelChange)="updateCharges(bk.id, { workPerformedDescription: $event })"
                    class="w-full p-2 border border-slate-300 rounded bg-white"
                  ></textarea>
                </div>
              </div>

              <div class="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                <h4 class="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                  Labour &amp; Billing Summary
                </h4>
                <div class="grid grid-cols-3 gap-2.5">
                  <div>
                    <label class="block text-[10px] font-bold text-slate-600 mb-1">
                      Labour ({{ garageConfig.currencySymbol }})
                    </label>
                    <input
                      type="number"
                      min="0"
                      [disabled]="isLocked"
                      [ngModel]="bk.labourCharges"
                      (ngModelChange)="updateCharges(bk.id, { labourCharges: +$event || 0 })"
                      class="w-full p-2 border border-slate-300 rounded bg-white font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label class="block text-[10px] font-bold text-slate-600 mb-1">
                      Extra Service ({{ garageConfig.currencySymbol }})
                    </label>
                    <input
                      type="number"
                      min="0"
                      [disabled]="isLocked"
                      [ngModel]="bk.additionalServiceCharges"
                      (ngModelChange)="updateCharges(bk.id, { additionalServiceCharges: +$event || 0 })"
                      class="w-full p-2 border border-slate-300 rounded bg-white font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label class="block text-[10px] font-bold text-slate-600 mb-1">
                      Discount ({{ garageConfig.currencySymbol }})
                    </label>
                    <input
                      type="number"
                      min="0"
                      [disabled]="isLocked"
                      [ngModel]="bk.discountAmount"
                      (ngModelChange)="updateCharges(bk.id, { discountAmount: +$event || 0 })"
                      class="w-full p-2 border border-slate-300 rounded bg-white font-mono font-bold"
                    />
                  </div>
                </div>

                <div class="p-3 bg-white rounded border border-slate-200 space-y-1.5 text-xs font-mono">
                  <div class="flex justify-between text-slate-600">
                    <span>Spare Parts &amp; Consumables:</span>
                    <span>{{ garageConfig.currencySymbol }}{{ formatMoney(materialsSubtotal) }}</span>
                  </div>
                  <div class="flex justify-between text-slate-600">
                    <span>
                      GST / Tax ({{ garageConfig.taxEnabled ? garageConfig.taxRatePercent + '%' : 'Off' }}):
                    </span>
                    <span>{{ garageConfig.currencySymbol }}{{ formatMoney(taxAmt) }}</span>
                  </div>
                  <div class="flex justify-between text-sm font-bold text-slate-900 pt-1.5 border-t border-slate-100">
                    <span>Estimated Final Payable:</span>
                    <span>{{ garageConfig.currencySymbol }}{{ formatMoney(grandTotal) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            <button
              type="button"
              (click)="close.emit()"
              class="px-4 py-2 text-xs font-semibold text-slate-700 border border-slate-300 rounded bg-white hover:bg-slate-100"
            >
              Save &amp; Close
            </button>

            <button
              type="button"
              (click)="openInvoicePreview.emit(bk.id)"
              class="flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-[#166534] hover:bg-[#14532d] rounded shadow-xs"
            >
              <lucide-icon name="receipt" class="w-4 h-4"></lucide-icon>
              <span>
                {{
                  isLocked
                    ? 'View Invoice ' + bk.invoiceNumber
                    : 'Preview & Generate Invoice'
                }}
              </span>
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class RepairJobConsumptionModalComponent implements OnChanges {
  private readonly fleetApi = inject(FleetApiService);

  @Input() isOpen = false;
  @Input() booking: ServiceBooking | null = null;
  @Input() vehicle: Vehicle | null = null;
  @Input() inventory: InventoryItem[] = [];
  @Input() garageConfig!: GarageConfig;

  @Output() close = new EventEmitter<void>();
  @Output() openInvoicePreview = new EventEmitter<string>();

  searchPart = '';
  selectedPartId = '';
  addQty = '1';
  addPrice = '';
  addReason = '';
  addError: string | null = null;
  isAddingPart = false;

  ngOnChanges(): void {
    if (this.isOpen && this.activeInventory.length > 0 && !this.selectedPartId) {
      this.selectedPartId = this.activeInventory[0].id;
      this.addPrice = String(this.activeInventory[0].sellingPrice);
    }
  }

  get activeInventory(): InventoryItem[] {
    return this.inventory.filter((i) => i.isActive);
  }

  get filteredParts(): InventoryItem[] {
    const q = this.searchPart.trim().toLowerCase();
    return this.activeInventory.filter(
      (i) =>
        q === '' ||
        i.partName.toLowerCase().includes(q) ||
        i.sku.toLowerCase().includes(q)
    );
  }

  get isLocked(): boolean {
    return this.booking?.invoiceStatus === 'generated';
  }

  get estActualSubtotal(): number {
    return (this.booking?.actualMaterials || []).reduce(
      (sum, a) => sum + a.actualQuantity * a.unitPrice,
      0
    );
  }

  get additionalSubtotal(): number {
    return (this.booking?.additionalMaterials || []).reduce(
      (sum, a) => sum + a.quantity * a.unitPrice,
      0
    );
  }

  get materialsSubtotal(): number {
    return this.estActualSubtotal + this.additionalSubtotal;
  }

  get preTax(): number {
    if (!this.booking) return 0;
    return Math.max(
      0,
      this.materialsSubtotal +
        (this.booking.labourCharges || 0) +
        (this.booking.additionalServiceCharges || 0) -
        (this.booking.discountAmount || 0)
    );
  }

  get taxAmt(): number {
    return this.garageConfig?.taxEnabled
      ? (this.preTax * this.garageConfig.taxRatePercent) / 100
      : 0;
  }

  get grandTotal(): number {
    return this.preTax + this.taxAmt;
  }

  get stockShortages(): string[] {
    if (!this.booking) return [];
    const shortages: string[] = [];
    const qtyByItem = new Map<string, number>();
    for (const a of this.booking.actualMaterials || []) {
      if (a.actualQuantity > 0) {
        qtyByItem.set(a.inventoryItemId, (qtyByItem.get(a.inventoryItemId) || 0) + a.actualQuantity);
      }
    }
    for (const ad of this.booking.additionalMaterials || []) {
      if (ad.quantity > 0) {
        qtyByItem.set(ad.inventoryItemId, (qtyByItem.get(ad.inventoryItemId) || 0) + ad.quantity);
      }
    }
    for (const [id, req] of qtyByItem.entries()) {
      const inv = this.inventory.find((i) => i.id === id);
      if (inv && inv.quantityOnHand < req) {
        shortages.push(
          `${inv.partName} (Need ${req} ${inv.unit}, Available ${inv.quantityOnHand} ${inv.unit})`
        );
      }
    }
    return shortages;
  }

  getAvailableStock(inventoryItemId: string): number {
    return this.inventory.find((i) => i.id === inventoryItemId)?.quantityOnHand ?? 0;
  }

  isOverStock(inventoryItemId: string, actualQty: number): boolean {
    return !this.isLocked && actualQty > this.getAvailableStock(inventoryItemId);
  }

  formatMoney(val: number): string {
    return val.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  handleSelectPartChange(id: string): void {
    this.selectedPartId = id;
    const item = this.inventory.find((i) => i.id === id);
    if (item) {
      this.addPrice = String(item.sellingPrice);
    }
  }

  updateActualQty(bookingId: string, actualLineId: string, qty: number): void {
    void this.fleetApi.updateJobActualMaterialQty(bookingId, actualLineId, Number(qty) || 0);
  }

  updateAdditionalMaterial(
    bookingId: string,
    lineId: string,
    updates: { quantity?: number; unitPrice?: number; reason?: string }
  ): void {
    void this.fleetApi.updateJobAdditionalMaterial(bookingId, lineId, updates);
  }

  removeAdditionalMaterial(bookingId: string, lineId: string): void {
    void this.fleetApi.removeJobAdditionalMaterial(bookingId, lineId);
  }

  updateCharges(
    bookingId: string,
    updates: {
      labourCharges?: number;
      additionalServiceCharges?: number;
      discountAmount?: number;
      workPerformedDescription?: string;
      customerName?: string;
      customerPhone?: string;
      customerEmail?: string;
    }
  ): void {
    void this.fleetApi.updateJobChargesAndNotes(bookingId, updates);
  }

  async handleAddAdditional(bookingId: string): Promise<void> {
    if (this.isAddingPart) return;
    this.addError = null;
    const targetId = this.selectedPartId || this.filteredParts[0]?.id;
    if (!targetId) {
      this.addError = 'Select a spare part first.';
      return;
    }

    this.isAddingPart = true;
    const res = await this.fleetApi.addJobAdditionalMaterial(bookingId, {
      inventoryItemId: targetId,
      quantity: parseFloat(this.addQty) || 0,
      unitPrice: this.addPrice !== '' ? parseFloat(this.addPrice) : undefined,
      reason: this.addReason.trim() || 'Additional replacement found during workshop inspection',
    });
    this.isAddingPart = false;

    if (!res.success) {
      this.addError = res.error || 'Could not add material.';
      return;
    }
    this.addQty = '1';
    this.addReason = '';
  }
}
