import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
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
  InventoryStockStatus,
  StockMovement,
  StockMovementType,
  Supplier,
  getInventoryStatus,
} from '../../models/fleet.models';

@Component({
  selector: 'app-inventory-view',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  template: `
    <div class="space-y-4">
      @if (toastMsg) {
        <div class="fixed top-14 right-6 z-50 bg-[#071322] text-white px-4 py-2.5 rounded-lg shadow-xl border border-slate-700 flex items-center gap-2">
          <lucide-icon name="circle-check" class="w-4 h-4 text-emerald-400"></lucide-icon>
          <span class="text-xs font-semibold">{{ toastMsg }}</span>
        </div>
      }

      <!-- Header -->
      <div class="flex flex-wrap items-center justify-between gap-4 pb-2">
        <div>
          <p class="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            PARTS / CATALOGUE · {{ garageConfig.garageName.toUpperCase() }}
          </p>
          <h1 class="text-2xl font-bold tracking-tight text-slate-900 mt-0.5">Inventory</h1>
          <p class="text-xs text-slate-500 mt-0.5">
            {{ activeCount }} active catalogued parts · searchable stock levels, pricing and rack locations.
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            (click)="navigateStockMovements.emit()"
            class="flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold px-3 py-2 rounded-md shadow-2xs transition-colors"
          >
            <lucide-icon name="arrow-left-right" class="w-3.5 h-3.5 text-slate-500"></lucide-icon>
            <span>Stock Movements</span>
          </button>

          <button
            type="button"
            (click)="handleOpenAdjust()"
            class="flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 text-xs font-bold px-3.5 py-2 rounded-md shadow-2xs transition-colors"
          >
            <lucide-icon name="sliders-horizontal" class="w-3.5 h-3.5 text-slate-600"></lucide-icon>
            <span>Adjust stock</span>
          </button>

          <button
            type="button"
            (click)="handleOpenAdd()"
            class="flex items-center gap-1.5 bg-[#166534] hover:bg-[#14532d] text-white text-xs font-bold px-4 py-2 rounded-md shadow-xs transition-colors"
          >
            <lucide-icon name="plus" class="w-3.5 h-3.5"></lucide-icon>
            <span>Add item</span>
          </button>
        </div>
      </div>

      <!-- Filter Bar -->
      <div class="bg-white rounded-lg border border-slate-200 p-3 shadow-2xs flex flex-wrap items-center gap-2.5">
        <div class="relative flex-1 min-w-[220px]">
          <lucide-icon
            name="search"
            class="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
          ></lucide-icon>
          <input
            type="text"
            placeholder="Search part name or SKU..."
            [(ngModel)]="search"
            class="w-full text-xs py-2 pl-9 pr-3 border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <select
          [(ngModel)]="statusFilter"
          aria-label="Filter by stock status"
          class="text-xs font-medium py-2 px-3 border border-slate-200 rounded-md bg-white text-slate-700 cursor-pointer"
        >
          <option value="all">All stock (Active)</option>
          <option value="In Stock">In Stock</option>
          <option value="Low Stock">Low Stock</option>
          <option value="Out of Stock">Out of Stock</option>
          <option value="inactive">Deactivated / Discontinued</option>
        </select>

        <select
          [(ngModel)]="categoryFilter"
          aria-label="Filter by category"
          class="text-xs font-medium py-2 px-3 border border-slate-200 rounded-md bg-white text-slate-700 cursor-pointer"
        >
          <option value="all">All categories</option>
          @for (c of uniqueCategories; track c) {
            <option [value]="c">{{ c }}</option>
          }
        </select>

        <select
          [(ngModel)]="supplierFilter"
          aria-label="Filter by supplier"
          class="text-xs font-medium py-2 px-3 border border-slate-200 rounded-md bg-white text-slate-700 cursor-pointer"
        >
          <option value="all">All suppliers</option>
          @for (s of uniqueSuppliers; track s) {
            <option [value]="s">{{ s }}</option>
          }
        </select>
      </div>

      <!-- Main Inventory Table -->
      <div class="bg-white rounded-lg border border-slate-200 overflow-x-auto shadow-2xs">
        <table class="w-full text-left text-xs">
          <thead class="bg-slate-50/90 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
            <tr>
              <th class="py-3 px-4">Part</th>
              <th class="py-3 px-3">Category</th>
              <th class="py-3 px-3">On Hand</th>
              <th class="py-3 px-3">Location</th>
              <th class="py-3 px-3">Price / Unit</th>
              <th class="py-3 px-3">Supplier</th>
              <th class="py-3 px-3">Status</th>
              <th class="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            @if (filteredItems.length === 0) {
              <tr>
                <td colspan="8" class="py-10 text-center text-slate-400">
                  No inventory items match the selected filters.
                </td>
              </tr>
            } @else {
              @for (item of filteredItems; track item.id) {
                <tr
                  [class]="
                    'hover:bg-slate-50/70 transition-colors ' +
                    (!item.isActive ? 'opacity-60 bg-slate-50/50' : '')
                  "
                >
                  <td class="py-3 px-4">
                    <button
                      type="button"
                      (click)="viewingItem = item"
                      class="font-bold text-slate-900 hover:text-blue-700 text-left block"
                    >
                      {{ item.partName }}
                    </button>
                    <span class="text-[11px] font-mono text-slate-400">{{ item.sku }}</span>
                  </td>

                  <td class="py-3 px-3">
                    <div class="font-medium text-slate-800">{{ item.category }}</div>
                    <div class="text-[11px] text-slate-400 truncate max-w-[180px]">
                      {{ item.description }}
                    </div>
                  </td>

                  <td class="py-3 px-3 font-mono tabular-nums">
                    <div class="font-bold text-slate-900">
                      {{ item.quantityOnHand }}
                      <span class="font-sans font-normal text-slate-500">{{ item.unit }}</span>
                    </div>
                    <div class="text-[11px] text-slate-400">min {{ item.minimumStock }}</div>
                  </td>

                  <td class="py-3 px-3 font-mono font-semibold text-slate-700">
                    {{ item.storageLocation }}
                  </td>

                  <td class="py-3 px-3 font-mono tabular-nums">
                    <div class="font-bold text-slate-900">
                      {{ garageConfig.currencySymbol }}{{ item.sellingPrice.toLocaleString('en-IN') }}
                    </div>
                    <div class="text-[11px] text-slate-400">
                      Cost {{ garageConfig.currencySymbol }}{{ item.purchaseCost.toLocaleString('en-IN') }}
                    </div>
                  </td>

                  <td class="py-3 px-3">
                    <button
                      type="button"
                      (click)="navigateSuppliers.emit()"
                      class="text-slate-700 hover:text-blue-600 font-medium text-left"
                    >
                      {{ item.supplierName }}
                    </button>
                  </td>

                  <td class="py-3 px-3">
                    @if (!item.isActive) {
                      <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                        Inactive
                      </span>
                    } @else if (getStatus(item) === 'In Stock') {
                      <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        In stock
                      </span>
                    } @else if (getStatus(item) === 'Low Stock') {
                      <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                        Low stock
                      </span>
                    } @else {
                      <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                        Out of stock
                      </span>
                    }
                  </td>

                  <td class="py-3 px-4 text-right whitespace-nowrap">
                    <div class="inline-flex items-center gap-2.5 text-xs font-semibold">
                      <button
                        type="button"
                        (click)="viewingItem = item"
                        class="text-slate-600 hover:text-slate-900"
                        title="View Details"
                      >
                        View
                      </button>
                      <button
                        type="button"
                        (click)="handleOpenAdjust(item.id)"
                        class="text-blue-700 hover:text-blue-900"
                        title="Update Stock"
                      >
                        Stock
                      </button>
                      <button
                        type="button"
                        (click)="handleOpenEdit(item)"
                        class="text-emerald-700 hover:text-emerald-900"
                        title="Edit Item"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        (click)="handleToggleActive(item)"
                        [class]="
                          item.isActive
                            ? 'text-rose-600 hover:text-rose-800'
                            : 'text-emerald-700 hover:text-emerald-900'
                        "
                      >
                        {{ item.isActive ? 'Deactivate' : 'Activate' }}
                      </button>
                    </div>
                  </td>
                </tr>
              }
            }
          </tbody>
        </table>
      </div>

      <!-- ADD NEW ITEM MODAL -->
      @if (isAddModalOpen) {
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div class="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
            <div class="bg-[#071322] text-white px-5 py-3.5 flex items-center justify-between">
              <div>
                <h3 class="text-sm font-bold uppercase tracking-wide">
                  Add New Spare Part / Consumable
                </h3>
                <p class="text-[11px] text-slate-400">
                  SKU / Part Number must be unique across {{ garageConfig.garageName }}
                </p>
              </div>
              <button
                type="button"
                (click)="isAddModalOpen = false"
                class="text-slate-400 hover:text-white p-1"
              >
                <lucide-icon name="x" class="w-5 h-5"></lucide-icon>
              </button>
            </div>

            <form (ngSubmit)="handleSubmitAdd()" class="p-5 overflow-y-auto space-y-4 text-xs">
              @if (formError) {
                <div class="p-3 bg-rose-50 border border-rose-200 rounded text-rose-800 flex items-center gap-2 font-semibold">
                  <lucide-icon name="circle-alert" class="w-4 h-4 text-rose-600 shrink-0"></lucide-icon>
                  <span>{{ formError }}</span>
                </div>
              }

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label class="block font-bold text-slate-700 mb-1">Part Name *</label>
                  <input
                    type="text"
                    name="addPartName"
                    required
                    [(ngModel)]="addForm.partName"
                    placeholder="e.g. Hydraulic Seal Kit"
                    class="w-full p-2 border border-slate-300 rounded"
                  />
                </div>
                <div>
                  <label class="block font-bold text-slate-700 mb-1">SKU / Part Number *</label>
                  <input
                    type="text"
                    name="addSku"
                    required
                    [ngModel]="addForm.sku"
                    (ngModelChange)="addForm.sku = $event.toUpperCase()"
                    placeholder="e.g. HYD-SEAL-90"
                    class="w-full p-2 border border-slate-300 rounded font-mono uppercase"
                  />
                </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label class="block font-bold text-slate-700 mb-1">Category *</label>
                  <input
                    type="text"
                    name="addCategory"
                    required
                    list="inv-categories"
                    [(ngModel)]="addForm.category"
                    class="w-full p-2 border border-slate-300 rounded"
                  />
                  <datalist id="inv-categories">
                    <option value="Oils & Fluids"></option>
                    <option value="Filters"></option>
                    <option value="Braking System"></option>
                    <option value="Clutch & Transmission"></option>
                    <option value="Electrical"></option>
                    <option value="Engine & Ignition"></option>
                    <option value="Lubricants"></option>
                  </datalist>
                </div>
                <div>
                  <label class="block font-bold text-slate-700 mb-1">Unit of Measurement *</label>
                  <select
                    name="addUnit"
                    [(ngModel)]="addForm.unit"
                    class="w-full p-2 border border-slate-300 rounded bg-white"
                  >
                    <option value="Pieces">Pieces</option>
                    <option value="Litres">Litres</option>
                    <option value="Sets">Sets</option>
                    <option value="Bottles">Bottles</option>
                    <option value="Kilograms">Kilograms</option>
                    <option value="Boxes">Boxes</option>
                  </select>
                </div>
                <div>
                  <label class="block font-bold text-slate-700 mb-1">Storage Location *</label>
                  <input
                    type="text"
                    name="addLocation"
                    required
                    [(ngModel)]="addForm.storageLocation"
                    placeholder="Rack / Bin e.g. C-04"
                    class="w-full p-2 border border-slate-300 rounded font-mono"
                  />
                </div>
              </div>

              <div>
                <label class="block font-bold text-slate-700 mb-1">Description</label>
                <input
                  type="text"
                  name="addDescription"
                  [(ngModel)]="addForm.description"
                  placeholder="Part specification & compatibility notes"
                  class="w-full p-2 border border-slate-300 rounded"
                />
              </div>

              <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label class="block font-bold text-slate-700 mb-1">Initial Quantity *</label>
                  <input
                    type="number"
                    name="addQty"
                    min="0"
                    step="0.5"
                    required
                    [(ngModel)]="addForm.initialQuantity"
                    class="w-full p-2 border border-slate-300 rounded font-mono"
                  />
                </div>
                <div>
                  <label class="block font-bold text-slate-700 mb-1">Min Stock Threshold *</label>
                  <input
                    type="number"
                    name="addMin"
                    min="0"
                    step="0.5"
                    required
                    [(ngModel)]="addForm.minimumStock"
                    class="w-full p-2 border border-slate-300 rounded font-mono"
                  />
                </div>
                <div>
                  <label class="block font-bold text-slate-700 mb-1">
                    Purchase Cost ({{ garageConfig.currencySymbol }}) *
                  </label>
                  <input
                    type="number"
                    name="addPurchase"
                    min="0"
                    step="0.01"
                    required
                    [(ngModel)]="addForm.purchaseCost"
                    class="w-full p-2 border border-slate-300 rounded font-mono"
                  />
                </div>
                <div>
                  <label class="block font-bold text-slate-700 mb-1">
                    Selling Price ({{ garageConfig.currencySymbol }}) *
                  </label>
                  <input
                    type="number"
                    name="addSelling"
                    min="0"
                    step="0.01"
                    required
                    [(ngModel)]="addForm.sellingPrice"
                    class="w-full p-2 border border-slate-300 rounded font-mono"
                  />
                </div>
              </div>

              <div class="p-3.5 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                <p class="font-bold text-slate-800 flex items-center gap-1.5">
                  <lucide-icon name="building-2" class="w-3.5 h-3.5 text-blue-600"></lucide-icon>
                  <span>Supplier Information (Select existing or enter new)</span>
                </p>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label class="block font-semibold text-slate-700 mb-1">Supplier Name *</label>
                    <input
                      type="text"
                      name="addSupName"
                      required
                      list="supplier-names"
                      [ngModel]="addForm.supplierName"
                      (ngModelChange)="handleSupplierPresetChange($event)"
                      class="w-full p-2 border border-slate-300 rounded bg-white"
                    />
                    <datalist id="supplier-names">
                      @for (s of suppliers; track s.id) {
                        <option [value]="s.name"></option>
                      }
                    </datalist>
                  </div>
                  <div>
                    <label class="block font-semibold text-slate-700 mb-1">
                      Supplier Contact Number
                    </label>
                    <input
                      type="text"
                      name="addSupMobile"
                      [(ngModel)]="addForm.supplierMobile"
                      class="w-full p-2 border border-slate-300 rounded bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label class="block font-semibold text-slate-700 mb-1">Supplier Email</label>
                    <input
                      type="email"
                      name="addSupEmail"
                      [(ngModel)]="addForm.supplierEmail"
                      class="w-full p-2 border border-slate-300 rounded bg-white"
                    />
                  </div>
                  <div>
                    <label class="block font-semibold text-slate-700 mb-1">Supplier Address</label>
                    <input
                      type="text"
                      name="addSupAddr"
                      [(ngModel)]="addForm.supplierAddress"
                      class="w-full p-2 border border-slate-300 rounded bg-white"
                    />
                  </div>
                </div>
              </div>

              <div class="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  (click)="isAddModalOpen = false"
                  class="px-4 py-2 text-slate-600 hover:text-slate-900 border border-slate-300 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  [disabled]="isSubmitting"
                  class="px-5 py-2 font-bold text-white bg-[#166534] hover:bg-[#14532d] rounded disabled:opacity-50"
                >
                  {{ isSubmitting ? 'Saving...' : 'Save Inventory Item' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      }

      <!-- EDIT ITEM MODAL -->
      @if (editingItem) {
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div class="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-xl w-full overflow-hidden">
            <div class="bg-[#071322] text-white px-5 py-3.5 flex items-center justify-between">
              <h3 class="text-sm font-bold flex items-center gap-2">
                <lucide-icon name="pencil" class="w-4 h-4 text-cyan-400"></lucide-icon>
                <span>Edit Part: {{ editingItem.partName }}</span>
              </h3>
              <button
                type="button"
                (click)="editingItem = null"
                class="text-slate-400 hover:text-white"
              >
                <lucide-icon name="x" class="w-5 h-5"></lucide-icon>
              </button>
            </div>

            <form (ngSubmit)="handleSubmitEdit()" class="p-5 space-y-3 text-xs">
              @if (formError) {
                <div class="p-3 bg-rose-50 border border-rose-200 rounded text-rose-800 font-semibold">
                  {{ formError }}
                </div>
              }

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block font-bold text-slate-700 mb-1">Part Name *</label>
                  <input
                    type="text"
                    name="editPartName"
                    required
                    [(ngModel)]="editForm.partName"
                    class="w-full p-2 border border-slate-300 rounded"
                  />
                </div>
                <div>
                  <label class="block font-bold text-slate-700 mb-1">SKU *</label>
                  <input
                    type="text"
                    name="editSku"
                    required
                    [ngModel]="editForm.sku"
                    (ngModelChange)="editForm.sku = $event.toUpperCase()"
                    class="w-full p-2 border border-slate-300 rounded font-mono"
                  />
                </div>
              </div>

              <div class="grid grid-cols-3 gap-3">
                <div>
                  <label class="block font-bold text-slate-700 mb-1">Category</label>
                  <input
                    type="text"
                    name="editCat"
                    required
                    [(ngModel)]="editForm.category"
                    class="w-full p-2 border border-slate-300 rounded"
                  />
                </div>
                <div>
                  <label class="block font-bold text-slate-700 mb-1">Unit</label>
                  <input
                    type="text"
                    name="editUnit"
                    required
                    [(ngModel)]="editForm.unit"
                    class="w-full p-2 border border-slate-300 rounded"
                  />
                </div>
                <div>
                  <label class="block font-bold text-slate-700 mb-1">Rack Location</label>
                  <input
                    type="text"
                    name="editLoc"
                    required
                    [(ngModel)]="editForm.storageLocation"
                    class="w-full p-2 border border-slate-300 rounded font-mono"
                  />
                </div>
              </div>

              <div>
                <label class="block font-bold text-slate-700 mb-1">Description</label>
                <input
                  type="text"
                  name="editDesc"
                  [(ngModel)]="editForm.description"
                  class="w-full p-2 border border-slate-300 rounded"
                />
              </div>

              <div class="grid grid-cols-3 gap-3">
                <div>
                  <label class="block font-bold text-slate-700 mb-1">Minimum Stock</label>
                  <input
                    type="number"
                    name="editMin"
                    min="0"
                    step="0.5"
                    [(ngModel)]="editForm.minimumStock"
                    class="w-full p-2 border border-slate-300 rounded font-mono"
                  />
                </div>
                <div>
                  <label class="block font-bold text-slate-700 mb-1">
                    Purchase Cost ({{ garageConfig.currencySymbol }})
                  </label>
                  <input
                    type="number"
                    name="editCost"
                    min="0"
                    step="0.01"
                    [(ngModel)]="editForm.purchaseCost"
                    class="w-full p-2 border border-slate-300 rounded font-mono"
                  />
                </div>
                <div>
                  <label class="block font-bold text-slate-700 mb-1">
                    Selling Price ({{ garageConfig.currencySymbol }})
                  </label>
                  <input
                    type="number"
                    name="editPrice"
                    min="0"
                    step="0.01"
                    [(ngModel)]="editForm.sellingPrice"
                    class="w-full p-2 border border-slate-300 rounded font-mono"
                  />
                </div>
              </div>

              <div>
                <label class="block font-bold text-slate-700 mb-1">Supplier</label>
                <select
                  name="editSup"
                  [(ngModel)]="editForm.supplierName"
                  class="w-full p-2 border border-slate-300 rounded bg-white"
                >
                  @for (s of suppliers; track s.id) {
                    <option [value]="s.name">{{ s.name }}</option>
                  }
                </select>
              </div>

              <div class="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  (click)="editingItem = null"
                  class="px-4 py-2 border border-slate-300 rounded text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  [disabled]="isSubmitting"
                  class="px-5 py-2 bg-[#0051a8] hover:bg-[#003d80] text-white font-bold rounded disabled:opacity-50"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      }

      <!-- ADJUST STOCK / PURCHASE / RETURN MODAL -->
      @if (isAdjustModalOpen) {
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div class="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden">
            <div class="bg-[#071322] text-white px-5 py-3.5 flex items-center justify-between">
              <h3 class="text-sm font-bold flex items-center gap-2">
                <lucide-icon name="sliders-horizontal" class="w-4 h-4 text-cyan-400"></lucide-icon>
                <span>Adjust / Restock Inventory</span>
              </h3>
              <button
                type="button"
                (click)="closeAdjustModal()"
                class="text-slate-400 hover:text-white"
              >
                <lucide-icon name="x" class="w-5 h-5"></lucide-icon>
              </button>
            </div>

            <form (ngSubmit)="handleSubmitAdjust()" class="p-5 space-y-4 text-xs">
              @if (adjustError) {
                <div class="p-3 bg-rose-50 border border-rose-200 rounded text-rose-800 font-semibold">
                  {{ adjustError }}
                </div>
              }

              <div>
                <label class="block font-bold text-slate-700 mb-1">Select Spare Part *</label>
                <select
                  name="adjustTargetId"
                  [(ngModel)]="adjustTargetId"
                  class="w-full p-2 border border-slate-300 rounded bg-white font-medium"
                >
                  @for (i of inventory; track i.id) {
                    <option [value]="i.id">
                      {{ i.partName }} ({{ i.sku }}) — Current: {{ i.quantityOnHand }} {{ i.unit }}
                    </option>
                  }
                </select>
              </div>

              <div>
                <label class="block font-bold text-slate-700 mb-1">Transaction Type *</label>
                <select
                  name="adjustTxnType"
                  [ngModel]="adjustTxnType"
                  (ngModelChange)="onAdjustTypeChange($event)"
                  class="w-full p-2 border border-slate-300 rounded bg-white font-semibold"
                >
                  <option value="stock_in">Stock Purchase / Stock In (+)</option>
                  <option value="manual_adjustment">Manual Stock Audit / Adjustment</option>
                  <option value="purchase_return">Purchase Return to Supplier (-)</option>
                </select>
              </div>

              <div class="grid grid-cols-2 gap-3">
                @if (adjustTxnType === 'manual_adjustment') {
                  <div>
                    <label class="block font-bold text-slate-700 mb-1">Entry Mode</label>
                    <select
                      name="adjustMode"
                      [(ngModel)]="adjustMode"
                      class="w-full p-2 border border-slate-300 rounded bg-white"
                    >
                      <option value="delta">Add / Subtract (+/-)</option>
                      <option value="set">Set Exact Count</option>
                    </select>
                  </div>
                }

                <div [class]="adjustTxnType === 'manual_adjustment' ? '' : 'col-span-2'">
                  <label class="block font-bold text-slate-700 mb-1">
                    {{ adjustMode === 'set' ? 'New Total Quantity *' : 'Quantity *' }}
                  </label>
                  <input
                    type="number"
                    name="adjustValue"
                    step="0.5"
                    required
                    [(ngModel)]="adjustValue"
                    class="w-full p-2 border border-slate-300 rounded font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label class="block font-bold text-slate-700 mb-1">Remarks / PO Reference</label>
                <input
                  type="text"
                  name="adjustRemarks"
                  [(ngModel)]="adjustRemarks"
                  placeholder="e.g. Supplier delivery challan #DC-491"
                  class="w-full p-2 border border-slate-300 rounded"
                />
              </div>

              <div class="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  (click)="closeAdjustModal()"
                  class="px-4 py-2 border border-slate-300 rounded text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  [disabled]="isSubmitting"
                  class="px-5 py-2 bg-[#0051a8] hover:bg-[#003d80] text-white font-bold rounded disabled:opacity-50"
                >
                  Commit Stock Movement
                </button>
              </div>
            </form>
          </div>
        </div>
      }

      <!-- VIEW PART DETAILS MODAL -->
      @if (viewingItem; as vItem) {
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div class="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden flex flex-col max-h-[88vh]">
            <div class="bg-[#071322] text-white px-5 py-4 flex items-center justify-between">
              <div>
                <span class="text-[10px] font-mono text-cyan-400 uppercase font-bold">
                  {{ vItem.sku }} · {{ vItem.category }}
                </span>
                <h3 class="text-base font-bold mt-0.5">{{ vItem.partName }}</h3>
              </div>
              <button
                type="button"
                (click)="closeViewModal()"
                class="text-slate-400 hover:text-white"
              >
                <lucide-icon name="x" class="w-5 h-5"></lucide-icon>
              </button>
            </div>

            <div class="p-5 overflow-y-auto space-y-4 text-xs">
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-slate-50 rounded-lg border border-slate-200">
                <div>
                  <span class="text-slate-400 block text-[10px] uppercase">On Hand</span>
                  <span class="font-mono font-bold text-sm text-slate-900">
                    {{ vItem.quantityOnHand }} {{ vItem.unit }}
                  </span>
                </div>
                <div>
                  <span class="text-slate-400 block text-[10px] uppercase">Min Threshold</span>
                  <span class="font-mono font-bold text-sm text-slate-900">
                    {{ vItem.minimumStock }} {{ vItem.unit }}
                  </span>
                </div>
                <div>
                  <span class="text-slate-400 block text-[10px] uppercase">Selling Price</span>
                  <span class="font-mono font-bold text-sm text-slate-900">
                    {{ garageConfig.currencySymbol }}{{ vItem.sellingPrice }}
                  </span>
                </div>
                <div>
                  <span class="text-slate-400 block text-[10px] uppercase">Rack Location</span>
                  <span class="font-mono font-bold text-sm text-slate-900">
                    {{ vItem.storageLocation }}
                  </span>
                </div>
              </div>

              @if (getSupplierForItem(vItem); as sup) {
                <div class="p-3.5 bg-white rounded-lg border border-slate-200">
                  <h4 class="font-bold text-slate-900 mb-2 flex items-center gap-1.5">
                    <lucide-icon name="building-2" class="w-4 h-4 text-blue-600"></lucide-icon>
                    <span>Primary Supplier: {{ sup.name }}</span>
                  </h4>
                  <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-slate-600">
                    <div class="flex items-center gap-1.5">
                      <lucide-icon name="phone" class="w-3.5 h-3.5 text-slate-400"></lucide-icon>
                      <span class="font-mono">{{ sup.mobile }}</span>
                    </div>
                    <div class="flex items-center gap-1.5">
                      <lucide-icon name="mail" class="w-3.5 h-3.5 text-slate-400"></lucide-icon>
                      <span>{{ sup.email }}</span>
                    </div>
                    <div class="flex items-center gap-1.5">
                      <lucide-icon name="map-pin" class="w-3.5 h-3.5 text-slate-400 shrink-0"></lucide-icon>
                      <span class="truncate">{{ sup.address }}</span>
                    </div>
                  </div>
                </div>
              } @else {
                <div class="p-3.5 bg-white rounded-lg border border-slate-200">
                  <h4 class="font-bold text-slate-900 mb-1 flex items-center gap-1.5">
                    <lucide-icon name="building-2" class="w-4 h-4 text-blue-600"></lucide-icon>
                    <span>Primary Supplier: {{ vItem.supplierName }}</span>
                  </h4>
                </div>
              }

              <div>
                <h4 class="font-bold text-slate-900 mb-2">Recent Stock Movements</h4>
                <div class="border border-slate-200 rounded-lg overflow-hidden">
                  <table class="w-full text-left text-[11px]">
                    <thead class="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase">
                      <tr>
                        <th class="py-2 px-2.5">Code</th>
                        <th class="py-2 px-2.5">Type</th>
                        <th class="py-2 px-2.5 text-right">Prev</th>
                        <th class="py-2 px-2.5 text-right">Change</th>
                        <th class="py-2 px-2.5 text-right">Updated</th>
                        <th class="py-2 px-2.5">Remarks</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
                      @for (m of getItemMovements(vItem.id); track m.id) {
                        <tr>
                          <td class="py-2 px-2.5 font-mono font-bold text-slate-700">
                            {{ m.transactionCode }}
                          </td>
                          <td class="py-2 px-2.5 capitalize">
                            {{ m.transactionType.replaceAll('_', ' ') }}
                          </td>
                          <td class="py-2 px-2.5 text-right font-mono">{{ m.previousQuantity }}</td>
                          <td
                            [class]="
                              'py-2 px-2.5 text-right font-mono font-bold ' +
                              (m.quantityDelta >= 0 ? 'text-emerald-700' : 'text-rose-700')
                            "
                          >
                            {{ m.quantityDelta > 0 ? '+' + m.quantityDelta : m.quantityDelta }}
                          </td>
                          <td class="py-2 px-2.5 text-right font-mono font-bold text-slate-900">
                            {{ m.updatedQuantity }}
                          </td>
                          <td class="py-2 px-2.5 text-slate-600">{{ m.remarks }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div class="p-4 bg-slate-50 border-t border-slate-200 flex justify-between">
              <button
                type="button"
                (click)="openAdjustFromView(vItem.id)"
                class="px-4 py-1.5 text-xs font-bold bg-[#0051a8] hover:bg-[#003d80] text-white rounded"
              >
                Update Stock
              </button>
              <button
                type="button"
                (click)="closeViewModal()"
                class="px-4 py-1.5 text-xs font-semibold border border-slate-300 rounded bg-white text-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class InventoryViewComponent implements OnInit, OnChanges {
  private readonly fleetApi = inject(FleetApiService);

  @Input() inventory: InventoryItem[] = [];
  @Input() suppliers: Supplier[] = [];
  @Input() stockMovements: StockMovement[] = [];
  @Input() garageConfig!: GarageConfig;
  @Input() initialFocusItemId: string | null = null;
  @Input() initialOpenAdjustForItemId: string | null = null;

  @Output() clearInitialFocus = new EventEmitter<void>();
  @Output() navigateStockMovements = new EventEmitter<void>();
  @Output() navigateSuppliers = new EventEmitter<void>();

  search = '';
  statusFilter: 'all' | InventoryStockStatus | 'inactive' = 'all';
  categoryFilter = 'all';
  supplierFilter = 'all';

  isAddModalOpen = false;
  editingItem: InventoryItem | null = null;
  viewingItem: InventoryItem | null = null;
  adjustTargetId = '';
  isAdjustModalOpen = false;
  isSubmitting = false;

  toastMsg: string | null = null;
  formError: string | null = null;

  addForm = {
    partName: '',
    sku: '',
    category: 'Filters',
    description: '',
    unit: 'Pieces',
    initialQuantity: '10',
    minimumStock: '3',
    purchaseCost: '0',
    sellingPrice: '0',
    storageLocation: 'B-05',
    supplierName: '',
    supplierMobile: '',
    supplierEmail: '',
    supplierAddress: '',
  };

  editForm = {
    partName: '',
    sku: '',
    category: '',
    description: '',
    unit: '',
    minimumStock: '0',
    purchaseCost: '0',
    sellingPrice: '0',
    storageLocation: '',
    supplierName: '',
  };

  adjustTxnType: Extract<StockMovementType, 'stock_in' | 'manual_adjustment' | 'purchase_return'> =
    'stock_in';
  adjustMode: 'delta' | 'set' = 'delta';
  adjustValue = '5';
  adjustRemarks = '';
  adjustError: string | null = null;

  ngOnInit(): void {
    this.syncInitialDeepLinks();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialFocusItemId'] || changes['initialOpenAdjustForItemId']) {
      this.syncInitialDeepLinks();
    }
  }

  private syncInitialDeepLinks(): void {
    if (this.initialFocusItemId) {
      this.viewingItem =
        this.inventory.find((i) => i.id === this.initialFocusItemId) || null;
    }
    if (this.initialOpenAdjustForItemId) {
      this.adjustTargetId = this.initialOpenAdjustForItemId;
      this.isAdjustModalOpen = true;
    }
  }

  get activeCount(): number {
    return this.inventory.filter((i) => i.isActive).length;
  }

  get uniqueCategories(): string[] {
    return Array.from(new Set(this.inventory.map((i) => i.category))).sort();
  }

  get uniqueSuppliers(): string[] {
    return Array.from(new Set(this.inventory.map((i) => i.supplierName))).sort();
  }

  get filteredItems(): InventoryItem[] {
    const q = this.search.trim().toLowerCase();
    return this.inventory.filter((item) => {
      const stockStatus = getInventoryStatus(item);
      const matchesSearch =
        q === '' ||
        item.partName.toLowerCase().includes(q) ||
        item.sku.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.supplierName.toLowerCase().includes(q);

      const matchesStatus =
        this.statusFilter === 'all'
          ? item.isActive
          : this.statusFilter === 'inactive'
          ? !item.isActive
          : item.isActive && stockStatus === this.statusFilter;

      const matchesCategory =
        this.categoryFilter === 'all' || item.category === this.categoryFilter;
      const matchesSupplier =
        this.supplierFilter === 'all' || item.supplierName === this.supplierFilter;

      return matchesSearch && matchesStatus && matchesCategory && matchesSupplier;
    });
  }

  getStatus(item: InventoryItem): InventoryStockStatus {
    return getInventoryStatus(item);
  }

  getSupplierForItem(item: InventoryItem): Supplier | null {
    return this.suppliers.find((s) => s.id === item.supplierId) || null;
  }

  getItemMovements(itemId: string): StockMovement[] {
    return this.stockMovements.filter((m) => m.inventoryItemId === itemId).slice(0, 8);
  }

  private notifyToast(msg: string): void {
    this.toastMsg = msg;
    setTimeout(() => {
      this.toastMsg = null;
    }, 3200);
  }

  handleOpenAdd(): void {
    this.formError = null;
    const firstSup = this.suppliers[0];
    this.addForm = {
      partName: '',
      sku: '',
      category: 'Filters',
      description: '',
      unit: 'Pieces',
      initialQuantity: '10',
      minimumStock: '4',
      purchaseCost: '250',
      sellingPrice: '390',
      storageLocation: 'A-06',
      supplierName: firstSup?.name || '',
      supplierMobile: firstSup?.mobile || '',
      supplierEmail: firstSup?.email || '',
      supplierAddress: firstSup?.address || '',
    };
    this.isAddModalOpen = true;
  }

  handleSupplierPresetChange(supName: string): void {
    const matched = this.suppliers.find((s) => s.name === supName);
    this.addForm = {
      ...this.addForm,
      supplierName: supName,
      supplierMobile: matched?.mobile || this.addForm.supplierMobile,
      supplierEmail: matched?.email || this.addForm.supplierEmail,
      supplierAddress: matched?.address || this.addForm.supplierAddress,
    };
  }

  async handleSubmitAdd(): Promise<void> {
    if (this.isSubmitting) return;
    this.formError = null;
    this.isSubmitting = true;

    const partLabel = this.addForm.partName;
    const skuLabel = this.addForm.sku.toUpperCase();

    const res = await this.fleetApi.addInventoryItem({
      partName: this.addForm.partName,
      sku: this.addForm.sku,
      category: this.addForm.category,
      description: this.addForm.description,
      unit: this.addForm.unit,
      initialQuantity: parseFloat(this.addForm.initialQuantity) || 0,
      minimumStock: parseFloat(this.addForm.minimumStock) || 0,
      purchaseCost: parseFloat(this.addForm.purchaseCost) || 0,
      sellingPrice: parseFloat(this.addForm.sellingPrice) || 0,
      storageLocation: this.addForm.storageLocation,
      supplierName: this.addForm.supplierName,
      supplierMobile: this.addForm.supplierMobile,
      supplierEmail: this.addForm.supplierEmail,
      supplierAddress: this.addForm.supplierAddress,
    });
    this.isSubmitting = false;

    if (!res.success) {
      this.formError = res.error || 'Could not add inventory item.';
      return;
    }

    this.isAddModalOpen = false;
    this.notifyToast(`Added "${partLabel}" (${skuLabel}) to inventory.`);
  }

  handleOpenEdit(item: InventoryItem): void {
    this.formError = null;
    this.editingItem = item;
    this.editForm = {
      partName: item.partName,
      sku: item.sku,
      category: item.category,
      description: item.description,
      unit: item.unit,
      minimumStock: String(item.minimumStock),
      purchaseCost: String(item.purchaseCost),
      sellingPrice: String(item.sellingPrice),
      storageLocation: item.storageLocation,
      supplierName: item.supplierName,
    };
  }

  async handleSubmitEdit(): Promise<void> {
    if (!this.editingItem || this.isSubmitting) return;
    this.formError = null;
    this.isSubmitting = true;
    const matchedSup = this.suppliers.find(
      (s) => s.name.toLowerCase() === this.editForm.supplierName.trim().toLowerCase()
    );
    const res = await this.fleetApi.updateInventoryItem(this.editingItem.id, {
      partName: this.editForm.partName,
      sku: this.editForm.sku,
      category: this.editForm.category,
      description: this.editForm.description,
      unit: this.editForm.unit,
      minimumStock: parseFloat(this.editForm.minimumStock) || 0,
      purchaseCost: parseFloat(this.editForm.purchaseCost) || 0,
      sellingPrice: parseFloat(this.editForm.sellingPrice) || 0,
      storageLocation: this.editForm.storageLocation,
      supplierId: matchedSup?.id || this.editingItem.supplierId,
      supplierName: this.editForm.supplierName.trim() || this.editingItem.supplierName,
    });
    this.isSubmitting = false;

    if (!res.success) {
      this.formError = res.error || 'Failed to update item.';
      return;
    }
    this.editingItem = null;
    this.notifyToast(`Updated "${this.editForm.partName}".`);
  }

  async handleToggleActive(item: InventoryItem): Promise<void> {
    const nextLabel = item.isActive ? 'deactivated' : 'reactivated';
    await this.fleetApi.toggleInventoryItemActive(item.id);
    this.notifyToast(`${item.partName} ${nextLabel}.`);
  }

  handleOpenAdjust(itemId?: string): void {
    this.adjustError = null;
    this.adjustTargetId =
      itemId || this.inventory.find((i) => i.isActive)?.id || this.inventory[0]?.id || '';
    this.adjustTxnType = 'stock_in';
    this.adjustMode = 'delta';
    this.adjustValue = '5';
    this.adjustRemarks = '';
    this.isAdjustModalOpen = true;
  }

  onAdjustTypeChange(
    val: Extract<StockMovementType, 'stock_in' | 'manual_adjustment' | 'purchase_return'>
  ): void {
    this.adjustTxnType = val;
    if (val !== 'manual_adjustment') {
      this.adjustMode = 'delta';
    }
  }

  closeAdjustModal(): void {
    this.isAdjustModalOpen = false;
    this.clearInitialFocus.emit();
  }

  async handleSubmitAdjust(): Promise<void> {
    if (!this.adjustTargetId || this.isSubmitting) return;
    this.adjustError = null;

    const val = parseFloat(this.adjustValue);
    if (isNaN(val)) {
      this.adjustError = 'Enter a valid numeric quantity.';
      return;
    }

    this.isSubmitting = true;
    const res = await this.fleetApi.adjustInventoryStock({
      inventoryItemId: this.adjustTargetId,
      transactionType: this.adjustTxnType,
      mode: this.adjustMode,
      value: val,
      remarks:
        this.adjustRemarks.trim() ||
        (this.adjustTxnType === 'stock_in'
          ? 'Supplier purchase stock replenishment'
          : this.adjustTxnType === 'purchase_return'
          ? 'Returned defective batch to supplier'
          : 'Manual physical stock audit'),
    });
    this.isSubmitting = false;

    if (!res.success) {
      this.adjustError = res.error || 'Stock adjustment failed.';
      return;
    }

    this.isAdjustModalOpen = false;
    this.clearInitialFocus.emit();
    this.notifyToast('Stock level updated and logged to Stock Movements ledger.');
  }

  closeViewModal(): void {
    this.viewingItem = null;
    this.clearInitialFocus.emit();
  }

  openAdjustFromView(id: string): void {
    this.viewingItem = null;
    this.handleOpenAdjust(id);
  }
}
