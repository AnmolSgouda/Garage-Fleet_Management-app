import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { GarageConfig, StockMovement, StockMovementType } from '../../models/fleet.models';

@Component({
  selector: 'app-stock-movements-view',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  template: `
    <div class="space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-200">
        <div>
          <p class="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            AUDIT TRAIL · {{ garageConfig.garageName.toUpperCase() }}
          </p>
          <h1 class="text-2xl font-bold tracking-tight text-slate-900 mt-0.5 flex items-center gap-2">
            <lucide-icon name="arrow-left-right" class="w-5 h-5 text-[#0051a8]"></lucide-icon>
            <span>Stock Movements History</span>
          </h1>
          <p class="text-xs text-slate-500 mt-0.5">
            Immutable inventory transaction ledger across service invoices, purchases, manual audits, and invoice reversals
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
              placeholder="Search TXN, part, SKU, invoice..."
              [(ngModel)]="search"
              class="bg-white border border-slate-200 text-xs py-2 pl-9 pr-3 rounded-md w-60 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <select
            [(ngModel)]="typeFilter"
            class="bg-white border border-slate-200 text-xs font-medium py-2 px-3 rounded-md cursor-pointer"
          >
            <option value="all">All Transaction Types</option>
            <option value="stock_in">Stock Purchase / In</option>
            <option value="service_consumption">Service Consumption (Invoice)</option>
            <option value="manual_adjustment">Manual Adjustment</option>
            <option value="purchase_return">Purchase Return</option>
            <option value="invoice_reversal">Invoice Cancellation Reversal</option>
          </select>
        </div>
      </div>

      <div class="bg-white rounded-lg border border-slate-200 overflow-x-auto shadow-2xs">
        <table class="w-full text-left text-xs">
          <thead class="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            <tr>
              <th class="py-3 px-4">Transaction ID</th>
              <th class="py-3 px-3">Item / SKU</th>
              <th class="py-3 px-3">Type</th>
              <th class="py-3 px-3 text-right">Prev Qty</th>
              <th class="py-3 px-3 text-right">Change</th>
              <th class="py-3 px-3 text-right">Updated Qty</th>
              <th class="py-3 px-3">Job / Invoice Ref</th>
              <th class="py-3 px-3">User</th>
              <th class="py-3 px-4">Date &amp; Remarks</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            @if (filtered.length === 0) {
              <tr>
                <td colSpan="9" class="py-10 text-center text-slate-400">
                  No stock movements found matching your criteria.
                </td>
              </tr>
            } @else {
              @for (m of filtered; track m.id) {
                <tr class="hover:bg-slate-50/70">
                  <td class="py-3 px-4 font-mono font-bold text-slate-800">
                    {{ m.transactionCode }}
                  </td>
                  <td class="py-3 px-3">
                    <div class="font-semibold text-slate-900">{{ m.partName }}</div>
                    <div class="text-[10px] font-mono text-slate-400">{{ m.sku }}</div>
                  </td>
                  <td class="py-3 px-3">
                    <span
                      [class]="
                        'inline-block px-2 py-0.5 rounded text-[10px] font-bold capitalize border ' +
                        typeBadge(m.transactionType)
                      "
                    >
                      {{ m.transactionType.replaceAll('_', ' ') }}
                    </span>
                  </td>
                  <td class="py-3 px-3 text-right font-mono tabular-nums text-slate-600">
                    {{ m.previousQuantity }} {{ m.unit }}
                  </td>
                  <td
                    [class]="
                      'py-3 px-3 text-right font-mono tabular-nums font-bold ' +
                      (m.quantityDelta >= 0 ? 'text-emerald-700' : 'text-rose-700')
                    "
                  >
                    {{ m.quantityDelta > 0 ? '+' + m.quantityDelta : m.quantityDelta }} {{ m.unit }}
                  </td>
                  <td class="py-3 px-3 text-right font-mono tabular-nums font-bold text-slate-900">
                    {{ m.updatedQuantity }} {{ m.unit }}
                  </td>
                  <td class="py-3 px-3 font-mono text-[11px]">
                    @if (m.invoiceNumber) {
                      <div class="font-bold text-blue-700">{{ m.invoiceNumber }}</div>
                    }
                    @if (m.repairJobId) {
                      <div class="text-slate-500">#{{ m.repairJobId }}</div>
                    }
                    @if (!m.invoiceNumber && !m.repairJobId) {
                      <span class="text-slate-400">{{ m.supplierName || '—' }}</span>
                    }
                  </td>
                  <td class="py-3 px-3 text-slate-700">{{ m.performedBy }}</td>
                  <td class="py-3 px-4">
                    <div class="font-mono text-[10px] text-slate-400">
                      {{ formatTimestamp(m.timestamp) }}
                    </div>
                    <div class="text-slate-700 mt-0.5">{{ m.remarks }}</div>
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
export class StockMovementsViewComponent {
  @Input() stockMovements: StockMovement[] = [];
  @Input() garageConfig!: GarageConfig;

  search = '';
  typeFilter: 'all' | StockMovementType = 'all';

  get filtered(): StockMovement[] {
    const q = this.search.trim().toLowerCase();
    return this.stockMovements.filter((m) => {
      const matchesType = this.typeFilter === 'all' || m.transactionType === this.typeFilter;
      const matchesSearch =
        q === '' ||
        m.partName.toLowerCase().includes(q) ||
        m.sku.toLowerCase().includes(q) ||
        m.transactionCode.toLowerCase().includes(q) ||
        (m.invoiceNumber || '').toLowerCase().includes(q) ||
        (m.repairJobId || '').toLowerCase().includes(q) ||
        m.remarks.toLowerCase().includes(q);
      return matchesType && matchesSearch;
    });
  }

  typeBadge(t: StockMovementType): string {
    switch (t) {
      case 'stock_in':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'service_consumption':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'invoice_reversal':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'purchase_return':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'manual_adjustment':
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  }

  formatTimestamp(ts: string): string {
    return new Date(ts).toLocaleString();
  }
}
