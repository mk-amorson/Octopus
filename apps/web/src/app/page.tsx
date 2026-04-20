// Baked in at build time by the installer (see apps/web/Dockerfile).
// Falls back to empty string in dev so the line hides itself.
const version = process.env.NEXT_PUBLIC_OCTOPUS_VERSION ?? "";

export default function HomePage() {
  return (
    <main className="flex h-dvh items-center justify-center">
      {/* items-end pins each child's right edge to the column's right
          edge; we then shave off each element's invisible right-side
          advance tail (= the "gap" baked into the glyph) with a small
          negative margin-right in em — so what lines up visually is
          the last PIXEL of "s" and the last pixel of the last digit,
          not the invisible-tail right edge of each text box. */}
      <div className="inline-flex flex-col items-end leading-none">
        <h1
          // Letters carry a 2-pixel right tail in the octopus-pixel font
          // (2/16 em when the pixel is 1/16th of the font size).
          // mb = 1 logo-pixel — the gap the user sees between "us" and
          // the version line.
          className="font-pixel text-6xl text-white md:text-8xl"
          style={{ marginRight: "-0.125em", marginBottom: "0.0625em" }}
        >
          Octopus
        </h1>
        {version && (
          // Digits carry a 1-pixel right tail (monospace advance of 7
          // pixels, 6-pixel glyph, 1-pixel right margin).
          <p
            className="font-pixel text-sm text-white/50 md:text-base"
            style={{ marginRight: "-0.0625em" }}
          >
            {version}
          </p>
        )}
      </div>
    </main>
  );
}
