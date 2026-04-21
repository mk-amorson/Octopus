// Logo is the reusable "Octopus" wordmark + optional version label.
// Drop it anywhere — page, footer, error screen — and it lays itself out
// correctly.
//
// Sizing
// ------
// The default size is `100vmin / LOGO_EM_WIDTH`, i.e. the whole
// rendered-box (including an 8-font-pixel cushion on each side) fills
// the short edge of the viewport. Because `vmin` picks the smaller of
// width/height, rotating a phone between portrait and landscape doesn't
// change the logo's visual size — exactly what we want.
//
// LOGO_EM_WIDTH comes from the octopus-pixel font geometry — it is
// documented below, not magic. If you change the font or the padding
// policy, recalculate.
//
// Pass an explicit `size` (any CSS length, e.g. `"4rem"` or
// `"12vmin"`) to override. Pass a `version` string to render it under
// the last pixel of "s".

import type { CSSProperties } from "react";

// Advance widths of the individual glyphs in the octopus-pixel font,
// in font-units (UPM = 1024). We want the LOGO box to be exactly as
// wide as the VISIBLE pixels of "Octopus" — from the first pixel of
// "O" to the last pixel of "s" — plus a consistent cushion on each
// side.
//
//   advances: O=512 + c=448 + t=384 + o=448 + p=448 + u=448 + s=448 = 3136
//   Sum of advances is the inline width INCLUDING each glyph's
//   right-side "tail" (invisible space after the last pixel). The
//   tail on every letter is 2 pixels = 128 units; only the final
//   "s"'s tail matters for the outer box, since each intermediate
//   tail is consumed as the gap before the next letter.
//
//   To trim that final tail we apply `margin-right: -0.125em` to
//   the h1, so the container's right edge lands on the last visible
//   pixel of "s":
//     3136 − 128 = 3008 units = 2.9375em of visible text.
//
//   Add a half-em of padding on each side (8 font-pixels — one em
//   total) and the overall box is 3.9375em.
const LOGO_VISIBLE_EM = 2.9375;
const LOGO_EM_WIDTH = LOGO_VISIBLE_EM + 1;

// Default: make LOGO_EM_WIDTH (including padding) match the short edge
// of the viewport. Subtracting env(safe-area-inset-*) would be the next
// refinement if iPhone notches ever clip something — for now 100vmin
// stays clean.
const DEFAULT_SIZE = `calc(100vmin / ${LOGO_EM_WIDTH})`;

// Version label sits at 1/5 of the logo's font size — close to what we
// had at the previous hand-tuned `text-sm / md:text-base` pairing and
// pleasantly readable at any logo size.
const VERSION_SCALE = 0.2;

export type LogoProps = {
  /** Version string rendered under the logo. Omit to hide. */
  version?: string;
  /** Override the auto-scaled size. Any CSS length works. */
  size?: string;
  /** Pass-through for callers that want to position the logo manually. */
  className?: string;
  style?: CSSProperties;
};

export function Logo({ version, size, className, style }: LogoProps) {
  const fontSize = size ?? DEFAULT_SIZE;
  return (
    <div
      className={`relative inline-block leading-[0.875] ${className ?? ""}`.trim()}
      // fontSize is the single source of truth for every em-based
      // child — version, margins, paddings — so scaling is trivial.
      style={{ fontSize, ...style }}
    >
      <h1
        className="font-pixel text-white"
        // Order matters: `margin` is a shorthand that resets every
        // side, so it has to go BEFORE the specific `marginRight`
        // override. Flipping the order is what broke right-edge
        // alignment in an earlier iteration.
        style={{
          fontSize: "inherit",
          margin: 0,
          // -0.125em trims the 2-pixel right-side advance tail baked
          // into every letter glyph so the container's right edge
          // lines up with the last visible pixel of "s".
          marginRight: "-0.125em",
        }}
      >
        Octopus
      </h1>
      {version ? (
        <p
          className="font-pixel text-white/50"
          style={{
            position: "absolute",
            bottom: 0,
            // -0.0625em trims the 1-pixel tail on the final digit.
            // Expressed in em of the p itself, so the math composes
            // with the fontSize below.
            right: "-0.0625em",
            margin: 0,
            lineHeight: 0.875,
            fontSize: `${VERSION_SCALE}em`,
          }}
        >
          {version}
        </p>
      ) : null}
    </div>
  );
}
