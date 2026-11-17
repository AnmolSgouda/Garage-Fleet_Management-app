import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ActiveNavTab,
  CalendarStatus,
  FleetBootstrapState,
  FleetNotification,
  GarageConfig,
  InventoryItem,
  Invoice,
  InvoicePaymentMethod,
  InvoicePaymentStatus,
  JobActualMaterialLine,
  JobAdditionalMaterialLine,
  JobEstimatedMaterialLine,
  ServiceBooking,
  ServiceTemplate,
  StockMovement,
  StockMovementType,
  Supplier,
  Vehicle,
  VehicleCategory,
  roundMoney,
  roundQty,
} from '../models/fleet.models';

@Injectable({ providedIn: 'root' })
export class FleetApiService {
  private readonly http = inject(HttpClient);
  private readonly apiBase = environment.apiBaseUrl;

  // Core data signals populated from Express REST API
  readonly isLoading = signal<boolean>(true);
  readonly garageConfig = signal<GarageConfig>({
    garageName: 'Pitstop Commercial Garage & Fleet Service',
    tagline: 'Single-Bay Heavy Fleet Maintenance, Diagnostics & Spare Parts',
    address: 'Plot 42, Industrial Logistics Park, Phase II, Bengaluru 560099',
    phone: '+91 80 4128 7700',
    email: 'service@pitstopfleetgarage.in',
    gstNumber: '29AABCP4521K1Z5',
    taxEnabled: true,
    taxRatePercent: 18,
    currencySymbol: '₹',
    invoicePrefix: 'INV',
    nextInvoiceSequence: 1001,
  });
  readonly vehicles = signal<Vehicle[]>([]);
  readonly allBookingsRaw = signal<ServiceBooking[]>([]);
  readonly notifications = signal<FleetNotification[]>([]);
  readonly suppliers = signal<Supplier[]>([]);
  readonly inventory = signal<InventoryItem[]>([]);
  readonly serviceTemplates = signal<ServiceTemplate[]>([]);
  readonly invoices = signal<Invoice[]>([]);
  readonly stockMovements = signal<StockMovement[]>([]);

  // UI navigation & filter signals
  readonly activeNavTab = signal<ActiveNavTab>('overview');
  readonly selectedVehicleId = signal<string | null>(null);
  readonly isBookingWizardOpen = signal<boolean>(false);
  readonly wizardPreselectedVehicleId = signal<string | undefined>(undefined);
  readonly wizardPrefillDate = signal<string | undefined>(undefined);
  readonly wizardPrefillStartTime = signal<string | undefined>(undefined);

  readonly materialsModalBookingId = signal<string | null>(null);
  readonly invoiceModalBookingId = signal<string | null>(null);
  readonly invoiceModalRecord = signal<Invoice | null>(null);

  readonly inventoryFocusItemId = signal<string | null>(null);
  readonly inventoryAdjustItemId = signal<string | null>(null);
  readonly contactSupplierId = signal<string | null>(null);

  readonly searchQuery = signal<string>('');
  readonly equipmentGroupFilter = signal<string>('All equipment groups');
  readonly calendarFilterStatuses = signal<Record<CalendarStatus, boolean>>({
    delayed: true,
    due: true,
    preliminary: true,
    performed: true,
    confirmed: true,
    planned: true,
  });
  readonly calendarViewMode = signal<'week' | 'month'>('week');
  readonly calendarDate = signal<Date>(new Date('2023-09-26T12:00:00'));

  // Computed signals
  readonly selectedVehicle = computed(
    () => this.vehicles().find((v) => v.id === this.selectedVehicleId()) || null
  );

