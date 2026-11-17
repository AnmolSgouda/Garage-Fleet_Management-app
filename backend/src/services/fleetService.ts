import {
  FleetBootstrapState,
  FleetNotification,
  GarageConfig,
  InventoryItem,
  Invoice,
  InvoiceLineItem,
  InvoicePaymentMethod,
  InvoicePaymentStatus,
  JobActualMaterialLine,
  JobAdditionalMaterialLine,
  JobEstimatedMaterialLine,
  MaintenanceItem,
  RepairItem,
  ServiceBooking,
  ServiceHistoryRecord,
  ServiceTemplate,
  StockMovement,
  StockMovementType,
  Supplier,
  Vehicle,
  VehicleCategory,
} from '../types/fleet.js';
import {
  INITIAL_BOOKINGS,
  INITIAL_GARAGE_CONFIG,
  INITIAL_INVENTORY,
  INITIAL_NOTIFICATIONS,
  INITIAL_SERVICE_TEMPLATES,
  INITIAL_STOCK_MOVEMENTS,
  INITIAL_SUPPLIERS,
  INITIAL_VEHICLES,
  VEHICLE_CATEGORY_META,
} from '../data/seedData.js';
import {
  deleteDocFireAndForget,
  persistDocFireAndForget,
  readCollectionSafe,
  verifyFirestoreAvailability,
} from '../config/firebase.js';

export function roundQty(val: number): number {
  return Math.round((Number(val) || 0) * 100) / 100;
}

export function roundMoney(val: number): number {
  return Math.round((Number(val) || 0) * 100) / 100;
}

function cloneData<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

class FleetService {
  private garageConfig: GarageConfig = cloneData(INITIAL_GARAGE_CONFIG);
  private vehicles: Vehicle[] = cloneData(INITIAL_VEHICLES);
  private bookings: ServiceBooking[] = cloneData(INITIAL_BOOKINGS);
  private notifications: FleetNotification[] = cloneData(INITIAL_NOTIFICATIONS);
  private suppliers: Supplier[] = cloneData(INITIAL_SUPPLIERS);
  private inventory: InventoryItem[] = cloneData(INITIAL_INVENTORY);
  private serviceTemplates: ServiceTemplate[] = cloneData(INITIAL_SERVICE_TEMPLATES);
  private invoices: Invoice[] = [];
  private stockMovements: StockMovement[] = cloneData(INITIAL_STOCK_MOVEMENTS);
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    const hasFirestore = await verifyFirestoreAvailability();
    if (!hasFirestore) return;

    const [
      cfgs,
      sups,
      invs,
      tpls,
      vehs,
      bks,
      invDocs,
      txns,
      notifs,
    ] = await Promise.all([
      readCollectionSafe<GarageConfig>('garageConfigs'),
      readCollectionSafe<Supplier>('suppliers'),
      readCollectionSafe<InventoryItem>('inventory'),
      readCollectionSafe<ServiceTemplate>('serviceTemplates'),
      readCollectionSafe<Vehicle>('vehicles'),
      readCollectionSafe<ServiceBooking>('bookings'),
      readCollectionSafe<Invoice>('invoices'),
      readCollectionSafe<StockMovement>('stockMovements'),
      readCollectionSafe<FleetNotification>('notifications'),
    ]);

    if (cfgs && cfgs.length > 0) {
      this.garageConfig = cfgs[0];
    } else {
      persistDocFireAndForget('garageConfigs', this.garageConfig.id || 'default-garage', {
        ...this.garageConfig,
      });
    }

    if (sups && sups.length > 0) this.suppliers = sups;
    else this.suppliers.forEach((s) => persistDocFireAndForget('suppliers', s.id, { ...s }));

    if (invs && invs.length > 0) this.inventory = invs;
    else this.inventory.forEach((i) => persistDocFireAndForget('inventory', i.id, { ...i }));

    if (tpls && tpls.length > 0) this.serviceTemplates = tpls;
    else this.serviceTemplates.forEach((t) => persistDocFireAndForget('serviceTemplates', t.id, { ...t }));

    if (vehs && vehs.length > 0) this.vehicles = vehs;
    else this.vehicles.forEach((v) => persistDocFireAndForget('vehicles', v.id, { ...v }));

    if (bks && bks.length > 0) this.bookings = bks;
    else this.bookings.forEach((b) => persistDocFireAndForget('bookings', b.id, { ...b }));

    if (invDocs && invDocs.length > 0) this.invoices = invDocs;

    if (txns && txns.length > 0) {
      this.stockMovements = txns.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    } else {
      this.stockMovements.forEach((m) => persistDocFireAndForget('stockMovements', m.id, { ...m }));
    }

