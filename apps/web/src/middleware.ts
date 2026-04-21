// Single gate for the whole app: every request except the login page
// and its backing API endpoints is checked for a valid session cookie.
//
// Next.js runs middleware in the edge runtime and strips the installer-
// chosen basePath before we see the URL, so matchers and redirects
// here work against root-relative paths. Redirects built via
// `new URL(path, req.url)` do the right thing — Next re-attaches the
// basePath on the outbound Location.

import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_NAME } from "@/lib/auth/config";
import { verify } from "@/lib/auth/session";

const LOGIN_PATH = "/login";
const API_LOGIN = "/api/auth/login";
const API_LOGOUT = "/api/auth/logout";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // The login POST and logout POST are the two endpoints that are
  // reachable without a session — everything else (including every
  // future API route) is gated.
  if (pathname === API_LOGIN || pathname === API_LOGOUT) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  const authed = await verify(cookie);

  if (pathname === LOGIN_PATH) {
    // Already logged in? Skip the gate — send the user to the dashboard
    // (or wherever they were originally going).
    if (authed) {
      const redirect = req.nextUrl.searchParams.get("redirect") || "/";
      return NextResponse.redirect(new URL(redirect, req.url));
    }
    return NextResponse.next();
  }

  if (!authed) {
    const url = new URL(LOGIN_PATH, req.url);
    // Preserve the originally-requested path so login can bounce back
    // to it. Only keep safe same-origin paths.
    if (pathname !== "/" && !pathname.startsWith("/api/")) {
      url.searchParams.set("redirect", pathname);
    }
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Exclude Next's own asset pipeline and common static files. Every
  // page and API route stays gated.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|fonts/).*)"],
};
