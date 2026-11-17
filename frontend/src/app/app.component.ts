import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { FleetApiService } from './services/fleet-api.service';
import { FleetHeaderComponent } from './components/fleet-header/fleet-header.component';
import { FleetSidebarComponent } from './components/fleet-sidebar/fleet-sidebar.component';
import { NotificationsPanelComponent } from './components/notifications-panel/notifications-panel.component';
import { WorkflowColumnsComponent } from './components/workflow-columns/workflow-columns.component';
import { ServicePlanningCalendarComponent } from './components/service-planning-calendar/service-planning-calendar.component';
import { ServiceEventsViewComponent } from './components/service-events-view/service-events-view.component';
import { VehiclesManagementViewComponent } from './components/vehicles-management-view/vehicles-management-view.component';
import { RegisterVehicleViewComponent } from './components/register-vehicle-view/register-vehicle-view.component';
import { InventoryViewComponent } from './components/inventory-view/inventory-view.component';
import { StockMovementsViewComponent } from './components/stock-movements-view/stock-movements-view.component';
import { SuppliersViewComponent } from './components/suppliers-view/suppliers-view.component';
import { InvoicesViewComponent } from './components/invoices-view/invoices-view.component';
import { GarageSettingsViewComponent } from './components/garage-settings-view/garage-settings-view.component';
import { BookingWizardModalComponent } from './components/booking-wizard-modal/booking-wizard-modal.component';
import { RepairJobConsumptionModalComponent } from './components/repair-job-consumption-modal/repair-job-consumption-modal.component';
import { InvoiceModalComponent } from './components/invoice-modal/invoice-modal.component';
import { VehicleProfileSlideOverComponent } from './components/vehicle-profile-slide-over/vehicle-profile-slide-over.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    LucideAngularModule,
    FleetHeaderComponent,
    FleetSidebarComponent,
    NotificationsPanelComponent,
    WorkflowColumnsComponent,
    ServicePlanningCalendarComponent,
    ServiceEventsViewComponent,
    VehiclesManagementViewComponent,
    RegisterVehicleViewComponent,
    InventoryViewComponent,
    StockMovementsViewComponent,
    SuppliersViewComponent,
    InvoicesViewComponent,
    GarageSettingsViewComponent,
    BookingWizardModalComponent,
    RepairJobConsumptionModalComponent,
    InvoiceModalComponent,
    VehicleProfileSlideOverComponent,
  ],
  template: `
    <div class="min-h-screen bg-[#f7f9fc] flex flex-col font-sans text-slate-900 selection:bg-blue-600 selection:text-white">
      <!-- Top Navy Navigation Bar -->
      <app-fleet-header
        [activeTab]="store.activeNavTab()"
        [unreadAlertsCount]="store.unreadAlertsCount()"
        [garageName]="store.garageConfig().garageName"
        (selectTab)="store.setActiveNavTab($event)"
      ></app-fleet-header>

      <!-- Main Body with Left Rail + Viewport -->
      <div class="flex-1 flex overflow-hidden">
        <app-fleet-sidebar
          [activeTab]="store.activeNavTab()"
          [lowStockCount]="store.alertInventoryItems().length"
          (selectTab)="store.setActiveNavTab($event)"
        ></app-fleet-sidebar>

        <main class="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7 max-w-[1720px] mx-auto w-full">
          <!-- TAB 1: OVERVIEW DASHBOARD -->
          @if (store.activeNavTab() === 'overview') {
            <div class="space-y-5">
              <!-- Notifications & Updates Panel -->
              <app-notifications-panel
                [notifications]="store.notifications()"
                (dismiss)="store.dismissNotification($event)"
                (dismissAll)="store.dismissAllNotifications()"
                (reset)="store.resetNotifications()"
              ></app-notifications-panel>

              <!-- Live Inventory & Garage KPI Strip -->
              <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <button
                  type="button"
                  (click)="store.setActiveNavTab('inventory')"
                  class="bg-white rounded-md border border-slate-200 p-3.5 text-left hover:border-slate-300 shadow-2xs transition-all"
                >
                  <div class="flex items-center justify-between text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                    <span>Total Inventory Items</span>
                    <lucide-icon name="package" class="w-4 h-4 text-[#0051a8]"></lucide-icon>
                  </div>
                  <div class="mt-1.5 flex items-baseline justify-between">
                    <span class="text-xl font-black font-mono tabular-nums text-slate-900">
                      {{ store.totalInventoryItems() }}
                    </span>
                    <span class="text-[11px] text-slate-500">Active SKUs</span>
                  </div>
                </button>

                <button
                  type="button"
                  (click)="store.setActiveNavTab('inventory')"
                  class="bg-white rounded-md border border-slate-200 p-3.5 text-left hover:border-slate-300 shadow-2xs transition-all"
                >
                  <div class="flex items-center justify-between text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                    <span>Total Inventory Value</span>
                    <lucide-icon name="indian-rupee" class="w-4 h-4 text-emerald-600"></lucide-icon>
                  </div>
                  <div class="mt-1.5 flex items-baseline justify-between">
                    <span class="text-xl font-black font-mono tabular-nums text-slate-900">
                      {{ store.garageConfig().currencySymbol }}{{ store.totalInventoryValue().toLocaleString('en-IN') }}
                    </span>
                    <span class="text-[11px] text-slate-500">At cost value</span>
                  </div>
                </button>

                <button
                  type="button"
                  (click)="store.setActiveNavTab('inventory')"
                  class="bg-white rounded-md border border-slate-200 p-3.5 text-left hover:border-amber-300 shadow-2xs transition-all"
                >
                  <div class="flex items-center justify-between text-amber-700 text-[11px] font-bold uppercase tracking-wider">
                    <span>Low Stock Items</span>
                    <lucide-icon name="triangle-alert" class="w-4 h-4 text-amber-600"></lucide-icon>
                  </div>
                  <div class="mt-1.5 flex items-baseline justify-between">
                    <span class="text-xl font-black font-mono tabular-nums text-amber-700">
                      {{ store.lowStockItems().length }}
                    </span>
                    <span class="text-[11px] text-amber-700 font-medium">
                      Below min threshold
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  (click)="store.setActiveNavTab('inventory')"
                  class="bg-white rounded-md border border-slate-200 p-3.5 text-left hover:border-rose-300 shadow-2xs transition-all"
                >
                  <div class="flex items-center justify-between text-rose-700 text-[11px] font-bold uppercase tracking-wider">
                    <span>Out of Stock Items</span>
                    <lucide-icon name="circle-x" class="w-4 h-4 text-rose-600"></lucide-icon>
                  </div>
                  <div class="mt-1.5 flex items-baseline justify-between">
                    <span class="text-xl font-black font-mono tabular-nums text-rose-700">
                      {{ store.outOfStockItems().length }}
                    </span>
                    <span class="text-[11px] text-rose-700 font-medium">
                      Immediate reorder
                    </span>
                  </div>
                </button>
              </div>

              <!-- Action Toolbar Header -->
              <div class="flex flex-wrap items-center justify-between gap-4 pb-1">
                <div>
                  <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                    Overview
                  </h1>
                </div>

                <div class="flex flex-wrap items-center gap-2.5">
                  <div class="relative">
                    <select
                      [ngModel]="store.equipmentGroupFilter()"
                      (ngModelChange)="store.equipmentGroupFilter.set($event)"
                      aria-label="Filter equipment groups"
                      class="appearance-none bg-white border border-slate-200 hover:border-slate-300 text-slate-700 text-xs font-semibold py-2 pl-3 pr-8 rounded shadow-2xs focus:outline-hidden focus:ring-1 focus:ring-blue-500 cursor-pointer"
                    >
                      <option value="All equipment groups">All equipment groups</option>
                      <option value="SMA-AI-MODULES">SMA-AI-MODULES</option>
                      <option value="Intermodal Freight">Intermodal Freight</option>
                      <option value="Heavy Haulage">Heavy Haulage</option>
                      <option value="Urban Distribution">Urban Distribution</option>
                      <option value="Ready-Mix Infrastructure">Ready-Mix Infrastructure</option>
                      <option value="Hazardous & Bulk Liquid">Hazardous &amp; Bulk Liquid</option>
                    </select>
                    <lucide-icon
                      name="chevron-down"
                      class="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                    ></lucide-icon>
                  </div>

                  <div class="relative">
                    <input
                      type="text"
                      placeholder="Search registration, model, ty..."
                      [ngModel]="store.searchQuery()"
                      (ngModelChange)="store.searchQuery.set($event)"
                      class="bg-white border border-slate-200 hover:border-slate-300 text-slate-800 placeholder-slate-400 text-xs py-2 pl-3 pr-8 rounded shadow-2xs focus:outline-hidden focus:ring-1 focus:ring-blue-500 w-48 sm:w-60"
                    />
                    <lucide-icon
                      name="search"
                      class="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                    ></lucide-icon>
                  </div>

                  <button
                    type="button"
                    (click)="store.openWizard()"
                    class="flex items-center gap-1.5 bg-[#002f6c] hover:bg-[#00224f] text-white text-xs font-bold px-4 py-2 rounded shadow-2xs transition-colors whitespace-nowrap"
                  >
                    <span>Book a service</span>
                    <lucide-icon name="wrench" class="w-3.5 h-3.5 text-cyan-300"></lucide-icon>
                  </button>
                </div>
              </div>

              <!-- Four Dynamic Workflow Columns -->
              <app-workflow-columns
                [bookings]="store.bookings()"
                (selectVehicle)="store.selectedVehicleId.set($event)"
                (approvePreliminary)="store.approvePreliminaryBooking($event)"
                (rejectPreliminary)="store.rejectPreliminaryBooking($event)"
                (startConfirmed)="store.startConfirmedBooking($event)"
                (completeInProgress)="store.completeInProgressBooking($event)"
                (openBookingWizard)="store.openWizard($event)"
                (openJobMaterials)="store.materialsModalBookingId.set($event)"
                (openInvoicePreview)="store.openInvoiceForBooking($event)"
              ></app-workflow-columns>

              <!-- Low Stock Alerts + Recent Stock Movements Row -->
              <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <!-- Low Stock Alerts Widget -->
                <div class="bg-white rounded-md border border-slate-200 overflow-hidden shadow-2xs">
                  <div class="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <lucide-icon name="triangle-alert" class="w-4 h-4 text-amber-600"></lucide-icon>
                      <h2 class="text-xs font-bold uppercase tracking-wider text-slate-800">
                        Low Stock &amp; Reorder Alerts ({{ store.alertInventoryItems().length }})
                      </h2>
                    </div>
                    <button
                      type="button"
                      (click)="store.setActiveNavTab('inventory')"
                      class="text-xs font-semibold text-blue-600 hover:text-blue-800"
                    >
                      Open Inventory
                    </button>
                  </div>

                  <div class="overflow-x-auto">
                    <table class="w-full text-left text-xs">
                      <thead class="bg-slate-50/60 border-b border-slate-100 text-[10px] font-bold uppercase text-slate-500">
                        <tr>
                          <th class="py-2 px-3">Item Name</th>
                          <th class="py-2 px-2 text-right">Available</th>
                          <th class="py-2 px-2 text-right">Min</th>
                          <th class="py-2 px-2">Supplier</th>
                          <th class="py-2 px-3 text-right">Quick Actions</th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-slate-100">
                        @if (store.alertInventoryItems().length === 0) {
                          <tr>
                            <td colspan="5" class="py-6 text-center text-slate-400">
                              All active spare parts are sufficiently stocked.
                            </td>
                          </tr>
                        } @else {
                          @for (item of store.alertInventoryItems(); track item.id) {
                            <tr class="hover:bg-slate-50/70">
                              <td class="py-2.5 px-3">
                                <div class="font-bold text-slate-900">{{ item.partName }}</div>
                                <span
                                  [class]="
                                    'inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold ' +
                                    (item.quantityOnHand <= 0
                                      ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                      : 'bg-amber-50 text-amber-800 border border-amber-200')
                                  "
                                >
                                  {{ item.quantityOnHand <= 0 ? 'Out of Stock' : 'Low Stock' }}
                                </span>
                              </td>
                              <td class="py-2.5 px-2 text-right font-mono font-bold text-rose-700">
                                {{ item.quantityOnHand }} {{ item.unit }}
                              </td>
                              <td class="py-2.5 px-2 text-right font-mono text-slate-600">
                                {{ item.minimumStock }}
                              </td>
                              <td class="py-2.5 px-2 text-slate-700">{{ item.supplierName }}</td>
                              <td class="py-2.5 px-3 text-right whitespace-nowrap">
                                <div class="inline-flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    (click)="openInventoryItem(item.id)"
                                    class="px-2 py-1 text-[10px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded inline-flex items-center gap-0.5"
                                    title="View Item"
                                  >
                                    <lucide-icon name="eye" class="w-3 h-3"></lucide-icon>
                                    <span>Item</span>
                                  </button>
                                  <button
                                    type="button"
                                    (click)="store.setActiveNavTab('suppliers')"
                                    class="px-2 py-1 text-[10px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded inline-flex items-center gap-0.5"
                                    title="View Supplier"
                                  >
                                    <lucide-icon name="building-2" class="w-3 h-3"></lucide-icon>
                                    <span>Supplier</span>
                                  </button>
                                  <button
                                    type="button"
                                    (click)="store.contactSupplierId.set(item.supplierId)"
                                    class="px-2 py-1 text-[10px] font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded inline-flex items-center gap-0.5"
                                    title="Contact Supplier"
                                  >
                                    <lucide-icon name="phone" class="w-3 h-3"></lucide-icon>
                                    <span>Contact</span>
                                  </button>
                                  <button
                                    type="button"
                                    (click)="openRestockItem(item.id)"
                                    class="px-2 py-1 text-[10px] font-bold bg-[#0051a8] hover:bg-[#003d80] text-white rounded inline-flex items-center gap-0.5"
                                    title="Update Stock"
                                  >
                                    <lucide-icon name="sliders-horizontal" class="w-3 h-3"></lucide-icon>
                                    <span>Restock</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          }
                        }
                      </tbody>
                    </table>
                  </div>
                </div>

                <!-- Recent Stock Movements Widget -->
                <div class="bg-white rounded-md border border-slate-200 overflow-hidden shadow-2xs">
                  <div class="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <lucide-icon name="arrow-left-right" class="w-4 h-4 text-[#0051a8]"></lucide-icon>
                      <h2 class="text-xs font-bold uppercase tracking-wider text-slate-800">
                        Recent Stock Movements
                      </h2>
                    </div>
                    <button
                      type="button"
                      (click)="store.setActiveNavTab('stock_movements')"
                      class="text-xs font-semibold text-blue-600 hover:text-blue-800"
                    >
                      View Full Ledger
                    </button>
                  </div>

                  <div class="divide-y divide-slate-100">
                    @for (m of store.stockMovements().slice(0, 5); track m.id) {
                      <div class="px-4 py-2.5 flex items-center justify-between text-xs">
                        <div class="min-w-0">
                          <div class="flex items-center gap-2">
                            <span class="font-mono font-bold text-slate-700">
                              {{ m.transactionCode }}
                            </span>
                            <span class="font-semibold text-slate-900 truncate">
                              {{ m.partName }}
                            </span>
                          </div>
                          <p class="text-[11px] text-slate-500 truncate mt-0.5">
                            {{ m.transactionType.replaceAll('_', ' ') }} · {{ m.remarks }}
                          </p>
                        </div>
                        <div class="text-right font-mono shrink-0 ml-3">
                          <div
                            [class]="
                              'font-bold ' +
                              (m.quantityDelta >= 0 ? 'text-emerald-700' : 'text-rose-700')
                            "
                          >
                            {{ m.quantityDelta > 0 ? '+' + m.quantityDelta : m.quantityDelta }} {{ m.unit }}
                          </div>
                          <div class="text-[10px] text-slate-400">
                            Bal: {{ m.updatedQuantity }}
                          </div>
                        </div>
                      </div>
                    }
                  </div>
                </div>
              </div>
            </div>
          }

          <!-- TAB 2: SERVICE PLANNING CALENDAR -->
          @if (store.activeNavTab() === 'calendar') {
            <app-service-planning-calendar
              [bookings]="store.allBookingsRaw()"
              [vehicles]="store.vehicles()"
              [calendarViewMode]="store.calendarViewMode()"
              [calendarDate]="store.calendarDate()"
              [statusFilters]="store.calendarFilterStatuses()"
              [equipmentGroup]="store.equipmentGroupFilter()"
              (setCalendarViewMode)="store.calendarViewMode.set($event)"
              (setCalendarDate)="store.calendarDate.set($event)"
              (toggleStatusFilter)="store.toggleCalendarStatus($event)"
              (setEquipmentGroup)="store.equipmentGroupFilter.set($event)"
              (selectVehicle)="store.selectedVehicleId.set($event)"
              (openBookingWizard)="
                store.openWizard(
                  $event.preselectedVehicleId,
                  $event.prefillDate,
                  $event.prefillStartTime
                )
              "
              (openJobMaterials)="store.materialsModalBookingId.set($event)"
            ></app-service-planning-calendar>
          }

          <!-- TAB 3: SERVICE EVENTS / WORK ORDERS -->
          @if (store.activeNavTab() === 'service_events') {
            <app-service-events-view
              [bookings]="store.allBookingsRaw()"
              (selectVehicle)="store.selectedVehicleId.set($event)"
              (openBookingWizard)="store.openWizard($event)"
              (approvePreliminary)="store.approvePreliminaryBooking($event)"
              (startConfirmed)="store.startConfirmedBooking($event)"
              (completeInProgress)="store.completeInProgressBooking($event)"
              (openJobMaterials)="store.materialsModalBookingId.set($event)"
              (openInvoicePreview)="store.openInvoiceForBooking($event)"
            ></app-service-events-view>
          }

          <!-- TAB 4: INVENTORY MANAGEMENT -->
          @if (store.activeNavTab() === 'inventory') {
            <app-inventory-view
              [inventory]="store.inventory()"
              [suppliers]="store.suppliers()"
              [stockMovements]="store.stockMovements()"
              [garageConfig]="store.garageConfig()"
              [initialFocusItemId]="store.inventoryFocusItemId()"
              [initialOpenAdjustForItemId]="store.inventoryAdjustItemId()"
              (clearInitialFocus)="clearInventoryDeepLinks()"
              (navigateStockMovements)="store.setActiveNavTab('stock_movements')"
              (navigateSuppliers)="store.setActiveNavTab('suppliers')"
            ></app-inventory-view>
          }

          <!-- TAB 5: STOCK MOVEMENTS HISTORY -->
          @if (store.activeNavTab() === 'stock_movements') {
            <app-stock-movements-view
              [stockMovements]="store.stockMovements()"
              [garageConfig]="store.garageConfig()"
            ></app-stock-movements-view>
          }

          <!-- TAB 6: SUPPLIERS DIRECTORY -->
          @if (store.activeNavTab() === 'suppliers') {
            <app-suppliers-view
              [suppliers]="store.suppliers()"
              [inventory]="store.inventory()"
              [stockMovements]="store.stockMovements()"
              [garageConfig]="store.garageConfig()"
            ></app-suppliers-view>
          }

          <!-- TAB 7: INVOICES HISTORY -->
          @if (store.activeNavTab() === 'invoices') {
            <app-invoices-view
              [invoices]="store.invoices()"
              [garageConfig]="store.garageConfig()"
              (inspectInvoice)="inspectInvoice($event)"
            ></app-invoices-view>
          }

          <!-- TAB 8: VEHICLES FLEET REGISTRY -->
          @if (store.activeNavTab() === 'vehicles') {
            <app-vehicles-management-view
              [vehicles]="store.vehicles()"
              (selectVehicle)="store.selectedVehicleId.set($event)"
              (openBookingWizard)="store.openWizard($event)"
              (navigateAddVehicle)="store.setActiveNavTab('add_vehicle')"
            ></app-vehicles-management-view>
          }

          <!-- TAB 9: REGISTER NEW COMMERCIAL VEHICLE -->
          @if (store.activeNavTab() === 'add_vehicle') {
            <div class="py-2">
              <app-register-vehicle-view
                [garageName]="store.garageConfig().garageName"
                (cancel)="store.setActiveNavTab('vehicles')"
                (successNavigate)="onVehicleRegistered($event)"
              ></app-register-vehicle-view>
            </div>
          }

          <!-- TAB 10: SINGLE-GARAGE SETTINGS & SERVICE TEMPLATES -->
          @if (store.activeNavTab() === 'garage_settings') {
            <app-garage-settings-view
              [garageConfig]="store.garageConfig()"
              [serviceTemplates]="store.serviceTemplates()"
              [inventory]="store.inventory()"
            ></app-garage-settings-view>
          }
        </main>
      </div>

      <!-- Vehicle Profile Slide-Over -->
      <app-vehicle-profile-slide-over
        [vehicle]="store.selectedVehicle()"
        [bookings]="store.allBookingsRaw()"
        [garageConfig]="store.garageConfig()"
        (close)="store.selectedVehicleId.set(null)"
        (addUnplannedActivity)="store.addUnplannedActivity($event.vehicleId, $event.name)"
        (addUnplannedRepair)="
          store.addUnplannedRepair($event.vehicleId, $event.issue, $event.severity)
        "
        (openBookingWizard)="store.openWizard($event)"
        (openJobMaterials)="store.materialsModalBookingId.set($event)"
        (openInvoicePreview)="store.openInvoiceForBooking($event)"
      ></app-vehicle-profile-slide-over>

      <!-- 6-Step Service Booking Wizard Modal -->
      <app-booking-wizard-modal
        [isOpen]="store.isBookingWizardOpen()"
        [vehicles]="store.vehicles()"
        [garageConfig]="store.garageConfig()"
        [serviceTemplates]="store.serviceTemplates()"
        [inventory]="store.inventory()"
        [suppliers]="store.suppliers()"
        [preselectedVehicleId]="store.wizardPreselectedVehicleId()"
        [prefillDate]="store.wizardPrefillDate()"
        [prefillStartTime]="store.wizardPrefillStartTime()"
        (close)="store.closeWizard()"
      ></app-booking-wizard-modal>

      <!-- Mechanic Service Material Consumption Modal -->
      <app-repair-job-consumption-modal
        [isOpen]="!!store.materialsModalBookingId()"
        [booking]="store.activeMaterialsBooking()"
        [vehicle]="store.activeMaterialsVehicle()"
        [inventory]="store.inventory()"
        [garageConfig]="store.garageConfig()"
        (close)="store.materialsModalBookingId.set(null)"
        (openInvoicePreview)="store.openInvoiceForBooking($event)"
      ></app-repair-job-consumption-modal>

      <!-- Invoice Preview / Generation / Print / PDF Modal -->
      <app-invoice-modal
        [isOpen]="!!(store.invoiceModalBookingId() || store.invoiceModalRecord())"
        [existingInvoice]="store.invoiceModalRecord()"
        [booking]="store.activeInvoiceBooking()"
        [vehicle]="store.activeInvoiceVehicle()"
        [garageConfig]="store.garageConfig()"
        (close)="store.closeInvoiceModal()"
      ></app-invoice-modal>

      <!-- Quick Supplier Contact Modal from Overview Low Stock Alert -->
      @if (store.contactSupplier(); as sup) {
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div class="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden text-xs">
            <div class="bg-[#071322] text-white px-5 py-3.5 flex items-center justify-between">
              <h3 class="text-sm font-bold flex items-center gap-2">
                <lucide-icon name="building-2" class="w-4 h-4 text-cyan-400"></lucide-icon>
                <span>Supplier Contact Card</span>
              </h3>
              <button
                type="button"
                (click)="store.contactSupplierId.set(null)"
                class="text-slate-400 hover:text-white"
              >
                <lucide-icon name="x" class="w-5 h-5"></lucide-icon>
              </button>
            </div>
            <div class="p-5 space-y-2.5">
              <p class="text-base font-bold text-slate-900">{{ sup.name }}</p>
              <p class="text-slate-600">
                Contact Person: <span class="font-semibold text-slate-900">{{ sup.contactPerson }}</span>
              </p>
              <p class="text-slate-600">
                Mobile: <span class="font-mono font-bold text-blue-700">{{ sup.mobile }}</span>
              </p>
              <p class="text-slate-600">
                Email: <span class="font-semibold text-slate-900">{{ sup.email }}</span>
              </p>
              <p class="text-slate-600">Address: {{ sup.address }}</p>
            </div>
            <div class="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                (click)="openSuppliersFromContact()"
                class="px-4 py-1.5 bg-[#0051a8] text-white font-bold rounded"
              >
                Open Suppliers Directory
              </button>
              <button
                type="button"
                (click)="store.contactSupplierId.set(null)"
                class="px-4 py-1.5 border border-slate-300 rounded bg-white text-slate-700"
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
export class AppComponent {
  readonly store = inject(FleetApiService);

  openInventoryItem(itemId: string): void {
    this.store.inventoryFocusItemId.set(itemId);
    this.store.setActiveNavTab('inventory');
  }

  openRestockItem(itemId: string): void {
    this.store.inventoryAdjustItemId.set(itemId);
    this.store.setActiveNavTab('inventory');
  }

  clearInventoryDeepLinks(): void {
    this.store.inventoryFocusItemId.set(null);
    this.store.inventoryAdjustItemId.set(null);
  }

  inspectInvoice(inv: import('./models/fleet.models').Invoice): void {
    this.store.invoiceModalBookingId.set(null);
    this.store.invoiceModalRecord.set(inv);
  }

  onVehicleRegistered(vehId: string): void {
    this.store.selectedVehicleId.set(vehId);
    this.store.setActiveNavTab('overview');
  }

  openSuppliersFromContact(): void {
    this.store.contactSupplierId.set(null);
    this.store.setActiveNavTab('suppliers');
  }
}
