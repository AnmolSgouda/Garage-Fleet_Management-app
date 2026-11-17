import { Component, Input, OnChanges, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { FleetApiService } from '../../services/fleet-api.service';
import {
  GarageConfig,
  InventoryItem,
  StockMovement,
  Supplier,
} from '../../models/fleet.models';

@Component({
  selector: 'app-suppliers-view',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  template: `
    <div class="space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-200">
        <div>
          <p class="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            CENTRALIZED VENDOR DIRECTORY · {{ garageConfig.garageName.toUpperCase() }}
          </p>
          <h1 class="text-2xl font-bold tracking-tight text-slate-900 mt-0.5">Suppliers</h1>
          <p class="text-xs text-slate-500 mt-0.5">
            Single-garage master supplier list linked to spare parts catalogue and purchase receipts
          </p>
        </div>

        <div class="flex items-center gap-3">
          <div class="relative">
            <lucide-icon
              name="search"
              class="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
            ></lucide-icon>
            <input
              type="text"
              placeholder="Search supplier..."
              [(ngModel)]="search"
              class="bg-white border border-slate-200 text-xs py-2 pl-9 pr-3 rounded-md w-52 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <button
            type="button"
            (click)="openAddModal()"
            class="flex items-center gap-1.5 bg-[#0051a8] hover:bg-[#003d80] text-white text-xs font-bold px-3.5 py-2 rounded-md shadow-2xs"
          >
            <lucide-icon name="plus" class="w-3.5 h-3.5"></lucide-icon>
            <span>Add Supplier</span>
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <!-- Left List -->
        <div class="space-y-2.5">
          @for (sup of filteredSuppliers; track sup.id) {
            <div
              (click)="selectedSupplierId = sup.id"
              [class]="
                'p-4 rounded-lg border cursor-pointer transition-all bg-white ' +
                (activeSupplier?.id === sup.id
                  ? 'border-[#0051a8] ring-2 ring-blue-500/20 shadow-xs'
                  : 'border-slate-200 hover:border-slate-300')
              "
            >
              <div class="flex items-start justify-between gap-2">
                <div>
                  <h3 class="text-sm font-bold text-slate-900">{{ sup.name }}</h3>
                  <p class="text-xs text-slate-500 mt-0.5">Contact: {{ sup.contactPerson }}</p>
                </div>
                <span class="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                  {{ countSuppliedParts(sup.id) }} parts
                </span>
              </div>
              <div class="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-600 font-mono">
                <span>{{ sup.mobile }}</span>
                <button
                  type="button"
                  (click)="$event.stopPropagation(); openEditModal(sup)"
                  class="text-blue-600 hover:text-blue-800 font-sans font-semibold flex items-center gap-1"
                >
                  <lucide-icon name="pencil" class="w-3 h-3"></lucide-icon>
                  <span>Edit</span>
                </button>
              </div>
            </div>
          }
        </div>

        <!-- Right Detail Panel -->
        <div class="lg:col-span-2 space-y-4">
          @if (activeSupplier; as sup) {
            <div class="bg-white rounded-lg border border-slate-200 p-5 shadow-2xs">
              <div class="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-slate-100">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-[#0051a8]">
                    <lucide-icon name="building-2" class="w-5 h-5"></lucide-icon>
                  </div>
                  <div>
                    <h2 class="text-lg font-bold text-slate-900">{{ sup.name }}</h2>
                    <p class="text-xs text-slate-500">Account Rep: {{ sup.contactPerson }}</p>
                  </div>
                </div>
                <button
                  type="button"
                  (click)="openEditModal(sup)"
                  class="px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded hover:bg-slate-50"
                >
                  Edit Supplier Details
                </button>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 text-xs">
                <div class="flex items-center gap-2 text-slate-700">
                  <lucide-icon name="phone" class="w-4 h-4 text-slate-400"></lucide-icon>
                  <span class="font-mono font-semibold">{{ sup.mobile }}</span>
                </div>
                <div class="flex items-center gap-2 text-slate-700">
                  <lucide-icon name="mail" class="w-4 h-4 text-slate-400"></lucide-icon>
                  <span>{{ sup.email }}</span>
                </div>
                <div class="flex items-start gap-2 text-slate-700">
                  <lucide-icon name="map-pin" class="w-4 h-4 text-slate-400 shrink-0 mt-0.5"></lucide-icon>
                  <span>{{ sup.address }}</span>
                </div>
              </div>
            </div>

            <!-- Supplied Parts -->
            <div class="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-2xs">
              <div class="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <h3 class="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                  <lucide-icon name="package" class="w-4 h-4 text-slate-500"></lucide-icon>
                  <span>Supplied Spare Parts ({{ suppliedItems.length }})</span>
                </h3>
              </div>
              <table class="w-full text-left text-xs">
                <thead class="bg-slate-50/70 border-b border-slate-200 text-[10px] font-bold uppercase text-slate-500">
                  <tr>
                    <th class="py-2.5 px-4">Part / SKU</th>
                    <th class="py-2.5 px-3">Category</th>
                    <th class="py-2.5 px-3 text-right">Current Stock</th>
                    <th class="py-2.5 px-4 text-right">Purchase Cost</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  @for (item of suppliedItems; track item.id) {
                    <tr>
                      <td class="py-2.5 px-4">
                        <div class="font-semibold text-slate-900">{{ item.partName }}</div>
                        <div class="text-[10px] font-mono text-slate-400">{{ item.sku }}</div>
                      </td>
                      <td class="py-2.5 px-3 text-slate-600">{{ item.category }}</td>
                      <td class="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                        {{ item.quantityOnHand }} {{ item.unit }}
                      </td>
                      <td class="py-2.5 px-4 text-right font-mono text-slate-700">
                        {{ garageConfig.currencySymbol }}{{ item.purchaseCost.toLocaleString('en-IN') }}
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>

            <!-- Purchase History -->
            <div class="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-2xs">
              <div class="px-4 py-3 bg-slate-50 border-b border-slate-200">
                <h3 class="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Purchase &amp; Return History ({{ supplierMovements.length }})
                </h3>
              </div>
              <table class="w-full text-left text-xs">
                <thead class="bg-slate-50/70 border-b border-slate-200 text-[10px] font-bold uppercase text-slate-500">
                  <tr>
                    <th class="py-2 px-4">TXN Code</th>
                    <th class="py-2 px-3">Part</th>
                    <th class="py-2 px-3 text-right">Qty</th>
                    <th class="py-2 px-3">Remarks</th>
                    <th class="py-2 px-4 text-right">Date</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  @if (supplierMovements.length === 0) {
                    <tr>
                      <td colspan="5" class="py-6 text-center text-slate-400">
                        No purchase receipts logged for this supplier yet.
                      </td>
                    </tr>
                  } @else {
                    @for (m of supplierMovements; track m.id) {
                      <tr>
                        <td class="py-2 px-4 font-mono font-bold text-slate-700">
                          {{ m.transactionCode }}
                        </td>
                        <td class="py-2 px-3 font-medium text-slate-900">{{ m.partName }}</td>
                        <td
                          [class]="
                            'py-2 px-3 text-right font-mono font-bold ' +
                            (m.quantityDelta >= 0 ? 'text-emerald-700' : 'text-rose-700')
                          "
                        >
                          {{ m.quantityDelta > 0 ? '+' + m.quantityDelta : m.quantityDelta }} {{ m.unit }}
                        </td>
                        <td class="py-2 px-3 text-slate-600">{{ m.remarks }}</td>
                        <td class="py-2 px-4 text-right font-mono text-slate-500">
                          {{ formatDate(m.timestamp) }}
                        </td>
                      </tr>
                    }
                  }
                </tbody>
              </table>
            </div>
          }
        </div>
      </div>

      <!-- Add / Edit Modal -->
      @if (isModalOpen) {
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div class="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden">
            <div class="bg-[#071322] text-white px-5 py-3.5 flex items-center justify-between">
              <h3 class="text-sm font-bold">
                {{ editingSupplier ? 'Edit Supplier' : 'Add New Supplier' }}
              </h3>
              <button
                type="button"
                (click)="isModalOpen = false"
                class="text-slate-400 hover:text-white"
              >
                <lucide-icon name="x" class="w-5 h-5"></lucide-icon>
              </button>
            </div>
            <form (ngSubmit)="handleSubmit()" class="p-5 space-y-3 text-xs">
              <div>
                <label class="block font-bold text-slate-700 mb-1">Supplier Name *</label>
                <input
                  type="text"
                  name="supName"
                  required
                  [(ngModel)]="formState.name"
                  class="w-full p-2 border border-slate-300 rounded"
                />
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block font-bold text-slate-700 mb-1">Contact Person *</label>
                  <input
                    type="text"
                    name="supContact"
                    required
                    [(ngModel)]="formState.contactPerson"
                    class="w-full p-2 border border-slate-300 rounded"
                  />
                </div>
                <div>
                  <label class="block font-bold text-slate-700 mb-1">Mobile *</label>
                  <input
                    type="text"
                    name="supMobile"
                    required
                    [(ngModel)]="formState.mobile"
                    class="w-full p-2 border border-slate-300 rounded font-mono"
                  />
                </div>
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">Email *</label>
                <input
                  type="email"
                  name="supEmail"
                  required
                  [(ngModel)]="formState.email"
                  class="w-full p-2 border border-slate-300 rounded"
                />
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">Address *</label>
                <textarea
                  name="supAddress"
                  rows="2"
                  required
                  [(ngModel)]="formState.address"
                  class="w-full p-2 border border-slate-300 rounded"
                ></textarea>
              </div>
              <div class="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  (click)="isModalOpen = false"
                  class="px-4 py-2 border border-slate-300 rounded text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  [disabled]="isSubmitting"
                  class="px-5 py-2 bg-[#0051a8] text-white font-bold rounded disabled:opacity-50"
                >
                  Save Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      }
    </div>
  `,
})
export class SuppliersViewComponent implements OnInit, OnChanges {
  private readonly fleetApi = inject(FleetApiService);

  @Input() suppliers: Supplier[] = [];
  @Input() inventory: InventoryItem[] = [];
  @Input() stockMovements: StockMovement[] = [];
  @Input() garageConfig!: GarageConfig;

  search = '';
  selectedSupplierId = '';
  isModalOpen = false;
  editingSupplier: Supplier | null = null;
  isSubmitting = false;

  formState = {
    name: '',
    contactPerson: '',
    mobile: '',
    email: '',
    address: '',
  };

  ngOnInit(): void {
    if (!this.selectedSupplierId && this.suppliers.length > 0) {
      this.selectedSupplierId = this.suppliers[0].id;
    }
  }

  ngOnChanges(): void {
    if (!this.selectedSupplierId && this.suppliers.length > 0) {
      this.selectedSupplierId = this.suppliers[0].id;
    }
  }

  get filteredSuppliers(): Supplier[] {
    const q = this.search.trim().toLowerCase();
    return this.suppliers.filter(
      (s) =>
        q === '' ||
        s.name.toLowerCase().includes(q) ||
        s.contactPerson.toLowerCase().includes(q) ||
        s.mobile.includes(q)
    );
  }

  get activeSupplier(): Supplier | null {
    return (
      this.suppliers.find((s) => s.id === this.selectedSupplierId) ||
      this.filteredSuppliers[0] ||
      null
    );
  }

  get suppliedItems(): InventoryItem[] {
    if (!this.activeSupplier) return [];
    return this.inventory.filter((i) => i.supplierId === this.activeSupplier!.id);
  }

  get supplierMovements(): StockMovement[] {
    if (!this.activeSupplier) return [];
    return this.stockMovements.filter(
      (m) =>
        m.supplierId === this.activeSupplier!.id &&
        (m.transactionType === 'stock_in' || m.transactionType === 'purchase_return')
    );
  }

  countSuppliedParts(supplierId: string): number {
    return this.inventory.filter((i) => i.supplierId === supplierId).length;
  }

  formatDate(ts: string): string {
    return new Date(ts).toLocaleDateString();
  }

  openAddModal(): void {
    this.editingSupplier = null;
    this.formState = { name: '', contactPerson: '', mobile: '', email: '', address: '' };
    this.isModalOpen = true;
  }

  openEditModal(sup: Supplier): void {
    this.editingSupplier = sup;
    this.formState = {
      name: sup.name,
      contactPerson: sup.contactPerson,
      mobile: sup.mobile,
      email: sup.email,
      address: sup.address,
    };
    this.isModalOpen = true;
  }

  async handleSubmit(): Promise<void> {
    if (!this.formState.name.trim() || this.isSubmitting) return;
    this.isSubmitting = true;
    if (this.editingSupplier) {
      await this.fleetApi.updateSupplier(this.editingSupplier.id, this.formState);
    } else {
      const created = await this.fleetApi.addSupplier(this.formState);
      this.selectedSupplierId = created.id;
    }
    this.isSubmitting = false;
    this.isModalOpen = false;
  }
}
