
-- ==========================================
-- GARAGE FLEET MANAGEMENT
-- FINAL POSTGRESQL DATABASE SCHEMA
-- ==========================================

-- 1. GARAGE CONFIGURATION
CREATE TABLE garage_config (
    id TEXT PRIMARY KEY,
    garage_name TEXT NOT NULL,
    tagline TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    gst_number TEXT NOT NULL DEFAULT '',
    tax_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    tax_rate_percent NUMERIC(5,2) NOT NULL DEFAULT 18,
    currency_symbol TEXT NOT NULL DEFAULT '₹',
    invoice_prefix TEXT NOT NULL DEFAULT 'INV',
    next_invoice_sequence INTEGER NOT NULL DEFAULT 1001,
    owner_uid TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CHECK (tax_rate_percent >= 0 AND tax_rate_percent <= 100),
    CHECK (next_invoice_sequence >= 1)
);

-- 2. SUPPLIERS
CREATE TABLE suppliers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    contact_person TEXT NOT NULL DEFAULT '',
    mobile TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    owner_uid TEXT
);

-- 3. INVENTORY ITEMS
CREATE TABLE inventory_items (
    id TEXT PRIMARY KEY,
    part_name TEXT NOT NULL,
    sku TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    unit TEXT NOT NULL,
    quantity_on_hand NUMERIC(12,2) NOT NULL DEFAULT 0,
    minimum_stock NUMERIC(12,2) NOT NULL DEFAULT 0,
    storage_location TEXT NOT NULL DEFAULT '',
    purchase_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
    selling_price NUMERIC(12,2) NOT NULL DEFAULT 0,
    supplier_id TEXT REFERENCES suppliers(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    supplier_name TEXT NOT NULL DEFAULT '',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    owner_uid TEXT,
    CHECK (quantity_on_hand >= 0),
    CHECK (minimum_stock >= 0),
    CHECK (purchase_cost >= 0),
    CHECK (selling_price >= 0)
);

-- 4. VEHICLES
CREATE TABLE vehicles (
    id TEXT PRIMARY KEY,
    registration_number TEXT NOT NULL,
    manufacturer TEXT NOT NULL DEFAULT '',
    model TEXT NOT NULL,
    manufacturing_year INTEGER,
    equipment_group TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL,
    category_label TEXT NOT NULL DEFAULT '',
    image_path TEXT NOT NULL DEFAULT '',
    odometer NUMERIC(12,2) NOT NULL DEFAULT 0,
    engine_running_hours NUMERIC(12,2) NOT NULL DEFAULT 0,
    maintenance_plan TEXT NOT NULL DEFAULT '',
    next_service_date TEXT NOT NULL DEFAULT '',
    assigned_garage TEXT,
    customer_name TEXT,
    customer_phone TEXT,
    customer_email TEXT,
    other_service_activities TEXT NOT NULL DEFAULT '',
    notes TEXT,
    maintenance_checklist JSONB NOT NULL DEFAULT '[]'::jsonb,
    repair_checklist JSONB NOT NULL DEFAULT '[]'::jsonb,
    service_history JSONB NOT NULL DEFAULT '[]'::jsonb,
    owner_uid TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CHECK (odometer >= 0),
    CHECK (engine_running_hours >= 0)
);

CREATE UNIQUE INDEX uq_vehicles_registration_number
ON vehicles (LOWER(registration_number));

-- 5. SERVICE TEMPLATES
CREATE TABLE service_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    default_labour_charge NUMERIC(12,2) NOT NULL DEFAULT 0,
    is_custom BOOLEAN NOT NULL DEFAULT FALSE,
    owner_uid TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CHECK (default_labour_charge >= 0)
);

