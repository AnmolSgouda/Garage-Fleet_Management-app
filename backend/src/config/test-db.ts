
import 'dotenv/config';
import { pool } from './database.js';

async function main() {
    try {
        const result = await pool.query('SELECT NOW() AS current_time');

        console.log('Database test successful!');
        console.log('PostgreSQL server time:', result.rows[0].current_time);
    } catch (error) {
        console.error('Database connection failed:', error);
    } finally {
        await pool.end();
    }
}

main();
