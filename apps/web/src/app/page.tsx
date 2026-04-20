// Baked in at build time by the installer (see apps/web/Dockerfile).
// Falls back to empty string in dev so the line hides itself.
const version = process.env.NEXT_PUBLIC_OCTOPUS_VERSION ?? "";

export default function HomePage() {
  return (
    <main className="flex h-dvh items-center justify-center">
      {/* inline-flex sizes to the widest child ("Octopus"), items-end
          pins every other child's right edge to that same width — so
          the version line lands flush against the last pixel column
          of the "s" without any manual offset math. */}
      <div className="inline-flex flex-col items-end">
        <h1 className="font-pixel text-6xl text-white md:text-8xl">Octopus</h1>
        {version && (
          // 1 pixel of the logo font = fontSize * 64 / 1024 = fontSize / 16.
          // At text-6xl that's ~4px; at md:text-8xl ~6px.
          <p className="font-pixel mt-[4px] text-sm text-white/50 md:mt-[6px] md:text-base">
            {version}
          </p>
        )}
      </div>
    </main>
  );
}
