import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db } from './index';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';

// In production (Railway), environment variables are already parsed.
// This is mainly for local seeding/testing.
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

async function runMigrate() {
  console.log('Running migrations...');
  
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is missing. Please set it in your environment.');
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  
  try {
    // Railway usually runs commands from the project root.
    // If not, we might need path.join(process.cwd(), 'api/drizzle')
    const migrationsFolder = path.resolve(process.cwd(), 'drizzle');
    console.log(`Looking for migrations in: ${migrationsFolder}`);
    
    await migrate(db, { migrationsFolder });
    console.log('Migrations completed successfully.');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrate();
