"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiUrl, ROUTES } from "@/lib/auth/config";

// LogoutButton is a plain styled button now — positioning is the
// parent's concern (AppShell anchors it to the bottom of the sidebar).
// Handles the full-width hover hit target as well as the request.
export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logout() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch(apiUrl(ROUTES.apiLogout), { method: "POST" });
    } catch {
      // Even if the network hiccups, fall through — the user wants
      // out; middleware will gate them on the next navigation anyway.
    }
    router.replace(ROUTES.login);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={busy}
      className="w-full text-left font-pixel text-sm text-white/60 hover:text-white px-3 py-2 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      logout
    </button>
  );
}
