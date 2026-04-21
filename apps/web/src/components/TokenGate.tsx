"use client";

// TokenGate is a single styled box under the <Logo>. Its contents
// switch between an editable <input> (idle) and a read-only <span>
// (checking / ok / bad), but every geometric concern — padding,
// border, font, line-height, height, width — lives on the wrapper.
// Children just inherit. There is no second copy of any measurement
// to keep in sync; the placeholder, the input value, and the result
// message all render in the same spot because they all sit in the
// same flex slot inside the wrapper.
//
// On a valid token the component doesn't linger — it POSTs to
// /api/auth/login which sets the session cookie, then navigates to
// the dashboard. Middleware takes over from there.

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiUrl, ROUTES } from "@/lib/auth/config";

const TOKEN_LENGTH = 64;

// Width matches the VISIBLE render of "Octopus" — from the first
// pixel of "O" to the last pixel of "s". Same 2.9375em the Logo
// component trims itself to via `margin-right: -0.125em`.
const LOGO_TRIMMED_EM = 2.9375;

// Tight gap between the logo's "p" descender and the gate's top
// edge — about two logo-pixels.
const TOP_GAP_EM = 0.125;

// Three-dot spinner cadence. Slow enough the user registers the motion
// as "still working" and fast enough to not feel frozen on a slow link.
const SPINNER_TICK_MS = 250;

// After a successful auth we linger briefly so the "success" message
// plays before the navigation. Kept short — users want to proceed.
const SUCCESS_REDIRECT_DELAY_MS = 350;

type Status = "idle" | "checking" | "ok" | "bad" | "throttled";

const MESSAGE: Record<Status, string> = {
  idle: "",
  checking: "checking",
  ok: "success",
  bad: "wrong token",
  throttled: "too many tries",
};

export function TokenGate() {
  const router = useRouter();
  const params = useSearchParams();
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
    tickRef.current = setInterval(() => setTick((t) => t + 1), SPINNER_TICK_MS);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      tickRef.current = null;
    };
  }, [status]);

  // After a "bad → idle" retry we want the input focused so the user
  // can type immediately. Don't focus on first mount (that would steal
  // focus on page load) — the ref flag gates it.
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
      void submit(next);
    }
  }

  async function submit(token: string) {
    setStatus("checking");
    let res: Response;
    try {
      res = await fetch(apiUrl(ROUTES.apiLogin), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
    } catch {
      setStatus("bad");
      setValue("");
      return;
    }
    if (res.ok) {
      setStatus("ok");
      setValue("");
      const redirect = params.get("redirect") || ROUTES.home;
      // Brief pause so the "success" animation plays before the
      // page falls away under the user. refresh() re-runs middleware
      // so the new cookie takes effect for the navigation.
      setTimeout(() => {
        router.replace(redirect);
        router.refresh();
      }, SUCCESS_REDIRECT_DELAY_MS);
      return;
    }
    setStatus(res.status === 429 ? "throttled" : "bad");
    setValue("");
  }

  function retry() {
    // Only recoverable states reset on click. "ok" stays sticky (we
    // are about to navigate away anyway), "checking" is left alone.
    if (status !== "bad" && status !== "throttled") return;
    wantFocusOnIdle.current = true;
    setStatus("idle");
  }

  const message =
    status === "checking"
      ? `checking${".".repeat((tick % 3) + 1)}`
      : MESSAGE[status];

  return (
    <div
      className="token-gate"
      data-status={status}
      onClick={status === "bad" || status === "throttled" ? retry : undefined}
      // Instance-level overrides only. Deliberately no fontSize here
      // so `em` measurements below resolve in the logo's font-size.
      style={{ width: `${LOGO_TRIMMED_EM}em`, marginTop: `${TOP_GAP_EM}em` }}
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
