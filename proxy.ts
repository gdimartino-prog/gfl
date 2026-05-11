// proxy.ts (formerly middleware.ts)
import { auth } from "@/auth";
import { NextResponse } from "next/server";

// Common bot/scanner paths — these never resolve to a real page in this app,
// so 404 at the edge instead of letting them invoke the Node /_not-found
// function (which renders the full layout chain).
const BOT_BAIT = /^\/(wp-admin|wp-login|wp-content|wp-includes|wordpress|phpmyadmin|admin\.php|\.env|\.git|vendor|xmlrpc|backup|setup|sftp-config|config\.json)/i;

// Rename the auth function to 'proxy' during export
export const proxy = auth((req) => {
  const pathname = req.nextUrl.pathname;

  if (BOT_BAIT.test(pathname)) {
    return new NextResponse(null, { status: 404 });
  }

  const isLoggedIn = !!req.auth;
  const isAuthPage = pathname.startsWith("/login");

  // Redirect to signin if accessing protected routes while logged out
  if (!isLoggedIn && !isAuthPage) {
    return Response.redirect(new URL("/api/auth/signin", req.nextUrl.origin));
  }
});

export const config = {
  matcher: [
    // Protected league routes — require auth
    "/transactions/:path*",
    "/draft/:path*",
    "/cuts/:path*",
    // Bot bait — 404 at edge before hitting the Node /_not-found function
    "/wp-admin/:path*",
    "/wp-login.php",
    "/wp-content/:path*",
    "/wp-includes/:path*",
    "/wordpress/:path*",
    "/phpmyadmin/:path*",
    "/admin.php",
    "/.env",
    "/.git/:path*",
    "/vendor/:path*",
    "/xmlrpc.php",
    "/backup/:path*",
    "/setup/:path*",
    "/sftp-config.json",
    "/config.json",
  ],
};