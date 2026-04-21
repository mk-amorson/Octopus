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
const HOME_PATH = "/";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // The matcher below already excludes `/api/auth/*` from middleware
  // entirely, so the login/logout endpoints stay reachable without a
  // session cookie. Everything else that reaches this function is
  // gated.

  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  const authed = await verify(cookie);

  if (pathname === LOGIN_PATH) {
    if (authed) {
      // Already logged in — send the user to their original target (or
      // the dashboard as a default).
      const target = req.nextUrl.searchParams.get("redirect") || HOME_PATH;
      return NextResponse.redirect(redirectTo(req, target));
    }
    return NextResponse.next();
  }

  if (!authed) {
    const url = redirectTo(req, LOGIN_PATH);
    // Preserve the originally-requested path so /login can bounce back
    // to it after a successful token entry. Skip the root and anything
    // under /api so the query string stays free of noise / secrets.
    if (pathname !== HOME_PATH && !pathname.startsWith("/api/")) {
      url.searchParams.set("redirect", pathname);
    }
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

// redirectTo builds a redirect target that preserves the installer's
// basePath. `req.nextUrl.clone()` returns a NextURL — a URL-ish object
// that carries basePath separately from pathname, and re-prepends it
// on serialization. Plain `new URL(path, req.url)` would resolve
// against the full request URL and strip basePath, which is how
// v0.1.25 shipped — pushing users at /login instead of /octopus/login
// and dead-ending them at a Caddy 404.
function redirectTo(req: NextRequest, path: string): URL {
  const url = req.nextUrl.clone();
  url.pathname = path;
  url.search = "";
  return url;
}

export const config = {
  // Two entries on purpose:
  //   - "/"  matches the bare root. A single `/((?!…).*)` pattern does
  //          NOT match the root once Next prepends basePath: the
  //          generated regex becomes `^/<basePath>(?:/((?!…).*))…` and
  //          the non-optional `/` after basePath fails on the naked
  //          root, so middleware silently skipped it and served the
  //          cached static dashboard to every visitor regardless of
  //          their cookie. Explicitly listing "/" is the fix.
  //   - the second pattern covers every non-root path, minus Next's
  //     own asset pipeline, the auth endpoints (always reachable
  //     without a session cookie so a fresh visitor can log in), and
  //     `api/hooks/*` (third-party webhook inboxes — Telegram,
  //     Stripe, GitHub — can't authenticate with a session).
  matcher: ["/", "/((?!_next|favicon.ico|fonts|api/auth|api/hooks).+)"],
};
