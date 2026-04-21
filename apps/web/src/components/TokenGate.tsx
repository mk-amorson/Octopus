"use client";

// TokenGate is a single styled box under the <Logo>. Its contents
// switch between an editable <input> (idle) and a read-only <span>
// (checking / ok / bad), but every geometric concern — padding,
// border, font, line-height, height, width — lives on the wrapper.
// Children just inherit. There is no second copy of any measurement
// to keep in sync, and the placeholder, the input value, and the
// result message all render in the same spot because they all sit
// in the same flex slot inside the wrapper.

import { useState, useRef, useEffect } from "react";

const TOKEN_LENGTH = 64;

// Width matches the VISIBLE render of "Octopus" — from the first
// pixel of "O" to the last pixel of "s". Same 2.9375em the Logo
// component trims itself to via `margin-right: -0.125em`.
const LOGO_TRIMMED_EM = 2.9375;

// Tight gap between the logo's "p" descender and the gate's top
// edge — about two logo-pixels.
const TOP_GAP_EM = 0.125;

// Next.js doesn't auto-prefix fetch strings the way it does Link
// hrefs. Bake basePath in client-side ourselves.
const BASE_PATH = process.env.NEXT_PUBLIC_OCTOPUS_BASE_PATH ?? "";

type Status = "idle" | "checking" | "ok" | "bad";

const MESSAGE: Record<Status, string> = {
  idle: "",
  checking: "checking",
  ok: "success",
  bad: "wrong token",
};

export function TokenGate() {
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [tick, setTick] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const wantFocusOnIdle = useRef(false);

  // Spinner animation while the request is in flight. Only this
  // useEffect knows about timers; the rest of the component just
  // reacts to `tick`.
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

  // After a "bad → idle" retry we want the input to be focused so
  // the user can type immediately. Don't focus on the first mount
  // (that would steal focus on page load) — the ref flag gates it.
  useEffect(() => {
    if (status === "idle" && wantFocusOnIdle.current) {
      wantFocusOnIdle.current = false;
      inputRef.current?.focus();
    }
  }, [status]);

  function onInput(raw: string) {
    if (status !== "idle") return;
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
    setValue("");
  }

  function retry() {
    // Only "bad" is recoverable: clicking either the message or the
    // wrapper drops us back to a fresh input. "ok" stays sticky;
    // "checking" should be left alone.
    if (status !== "bad") return;
    wantFocusOnIdle.current = true;
    setStatus("idle");
  }

  const message =
    status === "checking"
      ? `checking${".".repeat((tick % 3) + 1)}`
      : MESSAGE[status];

  return (
    <div
      // font-pixel is what pins the whole gate to the octopus-pixel
      // font-family; without it the tree falls back to sans.
      className="token-gate font-pixel"
      data-status={status}
      onClick={status === "bad" ? retry : undefined}
      // Two instance-level overrides. Nothing else: fontSize is
      // *deliberately* not set here so `em` values in the inline
      // styles (and in the CSS rules below) measure in the logo's
      // font-size, which is what we inherit from the parent column.
      style={{
        width: `${LOGO_TRIMMED_EM}em`,
        marginTop: `${TOP_GAP_EM}em`,
      }}
    >
      {status === "idle" ? (
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onInput(e.target.value)}
          placeholder="enter token"
          autoComplete="off"
          spellCheck={false}
          autoCapitalize="none"
          autoCorrect="off"
          aria-label="admin token"
        />
      ) : (
        // key={status} so each transition replays the fade-in animation.
        <span key={status} className="token-gate-message">
          {message}
        </span>
      )}
    </div>
  );
}
