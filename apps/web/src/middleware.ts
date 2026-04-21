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

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // The matcher below already excludes `/api/auth/*` from middleware
  // entirely, so the login/logout endpoints stay reachable without a
  // session cookie. Everything else that reaches this function is
  // gated.

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
  // Two entries on purpose:
  //   - "/"  matches the bare root. A single `/((?!…).*)` pattern does
  //          NOT match the root once Next prepends basePath: the
  //          generated regex becomes `^/<basePath>(?:/((?!…).*))…` and
  //          the non-optional `/` after basePath fails on the naked
  //          root, so middleware silently skipped it and served the
  //          cached static dashboard to every visitor regardless of
  //          their cookie. Explicitly listing "/" is the fix.
  //   - the second pattern covers every non-root path, minus Next's
  //     own asset pipeline and the auth endpoints (so they're always
  //     reachable without a session cookie).
  matcher: ["/", "/((?!_next|favicon.ico|fonts|api/auth).+)"],
};
