import { headers } from 'next/headers';
import Link from 'next/link';

// Diagnostic logging — capture what's actually 404-ing so we can decide
// whether to block more paths in proxy.ts or accept the traffic.
// Remove this once we have data.
export default async function NotFound() {
  const h = await headers();
  const path =
    h.get('x-invoke-path') ??
    h.get('x-matched-path') ??
    h.get('next-url') ??
    h.get('x-forwarded-uri') ??
    'unknown';
  const referer = h.get('referer') ?? '';
  const userAgent = h.get('user-agent') ?? '';
  console.log('[404]', JSON.stringify({ path, referer, userAgent }));

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center p-12">
        <h1 className="text-6xl font-black text-slate-900 tracking-tighter italic uppercase">
          404
        </h1>
        <p className="text-gray-500 font-bold uppercase text-xs tracking-widest mt-4 mb-8">
          Page Not Found
        </p>
        <Link
          href="/"
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-colors"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}
