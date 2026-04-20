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
// in font-units (UPM = 1024). Sum them up, subtract the right tail on
// the final "s" that we visually trim with margin-right, divide by UPM
// to get em. Then add 1em for the side padding (8 font-pixels each).
//
//   O=512 + c=448 + t=384 + o=448 + p=448 + u=448 + s=448 = 3136
//   -128 (s's right tail trimmed via margin-right: -0.125em) = 3008
//   3008 / 1024 = 2.9375em of rendered text (pre-trim)
//   -0.125em trim = 2.8125em
//   +1em of horizontal padding (0.5em each side = 8 font-pixels) = 3.8125em
const LOGO_EM_WIDTH = 3.8125;

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
