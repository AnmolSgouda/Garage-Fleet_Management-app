import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { ActiveNavTab } from '../../models/fleet.models';

@Component({
  selector: 'app-fleet-sidebar',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <aside class="no-print w-14 lg:w-16 bg-white border-r border-slate-200 flex flex-col items-center py-3 justify-between shrink-0 select-none z-20">
      <div class="flex flex-col items-center gap-1.5 w-full">
        <button
          type="button"
          (click)="selectTab.emit('overview')"
          [class]="navBtnClass('overview')"
          title="Overview Dashboard"
          aria-label="Overview Dashboard"
        >
          <lucide-icon name="layout-grid" class="w-5 h-5 stroke-[1.75]"></lucide-icon>
        </button>

        <button
          type="button"
          (click)="selectTab.emit('calendar')"
          [class]="navBtnClass('calendar')"
          title="Service Planning Calendar"
          aria-label="Service Planning Calendar"
        >
          <lucide-icon name="calendar" class="w-5 h-5 stroke-[1.75]"></lucide-icon>
        </button>

        <button
          type="button"
          (click)="selectTab.emit('service_events')"
          [class]="navBtnClass('service_events')"
          title="Service Events & Repair Jobs"
          aria-label="Service Events & Repair Jobs"
        >
          <lucide-icon name="square-check-big" class="w-5 h-5 stroke-[1.75]"></lucide-icon>
        </button>

        <div class="w-8 h-px bg-slate-200 my-1"></div>

        <!-- Inventory with Low-Stock Badge -->
        <div class="relative">
          <button
            type="button"
            (click)="selectTab.emit('inventory')"
            [class]="navBtnClass('inventory')"
            title="Spare Parts & Inventory"
            aria-label="Spare Parts & Inventory"
          >
            <lucide-icon name="package" class="w-5 h-5 stroke-[1.75]"></lucide-icon>
          </button>
          @if (lowStockCount > 0) {
            <span class="absolute -top-1 -right-1 bg-[#e02424] text-white text-[10px] font-bold min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center ring-2 ring-white pointer-events-none">
              {{ lowStockCount }}
            </span>
          }
        </div>

        <button
          type="button"
          (click)="selectTab.emit('stock_movements')"
          [class]="navBtnClass('stock_movements')"
          title="Stock Movements History"
          aria-label="Stock Movements History"
        >
          <lucide-icon name="arrow-left-right" class="w-5 h-5 stroke-[1.75]"></lucide-icon>
        </button>

        <button
          type="button"
          (click)="selectTab.emit('suppliers')"
          [class]="navBtnClass('suppliers')"
          title="Suppliers Directory"
          aria-label="Suppliers Directory"
        >
          <lucide-icon name="building-2" class="w-5 h-5 stroke-[1.75]"></lucide-icon>
        </button>

        <button
          type="button"
          (click)="selectTab.emit('invoices')"
          [class]="navBtnClass('invoices')"
          title="Invoices & Billing History"
          aria-label="Invoices & Billing History"
        >
          <lucide-icon name="receipt" class="w-5 h-5 stroke-[1.75]"></lucide-icon>
        </button>

        <div class="w-8 h-px bg-slate-200 my-1"></div>

        <button
          type="button"
          (click)="selectTab.emit('vehicles')"
          [class]="navBtnClass('vehicles')"
          title="Vehicles Fleet Registry"
          aria-label="Vehicles Fleet Registry"
        >
          <lucide-icon name="truck" class="w-5 h-5 stroke-[1.75]"></lucide-icon>
        </button>

        <button
          type="button"
          (click)="selectTab.emit('add_vehicle')"
          [class]="
            'w-10 h-10 rounded-md flex items-center justify-center transition-all ' +
            (activeTab === 'add_vehicle'
              ? 'bg-[#0051a8] text-white shadow-xs'
              : 'text-slate-500 hover:text-blue-600 hover:bg-blue-50')
          "
          title="Register New Commercial Vehicle"
          aria-label="Register New Commercial Vehicle"
        >
          <lucide-icon name="plus" class="w-5 h-5 stroke-[2]"></lucide-icon>
        </button>
      </div>

      <!-- Bottom Garage Settings Icon -->
      <div class="flex flex-col items-center gap-2">
        <button
          type="button"
          (click)="selectTab.emit('garage_settings')"
          [class]="navBtnClass('garage_settings')"
          title="Single-Garage Settings & Service Templates"
          aria-label="Single-Garage Settings & Service Templates"
        >
          <lucide-icon name="settings" class="w-5 h-5 stroke-[1.75]"></lucide-icon>
        </button>
      </div>
    </aside>
  `,
})
export class FleetSidebarComponent {
  @Input({ required: true }) activeTab!: ActiveNavTab;
  @Input() lowStockCount = 0;
  @Output() selectTab = new EventEmitter<ActiveNavTab>();

  navBtnClass(tab: ActiveNavTab): string {
    return (
      'w-10 h-10 rounded-md flex items-center justify-center transition-all ' +
      (this.activeTab === tab
        ? 'bg-slate-900 text-white shadow-xs'
        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100')
    );
  }
}
