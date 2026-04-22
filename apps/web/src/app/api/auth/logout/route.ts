// POST /api/auth/logout — clears the session cookie. Always 200, so a
// logout request from a stale client still leaves the browser in a
// clean state.

import { NextResponse } from "next/server";
import { COOKIE_NAME } from "@/lib/auth/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
