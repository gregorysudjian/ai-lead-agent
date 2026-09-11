import type { ReactNode } from "react";

import { mulberry32 } from "@/lib/demo-design/genome";
import type { DemoPalette, MotifKey } from "@/lib/demo-design/types";

/**
 * Generative art for demo sites.
 *
 * ── WHY ART AND NOT PHOTOGRAPHS ───────────────────────────────────────────
 *
 * The single biggest reason a page reads "generated" is imagery, and we have
 * none of the business's own. A stock photo of a salon that is not theirs
 * would be a lie on the page an owner is reading about their own shop. So the
 * imagery is drawn: line art built from the trade's own tools -- a barber's
 * razors and poles, a florist's petals -- composed differently for every
 * business from its seed. It reads as design, never as a photograph, and every
 * piece is aria-hidden.
 *
 * ── HOW ───────────────────────────────────────────────────────────────────
 *
 * Each motif is a glyph drawn in a 100 x 100 box. Compositions place glyphs
 * at seeded positions, sizes and angles, in layers, and the page gives each
 * layer a parallax depth. Colours come only from the palette, so the art always
 * belongs to its site. Pure SVG: no image files, no requests.
 */

// ---------------------------------------------------------------------------
// Glyphs, 100 x 100, stroke-drawn
// ---------------------------------------------------------------------------

function gearPath(): string {
  const teeth = 10;
  const points: string[] = [];
  for (let i = 0; i < teeth * 2; i += 1) {
    const r = i % 2 === 0 ? 40 : 32;
    const a = (Math.PI * i) / teeth;
    points.push(`${(50 + r * Math.cos(a)).toFixed(1)} ${(50 + r * Math.sin(a)).toFixed(1)}`);
  }
  return `M${points.join(" L")} Z`;
}

