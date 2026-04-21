"use client";

// Renders every field declared by the node definition + the Save
// button. Stateless from the node's perspective — takes the initial
// values as props and publishes every edit back up through onPatch.

import { useState } from "react";
import { Field } from "./Field";
import type { FieldSpec } from "@/lib/nodes/types";

type Props = {
  fields: FieldSpec[];
  /** Initial form values. Secret fields start blank because the raw
   *  value never travels back from the server; the UI treats a blank
   *  submit as "keep the existing secret". */
  initial: Record<string, string | boolean>;
  secretAlreadySet: Record<string, boolean>;
  saving: boolean;
  onSave: (values: Record<string, string | boolean>) => void;
};

export function ConfigForm({
  fields,
  initial,
  secretAlreadySet,
  saving,
  onSave,
}: Props) {
  const [values, setValues] = useState(initial);

  function set(key: string, v: string | boolean) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  return (
    <div className="flex flex-col gap-3">
      {fields.map((f) => (
        <Field
          key={f.key}
          field={f}
          value={values[f.key]}
          secretAlreadySet={secretAlreadySet[f.key] ?? false}
          onChange={(v) => set(f.key, v)}
        />
      ))}
      <div className="pt-2">
        <button
          type="button"
          onClick={() => onSave(values)}
          disabled={saving}
          className="font-pixel text-sm text-white/90 hover:text-white border border-white/30 hover:border-white/60 px-4 py-1.5 transition-colors disabled:opacity-50"
        >
          {saving ? "saving…" : "save"}
        </button>
      </div>
    </div>
  );
}
