import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { pool } from '../config/database.js';

async function main() {
    try {
        const schemaPath = path.resolve('backend/src/db/schema.sql');
        const sql = fs.readFileSync(schemaPath, 'utf8');

        await pool.query(sql);

        console.log('All database tables created successfully!');

        const result = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

        console.log('Tables in your database:');
        console.table(result.rows);
    } catch (error) {
        console.error('Failed to create database tables:', error);
    } finally {
        await pool.end();
    }
}

main();