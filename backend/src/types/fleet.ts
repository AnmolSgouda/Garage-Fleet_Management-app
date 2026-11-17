export type VehicleCategory =
  | 'box_truck'
  | 'container_truck'
  | 'dump_truck'
  | 'concrete_mixer'
  | 'flatbed_trailer'
  | 'tanker_truck';

export type ServiceWorkflowColumn =
  | 'service_events_to_book'
  | 'preliminary_bookings'
  | 'confirmed_bookings'
  | 'in_progress';

export type CalendarStatus =
  | 'delayed'
  | 'due'
  | 'preliminary'
  | 'performed'
  | 'confirmed'
  | 'planned';

export interface MaintenanceItem {
  id: string;
  name: string;
  status: 'delayed' | 'due' | 'completed' | 'ok';
  dueDate: string;
  dueTime?: string;
  required: boolean;
  notes?: string;
}

export interface RepairItem {
  id: string;
  issue: string;
  severity: 'major' | 'minor' | 'critical';
  reportedDate: string;
  reportedTime?: string;
  resolved: boolean;
  notes?: string;
}

export interface ServiceHistoryRecord {
  id: string;
  serviceTitle: string;
  workshopLocation: string;
  completedDate: string;
  performedBy: string;
  odometerAtService: number;
  costEstimate?: string;
  invoiceNumber?: string;
  status: 'completed';
  notes: string;
}

export interface Vehicle {
  id: string;
  registrationNumber: string;
  manufacturer?: string;
  model: string;
  manufacturingYear?: number;
  equipmentGroup: string;
  category: VehicleCategory;
  categoryLabel: string;
  imagePath: string;
  odometer: number;
  engineRunningHours: number;
  maintenancePlan: string;
  nextServiceDate: string;
  assignedGarage?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  otherServiceActivities: string;
  notes?: string;
  maintenanceChecklist: MaintenanceItem[];
  repairChecklist: RepairItem[];
  serviceHistory: ServiceHistoryRecord[];
  ownerUid?: string;
}

export interface GarageConfig {
  id?: string;
  garageName: string;
  tagline: string;
  address: string;
  phone: string;
  email: string;
  gstNumber: string;
  taxEnabled: boolean;
  taxRatePercent: number;
  currencySymbol: string;
  invoicePrefix: string;
  nextInvoiceSequence: number;
  ownerUid?: string;
  updatedAt?: string;
}

export type InventoryStockStatus = 'In Stock' | 'Low Stock' | 'Out of Stock';

export interface Supplier {
  id: string;
  name: string;
  contactPerson: string;
  mobile: string;
  email: string;
  address: string;
  isActive: boolean;
  createdAt: string;
  ownerUid?: string;
}

export interface InventoryItem {
  id: string;
  partName: string;
  sku: string;
  category: string;
  description: string;
  unit: string;
  quantityOnHand: number;
  minimumStock: number;
  storageLocation: string;
  purchaseCost: number;
  sellingPrice: number;
  supplierId: string;
  supplierName: string;
  isActive: boolean;
  updatedAt: string;
  ownerUid?: string;
}

export interface ServiceTemplateMaterial {
  id: string;
  inventoryItemId: string;
  partName: string;
  sku: string;
  unit: string;
  defaultQuantity: number;
}

export interface ServiceTemplate {
  id: string;
  name: string;
  description: string;
  defaultLabourCharge: number;
  materials: ServiceTemplateMaterial[];
  isCustom: boolean;
  ownerUid?: string;
}

export interface JobEstimatedMaterialLine {
  id: string;
  inventoryItemId: string;
  partName: string;
  sku: string;
  unit: string;
  estimatedQuantity: number;
  unitPrice: number;
}

export interface JobActualMaterialLine {
  id: string;
  inventoryItemId: string;
  partName: string;
  sku: string;
  unit: string;
  estimatedQuantity: number;
  actualQuantity: number;
  unitPrice: number;
}

export interface JobAdditionalMaterialLine {
  id: string;
  inventoryItemId: string;
  partName: string;
  sku: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  reason: string;
}

