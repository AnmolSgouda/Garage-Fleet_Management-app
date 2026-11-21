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

import { pool } from '../config/database.js';
import { mapDatabaseRows } from '../db/row-mappers.js';

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

    const [
      cfgResult,
      supplierResult,
      inventoryResult,
      templateResult,
      templateMaterialResult,
      vehicleResult,
      bookingResult,
      invoiceResult,
      invoiceLineResult,
      movementResult,
      notificationResult,
    ] = await Promise.all([
      pool.query('SELECT * FROM garage_config'),
      pool.query('SELECT * FROM suppliers'),
      pool.query('SELECT * FROM inventory_items'),
      pool.query('SELECT * FROM service_templates'),
      pool.query('SELECT * FROM service_template_materials'),
      pool.query('SELECT * FROM vehicles'),
      pool.query('SELECT * FROM service_bookings'),
      pool.query('SELECT * FROM invoices'),
      pool.query('SELECT * FROM invoice_line_items'),
      pool.query(
        'SELECT * FROM stock_movements ORDER BY movement_timestamp DESC'
      ),
      pool.query(
        'SELECT * FROM notifications ORDER BY notification_timestamp DESC'
      ),
    ]);

    // Garage configuration
    const configs = mapDatabaseRows<GarageConfig>(cfgResult.rows);

    if (configs.length > 0) {
      this.garageConfig = configs[0];
    } else {
      throw new Error(
        'Garage configuration not found. Please seed the database first.'
      );
    }

    // Suppliers and inventory
    this.suppliers = mapDatabaseRows<Supplier>(supplierResult.rows);

    this.inventory = mapDatabaseRows<InventoryItem>(
      inventoryResult.rows
    );

    // Service templates and their materials
    const templates = mapDatabaseRows<ServiceTemplate>(
      templateResult.rows
    );

    const templateMaterials = mapDatabaseRows<{
      id: string;
      serviceTemplateId: string;
      inventoryItemId: string;
      partName: string;
      sku: string;
      unit: string;
      defaultQuantity: number;
    }>(templateMaterialResult.rows);

    this.serviceTemplates = templates.map((template) => ({
      ...template,
      materials: templateMaterials.filter(
        (material) =>
          material.serviceTemplateId === template.id
      ),
    }));

    // Vehicles
    this.vehicles = mapDatabaseRows<Vehicle>(
      vehicleResult.rows
    );

    // Bookings
    this.bookings = mapDatabaseRows<ServiceBooking>(
      bookingResult.rows
    );

    // Invoices and their line items
    const invoices = mapDatabaseRows<Invoice>(
      invoiceResult.rows
    );

    const invoiceLines = mapDatabaseRows<
      InvoiceLineItem & { invoiceId: string }
    >(invoiceLineResult.rows);

    this.invoices = invoices.map((invoice) => ({
      ...invoice,
      lineItems: invoiceLines
        .filter((line) => line.invoiceId === invoice.id)
        .map(({ invoiceId, ...line }) => line),
    }));

    // Stock movements
    this.stockMovements = mapDatabaseRows<StockMovement>(
      movementResult.rows
    );

    // Notifications
    this.notifications = mapDatabaseRows<FleetNotification>(
      notificationResult.rows
    );

    this.initialized = true;

    console.log('Fleet data loaded successfully from PostgreSQL.');
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

  private async pushLowStockNotificationIfNeeded(
    item: InventoryItem
  ): Promise<void> {
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
    await pool.query(
      `INSERT INTO notifications (
    id,
    type,
    title,
    message,
    workshop,
    inventory_item_id,
    time_ago,
    notification_timestamp,
    dismissed
  )
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        alert.id,
        alert.type,
        alert.title,
        alert.message,
        alert.workshop,
        alert.inventoryItemId,
        alert.timeAgo,
        alert.timestamp,
        alert.dismissed,
      ]
    );
  }

  async updateGarageConfig(
    updates: Partial<GarageConfig>
  ): Promise<GarageConfig> {
    const updated = {
      ...this.garageConfig,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    const result = await pool.query(
      `UPDATE garage_config
     SET
       garage_name = $1,
       tagline = $2,
       address = $3,
       phone = $4,
       email = $5,
       gst_number = $6,
       tax_enabled = $7,
       tax_rate_percent = $8,
       currency_symbol = $9,
       invoice_prefix = $10,
       next_invoice_sequence = $11,
       updated_at = NOW()
     WHERE id = $12
     RETURNING *`,
      [
        updated.garageName,
        updated.tagline,
        updated.address,
        updated.phone,
        updated.email,
        updated.gstNumber,
        updated.taxEnabled,
        updated.taxRatePercent,
        updated.currencySymbol,
        updated.invoicePrefix,
        updated.nextInvoiceSequence,
        updated.id || 'default-garage',
      ]
    );

    if (result.rows.length === 0) {
      throw new Error('Garage configuration not found.');
    }

    this.garageConfig = mapDatabaseRows<GarageConfig>(result.rows)[0];

    return cloneData(this.garageConfig);
  }

  // ==========================================================
  // SUPPLIERS
  // ==========================================================
  async addSupplier(
    data: Omit<Supplier, 'id' | 'createdAt' | 'isActive'>
  ): Promise<Supplier> {
    const newSupplier: Supplier = {
      ...data,
      id: `sup-${Date.now()}`,
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    const result = await pool.query(
      `INSERT INTO suppliers (
      id,
      name,
      contact_person,
      mobile,
      email,
      address,
      is_active,
      created_at,
      owner_uid
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *`,
      [
        newSupplier.id,
        newSupplier.name,
        newSupplier.contactPerson,
        newSupplier.mobile,
        newSupplier.email,
        newSupplier.address,
        newSupplier.isActive,
        newSupplier.createdAt,
        newSupplier.ownerUid ?? null,
      ]
    );

    const savedSupplier = mapDatabaseRows<Supplier>(result.rows)[0];

    this.suppliers = [savedSupplier, ...this.suppliers];

    return cloneData(savedSupplier);
  }

  async updateSupplier(
    id: string,
    updates: Partial<Supplier>
  ): Promise<{
    success: boolean;
    error?: string;
    supplier?: Supplier;
  }> {

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const existingResult = await client.query(
        'SELECT * FROM suppliers WHERE id = $1 FOR UPDATE',
        [id]
      );

      if (existingResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return { success: false, error: 'Supplier not found.' };
      }

      const existing = mapDatabaseRows<Supplier>(existingResult.rows)[0];
      const updated: Supplier = { ...existing, ...updates, id };

      const result = await client.query(
        `UPDATE suppliers
       SET name = $1,
           contact_person = $2,
           mobile = $3,
           email = $4,
           address = $5,
           is_active = $6
       WHERE id = $7
       RETURNING *`,
        [
          updated.name,
          updated.contactPerson,
          updated.mobile,
          updated.email,
          updated.address,
          updated.isActive,
          id,
        ]
      );

      const savedSupplier = mapDatabaseRows<Supplier>(result.rows)[0];

      if (updates.name) {
        await client.query(
          `UPDATE inventory_items
         SET supplier_name = $1
         WHERE supplier_id = $2`,
          [savedSupplier.name, id]
        );

        this.inventory = this.inventory.map((item) =>
          item.supplierId === id
            ? { ...item, supplierName: savedSupplier.name }
            : item
        );
      }

      await client.query('COMMIT');

      this.suppliers = this.suppliers.map((supplier) =>
        supplier.id === id ? savedSupplier : supplier
      );

      return {
        success: true,
        supplier: cloneData(savedSupplier),
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // ==========================================================
  // INVENTORY & STOCK MOVEMENTS
  // ==========================================================

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
    const cleanSku = (data.sku || '').trim().toUpperCase();

    if (!cleanSku) {
      return { success: false, error: 'SKU / Part Number is required.' };
    }

    if (!(data.partName || '').trim()) {
      return { success: false, error: 'Part Name is required.' };
    }

    const cleanSupName = (data.supplierName || '').trim();

    if (!cleanSupName) {
      return { success: false, error: 'Supplier name is required.' };
    }

    const initQty = Math.max(0, roundQty(data.initialQuantity));
    const minStock = Math.max(0, roundQty(data.minimumStock));

    const client = await pool.connect();

    let savedItem: InventoryItem;
    let savedSupplier: Supplier;
    let savedMovement: StockMovement | undefined;

    try {
      await client.query('BEGIN');

      // Check for duplicate SKU in PostgreSQL.
      const duplicate = await client.query(
        'SELECT id FROM inventory_items WHERE UPPER(sku) = $1',
        [cleanSku]
      );

      if (duplicate.rows.length > 0) {
        await client.query('ROLLBACK');
        return {
          success: false,
          error: `SKU "${cleanSku}" already exists in inventory.`,
        };
      }

      // Find supplier by name.
      const supplierResult = await client.query(
        'SELECT * FROM suppliers WHERE LOWER(name) = LOWER($1) LIMIT 1 FOR UPDATE',
        [cleanSupName]
      );

      if (supplierResult.rows.length > 0) {
        const existingSupplier = mapDatabaseRows<Supplier>(
          supplierResult.rows
        )[0];

        const supplierUpdate = await client.query(
          `UPDATE suppliers
         SET mobile = $1,
             email = $2,
             address = $3
         WHERE id = $4
         RETURNING *`,
          [
            (data.supplierMobile || '').trim() || existingSupplier.mobile,
            (data.supplierEmail || '').trim() || existingSupplier.email,
            (data.supplierAddress || '').trim() || existingSupplier.address,
            existingSupplier.id,
          ]
        );

        savedSupplier = mapDatabaseRows<Supplier>(
          supplierUpdate.rows
        )[0];
      } else {
        const newSupplier: Supplier = {
          id: `sup-${Date.now()}`,
          name: cleanSupName,
          contactPerson: data.supplierContactPerson?.trim() || cleanSupName,
          mobile: (data.supplierMobile || '').trim() || '-',
          email: (data.supplierEmail || '').trim() || '-',
          address: (data.supplierAddress || '').trim() || '-',
          isActive: true,
          createdAt: new Date().toISOString(),
        };

        const supplierInsert = await client.query(
          `INSERT INTO suppliers (
          id, name, contact_person, mobile, email,
          address, is_active, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *`,
          [
            newSupplier.id,
            newSupplier.name,
            newSupplier.contactPerson,
            newSupplier.mobile,
            newSupplier.email,
            newSupplier.address,
            newSupplier.isActive,
            newSupplier.createdAt,
          ]
        );

        savedSupplier = mapDatabaseRows<Supplier>(
          supplierInsert.rows
        )[0];
      }

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
        supplierId: savedSupplier.id,
        supplierName: savedSupplier.name,
        isActive: true,
        updatedAt: new Date().toISOString(),
      };

      const inventoryInsert = await client.query(
        `INSERT INTO inventory_items (
        id, part_name, sku, category, description, unit,
        quantity_on_hand, minimum_stock, storage_location,
        purchase_cost, selling_price, supplier_id, supplier_name,
        is_active, updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9,
        $10, $11, $12, $13, $14, $15
      )
      RETURNING *`,
        [
          newItem.id,
          newItem.partName,
          newItem.sku,
          newItem.category,
          newItem.description,
          newItem.unit,
          newItem.quantityOnHand,
          newItem.minimumStock,
          newItem.storageLocation,
          newItem.purchaseCost,
          newItem.sellingPrice,
          newItem.supplierId,
          newItem.supplierName,
          newItem.isActive,
          newItem.updatedAt,
        ]
      );

      savedItem = mapDatabaseRows<InventoryItem>(
        inventoryInsert.rows
      )[0];

      // Record opening stock movement.
      if (initQty > 0) {
        const movement: StockMovement = {
          id: `txn-${Date.now()}`,
          transactionCode: `TXN-${1000 + this.stockMovements.length + 1}`,
          inventoryItemId: savedItem.id,
          partName: savedItem.partName,
          sku: savedItem.sku,
          unit: savedItem.unit,
          transactionType: 'stock_in',
          previousQuantity: 0,
          quantityDelta: initQty,
          updatedQuantity: initQty,
          supplierId: savedSupplier.id,
          supplierName: savedSupplier.name,
          timestamp: new Date().toISOString(),
          performedBy: 'Garage Manager',
          remarks: 'Initial stock added during part catalogue registration',
        };

        await client.query(
          `INSERT INTO stock_movements (
          id, transaction_code, inventory_item_id,
          part_name, sku, unit, transaction_type,
          previous_quantity, quantity_delta, updated_quantity,
          supplier_id, supplier_name, movement_timestamp,
          performed_by, remarks
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12, $13, $14, $15
        )`,
          [
            movement.id,
            movement.transactionCode,
            movement.inventoryItemId,
            movement.partName,
            movement.sku,
            movement.unit,
            movement.transactionType,
            movement.previousQuantity,
            movement.quantityDelta,
            movement.updatedQuantity,
            movement.supplierId,
            movement.supplierName,
            movement.timestamp,
            movement.performedBy,
            movement.remarks,
          ]
        );

        savedMovement = movement;
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    // Update in-memory data only after the transaction succeeds.
    this.suppliers = [
      savedSupplier!,
      ...this.suppliers.filter((s) => s.id !== savedSupplier!.id),
    ];

    this.inventory = [savedItem!, ...this.inventory];

    if (savedMovement) {
      this.stockMovements = [
        savedMovement,
        ...this.stockMovements,
      ];
    }

    await this.pushLowStockNotificationIfNeeded(savedItem!);

    return {
      success: true,
      item: cloneData(savedItem!),
    };
  }



  async updateInventoryItem(
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
  ): Promise<{ success: boolean; error?: string; item?: InventoryItem }> {
    const client = await pool.connect();

    let savedItem: InventoryItem;

    try {
      await client.query('BEGIN');

      const existingResult = await client.query(
        'SELECT * FROM inventory_items WHERE id = $1 FOR UPDATE',
        [id]
      );

      if (existingResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return { success: false, error: 'Inventory item not found.' };
      }

      const existing = mapDatabaseRows<InventoryItem>(
        existingResult.rows
      )[0];

      const cleanUpdates = { ...updates };

      if (cleanUpdates.sku !== undefined) {
        const cleanSku = cleanUpdates.sku.trim().toUpperCase();

        if (!cleanSku) {
          await client.query('ROLLBACK');
          return { success: false, error: 'SKU / Part Number is required.' };
        }

        const duplicate = await client.query(
          'SELECT id FROM inventory_items WHERE UPPER(sku) = $1 AND id <> $2',
          [cleanSku, id]
        );

        if (duplicate.rows.length > 0) {
          await client.query('ROLLBACK');
          return {
            success: false,
            error: `SKU "${cleanSku}" is already assigned to another part.`,
          };
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

      const result = await client.query(
        `UPDATE inventory_items
       SET part_name = $1,
           sku = $2,
           category = $3,
           description = $4,
           unit = $5,
           minimum_stock = $6,
           purchase_cost = $7,
           selling_price = $8,
           storage_location = $9,
           supplier_id = $10,
           supplier_name = $11,
           updated_at = NOW()
       WHERE id = $12
       RETURNING *`,
        [
          updatedItem.partName,
          updatedItem.sku,
          updatedItem.category,
          updatedItem.description,
          updatedItem.unit,
          updatedItem.minimumStock,
          updatedItem.purchaseCost,
          updatedItem.sellingPrice,
          updatedItem.storageLocation,
          updatedItem.supplierId || null,
          updatedItem.supplierName,
          id,
        ]
      );

      savedItem = mapDatabaseRows<InventoryItem>(result.rows)[0];

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    this.inventory = this.inventory.map((item) =>
      item.id === id ? savedItem! : item
    );

    await this.pushLowStockNotificationIfNeeded(savedItem!);

    return {
      success: true,
      item: cloneData(savedItem!),
    };
  }
  async toggleInventoryItemActive(
    id: string
  ): Promise<{ success: boolean; error?: string; item?: InventoryItem }> {
    const result = await pool.query(
      `UPDATE inventory_items
       SET is_active = NOT is_active,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return { success: false, error: 'Inventory item not found.' };
    }

    const updatedItem = mapDatabaseRows<InventoryItem>(result.rows)[0];

    this.inventory = this.inventory.map((item) =>
      item.id === id ? updatedItem : item
    );

    return {
      success: true,
      item: cloneData(updatedItem),
    };
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
    performedBy?: string;
  }): Promise<{
    success: boolean;
    error?: string;
    item?: InventoryItem;
    movement?: StockMovement;
  }> {
    const client = await pool.connect();

    let savedItem: InventoryItem;
    let movement: StockMovement;

    try {
      await client.query('BEGIN');

      const itemResult = await client.query(
        'SELECT * FROM inventory_items WHERE id = $1 FOR UPDATE',
        [params.inventoryItemId]
      );

      if (itemResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return { success: false, error: 'Inventory item not found.' };
      }

      const item = mapDatabaseRows<InventoryItem>(itemResult.rows)[0];

      const val = roundQty(params.value);
      const prevQty = roundQty(item.quantityOnHand);
      let delta = 0;
      let nextQty = prevQty;

      if (params.mode === 'set') {
        if (val < 0) {
          await client.query('ROLLBACK');
          return { success: false, error: 'Stock quantity cannot be negative.' };
        }

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
        await client.query('ROLLBACK');
        return {
          success: false,
          error: `Insufficient quantity on hand (${prevQty} ${item.unit}). Resulting stock cannot be negative.`,
        };
      }

      if (delta === 0) {
        await client.query('ROLLBACK');
        return { success: false, error: 'Quantity adjustment cannot be zero.' };
      }

      const updatedResult = await client.query(
        `UPDATE inventory_items
         SET quantity_on_hand = $1,
             updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [nextQty, item.id]
      );

      savedItem = mapDatabaseRows<InventoryItem>(updatedResult.rows)[0];

      movement = {
        id: `txn-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        transactionCode: `TXN-${Date.now()}`,
        inventoryItemId: item.id,
        partName: item.partName,
        sku: item.sku,
        unit: item.unit,
        transactionType: params.transactionType,
        previousQuantity: prevQty,
        quantityDelta: delta,
        updatedQuantity: nextQty,
        supplierId:
          params.transactionType === 'stock_in' ||
            params.transactionType === 'purchase_return'
            ? item.supplierId
            : undefined,
        supplierName:
          params.transactionType === 'stock_in' ||
            params.transactionType === 'purchase_return'
            ? item.supplierName
            : undefined,
        timestamp: new Date().toISOString(),
        performedBy: params.performedBy || 'Garage Manager',
        remarks: (params.remarks || '').trim() || 'Stock updated',
      };

      await client.query(
        `INSERT INTO stock_movements (
          id, transaction_code, inventory_item_id,
          part_name, sku, unit, transaction_type,
          previous_quantity, quantity_delta, updated_quantity,
          supplier_id, supplier_name, movement_timestamp,
          performed_by, remarks
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12, $13, $14, $15
        )`,
        [
          movement.id,
          movement.transactionCode,
          movement.inventoryItemId,
          movement.partName,
          movement.sku,
          movement.unit,
          movement.transactionType,
          movement.previousQuantity,
          movement.quantityDelta,
          movement.updatedQuantity,
          movement.supplierId || null,
          movement.supplierName || null,
          movement.timestamp,
          movement.performedBy,
          movement.remarks,
        ]
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    this.inventory = this.inventory.map((i) =>
      i.id === savedItem.id ? savedItem : i
    );

    this.stockMovements = [movement, ...this.stockMovements];

    if (savedItem.quantityOnHand < savedItem.minimumStock) {
      await this.pushLowStockNotificationIfNeeded(savedItem);
    }

    return {
      success: true,
      item: cloneData(savedItem),
      movement: cloneData(movement),
    };
  }
  async createServiceTemplate(
    tpl: Omit<ServiceTemplate, 'id' | 'isCustom'>
  ): Promise<ServiceTemplate> {
    const client = await pool.connect();

    const newTpl: ServiceTemplate = {
      ...tpl,
      id: `tpl-${Date.now()}`,
      isCustom: true,
    };

    try {
      await client.query('BEGIN');

      await client.query(
        `INSERT INTO service_templates (
          id, name, description, default_labour_charge, is_custom, owner_uid
        )
        VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          newTpl.id,
          newTpl.name,
          newTpl.description || '',
          newTpl.defaultLabourCharge,
          newTpl.isCustom,
          newTpl.ownerUid || null,
        ]
      );

      for (const material of newTpl.materials || []) {
        await client.query(
          `INSERT INTO service_template_materials (
            id, service_template_id, inventory_item_id,
            part_name, sku, unit, default_quantity
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            material.id,
            newTpl.id,
            material.inventoryItemId,
            material.partName,
            material.sku,
            material.unit,
            material.defaultQuantity,
          ]
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    this.serviceTemplates = [...this.serviceTemplates, newTpl];

    return cloneData(newTpl);
  }

  async updateServiceTemplate(
    id: string,
    updates: Partial<ServiceTemplate>
  ): Promise<ServiceTemplate | null> {
    const client = await pool.connect();
    let updated: ServiceTemplate;

    try {
      await client.query('BEGIN');

      const existingResult = await client.query(
        `SELECT * FROM service_templates
         WHERE id = $1 FOR UPDATE`,
        [id]
      );

      if (existingResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return null;
      }

      const existingRow = mapDatabaseRows<ServiceTemplate>(
        existingResult.rows
      )[0];

      const existing: ServiceTemplate = {
        ...existingRow,
        materials:
          this.serviceTemplates.find((template) => template.id === id)?.materials || [],
      };
      const merged: ServiceTemplate = {
        ...existing,
        ...updates,
        id,
        materials: updates.materials ?? existing.materials,
      };

      await client.query(
        `UPDATE service_templates
         SET name = $1,
             description = $2,
             default_labour_charge = $3,
             is_custom = $4,
             owner_uid = $5,
             updated_at = NOW()
         WHERE id = $6`,
        [
          merged.name,
          merged.description || '',
          merged.defaultLabourCharge,
          merged.isCustom,
          merged.ownerUid || null,
          id,
        ]
      );

      if (updates.materials !== undefined) {
        await client.query(
          'DELETE FROM service_template_materials WHERE service_template_id = $1',
          [id]
        );

        for (const material of merged.materials) {
          await client.query(
            `INSERT INTO service_template_materials (
              id, service_template_id, inventory_item_id,
              part_name, sku, unit, default_quantity
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              material.id,
              id,
              material.inventoryItemId,
              material.partName,
              material.sku,
              material.unit,
              material.defaultQuantity,
            ]
          );
        }
      }

      await client.query('COMMIT');
      updated = merged;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    this.serviceTemplates = this.serviceTemplates.map((template) =>
      template.id === id ? updated : template
    );

    return cloneData(updated);
  }

  // ==========================================================
  // VEHICLES
  // ==========================================================
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
  }): Promise<{
    success: boolean;
    error?: string;
    vehicleId?: string;
    vehicle?: Vehicle;
  }> {
    const trimmedReg = (data.registrationNumber || '').trim().toUpperCase();

    if (!trimmedReg) {
      return { success: false, error: 'Registration number is required.' };
    }

    const meta =
      VEHICLE_CATEGORY_META[data.category] ||
      VEHICLE_CATEGORY_META.container_truck;

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

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const duplicate = await client.query(
        `SELECT id FROM vehicles
         WHERE LOWER(registration_number) = LOWER($1)
         LIMIT 1`,
        [trimmedReg]
      );

      if (duplicate.rows.length > 0) {
        await client.query('ROLLBACK');
        return {
          success: false,
          error: `Vehicle with registration ${trimmedReg} is already registered in the fleet.`,
        };
      }

      await client.query(
        `INSERT INTO vehicles (
          id, registration_number, manufacturer, model,
          manufacturing_year, equipment_group, category,
          category_label, image_path, odometer,
          engine_running_hours, maintenance_plan,
          next_service_date, assigned_garage, customer_name,
          customer_phone, customer_email, other_service_activities,
          notes, maintenance_checklist, repair_checklist,
          service_history
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12, $13, $14,
          $15, $16, $17, $18, $19, $20::jsonb,
          $21::jsonb, $22::jsonb
        )`,
        [
          newVehicle.id,
          newVehicle.registrationNumber,
          newVehicle.manufacturer,
          newVehicle.model,
          newVehicle.manufacturingYear,
          newVehicle.equipmentGroup,
          newVehicle.category,
          newVehicle.categoryLabel,
          newVehicle.imagePath,
          newVehicle.odometer,
          newVehicle.engineRunningHours,
          newVehicle.maintenancePlan,
          newVehicle.nextServiceDate,
          newVehicle.assignedGarage,
          newVehicle.customerName,
          newVehicle.customerPhone,
          newVehicle.customerEmail,
          newVehicle.otherServiceActivities,
          newVehicle.notes,
          JSON.stringify(newVehicle.maintenanceChecklist),
          JSON.stringify(newVehicle.repairChecklist),
          JSON.stringify(newVehicle.serviceHistory),
        ]
      );

      await client.query(
        `INSERT INTO notifications (
          id, type, title, message, workshop,
          time_ago, notification_timestamp, dismissed
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          newAlert.id,
          newAlert.type,
          newAlert.title,
          newAlert.message,
          newAlert.workshop,
          newAlert.timeAgo,
          newAlert.timestamp,
          newAlert.dismissed,
        ]
      );

      await client.query('COMMIT');
    } catch (error: any) {
      await client.query('ROLLBACK');

      if (error.code === '23505') {
        return {
          success: false,
          error: `Vehicle with registration ${trimmedReg} is already registered in the fleet.`,
        };
      }

      throw error;
    } finally {
      client.release();
    }

    this.vehicles = [newVehicle, ...this.vehicles];
    this.notifications = [newAlert, ...this.notifications];

    return {
      success: true,
      vehicleId: newVehId,
      vehicle: cloneData(newVehicle),
    };
  }
  async addUnplannedActivity(
    vehicleId: string,
    name: string
  ): Promise<MaintenanceItem | null> {
    const client = await pool.connect();
    let updatedVehicle: Vehicle;
    let newItem: MaintenanceItem;

    try {
      await client.query('BEGIN');

      const result = await client.query(
        `SELECT * FROM vehicles WHERE id = $1 FOR UPDATE`,
        [vehicleId]
      );

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return null;
      }

      const vehicle = mapDatabaseRows<Vehicle>(result.rows)[0];

      newItem = {
        id: `m-unplanned-${Date.now()}`,
        name: name.trim(),
        status: 'due',
        dueDate: 'Scheduled Next Bay',
        required: false,
      };

      updatedVehicle = {
        ...vehicle,
        maintenanceChecklist: [
          ...(vehicle.maintenanceChecklist || []),
          newItem,
        ],
      };

      await client.query(
        `UPDATE vehicles
         SET maintenance_checklist = $1::jsonb,
             updated_at = NOW()
         WHERE id = $2`,
        [
          JSON.stringify(updatedVehicle.maintenanceChecklist),
          vehicleId,
        ]
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    this.vehicles = this.vehicles.map((v) =>
      v.id === vehicleId ? updatedVehicle : v
    );

    return newItem;
  }

  async addUnplannedRepair(
    vehicleId: string,
    issue: string,
    severity: 'major' | 'minor' | 'critical'
  ): Promise<RepairItem | null> {
    const client = await pool.connect();
    let updatedVehicle: Vehicle;
    let newItem: RepairItem;

    try {
      await client.query('BEGIN');

      const result = await client.query(
        `SELECT * FROM vehicles WHERE id = $1 FOR UPDATE`,
        [vehicleId]
      );

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return null;
      }

      const vehicle = mapDatabaseRows<Vehicle>(result.rows)[0];

      const now = new Date();

      newItem = {
        id: `r-unplanned-${Date.now()}`,
        issue: issue.trim(),
        severity,
        reportedDate: now.toLocaleDateString('en-GB'),
        reportedTime: now.toTimeString().slice(0, 5),
        resolved: false,
      };

      updatedVehicle = {
        ...vehicle,
        repairChecklist: [
          ...(vehicle.repairChecklist || []),
          newItem,
        ],
      };

      await client.query(
        `UPDATE vehicles
       SET repair_checklist = $1::jsonb,
           updated_at = NOW()
       WHERE id = $2`,
        [
          JSON.stringify(updatedVehicle.repairChecklist),
          vehicleId,
        ]
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    this.vehicles = this.vehicles.map((v) =>
      v.id === vehicleId ? updatedVehicle : v
    );

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

  async createBooking(
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
  ): Promise<{ success: boolean; error?: string; booking?: ServiceBooking }> {
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

    const veh = this.vehicles.find(
      (v) => v.id === newBookingData.vehicleId
    );

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

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      await client.query(
        `INSERT INTO service_bookings (
        id, booking_ref, vehicle_id, vehicle_reg, vehicle_category,
        vehicle_model, equipment_group, title, service_type,
        service_activities, workshop_location, workflow_column,
        calendar_status, booking_date, start_time, end_time,
        badge_type, badge_date_str, is_priority, notes,
        customer_name, customer_phone, customer_email,
        estimated_materials, actual_materials, additional_materials,
        labour_charges, additional_service_charges, discount_amount,
        work_performed_description, invoice_id, invoice_number,
        invoice_status, owner_uid
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
        $21, $22, $23, $24::jsonb, $25::jsonb, $26::jsonb,
        $27, $28, $29, $30, $31, $32, $33, $34
      )`,
        [
          newBooking.id,
          newBooking.bookingRef,
          newBooking.vehicleId,
          newBooking.vehicleReg,
          newBooking.vehicleCategory || '',
          newBooking.vehicleModel || '',
          newBooking.equipmentGroup || '',
          newBooking.title || '',
          newBooking.serviceType || '',
          newBooking.serviceActivities || '',
          newBooking.workshopLocation,
          newBooking.workflowColumn,
          newBooking.calendarStatus,
          newBooking.date,
          newBooking.startTime,
          newBooking.endTime,
          newBooking.badgeType,
          newBooking.badgeDateStr,
          newBooking.isPriority ?? false,
          newBooking.notes ?? null,
          newBooking.customerName,
          newBooking.customerPhone,
          newBooking.customerEmail,
          JSON.stringify(newBooking.estimatedMaterials),
          JSON.stringify(newBooking.actualMaterials),
          JSON.stringify(newBooking.additionalMaterials),
          newBooking.labourCharges,
          newBooking.additionalServiceCharges,
          newBooking.discountAmount,
          null,
          null,
          null,
          newBooking.invoiceStatus,
          null,
        ]
      );

      await client.query(
        `INSERT INTO notifications (
        id, type, title, message, workshop, booking_ref,
        inventory_item_id, time_ago, notification_timestamp,
        dismissed, owner_uid
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
      )`,
        [
          newAlert.id,
          newAlert.type,
          newAlert.title,
          newAlert.message,
          newAlert.workshop,
          newAlert.bookingRef,
          null,
          newAlert.timeAgo,
          newAlert.timestamp,
          newAlert.dismissed,
          null,
        ]
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    this.bookings = [newBooking, ...this.bookings];
    this.notifications = [newAlert, ...this.notifications];

    return {
      success: true,
      booking: cloneData(newBooking),
    };
  }

  async updateBooking(
    updatedBooking: ServiceBooking
  ): Promise<{ success: boolean; error?: string; booking?: ServiceBooking }> {
    const existing = this.bookings.find(
      (b) => b.id === updatedBooking.id
    );

    if (!existing) {
      return { success: false, error: 'Booking not found.' };
    }

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

    const newAlert: FleetNotification | null =
      updatedBooking.calendarStatus === 'confirmed' &&
        existing.calendarStatus !== 'confirmed'
        ? {
          id: `alert-${Date.now()}`,
          type: 'confirmed',
          title: 'Confirmed booking',
          message: `Slot confirmed for ${updatedBooking.vehicleReg} (${updatedBooking.date} ${updatedBooking.startTime}-${updatedBooking.endTime}). Moved to Confirmed Bookings.`,
          workshop: this.garageConfig.garageName,
          bookingRef: updatedBooking.bookingRef,
          timeAgo: 'Just now',
          timestamp: new Date().toISOString(),
          dismissed: false,
        }
        : null;

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const result = await client.query(
        `UPDATE service_bookings SET
        vehicle_id = $1,
        vehicle_reg = $2,
        vehicle_category = $3,
        vehicle_model = $4,
        equipment_group = $5,
        title = $6,
        service_type = $7,
        service_activities = $8,
        workshop_location = $9,
        workflow_column = $10,
        calendar_status = $11,
        booking_date = $12,
        start_time = $13,
        end_time = $14,
        badge_type = $15,
        badge_date_str = $16,
        is_priority = $17,
        notes = $18,
        customer_name = $19,
        customer_phone = $20,
        customer_email = $21,
        estimated_materials = $22::jsonb,
        actual_materials = $23::jsonb,
        additional_materials = $24::jsonb,
        labour_charges = $25,
        additional_service_charges = $26,
        discount_amount = $27,
        work_performed_description = $28,
        invoice_id = $29,
        invoice_number = $30,
        invoice_status = $31,
        owner_uid = $32,
        updated_at = NOW()
       WHERE id = $33
       RETURNING id`,
        [
          updatedBooking.vehicleId,
          updatedBooking.vehicleReg,
          updatedBooking.vehicleCategory || '',
          updatedBooking.vehicleModel || '',
          updatedBooking.equipmentGroup || '',
          updatedBooking.title || '',
          updatedBooking.serviceType || '',
          updatedBooking.serviceActivities || '',
          updatedBooking.workshopLocation || '',
          updatedBooking.workflowColumn,
          updatedBooking.calendarStatus,
          updatedBooking.date,
          updatedBooking.startTime,
          updatedBooking.endTime,
          updatedBooking.badgeType,
          updatedBooking.badgeDateStr || '',
          updatedBooking.isPriority ?? false,
          updatedBooking.notes ?? null,
          updatedBooking.customerName ?? null,
          updatedBooking.customerPhone ?? null,
          updatedBooking.customerEmail ?? null,
          JSON.stringify(updatedBooking.estimatedMaterials || []),
          JSON.stringify(updatedBooking.actualMaterials || []),
          JSON.stringify(updatedBooking.additionalMaterials || []),
          updatedBooking.labourCharges ?? 0,
          updatedBooking.additionalServiceCharges ?? 0,
          updatedBooking.discountAmount ?? 0,
          updatedBooking.workPerformedDescription ?? null,
          updatedBooking.invoiceId ?? null,
          updatedBooking.invoiceNumber ?? null,
          updatedBooking.invoiceStatus,
          null,
          updatedBooking.id,
        ]
      );

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return { success: false, error: 'Booking not found.' };
      }

      if (newAlert) {
        await client.query(
          `INSERT INTO notifications (
          id, type, title, message, workshop, booking_ref,
          time_ago, notification_timestamp, dismissed
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            newAlert.id,
            newAlert.type,
            newAlert.title,
            newAlert.message,
            newAlert.workshop,
            newAlert.bookingRef,
            newAlert.timeAgo,
            newAlert.timestamp,
            newAlert.dismissed,
          ]
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    this.bookings = this.bookings.map((b) =>
      b.id === updatedBooking.id ? updatedBooking : b
    );

    if (newAlert) {
      this.notifications = [newAlert, ...this.notifications];
    }

    return {
      success: true,
      booking: cloneData(updatedBooking),
    };
  }

  async cancelBooking(bookingId: string): Promise<{ success: boolean }> {
    const booking = this.bookings.find((b) => b.id === bookingId);
    if (!booking) return { success: false };

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

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const result = await client.query(
        `DELETE FROM service_bookings
       WHERE id = $1
       RETURNING id`,
        [bookingId]
      );

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return { success: false };
      }

      await client.query(
        `INSERT INTO notifications (
        id, type, title, message, workshop, booking_ref,
        time_ago, notification_timestamp, dismissed
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          newAlert.id,
          newAlert.type,
          newAlert.title,
          newAlert.message,
          newAlert.workshop,
          newAlert.bookingRef,
          newAlert.timeAgo,
          newAlert.timestamp,
          newAlert.dismissed,
        ]
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    this.bookings = this.bookings.filter((b) => b.id !== bookingId);
    this.notifications = [newAlert, ...this.notifications];

    return { success: true };
  }

  async approvePreliminaryBooking(
    bookingId: string
  ): Promise<ServiceBooking | null> {
    const existing = this.bookings.find((b) => b.id === bookingId);
    if (!existing) return null;

    const updated: ServiceBooking = {
      ...existing,
      workflowColumn: 'confirmed_bookings',
      calendarStatus: 'confirmed',
      badgeType: 'drop_off',
      badgeDateStr: 'Ready for Drop off',
    };

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

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const result = await client.query(
        `UPDATE service_bookings
       SET workflow_column = $1,
           calendar_status = $2,
           badge_type = $3,
           badge_date_str = $4,
           updated_at = NOW()
       WHERE id = $5
       RETURNING id`,
        [
          updated.workflowColumn,
          updated.calendarStatus,
          updated.badgeType,
          updated.badgeDateStr,
          bookingId,
        ]
      );

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return null;
      }

      await client.query(
        `INSERT INTO notifications (
        id, type, title, message, workshop, booking_ref,
        time_ago, notification_timestamp, dismissed
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          newAlert.id,
          newAlert.type,
          newAlert.title,
          newAlert.message,
          newAlert.workshop,
          newAlert.bookingRef,
          newAlert.timeAgo,
          newAlert.timestamp,
          newAlert.dismissed,
        ]
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    this.bookings = this.bookings.map((b) =>
      b.id === bookingId ? updated : b
    );

    this.notifications = [newAlert, ...this.notifications];

    return cloneData(updated);
  }

  async rejectPreliminaryBooking(
    bookingId: string
  ): Promise<ServiceBooking | null> {
    const existing = this.bookings.find((b) => b.id === bookingId);
    if (!existing) return null;

    const updated: ServiceBooking = {
      ...existing,
      workflowColumn: 'service_events_to_book',
      calendarStatus: 'delayed',
      badgeType: 'delayed',
      badgeDateStr: 'Rejected - Reschedule Required',
    };

    const result = await pool.query(
      `UPDATE service_bookings
     SET workflow_column = $1,
         calendar_status = $2,
         badge_type = $3,
         badge_date_str = $4,
         updated_at = NOW()
     WHERE id = $5
     RETURNING id`,
      [
        updated.workflowColumn,
        updated.calendarStatus,
        updated.badgeType,
        updated.badgeDateStr,
        bookingId,
      ]
    );

    if (result.rows.length === 0) {
      return null;
    }

    this.bookings = this.bookings.map((b) =>
      b.id === bookingId ? updated : b
    );

    return cloneData(updated);
  }

  async startConfirmedBooking(
    bookingId: string
  ): Promise<ServiceBooking | null> {
    const existing = this.bookings.find((b) => b.id === bookingId);
    if (!existing) return null;

    const updated: ServiceBooking = {
      ...existing,
      workflowColumn: 'in_progress',
      calendarStatus: 'planned',
      badgeType: 'pick_up',
      badgeDateStr: 'In Bay - Service Active',
    };

    const result = await pool.query(
      `UPDATE service_bookings
     SET workflow_column = $1,
         calendar_status = $2,
         badge_type = $3,
         badge_date_str = $4,
         updated_at = NOW()
     WHERE id = $5
     RETURNING id`,
      [
        updated.workflowColumn,
        updated.calendarStatus,
        updated.badgeType,
        updated.badgeDateStr,
        bookingId,
      ]
    );

    if (result.rows.length === 0) {
      return null;
    }

    this.bookings = this.bookings.map((b) =>
      b.id === bookingId ? updated : b
    );

    return cloneData(updated);
  }


  async completeInProgressBooking(
    bookingId: string,
    technicianNotes = 'Service completed according to garage inspection guidelines.',
    invoiceNumber?: string,
    invoiceTotalStr?: string
  ): Promise<ServiceBooking | null> {
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
        invoiceTotalStr ||
        `${this.garageConfig.currencySymbol} ${booking.labourCharges.toFixed(2)}`,
      invoiceNumber,
      status: 'completed',
      notes: technicianNotes,
    };

    const updatedBooking: ServiceBooking = {
      ...booking,
      workflowColumn: 'service_events_to_book',
      calendarStatus: 'performed',
      badgeType: 'accepted',
      badgeDateStr: invoiceNumber
        ? `Invoiced (${invoiceNumber})`
        : 'Completed - Ready for Invoice',
    };

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
    let updatedVehCache: Vehicle | null = null;
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Update booking in PostgreSQL
      const bookingResult = await client.query(
        `UPDATE service_bookings
       SET workflow_column = $1,
           calendar_status = $2,
           badge_type = $3,
           badge_date_str = $4,
           updated_at = NOW()
       WHERE id = $5
       RETURNING id`,
        [
          updatedBooking.workflowColumn,
          updatedBooking.calendarStatus,
          updatedBooking.badgeType,
          updatedBooking.badgeDateStr,
          bookingId,
        ]
      );

      if (bookingResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return null;
      }

      // Update vehicle service history if vehicle exists
      if (veh) {
        const vehicleResult = await client.query(
          `UPDATE vehicles
     SET service_history = $1::jsonb || service_history,
         next_service_date = $2,
         updated_at = NOW()
     WHERE id = $3
     RETURNING id`,
          [
            JSON.stringify([historyItem]),
            '24/12/2026',
            veh.id,
          ]
        );

        if (vehicleResult.rows.length > 0) {
          updatedVehCache = {
            ...veh,
            serviceHistory: [historyItem, ...veh.serviceHistory],
            nextServiceDate: '24/12/2026',
          };
        }
      }

      // Insert completion notification
      await client.query(
        `INSERT INTO notifications (
        id, type, title, message, workshop, booking_ref,
        time_ago, notification_timestamp, dismissed
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          newAlert.id,
          newAlert.type,
          newAlert.title,
          newAlert.message,
          newAlert.workshop,
          newAlert.bookingRef,
          newAlert.timeAgo,
          newAlert.timestamp,
          newAlert.dismissed,
        ]
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    // Update in-memory booking cache after successful database transaction
    if (updatedVehCache) {
      this.vehicles = this.vehicles.map((v) =>
        v.id === updatedVehCache!.id ? updatedVehCache! : v
      );
    }
    this.bookings = this.bookings.map((b) =>
      b.id === bookingId ? updatedBooking : b
    );

    this.notifications = [newAlert, ...this.notifications];

    return cloneData(updatedBooking);
  }


  // ==========================================================
  // REPAIR JOB CONSUMPTION MUTATORS (ZERO STOCK DEDUCTION)
  // ==========================================================
  async updateJobActualMaterialQty(
    bookingId: string,
    actualLineId: string,
    actualQuantity: number
  ): Promise<{ success: boolean; error?: string; booking?: ServiceBooking }> {
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

    const result = await pool.query(
      `UPDATE service_bookings
     SET actual_materials = $1::jsonb,
         updated_at = NOW()
     WHERE id = $2
       AND invoice_status <> 'generated'
     RETURNING id`,
      [JSON.stringify(updated.actualMaterials), bookingId]
    );

    if (result.rows.length === 0) {
      return {
        success: false,
        error: 'Repair job not found or materials locked after invoice generation.',
      };
    }

    this.bookings = this.bookings.map((item) =>
      item.id === bookingId ? updated : item
    );

    return { success: true, booking: cloneData(updated) };
  }


  async addJobAdditionalMaterial(
    bookingId: string,
    payload: {
      inventoryItemId: string;
      quantity: number;
      unitPrice?: number;
      reason: string;
    }
  ): Promise<{ success: boolean; error?: string; booking?: ServiceBooking }> {
    const booking = this.bookings.find((b) => b.id === bookingId);

    if (!booking) {
      return { success: false, error: 'Repair job not found.' };
    }

    if (booking.invoiceStatus === 'generated') {
      return {
        success: false,
        error: 'Cannot modify materials after invoice is generated.',
      };
    }

    const invItem = this.inventory.find(
      (i) => i.id === payload.inventoryItemId
    );

    if (!invItem) {
      return {
        success: false,
        error: 'Selected spare part not found in inventory.',
      };
    }

    const qty = roundQty(payload.quantity);

    if (qty <= 0) {
      return { success: false, error: 'Quantity must be greater than zero.' };
    }

    const price =
      payload.unitPrice !== undefined
        ? roundMoney(payload.unitPrice)
        : invItem.sellingPrice;

    const newLine: JobAdditionalMaterialLine = {
      id: `add-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      inventoryItemId: invItem.id,
      partName: invItem.partName,
      sku: invItem.sku,
      unit: invItem.unit,
      quantity: qty,
      unitPrice: price,
      reason:
        (payload.reason || '').trim() ||
        'Additional repair requirement found during inspection',
    };

    const updated: ServiceBooking = {
      ...booking,
      additionalMaterials: [...booking.additionalMaterials, newLine],
    };

    const result = await pool.query(
      `UPDATE service_bookings
     SET additional_materials = $1::jsonb,
         updated_at = NOW()
     WHERE id = $2
       AND invoice_status <> 'generated'
     RETURNING id`,
      [JSON.stringify(updated.additionalMaterials), bookingId]
    );

    if (result.rows.length === 0) {
      return {
        success: false,
        error: 'Repair job not found or materials locked after invoice generation.',
      };
    }

    this.bookings = this.bookings.map((b) =>
      b.id === bookingId ? updated : b
    );

    return { success: true, booking: cloneData(updated) };
  }



  async updateJobAdditionalMaterial(
    bookingId: string,
    lineId: string,
    updates: Partial<
      Pick<JobAdditionalMaterialLine, 'quantity' | 'unitPrice' | 'reason'>
    >
  ): Promise<{ success: boolean; error?: string; booking?: ServiceBooking }> {
    const b = this.bookings.find((item) => item.id === bookingId);

    if (!b) {
      return { success: false, error: 'Repair job not found.' };
    }

    if (b.invoiceStatus === 'generated') {
      return {
        success: false,
        error: 'Cannot modify materials after invoice is generated.',
      };
    }

    const updated: ServiceBooking = {
      ...b,
      additionalMaterials: b.additionalMaterials.map((m) =>
        m.id === lineId
          ? {
            ...m,
            quantity:
              updates.quantity !== undefined
                ? Math.max(0, roundQty(updates.quantity))
                : m.quantity,
            unitPrice:
              updates.unitPrice !== undefined
                ? Math.max(0, roundMoney(updates.unitPrice))
                : m.unitPrice,
            reason:
              updates.reason !== undefined ? updates.reason : m.reason,
          }
          : m
      ),
    };

    const result = await pool.query(
      `UPDATE service_bookings
     SET additional_materials = $1::jsonb,
         updated_at = NOW()
     WHERE id = $2
       AND invoice_status <> 'generated'
     RETURNING id`,
      [JSON.stringify(updated.additionalMaterials), bookingId]
    );

    if (result.rows.length === 0) {
      return {
        success: false,
        error: 'Repair job not found or materials locked after invoice generation.',
      };
    }

    this.bookings = this.bookings.map((item) =>
      item.id === bookingId ? updated : item
    );

    return { success: true, booking: cloneData(updated) };
  }



  async removeJobAdditionalMaterial(
    bookingId: string,
    lineId: string
  ): Promise<{ success: boolean; error?: string; booking?: ServiceBooking }> {
    const b = this.bookings.find((item) => item.id === bookingId);

    if (!b) {
      return { success: false, error: 'Repair job not found.' };
    }

    if (b.invoiceStatus === 'generated') {
      return {
        success: false,
        error: 'Cannot modify materials after invoice is generated.',
      };
    }

    const updated: ServiceBooking = {
      ...b,
      additionalMaterials: b.additionalMaterials.filter(
        (m) => m.id !== lineId
      ),
    };

    const result = await pool.query(
      `UPDATE service_bookings
     SET additional_materials = $1::jsonb,
         updated_at = NOW()
     WHERE id = $2
       AND invoice_status <> 'generated'
     RETURNING id`,
      [JSON.stringify(updated.additionalMaterials), bookingId]
    );

    if (result.rows.length === 0) {
      return {
        success: false,
        error: 'Repair job not found or materials locked after invoice generation.',
      };
    }

    this.bookings = this.bookings.map((item) =>
      item.id === bookingId ? updated : item
    );

    return { success: true, booking: cloneData(updated) };
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
  ): Promise<{ success: boolean; error?: string; booking?: ServiceBooking }> {
    const b = this.bookings.find((item) => item.id === bookingId);

    if (!b) {
      return { success: false, error: 'Repair job not found.' };
    }

    if (b.invoiceStatus === 'generated') {
      return {
        success: false,
        error: 'Cannot edit job charges after invoice is generated.',
      };
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

    const result = await pool.query(
      `UPDATE service_bookings
     SET labour_charges = $1,
         additional_service_charges = $2,
         discount_amount = $3,
         work_performed_description = $4,
         customer_name = $5,
         customer_phone = $6,
         customer_email = $7,
         updated_at = NOW()
     WHERE id = $8
       AND invoice_status <> 'generated'
     RETURNING id`,
      [
        updated.labourCharges,
        updated.additionalServiceCharges,
        updated.discountAmount,
        updated.workPerformedDescription ?? null,
        updated.customerName ?? null,
        updated.customerPhone ?? null,
        updated.customerEmail ?? null,
        bookingId,
      ]
    );

    if (result.rows.length === 0) {
      return {
        success: false,
        error: 'Repair job not found or charges locked after invoice generation.',
      };
    }

    this.bookings = this.bookings.map((item) =>
      item.id === bookingId ? updated : item
    );

    return { success: true, booking: cloneData(updated) };
  }

  // ==========================================================
  // INVOICE GENERATION (ATOMIC STOCK DEDUCTION + IDEMPOTENCY)
  // ==========================================================

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
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 1. Lock and retrieve the booking.
      const bookingResult = await client.query(
        'SELECT * FROM service_bookings WHERE id = $1 FOR UPDATE',
        [params.bookingId]
      );

      if (bookingResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return { success: false, error: 'Repair job not found.' };
      }

      const booking = mapDatabaseRows<ServiceBooking>(
        bookingResult.rows
      )[0];

      // 2. Prevent duplicate invoice generation.
      const existingInvoiceResult = await client.query(
        `SELECT invoice_number
         FROM invoices
         WHERE repair_job_id = $1 AND status = 'active'
         LIMIT 1`,
        [booking.id]
      );

      if (
        existingInvoiceResult.rows.length > 0 ||
        booking.invoiceStatus === 'generated'
      ) {
        await client.query('ROLLBACK');

        const existingNumber =
          existingInvoiceResult.rows[0]?.invoice_number ||
          booking.invoiceNumber;

        return {
          success: false,
          error: `Invoice ${existingNumber || ''} has already been generated for this repair job. Duplicate stock deduction prevented.`,
        };
      }

      // 3. Retrieve and lock garage configuration.
      const garageResult = await client.query(
        `SELECT *
         FROM garage_config
         WHERE id = $1
         FOR UPDATE`,
        [this.garageConfig.id || 'default-garage']
      );

      if (garageResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return {
          success: false,
          error: 'Garage configuration not found.',
        };
      }

      const garageConfig = mapDatabaseRows<GarageConfig>(
        garageResult.rows
      )[0];

      // 4. Build invoice line items.
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

      // 5. Calculate total quantity consumed per inventory item.
      const totalConsumedByItem = new Map<string, number>();

      for (const li of lineItems) {
        const current =
          totalConsumedByItem.get(li.inventoryItemId) || 0;

        totalConsumedByItem.set(
          li.inventoryItemId,
          roundQty(current + li.quantity)
        );
      }

      // 6. Lock all required inventory records.
      const inventoryIds = [...totalConsumedByItem.keys()].sort();

      const inventoryResult = inventoryIds.length
        ? await client.query(
          `SELECT *
             FROM inventory_items
             WHERE id = ANY($1::text[])
             ORDER BY id
             FOR UPDATE`,
          [inventoryIds]
        )
        : { rows: [] };

      const lockedItems = mapDatabaseRows<InventoryItem>(
        inventoryResult.rows
      );

      const inventoryMap = new Map(
        lockedItems.map((item) => [item.id, { ...item }])
      );

      // 7. Validate stock before making any deductions.
      for (const [inventoryId, requiredQty] of totalConsumedByItem) {
        const item = inventoryMap.get(inventoryId);

        if (!item) {
          await client.query('ROLLBACK');

          return {
            success: false,
            error: `Inventory record missing for item ID "${inventoryId}". Transaction rolled back.`,
          };
        }

        if (roundQty(item.quantityOnHand) < requiredQty) {
          await client.query('ROLLBACK');

          return {
            success: false,
            error: `Insufficient stock for "${item.partName}" (${item.sku}). Required: ${requiredQty} ${item.unit}, Available: ${item.quantityOnHand} ${item.unit}. Transaction rolled back — please restock or adjust actual quantity.`,
          };
        }
      }

      // 8. Calculate invoice amounts.
      const materialsSubtotal = roundMoney(
        lineItems.reduce((sum, li) => sum + li.lineTotal, 0)
      );

      const labour = Math.max(
        0,
        roundMoney(params.labourCharges)
      );

      const additionalSvc = Math.max(
        0,
        roundMoney(params.additionalServiceCharges)
      );

      const discount = Math.max(
        0,
        roundMoney(params.discountAmount)
      );

      const preTaxTotal = Math.max(
        0,
        roundMoney(materialsSubtotal + labour + additionalSvc - discount)
      );

      const taxAmount = garageConfig.taxEnabled
        ? roundMoney(
          (preTaxTotal * garageConfig.taxRatePercent) / 100
        )
        : 0;

      const finalPayableAmount = roundMoney(
        preTaxTotal + taxAmount
      );

      // 9. Generate invoice number using the locked DB sequence.
      const invoiceSeq = garageConfig.nextInvoiceSequence;

      const invoiceNumber =
        `${garageConfig.invoicePrefix}-${invoiceSeq}`;

      const nowIso = new Date().toISOString();
      const invoiceId = `inv-doc-${Date.now()}`;

      let amountPaid = 0;

      if (params.paymentStatus === 'Paid') {
        amountPaid = finalPayableAmount;
      } else if (params.paymentStatus === 'Partially Paid') {
        amountPaid = Math.min(
          finalPayableAmount,
          Math.max(0, roundMoney(params.amountPaid))
        );
      }

      // 10. Build invoice object.
      const newInvoice: Invoice = {
        id: invoiceId,
        invoiceNumber,
        repairJobId: booking.id,
        bookingRef: booking.bookingRef,
        invoiceDate: nowIso.slice(0, 10),
        createdAt: nowIso,
        customerName:
          (params.customerName || '').trim() ||
          booking.customerName ||
          'Fleet Customer',
        customerPhone:
          (params.customerPhone || '').trim() ||
          booking.customerPhone ||
          '-',
        customerEmail:
          params.customerEmail?.trim() ||
          booking.customerEmail ||
          '',
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
        taxEnabled: garageConfig.taxEnabled,
        taxRatePercent: garageConfig.taxEnabled
          ? garageConfig.taxRatePercent
          : 0,
        taxAmount,
        finalPayableAmount,
        paymentStatus: params.paymentStatus,
        amountPaid,
        paymentMethod: params.paymentMethod,
        status: 'active',
        garageSnapshot: { ...garageConfig },
        ownerUid: booking.ownerUid,
      };

      // 11. Insert invoice.
      await client.query(
        `INSERT INTO invoices (
          id, invoice_number, repair_job_id, booking_ref,
          invoice_date, created_at, customer_name,
          customer_phone, customer_email, vehicle_id,
          vehicle_reg, vehicle_make_model, odometer_reading,
          service_type, work_performed, materials_subtotal,
          labour_charges, additional_service_charges,
          discount_amount, tax_enabled, tax_rate_percent,
          tax_amount, final_payable_amount, payment_status,
          amount_paid, payment_method, status, garage_snapshot,
          owner_uid
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18,
          $19, $20, $21, $22, $23, $24, $25, $26,
          $27, $28::jsonb, $29
        )`,
        [
          newInvoice.id,
          newInvoice.invoiceNumber,
          newInvoice.repairJobId,
          newInvoice.bookingRef,
          newInvoice.invoiceDate,
          newInvoice.createdAt,
          newInvoice.customerName,
          newInvoice.customerPhone,
          newInvoice.customerEmail || null,
          newInvoice.vehicleId,
          newInvoice.vehicleReg,
          newInvoice.vehicleMakeModel,
          newInvoice.odometerReading,
          newInvoice.serviceType,
          newInvoice.workPerformed,
          newInvoice.materialsSubtotal,
          newInvoice.labourCharges,
          newInvoice.additionalServiceCharges,
          newInvoice.discountAmount,
          newInvoice.taxEnabled,
          newInvoice.taxRatePercent,
          newInvoice.taxAmount,
          newInvoice.finalPayableAmount,
          newInvoice.paymentStatus,
          newInvoice.amountPaid,
          newInvoice.paymentMethod,
          newInvoice.status,
          JSON.stringify(newInvoice.garageSnapshot),
          newInvoice.ownerUid || null,
        ]
      );

      // 12. Insert invoice line items.
      for (const li of lineItems) {
        await client.query(
          `INSERT INTO invoice_line_items (
            id, invoice_id, inventory_item_id,
            part_name, sku, unit, material_source,
            estimated_quantity, quantity, unit_price,
            line_total, reason
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            li.id,
            invoiceId,
            li.inventoryItemId || null,
            li.partName,
            li.sku,
            li.unit,
            li.materialSource,
            li.estimatedQuantity ?? null,
            li.quantity,
            li.unitPrice,
            li.lineTotal,
            li.reason || null,
          ]
        );
      }

      // 13. Deduct stock and create stock movement records.
      const newMovements: StockMovement[] = [];
      const newlyLowItems: InventoryItem[] = [];

      const txnCounterStart = this.stockMovements.length + 1;
      let txnCounter = txnCounterStart;

      for (const li of lineItems) {
        const target = inventoryMap.get(li.inventoryItemId);
        if (!target) continue;

        const prevQty = roundQty(target.quantityOnHand);
        const nextQty = roundQty(prevQty - li.quantity);

        target.quantityOnHand = nextQty;
        target.updatedAt = nowIso;

        const movement: StockMovement = {
          id: `txn-${Date.now()}-${txnCounter}`,
          transactionCode: `TXN-${Date.now()}-${txnCounter}`,
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
          ownerUid: booking.ownerUid,
        };

        newMovements.push(movement);
        txnCounter++;
      }

      // Save final stock quantities.
      for (const [inventoryId, updatedItem] of inventoryMap) {
        await client.query(
          `UPDATE inventory_items
           SET quantity_on_hand = $1,
               updated_at = NOW()
           WHERE id = $2`,
          [updatedItem.quantityOnHand, inventoryId]
        );

        if (
          updatedItem.isActive &&
          updatedItem.quantityOnHand < updatedItem.minimumStock
        ) {
          newlyLowItems.push(updatedItem);
        }
      }

      // Save stock movements.
      for (const movement of newMovements) {
        await client.query(
          `INSERT INTO stock_movements (
            id, transaction_code, inventory_item_id,
            part_name, sku, unit, transaction_type,
            previous_quantity, quantity_delta,
            updated_quantity, repair_job_id,
            invoice_number, movement_timestamp,
            performed_by, remarks, owner_uid
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8,
            $9, $10, $11, $12, $13, $14, $15, $16
          )`,
          [
            movement.id,
            movement.transactionCode,
            movement.inventoryItemId,
            movement.partName,
            movement.sku,
            movement.unit,
            movement.transactionType,
            movement.previousQuantity,
            movement.quantityDelta,
            movement.updatedQuantity,
            movement.repairJobId || null,
            movement.invoiceNumber || null,
            movement.timestamp,
            movement.performedBy,
            movement.remarks,
            movement.ownerUid || null,
          ]
        );
      }

      // 14. Update invoice sequence.
      const updatedGarageResult = await client.query(
        `UPDATE garage_config
         SET next_invoice_sequence = $1,
             updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [invoiceSeq + 1, garageConfig.id || 'default-garage']
      );

      const updatedGarageConfig = mapDatabaseRows<GarageConfig>(
        updatedGarageResult.rows
      )[0];

      // 15. Update vehicle and service history.
      let updatedVehCache: Vehicle | null = null;

      const vehicleResult = await client.query(
        `SELECT *
         FROM vehicles
         WHERE id = $1
         FOR UPDATE`,
        [booking.vehicleId]
      );

      if (vehicleResult.rows.length > 0) {
        const veh = mapDatabaseRows<Vehicle>(
          vehicleResult.rows
        )[0];

        const historyItem: ServiceHistoryRecord = {
          id: `hist-${Date.now()}`,
          serviceTitle: `${booking.serviceType || booking.serviceActivities}`,
          workshopLocation: garageConfig.garageName,
          completedDate: new Date().toLocaleDateString('en-GB'),
          performedBy: 'Certified Garage Tech',
          odometerAtService: params.odometerReading,
          costEstimate:
            `${garageConfig.currencySymbol}${finalPayableAmount.toLocaleString(
              'en-IN',
              {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }
            )}`,
          invoiceNumber,
          status: 'completed',
          notes: newInvoice.workPerformed,
        };

        const updatedVehicleResult = await client.query(
          `UPDATE vehicles
           SET odometer = GREATEST(odometer, $1),
               customer_name = $2,
               customer_phone = $3,
               customer_email = $4,
               service_history = $5::jsonb || service_history,
               updated_at = NOW()
           WHERE id = $6
           RETURNING *`,
          [
            params.odometerReading,
            newInvoice.customerName,
            newInvoice.customerPhone,
            newInvoice.customerEmail || null,
            JSON.stringify([historyItem]),
            veh.id,
          ]
        );

        updatedVehCache = mapDatabaseRows<Vehicle>(
          updatedVehicleResult.rows
        )[0];
      }

      // 16. Update booking.
      const updatedBookingResult = await client.query(
        `UPDATE service_bookings
         SET labour_charges = $1,
             additional_service_charges = $2,
             discount_amount = $3,
             work_performed_description = $4,
             customer_name = $5,
             customer_phone = $6,
             customer_email = $7,
             invoice_id = $8,
             invoice_number = $9,
             invoice_status = 'generated',
             workflow_column = 'service_events_to_book',
             calendar_status = 'performed',
             badge_type = 'accepted',
             badge_date_str = $10,
             updated_at = NOW()
         WHERE id = $11
         RETURNING *`,
        [
          labour,
          additionalSvc,
          discount,
          newInvoice.workPerformed,
          newInvoice.customerName,
          newInvoice.customerPhone,
          newInvoice.customerEmail || null,
          invoiceId,
          invoiceNumber,
          `Invoiced · ${invoiceNumber}`,
          booking.id,
        ]
      );

      const updatedBooking = mapDatabaseRows<ServiceBooking>(
        updatedBookingResult.rows
      )[0];

      // 17. Create performed notification.
      const perfAlert: FleetNotification = {
        id: `alert-inv-${Date.now()}`,
        type: 'performed',
        title: 'Performed',
        message: `Invoice ${invoiceNumber} (${garageConfig.currencySymbol}${finalPayableAmount.toFixed(2)}) generated for ${booking.vehicleReg}. Inventory deducted.`,
        workshop: garageConfig.garageName,
        bookingRef: booking.bookingRef,
        timeAgo: 'Just now',
        timestamp: nowIso,
        dismissed: false,
        ownerUid: booking.ownerUid,
      };

      await client.query(
        `INSERT INTO notifications (
          id, type, title, message, workshop,
          booking_ref, time_ago, notification_timestamp,
          dismissed, owner_uid
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          perfAlert.id,
          perfAlert.type,
          perfAlert.title,
          perfAlert.message,
          perfAlert.workshop,
          perfAlert.bookingRef || null,
          perfAlert.timeAgo,
          perfAlert.timestamp,
          perfAlert.dismissed,
          perfAlert.ownerUid || null,
        ]
      );

      // 18. Create low-stock notifications inside this transaction.
      const lowStockAlerts: FleetNotification[] = [];

      for (const item of newlyLowItems) {
        const existingAlert = await client.query(
          `SELECT id
           FROM notifications
           WHERE type = 'low_stock'
             AND inventory_item_id = $1
             AND dismissed = FALSE
           LIMIT 1`,
          [item.id]
        );

        if (existingAlert.rows.length > 0) continue;

        const statusLabel =
          item.quantityOnHand <= 0 ? 'Out of Stock' : 'Low Stock';

        const alert: FleetNotification = {
          id: `alert-low-${item.id}-${Date.now()}`,
          type: 'low_stock',
          title: `${statusLabel}: ${item.partName}`,
          message: `${item.partName} (${item.sku}) has ${item.quantityOnHand} ${item.unit} left (Min: ${item.minimumStock} ${item.unit}). Primary supplier: ${item.supplierName}.`,
          workshop: garageConfig.garageName,
          inventoryItemId: item.id,
          timeAgo: 'Just now',
          timestamp: nowIso,
          dismissed: false,
          ownerUid: booking.ownerUid,
        };

        await client.query(
          `INSERT INTO notifications (
            id, type, title, message, workshop,
            inventory_item_id, time_ago,
            notification_timestamp, dismissed, owner_uid
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            alert.id,
            alert.type,
            alert.title,
            alert.message,
            alert.workshop,
            alert.inventoryItemId,
            alert.timeAgo,
            alert.timestamp,
            alert.dismissed,
            alert.ownerUid || null,
          ]
        );

        lowStockAlerts.push(alert);
      }

      // 19. Commit all database changes.
      await client.query('COMMIT');

      // 20. Update in-memory caches only after successful commit.
      this.inventory = this.inventory.map(
        (item) => inventoryMap.get(item.id) || item
      );

      this.stockMovements = [
        ...newMovements.reverse(),
        ...this.stockMovements,
      ];

      this.invoices = [newInvoice, ...this.invoices];

      this.garageConfig = updatedGarageConfig;

      this.bookings = this.bookings.map(
        (item) =>
          item.id === updatedBooking.id ? updatedBooking : item
      );

      if (updatedVehCache) {
        this.vehicles = this.vehicles.map(
          (item) =>
            item.id === updatedVehCache!.id
              ? updatedVehCache!
              : item
        );
      }

      this.notifications = [
        ...lowStockAlerts,
        perfAlert,
        ...this.notifications,
      ];

      return {
        success: true,
        invoice: cloneData(newInvoice),
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }



  async updateInvoicePayment(
    invoiceId: string,
    updates: {
      paymentStatus: InvoicePaymentStatus;
      amountPaid: number;
      paymentMethod: InvoicePaymentMethod;
    }
  ): Promise<{ success: boolean; invoice?: Invoice }> {
    const existing = this.invoices.find((i) => i.id === invoiceId);

    if (!existing) {
      return { success: false };
    }

    let paid = updates.amountPaid;

    if (updates.paymentStatus === 'Paid') {
      paid = existing.finalPayableAmount;
    } else if (updates.paymentStatus === 'Unpaid') {
      paid = 0;
    } else {
      paid = Math.min(
        existing.finalPayableAmount,
        Math.max(0, roundMoney(updates.amountPaid))
      );
    }

    const result = await pool.query(
      `UPDATE invoices
       SET payment_status = $1,
           amount_paid = $2,
           payment_method = $3
       WHERE id = $4
       RETURNING id`,
      [
        updates.paymentStatus,
        paid,
        updates.paymentMethod,
        invoiceId,
      ]
    );

    if (result.rowCount === 0) {
      return { success: false };
    }

    const updated: Invoice = {
      ...existing,
      paymentStatus: updates.paymentStatus,
      amountPaid: paid,
      paymentMethod: updates.paymentMethod,
    };

    this.invoices = this.invoices.map((i) =>
      i.id === invoiceId ? updated : i
    );

    return {
      success: true,
      invoice: cloneData(updated),
    };
  }



  async cancelInvoice(
    invoiceId: string,
    reason = 'Cancelled by authorized garage manager'
  ): Promise<{ success: boolean; error?: string; invoice?: Invoice }> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 1. Retrieve and lock invoice.
      const invoiceResult = await client.query(
        `SELECT *
         FROM invoices
         WHERE id = $1
         FOR UPDATE`,
        [invoiceId]
      );

      if (invoiceResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return { success: false, error: 'Invoice not found.' };
      }

      const invoiceRow = mapDatabaseRows<Invoice>(
        invoiceResult.rows
      )[0];

      if (invoiceRow.status === 'cancelled') {
        await client.query('ROLLBACK');

        return {
          success: false,
          error: 'Invoice is already cancelled and stock was previously restored.',
        };
      }

      // 2. Retrieve invoice line items.
      const lineResult = await client.query(
        `SELECT *
         FROM invoice_line_items
         WHERE invoice_id = $1`,
        [invoiceId]
      );

      const lineItems = mapDatabaseRows<InvoiceLineItem>(
        lineResult.rows
      );

      const inv: Invoice = {
        ...invoiceRow,
        lineItems,
      };

      // 3. Calculate total quantity to restore per inventory item.
      const restoreByItem = new Map<string, number>();

      for (const li of lineItems) {
        if (!li.inventoryItemId) continue;

        const current =
          restoreByItem.get(li.inventoryItemId) || 0;

        restoreByItem.set(
          li.inventoryItemId,
          roundQty(current + li.quantity)
        );
      }

      // 4. Lock inventory records.
      const inventoryIds = [...restoreByItem.keys()].sort();

      const inventoryResult = inventoryIds.length
        ? await client.query(
          `SELECT *
             FROM inventory_items
             WHERE id = ANY($1::text[])
             ORDER BY id
             FOR UPDATE`,
          [inventoryIds]
        )
        : { rows: [] };

      const lockedItems = mapDatabaseRows<InventoryItem>(
        inventoryResult.rows
      );

      const inventoryMap = new Map(
        lockedItems.map((item) => [item.id, { ...item }])
      );

      // 5. Validate inventory records before restoring stock.
      for (const inventoryId of inventoryIds) {
        if (!inventoryMap.has(inventoryId)) {
          await client.query('ROLLBACK');

          return {
            success: false,
            error: `Inventory item ${inventoryId} was not found. Invoice cancellation was stopped.`,
          };
        }
      }

      const nowIso = new Date().toISOString();
      const reversalMovements: StockMovement[] = [];

      let txnCounter = this.stockMovements.length + 1;

      // 6. Restore stock and create reversal movements.
      for (const [inventoryId, restoreQty] of restoreByItem) {
        const target = inventoryMap.get(inventoryId)!;

        const prevQty = roundQty(target.quantityOnHand);
        const nextQty = roundQty(prevQty + restoreQty);

        target.quantityOnHand = nextQty;
        target.updatedAt = nowIso;

        await client.query(
          `UPDATE inventory_items
           SET quantity_on_hand = $1,
               updated_at = NOW()
           WHERE id = $2`,
          [nextQty, inventoryId]
        );

        const movement: StockMovement = {
          id: `txn-rev-${Date.now()}-${txnCounter}`,
          transactionCode: `TXN-${1000 + txnCounter}`,
          inventoryItemId: target.id,
          partName: target.partName,
          sku: target.sku,
          unit: target.unit,
          transactionType: 'invoice_reversal',
          previousQuantity: prevQty,
          quantityDelta: restoreQty,
          updatedQuantity: nextQty,
          repairJobId: inv.bookingRef,
          invoiceNumber: inv.invoiceNumber,
          timestamp: nowIso,
          performedBy: 'Garage Manager',
          remarks: `Stock restored from cancelled invoice ${inv.invoiceNumber}: ${reason}`,
          ownerUid: inv.ownerUid,
        };

        reversalMovements.push(movement);

        await client.query(
          `INSERT INTO stock_movements (
            id, transaction_code, inventory_item_id,
            part_name, sku, unit, transaction_type,
            previous_quantity, quantity_delta,
            updated_quantity, repair_job_id,
            invoice_number, movement_timestamp,
            performed_by, remarks, owner_uid
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8,
            $9, $10, $11, $12, $13, $14, $15, $16
          )`,
          [
            movement.id,
            movement.transactionCode,
            movement.inventoryItemId,
            movement.partName,
            movement.sku,
            movement.unit,
            movement.transactionType,
            movement.previousQuantity,
            movement.quantityDelta,
            movement.updatedQuantity,
            movement.repairJobId || null,
            movement.invoiceNumber || null,
            movement.timestamp,
            movement.performedBy,
            movement.remarks,
            movement.ownerUid || null,
          ]
        );

        txnCounter++;
      }

      // 7. Mark invoice as cancelled.
      const updatedInvoiceResult = await client.query(
        `UPDATE invoices
         SET status = 'cancelled',
             cancelled_at = $1,
             cancel_reason = $2
         WHERE id = $3
         RETURNING *`,
        [nowIso, reason, invoiceId]
      );

      const updatedInvoiceRow = mapDatabaseRows<Invoice>(
        updatedInvoiceResult.rows
      )[0];

      const updatedInvoice: Invoice = {
        ...updatedInvoiceRow,
        lineItems,
      };

      // 8. Update related booking.
      const updatedBookingResult = await client.query(
        `UPDATE service_bookings
         SET invoice_status = 'cancelled',
             invoice_id = NULL,
             invoice_number = NULL,
             workflow_column = 'in_progress',
             calendar_status = 'planned',
             badge_type = 'pick_up',
             badge_date_str = $1,
             updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [
          `Invoice ${inv.invoiceNumber} Cancelled`,
          inv.repairJobId,
        ]
      );

      const updatedBooking = updatedBookingResult.rows.length
        ? mapDatabaseRows<ServiceBooking>(
          updatedBookingResult.rows
        )[0]
        : null;

      // 9. Commit all changes.
      await client.query('COMMIT');

      // 10. Update in-memory caches after successful commit.
      this.inventory = this.inventory.map(
        (item) => inventoryMap.get(item.id) || item
      );

      this.stockMovements = [
        ...reversalMovements.reverse(),
        ...this.stockMovements,
      ];

      this.invoices = this.invoices.map((item) =>
        item.id === invoiceId ? updatedInvoice : item
      );

      if (updatedBooking) {
        this.bookings = this.bookings.map((item) =>
          item.id === updatedBooking.id
            ? updatedBooking
            : item
        );
      }

      return {
        success: true,
        invoice: cloneData(updatedInvoice),
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }


  // ==========================================================
  // NOTIFICATIONS
  // ==========================================================

  async dismissNotification(id: string): Promise<void> {
    const result = await pool.query(
      `UPDATE notifications
       SET dismissed = TRUE
       WHERE id = $1
       RETURNING id`,
      [id]
    );

    if (result.rowCount === 0) return;

    this.notifications = this.notifications.map((n) =>
      n.id === id ? { ...n, dismissed: true } : n
    );
  }



  async dismissAllNotifications(): Promise<void> {
    await pool.query(
      `UPDATE notifications
       SET dismissed = TRUE
       WHERE dismissed = FALSE`
    );

    this.notifications = this.notifications.map((n) => ({
      ...n,
      dismissed: true,
    }));
  }



  async resetNotifications(): Promise<FleetNotification[]> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      await client.query('DELETE FROM notifications');

      for (const notification of INITIAL_NOTIFICATIONS) {
        await client.query(
          `INSERT INTO notifications (
            id,
            type,
            title,
            message,
            workshop,
            booking_ref,
            time_ago,
            notification_timestamp,
            dismissed
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            notification.id,
            notification.type,
            notification.title,
            notification.message,
            notification.workshop,
            notification.bookingRef,
            notification.timeAgo,
            notification.timestamp,
            notification.dismissed,
          ]
        );
      }

      await client.query('COMMIT');

      this.notifications = cloneData(INITIAL_NOTIFICATIONS);
      return cloneData(this.notifications);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

}

export const fleetService = new FleetService();
