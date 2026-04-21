"use client";

// TokenGate is the input + verify-button pair that sits right below
// the <Logo>. The outer box is sized in em of the *logo's* font-size
// (inherited from the wrapping column), so the split lines up under
// "Octop" and "us" regardless of viewport. The actual text content
// is rendered at a small fraction of that size.

import { useState, type CSSProperties } from "react";

// Glyph advance widths in em (UPM = 1024). Same derivation as
// LOGO_EM_WIDTH in Logo.tsx, split in two:
//
//   "Octop" = O+c+t+o+p = 2240 / 1024 = 2.1875 em  (input slot)
//   "us"    = u+s       =  896 / 1024 = 0.875  em, minus the 0.125 em
//                         trim applied to the logo's last letter =
//                         0.75 em                  (button slot)
const INPUT_EM = 2.1875;
const BUTTON_EM = 0.75;
const TOTAL_EM = INPUT_EM + BUTTON_EM;

// One logo-pixel (64/1024 em) of vertical breathing room between the
// logo baseline and the gate's top edge.
const TOP_GAP_EM = 0.0625;

// Inner text content (placeholder, button glyph, error message) is
// scaled down relative to the logo so it reads comfortably at the
// viewport-driven logo size.
const INNER_FONT_EM = 0.2;

// Baked in at build time (see apps/web/Dockerfile). When Next.js is
// served under a basePath (e.g. "/octopus"), the app's API routes live
// at `${basePath}/api/*` too — but fetch() doesn't know about basePath,
// so we have to prepend it manually here.
const BASE_PATH = process.env.NEXT_PUBLIC_OCTOPUS_BASE_PATH ?? "";

type Status = "idle" | "checking" | "ok" | "bad";

export function TokenGate() {
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  async function verify() {
    // Trim so a stray newline or surrounding space from a terminal
    // copy-paste doesn't false-fail the comparison.
    const trimmed = value.trim();
    if (!trimmed || status === "checking") return;
    setStatus("checking");
    try {
      const res = await fetch(`${BASE_PATH}/api/verify-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: trimmed }),
      });
      if (res.ok) {
        setStatus("ok");
      } else {
        setStatus("bad");
        setValue("");
      }
    } catch {
      setStatus("bad");
      setValue("");
    }
  }

  const buttonGlyph =
    status === "ok" ? "\u2713" : status === "bad" ? "\u2715" : "\u2192";

  // Wrapper stays at the logo's font-size so `em` widths track the
  // logo's glyph widths. Inner flex drops to INNER_FONT_EM for
  // readable text content.
  const wrapperStyle: CSSProperties = {
    width: `${TOTAL_EM}em`,
    marginTop: `${TOP_GAP_EM}em`,
  };
  const rowStyle: CSSProperties = {
    display: "flex",
    fontSize: `${INNER_FONT_EM}em`,
  };
  const cellBase: CSSProperties = {
    background: "transparent",
    border: "1px solid #ffffff44",
    outline: "none",
    fontFamily: "inherit",
    fontSize: "inherit",
    lineHeight: 1.5,
    boxSizing: "border-box",
  };

  return (
    <div className="font-pixel" style={wrapperStyle}>
      <div style={rowStyle}>
        <input
          type="password"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (status !== "idle") setStatus("idle");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") verify();
          }}
          aria-label="admin token"
          autoComplete="off"
          spellCheck={false}
          style={{
            ...cellBase,
            flex: `${INPUT_EM} 0 0`,
            color: "#fff",
            padding: "0 0.5em",
          }}
        />
        <button
          type="button"
          onClick={verify}
          aria-label="verify token"
          style={{
            ...cellBase,
            flex: `${BUTTON_EM} 0 0`,
            borderLeft: "none",
            cursor: "pointer",
            color:
              status === "ok"
                ? "#6ce26c"
                : status === "bad"
                ? "#e26c6c"
                : "#fff",
          }}
        >
          {buttonGlyph}
        </button>
      </div>
      {status === "bad" ? (
        <p
          style={{
            color: "#e26c6c",
            margin: 0,
            marginTop: "0.25em",
            fontSize: `${INNER_FONT_EM}em`,
            lineHeight: 1.2,
          }}
        >
          token mismatch
        </p>
      ) : null}
    </div>
  );
}
