// proxy.ts (formerly middleware.ts)
import { auth } from "@/auth";

// Rename the auth function to 'proxy' during export
export const proxy = auth((req) => {
  const isLoggedIn = !!req.auth;
  const isAuthPage = req.nextUrl.pathname.startsWith("/login");

  // Redirect to signin if accessing protected routes while logged out
  if (!isLoggedIn && !isAuthPage) {
    return Response.redirect(new URL("/api/auth/signin", req.nextUrl.origin));
  }
});

export const config = {
  // Protect specific fantasy league paths
  matcher: ["/transactions/:path*", "/draft/:path*", "/cuts/:path*"],
};