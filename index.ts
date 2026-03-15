import { drizzle } from '@vercel/postgres';
import { sql } from '@vercel/postgres';
import * as schema from './schema';

export const db = drizzle(sql, { schema });
export * from './schema';