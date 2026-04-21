"use client";

// Orchestrator for a single node's config + trace panel. Owns the
// API conversation (name patches, toggle, save, delete) but delegates
// rendering to NodeHeader / ConfigForm / TraceStream, keeping this
// file under 150 LOC.
//
// Every route that shows this component passes `key={node.id}` so
// React fully remounts the subtree when the user navigates between
// instances. Without the key, client-side form state leaked between
// different nodes (v0.1.29 bug).

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiUrl } from "@/lib/auth/config";
import type { FieldSpec } from "@/lib/nodes/types";
import type { PublicNode } from "@/lib/nodes/serialize";
import { ConfigForm } from "./ConfigForm";
import { NodeHeader } from "./NodeHeader";
import { TraceStream } from "../TraceStream";

type PublicDef = {
  id: string;
  name: string;
  description: string;
  fields: FieldSpec[];
};

export function NodeEditor({ node, def }: { node: PublicNode; def: PublicDef }) {
  const router = useRouter();
  const [name, setName] = useState(node.name);
  const [enabled, setEnabled] = useState(node.enabled);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const secretAlreadySet = Object.fromEntries(
    def.fields
      .filter((f) => f.type === "text" && f.secret)
      .map((f) => [f.key, (node.config[f.key] as { __set?: boolean } | undefined)?.__set ?? false]),
  );

  const initialValues = Object.fromEntries(
    def.fields.map((f) => {
      const raw = node.config[f.key];
      if (f.type === "boolean") return [f.key, typeof raw === "boolean" ? raw : false];
      if (f.secret) return [f.key, ""]; // masked — never prefilled
      return [f.key, typeof raw === "string" ? raw : ""];
    }),
  );

  async function patch(body: Record<string, unknown>) {
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch(apiUrl(`/api/nodes/${node.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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

  async function remove() {
    if (!confirm("Delete this node? Its config and any running webhook will be removed.")) return;
    const res = await fetch(apiUrl(`/api/nodes/${node.id}`), { method: "DELETE" });
    if (!res.ok) {
      setErr(`delete failed: ${res.status}`);
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="h-full flex flex-col p-4 md:p-6 gap-4 md:gap-6 max-w-5xl">
      <NodeHeader
        name={name}
        enabled={enabled}
        running={node.running}
        onRename={(v) => setName(v)}
        onToggleEnabled={(v) => {
          setEnabled(v);
          void patch({ name, enabled: v });
        }}
        onDelete={() => void remove()}
      />

      {err && (
        <div className="text-sm text-red-400 border border-red-400/40 bg-red-400/10 px-3 py-2 rounded">
          {err}
        </div>
      )}

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 overflow-hidden">
        <section className="flex flex-col gap-3 overflow-y-auto">
          <p className="text-xs text-white/50 leading-relaxed">{def.description}</p>
          {node.webhookUrl && (
            <div className="text-[11px] text-white/40 break-all border border-white/10 p-2 rounded bg-white/[0.02]">
              webhook URL:
              <br />
              <code className="text-white/70">{node.webhookUrl}</code>
            </div>
          )}
          <ConfigForm
            fields={def.fields}
            initial={initialValues}
            secretAlreadySet={secretAlreadySet}
            saving={saving}
            onSave={(values) => void patch({ name, enabled, config: values })}
          />
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
