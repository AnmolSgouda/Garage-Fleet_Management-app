
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    throw new Error('DATABASE_URL is not configured');
}

export const pool = new Pool({
    connectionString,
    ssl: connectionString.includes('render.com')
        ? { rejectUnauthorized: false }
        : undefined,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
});

pool.on('error', (error) => {
    console.error('Unexpected PostgreSQL pool error:', error);
});

export async function testDatabaseConnection(): Promise<void> {
    const result = await pool.query('SELECT NOW() AS current_time');

    console.log('PostgreSQL connected successfully!');
    console.log('Database time:', result.rows[0].current_time);
}
