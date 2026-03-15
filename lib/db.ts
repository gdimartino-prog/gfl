
import { drizzle } from 'drizzle-orm/vercel-postgres';
import { createPool } from '@vercel/postgres';
import * as schema from '../schema';

export const db = drizzle(createPool({
    connectionString: process.env.POSTGRES_URL
}), { schema });
