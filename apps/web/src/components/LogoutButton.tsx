"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiUrl, ROUTES } from "@/lib/auth/config";

export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logout() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch(apiUrl(ROUTES.apiLogout), { method: "POST" });
    } catch {
      // Even if the network hiccups, fall through: the user still
      // wants out, and middleware will gate them on the next nav.
    }
    router.replace(ROUTES.login);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={busy}
      className="font-pixel text-white/40 hover:text-white/70 transition-colors text-xs absolute bottom-4"
    >
      logout
    </button>
  );
}
