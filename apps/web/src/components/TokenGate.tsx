"use client";

// TokenGate — single full-width input under the <Logo>. No button.
// Octopus admin tokens are exactly 64 hex chars (see
// installer/internal/token/token.go), so when the input reaches that
// length we POST /api/verify-token automatically.
//
// State surfacing:
//   idle      "enter token" placeholder, white border, value visible.
//   checking  border neutral, value fades to transparent, animated
//             "checking..." overlay fades in.
//   ok        border green, "success" overlay fades in.
//   bad       border red, "wrong token" overlay fades in.
//
// Result appears the instant the request resolves — no blur required,
// no second click. Any keystroke in a non-checking state drops back to
// idle so the user can retry.

import { useState, useRef, useEffect, type CSSProperties } from "react";

const TOKEN_LENGTH = 64;

// Width matches the trimmed render of "Octopus" (LOGO_EM_WIDTH minus
// the 1em horizontal padding cushion) so the input lines up exactly
// under the logo at any viewport.
const LOGO_TRIMMED_EM = 2.8125;

// Tight gap between the logo's "p" descender and the gate's top edge —
// roughly two logo pixels.
const TOP_GAP_EM = 0.125;

// Inner content scale — same fraction the version badge uses.
const INNER_FONT_EM = 0.2;

// Next.js doesn't auto-prefix fetch strings the way it does Link
// hrefs. Bake basePath in client-side ourselves.
const BASE_PATH = process.env.NEXT_PUBLIC_OCTOPUS_BASE_PATH ?? "";

type Status = "idle" | "checking" | "ok" | "bad";

const BORDER: Record<Status, string> = {
  idle: "#ffffff44",
  checking: "#ffffff44",
  ok: "#6ce26c",
  bad: "#e26c6c",
};
const OVERLAY_COLOR: Record<Status, string> = {
  idle: "transparent",
  checking: "#ffffffaa",
  ok: "#6ce26c",
  bad: "#e26c6c",
};
const OVERLAY_TEXT: Record<Status, string> = {
  idle: "",
  checking: "checking",
  ok: "success",
  bad: "wrong token",
};

export function TokenGate() {
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  // Tick counter that animates the "..." spinner while checking.
  const [tick, setTick] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (status !== "checking") {
      if (tickRef.current) clearInterval(tickRef.current);
      tickRef.current = null;
      return;
    }
    tickRef.current = setInterval(() => setTick((t) => t + 1), 250);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      tickRef.current = null;
    };
  }, [status]);

  function handleChange(raw: string) {
    if (status === "ok" || status === "bad") setStatus("idle");
    if (status === "checking") return;
    const next = raw.slice(0, TOKEN_LENGTH);
    setValue(next);
    if (next.length === TOKEN_LENGTH) {
      void verify(next);
    }
  }

  async function verify(token: string) {
    setStatus("checking");
    try {
      const res = await fetch(`${BASE_PATH}/api/verify-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      setStatus(res.ok ? "ok" : "bad");
    } catch {
      setStatus("bad");
    }
    // Keep value out of the way once we have a verdict; if user wants
    // to retry, they type and we drop back to idle which makes the
    // text visible again.
    setValue("");
  }

  const overlayText =
    status === "checking"
      ? `checking${".".repeat((tick % 3) + 1)}`
      : OVERLAY_TEXT[status];

  const wrapperStyle: CSSProperties = {
    position: "relative",
    width: `${LOGO_TRIMMED_EM}em`,
    marginTop: `${TOP_GAP_EM}em`,
  };

  const inputStyle: CSSProperties = {
    width: "100%",
    background: "transparent",
    color: status === "idle" ? "#ffffff" : "transparent",
    caretColor: status === "idle" ? "#ffffff" : "transparent",
    border: `1px solid ${BORDER[status]}`,
    outline: "none",
    padding: "0 0.5em",
    fontFamily: "inherit",
    fontSize: `${INNER_FONT_EM}em`,
    lineHeight: 1.5,
    boxSizing: "border-box",
    transition: "border-color 200ms ease, color 200ms ease",
  };

  const overlayStyle: CSSProperties = {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: OVERLAY_COLOR[status],
    fontSize: `${INNER_FONT_EM}em`,
    lineHeight: 1.5,
    pointerEvents: "none",
  };

  return (
    <div className="font-pixel" style={wrapperStyle}>
      <input
        type="text"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={status === "idle" ? "enter token" : ""}
        readOnly={status === "checking"}
        autoComplete="off"
        spellCheck={false}
        autoCapitalize="none"
        autoCorrect="off"
        aria-label="admin token"
        className="token-gate-input"
        style={inputStyle}
      />
      {status !== "idle" ? (
        // key={status} so each transition (idle→checking→ok|bad)
        // remounts the overlay and replays the fade-in animation.
        <div
          key={status}
          className="token-gate-overlay"
          style={overlayStyle}
        >
          {overlayText}
        </div>
      ) : null}
    </div>
  );
}
