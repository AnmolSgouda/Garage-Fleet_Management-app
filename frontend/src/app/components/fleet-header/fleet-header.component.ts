import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { ActiveNavTab } from '../../models/fleet.models';

@Component({
  selector: 'app-fleet-header',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <header class="no-print bg-[#071322] text-white px-5 py-2.5 flex items-center justify-between border-b border-slate-800 sticky top-0 z-30 select-none">
      <!-- Brand Zone -->
      <div class="flex items-center gap-3 min-w-0">
        <a
          href="#"
          (click)="$event.preventDefault(); selectTab.emit('overview')"
          class="text-xs lg:text-sm font-black tracking-widest uppercase text-white hover:text-cyan-400 transition-colors whitespace-nowrap"
        >
          FLEET SERVICE PLANNING
        </a>
        <span class="hidden xl:inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-300 bg-slate-800/80 border border-slate-700/80 px-2.5 py-0.5 rounded truncate max-w-[260px]">
          <lucide-icon name="warehouse" class="w-3 h-3 text-cyan-400 shrink-0"></lucide-icon>
          <span class="truncate">{{ garageName }}</span>
        </span>
      </div>

      <!-- Navigation Zone -->
      <nav class="flex items-center gap-4 lg:gap-5 text-xs font-semibold overflow-x-auto mx-3">
        @for (item of navItems; track item.id) {
          <button
            type="button"
            (click)="selectTab.emit(item.id)"
            [class]="
              'py-1 transition-colors relative whitespace-nowrap ' +
              (activeTab === item.id
                ? 'text-white border-b-2 border-blue-500'
                : 'text-slate-400 hover:text-slate-200')
            "
          >
            {{ item.label }}
          </button>
        }

        <button
          type="button"
          (click)="selectTab.emit('add_vehicle')"
          [class]="
            'py-1 px-2.5 rounded text-xs font-bold transition-all relative whitespace-nowrap flex items-center gap-1.5 ' +
            (activeTab === 'add_vehicle'
              ? 'bg-blue-600 text-white shadow-2xs'
              : 'text-cyan-400 bg-blue-950/60 border border-blue-700/50 hover:bg-blue-900/60')
          "
        >
          <span>+ Add Vehicle</span>
        </button>
      </nav>

      <!-- Right User & Notifications Zone -->
      <div class="flex items-center gap-3 shrink-0">
        <button
          type="button"
          (click)="selectTab.emit('overview')"
          class="relative text-slate-300 hover:text-white p-1 rounded hover:bg-slate-800 transition-colors"
          aria-label="Notifications"
          title="View Notifications & Low Stock Alerts"
        >
          <lucide-icon name="bell" class="w-4 h-4"></lucide-icon>
          @if (unreadAlertsCount > 0) {
            <span class="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-0.5 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-[#071322]">
              {{ unreadAlertsCount }}
            </span>
          }
        </button>

        <button
          type="button"
          (click)="selectTab.emit('garage_settings')"
          class="flex items-center gap-2 pl-2 border-l border-slate-800 hover:opacity-90 transition-opacity"
          title="Single-Garage Settings & Service Templates"
        >
          <div class="w-7 h-7 rounded-full bg-[#0051a8] text-white flex items-center justify-center font-bold text-xs ring-1 ring-white/20">
            F
          </div>
          <span class="hidden sm:inline-block text-xs font-semibold text-slate-200">
            Garage Admin
          </span>
        </button>
      </div>
    </header>
  `,
})
export class FleetHeaderComponent {
  @Input({ required: true }) activeTab!: ActiveNavTab;
  @Input() unreadAlertsCount = 0;
  @Input() garageName = '';
  @Output() selectTab = new EventEmitter<ActiveNavTab>();

  readonly navItems: { id: ActiveNavTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'calendar', label: 'Calendar' },
    { id: 'service_events', label: 'Service Events' },
    { id: 'inventory', label: 'Inventory' },
    { id: 'invoices', label: 'Invoices' },
    { id: 'vehicles', label: 'Vehicles' },
  ];
}
