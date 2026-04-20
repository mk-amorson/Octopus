"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Item = { href: string; label: string; requiresAuth?: boolean };

const items: Item[] = [
  { href: "/", label: "Home" },
  { href: "/editor", label: "Agent editor", requiresAuth: true },
];

export function NavDrawer({ loggedIn }: { loggedIn: boolean }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-full text-white/80 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <svg viewBox="0 0 24 24" aria-hidden className="h-6 w-6 stroke-current" fill="none" strokeWidth={2} strokeLinecap="round">
          {open ? (
            <>
              <line x1="5" y1="5" x2="19" y2="19" />
              <line x1="19" y1="5" x2="5" y2="19" />
            </>
          ) : (
            <>
              <line x1="4" y1="7" x2="20" y2="7" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="17" x2="20" y2="17" />
            </>
          )}
        </svg>
      </button>

      {open ? (
        <>
          <div
            aria-hidden
            className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <nav
            role="dialog"
            aria-modal="true"
            className="fixed left-0 top-0 z-40 flex h-full w-72 max-w-[85vw] flex-col gap-1 border-r border-white/10 bg-black px-6 pt-20"
          >
            {items.map((item) => {
              const disabled = item.requiresAuth && !loggedIn;
              return (
                <Link
                  key={item.href}
                  href={disabled ? "/" : item.href}
                  onClick={() => setOpen(false)}
                  aria-disabled={disabled}
                  className={
                    disabled
                      ? "rounded-lg px-3 py-3 text-base text-white/30"
                      : "rounded-lg px-3 py-3 text-base text-white/90 transition hover:bg-white/5 hover:text-accent"
                  }
                >
                  {item.label}
                  {disabled ? <span className="ml-2 text-xs text-white/30">(sign in)</span> : null}
                </Link>
              );
            })}
          </nav>
        </>
      ) : null}
    </>
  );
}
