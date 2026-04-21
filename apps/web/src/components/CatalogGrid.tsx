"use client";

// Clickable grid of node types. POSTs to /api/nodes on click, redirects
// to the new instance's detail page. A `preselect` prop (passed via
// ?type=<id>) auto-fires the create call on mount — that's what
// sidebar "+ add" uses to skip the catalogue when a category has only
// one type.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/auth/config";

type CatalogNode = {
  id: string;
  name: string;
  category: string;
  description: string;
  kind: "trigger" | "action";
};

export function CatalogGrid({
  nodes,
  preselect,
}: {
  nodes: CatalogNode[];
  preselect?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const ran = useRef(false);

  async function create(typeId: string) {
    if (busy) return;
    setBusy(typeId);
    setErr(null);
    try {
      const res = await fetch(apiUrl("/api/nodes"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: typeId }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      const created = (await res.json()) as { id: string };
      router.replace(`/nodes/${created.id}`);
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
      setBusy(null);
    }
  }

  // Auto-create when the URL names exactly one type (sidebar shortcut).
  useEffect(() => {
    if (ran.current || !preselect) return;
    const match = nodes.find((n) => n.id === preselect);
    if (!match) return;
    ran.current = true;
    void create(match.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselect]);

  return (
    <div>
      {err && (
        <div className="mb-4 text-sm text-red-400 border border-red-400/40 bg-red-400/10 px-3 py-2 rounded">
          {err}
        </div>
      )}
      <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {nodes.map((n) => (
          <li key={n.id}>
            <button
              type="button"
              onClick={() => create(n.id)}
              disabled={busy !== null}
              className="w-full text-left border border-white/15 hover:border-white/40 bg-white/[0.02] hover:bg-white/[0.04] p-4 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-baseline justify-between mb-1">
                <span className="font-pixel text-base text-white/90">{n.name}</span>
                <span className="text-[10px] uppercase tracking-wider text-white/40">
                  {n.kind}
                </span>
              </div>
              <p className="text-xs text-white/50 leading-relaxed">{n.description}</p>
              {busy === n.id && (
                <p className="mt-2 text-[10px] text-white/40">creating…</p>
              )}
            </button>
          </li>
        ))}
        {nodes.length === 0 && (
          <li className="col-span-full text-white/40 text-sm">
            No node types available in this category.
          </li>
        )}
      </ul>
    </div>
  );
}
