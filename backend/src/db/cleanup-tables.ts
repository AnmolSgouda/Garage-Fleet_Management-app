
import 'dotenv/config';
import { pool } from '../config/database.js';

async function main() {
    try {
        await pool.query(`
      DROP TABLE IF EXISTS
        invoice_line_items,
        invoices,
        service_template_materials,
        service_templates,
        stock_movements,
        notifications,
        bookings,
        service_bookings,
        inventory,
        inventory_items,
        suppliers,
        vehicles,
        garage_configs,
        garage_config
      CASCADE;
    `);

        console.log('Temporary tables removed successfully!');
    } catch (error) {
        console.error('Cleanup failed:', error);
    } finally {
        await pool.end();
    }
}

main();
