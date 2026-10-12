import dotenv from 'dotenv';
import { defineConfig } from 'drizzle-kit';

dotenv.config({ path: '.env.local' });

// Use the direct (non-pooling) connection for DDL. The transaction-mode pooler
// (POSTGRES_URL, port 6543) is unreliable for schema push.
const baseUrl = process.env.POSTGRES_URL_NON_POOLING ?? process.env.POSTGRES_URL!;

// pg-connection-string v2.7+ treats sslmode=require as verify-full and rejects
// Supabase's cert chain. Restore libpq semantics (skip cert verification).
const url = baseUrl.includes('uselibpqcompat')
  ? baseUrl
  : `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}uselibpqcompat=true`;

export default defineConfig({
  out: './drizzle',
  schema: './schema.ts',
  dialect: 'postgresql',
  dbCredentials: { url },
});