const GLYPHS: Record<MotifKey, ReactNode> = {
  shears: (
    <>
      <circle cx="30" cy="74" r="12" />
      <circle cx="58" cy="80" r="12" />
      <path d="M38 64 L84 14" />
      <path d="M52 69 L64 10" />
      <circle cx="47" cy="52" r="2.5" />
    </>
  ),
  comb: (
    <>
      <rect x="12" y="30" width="76" height="14" rx="4" />
      <path d="M18 44 V74 M26 44 V74 M34 44 V74 M42 44 V74 M50 44 V74 M58 44 V74 M66 44 V74 M74 44 V74 M82 44 V70" />
    </>
  ),
  razor: (
    <>
      <path d="M14 78 Q34 68 56 62" strokeWidth="7" strokeLinecap="round" />
      <path d="M54 62 L88 36 L94 44 L60 70 Z" />
      <circle cx="56" cy="64" r="3" />
    </>
  ),
  pole: (
    <>
      <rect x="38" y="14" width="24" height="72" rx="12" />
      <path d="M38 26 L62 40 M38 42 L62 56 M38 58 L62 72" />
      <path d="M44 8 H56 M44 92 H56" strokeLinecap="round" />
    </>
  ),
  drop: <path d="M50 10 C50 10 20 46 20 64 A30 30 0 0 0 80 64 C80 46 50 10 50 10 Z" />,
  gem: (
    <>
      <path d="M24 38 L38 18 H62 L76 38 L50 86 Z" />
      <path d="M24 38 H76 M38 18 L50 38 L62 18 M50 38 V86" />
    </>
  ),
  petal: (
    <>
      {[0, 72, 144, 216, 288].map((angle) => (
        <ellipse key={angle} cx="50" cy="30" rx="11" ry="20" transform={`rotate(${angle} 50 50)`} />
      ))}
      <circle cx="50" cy="50" r="6" />
    </>
  ),
  ink: (
    <>
      <path d="M50 8 C58 30 78 42 78 62 A28 28 0 0 1 22 62 C22 42 42 30 50 8 Z" />
      <path d="M34 62 Q42 50 50 58 T66 56" />
      <circle cx="82" cy="20" r="3" />
      <circle cx="16" cy="28" r="2" />
    </>
  ),
  star: <path d="M50 6 C54 40 60 46 94 50 C60 54 54 60 50 94 C46 60 40 54 6 50 C40 46 46 40 50 6 Z" />,
  leaf: (
    <>
      <path d="M16 84 C16 40 48 14 86 14 C86 52 58 84 16 84 Z" />
      <path d="M16 84 L66 34 M36 64 L34 46 M50 50 L64 52" />
    </>
  ),
  wheat: (
    <>
      <path d="M50 94 V16" />
      {[24, 38, 52, 66].map((y) => (
        <g key={y}>
          <ellipse cx="41" cy={y} rx="6" ry="11" transform={`rotate(-30 41 ${y})`} />
          <ellipse cx="59" cy={y} rx="6" ry="11" transform={`rotate(30 59 ${y})`} />
        </g>
      ))}
    </>
  ),
  cup: (
    <>
      <path d="M22 40 H72 V60 A24 24 0 0 1 48 84 H46 A24 24 0 0 1 22 60 Z" />
      <path d="M72 46 H80 A9 9 0 0 1 80 64 H72" />
      <path d="M38 30 Q43 22 38 14 M52 30 Q57 22 52 14" strokeLinecap="round" />
    </>
  ),
  bloom: (
    <>
      <path d="M50 50 m-6 0 a6 6 0 1 0 12 0 a12 12 0 1 0 -24 0 a18 18 0 1 0 36 0 a26 26 0 1 0 -52 0 a34 34 0 1 0 68 0" />
    </>
  ),
  cross: <path d="M40 14 H60 V40 H86 V60 H60 V86 H40 V60 H14 V40 H40 Z" />,
  tooth: (
    <path d="M30 18 C18 18 16 36 20 50 C24 64 26 86 36 86 C43 86 43 66 50 66 C57 66 57 86 64 86 C74 86 76 64 80 50 C84 36 82 18 70 18 C62 18 58 25 50 25 C42 25 38 18 30 18 Z" />
  ),
  gear: (
    <>
      <path d={gearPath()} />
      <circle cx="50" cy="50" r="12" />
    </>
  ),
  bolt: <path d="M58 6 L22 56 H48 L40 94 L78 40 H52 Z" />,
  arcs: (
    <>
      <path d="M10 90 A80 80 0 0 1 90 10" />
      <path d="M26 90 A64 64 0 0 1 90 26" />
      <path d="M42 90 A48 48 0 0 1 90 42" />
      <path d="M58 90 A32 32 0 0 1 90 58" />
    </>
  ),
  grid: (
    <>
      {[20, 40, 60, 80].map((v) => (
        <path key={v} d={`M${v} 10 V90 M10 ${v} H90`} />
      ))}
    </>
  ),
  waves: (
    <>
      {[28, 44, 60, 76].map((y) => (
        <path key={y} d={`M6 ${y} Q17 ${y - 10} 28 ${y} T50 ${y} T72 ${y} T94 ${y}`} />
      ))}
    </>
  ),
  orbs: (
    <>
      <circle cx="38" cy="42" r="26" />
      <circle cx="64" cy="62" r="20" />
      <circle cx="70" cy="30" r="8" />
    </>
  ),
  sunburst: (
    <>
      {Array.from({ length: 16 }, (_, i) => {
        const a = (Math.PI * 2 * i) / 16;
        return (
          <path
            key={i}
            d={`M${(50 + 14 * Math.cos(a)).toFixed(1)} ${(50 + 14 * Math.sin(a)).toFixed(1)} L${(50 + 44 * Math.cos(a)).toFixed(1)} ${(50 + 44 * Math.sin(a)).toFixed(1)}`}
          />
        );
      })}
      <circle cx="50" cy="50" r="8" />
    </>
  ),
};