export interface ServiceBooking {
  id: string;
  bookingRef: string;
  vehicleId: string;
  vehicleReg: string;
  vehicleCategory: VehicleCategory;
  vehicleModel: string;
  equipmentGroup: string;
  title: string;
  serviceType: string;
  serviceActivities: string;
  workshopLocation: string;
  workflowColumn: ServiceWorkflowColumn;
  calendarStatus: CalendarStatus;
  date: string;
  startTime: string;
  endTime: string;
  badgeType: 'delayed' | 'due' | 'pending' | 'proposal' | 'drop_off' | 'pick_up' | 'accepted' | 'major';
  badgeDateStr: string;
  isPriority?: boolean;
  notes?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  estimatedMaterials: JobEstimatedMaterialLine[];
  actualMaterials: JobActualMaterialLine[];
  additionalMaterials: JobAdditionalMaterialLine[];
  labourCharges: number;
  additionalServiceCharges: number;
  discountAmount: number;
  workPerformedDescription?: string;
  invoiceId?: string;
  invoiceNumber?: string;
  invoiceStatus?: 'none' | 'generated' | 'cancelled';
  ownerUid?: string;
}

export interface InvoiceLineItem {
  id: string;
  inventoryItemId: string;
  partName: string;
  sku: string;
  unit: string;
  materialSource: 'estimated_actual' | 'additional';
  estimatedQuantity?: number;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  reason?: string;
}

export type InvoicePaymentStatus = 'Paid' | 'Unpaid' | 'Partially Paid';
export type InvoicePaymentMethod = 'Cash' | 'Card' | 'UPI / Bank Transfer' | 'Corporate Credit';

export interface Invoice {
  id: string;
  invoiceNumber: string;
  repairJobId: string;
  bookingRef: string;
  invoiceDate: string;
  createdAt: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  vehicleId: string;
  vehicleReg: string;
  vehicleMakeModel: string;
  odometerReading: number;
  serviceType: string;
  workPerformed: string;
  lineItems: InvoiceLineItem[];
  materialsSubtotal: number;
  labourCharges: number;
  additionalServiceCharges: number;
  discountAmount: number;
  taxEnabled: boolean;
  taxRatePercent: number;
  taxAmount: number;
  finalPayableAmount: number;
  paymentStatus: InvoicePaymentStatus;
  amountPaid: number;
  paymentMethod: InvoicePaymentMethod;
  status: 'active' | 'cancelled';
  cancelledAt?: string;
  cancelReason?: string;
  garageSnapshot: GarageConfig;
  ownerUid?: string;
}

export type StockMovementType =
  | 'stock_in'
  | 'service_consumption'
  | 'manual_adjustment'
  | 'purchase_return'
  | 'invoice_reversal';

export interface StockMovement {
  id: string;
  transactionCode: string;
  inventoryItemId: string;
  partName: string;
  sku: string;
  unit: string;
  transactionType: StockMovementType;
  previousQuantity: number;
  quantityDelta: number;
  updatedQuantity: number;
  repairJobId?: string;
  invoiceNumber?: string;
  supplierId?: string;
  supplierName?: string;
  timestamp: string;
  performedBy: string;
  remarks: string;
  ownerUid?: string;
}

export interface FleetNotification {
  id: string;
  type: 'proposal' | 'confirmed' | 'performed' | 'delayed' | 'repair' | 'low_stock';
  title: string;
  message: string;
  workshop: string;
  bookingRef?: string;
  inventoryItemId?: string;
  timeAgo: string;
  timestamp: string;
  dismissed: boolean;
  ownerUid?: string;
}

export interface FleetBootstrapState {
  garageConfig: GarageConfig;
  vehicles: Vehicle[];
  bookings: ServiceBooking[];
  notifications: FleetNotification[];
  suppliers: Supplier[];
  inventory: InventoryItem[];
  serviceTemplates: ServiceTemplate[];
  invoices: Invoice[];
  stockMovements: StockMovement[];
}
