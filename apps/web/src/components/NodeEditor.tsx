"use client";

// Config form + live trace stream for one node instance. Left / top
// half is the form, right / bottom is the trace panel. On save we
// PATCH /api/nodes/<id>; enabling is a checkbox that triggers the
// same endpoint (which reconciles the runtime).

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiUrl } from "@/lib/auth/config";
import type { FieldSpec } from "@/lib/nodes/types";
import { TraceStream } from "./TraceStream";

type PublicNode = {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  running: boolean;
  config: Record<string, unknown>;
};

type PublicDef = {
  id: string;
  name: string;
  description: string;
  category: string;
  kind: "trigger" | "action";
  fields: FieldSpec[];
};

export function NodeEditor({ node, def }: { node: PublicNode; def: PublicDef }) {
  const router = useRouter();

  const [name, setName] = useState(node.name);
  const [enabled, setEnabled] = useState(node.enabled);
  // For secret fields the server sends `{__set: boolean}`. Track each
  // field's raw form value separately; empty string = "keep existing".
  const [values, setValues] = useState<Record<string, string | boolean>>(() => {
    const init: Record<string, string | boolean> = {};
    for (const f of def.fields) {
      const raw = node.config[f.key];
      if (f.type === "boolean") init[f.key] = typeof raw === "boolean" ? raw : false;
      else if (f.secret) init[f.key] = ""; // masked — don't prefill
      else init[f.key] = typeof raw === "string" ? raw : "";
    }
    return init;
  });

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save(nextEnabled = enabled) {
    if (saving) return;
    setSaving(true);
    setErr(null);
    try {
      const config: Record<string, unknown> = {};
      for (const f of def.fields) {
        config[f.key] = values[f.key];
      }
      const res = await fetch(apiUrl(`/api/nodes/${node.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, enabled: nextEnabled, config }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleEnabled(nextVal: boolean) {
    setEnabled(nextVal);
    // Save immediately with the new value; user doesn't have to hit Save
    // twice just to flip the switch.
    await save(nextVal);
  }

  async function remove() {
    if (!confirm("Delete this node? Its config and any running webhook will be removed.")) return;
    const res = await fetch(apiUrl(`/api/nodes/${node.id}`), { method: "DELETE" });
    if (res.ok) {
      router.replace("/");
      router.refresh();
    }
  }

  const webhookUrlHint =
    def.id === "telegram.trigger"
      ? `${(typeof window !== "undefined" && window.location.origin) || ""}${
          process.env.NEXT_PUBLIC_OCTOPUS_BASE_PATH ?? ""
        }/api/hooks/telegram/${node.id}`
      : null;

  return (
    <div className="h-full flex flex-col p-4 md:p-6 gap-4 md:gap-6 max-w-5xl">
      {/* Header */}
      <header className="flex items-center gap-3 flex-wrap">
        <input
          className="flex-1 min-w-[200px] bg-transparent border-b border-white/20 focus:border-white/60 font-pixel text-xl text-white py-1 outline-none transition-colors"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => save()}
          aria-label="Node name"
        />
        <div className="flex items-center gap-2 text-xs">
          <span
            className={`inline-block w-2 h-2 rounded-full ${
              node.running ? "bg-emerald-400" : enabled ? "bg-amber-400" : "bg-white/20"
            }`}
          />
          <span className="text-white/50">
            {node.running ? "running" : enabled ? "enabled" : "disabled"}
          </span>
        </div>
        <label className="flex items-center gap-2 text-sm text-white/70 cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => void toggleEnabled(e.target.checked)}
          />
          enabled
        </label>
        <button
          type="button"
          onClick={remove}
          className="text-xs text-white/40 hover:text-red-400 transition-colors"
        >
          delete
        </button>
      </header>

      {err && (
        <div className="text-sm text-red-400 border border-red-400/40 bg-red-400/10 px-3 py-2 rounded">
          {err}
        </div>
      )}

      {/* Two-column config + traces on wide screens; stacked below */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 overflow-hidden">
        <section className="flex flex-col gap-3 overflow-y-auto">
          <p className="text-xs text-white/50 leading-relaxed">{def.description}</p>
          {webhookUrlHint && (
            <div className="text-[11px] text-white/40 break-all border border-white/10 p-2 rounded bg-white/[0.02]">
              webhook URL:
              <br />
              <code className="text-white/70">{webhookUrlHint}</code>
            </div>
          )}
          {def.fields.map((f) => (
            <Field
              key={f.key}
              field={f}
              value={values[f.key]}
              secretAlreadySet={
                f.type === "text" && f.secret
                  ? (node.config[f.key] as { __set?: boolean } | undefined)?.__set ?? false
                  : false
              }
              onChange={(v) =>
                setValues((prev) => ({ ...prev, [f.key]: v }))
              }
            />
          ))}
          <div className="pt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={() => save()}
              disabled={saving}
              className="font-pixel text-sm text-white/90 hover:text-white border border-white/30 hover:border-white/60 px-4 py-1.5 transition-colors disabled:opacity-50"
            >
              {saving ? "saving…" : "save"}
            </button>
          </div>
        </section>

        <section className="flex flex-col overflow-hidden border border-white/10 rounded">
          <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between">
            <span className="font-pixel text-xs text-white/70">traces</span>
            <span className="text-[10px] text-white/40">live</span>
          </div>
          <TraceStream nodeId={node.id} />
        </section>
      </div>
    </div>
  );
}

function Field({
  field,
  value,
  secretAlreadySet,
  onChange,
}: {
  field: FieldSpec;
  value: string | boolean | undefined;
  secretAlreadySet: boolean;
  onChange: (v: string | boolean) => void;
}) {
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
        placeholder={
          field.secret && secretAlreadySet
            ? "•••••••• (leave blank to keep existing)"
            : field.placeholder ?? ""
        }
        autoComplete="off"
        spellCheck={false}
        className="bg-white/[0.03] border border-white/15 focus:border-white/50 rounded px-3 py-2 text-sm text-white outline-none transition-colors"
      />
    </label>
  );
}
