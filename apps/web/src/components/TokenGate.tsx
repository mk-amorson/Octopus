"use client";

// TokenGate sits beneath the <Logo>. Single full-width input, no
// submit button: the moment the user has typed (or pasted) all
// TOKEN_LENGTH characters we POST to /api/verify-token automatically.
// While the request is in flight, the input shows a pixel-style
// "checking" indicator. On 200 the border turns green and "success"
// stays in the box; on anything else the border turns red and
// "wrong token" replaces the value.

import { useState, useRef, type CSSProperties } from "react";

// Octopus admin tokens are always exactly this long: 32 random bytes,
// hex-encoded → 64 characters. See installer/internal/token/token.go.
const TOKEN_LENGTH = 64;

// Same derivation as in TokenGate v0.1.14 — width matches the trimmed
// rendered "Octopus" so the input sits flush under the logo.
//
//   "Octop" = 2.1875em + "us" = 0.75em → 2.9375em total. The logo's
//   own h1 trim (-0.125em) is accounted for in the parent column.
const TOTAL_EM = 2.9375;

// Top edge of the input lands roughly where the previous gate's
// bottom edge was — i.e. ~ one input-height down from the logo —
// so there's room to breathe between the two.
const TOP_GAP_EM = 0.375;

// Inner content scaled to a fraction of the logo so it stays
// readable at any viewport-derived logo size.
const INNER_FONT_EM = 0.2;

// Both client and server trim before comparing, but the API URL
// itself needs the basePath because Next.js doesn't auto-prefix
// fetch strings.
const BASE_PATH = process.env.NEXT_PUBLIC_OCTOPUS_BASE_PATH ?? "";

type Status = "idle" | "checking" | "ok" | "bad";

const BORDER_FOR: Record<Status, string> = {
  idle: "#ffffff44",
  checking: "#ffffff44",
  ok: "#6ce26c",
  bad: "#e26c6c",
};
const TEXT_FOR: Record<Status, string> = {
  idle: "#ffffff",
  checking: "#ffffffaa",
  ok: "#6ce26c",
  bad: "#e26c6c",
};

export function TokenGate() {
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  // Tick counter that drives the "..." spinner animation. setInterval
  // updates it once per beat so the pixel font cycles ".  / .. / ..."
  const [tick, setTick] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function startSpinner() {
    if (tickRef.current) return;
    tickRef.current = setInterval(() => setTick((t) => t + 1), 250);
  }
  function stopSpinner() {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }

  async function verify(token: string) {
    setStatus("checking");
    startSpinner();
    try {
      const res = await fetch(`${BASE_PATH}/api/verify-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (res.ok) {
        setStatus("ok");
      } else {
        setStatus("bad");
      }
    } catch {
      setStatus("bad");
    } finally {
      stopSpinner();
    }
  }

  function onChange(raw: string) {
    // If the user starts typing again after a result, clear the
    // result colours and let them try a new value.
    if (status === "bad" || status === "ok") {
      setStatus("idle");
    }
    // Restrict to the alphabet of a hex token so paste-from-anywhere
    // doesn't accept an obviously-wrong value (e.g. with quotes).
    // Also caps length at TOKEN_LENGTH so the auto-verify trigger
    // is unambiguous.
    const cleaned = raw.replace(/[^0-9a-fA-F]/g, "").slice(0, TOKEN_LENGTH);
    setValue(cleaned);
    if (cleaned.length === TOKEN_LENGTH) {
      void verify(cleaned);
    }
  }

  // What's actually rendered inside the box. We swap the input out
  // for read-only text in the success/failure states so the message
  // is visible regardless of mask/colour.
  let display: string;
  if (status === "ok") display = "success";
  else if (status === "bad") display = "wrong token";
  else if (status === "checking") {
    const dots = ".".repeat((tick % 3) + 1);
    display = `checking${dots}`;
  } else display = value;

  const wrapperStyle: CSSProperties = {
    width: `${TOTAL_EM}em`,
    marginTop: `${TOP_GAP_EM}em`,
    fontSize: `${INNER_FONT_EM}em`,
  };
  const inputStyle: CSSProperties = {
    width: "100%",
    background: "transparent",
    color: TEXT_FOR[status],
    border: `1px solid ${BORDER_FOR[status]}`,
    outline: "none",
    padding: "0 0.5em",
    fontFamily: "inherit",
    fontSize: "inherit",
    lineHeight: 1.5,
    boxSizing: "border-box",
    // CSS transition so the colour swap doesn't snap.
    transition: "border-color 120ms ease, color 120ms ease",
  };

  // Lock the field while we're checking / showing a non-idle result —
  // re-typing is allowed only by clicking back into idle, which we do
  // automatically on key input above.
  const editable = status === "idle";

  return (
    <div className="font-pixel" style={wrapperStyle}>
      <input
        type="text"
        value={editable ? value : display}
        onChange={(e) => onChange(e.target.value)}
        placeholder="enter token"
        readOnly={!editable}
        autoComplete="off"
        spellCheck={false}
        autoCapitalize="none"
        autoCorrect="off"
        aria-label="admin token"
        style={inputStyle}
      />
    </div>
  );
}
