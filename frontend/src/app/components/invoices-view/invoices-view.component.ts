import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { GarageConfig, Invoice, InvoicePaymentStatus } from '../../models/fleet.models';

@Component({
  selector: 'app-invoices-view',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  template: `
    <div class="space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-200">
        <div>
          <p class="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            BILLING &amp; SERVICE HISTORY · {{ garageConfig.garageName.toUpperCase() }}
          </p>
          <h1 class="text-2xl font-bold tracking-tight text-slate-900 mt-0.5 flex items-center gap-2">
            <lucide-icon name="receipt" class="w-5 h-5 text-[#0051a8]"></lucide-icon>
            <span>Generated Invoices</span>
          </h1>
          <p class="text-xs text-slate-500 mt-0.5">
            {{ invoices.length }} invoice record{{ invoices.length === 1 ? '' : 's' }} · Active billed revenue:
            <span class="font-mono font-bold text-slate-800">
              {{ garageConfig.currencySymbol }}{{ activeTotalFormatted }}
            </span>
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2.5">
          <div class="relative">
            <lucide-icon
              name="search"
              class="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
            ></lucide-icon>
            <input
              type="text"
              placeholder="Search invoice #, reg, customer..."
              [(ngModel)]="search"
              class="bg-white border border-slate-200 text-xs py-2 pl-9 pr-3 rounded-md w-60 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <select
            [(ngModel)]="paymentFilter"
            class="bg-white border border-slate-200 text-xs font-medium py-2 px-3 rounded-md cursor-pointer"
          >
            <option value="all">All Invoices</option>
            <option value="Paid">Paid</option>
            <option value="Unpaid">Unpaid</option>
            <option value="Partially Paid">Partially Paid</option>
            <option value="cancelled">Cancelled / Reversed</option>
          </select>
        </div>
      </div>

      <div class="bg-white rounded-lg border border-slate-200 overflow-x-auto shadow-2xs">
        <table class="w-full text-left text-xs">
          <thead class="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            <tr>
              <th class="py-3 px-4">Invoice #</th>
              <th class="py-3 px-3">Date</th>
              <th class="py-3 px-3">Customer</th>
              <th class="py-3 px-3">Vehicle</th>
              <th class="py-3 px-3">Service Type</th>
              <th class="py-3 px-3 text-right">Parts</th>
              <th class="py-3 px-3 text-right">Final Payable</th>
              <th class="py-3 px-3">Payment / Status</th>
              <th class="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            @if (filtered.length === 0) {
              <tr>
                <td colspan="9" class="py-10 text-center text-slate-400">
                  No invoices generated yet. Open any In Progress repair job and click &ldquo;Invoice&rdquo; to preview and generate one.
                </td>
              </tr>
            } @else {
              @for (inv of filtered; track inv.id) {
                <tr class="hover:bg-slate-50/70">
                  <td class="py-3 px-4 font-mono font-bold text-slate-900">
                    {{ inv.invoiceNumber }}
                  </td>
                  <td class="py-3 px-3 font-mono text-slate-600">{{ inv.invoiceDate }}</td>
                  <td class="py-3 px-3">
                    <div class="font-semibold text-slate-900">{{ inv.customerName }}</div>
                    <div class="text-[10px] font-mono text-slate-400">{{ inv.customerPhone }}</div>
                  </td>
                  <td class="py-3 px-3">
                    <div class="font-mono font-bold text-slate-800">{{ inv.vehicleReg }}</div>
                    <div class="text-[10px] text-slate-500">{{ inv.vehicleMakeModel }}</div>
                  </td>
                  <td class="py-3 px-3 text-slate-700 font-medium">{{ inv.serviceType }}</td>
                  <td class="py-3 px-3 text-right font-mono text-slate-600">
                    {{ inv.lineItems.length }} item{{ inv.lineItems.length === 1 ? '' : 's' }}
                  </td>
                  <td class="py-3 px-3 text-right font-mono font-bold text-slate-900 tabular-nums">
                    {{ inv.garageSnapshot.currencySymbol }}{{ formatMoney(inv.finalPayableAmount) }}
                  </td>
                  <td class="py-3 px-3">
                    @if (inv.status === 'cancelled') {
                      <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                        <lucide-icon name="circle-x" class="w-3 h-3"></lucide-icon>
                        <span>Cancelled (Stock Restored)</span>
                      </span>
                    } @else {
                      <span
                        [class]="
                          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ' +
                          (inv.paymentStatus === 'Paid'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : inv.paymentStatus === 'Partially Paid'
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200')
                        "
                      >
                        <lucide-icon name="circle-check" class="w-3 h-3"></lucide-icon>
                        <span>{{ inv.paymentStatus }}</span>
                      </span>
                    }
                  </td>
                  <td class="py-3 px-4 text-right">
                    <button
                      type="button"
                      (click)="inspectInvoice.emit(inv)"
                      class="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-[#0051a8] hover:bg-blue-50 rounded border border-blue-200"
                    >
                      <lucide-icon name="eye" class="w-3.5 h-3.5"></lucide-icon>
                      <span>Preview / Print / PDF</span>
                    </button>
                  </td>
                </tr>
              }
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
})
export class InvoicesViewComponent {
  @Input() invoices: Invoice[] = [];
  @Input() garageConfig!: GarageConfig;
  @Output() inspectInvoice = new EventEmitter<Invoice>();

  search = '';
  paymentFilter: 'all' | InvoicePaymentStatus | 'cancelled' = 'all';

  get filtered(): Invoice[] {
    const q = this.search.trim().toLowerCase();
    return this.invoices.filter((inv) => {
      const matchesSearch =
        q === '' ||
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.vehicleReg.toLowerCase().includes(q) ||
        inv.customerName.toLowerCase().includes(q) ||
        inv.serviceType.toLowerCase().includes(q);

      const matchesPay =
        this.paymentFilter === 'all'
          ? true
          : this.paymentFilter === 'cancelled'
          ? inv.status === 'cancelled'
          : inv.status === 'active' && inv.paymentStatus === this.paymentFilter;

      return matchesSearch && matchesPay;
    });
  }

  get activeTotalFormatted(): string {
    const total = this.invoices
      .filter((i) => i.status === 'active')
      .reduce((sum, i) => sum + i.finalPayableAmount, 0);
    return total.toLocaleString('en-IN', { minimumFractionDigits: 2 });
  }

  formatMoney(val: number): string {
    return val.toLocaleString('en-IN', { minimumFractionDigits: 2 });
  }
}
