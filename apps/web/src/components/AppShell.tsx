"use client";

// Chrome around every authenticated page: persistent sidebar on
// desktop, slide-in drawer on mobile with a burger trigger. Server
// layout passes down a `categories` tree already grouped by node
// category with each category's node types + user-created instances.
// Rendering is straightforward: one <section> per category, instance
// list inside it, "+ Add" row underneath.

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "./LogoutButton";
import type { SidebarCategory } from "@/lib/nodes/sidebar";

export function AppShell({
  categories,
  children,
}: {
  categories: SidebarCategory[];
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close the drawer on navigation — standard mobile affordance.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // And on Escape.
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
          "z-40 flex flex-col w-64 bg-black border-r border-white/15",
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

        <nav className="flex-1 overflow-y-auto py-2">
          {categories.map((cat) => (
            <CategorySection key={cat.category} cat={cat} activePath={pathname} />
          ))}
        </nav>

        <div className="border-t border-white/10 p-2">
          <LogoutButton />
        </div>
      </aside>

      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}

function CategorySection({
  cat,
  activePath,
}: {
  cat: SidebarCategory;
  activePath: string;
}) {
  // When a category offers more than one type we hand off to /nodes/new
  // so the user can pick; with exactly one type the "Add" link skips
  // the catalogue and points straight at the creation form.
  const addHref =
    cat.types.length === 1
      ? `/nodes/new?type=${encodeURIComponent(cat.types[0]!.id)}`
      : `/nodes/new?category=${encodeURIComponent(cat.category)}`;

  return (
    <section className="mb-4">
      <h3 className="px-4 py-1 text-[10px] uppercase tracking-wider text-white/40">
        {cat.category}
      </h3>
      <ul>
        {cat.nodes.map((n) => {
          const href = `/nodes/${n.id}`;
          const active = activePath === href;
          return (
            <li key={n.id}>
              <Link
                href={href}
                className={[
                  "flex items-center justify-between px-4 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-white/10 text-white"
                    : "text-white/70 hover:bg-white/5 hover:text-white",
                ].join(" ")}
              >
                <span className="truncate">{n.name}</span>
                <StatusDot running={n.running} enabled={n.enabled} />
              </Link>
            </li>
          );
        })}
        <li>
          <Link
            href={addHref}
            className="block px-4 py-1.5 text-sm text-white/40 hover:text-white hover:bg-white/5 transition-colors"
          >
            + add
          </Link>
        </li>
      </ul>
    </section>
  );
}

function StatusDot({ running, enabled }: { running: boolean; enabled: boolean }) {
  const color = running
    ? "bg-emerald-400"
    : enabled
      ? "bg-amber-400"
      : "bg-white/20";
  const title = running ? "running" : enabled ? "enabled (not running)" : "disabled";
  return <span className={`w-1.5 h-1.5 rounded-full ${color}`} title={title} />;
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
