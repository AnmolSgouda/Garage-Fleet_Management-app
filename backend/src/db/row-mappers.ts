
const NUMERIC_COLUMNS = new Set([
    'tax_rate_percent',
    'next_invoice_sequence',
    'quantity_on_hand',
    'minimum_stock',
    'purchase_cost',
    'selling_price',
    'odometer',
    'engine_running_hours',
    'default_labour_charge',
    'default_quantity',
    'labour_charges',
    'additional_service_charges',
    'discount_amount',
    'estimated_quantity',
    'actual_quantity',
    'quantity',
    'unit_price',
    'line_total',
    'odometer_reading',
    'materials_subtotal',
    'tax_amount',
    'final_payable_amount',
    'amount_paid',
    'previous_quantity',
    'quantity_delta',
    'updated_quantity',
]);

const SPECIAL_COLUMNS: Record<string, string> = {
    booking_date: 'date',
    movement_timestamp: 'timestamp',
    notification_timestamp: 'timestamp',
};

export function mapDatabaseRow<T>(row: Record<string, unknown>): T {
    const mapped: Record<string, unknown> = {};

    for (const [column, originalValue] of Object.entries(row)) {
        const property =
            SPECIAL_COLUMNS[column] ??
            column.replace(/_([a-z])/g, (_, letter: string) =>
                letter.toUpperCase()
            );

        let value = originalValue;

        if (value instanceof Date) {
            value = value.toISOString();
        } else if (
            NUMERIC_COLUMNS.has(column) &&
            value !== null &&
            value !== undefined
        ) {
            value = Number(value);
        }

        mapped[property] = value;
    }

    return mapped as T;
}

export function mapDatabaseRows<T>(
    rows: Record<string, unknown>[]
): T[] {
    return rows.map((row) => mapDatabaseRow<T>(row));
}