    if (notifs && notifs.length > 0) {
      this.notifications = notifs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    } else {
      this.notifications.forEach((n) => persistDocFireAndForget('notifications', n.id, { ...n }));
    }
  }

  getBootstrapState(): FleetBootstrapState {
    return {
      garageConfig: cloneData(this.garageConfig),
      vehicles: cloneData(this.vehicles),
      bookings: cloneData(this.bookings),
      notifications: cloneData(this.notifications),
      suppliers: cloneData(this.suppliers),
      inventory: cloneData(this.inventory),
      serviceTemplates: cloneData(this.serviceTemplates),
      invoices: cloneData(this.invoices),
      stockMovements: cloneData(this.stockMovements),
    };
  }

  private pushLowStockNotificationIfNeeded(item: InventoryItem): void {
    if (!item.isActive || item.quantityOnHand >= item.minimumStock) return;
    const alreadyActive = this.notifications.some(
      (n) => !n.dismissed && n.type === 'low_stock' && n.inventoryItemId === item.id
    );
    if (alreadyActive) return;

    const statusLabel = item.quantityOnHand <= 0 ? 'Out of Stock' : 'Low Stock';
    const alert: FleetNotification = {
      id: `alert-low-${item.id}-${Date.now()}`,
      type: 'low_stock',
      title: `${statusLabel}: ${item.partName}`,
      message: `${item.partName} (${item.sku}) has ${item.quantityOnHand} ${item.unit} left (Min: ${item.minimumStock} ${item.unit}). Primary supplier: ${item.supplierName}.`,
      workshop: this.garageConfig.garageName,
      inventoryItemId: item.id,
      timeAgo: 'Just now',
      timestamp: new Date().toISOString(),
      dismissed: false,
    };
    this.notifications = [alert, ...this.notifications];
    persistDocFireAndForget('notifications', alert.id, { ...alert });
  }

  updateGarageConfig(updates: Partial<GarageConfig>): GarageConfig {
    this.garageConfig = {
      ...this.garageConfig,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    persistDocFireAndForget('garageConfigs', this.garageConfig.id || 'default-garage', {
      ...this.garageConfig,
    });
    return cloneData(this.garageConfig);
  }

  // ==========================================================
  // SUPPLIERS
  // ==========================================================
  addSupplier(data: Omit<Supplier, 'id' | 'createdAt' | 'isActive'>): Supplier {
    const newSup: Supplier = {
      ...data,
      id: `sup-${Date.now()}`,
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    this.suppliers = [newSup, ...this.suppliers];
    persistDocFireAndForget('suppliers', newSup.id, { ...newSup });
    return cloneData(newSup);
  }

  updateSupplier(id: string, updates: Partial<Supplier>): { success: boolean; error?: string; supplier?: Supplier } {
    const existing = this.suppliers.find((s) => s.id === id);
    if (!existing) return { success: false, error: 'Supplier not found.' };

    const updated: Supplier = { ...existing, ...updates };
    this.suppliers = this.suppliers.map((s) => (s.id === id ? updated : s));
    persistDocFireAndForget('suppliers', id, { ...updated });

    if (updates.name) {
      this.inventory = this.inventory.map((item) => {
        if (item.supplierId !== id) return item;
        const nextItem = { ...item, supplierName: updates.name! };
        persistDocFireAndForget('inventory', nextItem.id, { ...nextItem });
        return nextItem;
      });
    }
    return { success: true, supplier: cloneData(updated) };
  }

  // ==========================================================
  // INVENTORY & STOCK MOVEMENTS
  // ==========================================================
  addInventoryItem(data: {
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
  }): { success: boolean; error?: string; item?: InventoryItem } {
    const cleanSku = (data.sku || '').trim().toUpperCase();
    if (!cleanSku) return { success: false, error: 'SKU / Part Number is required.' };
    if (!(data.partName || '').trim()) return { success: false, error: 'Part Name is required.' };

    const duplicate = this.inventory.some((i) => i.sku.toUpperCase() === cleanSku);
    if (duplicate) {
      return { success: false, error: `SKU "${cleanSku}" already exists in inventory.` };
    }

    const cleanSupName = (data.supplierName || '').trim();
    if (!cleanSupName) return { success: false, error: 'Supplier name is required.' };

    let supplierObj = this.suppliers.find(
      (s) => s.name.toLowerCase() === cleanSupName.toLowerCase()
    );

    if (!supplierObj) {
      supplierObj = {
        id: `sup-${Date.now()}`,
        name: cleanSupName,
        contactPerson: data.supplierContactPerson?.trim() || cleanSupName,
        mobile: (data.supplierMobile || '').trim() || '-',
        email: (data.supplierEmail || '').trim() || '-',
        address: (data.supplierAddress || '').trim() || '-',
        isActive: true,
        createdAt: new Date().toISOString(),
      };
      this.suppliers = [supplierObj, ...this.suppliers];
      persistDocFireAndForget('suppliers', supplierObj.id, { ...supplierObj });
    } else if (data.supplierMobile || data.supplierEmail || data.supplierAddress) {
      supplierObj = {
        ...supplierObj,
        mobile: (data.supplierMobile || '').trim() || supplierObj.mobile,
        email: (data.supplierEmail || '').trim() || supplierObj.email,
        address: (data.supplierAddress || '').trim() || supplierObj.address,
      };
      this.suppliers = this.suppliers.map((s) => (s.id === supplierObj!.id ? supplierObj! : s));
      persistDocFireAndForget('suppliers', supplierObj.id, { ...supplierObj });
    }

    const initQty = Math.max(0, roundQty(data.initialQuantity));
    const minStock = Math.max(0, roundQty(data.minimumStock));
    const newItem: InventoryItem = {
      id: `inv-${Date.now()}`,
      partName: data.partName.trim(),
      sku: cleanSku,
      category: (data.category || '').trim() || 'General',
      description: (data.description || '').trim(),
      unit: (data.unit || '').trim() || 'Pieces',
      quantityOnHand: initQty,
      minimumStock: minStock,
      storageLocation: (data.storageLocation || '').trim() || 'UNASSIGNED',
      purchaseCost: Math.max(0, roundMoney(data.purchaseCost)),
      sellingPrice: Math.max(0, roundMoney(data.sellingPrice)),
      supplierId: supplierObj.id,
      supplierName: supplierObj.name,
      isActive: true,
      updatedAt: new Date().toISOString(),
    };

    this.inventory = [newItem, ...this.inventory];
    persistDocFireAndForget('inventory', newItem.id, { ...newItem });

    if (initQty > 0) {
      const txn: StockMovement = {
        id: `txn-${Date.now()}`,
        transactionCode: `TXN-${1000 + this.stockMovements.length + 1}`,
        inventoryItemId: newItem.id,
        partName: newItem.partName,
        sku: newItem.sku,
        unit: newItem.unit,
        transactionType: 'stock_in',
        previousQuantity: 0,
        quantityDelta: initQty,
        updatedQuantity: initQty,
        supplierId: supplierObj.id,
        supplierName: supplierObj.name,
        timestamp: new Date().toISOString(),
        performedBy: 'Garage Manager',
        remarks: 'Initial stock added during part catalogue registration',
      };
      this.stockMovements = [txn, ...this.stockMovements];
      persistDocFireAndForget('stockMovements', txn.id, { ...txn });
    }

    this.pushLowStockNotificationIfNeeded(newItem);
    return { success: true, item: cloneData(newItem) };
  }

  updateInventoryItem(
    id: string,
    updates: {
      partName?: string;
      sku?: string;
      category?: string;
      description?: string;
      unit?: string;
      minimumStock?: number;
      purchaseCost?: number;
      sellingPrice?: number;
      storageLocation?: string;
      supplierId?: string;
      supplierName?: string;
    }
  ): { success: boolean; error?: string; item?: InventoryItem } {
    const existing = this.inventory.find((i) => i.id === id);
    if (!existing) return { success: false, error: 'Inventory item not found.' };

    const cleanUpdates = { ...updates };
    if (cleanUpdates.sku) {
      const cleanSku = cleanUpdates.sku.trim().toUpperCase();
      const dup = this.inventory.some((i) => i.id !== id && i.sku.toUpperCase() === cleanSku);
      if (dup) {
        return { success: false, error: `SKU "${cleanSku}" is already assigned to another part.` };
      }
      cleanUpdates.sku = cleanSku;
    }

    const updatedItem: InventoryItem = {
      ...existing,
      ...cleanUpdates,
      minimumStock:
        cleanUpdates.minimumStock !== undefined
          ? Math.max(0, roundQty(cleanUpdates.minimumStock))
          : existing.minimumStock,
      purchaseCost:
        cleanUpdates.purchaseCost !== undefined
          ? Math.max(0, roundMoney(cleanUpdates.purchaseCost))
          : existing.purchaseCost,
      sellingPrice:
        cleanUpdates.sellingPrice !== undefined
          ? Math.max(0, roundMoney(cleanUpdates.sellingPrice))
          : existing.sellingPrice,
      updatedAt: new Date().toISOString(),
    };

    this.inventory = this.inventory.map((i) => (i.id === id ? updatedItem : i));
    persistDocFireAndForget('inventory', id, { ...updatedItem });
    this.pushLowStockNotificationIfNeeded(updatedItem);

    return { success: true, item: cloneData(updatedItem) };
  }

  toggleInventoryItemActive(id: string): { success: boolean; item?: InventoryItem } {
    const existing = this.inventory.find((i) => i.id === id);
    if (!existing) return { success: false };

    const updated: InventoryItem = {
      ...existing,
      isActive: !existing.isActive,
      updatedAt: new Date().toISOString(),
    };
    this.inventory = this.inventory.map((i) => (i.id === id ? updated : i));
    persistDocFireAndForget('inventory', id, { ...updated });
    return { success: true, item: cloneData(updated) };
  }

  adjustInventoryStock(params: {
    inventoryItemId: string;
    transactionType: Extract<StockMovementType, 'stock_in' | 'manual_adjustment' | 'purchase_return'>;
    mode: 'delta' | 'set';
    value: number;
    remarks: string;
    performedBy?: string;
  }): { success: boolean; error?: string; item?: InventoryItem; movement?: StockMovement } {
    const item = this.inventory.find((i) => i.id === params.inventoryItemId);
    if (!item) return { success: false, error: 'Inventory item not found.' };

    const val = roundQty(params.value);
    const prevQty = roundQty(item.quantityOnHand);
    let nextQty = prevQty;
    let delta = 0;

    if (params.mode === 'set') {
      if (val < 0) return { success: false, error: 'Stock quantity cannot be negative.' };
      nextQty = val;
      delta = roundQty(nextQty - prevQty);
    } else {
      if (params.transactionType === 'purchase_return') {
        delta = -Math.abs(val);
      } else if (params.transactionType === 'stock_in') {
        delta = Math.abs(val);
      } else {
        delta = val;
      }
      nextQty = roundQty(prevQty + delta);
    }

    if (nextQty < 0) {
      return {
        success: false,
        error: `Insufficient quantity on hand (${prevQty} ${item.unit}). Resulting stock cannot be negative.`,
      };
    }

    if (delta === 0) {
      return { success: false, error: 'Quantity adjustment cannot be zero.' };
    }

    const updatedItem: InventoryItem = {
      ...item,
      quantityOnHand: nextQty,
      updatedAt: new Date().toISOString(),
    };

    const txn: StockMovement = {
      id: `txn-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      transactionCode: `TXN-${1000 + this.stockMovements.length + 1}`,
      inventoryItemId: item.id,
      partName: item.partName,
      sku: item.sku,
      unit: item.unit,
      transactionType: params.transactionType,
      previousQuantity: prevQty,
      quantityDelta: delta,
      updatedQuantity: nextQty,
      supplierId:
        params.transactionType === 'stock_in' || params.transactionType === 'purchase_return'
          ? item.supplierId
          : undefined,
      supplierName:
        params.transactionType === 'stock_in' || params.transactionType === 'purchase_return'
          ? item.supplierName
          : undefined,
      timestamp: new Date().toISOString(),
      performedBy: params.performedBy || 'Garage Manager',
      remarks: (params.remarks || '').trim() || 'Stock updated',
    };

    this.inventory = this.inventory.map((i) => (i.id === item.id ? updatedItem : i));
    this.stockMovements = [txn, ...this.stockMovements];
    persistDocFireAndForget('inventory', updatedItem.id, { ...updatedItem });
    persistDocFireAndForget('stockMovements', txn.id, { ...txn });

    if (nextQty < item.minimumStock) {
      this.pushLowStockNotificationIfNeeded(updatedItem);
    }

    return { success: true, item: cloneData(updatedItem), movement: cloneData(txn) };
  }

  // ==========================================================
  // SERVICE TEMPLATES
  // ==========================================================
  createServiceTemplate(tpl: Omit<ServiceTemplate, 'id' | 'isCustom'>): ServiceTemplate {
    const newTpl: ServiceTemplate = {
      ...tpl,
      id: `tpl-${Date.now()}`,
      isCustom: true,
    };
    this.serviceTemplates = [...this.serviceTemplates, newTpl];
    persistDocFireAndForget('serviceTemplates', newTpl.id, { ...newTpl });
    return cloneData(newTpl);
  }

  updateServiceTemplate(id: string, updates: Partial<ServiceTemplate>): ServiceTemplate | null {
    const existing = this.serviceTemplates.find((t) => t.id === id);
    if (!existing) return null;
    const updated = { ...existing, ...updates };
    this.serviceTemplates = this.serviceTemplates.map((t) => (t.id === id ? updated : t));
    persistDocFireAndForget('serviceTemplates', id, { ...updated });
    return cloneData(updated);
  }

  // ==========================================================
  // VEHICLES
  // ==========================================================
  registerVehicle(data: {
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
  }): { success: boolean; error?: string; vehicleId?: string; vehicle?: Vehicle } {
    const trimmedReg = (data.registrationNumber || '').trim().toUpperCase();
    if (!trimmedReg) {
      return { success: false, error: 'Registration number is required.' };
    }

    const exists = this.vehicles.some((v) => v.registrationNumber.toUpperCase() === trimmedReg);
    if (exists) {
      return {
        success: false,
        error: `Vehicle with registration ${trimmedReg} is already registered in the fleet.`,
      };
    }

    const meta = VEHICLE_CATEGORY_META[data.category] || VEHICLE_CATEGORY_META.container_truck;
    const newVehId = `veh-${Date.now()}`;

    const newVehicle: Vehicle = {
      id: newVehId,
      registrationNumber: trimmedReg,
      manufacturer: data.manufacturer || 'Scania',
      model: data.model || 'R 500 A6x2NA',
      manufacturingYear: data.manufacturingYear || 2024,
      category: data.category,
      categoryLabel: meta.label,
      imagePath: meta.imagePath,
      odometer: data.odometer || 0,
      engineRunningHours: data.engineRunningHours || 0,
      equipmentGroup: data.equipmentGroup || 'Heavy Haulage',
      maintenancePlan: data.maintenancePlan || 'Flexible Maintenance, M inspection',
      nextServiceDate: data.nextServiceDate || '15-11-2026',
      assignedGarage: this.garageConfig.garageName,
      customerName: data.customerName?.trim() || 'Commercial Fleet Account',
      customerPhone: data.customerPhone?.trim() || '-',
      customerEmail: data.customerEmail?.trim() || '',
      otherServiceActivities: '-',
      notes: data.notes || '',
      maintenanceChecklist: [
        {
          id: `m-init-${Date.now()}`,
          name: 'Factory Pre-Delivery Inspection & Flexible Maintenance',
          status: 'ok',
          dueDate: data.nextServiceDate || '15-11-2026',
          required: true,
        },
      ],
      repairChecklist: [],
      serviceHistory: [],
    };

    this.vehicles = [newVehicle, ...this.vehicles];
    persistDocFireAndForget('vehicles', newVehicle.id, { ...newVehicle });

    const newAlert: FleetNotification = {
      id: `alert-${Date.now()}`,
      type: 'confirmed',
      title: 'Confirmed booking',
      message: `Commercial vehicle ${trimmedReg} (${meta.label}) registered into ${this.garageConfig.garageName}. Ready for service planning.`,
      workshop: this.garageConfig.garageName,
      timeAgo: 'Just now',
      timestamp: new Date().toISOString(),
      dismissed: false,
    };
    this.notifications = [newAlert, ...this.notifications];
    persistDocFireAndForget('notifications', newAlert.id, { ...newAlert });

    return { success: true, vehicleId: newVehId, vehicle: cloneData(newVehicle) };
  }

  addUnplannedActivity(vehicleId: string, name: string): MaintenanceItem | null {
    const veh = this.vehicles.find((v) => v.id === vehicleId);
    if (!veh) return null;
    const newItem: MaintenanceItem = {
      id: `m-unplanned-${Date.now()}`,
      name: name.trim(),
      status: 'due',
      dueDate: 'Scheduled Next Bay',
      required: false,
    };
    const updated: Vehicle = {
      ...veh,
      maintenanceChecklist: [...veh.maintenanceChecklist, newItem],
    };
    this.vehicles = this.vehicles.map((v) => (v.id === vehicleId ? updated : v));
    persistDocFireAndForget('vehicles', vehicleId, { ...updated });
    return newItem;
  }

  addUnplannedRepair(
    vehicleId: string,
    issue: string,
    severity: 'major' | 'minor' | 'critical'
  ): RepairItem | null {
    const veh = this.vehicles.find((v) => v.id === vehicleId);
    if (!veh) return null;
    const now = new Date();
    const newItem: RepairItem = {
      id: `r-unplanned-${Date.now()}`,
      issue: issue.trim(),
      severity,
      reportedDate: now.toLocaleDateString('en-GB'),
      reportedTime: now.toTimeString().slice(0, 5),
      resolved: false,
    };
    const updated: Vehicle = {
      ...veh,
      repairChecklist: [...veh.repairChecklist, newItem],
    };
    this.vehicles = this.vehicles.map((v) => (v.id === vehicleId ? updated : v));
    persistDocFireAndForget('vehicles', vehicleId, { ...updated });
    return newItem;
  }

  // ==========================================================
  // BOOKINGS & WORKFLOW
  // ==========================================================
  validateBookingConflict(
    vehicleId: string,
    date: string,
    startTime: string,
    endTime: string,
    ignoreBookingId?: string
  ): string | null {
    const conflicts = this.bookings.filter((b) => {
      if (b.id === ignoreBookingId) return false;
      if (b.vehicleId !== vehicleId) return false;
      if (b.date !== date) return false;
      return startTime < b.endTime && endTime > b.startTime;
    });

    if (conflicts.length > 0) {
      const c = conflicts[0];
      return `Conflict: Vehicle ${c.vehicleReg} already has a scheduled service (${c.startTime} - ${c.endTime}) on ${date}.`;
    }
    return null;
  }

  createBooking(
    newBookingData: Omit<
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
  ): { success: boolean; error?: string; booking?: ServiceBooking } {
    const conflictError = this.validateBookingConflict(
      newBookingData.vehicleId,
      newBookingData.date,
      newBookingData.startTime,
      newBookingData.endTime
    );

    if (conflictError) {
      return { success: false, error: conflictError };
    }

    const id = `bk-${Date.now()}`;
    const bookingRef = String(Math.floor(2178700 + Math.random() * 900));

    const estimatedList = newBookingData.estimatedMaterials || [];
    const actualList: JobActualMaterialLine[] = estimatedList.map((em, idx) => ({
      id: `act-${Date.now()}-${idx}`,
      inventoryItemId: em.inventoryItemId,
      partName: em.partName,
      sku: em.sku,
      unit: em.unit,
      estimatedQuantity: em.estimatedQuantity,
      actualQuantity: em.estimatedQuantity,
      unitPrice: em.unitPrice,
    }));

    const veh = this.vehicles.find((v) => v.id === newBookingData.vehicleId);

    const newBooking: ServiceBooking = {
      ...newBookingData,
      id,
      bookingRef,
      workshopLocation: this.garageConfig.garageName,
      workflowColumn: 'preliminary_bookings',
      calendarStatus: 'preliminary',
      badgeType: 'pending',
      badgeDateStr: `${newBookingData.date}, ${newBookingData.startTime}`,
      customerName: newBookingData.customerName || veh?.customerName || 'Fleet Client',
      customerPhone: newBookingData.customerPhone || veh?.customerPhone || '-',
      customerEmail: newBookingData.customerEmail || veh?.customerEmail || '',
      estimatedMaterials: estimatedList,
      actualMaterials: actualList,
      additionalMaterials: [],
      labourCharges: newBookingData.labourCharges ?? 1800,
      additionalServiceCharges: 0,
      discountAmount: 0,
      invoiceStatus: 'none',
    };

    this.bookings = [newBooking, ...this.bookings];
    persistDocFireAndForget('bookings', newBooking.id, { ...newBooking });

    const newAlert: FleetNotification = {
      id: `alert-${Date.now()}`,
      type: 'proposal',
      title: 'Proposal',
      message: `${this.garageConfig.garageName} logged ${newBooking.serviceType || 'service'} booking for ${newBooking.vehicleReg} on ${newBooking.date} at ${newBooking.startTime}. Moved to Preliminary Bookings.`,
      workshop: this.garageConfig.garageName,
      bookingRef,
      timeAgo: 'Just now',
      timestamp: new Date().toISOString(),
      dismissed: false,
    };
    this.notifications = [newAlert, ...this.notifications];
    persistDocFireAndForget('notifications', newAlert.id, { ...newAlert });

    return { success: true, booking: cloneData(newBooking) };
  }

  updateBooking(updatedBooking: ServiceBooking): { success: boolean; error?: string; booking?: ServiceBooking } {
    const existing = this.bookings.find((b) => b.id === updatedBooking.id);
    if (!existing) return { success: false, error: 'Booking not found.' };

    const conflictError = this.validateBookingConflict(
      updatedBooking.vehicleId,
      updatedBooking.date,
      updatedBooking.startTime,
      updatedBooking.endTime,
      updatedBooking.id
    );

    if (conflictError) {
      return { success: false, error: conflictError };
    }

    this.bookings = this.bookings.map((b) => (b.id === updatedBooking.id ? updatedBooking : b));
    persistDocFireAndForget('bookings', updatedBooking.id, { ...updatedBooking });

    if (updatedBooking.calendarStatus === 'confirmed' && existing.calendarStatus !== 'confirmed') {
      const newAlert: FleetNotification = {
        id: `alert-${Date.now()}`,
        type: 'confirmed',
        title: 'Confirmed booking',
        message: `Slot confirmed for ${updatedBooking.vehicleReg} (${updatedBooking.date} ${updatedBooking.startTime}-${updatedBooking.endTime}). Moved to Confirmed Bookings.`,
        workshop: this.garageConfig.garageName,
        bookingRef: updatedBooking.bookingRef,
        timeAgo: 'Just now',
        timestamp: new Date().toISOString(),
        dismissed: false,
      };
      this.notifications = [newAlert, ...this.notifications];
      persistDocFireAndForget('notifications', newAlert.id, { ...newAlert });
    }

    return { success: true, booking: cloneData(updatedBooking) };
  }

  cancelBooking(bookingId: string): { success: boolean } {
    const booking = this.bookings.find((b) => b.id === bookingId);
    if (!booking) return { success: false };

    this.bookings = this.bookings.filter((b) => b.id !== bookingId);
    deleteDocFireAndForget('bookings', bookingId);

    const newAlert: FleetNotification = {
      id: `alert-${Date.now()}`,
      type: 'delayed',
      title: 'Service delayed',
      message: `Appointment #${booking.bookingRef} for vehicle ${booking.vehicleReg} was cancelled.`,
      workshop: this.garageConfig.garageName,
      bookingRef: booking.bookingRef,
      timeAgo: 'Just now',
      timestamp: new Date().toISOString(),
      dismissed: false,
    };
    this.notifications = [newAlert, ...this.notifications];
    persistDocFireAndForget('notifications', newAlert.id, { ...newAlert });
    return { success: true };
  }

  approvePreliminaryBooking(bookingId: string): ServiceBooking | null {
    const existing = this.bookings.find((b) => b.id === bookingId);
    if (!existing) return null;

    const updated: ServiceBooking = {
      ...existing,
      workflowColumn: 'confirmed_bookings',
      calendarStatus: 'confirmed',
      badgeType: 'drop_off',
      badgeDateStr: 'Ready for Drop off',
    };
    this.bookings = this.bookings.map((b) => (b.id === bookingId ? updated : b));
    persistDocFireAndForget('bookings', bookingId, { ...updated });

    const newAlert: FleetNotification = {
      id: `alert-${Date.now()}`,
      type: 'confirmed',
      title: 'Confirmed booking',
      message: `Preliminary booking approved by Workshop Supervisor. Bay allocation confirmed at ${this.garageConfig.garageName}.`,
      workshop: this.garageConfig.garageName,
      bookingRef: updated.bookingRef,
      timeAgo: 'Just now',
      timestamp: new Date().toISOString(),
      dismissed: false,
    };
    this.notifications = [newAlert, ...this.notifications];
    persistDocFireAndForget('notifications', newAlert.id, { ...newAlert });

    return cloneData(updated);
  }

  rejectPreliminaryBooking(bookingId: string): ServiceBooking | null {
    const existing = this.bookings.find((b) => b.id === bookingId);
    if (!existing) return null;

    const updated: ServiceBooking = {
      ...existing,
      workflowColumn: 'service_events_to_book',
      calendarStatus: 'delayed',
      badgeType: 'delayed',
      badgeDateStr: 'Rejected - Reschedule Required',
    };
    this.bookings = this.bookings.map((b) => (b.id === bookingId ? updated : b));
    persistDocFireAndForget('bookings', bookingId, { ...updated });
    return cloneData(updated);
  }

  startConfirmedBooking(bookingId: string): ServiceBooking | null {
    const existing = this.bookings.find((b) => b.id === bookingId);
    if (!existing) return null;

    const updated: ServiceBooking = {
      ...existing,
      workflowColumn: 'in_progress',
      calendarStatus: 'planned',
      badgeType: 'pick_up',
      badgeDateStr: 'In Bay - Service Active',
    };
    this.bookings = this.bookings.map((b) => (b.id === bookingId ? updated : b));
    persistDocFireAndForget('bookings', bookingId, { ...updated });
    return cloneData(updated);
  }

  completeInProgressBooking(
    bookingId: string,
    technicianNotes = 'Service completed according to garage inspection guidelines.',
    invoiceNumber?: string,
    invoiceTotalStr?: string
  ): ServiceBooking | null {
    const booking = this.bookings.find((b) => b.id === bookingId);
    if (!booking) return null;

    const veh = this.vehicles.find((v) => v.id === booking.vehicleId);
    const historyItem: ServiceHistoryRecord = {
      id: `hist-${Date.now()}`,
      serviceTitle: booking.serviceActivities,
      workshopLocation: this.garageConfig.garageName,
      completedDate: new Date().toLocaleDateString('en-GB'),
      performedBy: 'Certified Master Tech',
      odometerAtService: veh?.odometer || 85000,
      costEstimate:
        invoiceTotalStr || `${this.garageConfig.currencySymbol} ${booking.labourCharges.toFixed(2)}`,
      invoiceNumber,
      status: 'completed',
      notes: technicianNotes,
    };

    if (veh) {
      const updatedVeh: Vehicle = {
        ...veh,
        serviceHistory: [historyItem, ...veh.serviceHistory],
        nextServiceDate: '24/12/2026',
      };
      this.vehicles = this.vehicles.map((v) => (v.id === veh.id ? updatedVeh : v));
      persistDocFireAndForget('vehicles', veh.id, { ...updatedVeh });
    }

    const updatedBooking: ServiceBooking = {
      ...booking,
      workflowColumn: 'service_events_to_book',
      calendarStatus: 'performed',
      badgeType: 'accepted',
      badgeDateStr: invoiceNumber
        ? `Invoiced (${invoiceNumber})`
        : 'Completed - Ready for Invoice',
    };
    this.bookings = this.bookings.map((b) => (b.id === bookingId ? updatedBooking : b));
    persistDocFireAndForget('bookings', bookingId, { ...updatedBooking });

    const newAlert: FleetNotification = {
      id: `alert-${Date.now()}`,
      type: 'performed',
      title: 'Performed',
      message: `${this.garageConfig.garageName} completed ${booking.serviceType || 'service'} for ${booking.vehicleReg}.${invoiceNumber ? ` Invoice ${invoiceNumber} generated.` : ''}`,
      workshop: this.garageConfig.garageName,
      bookingRef: booking.bookingRef,
      timeAgo: 'Just now',
      timestamp: new Date().toISOString(),
      dismissed: false,
    };
    this.notifications = [newAlert, ...this.notifications];
    persistDocFireAndForget('notifications', newAlert.id, { ...newAlert });

    return cloneData(updatedBooking);
  }

  // ==========================================================
  // REPAIR JOB CONSUMPTION MUTATORS (ZERO STOCK DEDUCTION)
  // ==========================================================
  updateJobActualMaterialQty(
    bookingId: string,
    actualLineId: string,
    actualQuantity: number
  ): { success: boolean; error?: string; booking?: ServiceBooking } {
    const b = this.bookings.find((item) => item.id === bookingId);
    if (!b) return { success: false, error: 'Repair job not found.' };
    if (b.invoiceStatus === 'generated') {
      return { success: false, error: 'Materials locked after invoice generation.' };
    }

    const qty = Math.max(0, roundQty(actualQuantity));
    const updated: ServiceBooking = {
      ...b,
      actualMaterials: b.actualMaterials.map((a) =>
        a.id === actualLineId ? { ...a, actualQuantity: qty } : a
      ),
    };
    this.bookings = this.bookings.map((item) => (item.id === bookingId ? updated : item));
    persistDocFireAndForget('bookings', bookingId, { ...updated });
    return { success: true, booking: cloneData(updated) };
  }

  addJobAdditionalMaterial(
    bookingId: string,
    payload: {
      inventoryItemId: string;
      quantity: number;
      unitPrice?: number;
      reason: string;
    }
  ): { success: boolean; error?: string; booking?: ServiceBooking } {
    const booking = this.bookings.find((b) => b.id === bookingId);
    if (!booking) return { success: false, error: 'Repair job not found.' };
    if (booking.invoiceStatus === 'generated') {
      return { success: false, error: 'Cannot modify materials after invoice is generated.' };
    }

    const invItem = this.inventory.find((i) => i.id === payload.inventoryItemId);
    if (!invItem) return { success: false, error: 'Selected spare part not found in inventory.' };

    const qty = roundQty(payload.quantity);
    if (qty <= 0) return { success: false, error: 'Quantity must be greater than zero.' };

    const price =
      payload.unitPrice !== undefined ? roundMoney(payload.unitPrice) : invItem.sellingPrice;

    const newLine: JobAdditionalMaterialLine = {
      id: `add-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      inventoryItemId: invItem.id,
      partName: invItem.partName,
      sku: invItem.sku,
      unit: invItem.unit,
      quantity: qty,
      unitPrice: price,
      reason: (payload.reason || '').trim() || 'Additional repair requirement found during inspection',
    };

    const updated: ServiceBooking = {
      ...booking,
      additionalMaterials: [...booking.additionalMaterials, newLine],
    };
    this.bookings = this.bookings.map((b) => (b.id === bookingId ? updated : b));
    persistDocFireAndForget('bookings', bookingId, { ...updated });
    return { success: true, booking: cloneData(updated) };
  }

  updateJobAdditionalMaterial(
    bookingId: string,
    lineId: string,
    updates: Partial<Pick<JobAdditionalMaterialLine, 'quantity' | 'unitPrice' | 'reason'>>
  ): { success: boolean; error?: string; booking?: ServiceBooking } {
    const b = this.bookings.find((item) => item.id === bookingId);
    if (!b) return { success: false, error: 'Repair job not found.' };
    if (b.invoiceStatus === 'generated') {
      return { success: false, error: 'Cannot modify materials after invoice is generated.' };
    }

    const updated: ServiceBooking = {
      ...b,
      additionalMaterials: b.additionalMaterials.map((m) =>
        m.id === lineId
          ? {
              ...m,
              quantity:
                updates.quantity !== undefined ? Math.max(0, roundQty(updates.quantity)) : m.quantity,
              unitPrice:
                updates.unitPrice !== undefined
                  ? Math.max(0, roundMoney(updates.unitPrice))
                  : m.unitPrice,
              reason: updates.reason !== undefined ? updates.reason : m.reason,
            }
          : m
      ),
    };
    this.bookings = this.bookings.map((item) => (item.id === bookingId ? updated : item));
    persistDocFireAndForget('bookings', bookingId, { ...updated });
    return { success: true, booking: cloneData(updated) };
  }

  removeJobAdditionalMaterial(
    bookingId: string,
    lineId: string
  ): { success: boolean; error?: string; booking?: ServiceBooking } {
    const b = this.bookings.find((item) => item.id === bookingId);
    if (!b) return { success: false, error: 'Repair job not found.' };
    if (b.invoiceStatus === 'generated') {
      return { success: false, error: 'Cannot modify materials after invoice is generated.' };
    }

    const updated: ServiceBooking = {
      ...b,
      additionalMaterials: b.additionalMaterials.filter((m) => m.id !== lineId),
    };
    this.bookings = this.bookings.map((item) => (item.id === bookingId ? updated : item));
    persistDocFireAndForget('bookings', bookingId, { ...updated });
    return { success: true, booking: cloneData(updated) };
  }

  updateJobChargesAndNotes(
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
  ): { success: boolean; error?: string; booking?: ServiceBooking } {
    const b = this.bookings.find((item) => item.id === bookingId);
    if (!b) return { success: false, error: 'Repair job not found.' };
    if (b.invoiceStatus === 'generated') {
      return { success: false, error: 'Cannot edit job charges after invoice is generated.' };
    }

    const updated: ServiceBooking = {
      ...b,
      ...updates,
      labourCharges:
        updates.labourCharges !== undefined
          ? Math.max(0, roundMoney(updates.labourCharges))
          : b.labourCharges,
      additionalServiceCharges:
        updates.additionalServiceCharges !== undefined
          ? Math.max(0, roundMoney(updates.additionalServiceCharges))
          : b.additionalServiceCharges,
      discountAmount:
        updates.discountAmount !== undefined
          ? Math.max(0, roundMoney(updates.discountAmount))
          : b.discountAmount,
    };
    this.bookings = this.bookings.map((item) => (item.id === bookingId ? updated : item));
    persistDocFireAndForget('bookings', bookingId, { ...updated });
    return { success: true, booking: cloneData(updated) };
  }

  // ==========================================================
  // INVOICE GENERATION (ATOMIC STOCK DEDUCTION + IDEMPOTENCY)
  // ==========================================================
  generateInvoiceForBooking(params: {
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
  }): { success: boolean; error?: string; invoice?: Invoice } {
    const booking = this.bookings.find((b) => b.id === params.bookingId);
    if (!booking) {
      return { success: false, error: 'Repair job not found.' };
    }

    const existingActiveInvoice = this.invoices.find(
      (inv) => inv.repairJobId === booking.id && inv.status === 'active'
    );
    if (existingActiveInvoice || booking.invoiceStatus === 'generated') {
      return {
        success: false,
        error: `Invoice ${existingActiveInvoice?.invoiceNumber || booking.invoiceNumber} has already been generated for this repair job. Duplicate stock deduction prevented.`,
      };
    }

    const lineItems: InvoiceLineItem[] = [];
    for (const act of booking.actualMaterials || []) {
      const qty = roundQty(act.actualQuantity);
      if (qty <= 0) continue;
      const unitPrice = roundMoney(act.unitPrice);
      lineItems.push({
        id: `ili-est-${act.id}`,
        inventoryItemId: act.inventoryItemId,
        partName: act.partName,
        sku: act.sku,
        unit: act.unit,
        materialSource: 'estimated_actual',
        estimatedQuantity: act.estimatedQuantity,
        quantity: qty,
        unitPrice,
        lineTotal: roundMoney(qty * unitPrice),
      });
    }

    for (const add of booking.additionalMaterials || []) {
      const qty = roundQty(add.quantity);
      if (qty <= 0) continue;
      const unitPrice = roundMoney(add.unitPrice);
      lineItems.push({
        id: `ili-add-${add.id}`,
        inventoryItemId: add.inventoryItemId,
        partName: add.partName,
        sku: add.sku,
        unit: add.unit,
        materialSource: 'additional',
        quantity: qty,
        unitPrice,
        lineTotal: roundMoney(qty * unitPrice),
        reason: add.reason,
      });
    }

    const totalConsumedByItem = new Map<string, number>();
    for (const li of lineItems) {
      const curr = totalConsumedByItem.get(li.inventoryItemId) || 0;
      totalConsumedByItem.set(li.inventoryItemId, roundQty(curr + li.quantity));
    }

    for (const [invId, reqQty] of totalConsumedByItem.entries()) {
      const invItem = this.inventory.find((i) => i.id === invId);
      if (!invItem) {
        return {
          success: false,
          error: `Inventory record missing for item ID "${invId}". Transaction rolled back.`,
        };
      }
      if (roundQty(invItem.quantityOnHand) < reqQty) {
        return {
          success: false,
          error: `Insufficient stock for "${invItem.partName}" (${invItem.sku}). Required: ${reqQty} ${invItem.unit}, Available: ${invItem.quantityOnHand} ${invItem.unit}. Transaction rolled back — please restock or adjust actual quantity.`,
        };
      }
    }

    const materialsSubtotal = roundMoney(lineItems.reduce((sum, li) => sum + li.lineTotal, 0));
    const labour = Math.max(0, roundMoney(params.labourCharges));
    const additionalSvc = Math.max(0, roundMoney(params.additionalServiceCharges));
    const discount = Math.max(0, roundMoney(params.discountAmount));
    const preTaxTotal = Math.max(0, roundMoney(materialsSubtotal + labour + additionalSvc - discount));
    const taxAmount = this.garageConfig.taxEnabled
      ? roundMoney((preTaxTotal * this.garageConfig.taxRatePercent) / 100)
      : 0;
    const finalPayableAmount = roundMoney(preTaxTotal + taxAmount);

    const invoiceSeq = this.garageConfig.nextInvoiceSequence;
    const invoiceNumber = `${this.garageConfig.invoicePrefix}-${invoiceSeq}`;
    const invoiceId = `inv-doc-${Date.now()}`;
    const nowIso = new Date().toISOString();

    let amountPaid = 0;
    if (params.paymentStatus === 'Paid') amountPaid = finalPayableAmount;
    else if (params.paymentStatus === 'Partially Paid') {
      amountPaid = Math.min(finalPayableAmount, Math.max(0, roundMoney(params.amountPaid)));
    }

    const newInvoice: Invoice = {
      id: invoiceId,
      invoiceNumber,
      repairJobId: booking.id,
      bookingRef: booking.bookingRef,
      invoiceDate: nowIso.slice(0, 10),
      createdAt: nowIso,
      customerName: (params.customerName || '').trim() || booking.customerName || 'Fleet Customer',
      customerPhone: (params.customerPhone || '').trim() || booking.customerPhone || '-',
      customerEmail: params.customerEmail?.trim() || booking.customerEmail || '',
      vehicleId: booking.vehicleId,
      vehicleReg: booking.vehicleReg,
      vehicleMakeModel: booking.vehicleModel,
      odometerReading: params.odometerReading,
      serviceType: booking.serviceType || 'General Service',
      workPerformed:
        (params.workPerformed || '').trim() ||
        booking.workPerformedDescription ||
        booking.serviceActivities,
      lineItems,
      materialsSubtotal,
      labourCharges: labour,
      additionalServiceCharges: additionalSvc,
      discountAmount: discount,
      taxEnabled: this.garageConfig.taxEnabled,
      taxRatePercent: this.garageConfig.taxEnabled ? this.garageConfig.taxRatePercent : 0,
      taxAmount,
      finalPayableAmount,
      paymentStatus: params.paymentStatus,
      amountPaid,
      paymentMethod: params.paymentMethod,
      status: 'active',
      garageSnapshot: { ...this.garageConfig },
    };

    const newMovements: StockMovement[] = [];
    const newlyLowItems: InventoryItem[] = [];
    let txnCounter = this.stockMovements.length + 1;
    const updatedInventory = this.inventory.map((item) => ({ ...item }));

    for (const li of lineItems) {
      const target = updatedInventory.find((i) => i.id === li.inventoryItemId);
      if (!target) continue;
      const prevQty = roundQty(target.quantityOnHand);
      const nextQty = roundQty(prevQty - li.quantity);
      target.quantityOnHand = nextQty;
      target.updatedAt = nowIso;

      const mv: StockMovement = {
        id: `txn-${Date.now()}-${txnCounter}`,
        transactionCode: `TXN-${1000 + txnCounter}`,
        inventoryItemId: target.id,
        partName: target.partName,
        sku: target.sku,
        unit: target.unit,
        transactionType: 'service_consumption',
        previousQuantity: prevQty,
        quantityDelta: -li.quantity,
        updatedQuantity: nextQty,
        repairJobId: booking.bookingRef,
        invoiceNumber,
        timestamp: nowIso,
        performedBy: 'Workshop Billing & Mechanic',
        remarks:
          li.materialSource === 'additional'
            ? `Additional part used: ${li.reason || 'Unplanned repair'}`
            : `Actual consumption for ${booking.serviceType || 'service'}`,
      };
      newMovements.push(mv);
      persistDocFireAndForget('stockMovements', mv.id, { ...mv });
      txnCounter++;
    }

    for (const item of updatedInventory) {
      if (totalConsumedByItem.has(item.id)) {
        persistDocFireAndForget('inventory', item.id, { ...item });
      }
      if (item.isActive && item.quantityOnHand < item.minimumStock && totalConsumedByItem.has(item.id)) {
        newlyLowItems.push(item);
      }
    }

    this.inventory = updatedInventory;
    this.stockMovements = [...newMovements.reverse(), ...this.stockMovements];
    this.invoices = [newInvoice, ...this.invoices];
    persistDocFireAndForget('invoices', newInvoice.id, { ...newInvoice });

    this.garageConfig = {
      ...this.garageConfig,
      nextInvoiceSequence: this.garageConfig.nextInvoiceSequence + 1,
      updatedAt: nowIso,
    };
    persistDocFireAndForget('garageConfigs', this.garageConfig.id || 'default-garage', {
      ...this.garageConfig,
    });

    const historyItem: ServiceHistoryRecord = {
      id: `hist-${Date.now()}`,
      serviceTitle: `${booking.serviceType || booking.serviceActivities}`,
      workshopLocation: this.garageConfig.garageName,
      completedDate: new Date().toLocaleDateString('en-GB'),
      performedBy: 'Certified Garage Tech',
      odometerAtService: params.odometerReading,
      costEstimate: `${this.garageConfig.currencySymbol}${finalPayableAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      invoiceNumber,
      status: 'completed',
      notes: newInvoice.workPerformed,
    };

    const veh = this.vehicles.find((v) => v.id === booking.vehicleId);
    if (veh) {
      const updatedVeh: Vehicle = {
        ...veh,
        odometer: Math.max(veh.odometer, params.odometerReading),
        customerName: newInvoice.customerName,
        customerPhone: newInvoice.customerPhone,
        customerEmail: newInvoice.customerEmail,
        serviceHistory: [historyItem, ...veh.serviceHistory],
      };
      this.vehicles = this.vehicles.map((v) => (v.id === veh.id ? updatedVeh : v));
      persistDocFireAndForget('vehicles', veh.id, { ...updatedVeh });
    }

    const updatedBooking: ServiceBooking = {
      ...booking,
      labourCharges: labour,
      additionalServiceCharges: additionalSvc,
      discountAmount: discount,
      workPerformedDescription: newInvoice.workPerformed,
      customerName: newInvoice.customerName,
      customerPhone: newInvoice.customerPhone,
      customerEmail: newInvoice.customerEmail,
      invoiceId,
      invoiceNumber,
      invoiceStatus: 'generated',
      workflowColumn: 'service_events_to_book',
      calendarStatus: 'performed',
      badgeType: 'accepted',
      badgeDateStr: `Invoiced · ${invoiceNumber}`,
    };
    this.bookings = this.bookings.map((b) => (b.id === booking.id ? updatedBooking : b));
    persistDocFireAndForget('bookings', booking.id, { ...updatedBooking });

    const perfAlert: FleetNotification = {
      id: `alert-inv-${Date.now()}`,
      type: 'performed',
      title: 'Performed',
      message: `Invoice ${invoiceNumber} (${this.garageConfig.currencySymbol}${finalPayableAmount.toFixed(2)}) generated for ${booking.vehicleReg}. Inventory deducted.`,
      workshop: this.garageConfig.garageName,
      bookingRef: booking.bookingRef,
      timeAgo: 'Just now',
      timestamp: nowIso,
      dismissed: false,
    };
    this.notifications = [perfAlert, ...this.notifications];
    persistDocFireAndForget('notifications', perfAlert.id, { ...perfAlert });

    newlyLowItems.forEach((item) => this.pushLowStockNotificationIfNeeded(item));

    return { success: true, invoice: cloneData(newInvoice) };
  }

  updateInvoicePayment(
    invoiceId: string,
    updates: {
      paymentStatus: InvoicePaymentStatus;
      amountPaid: number;
      paymentMethod: InvoicePaymentMethod;
    }
  ): { success: boolean; invoice?: Invoice } {
    const existing = this.invoices.find((i) => i.id === invoiceId);
    if (!existing) return { success: false };

    let paid = updates.amountPaid;
    if (updates.paymentStatus === 'Paid') paid = existing.finalPayableAmount;
    else if (updates.paymentStatus === 'Unpaid') paid = 0;
    else paid = Math.min(existing.finalPayableAmount, Math.max(0, roundMoney(updates.amountPaid)));

    const updated: Invoice = {
      ...existing,
      paymentStatus: updates.paymentStatus,
      amountPaid: paid,
      paymentMethod: updates.paymentMethod,
    };
    this.invoices = this.invoices.map((i) => (i.id === invoiceId ? updated : i));
    persistDocFireAndForget('invoices', invoiceId, { ...updated });
    return { success: true, invoice: cloneData(updated) };
  }

  cancelInvoice(
    invoiceId: string,
    reason = 'Cancelled by authorized garage manager'
  ): { success: boolean; error?: string; invoice?: Invoice } {
    const inv = this.invoices.find((i) => i.id === invoiceId);
    if (!inv) return { success: false, error: 'Invoice not found.' };
    if (inv.status === 'cancelled') {
      return {
        success: false,
        error: 'Invoice is already cancelled and stock was previously restored.',
      };
    }

    const nowIso = new Date().toISOString();
    const updatedInventory = this.inventory.map((item) => ({ ...item }));
    const reversalMovements: StockMovement[] = [];
    let txnCounter = this.stockMovements.length + 1;

    for (const li of inv.lineItems) {
      const target = updatedInventory.find((i) => i.id === li.inventoryItemId);
      if (!target) continue;
      const prevQty = roundQty(target.quantityOnHand);
      const nextQty = roundQty(prevQty + li.quantity);
      target.quantityOnHand = nextQty;
      target.updatedAt = nowIso;
      persistDocFireAndForget('inventory', target.id, { ...target });

      const mv: StockMovement = {
        id: `txn-rev-${Date.now()}-${txnCounter}`,
        transactionCode: `TXN-${1000 + txnCounter}`,
        inventoryItemId: target.id,
        partName: target.partName,
        sku: target.sku,
        unit: target.unit,
        transactionType: 'invoice_reversal',
        previousQuantity: prevQty,
        quantityDelta: li.quantity,
        updatedQuantity: nextQty,
        repairJobId: inv.bookingRef,
        invoiceNumber: inv.invoiceNumber,
        timestamp: nowIso,
        performedBy: 'Garage Manager',
        remarks: `Stock restored from cancelled invoice ${inv.invoiceNumber}: ${reason}`,
      };
      reversalMovements.push(mv);
      persistDocFireAndForget('stockMovements', mv.id, { ...mv });
      txnCounter++;
    }

    this.inventory = updatedInventory;
    this.stockMovements = [...reversalMovements.reverse(), ...this.stockMovements];

    const updatedInvoice: Invoice = {
      ...inv,
      status: 'cancelled',
      cancelledAt: nowIso,
      cancelReason: reason,
    };
    this.invoices = this.invoices.map((i) => (i.id === invoiceId ? updatedInvoice : i));
    persistDocFireAndForget('invoices', invoiceId, { ...updatedInvoice });

    this.bookings = this.bookings.map((b) => {
      if (b.id !== inv.repairJobId) return b;
      const nextB: ServiceBooking = {
        ...b,
        invoiceStatus: 'cancelled',
        invoiceId: undefined,
        invoiceNumber: undefined,
        workflowColumn: 'in_progress',
        calendarStatus: 'planned',
        badgeType: 'pick_up',
        badgeDateStr: `Invoice ${inv.invoiceNumber} Cancelled`,
      };
      persistDocFireAndForget('bookings', b.id, { ...nextB });
      return nextB;
    });

    return { success: true, invoice: cloneData(updatedInvoice) };
  }

  // ==========================================================
  // NOTIFICATIONS
  // ==========================================================
  dismissNotification(id: string): void {
    this.notifications = this.notifications.map((n) => {
      if (n.id !== id) return n;
      const next = { ...n, dismissed: true };
      persistDocFireAndForget('notifications', id, { ...next });
      return next;
    });
  }

  dismissAllNotifications(): void {
    this.notifications = this.notifications.map((n) => {
      const next = { ...n, dismissed: true };
      persistDocFireAndForget('notifications', n.id, { ...next });
      return next;
    });
  }

  resetNotifications(): FleetNotification[] {
    this.notifications = cloneData(INITIAL_NOTIFICATIONS);
    this.notifications.forEach((n) => persistDocFireAndForget('notifications', n.id, { ...n }));
    return cloneData(this.notifications);
  }
}

export const fleetService = new FleetService();