/** One glyph, placed. Stroke-only, so it reads as line art at any size. */
function Glyph({
  motif,
  x,
  y,
  size,
  rotate,
  stroke,
  width,
  opacity = 1,
}: {
  motif: MotifKey;
  x: number;
  y: number;
  size: number;
  rotate: number;
  stroke: string;
  width: number;
  opacity?: number;
}) {
  const scale = size / 100;
  return (
    <g
      transform={`translate(${x - size / 2} ${y - size / 2}) rotate(${rotate} ${size / 2} ${size / 2}) scale(${scale})`}
      fill="none"
      stroke={stroke}
      strokeWidth={width / scale}
      strokeLinejoin="round"
      strokeLinecap="round"
      opacity={opacity}
    >
      {GLYPHS[motif]}
    </g>
  );
}

// ---------------------------------------------------------------------------
// Compositions
// ---------------------------------------------------------------------------

/**
 * Three parallax layers behind a hero: a soft field, one big glyph, sparks.
 *
 * Art sits BEHIND type, so it must never compete with it. The glyph and the
 * sparks live in a square pinned to the right edge (`xMaxYMid meet`, so the
 * square is as tall as the hero and never stretches across the headline),
 * and they are drawn faint: a watermark you notice, not lines you read
 * through. The first review had a full-strength comb striking through the
 * business's name. On a phone the square IS the whole hero, so there only
 * the soft field is drawn.
 */
export function HeroArt({
  motif,
  palette,
  seed,
  fieldOpacity = 1,
  className = "",
}: {
  motif: MotifKey;
  palette: DemoPalette;
  seed: number;
  /** Below 1 when the field colour is a strong one, as on an inverted ground. */
  fieldOpacity?: number;
  className?: string;
}) {
  const rng = mulberry32(seed ^ 0x9e3779b9);
  const bigX = 52 + rng() * 22;
  const bigY = 40 + rng() * 20;
  const bigSize = 58 + rng() * 26;
  const bigRotate = -25 + rng() * 50;
  // Sparks around the glyph's own corner of the square, not over the copy.
  const sparks = Array.from({ length: 4 }, () => ({
    x: 30 + rng() * 66,
    y: 8 + rng() * 84,
    size: 5 + rng() * 7,
    rotate: rng() * 360,
  }));
  const fieldX = 60 + rng() * 30;
  const fieldY = 30 + rng() * 40;

  return (
    <div aria-hidden="true" className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      <svg className="dx-par absolute inset-0 h-full w-full" style={{ ["--depth" as string]: "30px" }} viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
        <circle cx={fieldX} cy={fieldY} r={30} fill={palette.accentSoft} opacity={fieldOpacity} />
        <circle cx={fieldX - 34} cy={fieldY + 30} r={6} fill={palette.accentSoft} opacity={0.8 * fieldOpacity} />
      </svg>
      <svg className="dx-par absolute hidden md:block inset-0 h-full w-full" style={{ ["--depth" as string]: "90px" }} viewBox="0 0 100 100" preserveAspectRatio="xMaxYMid meet">
        <Glyph motif={motif} x={bigX} y={bigY} size={bigSize} rotate={bigRotate} stroke={palette.accentText} width={0.45} opacity={0.26} />
      </svg>
      <svg className="dx-par absolute hidden md:block inset-0 h-full w-full" style={{ ["--depth" as string]: "160px" }} viewBox="0 0 100 100" preserveAspectRatio="xMaxYMid meet">
        {sparks.map((spark, i) => (
          <Glyph key={i} motif={i % 2 === 0 ? "star" : motif} x={spark.x} y={spark.y} size={spark.size} rotate={spark.rotate} stroke={palette.accentText} width={0.4} opacity={0.4} />
        ))}
      </svg>
    </div>
  );
}

/**
 * The inside of a photo slot or gallery tile: a field, a pattern, a mark.
 *
 * Deliberately graphic. It sits under an honest label ("Your storefront") and
 * must never be mistaken for a photograph of the business.
 */
