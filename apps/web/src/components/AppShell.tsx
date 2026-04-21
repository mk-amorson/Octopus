"use client";

// Chrome around every authenticated page: persistent sidebar on
// desktop, slide-in drawer on mobile with a burger trigger. Bare by
// design — just the brand wordmark at the top and a logout button
// at the bottom. Every node-related UI (catalogue, list, detail,
// settings) lives on the dashboard itself; the sidebar is pure
// session chrome.

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "./LogoutButton";

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

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

      {open && (
        <div
          className="md:hidden fixed inset-0 bg-black/60 z-30"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      <aside
        className={[
          "z-40 flex flex-col w-56 bg-black border-r border-white/10",
          "fixed inset-y-0 left-0 transform transition-transform duration-200 ease-out",
          open ? "translate-x-0" : "-translate-x-full",
          "md:static md:translate-x-0 md:transition-none",
        ].join(" ")}
        aria-label="Primary"
      >
        <div className="flex items-center justify-between h-12 px-4 border-b border-white/10">
          <Link
            href="/"
            className="font-pixel text-sm tracking-tight text-white/80 hover:text-white"
          >
            octopus
          </Link>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="md:hidden p-1 text-white/60 hover:text-white"
            aria-label="Close menu"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="flex-1" />

        <div className="border-t border-white/10 p-2">
          <LogoutButton />
        </div>
      </aside>

      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}

function BurgerIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
