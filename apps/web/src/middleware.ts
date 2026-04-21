// Single gate for the whole app: every request except the login page
// and its backing API endpoints is checked for a valid session cookie.
// A `?token=<admin-token>` query param is honoured as a magic-link
// login — after validating it once, we set the cookie and 307 back
// to the same URL without the token, so the secret never lingers in
// the browser's address bar.
//
// Next.js runs middleware in the edge runtime and strips the installer-
// chosen basePath before we see the URL, so matchers and redirects
// here work against root-relative paths. Redirects built via
// `req.nextUrl.clone()` preserve basePath on serialisation.

import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_NAME, SESSION_MAX_AGE_MS } from "@/lib/auth/config";
import { issue, matchesAdminToken, verify } from "@/lib/auth/session";
import { clientIp, take } from "@/lib/auth/rateLimit";

const LOGIN_PATH = "/login";
const HOME_PATH = "/";
const TOKEN_PARAM = "token";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  let authed = await verify(cookie);

  // Magic-link path. Runs BEFORE the usual auth fork so an unauth'd
  // visitor who pasted the URL with ?token= ends up logged in on the
  // first hop. Rate-limited identically to /api/auth/login to cap
  // brute-force exposure through URL probes.
  const tokenParam = req.nextUrl.searchParams.get(TOKEN_PARAM);
  if (tokenParam !== null) {
    return await handleMagicLink(req, tokenParam, authed);
  }

  if (pathname === LOGIN_PATH) {
    if (authed) {
      const target = req.nextUrl.searchParams.get("redirect") || HOME_PATH;
      return NextResponse.redirect(redirectTo(req, target));
    }
    return NextResponse.next();
  }

  if (!authed) {
    const url = redirectTo(req, LOGIN_PATH);
    if (pathname !== HOME_PATH && !pathname.startsWith("/api/")) {
      url.searchParams.set("redirect", pathname);
    }
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

// handleMagicLink always returns a redirect that strips `?token=`,
// whether the token matched or not — the secret must never stay in
// the URL longer than the first request. On a match we also attach
// a fresh session cookie so the follow-up request lands authed.
async function handleMagicLink(
  req: NextRequest,
  token: string,
  authed: boolean,
): Promise<NextResponse> {
  const clean = req.nextUrl.clone();
  clean.searchParams.delete(TOKEN_PARAM);
  const res = NextResponse.redirect(clean);

  // Already logged in? Nothing to validate — just drop the param.
  // Skipping matchesAdminToken also means we don't burn a rate-limit
  // slot on harmless revisits of a shared link.
  if (authed) return res;

  const rate = take(clientIp(req.headers));
  if (!rate.ok) return res;

  if (await matchesAdminToken(token)) {
    const value = await issue();
    res.cookies.set({
      name: COOKIE_NAME,
      value,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: Math.floor(SESSION_MAX_AGE_MS / 1000),
    });
  }
  return res;
}

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
  //     own asset pipeline and the auth endpoints (always reachable
  //     without a session cookie so a fresh visitor can log in).
  //     `/api/hooks/*` will get added back the moment we ship a node
  //     type that owns a webhook (Telegram, Stripe, GitHub, …).
  matcher: ["/", "/((?!_next|favicon.ico|fonts|api/auth).+)"],
};
