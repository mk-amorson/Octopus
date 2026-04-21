// /login — the token gate. Shown to every unauthenticated visitor
// (middleware redirects them here). On success the TokenGate does a
// client-side navigation; middleware will in turn redirect back to
// the dashboard once the Set-Cookie from /api/auth/login lands.

import { Suspense } from "react";
import { Logo } from "@/components/Logo";
import { TokenGate } from "@/components/TokenGate";

// Middleware already makes every visit dynamic (it reads the cookie),
// so there's nothing to prerender — tell Next that explicitly so the
// useSearchParams() call inside TokenGate doesn't trip the static-
// generation check during `next build`.
export const dynamic = "force-dynamic";

const version = process.env["NEXT_PUBLIC_OCTOPUS_VERSION"] ?? "";

export default function LoginPage() {
  return (
    <main className="flex h-dvh items-center justify-center">
      <div
        className="inline-flex flex-col"
        // The Logo drives its own font-size from 100vmin; we inherit
        // that to keep the TokenGate sized in the same em frame.
        style={{ fontSize: "calc(100vmin / 3.8125)" }}
      >
        <Logo version={version || undefined} size="inherit" />
        <Suspense fallback={null}>
          <TokenGate />
        </Suspense>
      </div>
    </main>
  );
}
