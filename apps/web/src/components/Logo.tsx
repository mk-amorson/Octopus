// Logo is the reusable "Octopus" wordmark + optional version label.
// Drop it anywhere — page, footer, error screen — and it lays itself out
// correctly.
//
// Sizing
// ------
// The default size is `min(100vmin / LOGO_EM_WIDTH, LOGO_MAX_SIZE)`:
// on mobile the logo box fills the short viewport edge (because `vmin`
// picks the smaller of w/h, so the formula tracks portrait width and
// landscape height); on tablets and desktops it caps at LOGO_MAX_SIZE
// so a 4K monitor doesn't get a 700-pixel wordmark. Rotating a phone
// between portrait and landscape doesn't change the logo's visual size
// — exactly what we want.
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
export const LOGO_VISIBLE_EM = 2.9375;
export const LOGO_EM_WIDTH = LOGO_VISIBLE_EM + 1;

// Cap the auto-sized font-size above this threshold so on tablets and
// desktops the wordmark is a modest brand mark (~20–25% of viewport
// width), not a hero block taking half the screen. On small phones
// the viewport is narrower than the cap, so `min()` drops back to
// the vmin-proportional value and the logo still fills the short edge.
// 120px × LOGO_VISIBLE_EM = 352 px visible — sits in the sweet spot
// between "readable" and "not shouting" across every breakpoint.
export const LOGO_MAX_FONT_PX = 120;

// Default: scale with vmin up to the cap, then hold. This is the one
// formula both <Logo> itself and any container that inherits the
// logo's font-size (e.g. the login page's TokenGate frame) should
// use — exported as `LOGO_SIZE_CSS` so the two never drift.
export const LOGO_SIZE_CSS =
  `min(calc(100vmin / ${LOGO_EM_WIDTH}), ${LOGO_MAX_FONT_PX}px)`;

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
  const fontSize = size ?? LOGO_SIZE_CSS;
  return (
    <div
      className={`relative inline-block leading-[0.875] ${className ?? ""}`.trim()}
      // fontSize is the single source of truth for every em-based
      // child — version, margins, paddings — so scaling is trivial.
      style={{ fontSize, ...style }}
    >
      <h1
        className="text-white"
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
          className="text-white/50"
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
