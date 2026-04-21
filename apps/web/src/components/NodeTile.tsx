"use client";

// One row in the sidebar's category tree. Mirrors the reference
// project's NodeDetail: collapsed state is just a header button,
// expanded state reveals description + inputs + outputs +
// connections inline. Selection and expansion are the same bit —
// single-selection semantics, so opening one tile closes any other.
//
// Auto-scrolls itself into view when it opens so the user doesn't
// have to hunt for the expanded body in a long sidebar.

import { useEffect, useRef } from "react";
import type { PublicNode } from "@/lib/nodes/serialize";
import type { PublicDef } from "./SelectionContext";
import { STATUS, statusFor } from "@/lib/nodes/theme";

type Props = {
  node: PublicNode;
  def: PublicDef;
  expanded: boolean;
  connections: string[];
  onToggle: () => void;
};

export function NodeTile({ node, def, expanded, connections, onToggle }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const status = STATUS[statusFor(node.enabled, node.running)];

  useEffect(() => {
    if (expanded) rootRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [expanded]);

  return (
    <div ref={rootRef}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-2 pl-9 pr-3 py-2 hover:bg-white/5 transition-colors text-left"
      >
        <span className="flex-1 text-sm text-white/80 truncate">{node.name}</span>
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ backgroundColor: status.color }}
          title={status.label}
        />
        <Chevron open={expanded} />
      </button>

      <div
        className={`overflow-hidden transition-[max-height] duration-200 ${
          expanded ? "max-h-[1000px]" : "max-h-0"
        }`}
      >
        <div className="pl-9 pr-3 pb-3 flex flex-col gap-2">
          <p className="text-[11px] text-white/50 leading-relaxed">{def.description}</p>
          <Row label="inputs" items={def.inputs} prefix="←" />
          <Row label="outputs" items={def.outputs} prefix="→" />
          <Row label="connections" items={connections} prefix="·" />
        </div>
      </div>
    </div>
  );
}

function Row({ label, items, prefix }: { label: string; items: string[]; prefix: string }) {
  return (
    <section>
      <p className="text-[10px] uppercase tracking-wider text-white/40">{label}</p>
      {items.length === 0 ? (
        <p className="text-[11px] text-white/25">—</p>
      ) : (
        <ul className="text-[11px] text-white/70 space-y-0.5">
          {items.map((i) => (
            <li key={i} className="break-words">
              <span className="text-white/30 mr-1">{prefix}</span>
              {i}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 text-white/40 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
      aria-hidden
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