  readonly bookings = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const grp = this.equipmentGroupFilter();
    return this.allBookingsRaw().filter((b) => {
      const matchesSearch =
        q === '' ||
        b.vehicleReg.toLowerCase().includes(q) ||
        b.vehicleModel.toLowerCase().includes(q) ||
        b.vehicleCategory.toLowerCase().includes(q) ||
        b.serviceActivities.toLowerCase().includes(q) ||
        (b.serviceType || '').toLowerCase().includes(q) ||
        b.equipmentGroup.toLowerCase().includes(q);
      const matchesGroup = grp === 'All equipment groups' || b.equipmentGroup === grp;
      return matchesSearch && matchesGroup;
    });
  });

  readonly activeInventory = computed(() => this.inventory().filter((i) => i.isActive));
  readonly totalInventoryItems = computed(() => this.activeInventory().length);
  readonly totalInventoryValue = computed(() =>
    roundMoney(
      this.activeInventory().reduce((sum, i) => sum + i.quantityOnHand * i.purchaseCost, 0)
    )
  );
  readonly lowStockItems = computed(() =>
    this.activeInventory().filter((i) => i.quantityOnHand > 0 && i.quantityOnHand < i.minimumStock)
  );
  readonly outOfStockItems = computed(() =>
    this.activeInventory().filter((i) => i.quantityOnHand <= 0)
  );
  readonly alertInventoryItems = computed(() =>
    this.activeInventory().filter((i) => i.quantityOnHand < i.minimumStock)
  );

  readonly unreadAlertsCount = computed(
    () => this.notifications().filter((n) => !n.dismissed).length
  );

  readonly activeMaterialsBooking = computed(
    () => this.allBookingsRaw().find((b) => b.id === this.materialsModalBookingId()) || null
  );
  readonly activeMaterialsVehicle = computed(() => {
    const bk = this.activeMaterialsBooking();
    return bk ? this.vehicles().find((v) => v.id === bk.vehicleId) || null : null;
  });

  readonly activeInvoiceBooking = computed(
    () => this.allBookingsRaw().find((b) => b.id === this.invoiceModalBookingId()) || null
  );
  readonly activeInvoiceVehicle = computed(() => {
    const bk = this.activeInvoiceBooking();
    return bk ? this.vehicles().find((v) => v.id === bk.vehicleId) || null : null;
  });

  readonly contactSupplier = computed(
    () => this.suppliers().find((s) => s.id === this.contactSupplierId()) || null
  );

  constructor() {
    void this.loadBootstrap();
  }

  private extractError(err: unknown, fallback: string): string {
    if (err instanceof HttpErrorResponse && err.error?.error) {
      return String(err.error.error);
    }
    if (err instanceof Error && err.message) return err.message;
    return fallback;
  }

  async loadBootstrap(): Promise<void> {
    try {
      const state = await firstValueFrom(
        this.http.get<FleetBootstrapState>(`${this.apiBase}/bootstrap`)
      );
      this.applyBootstrapState(state);
    } catch (err) {
      console.error('Failed to load fleet bootstrap:', err);
    } finally {
      this.isLoading.set(false);
    }
  }

  private applyBootstrapState(state: FleetBootstrapState): void {
    this.garageConfig.set(state.garageConfig);
    this.vehicles.set(state.vehicles);
    this.allBookingsRaw.set(state.bookings);
    this.notifications.set(state.notifications);
    this.suppliers.set(state.suppliers);
    this.inventory.set(state.inventory);
    this.serviceTemplates.set(state.serviceTemplates);
    this.invoices.set(state.invoices);
    this.stockMovements.set(state.stockMovements);
  }

  // ==========================================================
  // UI STATE ACTIONS
  // ==========================================================
  setActiveNavTab(tab: ActiveNavTab): void {
    this.activeNavTab.set(tab);
  }

  openWizard(vehId?: string, prefillDate?: string, prefillStartTime?: string): void {
    this.wizardPreselectedVehicleId.set(vehId);
    this.wizardPrefillDate.set(prefillDate);
    this.wizardPrefillStartTime.set(prefillStartTime);
    this.isBookingWizardOpen.set(true);
  }

  closeWizard(): void {
    this.isBookingWizardOpen.set(false);
  }

  toggleCalendarStatus(status: CalendarStatus): void {
    this.calendarFilterStatuses.update((prev) => ({
      ...prev,
      [status]: !prev[status],
    }));
  }

  openInvoiceForBooking(bookingId: string): void {
    const existing = this.invoices().find(
      (i) => i.repairJobId === bookingId && i.status === 'active'
    );
    if (existing) {
      this.invoiceModalRecord.set(existing);
      this.invoiceModalBookingId.set(null);
    } else {
      this.invoiceModalRecord.set(null);
      this.invoiceModalBookingId.set(bookingId);
    }
    this.materialsModalBookingId.set(null);
  }

  closeInvoiceModal(): void {
    this.invoiceModalBookingId.set(null);
    this.invoiceModalRecord.set(null);
  }

  // ==========================================================
  // TEMPLATE ESTIMATE BUILDER
  // ==========================================================
  buildEstimateFromTemplate(serviceTypeName: string): {
    estimatedMaterials: JobEstimatedMaterialLine[];
    actualMaterials: JobActualMaterialLine[];
    defaultLabour: number;
  } {
    const tpl = this.serviceTemplates().find((t) => t.name === serviceTypeName);
    if (!tpl) {
      return { estimatedMaterials: [], actualMaterials: [], defaultLabour: 1200 };
    }
    const invList = this.inventory();
    const estimatedMaterials: JobEstimatedMaterialLine[] = tpl.materials.map((m, idx) => {
      const invItem = invList.find((i) => i.id === m.inventoryItemId);
      return {
        id: `est-${Date.now()}-${idx}`,
        inventoryItemId: m.inventoryItemId,
        partName: invItem?.partName || m.partName,
        sku: invItem?.sku || m.sku,
        unit: invItem?.unit || m.unit,
        estimatedQuantity: roundQty(m.defaultQuantity),
        unitPrice: invItem?.sellingPrice || 0,
      };
    });
    const actualMaterials: JobActualMaterialLine[] = estimatedMaterials.map((em, idx) => ({
      id: `act-${Date.now()}-${idx}`,
      inventoryItemId: em.inventoryItemId,
      partName: em.partName,
      sku: em.sku,
      unit: em.unit,
      estimatedQuantity: em.estimatedQuantity,
      actualQuantity: em.estimatedQuantity,
      unitPrice: em.unitPrice,
    }));
    return {
      estimatedMaterials,
      actualMaterials,
      defaultLabour: tpl.defaultLabourCharge,
    };
  }

  // ==========================================================
  // API MUTATIONS
  // ==========================================================
  async updateGarageConfig(updates: Partial<GarageConfig>): Promise<void> {
    const res = await firstValueFrom(
      this.http.put<{ success: boolean; garageConfig: GarageConfig }>(
        `${this.apiBase}/garage-config`,
        updates
      )
    );
    if (res.garageConfig) {
      this.garageConfig.set(res.garageConfig);
    }
  }

  async createServiceTemplate(
    tpl: Omit<ServiceTemplate, 'id' | 'isCustom'>
  ): Promise<ServiceTemplate> {
    const res = await firstValueFrom(
      this.http.post<{ success: boolean; template: ServiceTemplate }>(
        `${this.apiBase}/service-templates`,
        tpl
      )
    );
    this.serviceTemplates.update((prev) => [...prev, res.template]);
    return res.template;
  }

  async addSupplier(
    data: Omit<Supplier, 'id' | 'createdAt' | 'isActive'>
  ): Promise<Supplier> {
    const res = await firstValueFrom(
      this.http.post<{ success: boolean; supplier: Supplier }>(
        `${this.apiBase}/suppliers`,
        data
      )
    );
    this.suppliers.update((prev) => [res.supplier, ...prev]);
    return res.supplier;
  }

  async updateSupplier(id: string, updates: Partial<Supplier>): Promise<void> {
    await firstValueFrom(this.http.put(`${this.apiBase}/suppliers/${id}`, updates));
    await this.loadBootstrap();
  }

  async addInventoryItem(data: {
    partName: string;
    sku: string;
    category: string;
    description: string;
    unit: string;
    initialQuantity: number;
    minimumStock: number;
    purchaseCost: number;
    sellingPrice: number;
    storageLocation: string;
    supplierName: string;
    supplierContactPerson?: string;
    supplierMobile: string;
    supplierEmail: string;
    supplierAddress: string;
  }): Promise<{ success: boolean; error?: string; item?: InventoryItem }> {
    try {
      const res = await firstValueFrom(
        this.http.post<{ success: boolean; error?: string; item?: InventoryItem }>(
          `${this.apiBase}/inventory`,
          data
        )
      );
      await this.loadBootstrap();
      return res;
    } catch (err) {
      return { success: false, error: this.extractError(err, 'Could not add inventory item.') };
    }
  }

  async updateInventoryItem(
    id: string,
    updates: Record<string, unknown>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await firstValueFrom(
        this.http.put<{ success: boolean; error?: string }>(
          `${this.apiBase}/inventory/${id}`,
          updates
        )
      );
      await this.loadBootstrap();
      return res;
    } catch (err) {
      return { success: false, error: this.extractError(err, 'Failed to update item.') };
    }
  }

  async toggleInventoryItemActive(id: string): Promise<void> {
    await firstValueFrom(this.http.patch(`${this.apiBase}/inventory/${id}/toggle-active`, {}));
    await this.loadBootstrap();
  }

  async adjustInventoryStock(params: {
    inventoryItemId: string;
    transactionType: Extract<
      StockMovementType,
      'stock_in' | 'manual_adjustment' | 'purchase_return'
    >;
    mode: 'delta' | 'set';
    value: number;
    remarks: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await firstValueFrom(
        this.http.post<{ success: boolean; error?: string }>(
          `${this.apiBase}/inventory/${params.inventoryItemId}/adjust`,
          params
        )
      );
      await this.loadBootstrap();
      return res;
    } catch (err) {
      return { success: false, error: this.extractError(err, 'Stock adjustment failed.') };
    }
  }

  async registerVehicle(data: {
    registrationNumber: string;
    category: VehicleCategory;
    manufacturer: string;
    model: string;
    manufacturingYear: number;
    odometer: number;
    engineRunningHours: number;
    equipmentGroup: string;
    maintenancePlan: string;
    nextServiceDate: string;
    customerName?: string;
    customerPhone?: string;
    customerEmail?: string;
    notes?: string;
  }): Promise<{ success: boolean; error?: string; vehicleId?: string }> {
    try {
      const res = await firstValueFrom(
        this.http.post<{ success: boolean; error?: string; vehicleId?: string }>(
          `${this.apiBase}/vehicles`,
          data
        )
      );
      await this.loadBootstrap();
      return res;
    } catch (err) {
      return { success: false, error: this.extractError(err, 'Failed to register vehicle.') };
    }
  }

  async addUnplannedActivity(vehicleId: string, name: string): Promise<void> {
    await firstValueFrom(
      this.http.post(`${this.apiBase}/vehicles/${vehicleId}/activities`, { name })
    );
    await this.loadBootstrap();
  }

  async addUnplannedRepair(
    vehicleId: string,
    issue: string,
    severity: 'major' | 'minor' | 'critical'
  ): Promise<void> {
    await firstValueFrom(
      this.http.post(`${this.apiBase}/vehicles/${vehicleId}/repairs`, { issue, severity })
    );
    await this.loadBootstrap();
  }

  async createBooking(
    data: Omit<
      ServiceBooking,
      | 'id'
      | 'bookingRef'
      | 'actualMaterials'
      | 'additionalMaterials'
      | 'additionalServiceCharges'
      | 'discountAmount'
    > & {
      estimatedMaterials?: JobEstimatedMaterialLine[];
      labourCharges?: number;
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await firstValueFrom(
        this.http.post<{ success: boolean; error?: string }>(`${this.apiBase}/bookings`, data)
      );
      await this.loadBootstrap();
      if (res.success) {
        this.activeNavTab.set('overview');
      }
      return res;
    } catch (err) {
      return { success: false, error: this.extractError(err, 'Booking conflict detected.') };
    }
  }

  async updateBooking(updatedBooking: ServiceBooking): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await firstValueFrom(
        this.http.put<{ success: boolean; error?: string }>(
          `${this.apiBase}/bookings/${updatedBooking.id}`,
          updatedBooking
        )
      );
      await this.loadBootstrap();
      return res;
    } catch (err) {
      return { success: false, error: this.extractError(err, 'Conflict detected.') };
    }
  }

  async cancelBooking(bookingId: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.apiBase}/bookings/${bookingId}`));
    await this.loadBootstrap();
  }

  async approvePreliminaryBooking(bookingId: string): Promise<void> {
    await firstValueFrom(this.http.post(`${this.apiBase}/bookings/${bookingId}/approve`, {}));
    await this.loadBootstrap();
  }

  async rejectPreliminaryBooking(bookingId: string): Promise<void> {
    await firstValueFrom(this.http.post(`${this.apiBase}/bookings/${bookingId}/reject`, {}));
    await this.loadBootstrap();
  }

  async startConfirmedBooking(bookingId: string): Promise<void> {
    await firstValueFrom(this.http.post(`${this.apiBase}/bookings/${bookingId}/start`, {}));
    await this.loadBootstrap();
  }

  async completeInProgressBooking(bookingId: string): Promise<void> {
    await firstValueFrom(this.http.post(`${this.apiBase}/bookings/${bookingId}/complete`, {}));
    await this.loadBootstrap();
  }

  async updateJobActualMaterialQty(
    bookingId: string,
    actualLineId: string,
    actualQuantity: number
  ): Promise<void> {
    const qty = Math.max(0, roundQty(actualQuantity));
    this.allBookingsRaw.update((prev) =>
      prev.map((b) =>
        b.id === bookingId && b.invoiceStatus !== 'generated'
          ? {
              ...b,
              actualMaterials: b.actualMaterials.map((a) =>
                a.id === actualLineId ? { ...a, actualQuantity: qty } : a
              ),
            }
          : b
      )
    );
    await firstValueFrom(
      this.http.patch(`${this.apiBase}/bookings/${bookingId}/actual-materials/${actualLineId}`, {
        actualQuantity: qty,
      })
    );
  }

  async addJobAdditionalMaterial(
    bookingId: string,
    payload: { inventoryItemId: string; quantity: number; unitPrice?: number; reason: string }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await firstValueFrom(
        this.http.post<{ success: boolean; error?: string; booking?: ServiceBooking }>(
          `${this.apiBase}/bookings/${bookingId}/additional-materials`,
          payload
        )
      );
      if (res.booking) {
        this.allBookingsRaw.update((prev) =>
          prev.map((b) => (b.id === bookingId ? res.booking! : b))
        );
      }
      return res;
    } catch (err) {
      return { success: false, error: this.extractError(err, 'Could not add material.') };
    }
  }

  async updateJobAdditionalMaterial(
    bookingId: string,
    lineId: string,
    updates: Partial<Pick<JobAdditionalMaterialLine, 'quantity' | 'unitPrice' | 'reason'>>
  ): Promise<void> {
    const res = await firstValueFrom(
      this.http.patch<{ success: boolean; booking?: ServiceBooking }>(
        `${this.apiBase}/bookings/${bookingId}/additional-materials/${lineId}`,
        updates
      )
    );
    if (res.booking) {
      this.allBookingsRaw.update((prev) =>
        prev.map((b) => (b.id === bookingId ? res.booking! : b))
      );
    }
  }

  async removeJobAdditionalMaterial(bookingId: string, lineId: string): Promise<void> {
    const res = await firstValueFrom(
      this.http.delete<{ success: boolean; booking?: ServiceBooking }>(
        `${this.apiBase}/bookings/${bookingId}/additional-materials/${lineId}`
      )
    );
    if (res.booking) {
      this.allBookingsRaw.update((prev) =>
        prev.map((b) => (b.id === bookingId ? res.booking! : b))
      );
    }
  }

  async updateJobChargesAndNotes(
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
  ): Promise<void> {
    this.allBookingsRaw.update((prev) =>
      prev.map((b) => (b.id === bookingId ? { ...b, ...updates } : b))
    );
    await firstValueFrom(
      this.http.patch(`${this.apiBase}/bookings/${bookingId}/charges`, updates)
    );
  }

  async generateInvoiceForBooking(params: {
    bookingId: string;
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    odometerReading: number;
    workPerformed: string;
    labourCharges: number;
    additionalServiceCharges: number;
    discountAmount: number;
    paymentStatus: InvoicePaymentStatus;
    amountPaid: number;
    paymentMethod: InvoicePaymentMethod;
  }): Promise<{ success: boolean; error?: string; invoice?: Invoice }> {
    try {
      const res = await firstValueFrom(
        this.http.post<{ success: boolean; error?: string; invoice?: Invoice }>(
          `${this.apiBase}/invoices`,
          params
        )
      );
      await this.loadBootstrap();
      if (res.invoice) {
        this.invoiceModalRecord.set(res.invoice);
      }
      return res;
    } catch (err) {
      return { success: false, error: this.extractError(err, 'Failed to generate invoice.') };
    }
  }

  async updateInvoicePayment(
    invoiceId: string,
    updates: {
      paymentStatus: InvoicePaymentStatus;
      amountPaid: number;
      paymentMethod: InvoicePaymentMethod;
    }
  ): Promise<void> {
    const res = await firstValueFrom(
      this.http.patch<{ success: boolean; invoice?: Invoice }>(
        `${this.apiBase}/invoices/${invoiceId}/payment`,
        updates
      )
    );
    if (res.invoice) {
      this.invoices.update((prev) => prev.map((i) => (i.id === invoiceId ? res.invoice! : i)));
      if (this.invoiceModalRecord()?.id === invoiceId) {
        this.invoiceModalRecord.set(res.invoice);
      }
    }
  }

  async cancelInvoice(
    invoiceId: string,
    reason: string
  ): Promise<{ success: boolean; error?: string; invoice?: Invoice }> {
    try {
      const res = await firstValueFrom(
        this.http.post<{ success: boolean; error?: string; invoice?: Invoice }>(
          `${this.apiBase}/invoices/${invoiceId}/cancel`,
          { reason }
        )
      );
      await this.loadBootstrap();
      if (res.invoice) {
        this.invoiceModalRecord.set(res.invoice);
      }
      return res;
    } catch (err) {
      return { success: false, error: this.extractError(err, 'Failed to cancel invoice.') };
    }
  }

  async dismissNotification(id: string): Promise<void> {
    this.notifications.update((prev) =>
      prev.map((n) => (n.id === id ? { ...n, dismissed: true } : n))
    );
    await firstValueFrom(this.http.post(`${this.apiBase}/notifications/${id}/dismiss`, {}));
  }

  async dismissAllNotifications(): Promise<void> {
    this.notifications.update((prev) => prev.map((n) => ({ ...n, dismissed: true })));
    await firstValueFrom(this.http.post(`${this.apiBase}/notifications/dismiss-all`, {}));
  }

  async resetNotifications(): Promise<void> {
    const res = await firstValueFrom(
      this.http.post<{ success: boolean; notifications: FleetNotification[] }>(
        `${this.apiBase}/notifications/reset`,
        {}
      )
    );
    if (res.notifications) {
      this.notifications.set(res.notifications);
    }
  }
}
