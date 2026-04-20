import { Logo } from "@/components/Logo";
import { TokenGate } from "@/components/TokenGate";

// Baked in at build time by the installer (see apps/web/Dockerfile).
// Falls back to empty string in dev so the line hides itself.
const version = process.env.NEXT_PUBLIC_OCTOPUS_VERSION ?? "";

export default function HomePage() {
  return (
    <main className="flex h-dvh items-center justify-center">
      <div
        className="inline-flex flex-col"
        // The Logo already drives its own font-size from 100vmin, so
        // we inherit that here to keep the TokenGate dimensioned in
        // the same em frame (widths under "Octop" / "us" match).
        style={{ fontSize: `calc(100vmin / 3.8125)` }}
      >
        <Logo version={version || undefined} size="inherit" />
        <TokenGate />
      </div>
    </main>
  );
}
