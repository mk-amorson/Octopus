// POST /api/auth/login
//
// Body:    { token: string }
// Success: 200 { ok: true }   + Set-Cookie: octopus_session=...
// Bad:     401 { ok: false }
// Flood:   429 { ok: false }  + Retry-After header
// Garbled: 400 { ok: false }
//
// The admin token comes from OCTOPUS_TOKEN in the container environment
// (injected by the installer). It never leaves the server; all the
// browser ever sees is the signed session cookie the login issues on
// a correct match.

import { NextResponse } from "next/server";
import { COOKIE_NAME, SESSION_MAX_AGE_MS } from "@/lib/auth/config";
import { issue, matchesAdminToken } from "@/lib/auth/session";
import { clientIp, take } from "@/lib/auth/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const rate = take(clientIp(req.headers));
  if (!rate.ok) {
    return NextResponse.json(
      { ok: false },
      {
        status: 429,
        headers: { "Retry-After": Math.ceil(rate.retryAfterMs / 1000).toString() },
      },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const submitted =
    typeof body === "object" && body !== null && "token" in body
      ? String((body as { token?: unknown }).token ?? "")
      : "";

  if (!(await matchesAdminToken(submitted))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const value = await issue();
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: COOKIE_NAME,
    value,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(SESSION_MAX_AGE_MS / 1000),
    // `secure` is omitted on purpose: we don't know at request time
    // whether we're being reverse-proxied over TLS by Caddy or served
    // plain on localhost. Lax SameSite + httpOnly is enough for a
    // single-user self-hosted app, and "secure" would break the
    // plain-http localhost case.
  });
  return res;
}
