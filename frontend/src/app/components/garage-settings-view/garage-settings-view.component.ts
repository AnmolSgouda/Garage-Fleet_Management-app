import { Component, Input, OnChanges, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { FleetApiService } from '../../services/fleet-api.service';
import {
  GarageConfig,
  InventoryItem,
  ServiceTemplate,
  ServiceTemplateMaterial,
} from '../../models/fleet.models';

@Component({
  selector: 'app-garage-settings-view',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  template: `
    <div class="space-y-6 max-w-5xl">
      <div class="pb-3 border-b border-slate-200">
        <p class="text-[10px] font-bold uppercase tracking-widest text-slate-400">
          SINGLE-GARAGE CONFIGURATION
        </p>
        <h1 class="text-2xl font-bold tracking-tight text-slate-900 mt-0.5 flex items-center gap-2">
          <lucide-icon name="warehouse" class="w-5 h-5 text-[#0051a8]"></lucide-icon>
          <span>Garage Branding, Tax &amp; Service Templates</span>
        </h1>
        <p class="text-xs text-slate-500 mt-0.5">
          All vehicles, inventory parts, suppliers, repair jobs, and invoices belong exclusively to this single garage facility.
        </p>
      </div>

      @if (savedBanner) {
        <div class="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 text-xs font-semibold flex items-center gap-2">
          <lucide-icon name="circle-check" class="w-4 h-4 text-emerald-600"></lucide-icon>
          <span>Garage configuration saved. All new invoices will reflect updated branding and tax rules.</span>
        </div>
      }

      <!-- Garage Branding & Tax Form -->
      <form
        (ngSubmit)="handleSaveConfig()"
        class="bg-white rounded-lg border border-slate-200 p-5 shadow-2xs space-y-4 text-xs"
      >
        <h2 class="text-sm font-bold text-slate-900">Garage Identity &amp; Invoice Configuration</h2>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block font-bold text-slate-700 mb-1">Garage Name *</label>
            <input
              type="text"
              name="garageName"
              required
              [(ngModel)]="form.garageName"
              class="w-full p-2 border border-slate-300 rounded"
            />
          </div>
          <div>
            <label class="block font-bold text-slate-700 mb-1">Tagline</label>
            <input
              type="text"
              name="tagline"
              [(ngModel)]="form.tagline"
              class="w-full p-2 border border-slate-300 rounded"
            />
          </div>
        </div>

        <div>
          <label class="block font-bold text-slate-700 mb-1">Garage Address *</label>
          <input
            type="text"
            name="address"
            required
            [(ngModel)]="form.address"
            class="w-full p-2 border border-slate-300 rounded"
          />
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label class="block font-bold text-slate-700 mb-1">Contact Phone *</label>
            <input
              type="text"
              name="phone"
              required
              [(ngModel)]="form.phone"
              class="w-full p-2 border border-slate-300 rounded font-mono"
            />
          </div>
          <div>
            <label class="block font-bold text-slate-700 mb-1">Email *</label>
            <input
              type="email"
              name="email"
              required
              [(ngModel)]="form.email"
              class="w-full p-2 border border-slate-300 rounded"
            />
          </div>
          <div>
            <label class="block font-bold text-slate-700 mb-1">GSTIN / Tax Registration</label>
            <input
              type="text"
              name="gstNumber"
              [(ngModel)]="form.gstNumber"
              class="w-full p-2 border border-slate-300 rounded font-mono"
            />
          </div>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 border-t border-slate-100">
          <div>
            <label class="block font-bold text-slate-700 mb-1">Apply GST / Tax</label>
            <label class="flex items-center gap-2 p-2 border border-slate-200 rounded bg-slate-50 cursor-pointer">
              <input
                type="checkbox"
                name="taxEnabled"
                [(ngModel)]="form.taxEnabled"
              />
              <span class="font-semibold">{{ form.taxEnabled ? 'Enabled' : 'Disabled' }}</span>
            </label>
          </div>
          <div>
            <label class="block font-bold text-slate-700 mb-1">Tax Rate (%)</label>
            <input
              type="number"
              name="taxRatePercent"
              min="0"
              max="50"
              step="0.5"
              [(ngModel)]="form.taxRatePercent"
              class="w-full p-2 border border-slate-300 rounded font-mono"
            />
          </div>
          <div>
            <label class="block font-bold text-slate-700 mb-1">Invoice Prefix</label>
            <input
              type="text"
              name="invoicePrefix"
              [ngModel]="form.invoicePrefix"
              (ngModelChange)="form.invoicePrefix = $event.toUpperCase()"
              class="w-full p-2 border border-slate-300 rounded font-mono uppercase"
            />
          </div>
          <div>
            <label class="block font-bold text-slate-700 mb-1">Currency Symbol</label>
            <input
              type="text"
              name="currencySymbol"
              [(ngModel)]="form.currencySymbol"
              class="w-full p-2 border border-slate-300 rounded font-mono"
            />
          </div>
        </div>

        <div class="flex justify-end pt-2">
          <button
            type="submit"
            [disabled]="isSavingConfig"
            class="px-5 py-2 bg-[#0051a8] hover:bg-[#003d80] text-white font-bold rounded shadow-2xs disabled:opacity-50"
          >
            {{ isSavingConfig ? 'Saving...' : 'Save Garage Settings' }}
          </button>
        </div>
      </form>

      <!-- Configurable Service Templates -->
      <div class="bg-white rounded-lg border border-slate-200 p-5 shadow-2xs space-y-4 text-xs">
        <div>
          <h2 class="text-sm font-bold text-slate-900 flex items-center gap-2">
            <lucide-icon name="wrench" class="w-4 h-4 text-[#0051a8]"></lucide-icon>
            <span>Service Type Material Templates ({{ serviceTemplates.length }})</span>
          </h2>
          <p class="text-slate-500 mt-0.5">
            Default spare-parts estimates automatically loaded during service booking.
          </p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          @for (tpl of serviceTemplates; track tpl.id) {
            <div class="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50">
              <div class="flex items-center justify-between mb-1">
                <span class="font-bold text-slate-900">{{ tpl.name }}</span>
                <span class="font-mono font-bold text-slate-700">
                  Labour: {{ garageConfig.currencySymbol }}{{ tpl.defaultLabourCharge }}
                </span>
              </div>
              <p class="text-[11px] text-slate-500 mb-2">{{ tpl.description }}</p>
              <div class="flex flex-wrap gap-1.5">
                @if (tpl.materials.length === 0) {
                  <span class="text-[10px] text-slate-400">No default parts</span>
                } @else {
                  @for (m of tpl.materials; track m.id) {
                    <span class="text-[10px] font-mono bg-white border border-slate-200 px-2 py-0.5 rounded text-slate-700">
                      {{ m.partName }}: {{ m.defaultQuantity }} {{ m.unit }}
                    </span>
                  }
                }
              </div>
            </div>
          }
        </div>

        <!-- Create Custom Service Template -->
        <form
          (ngSubmit)="handleCreateTemplate()"
          class="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3"
        >
          <h3 class="font-bold text-slate-900">Create Custom Service Template</h3>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              name="tplName"
              required
              placeholder="Service Type Name (e.g. Suspension Audit)"
              [(ngModel)]="tplName"
              class="p-2 border border-slate-300 rounded bg-white"
            />
            <input
              type="text"
              name="tplDesc"
              placeholder="Short Description"
              [(ngModel)]="tplDesc"
              class="p-2 border border-slate-300 rounded bg-white"
            />
            <input
              type="number"
              name="tplLabour"
              min="0"
              placeholder="Default Labour"
              [(ngModel)]="tplLabour"
              class="p-2 border border-slate-300 rounded bg-white font-mono"
            />
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <select
              name="pickItemId"
              [(ngModel)]="pickItemId"
              class="p-2 border border-slate-300 rounded bg-white"
            >
              @for (i of inventory; track i.id) {
                <option [value]="i.id">{{ i.partName }} ({{ i.unit }})</option>
              }
            </select>
            <input
              type="number"
              name="pickQty"
              min="0.1"
              step="0.5"
              [(ngModel)]="pickQty"
              class="w-20 p-2 border border-slate-300 rounded bg-white font-mono"
            />
            <button
              type="button"
              (click)="handleAddTplMaterial()"
              class="px-3 py-2 bg-slate-800 text-white rounded font-semibold flex items-center gap-1"
            >
              <lucide-icon name="plus" class="w-3.5 h-3.5"></lucide-icon>
              <span>Add Material</span>
            </button>
          </div>

          @if (tplMaterials.length > 0) {
            <div class="flex flex-wrap gap-2">
              @for (m of tplMaterials; track m.id) {
                <span class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-300 rounded text-[11px] font-mono">
                  <span>{{ m.partName }} × {{ m.defaultQuantity }} {{ m.unit }}</span>
                  <button
                    type="button"
                    (click)="removeTplMaterial(m.id)"
                    class="text-rose-600"
                  >
                    <lucide-icon name="trash-2" class="w-3 h-3"></lucide-icon>
                  </button>
                </span>
              }
            </div>
          }

          <div class="flex justify-end">
            <button
              type="submit"
              [disabled]="isSavingTemplate"
              class="px-4 py-2 bg-[#166534] hover:bg-[#14532d] text-white font-bold rounded disabled:opacity-50"
            >
              {{ isSavingTemplate ? 'Saving...' : 'Save Service Template' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
})
export class GarageSettingsViewComponent implements OnInit, OnChanges {
  private readonly fleetApi = inject(FleetApiService);

  @Input() garageConfig!: GarageConfig;
  @Input() serviceTemplates: ServiceTemplate[] = [];
  @Input() inventory: InventoryItem[] = [];

  form!: GarageConfig;
  savedBanner = false;
  isSavingConfig = false;
  isSavingTemplate = false;

  tplName = '';
  tplDesc = '';
  tplLabour = '1500';
  tplMaterials: ServiceTemplateMaterial[] = [];
  pickItemId = '';
  pickQty = '1';

  ngOnInit(): void {
    this.form = { ...this.garageConfig };
    if (!this.pickItemId && this.inventory.length > 0) {
      this.pickItemId = this.inventory[0].id;
    }
  }

  ngOnChanges(): void {
    if (this.garageConfig) {
      this.form = { ...this.garageConfig };
    }
    if (!this.pickItemId && this.inventory.length > 0) {
      this.pickItemId = this.inventory[0].id;
    }
  }

  async handleSaveConfig(): Promise<void> {
    if (this.isSavingConfig) return;
    this.isSavingConfig = true;
    await this.fleetApi.updateGarageConfig({
      ...this.form,
      taxRatePercent: Number(this.form.taxRatePercent) || 0,
    });
    this.isSavingConfig = false;
    this.savedBanner = true;
    setTimeout(() => {
      this.savedBanner = false;
    }, 2800);
  }

  handleAddTplMaterial(): void {
    const inv = this.inventory.find((i) => i.id === this.pickItemId);
    if (!inv) return;
    this.tplMaterials = [
      ...this.tplMaterials,
      {
        id: `tm-custom-${Date.now()}`,
        inventoryItemId: inv.id,
        partName: inv.partName,
        sku: inv.sku,
        unit: inv.unit,
        defaultQuantity: Math.max(0.1, parseFloat(this.pickQty) || 1),
      },
    ];
  }

  removeTplMaterial(id: string): void {
    this.tplMaterials = this.tplMaterials.filter((x) => x.id !== id);
  }

  async handleCreateTemplate(): Promise<void> {
    if (!this.tplName.trim() || this.isSavingTemplate) return;
    this.isSavingTemplate = true;
    await this.fleetApi.createServiceTemplate({
      name: this.tplName.trim(),
      description: this.tplDesc.trim() || 'Custom garage service package',
      defaultLabourCharge: Math.max(0, parseFloat(this.tplLabour) || 0),
      materials: this.tplMaterials,
    });
    this.isSavingTemplate = false;
    this.tplName = '';
    this.tplDesc = '';
    this.tplLabour = '1500';
    this.tplMaterials = [];
  }
}
