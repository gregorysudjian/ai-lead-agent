import { brandName } from "@/lib/demo-design/brand";
import type { DemoDesign } from "@/lib/demo-design/types";

import { displayFontVar, V2_FONT_VARIABLES } from "./v2/fonts";

/**
 * A demo's look at a glance: the business's name in the site's own display
 * face, on the site's own ground, with its accent colours.
 *
 * Drawn from the STORED design, like the site itself, so the strip on the
 * index always matches what "Open preview" shows. A demo from before designs
 * existed gets a plain strip saying so, rather than a made-up look.
 */
export function DesignStrip({ name, design }: { name: string; design: DemoDesign | undefined }) {
  if (!design) {
    return (
      <div className="flex h-20 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
        Original design, made before the new generator
      </div>
    );
  }

  const { palette } = design;
  return (
    <div
      aria-hidden="true"
      className={`relative flex h-20 items-center overflow-hidden rounded-lg px-5 ${V2_FONT_VARIABLES}`}
      style={{ background: palette.bg, color: palette.ink, boxShadow: `inset 0 0 0 1px ${palette.line}` }}
    >
      <span
        className="truncate pr-24 text-2xl leading-none"
        style={{
          fontFamily: `${displayFontVar(design.fonts.display)}, Georgia, serif`,
          textTransform: design.displayCase === "upper" ? "uppercase" : undefined,
        }}
      >
        {brandName(name)}
      </span>
      {/* The colours a visitor would notice first. */}
      <span className="absolute right-4 flex -space-x-1.5">
        {[palette.accent, palette.accentSoft, palette.invert].map((colour, i) => (
          <span
            key={i}
            className="h-6 w-6 rounded-full"
            style={{ background: colour, boxShadow: `0 0 0 2px ${palette.bg}` }}
          />
        ))}
      </span>
    </div>
  );
}
