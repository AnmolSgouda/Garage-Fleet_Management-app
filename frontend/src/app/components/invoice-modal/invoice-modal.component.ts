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
import { jsPDF } from 'jspdf';
import { FleetApiService } from '../../services/fleet-api.service';
import {
  GarageConfig,
  Invoice,
  InvoiceLineItem,
  InvoicePaymentMethod,
  InvoicePaymentStatus,
  ServiceBooking,
  Vehicle,
} from '../../models/fleet.models';

@Component({
  selector: 'app-invoice-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  template: `
    @if (isOpen) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
        <div class="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-4xl w-full overflow-hidden flex flex-col max-h-[92vh]">
          <!-- Modal Chrome Header -->
          <div class="no-print bg-[#071322] text-white px-6 py-3.5 flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <lucide-icon name="receipt" class="w-4 h-4 text-cyan-400"></lucide-icon>
              <h3 class="text-sm font-bold tracking-wide uppercase">
                {{
                  activeInv
                    ? 'Invoice ' + activeInv.invoiceNumber
                    : 'Invoice Preview & Final Confirmation'
                }}
              </h3>
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
          <div class="overflow-y-auto flex-1 p-6 space-y-4">
            @if (errorMsg) {
              <div class="no-print p-3.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-900 flex items-start gap-2 text-xs font-semibold">
                <lucide-icon name="triangle-alert" class="w-4 h-4 text-rose-600 shrink-0 mt-0.5"></lucide-icon>
                <span>{{ errorMsg }}</span>
              </div>
            }

            @if (successMsg) {
              <div class="no-print p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 flex items-center gap-2 text-xs font-semibold">
                <lucide-icon name="circle-check" class="w-4 h-4 text-emerald-600 shrink-0"></lucide-icon>
                <span>{{ successMsg }}</span>
              </div>
            }

            @if (activeInv?.status === 'cancelled') {
              <div class="p-3 bg-rose-50 border border-rose-300 rounded-lg text-rose-900 text-xs font-bold">
                CANCELLED INVOICE — Reversed on {{ formatTimestamp(activeInv?.cancelledAt) }} · Reason: {{ activeInv?.cancelReason }} (All deducted inventory quantities were restored).
              </div>
            }

            <!-- Printable Garage Invoice Document -->
            <div
              id="invoice-printable-area"
              class="bg-white border border-slate-300 rounded-lg p-6 space-y-5 text-xs text-slate-800 shadow-2xs"
            >
              <div class="flex flex-wrap items-start justify-between gap-4 pb-4 border-b-2 border-slate-900">
                <div>
                  <div class="flex items-center gap-2">
                    <div class="w-8 h-8 rounded bg-[#071322] text-white flex items-center justify-center">
                      <lucide-icon name="warehouse" class="w-4 h-4 text-cyan-400"></lucide-icon>
                    </div>
                    <div>
                      <h2 class="text-lg font-black tracking-tight text-slate-900">
                        {{ g.garageName }}
                      </h2>
                      <p class="text-[11px] text-slate-500">{{ g.tagline }}</p>
                    </div>
                  </div>
                  <p class="text-[11px] text-slate-600 mt-2">{{ g.address }}</p>
                  <p class="text-[11px] text-slate-600 font-mono">
                    Tel: {{ g.phone }} · Email: {{ g.email }} · GSTIN: {{ g.gstNumber }}
                  </p>
                </div>

                <div class="text-right">
                  <span class="text-[10px] font-bold uppercase tracking-widest text-slate-400 block">
                    GARAGE TAX INVOICE
                  </span>
                  <p class="text-lg font-black font-mono text-slate-900 mt-0.5">
                    {{ displayInvNum }}
                  </p>
                  <p class="text-[11px] font-mono text-slate-600 mt-1">
                    Date: <span class="font-bold text-slate-900">{{ displayDate }}</span>
                  </p>
                  <p class="text-[11px] font-mono text-slate-600">
                    Job Ref: #{{ activeInv?.bookingRef || booking?.bookingRef }}
                  </p>
                </div>
              </div>

              <!-- Customer & Vehicle Details Grid -->
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div class="space-y-1.5">
                  <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Customer / Fleet Billing Details
                  </span>
                  @if (activeInv) {
                    <p class="font-bold text-slate-900 text-sm">{{ displayCustomerName }}</p>
                    <p class="font-mono text-slate-700">{{ displayCustomerPhone }}</p>
                    @if (activeInv.customerEmail) {
                      <p class="text-slate-600">{{ activeInv.customerEmail }}</p>
                    }
                  } @else {
                    <div class="space-y-1.5">
                      <input
                        type="text"
                        [(ngModel)]="customerName"
                        placeholder="Customer Name"
                        class="w-full p-1.5 border border-slate-300 rounded bg-white font-semibold"
                      />
                      <div class="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          [(ngModel)]="customerPhone"
                          placeholder="Phone"
                          class="w-full p-1.5 border border-slate-300 rounded bg-white font-mono"
                        />
                        <input
                          type="email"
                          [(ngModel)]="customerEmail"
                          placeholder="Email"
                          class="w-full p-1.5 border border-slate-300 rounded bg-white"
                        />
                      </div>
                    </div>
                  }
                </div>

                <div class="space-y-1">
                  <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Vehicle &amp; Service Info
                  </span>
                  <div class="flex justify-between">
                    <span class="text-slate-500">Vehicle Reg:</span>
                    <span class="font-mono font-bold text-slate-900">{{ displayVehicleReg }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-slate-500">Make &amp; Model:</span>
                    <span class="font-semibold text-slate-800">{{ displayVehicleModel }}</span>
                  </div>
                  <div class="flex justify-between items-center">
                    <span class="text-slate-500">Odometer Reading:</span>
                    @if (activeInv) {
                      <span class="font-mono font-bold text-slate-800">
                        {{ displayOdometer.toLocaleString() }} km
                      </span>
                    } @else {
                      <input
                        type="number"
                        [(ngModel)]="odometerReading"
                        class="w-28 text-right font-mono font-bold p-1 border border-slate-300 rounded bg-white"
                      />
                    }
                  </div>
                  <div class="flex justify-between">
                    <span class="text-slate-500">Service Type:</span>
                    <span class="font-bold text-blue-800">{{ displayServiceType }}</span>
                  </div>
                </div>
              </div>

              <!-- Description of Work Performed -->
              <div>
                <span class="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Description of Work Performed
                </span>
                @if (activeInv) {
                  <p class="p-2.5 bg-slate-50 rounded border border-slate-200 text-slate-800">
                    {{ displayWork }}
                  </p>
                } @else {
                  <textarea
                    rows="2"
                    [(ngModel)]="workPerformed"
                    class="w-full p-2 border border-slate-300 rounded bg-white"
                  ></textarea>
                }
              </div>

              <!-- Spare Parts Table -->
              <div class="border border-slate-200 rounded-lg overflow-hidden">
                <table class="w-full text-left text-xs">
                  <thead class="bg-slate-900 text-white text-[10px] uppercase tracking-wider">
                    <tr>
                      <th class="py-2.5 px-3">Spare Part / Material</th>
                      <th class="py-2.5 px-3">Category Source</th>
                      <th class="py-2.5 px-3 text-right">Qty Utilized</th>
                      <th class="py-2.5 px-3 text-right">Unit Price</th>
                      <th class="py-2.5 px-3 text-right">Total Price</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-200">
                    @if (previewLineItems.length === 0) {
                      <tr>
                        <td colspan="5" class="py-4 text-center text-slate-400">
                          No spare parts billed (Labour / Service charge only).
                        </td>
                      </tr>
                    } @else {
                      @for (li of previewLineItems; track li.id) {
                        <tr>
                          <td class="py-2.5 px-3">
                            <div class="font-bold text-slate-900">{{ li.partName }}</div>
                            <div class="text-[10px] font-mono text-slate-500">
                              {{ li.sku }}{{ li.reason ? ' · ' + li.reason : '' }}
                            </div>
                          </td>
                          <td class="py-2.5 px-3">
                            @if (li.materialSource === 'additional') {
                              <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                Additional Material
                              </span>
                            } @else {
                              <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                Estimated (Actual)
                              </span>
                            }
                          </td>
                          <td class="py-2.5 px-3 text-right font-mono font-semibold tabular-nums">
                            {{ li.quantity }} {{ li.unit }}
                          </td>
                          <td class="py-2.5 px-3 text-right font-mono tabular-nums">
                            {{ g.currencySymbol }}{{ formatMoney(li.unitPrice) }}
                          </td>
                          <td class="py-2.5 px-3 text-right font-mono font-bold text-slate-900 tabular-nums">
                            {{ g.currencySymbol }}{{ formatMoney(li.lineTotal) }}
                          </td>
                        </tr>
                      }
                    }
                  </tbody>
                </table>
              </div>

              <!-- Totals & Payment Grid -->
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                <div class="space-y-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <h4 class="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    Payment Details
                  </h4>
                  <div class="grid grid-cols-2 gap-2.5">
                    <div>
                      <label class="block text-[10px] font-bold text-slate-600 mb-1">
                        Payment Status
                      </label>
                      <select
                        [ngModel]="paymentStatus"
                        (ngModelChange)="onPaymentStatusChange($event)"
                        [disabled]="activeInv?.status === 'cancelled'"
                        class="w-full p-2 border border-slate-300 rounded bg-white font-semibold"
                      >
                        <option value="Paid">Paid</option>
                        <option value="Unpaid">Unpaid</option>
                        <option value="Partially Paid">Partially Paid</option>
                      </select>
                    </div>
                    <div>
                      <label class="block text-[10px] font-bold text-slate-600 mb-1">
                        Payment Method
                      </label>
                      <select
                        [ngModel]="paymentMethod"
                        (ngModelChange)="onPaymentMethodChange($event)"
                        [disabled]="activeInv?.status === 'cancelled'"
                        class="w-full p-2 border border-slate-300 rounded bg-white font-semibold"
                      >
                        <option value="UPI / Bank Transfer">UPI / Bank Transfer</option>
                        <option value="Cash">Cash</option>
                        <option value="Card">Card</option>
                        <option value="Corporate Credit">Corporate Credit</option>
                      </select>
                    </div>
                  </div>

                  @if (paymentStatus === 'Partially Paid') {
                    <div>
                      <label class="block text-[10px] font-bold text-slate-600 mb-1">
                        Amount Paid ({{ g.currencySymbol }})
                      </label>
                      <input
                        type="number"
                        min="0"
                        [max]="finalPayable"
                        [ngModel]="amountPaid"
                        (ngModelChange)="onAmountPaidChange($event)"
                        class="w-full p-2 border border-slate-300 rounded bg-white font-mono font-bold"
                      />
                    </div>
                  }
                </div>

                <!-- Right: Financial Breakdown -->
                <div class="space-y-2 text-xs font-mono">
                  <div class="flex justify-between text-slate-600">
                    <span>Spare Parts Subtotal:</span>
                    <span>{{ g.currencySymbol }}{{ formatMoney(materialsSubtotal) }}</span>
                  </div>

                  <div class="flex justify-between items-center text-slate-600">
                    <span>Labour Charges:</span>
                    @if (activeInv) {
                      <span>{{ g.currencySymbol }}{{ formatMoney(labourNum) }}</span>
                    } @else {
                      <input
                        type="number"
                        min="0"
                        [(ngModel)]="labourCharges"
                        class="w-28 text-right p-1 border border-slate-300 rounded bg-white font-bold"
                      />
                    }
                  </div>

                  <div class="flex justify-between items-center text-slate-600">
                    <span>Additional Service Charges:</span>
                    @if (activeInv) {
                      <span>{{ g.currencySymbol }}{{ formatMoney(addSvcNum) }}</span>
                    } @else {
                      <input
                        type="number"
                        min="0"
                        [(ngModel)]="additionalServiceCharges"
                        class="w-28 text-right p-1 border border-slate-300 rounded bg-white font-bold"
                      />
                    }
                  </div>

                  <div class="flex justify-between items-center text-slate-600">
                    <span>Discount:</span>
                    @if (activeInv) {
                      <span>-{{ g.currencySymbol }}{{ formatMoney(discountNum) }}</span>
                    } @else {
                      <input
                        type="number"
                        min="0"
                        [(ngModel)]="discountAmount"
                        class="w-28 text-right p-1 border border-slate-300 rounded bg-white font-bold"
                      />
                    }
                  </div>

                  @if (g.taxEnabled) {
                    <div class="flex justify-between text-slate-600">
                      <span>GST / Tax ({{ g.taxRatePercent }}%):</span>
                      <span>{{ g.currencySymbol }}{{ formatMoney(taxAmt) }}</span>
                    </div>
                  }

                  <div class="flex justify-between items-center text-base font-black text-slate-900 pt-2 border-t-2 border-slate-900">
                    <span>Final Payable Amount:</span>
                    <span>{{ g.currencySymbol }}{{ formatMoney(finalPayable) }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Cancel / Reversal Box -->
            @if (activeInv && activeInv.status === 'active' && showCancelConfirm) {
              <div class="no-print p-4 bg-rose-50 border border-rose-200 rounded-lg space-y-2 text-xs">
                <p class="font-bold text-rose-900">
                  Confirm Invoice Cancellation &amp; Inventory Restoration
                </p>
                <p class="text-rose-800">
                  Cancelling {{ activeInv.invoiceNumber }} will restore all deducted quantities back to inventory and log immutable invoice_reversal stock movements.
                </p>
                <div class="flex gap-2">
                  <input
                    type="text"
                    [(ngModel)]="cancelReason"
                    placeholder="Cancellation reason..."
                    class="flex-1 p-2 border border-rose-300 rounded bg-white"
                  />
                  <button
                    type="button"
                    [disabled]="isSubmitting"
                    (click)="handleCancelInvoice(activeInv)"
                    class="px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white font-bold rounded disabled:opacity-50"
                  >
                    Confirm Cancellation &amp; Restore Stock
                  </button>
                </div>
              </div>
            }
          </div>

          <!-- Footer Actions -->
          <div class="no-print p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div class="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                (click)="handleDownloadPDF()"
                class="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-800 bg-white border border-slate-300 hover:bg-slate-100 rounded shadow-2xs"
              >
                <lucide-icon name="download" class="w-3.5 h-3.5 text-blue-600"></lucide-icon>
                <span>Download PDF</span>
              </button>
              <button
                type="button"
                (click)="printWindow()"
                class="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-800 bg-white border border-slate-300 hover:bg-slate-100 rounded shadow-2xs"
              >
                <lucide-icon name="printer" class="w-3.5 h-3.5 text-slate-600"></lucide-icon>
                <span>Print Invoice</span>
              </button>
              @if (activeInv && activeInv.status === 'active' && !showCancelConfirm) {
                <button
                  type="button"
                  (click)="showCancelConfirm = true"
                  class="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded"
                >
                  <lucide-icon name="rotate-ccw" class="w-3.5 h-3.5"></lucide-icon>
                  <span>Cancel &amp; Restore Stock</span>
                </button>
              }
            </div>

            <div class="flex items-center gap-2">
              <button
                type="button"
                (click)="close.emit()"
                class="px-4 py-2 text-xs font-semibold text-slate-600 border border-slate-300 rounded bg-white hover:bg-slate-100"
              >
                Close
              </button>
              @if (!activeInv && booking) {
                <button
                  type="button"
                  [disabled]="isSubmitting"
                  (click)="handleConfirmGenerate()"
                  class="flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-[#166534] hover:bg-[#14532d] rounded shadow-xs disabled:opacity-50"
                >
                  <lucide-icon name="circle-check" class="w-4 h-4"></lucide-icon>
                  <span>
                    {{
                      isSubmitting
                        ? 'Generating...'
                        : 'Generate Invoice & Deduct Stock'
                    }}
                  </span>
                </button>
              }
            </div>
          </div>
        </div>
      </div>
    }
  `,
})
export class InvoiceModalComponent implements OnChanges {
  private readonly fleetApi = inject(FleetApiService);

  @Input() isOpen = false;
  @Input() existingInvoice: Invoice | null = null;
  @Input() booking: ServiceBooking | null = null;
  @Input() vehicle: Vehicle | null = null;
  @Input() garageConfig!: GarageConfig;

  @Output() close = new EventEmitter<void>();

  customerName = '';
  customerPhone = '';
  customerEmail = '';
  odometerReading = '0';
  workPerformed = '';
  labourCharges = '0';
  additionalServiceCharges = '0';
  discountAmount = '0';
  paymentStatus: InvoicePaymentStatus = 'Paid';
  amountPaid = '0';
  paymentMethod: InvoicePaymentMethod = 'UPI / Bank Transfer';

  generatedInvoice: Invoice | null = null;
  errorMsg: string | null = null;
  successMsg: string | null = null;
  showCancelConfirm = false;
  cancelReason = 'Billing correction / customer request';
  isSubmitting = false;

  ngOnChanges(): void {
    if (!this.isOpen) return;
    this.errorMsg = null;
    this.successMsg = null;
    this.showCancelConfirm = false;

    if (this.existingInvoice) {
      this.generatedInvoice = this.existingInvoice;
      this.paymentStatus = this.existingInvoice.paymentStatus;
      this.amountPaid = String(this.existingInvoice.amountPaid);
      this.paymentMethod = this.existingInvoice.paymentMethod;
    } else if (this.booking) {
      this.generatedInvoice = null;
      this.customerName =
        this.booking.customerName || this.vehicle?.customerName || 'Fleet Customer';
      this.customerPhone =
        this.booking.customerPhone || this.vehicle?.customerPhone || '-';
      this.customerEmail =
        this.booking.customerEmail || this.vehicle?.customerEmail || '';
      this.odometerReading = String(this.vehicle?.odometer || 0);
      this.workPerformed =
        this.booking.workPerformedDescription || this.booking.serviceActivities;
      this.labourCharges = String(this.booking.labourCharges || 0);
      this.additionalServiceCharges = String(this.booking.additionalServiceCharges || 0);
      this.discountAmount = String(this.booking.discountAmount || 0);
      this.paymentStatus = 'Paid';
      this.paymentMethod = 'UPI / Bank Transfer';
    }
  }

  get activeInv(): Invoice | null {
    return this.existingInvoice || this.generatedInvoice;
  }

  get g(): GarageConfig {
    return this.activeInv ? this.activeInv.garageSnapshot : this.garageConfig;
  }

  get previewLineItems(): InvoiceLineItem[] {
    if (this.activeInv) return this.activeInv.lineItems;
    return [
      ...(this.booking?.actualMaterials || [])
        .filter((a) => a.actualQuantity > 0)
        .map((a) => ({
          id: a.id,
          inventoryItemId: a.inventoryItemId,
          partName: a.partName,
          sku: a.sku,
          unit: a.unit,
          materialSource: 'estimated_actual' as const,
          estimatedQuantity: a.estimatedQuantity,
          quantity: a.actualQuantity,
          unitPrice: a.unitPrice,
          lineTotal: Math.round(a.actualQuantity * a.unitPrice * 100) / 100,
        })),
      ...(this.booking?.additionalMaterials || [])
        .filter((a) => a.quantity > 0)
        .map((a) => ({
          id: a.id,
          inventoryItemId: a.inventoryItemId,
          partName: a.partName,
          sku: a.sku,
          unit: a.unit,
          materialSource: 'additional' as const,
          quantity: a.quantity,
          unitPrice: a.unitPrice,
          lineTotal: Math.round(a.quantity * a.unitPrice * 100) / 100,
          reason: a.reason,
        })),
    ];
  }

  get materialsSubtotal(): number {
    return this.activeInv
      ? this.activeInv.materialsSubtotal
      : this.previewLineItems.reduce((sum, li) => sum + li.lineTotal, 0);
  }

  get labourNum(): number {
    return this.activeInv ? this.activeInv.labourCharges : parseFloat(this.labourCharges) || 0;
  }

  get addSvcNum(): number {
    return this.activeInv
      ? this.activeInv.additionalServiceCharges
      : parseFloat(this.additionalServiceCharges) || 0;
  }

  get discountNum(): number {
    return this.activeInv ? this.activeInv.discountAmount : parseFloat(this.discountAmount) || 0;
  }

  get preTax(): number {
    return Math.max(0, this.materialsSubtotal + this.labourNum + this.addSvcNum - this.discountNum);
  }

  get taxAmt(): number {
    if (this.activeInv) return this.activeInv.taxAmount;
    return this.g.taxEnabled
      ? Math.round(((this.preTax * this.g.taxRatePercent) / 100) * 100) / 100
      : 0;
  }

  get finalPayable(): number {
    return this.activeInv
      ? this.activeInv.finalPayableAmount
      : Math.round((this.preTax + this.taxAmt) * 100) / 100;
  }

  get displayInvNum(): string {
    return (
      this.activeInv?.invoiceNumber ||
      `${this.g.invoicePrefix}-${this.g.nextInvoiceSequence} (DRAFT)`
    );
  }

  get displayDate(): string {
    return this.activeInv?.invoiceDate || new Date().toISOString().slice(0, 10);
  }

  get displayCustomerName(): string {
    return this.activeInv?.customerName || this.customerName;
  }

  get displayCustomerPhone(): string {
    return this.activeInv?.customerPhone || this.customerPhone;
  }

  get displayVehicleReg(): string {
    return this.activeInv?.vehicleReg || this.booking?.vehicleReg || '-';
  }

  get displayVehicleModel(): string {
    return this.activeInv?.vehicleMakeModel || this.booking?.vehicleModel || '-';
  }

  get displayOdometer(): number {
    return this.activeInv?.odometerReading ?? (parseInt(this.odometerReading, 10) || 0);
  }

  get displayServiceType(): string {
    return this.activeInv?.serviceType || this.booking?.serviceType || 'General Service';
  }

  get displayWork(): string {
    return this.activeInv?.workPerformed || this.workPerformed;
  }

  formatMoney(val: number): string {
    return val.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  formatTimestamp(ts?: string): string {
    return ts ? new Date(ts).toLocaleString() : '';
  }

  printWindow(): void {
    window.print();
  }

  onPaymentStatusChange(next: InvoicePaymentStatus): void {
    this.paymentStatus = next;
    if (this.activeInv) {
      void this.fleetApi.updateInvoicePayment(this.activeInv.id, {
        paymentStatus: next,
        amountPaid:
          next === 'Paid'
            ? this.activeInv.finalPayableAmount
            : next === 'Unpaid'
            ? 0
            : parseFloat(this.amountPaid) || 0,
        paymentMethod: this.paymentMethod,
      });
    }
  }

  onPaymentMethodChange(next: InvoicePaymentMethod): void {
    this.paymentMethod = next;
    if (this.activeInv) {
      void this.fleetApi.updateInvoicePayment(this.activeInv.id, {
        paymentStatus: this.paymentStatus,
        amountPaid: parseFloat(this.amountPaid) || 0,
        paymentMethod: next,
      });
    }
  }

  onAmountPaidChange(val: string): void {
    this.amountPaid = val;
    if (this.activeInv) {
      void this.fleetApi.updateInvoicePayment(this.activeInv.id, {
        paymentStatus: this.paymentStatus,
        amountPaid: parseFloat(val) || 0,
        paymentMethod: this.paymentMethod,
      });
    }
  }

  async handleConfirmGenerate(): Promise<void> {
    if (!this.booking || this.isSubmitting) return;
    this.errorMsg = null;
    this.isSubmitting = true;

    const res = await this.fleetApi.generateInvoiceForBooking({
      bookingId: this.booking.id,
      customerName: this.customerName,
      customerPhone: this.customerPhone,
      customerEmail: this.customerEmail,
      odometerReading: parseInt(this.odometerReading, 10) || 0,
      workPerformed: this.workPerformed,
      labourCharges: parseFloat(this.labourCharges) || 0,
      additionalServiceCharges: parseFloat(this.additionalServiceCharges) || 0,
      discountAmount: parseFloat(this.discountAmount) || 0,
      paymentStatus: this.paymentStatus,
      amountPaid: parseFloat(this.amountPaid) || 0,
      paymentMethod: this.paymentMethod,
    });
    this.isSubmitting = false;

    if (!res.success) {
      this.errorMsg = res.error || 'Failed to generate invoice.';
      return;
    }

    if (res.invoice) {
      this.generatedInvoice = res.invoice;
      this.successMsg = `Invoice ${res.invoice.invoiceNumber} confirmed! Consumed spare parts deducted from inventory.`;
    }
  }

  async handleCancelInvoice(inv: Invoice): Promise<void> {
    if (this.isSubmitting) return;
    this.isSubmitting = true;
    const res = await this.fleetApi.cancelInvoice(inv.id, this.cancelReason);
    this.isSubmitting = false;

    if (!res.success) {
      this.errorMsg = res.error || 'Failed to cancel invoice.';
    } else {
      if (res.invoice) {
        this.generatedInvoice = res.invoice;
      }
      this.showCancelConfirm = false;
      this.successMsg = `Invoice ${inv.invoiceNumber} cancelled. Exact stock quantities restored to inventory.`;
    }
  }

  handleDownloadPDF(): void {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const g = this.g;
    const curr = g.currencySymbol === '₹' ? 'Rs. ' : `${g.currencySymbol} `;
    let y = 48;

    doc.setFillColor(7, 19, 34);
    doc.rect(36, 30, 523, 66, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');
    doc.text(g.garageName, 50, 54);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`${g.address}`, 50, 70);
    doc.text(`Tel: ${g.phone} | Email: ${g.email} | GSTIN: ${g.gstNumber}`, 50, 84);

    doc.setTextColor(15, 23, 42);
    y = 120;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`TAX INVOICE: ${this.displayInvNum}`, 36, y);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Date: ${this.displayDate}`, 440, y);

    y += 22;
    doc.setDrawColor(203, 213, 225);
    doc.line(36, y, 559, y);
    y += 18;

    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.text('BILL TO:', 36, y);
    doc.text('VEHICLE DETAILS:', 300, y);
    y += 14;
    doc.setFont('helvetica', 'normal');
    doc.text(`${this.displayCustomerName}`, 36, y);
    doc.text(`Reg No: ${this.displayVehicleReg} (${this.displayVehicleModel})`, 300, y);
    y += 13;
    doc.text(`Phone: ${this.displayCustomerPhone}`, 36, y);
    doc.text(`Odometer: ${this.displayOdometer.toLocaleString()} km`, 300, y);
    y += 13;
    doc.text(`Service Type: ${this.displayServiceType}`, 300, y);

    y += 20;
    doc.setFont('helvetica', 'bold');
    doc.text('Work Performed:', 36, y);
    y += 13;
    doc.setFont('helvetica', 'normal');
    const splitWork = doc.splitTextToSize(this.displayWork || '-', 520);
    doc.text(splitWork, 36, y);
    y += splitWork.length * 12 + 12;

    doc.setFillColor(241, 245, 249);
    doc.rect(36, y, 523, 20, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text('PART / DESCRIPTION', 42, y + 13);
    doc.text('TYPE', 250, y + 13);
    doc.text('QTY', 345, y + 13);
    doc.text('RATE', 420, y + 13);
    doc.text('AMOUNT', 500, y + 13);
    y += 26;

    doc.setFont('helvetica', 'normal');
    for (const li of this.previewLineItems) {
      if (y > 730) {
        doc.addPage();
        y = 50;
      }
      doc.text(`${li.partName} (${li.sku})`, 42, y);
      doc.text(li.materialSource === 'additional' ? 'Additional' : 'Scheduled', 250, y);
      doc.text(`${li.quantity} ${li.unit}`, 345, y);
      doc.text(`${curr}${li.unitPrice.toFixed(2)}`, 420, y);
      doc.text(`${curr}${li.lineTotal.toFixed(2)}`, 500, y);
      y += 16;
    }

    y += 8;
    doc.line(36, y, 559, y);
    y += 18;

    const addSummaryRow = (label: string, val: string, bold = false) => {
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setFontSize(bold ? 11 : 9.5);
      doc.text(label, 350, y);
      doc.text(val, 500, y);
      y += 16;
    };

    addSummaryRow('Spare Parts Subtotal:', `${curr}${this.materialsSubtotal.toFixed(2)}`);
    addSummaryRow('Labour Charges:', `${curr}${this.labourNum.toFixed(2)}`);
    if (this.addSvcNum > 0) {
      addSummaryRow('Additional Service Charges:', `${curr}${this.addSvcNum.toFixed(2)}`);
    }
    if (this.discountNum > 0) {
      addSummaryRow('Discount:', `-${curr}${this.discountNum.toFixed(2)}`);
    }
    if (g.taxEnabled) {
      addSummaryRow(`GST / Tax (${g.taxRatePercent}%):`, `${curr}${this.taxAmt.toFixed(2)}`);
    }
    addSummaryRow('FINAL PAYABLE AMOUNT:', `${curr}${this.finalPayable.toFixed(2)}`, true);

    y += 8;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Payment Status: ${this.activeInv?.paymentStatus || this.paymentStatus} | Method: ${this.activeInv?.paymentMethod || this.paymentMethod}`,
      36,
      y
    );

    doc.save(`${this.displayInvNum.replace(/\s+/g, '_')}.pdf`);
  }
}
