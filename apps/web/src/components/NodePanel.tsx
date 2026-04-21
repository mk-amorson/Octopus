"use client";

// Right-side slide-in panel that wraps a NodeEditor. Three modes:
//   - closed    (rendered empty, no width, no pointer)
//   - open      (fixed width, graph stays visible beside it)
//   - expanded  (fills the viewport, graph hidden underneath)
//
// Keeping the three-mode state here (not on the editor) lets every
// future panel variant — e.g. a read-only inspector — reuse the same
// chrome + keybindings.

import type { PublicNode } from "@/lib/nodes/serialize";
import type { FieldSpec } from "@/lib/nodes/types";
import { NodeEditor } from "./NodeEditor";

export type PanelMode = "open" | "expanded";

type PublicDef = {
  id: string;
  name: string;
  description: string;
  fields: FieldSpec[];
};

type Props = {
  node: PublicNode;
  def: PublicDef;
  mode: PanelMode;
  onToggleMode: () => void;
  onClose: () => void;
};

export function NodePanel({ node, def, mode, onToggleMode, onClose }: Props) {
  const expanded = mode === "expanded";
  return (
    <aside
      className={[
        "absolute top-0 right-0 h-full bg-black border-l border-white/10 z-20",
        "flex flex-col",
        "transition-[width] duration-200 ease-out",
        expanded ? "w-full" : "w-full md:w-[420px] lg:w-[480px]",
      ].join(" ")}
      aria-label="Node settings"
    >
      <div className="flex items-center justify-between h-10 px-3 border-b border-white/10">
        <span className="font-pixel text-xs text-white/60">
          {expanded ? "node settings" : "settings"}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onToggleMode}
            className="p-1.5 text-white/50 hover:text-white transition-colors"
            aria-label={expanded ? "Collapse panel" : "Expand panel"}
            title={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? <CollapseIcon /> : <ExpandIcon />}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-white/50 hover:text-white transition-colors"
            aria-label="Close panel"
            title="Close"
          >
            <CloseIcon />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <NodeEditor key={node.id} node={node} def={def} />
      </div>
    </aside>
  );
}

function ExpandIcon() {
  // Two corners of arrows pointing outward — standard "maximise".
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 3H3v6M15 3h6v6M9 21H3v-6M15 21h6v-6" />
    </svg>
  );
}

function CollapseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M15 9V3h-6M9 15H3v6M15 15v6h-6M9 9h6V3" transform="rotate(0)" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
