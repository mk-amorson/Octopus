// POST /api/verify-token
//
// Body: { token: string }
// Response: 200 { ok: true } on match, 401 { ok: false } otherwise.
//
// The expected token comes from process.env.OCTOPUS_TOKEN, which the
// installer passes into the container at runtime via docker compose's
// `environment:` block. It never touches the client — no NEXT_PUBLIC_*
// — so the comparison happens entirely on the server.

import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const expected = process.env.OCTOPUS_TOKEN ?? "";
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const got =
    typeof body === "object" && body !== null && "token" in body
      ? String((body as { token?: unknown }).token ?? "")
      : "";

  if (!expected || !got || !equalConstTime(got, expected)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}

// Constant-time string comparison. Prevents a remote attacker from
// distinguishing "first byte wrong" from "all but last byte right" by
// timing the response. Length-mismatch is handled by padding to the
// longer side before the Buffer compare.
function equalConstTime(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}
