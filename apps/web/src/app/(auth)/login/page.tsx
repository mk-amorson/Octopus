// /login — the token gate. Shown to every unauthenticated visitor
// (middleware redirects them here). On success the TokenGate does a
// client-side navigation; middleware will in turn redirect back to
// the dashboard once the Set-Cookie from /api/auth/login lands.

import { Suspense } from "react";
import { Logo, LOGO_SIZE_CSS } from "@/components/Logo";
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
        // Share the Logo's font-size formula so both the wordmark and
        // the TokenGate below (whose geometry is measured in em of
        // this container) scale together — on mobile the whole stack
        // fills the short viewport edge, on desktop it caps at a
        // modest brand-mark size.
        style={{ fontSize: LOGO_SIZE_CSS }}
      >
        <Logo version={version || undefined} size="inherit" />
        <Suspense fallback={null}>
          <TokenGate />
        </Suspense>
      </div>
    </main>
  );
}