-- 6. SERVICE TEMPLATE MATERIALS
CREATE TABLE service_template_materials (
    id TEXT PRIMARY KEY,
    service_template_id TEXT NOT NULL
        REFERENCES service_templates(id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    inventory_item_id TEXT NOT NULL
        REFERENCES inventory_items(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    part_name TEXT NOT NULL,
    sku TEXT NOT NULL,
    unit TEXT NOT NULL,
    default_quantity NUMERIC(12,2) NOT NULL DEFAULT 1,
    CHECK (default_quantity > 0)
);

-- 7. SERVICE BOOKINGS / REPAIR JOBS
CREATE TABLE service_bookings (
    id TEXT PRIMARY KEY,
    booking_ref TEXT NOT NULL UNIQUE,
    vehicle_id TEXT REFERENCES vehicles(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    vehicle_reg TEXT NOT NULL DEFAULT '',
    vehicle_category TEXT NOT NULL DEFAULT '',
    vehicle_model TEXT NOT NULL DEFAULT '',
    equipment_group TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL DEFAULT '',
    service_type TEXT NOT NULL DEFAULT '',
    service_activities TEXT NOT NULL DEFAULT '',
    workshop_location TEXT NOT NULL DEFAULT '',
    workflow_column TEXT NOT NULL,
    calendar_status TEXT NOT NULL,
    booking_date DATE,
    start_time TIME,
    end_time TIME,
    badge_type TEXT NOT NULL DEFAULT 'pending',
    badge_date_str TEXT NOT NULL DEFAULT '',
    is_priority BOOLEAN DEFAULT FALSE,
    notes TEXT,
    customer_name TEXT,
    customer_phone TEXT,
    customer_email TEXT,
    estimated_materials JSONB NOT NULL DEFAULT '[]'::jsonb,
    actual_materials JSONB NOT NULL DEFAULT '[]'::jsonb,
    additional_materials JSONB NOT NULL DEFAULT '[]'::jsonb,
    labour_charges NUMERIC(12,2) NOT NULL DEFAULT 0,
    additional_service_charges NUMERIC(12,2) NOT NULL DEFAULT 0,
    discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    work_performed_description TEXT,
    invoice_id TEXT,
    invoice_number TEXT,
    invoice_status TEXT NOT NULL DEFAULT 'none',
    owner_uid TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CHECK (end_time IS NULL OR start_time IS NULL OR end_time > start_time),
    CHECK (labour_charges >= 0),
    CHECK (additional_service_charges >= 0),
    CHECK (discount_amount >= 0)
);

-- 8. INVOICES
CREATE TABLE invoices (
    id TEXT PRIMARY KEY,
    invoice_number TEXT NOT NULL UNIQUE,
    repair_job_id TEXT NOT NULL
        REFERENCES service_bookings(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    booking_ref TEXT NOT NULL,
    invoice_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    customer_name TEXT NOT NULL DEFAULT '',
    customer_phone TEXT NOT NULL DEFAULT '',
    customer_email TEXT,
    vehicle_id TEXT,
    vehicle_reg TEXT NOT NULL DEFAULT '',
    vehicle_make_model TEXT NOT NULL DEFAULT '',
    odometer_reading NUMERIC(12,2) NOT NULL DEFAULT 0,
    service_type TEXT NOT NULL DEFAULT '',
    work_performed TEXT NOT NULL DEFAULT '',
    materials_subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
    labour_charges NUMERIC(12,2) NOT NULL DEFAULT 0,
    additional_service_charges NUMERIC(12,2) NOT NULL DEFAULT 0,
    discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    tax_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    tax_rate_percent NUMERIC(5,2) NOT NULL DEFAULT 18,
    tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    final_payable_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    payment_status TEXT NOT NULL DEFAULT 'Unpaid',
    amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
    payment_method TEXT NOT NULL DEFAULT 'Cash',
    status TEXT NOT NULL DEFAULT 'active',
    cancelled_at TIMESTAMPTZ,
    cancel_reason TEXT,
    garage_snapshot JSONB NOT NULL,
    owner_uid TEXT,
    CHECK (materials_subtotal >= 0),
    CHECK (labour_charges >= 0),
    CHECK (additional_service_charges >= 0),
    CHECK (discount_amount >= 0),
    CHECK (tax_amount >= 0),
    CHECK (final_payable_amount >= 0),
    CHECK (amount_paid >= 0 AND amount_paid <= final_payable_amount)
);

CREATE UNIQUE INDEX uq_invoices_one_active_per_job
ON invoices (repair_job_id)
WHERE status = 'active';

-- 9. INVOICE LINE ITEMS
CREATE TABLE invoice_line_items (
    id TEXT PRIMARY KEY,
    invoice_id TEXT NOT NULL
        REFERENCES invoices(id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    inventory_item_id TEXT REFERENCES inventory_items(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    part_name TEXT NOT NULL,
    sku TEXT NOT NULL DEFAULT '',
    unit TEXT NOT NULL DEFAULT '',
    material_source TEXT NOT NULL,
    estimated_quantity NUMERIC(12,2),
    quantity NUMERIC(12,2) NOT NULL,
    unit_price NUMERIC(12,2) NOT NULL,
    line_total NUMERIC(12,2) NOT NULL,
    reason TEXT,
    CHECK (quantity > 0),
    CHECK (unit_price >= 0),
    CHECK (line_total >= 0)
);

-- 10. STOCK MOVEMENTS
CREATE TABLE stock_movements (
    id TEXT PRIMARY KEY,
    transaction_code TEXT NOT NULL,
    inventory_item_id TEXT NOT NULL
        REFERENCES inventory_items(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    part_name TEXT NOT NULL,
    sku TEXT NOT NULL,
    unit TEXT NOT NULL,
    transaction_type TEXT NOT NULL,
    previous_quantity NUMERIC(12,2) NOT NULL,
    quantity_delta NUMERIC(12,2) NOT NULL,
    updated_quantity NUMERIC(12,2) NOT NULL,
    repair_job_id TEXT,
    invoice_number TEXT,
    supplier_id TEXT REFERENCES suppliers(id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    supplier_name TEXT,
    movement_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    performed_by TEXT NOT NULL DEFAULT '',
    remarks TEXT NOT NULL DEFAULT '',
    owner_uid TEXT,
    CHECK (previous_quantity >= 0),
    CHECK (updated_quantity >= 0)
);

-- 11. NOTIFICATIONS
CREATE TABLE notifications (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    workshop TEXT NOT NULL DEFAULT '',
    booking_ref TEXT,
    inventory_item_id TEXT,
    time_ago TEXT NOT NULL DEFAULT '',
    notification_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    dismissed BOOLEAN NOT NULL DEFAULT FALSE,
    owner_uid TEXT
);

-- ==========================================
-- INDEXES FOR COMMON LOOKUPS
-- ==========================================

CREATE INDEX idx_inventory_supplier
ON inventory_items(supplier_id);

CREATE INDEX idx_inventory_low_stock
ON inventory_items(quantity_on_hand, minimum_stock);

CREATE INDEX idx_bookings_vehicle_date
ON service_bookings(vehicle_id, booking_date);

CREATE INDEX idx_bookings_workflow
ON service_bookings(workflow_column);

CREATE INDEX idx_invoices_booking
ON invoices(repair_job_id);

CREATE INDEX idx_invoice_lines_invoice
ON invoice_line_items(invoice_id);

CREATE INDEX idx_stock_movements_item_date
ON stock_movements(inventory_item_id, movement_timestamp DESC);

CREATE INDEX idx_notifications_dismissed
ON notifications(dismissed);
