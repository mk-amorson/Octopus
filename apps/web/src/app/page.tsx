// Baked in at build time by the installer (see apps/web/Dockerfile).
// Falls back to empty string in dev so the line hides itself.
const version = process.env.NEXT_PUBLIC_OCTOPUS_VERSION ?? "";

export default function HomePage() {
  return (
    <main className="flex h-dvh items-center justify-center">
      {/* Position the version label so its baseline-bottom lines up
          with the lowest pixel of the logo's "p" descender, and its
          right edge lines up with the last pixel of "s". Achieved by:

            1. Trimming the font's descent to match the real descender
               in apps/web/src/app/fonts/octopus-pixel.ttf — so the
               logo's line-box bottom == descender bottom.
            2. leading-[0.875] so line-height matches (ascent+descent)
               exactly with zero half-leading padding.
            3. Absolute positioning the <p> with bottom:0 right:<tail>,
               where <tail> negates the digits' right advance.
            4. h1 margin-right:-<letter tail> so the container's right
               edge aligns with "s"'s last pixel.                     */}
      <div className="relative inline-block leading-[0.875]">
        <h1
          className="font-pixel text-6xl text-white md:text-8xl"
          style={{ marginRight: "-0.125em" }}
        >
          Octopus
        </h1>
        {version && (
          <p
            className="font-pixel absolute text-sm leading-[0.875] text-white/50 md:text-base"
            style={{ bottom: 0, right: "-0.0625em", margin: 0 }}
          >
            {version}
          </p>
        )}
      </div>
    </main>
  );
}
