
import 'dotenv/config';

import { pool } from '../config/database.js';

import {
    INITIAL_GARAGE_CONFIG,
    INITIAL_SUPPLIERS,
    INITIAL_INVENTORY,
    INITIAL_SERVICE_TEMPLATES,
    INITIAL_STOCK_MOVEMENTS,
    INITIAL_VEHICLES,
    INITIAL_BOOKINGS,
    INITIAL_NOTIFICATIONS,
} from '../data/seedData.js';

const TABLES = [
    'garage_config',
    'suppliers',
    'inventory_items',
    'vehicles',
    'service_templates',
    'service_template_materials',
    'service_bookings',
    'invoices',
    'invoice_line_items',
    'stock_movements',
    'notifications',
] as const;

const JSONB_COLUMNS = new Set([
    'maintenance_checklist',
    'repair_checklist',
    'service_history',
    'estimated_materials',
    'actual_materials',
    'additional_materials',
]);

// Convert TypeScript camelCase property names to PostgreSQL snake_case.
// A few fields have different database column names, handled below.
function toColumnName(key: string, table: string): string {
    if (key === 'date' && table === 'service_bookings') {
        return 'booking_date';
    }

    if (key === 'timestamp' && table === 'stock_movements') {
        return 'movement_timestamp';
    }

    if (key === 'timestamp' && table === 'notifications') {
        return 'notification_timestamp';
    }

    return key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

async function insertRow(
    client: import('pg').PoolClient,
    table: string,
    record: Record<string, any>,
    excludedFields: string[] = [],
): Promise<void> {
    const entries = Object.entries(record).filter(
        ([key, value]) =>
            value !== undefined && !excludedFields.includes(key),
    );

    const columns = entries.map(([key]) => toColumnName(key, table));

    const values = entries.map(([key, value]) => {
        const column = toColumnName(key, table);

        if (JSONB_COLUMNS.has(column) && value !== null) {
            return JSON.stringify(value);
        }

        return value;
    });

    const placeholders = values.map((_, index) => `$${index + 1}`);

    const sql = `
    INSERT INTO ${table} (${columns.join(', ')})
    VALUES (${placeholders.join(', ')})
  `;

    await client.query(sql, values);
}

async function seedDatabase(): Promise<void> {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Prevent accidental duplicate or destructive seeding.
        for (const table of TABLES) {
            const result = await client.query(
                `SELECT COUNT(*)::int AS count FROM ${table}`,
            );

            const count = result.rows[0].count;

            if (count > 0) {
                throw new Error(
                    `Table "${table}" already contains ${count} record(s). Seeding stopped.`,
                );
            }
        }

        console.log('All database tables are empty. Starting seed...');

        // 1. Garage configuration
        await insertRow(client, 'garage_config', INITIAL_GARAGE_CONFIG);

        // 2. Suppliers
        for (const supplier of INITIAL_SUPPLIERS) {
            await insertRow(client, 'suppliers', supplier);
        }

        // 3. Inventory items
        for (const item of INITIAL_INVENTORY) {
            await insertRow(client, 'inventory_items', item);
        }

        // 4. Service templates
        for (const template of INITIAL_SERVICE_TEMPLATES) {
            await insertRow(
                client,
                'service_templates',
                template as unknown as Record<string, any>,
                ['materials'],
            );

            // 5. Materials belonging to each service template
            for (const material of template.materials) {
                await insertRow(client, 'service_template_materials', {
                    ...material,
                    serviceTemplateId: template.id,
                });
            }
        }

        // 6. Vehicles
        for (const vehicle of INITIAL_VEHICLES) {
            await insertRow(
                client,
                'vehicles',
                vehicle as unknown as Record<string, any>,
            );
        }

        // 7. Service bookings
        for (const booking of INITIAL_BOOKINGS) {
            await insertRow(
                client,
                'service_bookings',
                booking as unknown as Record<string, any>,
            );
        }

        // 8. Initial stock movements
        for (const movement of INITIAL_STOCK_MOVEMENTS) {
            await insertRow(
                client,
                'stock_movements',
                movement as unknown as Record<string, any>,
            );
        }

        // 9. Notifications
        for (const notification of INITIAL_NOTIFICATIONS) {
            const record = {
                ...notification,
                timestamp: notification.timestamp,
            };

            await insertRow(
                client,
                'notifications',
                record as unknown as Record<string, any>,
            );
        }

        await client.query('COMMIT');

        console.log('\nDatabase seeding completed successfully!');

        for (const table of TABLES) {
            const result = await client.query(
                `SELECT COUNT(*)::int AS count FROM ${table}`,
            );

            console.log(`${table}: ${result.rows[0].count}`);
        }
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('\nDatabase seeding failed. All changes were rolled back.');
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

seedDatabase().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
