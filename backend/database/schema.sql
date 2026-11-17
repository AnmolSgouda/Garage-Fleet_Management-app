-- PostgreSQL Reference Schema for Fleet Service Planning & Garage Management
-- Portable DDL schema matching all Express backend models and business invariants

CREATE TABLE IF NOT EXISTS garage_config (
  id VARCHAR(64) PRIMARY KEY,
  garage_name VARCHAR(160) NOT NULL,
  tagline VARCHAR(240) NOT NULL DEFAULT '',
  address VARCHAR(300) NOT NULL,
  phone VARCHAR(40) NOT NULL,
  email VARCHAR(120) NOT NULL,
  gst_number VARCHAR(40) NOT NULL DEFAULT '',
  tax_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  tax_rate_percent NUMERIC(5, 2) NOT NULL DEFAULT 18.00,
  currency_symbol VARCHAR(8) NOT NULL DEFAULT '₹',
  invoice_prefix VARCHAR(16) NOT NULL DEFAULT 'INV',
  next_invoice_sequence INTEGER NOT NULL DEFAULT 1001,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS suppliers (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(140) NOT NULL,
  contact_person VARCHAR(120) NOT NULL,
  mobile VARCHAR(40) NOT NULL,
  email VARCHAR(120) NOT NULL,
  address VARCHAR(300) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_items (
  id VARCHAR(64) PRIMARY KEY,
  part_name VARCHAR(160) NOT NULL,
  sku VARCHAR(64) NOT NULL UNIQUE,
  category VARCHAR(80) NOT NULL,
  description VARCHAR(400) NOT NULL DEFAULT '',
  unit VARCHAR(32) NOT NULL,
  quantity_on_hand NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (quantity_on_hand >= 0),
  minimum_stock NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (minimum_stock >= 0),
  storage_location VARCHAR(64) NOT NULL DEFAULT 'UNASSIGNED',
  purchase_cost NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (purchase_cost >= 0),
  selling_price NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (selling_price >= 0),
  supplier_id VARCHAR(64) NOT NULL REFERENCES suppliers(id),
  supplier_name VARCHAR(140) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vehicles (
  id VARCHAR(64) PRIMARY KEY,
  registration_number VARCHAR(40) NOT NULL UNIQUE,
  manufacturer VARCHAR(80),
  model VARCHAR(100) NOT NULL,
  manufacturing_year INTEGER,
  equipment_group VARCHAR(80) NOT NULL,
  category VARCHAR(32) NOT NULL CHECK (category IN ('box_truck', 'container_truck', 'dump_truck', 'concrete_mixer', 'flatbed_trailer', 'tanker_truck')),
  category_label VARCHAR(60) NOT NULL,
  image_path VARCHAR(200) NOT NULL,
  odometer INTEGER NOT NULL DEFAULT 0 CHECK (odometer >= 0),
  engine_running_hours INTEGER NOT NULL DEFAULT 0 CHECK (engine_running_hours >= 0),
  maintenance_plan VARCHAR(200) NOT NULL,
  next_service_date VARCHAR(40) NOT NULL,
  assigned_garage VARCHAR(160),
  customer_name VARCHAR(140),
  customer_phone VARCHAR(40),
  customer_email VARCHAR(120),
  other_service_activities TEXT NOT NULL DEFAULT '-',
  notes TEXT DEFAULT '',
  maintenance_checklist JSONB NOT NULL DEFAULT '[]'::jsonb,
  repair_checklist JSONB NOT NULL DEFAULT '[]'::jsonb,
  service_history JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS service_templates (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE,
  description VARCHAR(400) NOT NULL DEFAULT '',
  default_labour_charge NUMERIC(12, 2) NOT NULL DEFAULT 0,
  is_custom BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS service_template_materials (
  id VARCHAR(64) PRIMARY KEY,
  template_id VARCHAR(64) NOT NULL REFERENCES service_templates(id) ON DELETE CASCADE,
  inventory_item_id VARCHAR(64) NOT NULL REFERENCES inventory_items(id),
  part_name VARCHAR(160) NOT NULL,
  sku VARCHAR(64) NOT NULL,
  unit VARCHAR(32) NOT NULL,
  default_quantity NUMERIC(12, 2) NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS service_bookings (
  id VARCHAR(64) PRIMARY KEY,
  booking_ref VARCHAR(32) NOT NULL UNIQUE,
  vehicle_id VARCHAR(64) NOT NULL REFERENCES vehicles(id),
  vehicle_reg VARCHAR(40) NOT NULL,
  vehicle_category VARCHAR(32) NOT NULL,
  vehicle_model VARCHAR(100) NOT NULL,
  equipment_group VARCHAR(80) NOT NULL,
  title VARCHAR(200) NOT NULL,
  service_type VARCHAR(120) NOT NULL,
  service_activities TEXT NOT NULL,
  workshop_location VARCHAR(160) NOT NULL,
  workflow_column VARCHAR(40) NOT NULL CHECK (workflow_column IN ('service_events_to_book', 'preliminary_bookings', 'confirmed_bookings', 'in_progress')),
  calendar_status VARCHAR(24) NOT NULL CHECK (calendar_status IN ('delayed', 'due', 'preliminary', 'performed', 'confirmed', 'planned')),
  date VARCHAR(20) NOT NULL,
  start_time VARCHAR(10) NOT NULL,
  end_time VARCHAR(10) NOT NULL,
  badge_type VARCHAR(24) NOT NULL,
  badge_date_str VARCHAR(80) NOT NULL,
  is_priority BOOLEAN DEFAULT FALSE,
  notes TEXT DEFAULT '',
  customer_name VARCHAR(140),
  customer_phone VARCHAR(40),
  customer_email VARCHAR(120),
  estimated_materials JSONB NOT NULL DEFAULT '[]'::jsonb,
  actual_materials JSONB NOT NULL DEFAULT '[]'::jsonb,
  additional_materials JSONB NOT NULL DEFAULT '[]'::jsonb,
  labour_charges NUMERIC(12, 2) NOT NULL DEFAULT 0,
  additional_service_charges NUMERIC(12, 2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  work_performed_description TEXT DEFAULT '',
  invoice_id VARCHAR(64),
  invoice_number VARCHAR(40),
  invoice_status VARCHAR(24) DEFAULT 'none'
);

CREATE TABLE IF NOT EXISTS invoices (
  id VARCHAR(64) PRIMARY KEY,
  invoice_number VARCHAR(40) NOT NULL UNIQUE,
  repair_job_id VARCHAR(64) NOT NULL REFERENCES service_bookings(id),
  booking_ref VARCHAR(32) NOT NULL,
  invoice_date VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  customer_name VARCHAR(140) NOT NULL,
  customer_phone VARCHAR(40) NOT NULL,
  customer_email VARCHAR(120),
  vehicle_id VARCHAR(64) NOT NULL REFERENCES vehicles(id),
  vehicle_reg VARCHAR(40) NOT NULL,
  vehicle_make_model VARCHAR(100) NOT NULL,
  odometer_reading INTEGER NOT NULL DEFAULT 0,
  service_type VARCHAR(120) NOT NULL,
  work_performed TEXT NOT NULL,
  materials_subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
  labour_charges NUMERIC(12, 2) NOT NULL DEFAULT 0,
  additional_service_charges NUMERIC(12, 2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  tax_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  tax_rate_percent NUMERIC(5, 2) NOT NULL DEFAULT 18.00,
  tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  final_payable_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (final_payable_amount >= 0),
  payment_status VARCHAR(24) NOT NULL CHECK (payment_status IN ('Paid', 'Unpaid', 'Partially Paid')),
  amount_paid NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  payment_method VARCHAR(40) NOT NULL CHECK (payment_method IN ('Cash', 'Card', 'UPI / Bank Transfer', 'Corporate Credit')),
  status VARCHAR(16) NOT NULL CHECK (status IN ('active', 'cancelled')),
  cancelled_at TIMESTAMPTZ,
  cancel_reason TEXT,
  garage_snapshot JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS invoice_line_items (
  id VARCHAR(64) PRIMARY KEY,
  invoice_id VARCHAR(64) NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  inventory_item_id VARCHAR(64) NOT NULL REFERENCES inventory_items(id),
  part_name VARCHAR(160) NOT NULL,
  sku VARCHAR(64) NOT NULL,
  unit VARCHAR(32) NOT NULL,
  material_source VARCHAR(32) NOT NULL CHECK (material_source IN ('estimated_actual', 'additional')),
  estimated_quantity NUMERIC(12, 2),
  quantity NUMERIC(12, 2) NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
  line_total NUMERIC(12, 2) NOT NULL CHECK (line_total >= 0),
  reason TEXT
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id VARCHAR(64) PRIMARY KEY,
  transaction_code VARCHAR(40) NOT NULL UNIQUE,
  inventory_item_id VARCHAR(64) NOT NULL REFERENCES inventory_items(id),
  part_name VARCHAR(160) NOT NULL,
  sku VARCHAR(64) NOT NULL,
  unit VARCHAR(32) NOT NULL,
  transaction_type VARCHAR(32) NOT NULL CHECK (transaction_type IN ('stock_in', 'service_consumption', 'manual_adjustment', 'purchase_return', 'invoice_reversal')),
  previous_quantity NUMERIC(12, 2) NOT NULL,
  quantity_delta NUMERIC(12, 2) NOT NULL,
  updated_quantity NUMERIC(12, 2) NOT NULL CHECK (updated_quantity >= 0),
  repair_job_id VARCHAR(64),
  invoice_number VARCHAR(40),
  supplier_id VARCHAR(64),
  supplier_name VARCHAR(140),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  performed_by VARCHAR(100) NOT NULL,
  remarks VARCHAR(400) NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(64) PRIMARY KEY,
  type VARCHAR(24) NOT NULL CHECK (type IN ('proposal', 'confirmed', 'performed', 'delayed', 'repair', 'low_stock')),
  title VARCHAR(120) NOT NULL,
  message VARCHAR(500) NOT NULL,
  workshop VARCHAR(160) NOT NULL,
  booking_ref VARCHAR(32),
  inventory_item_id VARCHAR(64),
  time_ago VARCHAR(40) NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  dismissed BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_bookings_vehicle_date ON service_bookings(vehicle_id, date);
CREATE INDEX IF NOT EXISTS idx_inventory_sku ON inventory_items(sku);
CREATE INDEX IF NOT EXISTS idx_stock_movements_item ON stock_movements(inventory_item_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_repair_job ON invoices(repair_job_id);
