"use client";

// TokenGate — single full-width input under the <Logo>. No button.
// Octopus admin tokens are exactly 64 hex chars (see
// installer/internal/token/token.go), so the moment the input
// reaches that length we POST /api/verify-token automatically.
//
// State surfaces inside the input itself:
//   idle      "enter token" placeholder, white border
//   checking  animated "checking..." placeholder, neutral border
//   ok        "success" placeholder, green border
//   bad       "wrong token" placeholder, red border
//
// On any keystroke after a result the input drops back to idle so
// the user can retry without UI furniture.

import { useState, useRef, useEffect, type CSSProperties } from "react";

const TOKEN_LENGTH = 64;

// Width matches the trimmed render of "Octopus" (LOGO_EM_WIDTH minus
// the 1em horizontal padding cushion) so the input lines up exactly
// under the logo at any viewport.
const LOGO_TRIMMED_EM = 2.8125;

// Top edge sits roughly where the previous gate's bottom edge was
// — about an input height of breathing room from the descender of
// "p". A literal "input height" calc works out to ~0.3em logo; we
// round up to 0.375 so the seam doesn't kiss the descender.
const TOP_GAP_EM = 0.375;

// Inner content shrinks to a fraction of the logo so it stays
// readable across the viewport-driven logo size.
const INNER_FONT_EM = 0.2;

// Next.js doesn't auto-prefix fetch strings the way it does Link
// hrefs, so we have to bake basePath in client-side ourselves.
const BASE_PATH = process.env.NEXT_PUBLIC_OCTOPUS_BASE_PATH ?? "";

type Status = "idle" | "checking" | "ok" | "bad";

const PLACEHOLDER: Record<Status, string> = {
  idle: "enter token",
  checking: "checking",
  ok: "success",
  bad: "wrong token",
};
const BORDER: Record<Status, string> = {
  idle: "#ffffff44",
  checking: "#ffffff44",
  ok: "#6ce26c",
  bad: "#e26c6c",
};
const PLACEHOLDER_COLOR: Record<Status, string> = {
  idle: "#ffffff66",
  checking: "#ffffffaa",
  ok: "#6ce26c",
  bad: "#e26c6c",
};

export function TokenGate() {
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  // Tick counter that drives the "..." spinner animation while
  // status === "checking". Cleared as soon as we leave that state.
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
    // Any keystroke from a non-idle result clears the colour and
    // lets the user keep typing.
    if (status === "ok" || status === "bad") {
      setStatus("idle");
    }
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
    // Always clear so the placeholder ("success" / "wrong token") is
    // visible without the user's input on top of it.
    setValue("");
  }

  const placeholderText =
    status === "checking"
      ? `checking${".".repeat((tick % 3) + 1)}`
      : PLACEHOLDER[status];

  // CSS custom property feeds globals.css's ::placeholder rule,
  // which is the only way to colour placeholder text without
  // shipping a separate CSS-in-JS layer.
  const inputStyle: CSSProperties & Record<"--placeholder-color", string> = {
    width: "100%",
    background: "transparent",
    color: "#ffffff",
    caretColor: "#ffffff",
    border: `1px solid ${BORDER[status]}`,
    outline: "none",
    padding: "0 0.5em",
    fontFamily: "inherit",
    fontSize: `${INNER_FONT_EM}em`,
    lineHeight: 1.5,
    boxSizing: "border-box",
    transition: "border-color 120ms ease",
    "--placeholder-color": PLACEHOLDER_COLOR[status],
  };

  return (
    <div
      className="font-pixel"
      // No fontSize override here on purpose: width is in em of the
      // *logo*'s font-size (inherited from the parent column), so
      // 2.8125em really is the trimmed logo width.
      style={{ width: `${LOGO_TRIMMED_EM}em`, marginTop: `${TOP_GAP_EM}em` }}
    >
      <input
        type="text"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholderText}
        readOnly={status === "checking"}
        autoComplete="off"
        spellCheck={false}
        autoCapitalize="none"
        autoCorrect="off"
        aria-label="admin token"
        className="token-gate-input"
        style={inputStyle}
      />
    </div>
  );
}
