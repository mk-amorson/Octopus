"use client";

// The sticky top strip of the editor: inline-editable name, a
// running/enabled/disabled status pill, the enable toggle, and the
// delete button. Owns zero state beyond local typing — every action
// bubbles up as a callback.

import { STATUS, statusFor } from "@/lib/nodes/theme";

type Props = {
  name: string;
  enabled: boolean;
  running: boolean;
  onRename: (name: string) => void;
  onToggleEnabled: (v: boolean) => void;
};

export function NodeHeader({
  name,
  enabled,
  running,
  onRename,
  onToggleEnabled,
}: Props) {
  const status = STATUS[statusFor(enabled, running)];
  return (
    <header className="flex items-center gap-3 flex-wrap">
      <input
        className="flex-1 min-w-[200px] bg-transparent border-b border-white/20 focus:border-white/60 font-pixel text-xl text-white py-1 outline-none transition-colors"
        value={name}
        onChange={(e) => onRename(e.target.value)}
        aria-label="Node name"
      />
      <div className="flex items-center gap-2 text-xs">
        <span
          className="inline-block w-2 h-2 rounded-full"
          style={{ backgroundColor: status.color }}
        />
        <span className={status.textClass}>{status.label}</span>
      </div>
      <label className="flex items-center gap-2 text-sm text-white/70 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onToggleEnabled(e.target.checked)}
        />
        enabled
      </label>
    </header>
  );
}
