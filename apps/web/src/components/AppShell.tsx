"use client";

// AppShell is the chrome around every authenticated page: persistent
// sidebar on desktop, slide-in drawer on mobile with a burger trigger.
// The layout is a two-column flex; the sidebar is `fixed + transform`
// below the md breakpoint and `static` above it, which is enough to
// switch between "drawer" and "shelf" behaviour with one CSS class.
//
// Nav items live in `NAV` below — empty for now, since there's only
// one authenticated route, but structured so adding "Settings" or
// "Logs" is a one-line append.

import { useEffect, useState, type ReactNode } from "react";
import { LogoutButton } from "./LogoutButton";

type NavEntry = { label: string; href: string };

// Intentionally empty until there's a second authenticated route to
// link to. Adding an entry here is enough — the sidebar reads NAV and
// renders everything uniformly.
const NAV: NavEntry[] = [];

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  // Close the drawer on Escape; standard keyboard affordance so a
  // user who opened it on mobile isn't trapped without a pointer.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="flex h-dvh text-white">
      {/* Burger — mobile only. Fixed so it sits on top of the main
          content when the drawer is closed, and hidden once the
          drawer itself is open (the drawer has its own close
          affordance + the overlay catches clicks). */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="md:hidden fixed top-3 left-3 z-20 p-2 text-white/70 hover:text-white transition-colors"
          aria-label="Open menu"
        >
          <BurgerIcon />
        </button>
      )}

      {/* Backdrop — mobile only, visible only while drawer is open.
          Tap-outside-to-close is the expected mobile pattern. */}
      {open && (
        <div
          className="md:hidden fixed inset-0 bg-black/60 z-30"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      <aside
        className={[
          "z-40 flex flex-col w-60 bg-black border-r border-white/15",
          // Mobile: fixed drawer, slides in from the left.
          "fixed inset-y-0 left-0 transform transition-transform duration-200 ease-out",
          open ? "translate-x-0" : "-translate-x-full",
          // Desktop: static column, always visible, no transform.
          "md:static md:translate-x-0 md:transition-none",
        ].join(" ")}
        aria-label="Primary"
      >
        {/* Header row: wordmark + close button on mobile. Keeping
            the brand subtle here (tiny pixel-font label) instead of
            the full centred Logo, because the main content area is
            the hero now — not the sidebar. */}
        <div className="flex items-center justify-between h-12 px-4 border-b border-white/10">
          <span className="font-pixel text-sm tracking-tight text-white/80">
            octopus
          </span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="md:hidden p-1 text-white/60 hover:text-white"
            aria-label="Close menu"
          >
            <CloseIcon />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-2">
          {NAV.length === 0 ? null : (
            <ul className="flex flex-col">
              {NAV.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="block px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </nav>

        <div className="border-t border-white/10 p-2">
          <LogoutButton />
        </div>
      </aside>

      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}

function BurgerIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
