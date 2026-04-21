"use client";

// A single config form field. Knows nothing about the node — just
// renders one FieldSpec + reports value changes up to the parent.

import type { FieldSpec } from "@/lib/nodes/types";

type Props = {
  field: FieldSpec;
  value: string | boolean | undefined;
  /** true when a secret field already holds a value server-side; used
   *  to show a "leave blank to keep existing" placeholder instead of
   *  confusing the user with an empty required input. */
  secretAlreadySet: boolean;
  onChange: (v: string | boolean) => void;
};

export function Field({ field, value, secretAlreadySet, onChange }: Props) {
  if (field.type === "boolean") {
    return (
      <label className="flex items-center gap-2 text-sm text-white/80">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
        />
        {field.label}
      </label>
    );
  }

  const placeholder =
    field.secret && secretAlreadySet
      ? "•••••••• (leave blank to keep existing)"
      : field.placeholder ?? "";

  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] uppercase tracking-wider text-white/50">
        {field.label}
        {field.required ? " *" : ""}
      </span>
      <input
        type={field.secret ? "password" : "text"}
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        className="bg-white/[0.03] border border-white/15 focus:border-white/50 rounded px-3 py-2 text-sm text-white outline-none transition-colors"
      />
    </label>
  );
}
