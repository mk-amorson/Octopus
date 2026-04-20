// Baked in at build time by the installer (see apps/web/Dockerfile).
// Falls back to empty string in dev so the line hides itself.
const version = process.env.NEXT_PUBLIC_OCTOPUS_VERSION ?? "";

export default function HomePage() {
  return (
    <main className="flex h-dvh items-center justify-center">
      <div className="flex flex-col items-center">
        <h1 className="font-pixel text-6xl text-white md:text-8xl">Octopus</h1>
        {version && (
          <p className="font-pixel mt-3 text-base text-white/50 md:mt-4 md:text-xl">
            {version}
          </p>
        )}
      </div>
    </main>
  );
}