export function TileArt({
  motif,
  palette,
  seed,
  index = 0,
  scope = "",
}: {
  motif: MotifKey;
  palette: DemoPalette;
  seed: number;
  index?: number;
  /** Distinguishes two renderings of the same tile on one page, so ids stay unique. */
  scope?: string;
}) {
  const rng = mulberry32((seed + index * 7919) >>> 0);
  const id = `dx-t-${seed.toString(36)}-${index}${scope}`;
  const mode = Math.floor(rng() * 3);
  const rotate = -30 + rng() * 60;

  return (
    <svg aria-hidden="true" className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id={`${id}-g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={palette.accentSoft} />
          <stop offset="1" stopColor={palette.bgAlt} />
        </linearGradient>
        <pattern id={`${id}-p`} width="20" height="20" patternUnits="userSpaceOnUse" patternTransform={`rotate(${rotate})`}>
          <Glyph motif={motif} x={10} y={10} size={9} rotate={0} stroke={palette.line} width={0.45} />
        </pattern>
      </defs>
      <rect width="100" height="100" fill={`url(#${id}-g)`} />
      {mode === 0 ? (
        // A faint pattern alone read as wallpaper; a cropped mark over it
        // gives the tile a subject.
        <>
          <rect width="100" height="100" fill={`url(#${id}-p)`} opacity="0.45" />
          <circle cx={78} cy={78} r={34} fill={palette.accent} opacity="0.12" />
          <Glyph motif={motif} x={74} y={70} size={56} rotate={rotate} stroke={palette.accentText} width={0.7} opacity={0.55} />
        </>
      ) : null}
      {mode === 1 ? (
        <Glyph motif={motif} x={50 + rng() * 20 - 10} y={50 + rng() * 20 - 10} size={70} rotate={rotate} stroke={palette.accentText} width={0.6} opacity={0.5} />
      ) : null}
      {mode === 2 ? (
        <>
          <circle cx={30 + rng() * 40} cy={30 + rng() * 40} r={26 + rng() * 14} fill={palette.accent} opacity="0.16" />
          <Glyph motif={motif} x={60} y={42} size={38} rotate={rotate} stroke={palette.accentText} width={0.6} opacity={0.6} />
        </>
      ) : null}
    </svg>
  );
}

/**
 * A rotating ring of text around a monogram -- the business's own name, its
 * trade and its district, set on a circle. All three are facts we hold.
 */
export function Badge({
  text,
  mark,
  palette,
  size = 150,
  className = "",
}: {
  text: string;
  mark: string;
  palette: DemoPalette;
  size?: number;
  className?: string;
}) {
  // The size is part of the id: a page can carry two badges with the same text
  // (a monogram hero and a split about section) and ids must stay unique.
  const id = `dx-b-${Math.abs(hashText(text)).toString(36)}-${size}`;
  const ring = `${text} · `.repeat(Math.max(1, Math.ceil(46 / (text.length + 3))));
  return (
    <div aria-hidden="true" className={`relative ${className}`} style={{ width: size, height: size }}>
      <svg className="dx-spin absolute inset-0 h-full w-full" viewBox="0 0 100 100">
        <defs>
          <path id={id} d="M50 50 m-38 0 a38 38 0 1 1 76 0 a38 38 0 1 1 -76 0" />
        </defs>
        <text fill={palette.accentText} fontSize="7.2" letterSpacing="1.4" style={{ textTransform: "uppercase", fontFamily: "var(--dx-body)" }}>
          <textPath href={`#${id}`}>{ring}</textPath>
        </text>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className="dx-display flex items-center justify-center rounded-full"
          style={{
            width: size * 0.46,
            height: size * 0.46,
            background: palette.accent,
            color: palette.onAccent,
            fontSize: size * 0.2,
            lineHeight: 1,
          }}
        >
          {mark}
        </span>
      </div>
    </div>
  );
}

/** A small divider mark between sections. */
export function MarkDivider({ motif, palette }: { motif: MotifKey; palette: DemoPalette }) {
  return (
    <svg aria-hidden="true" className="dx-turn h-9 w-9" viewBox="0 0 100 100">
      <Glyph motif={motif} x={50} y={50} size={86} rotate={0} stroke={palette.accentText} width={4} />
    </svg>
  );
}

function hashText(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) hash = (Math.imul(hash, 31) + text.charCodeAt(i)) | 0;
  return hash;
}
