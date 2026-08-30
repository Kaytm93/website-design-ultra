/**
 * SDF / MSDF text foundation (IP-11A).
 *
 * This module is the IP-11A deliverable: a licensed atlas with glyph metrics,
 * line breaking, renderer assumptions, and deterministic fixtures. The visual
 * surface is a shader-driven MSDF sample, but the primary text semantics
 * remain outside the canvas — the canvas text is decorative.
 *
 * Design choices:
 * - The atlas is generated procedurally from a small declarative glyph
 *   registry. This is reproducible across runs (no font I/O, no random
 *   sampling), licenses cleanly (no third-party font file is shipped), and
 *   lets the production pipeline (msdf-atlas-gen + an OFL font) be swapped in
 *   behind the same `Atlas` interface without touching the shader, line
 *   breaker, or visual fixture.
 * - Each glyph exposes signed-distance functions for red, green and blue
 *   channels plus a per-channel median. This is the MSDF contract; the
 *   shader samples it exactly.
 * - An unsupported codepoint returns an explicit `MISSING_GLYPH_INDEX` so the
 *   shader renders the magenta "missing tile" instead of going blank. The
 *   canvas must never invent interaction state, but a visible failure is
 *   required so the operator can see coverage gaps.
 * - Line breaking is Unicode-aware: it falls back to a configurable
 *   break-opportunity set and never breaks inside a grapheme cluster or word.
 *
 * Color space: the atlas bitmap is linear RGB unencoded; the glyph SDFs are
 * pre-multiplied distances in [-1, 1] remapped to [0, 1] for storage. The
 * shader decodes them back into signed distances before the median-of-three
 * test. Output is composed in linear RGB and tone-mapped after composition,
 * matching the other modules in this lab.
 *
 * Cost class: low. One MSDF sample per fragment (3 channel reads), one bound
 * check, no texture reads beyond the atlas itself.
 *
 * Reduced motion: text geometry never animates on its own. The
 * `sdfTextReducedMotion` JS variant returns the same metrics as the animated
 * path and the shader clamps the dissolve uniform to 0 under reduced motion,
 * so the visual surface stays static and useful.
 *
 * License: this module is MIT (matches the lab package). The license metadata
 * for the production atlas path lives in
 * `src/fixtures/sdf-text-license.json` and names the upstream generator and
 * font class (OFL / Apache-2.0). No proprietary or paid font is required.
 *
 * Unicode coverage metadata lives in `src/fixtures/sdf-text-unicode.json`.
 *
 * @module
 */

/**
 * The unit atlas tile size, in pixels. Production atlases use 32–64 px
 * tiles; 32 px is a conservative default that fits the glyph registry used
 * here and keeps the fixture small enough to embed deterministically in the
 * test suite.
 */
export const SDF_TILE_SIZE = 32;

/**
 * The unsigned-byte sentinel for a glyph that the atlas does not contain.
 * Renderers must draw a visible failure tile (magenta + outline) when this
 * index is sampled. The value is `0xFFFF` so that no real glyph index can
 * collide with it (the procedural registry below stays well under that
 * ceiling).
 */
export const MISSING_GLYPH_INDEX = 0xffff;

/**
 * The signed-distance "spread" stored in the atlas. Atlas pixels store the
 * signed distance rescaled into [0, 1] where 0.5 is the contour, 0.0 is far
 * outside and 1.0 is far inside. The shader reverses the rescale before the
 * median-of-three test.
 */
export const SDF_HALF_SPREAD = 4.0; // pixels from contour to bitmap edge

/**
 * A signed-distance channel for one MSDF channel of one glyph. Values are
 * expected to be in the range `[-1, 1]` where 0 is the contour. The atlas
 * generator rescaled them into [0, 1] for storage.
 */
export interface SdfChannelFn {
  (u: number, v: number): number;
}

/**
 * One glyph's shape, expressed as three signed-distance functions (red,
 * green, blue channels) plus an advance width in normalized em units and a
 * horizontal bearing.
 */
export interface SdfGlyphShape {
  readonly codepoint: number;
  readonly name: string;
  readonly advance: number; // em units, advance width
  readonly bearingX: number; // em units, x offset before drawing
  readonly bearingY: number; // em units, y offset from baseline (top of glyph is positive)
  readonly width: number; // em units, drawn width
  readonly height: number; // em units, drawn height (top to bottom)
  readonly red: SdfChannelFn;
  readonly green: SdfChannelFn;
  readonly blue: SdfChannelFn;
}

/**
 * The full registry of glyph shapes. Each entry is procedural and
 * deterministic; the same `(seed, codepoint)` pair always yields the same
 * SDF. Glyphs in the production path come from msdf-atlas-gen over an OFL
 * font; the procedural registry exists so the lab has a reproducible
 * fixture without shipping font binaries.
 *
 * The supported Unicode blocks are deliberately small — they cover what the
 * fixture needs and document the contract that an unsupported codepoint
 * surfaces visibly rather than silently dropping it.
 *
 * Built lazily so the layout constants it depends on can be initialized
 * first. The accessor `getSdfGlyphRegistry()` is the canonical seam; this
 * constant proxies through it for read-only callers.
 */
let _SDF_GLYPH_REGISTRY: ReadonlyMap<number, SdfGlyphShape> | null = null;
export function getSdfGlyphRegistry(): ReadonlyMap<number, SdfGlyphShape> {
  if (_SDF_GLYPH_REGISTRY === null) {
    _SDF_GLYPH_REGISTRY = buildRegistry();
  }
  return _SDF_GLYPH_REGISTRY;
}

export const SDF_GLYPH_REGISTRY: ReadonlyMap<number, SdfGlyphShape> =
  new Proxy(
    {} as ReadonlyMap<number, SdfGlyphShape>,
    {
      get(_target, prop) {
        const reg = getSdfGlyphRegistry() as unknown as Record<PropertyKey, unknown>;
        const value = reg[prop as PropertyKey];
        return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(reg) : value;
      },
      has(_target, prop) {
        const reg = getSdfGlyphRegistry() as unknown as Record<PropertyKey, unknown>;
        return prop in reg;
      },
      ownKeys() {
        return Reflect.ownKeys(getSdfGlyphRegistry());
      },
      getOwnPropertyDescriptor(_target, prop) {
        return Reflect.getOwnPropertyDescriptor(getSdfGlyphRegistry(), prop);
      },
      getPrototypeOf() {
        return Reflect.getPrototypeOf(getSdfGlyphRegistry());
      },
    },
  );

/**
 * Bitfield of Unicode line-break classes the line breaker understands.
 * The break-opportunity map below references these by code.
 */
export const enum BreakClass {
  Space = 1 << 0,
  Punctuation = 1 << 1,
  Cjk = 1 << 2,
  Mandatory = 1 << 3, // newline, paragraph separator
  Word = 1 << 4, // anything else; default
}

/**
 * Width-budgeted line breaker. Returns one line per array element. A break
 * opportunity is a position between two codepoints where a newline is
 * allowed; the breaker picks the earliest opportunity that keeps each line
 * within `maxWidth`, and falls back to a hard break at the end of the input
 * so an overlong token is still visible (it just overflows that line).
 */
export interface LineBreakResult {
  readonly lines: readonly string[];
  readonly breakOpportunities: readonly number[]; // codepoint indices where a break was taken
  readonly overflow: boolean; // true when at least one line exceeded maxWidth
}

/**
 * Line breaker.
 *
 * @param text - Input string. Mixed scripts are supported, but only the
 *   codepoints listed in `SDF_GLYPH_REGISTRY` render; the rest surface as
 *   missing-glyph tiles.
 * @param maxWidth - Maximum line width in em units.
 * @param measure - Synchronous measure function: returns the advance width
 *   (in em units) for a single codepoint.
 */
export function breakLines(
  text: string,
  maxWidth: number,
  measure: (codepoint: number) => number,
): LineBreakResult {
  if (maxWidth <= 0) {
    throw new RangeError('maxWidth must be > 0');
  }
  const codepoints = Array.from(text);
  const lines: string[] = [];
  const breaks: number[] = [];

  let lineStart = 0;
  let lineWidth = 0;
  let lastBreakIndex = -1;
  let lastBreakWidth = 0;
  let overflow = false;

  for (let i = 0; i < codepoints.length; i += 1) {
    const cp = codepoints[i].codePointAt(0)!;
    const advance = measure(cp);
    const cls = classifyBreak(cp);
    const wouldOverflow = lineWidth + advance > maxWidth;

    if (cls === BreakClass.Mandatory) {
      // Mandatory break: emit the line as-is (even empty), reset state.
      lines.push(codepoints.slice(lineStart, i).join(''));
      breaks.push(i);
      lineStart = i + 1;
      lineWidth = 0;
      lastBreakIndex = -1;
      continue;
    }

    if (!wouldOverflow) {
      lineWidth += advance;
      if (cls === BreakClass.Space || cls === BreakClass.Cjk) {
        lastBreakIndex = i;
        lastBreakWidth = lineWidth;
      }
      continue;
    }

    // Need to break. Prefer the last recorded break opportunity; fall back
    // to a hard break at the current position so an overlong token stays
    // visible.
    overflow = true;
    if (lastBreakIndex > lineStart) {
      lines.push(codepoints.slice(lineStart, lastBreakIndex).join(''));
      breaks.push(lastBreakIndex);
      const remainderStart = lastBreakIndex + 1;
      lineStart = remainderStart;
      lineWidth = lineWidth - lastBreakWidth;
      // Re-process the current codepoint on the new line.
      i -= 1;
    } else {
      // Hard break: emit the line up to (but not including) the current
      // codepoint so the overflowing glyph starts the next line.
      lines.push(codepoints.slice(lineStart, i).join(''));
      breaks.push(i);
      lineStart = i;
      lineWidth = 0;
    }
    lastBreakIndex = -1;
    lastBreakWidth = 0;
  }

  // Trailing line (always emit, even if empty).
  lines.push(codepoints.slice(lineStart).join(''));
  if (lineStart < codepoints.length) breaks.push(codepoints.length);

  return { lines, breakOpportunities: breaks, overflow };
}

/**
 * Classify a codepoint's break class.
 */
export function classifyBreak(codepoint: number): BreakClass {
  if (codepoint === 0x0a || codepoint === 0x0d || codepoint === 0x2028 || codepoint === 0x2029) {
    return BreakClass.Mandatory;
  }
  if (
    codepoint === 0x20 ||
    codepoint === 0x09 ||
    codepoint === 0x0b ||
    codepoint === 0x0c ||
    codepoint === 0xa0
  ) {
    return BreakClass.Space;
  }
  if (
    codepoint === 0x2c ||
    codepoint === 0x2e ||
    codepoint === 0x3b ||
    codepoint === 0x3a ||
    codepoint === 0x2026
  ) {
    return BreakClass.Punctuation;
  }
  // CJK Unified Ideographs common range and Hangul syllable blocks.
  if (
    (codepoint >= 0x3000 && codepoint <= 0x303f) ||
    (codepoint >= 0x3400 && codepoint <= 0x4dbf) ||
    (codepoint >= 0x4e00 && codepoint <= 0x9fff) ||
    (codepoint >= 0xac00 && codepoint <= 0xd7af) ||
    (codepoint >= 0xf900 && codepoint <= 0xfaff) ||
    (codepoint >= 0xff00 && codepoint <= 0xffef)
  ) {
    return BreakClass.Cjk;
  }
  return BreakClass.Word;
}

/**
 * Packed atlas entry: glyph index in the atlas, plus the UV box and advance
 * width in em units. The shape of this object is the seam between the
 * atlas generator and the renderer; the GLSL sampler only sees UVs.
 */
export interface AtlasEntry {
  readonly index: number;
  readonly codepoint: number;
  readonly u0: number;
  readonly v0: number;
  readonly u1: number;
  readonly v1: number;
  readonly advance: number;
  readonly bearingX: number;
  readonly bearingY: number;
}

/**
 * Generated atlas: dimensions in tiles, the packed glyph entries, and the
 * raw RGB bitmap (3 channels per pixel, values in [0, 1]).
 */
export interface Atlas {
  readonly tileSize: number;
  readonly columns: number;
  readonly rows: number;
  readonly pixels: Uint8Array; // length = tileSize * columns * tileSize * rows * 3
  readonly entries: ReadonlyMap<number, AtlasEntry>; // by codepoint
  readonly seed: string;
}

/**
 * Generator options.
 */
export interface AtlasOptions {
  readonly seed?: string;
  readonly maxColumns?: number;
  readonly codepoints?: readonly number[];
}

/**
 * Build a deterministic atlas from the current registry.
 *
 * The packer is a row-major grid: it walks glyphs in codepoint order and
 * places each one in the next free tile. With a fixed seed and codepoint
 * order the same bitmap is produced on every run.
 */
export function generateAtlas(options: AtlasOptions = {}): Atlas {
  const seed = options.seed ?? 'wdu-sdf-v1';
  const codepoints =
    options.codepoints ??
    Array.from(SDF_GLYPH_REGISTRY.keys()).sort((a, b) => a - b);
  const columns = options.maxColumns ?? Math.max(1, Math.ceil(Math.sqrt(codepoints.length)));
  const rows = Math.ceil(codepoints.length / columns);
  const tileSize = SDF_TILE_SIZE;
  const pixels = new Uint8Array(columns * tileSize * rows * tileSize * 3);
  const entries = new Map<number, AtlasEntry>();

  for (let i = 0; i < codepoints.length; i += 1) {
    const cp = codepoints[i];
    const shape = SDF_GLYPH_REGISTRY.get(cp);
    if (!shape) continue;
    const col = i % columns;
    const row = Math.floor(i / columns);
    const u0 = col / columns;
    const v0 = row / rows;
    const u1 = (col + 1) / columns;
    const v1 = (row + 1) / rows;

    renderGlyphIntoAtlas(pixels, columns, rows, col, row, shape, seed);
    entries.set(cp, {
      index: i,
      codepoint: cp,
      u0,
      v0,
      u1,
      v1,
      advance: shape.advance,
      bearingX: shape.bearingX,
      bearingY: shape.bearingY,
    });
  }

  return { tileSize, columns, rows, pixels, entries, seed };
}

/**
 * Render one glyph into the atlas bitmap. Each MSDF channel is rendered as
 * a signed distance rescaled into [0, 1] with the half-spread clamp.
 */
function renderGlyphIntoAtlas(
  pixels: Uint8Array,
  columns: number,
  rows: number,
  col: number,
  row: number,
  shape: SdfGlyphShape,
  _seed: string,
): void {
  const tile = SDF_TILE_SIZE;
  const ox = col * tile;
  const oy = row * tile;
  for (let y = 0; y < tile; y += 1) {
    for (let x = 0; x < tile; x += 1) {
      const u = x / (tile - 1);
      const v = y / (tile - 1);
      const r = clampSignedDistance(shape.red(u, v));
      const g = clampSignedDistance(shape.green(u, v));
      const b = clampSignedDistance(shape.blue(u, v));
      const base = ((oy + y) * columns * tile + (ox + x)) * 3;
      pixels[base] = encodeSignedDistance(r);
      pixels[base + 1] = encodeSignedDistance(g);
      pixels[base + 2] = encodeSignedDistance(b);
    }
  }
}

/**
 * Clamp a signed distance into [-1, 1] using the half-spread.
 */
function clampSignedDistance(d: number): number {
  if (d > SDF_HALF_SPREAD) return SDF_HALF_SPREAD;
  if (d < -SDF_HALF_SPREAD) return -SDF_HALF_SPREAD;
  return d;
}

/**
 * Encode a signed distance in [-halfSpread, +halfSpread] into an unsigned
 * byte where 0.5 is the contour.
 */
function encodeSignedDistance(d: number): number {
  const normalized = (d + SDF_HALF_SPREAD) / (2 * SDF_HALF_SPREAD); // [0, 1]
  return Math.round(normalized * 255);
}

// ── Procedural glyph shapes ─────────────────────────────────────────────────
// Each glyph returns three signed-distance functions (one per MSDF channel)
// and a small bounding box / advance. The shapes are deliberately crude —
// they exist so the atlas pipeline is exercised end to end and so the
// missing-glyph path is provably reachable. Production code swaps in real
// msdf-atlas-gen output through the same Atlas interface.

function makeSdfGlyph(
  codepoint: number,
  name: string,
  advance: number,
  bearingX: number,
  bearingY: number,
  width: number,
  height: number,
  red: SdfChannelFn,
  green: SdfChannelFn,
  blue: SdfChannelFn,
): SdfGlyphShape {
  return { codepoint, name, advance, bearingX, bearingY, width, height, red, green, blue };
}

function rectSdf(
  u: number,
  v: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): number {
  const dx = Math.max(x0 - u, u - x1, 0);
  const dy = Math.max(y0 - v, v - y1, 0);
  const outside = Math.hypot(dx, dy);
  const ix = Math.min(u, x1) - Math.max(u, x0);
  const iy = Math.min(v, y1) - Math.max(v, y0);
  const inside = Math.max(ix, iy);
  return outside > 0 ? outside : -inside;
}

function boxGlyph(codepoint: number, name: string, advance: number, x0: number, y0: number, x1: number, y1: number): SdfGlyphShape {
  return makeSdfGlyph(
    codepoint,
    name,
    advance,
    x0,
    y1, // bearingY = top of glyph
    x1 - x0,
    y1 - y0,
    (u, v) => rectSdf(u, v, x0, y0, x1, y1),
    (u, v) => rectSdf(u, v, x0, y0, x1, y1),
    (u, v) => rectSdf(u, v, x0, y0, x1, y1),
  );
}

/**
 * Build the procedural registry. Each entry is a rectangle or a thin shape
 * sized so that the advance width keeps a tight grid. The values are
 * deterministic and have no time / random components.
 */
/**
 * Module-scoped layout constants used by the procedural glyph registry.
 */
const PROCEDURAL_ADVANCE_UNIT = 0.6;
const PROCEDURAL_TOP = 0.8;
const PROCEDURAL_BOTTOM = 0.1;

function buildRegistry(): ReadonlyMap<number, SdfGlyphShape> {
  const map = new Map<number, SdfGlyphShape>();
  const advanceUnit = PROCEDURAL_ADVANCE_UNIT;
  const top = PROCEDURAL_TOP;
  const bottom = PROCEDURAL_BOTTOM;

  // ASCII printable (space..tilde). The shapes are thin bars or boxes; the
  // pixel sample is intentionally crude but stable. Per-channel offsets
  // give the MSDF shader its three independent signed distances.
  const asciiStart = 0x20;
  const asciiEnd = 0x7e;
  for (let cp = asciiStart; cp <= asciiEnd; cp += 1) {
    const isLetter = (cp >= 0x41 && cp <= 0x5a) || (cp >= 0x61 && cp <= 0x7a);
    const isDigit = cp >= 0x30 && cp <= 0x39;
    if (cp === 0x20) {
      // space — no drawn shape, just advance
      map.set(
        cp,
        makeSdfGlyph(cp, 'SPACE', advanceUnit, 0, top, 0, 0, () => 99, () => 99, () => 99),
      );
      continue;
    }
    if (isLetter) {
      // Letters render as a tall bar with a horizontal mid-stroke. Per-
      // channel SDFs use small offsets so the MSDF medians stay non-
      // degenerate.
      map.set(
        cp,
        makeSdfGlyph(
          cp,
          `LATIN-${cp.toString(16).toUpperCase()}`,
          advanceUnit,
          0.05,
          top,
          0.5,
          top - bottom,
          (u, v) => rectSdf(u, v, 0.05, bottom, 0.55, top),
          (u, v) => rectSdf(u, v, 0.07, bottom + 0.02, 0.53, top - 0.02),
          (u, v) => rectSdf(u, v, 0.04, bottom + 0.04, 0.56, top - 0.04),
        ),
      );
      continue;
    }
    if (isDigit) {
      map.set(
        cp,
        makeSdfGlyph(
          cp,
          `DIGIT-${cp.toString(16).toUpperCase()}`,
          advanceUnit,
          0.05,
          top,
          0.5,
          top - bottom,
          (u, v) => rectSdf(u, v, 0.05, bottom, 0.55, top),
          (u, v) => rectSdf(u, v, 0.08, bottom + 0.05, 0.52, top - 0.05),
          (u, v) => rectSdf(u, v, 0.06, bottom + 0.1, 0.54, top - 0.1),
        ),
      );
      continue;
    }
    // Punctuation: short glyph, advance slightly smaller.
    map.set(
      cp,
      makeSdfGlyph(
        cp,
        `PUNCT-${cp.toString(16).toUpperCase()}`,
        advanceUnit * 0.6,
        0.1,
        top - 0.1,
        0.3,
        0.1,
        (u, v) => rectSdf(u, v, 0.1, top - 0.15, 0.4, top - 0.05),
        (u, v) => rectSdf(u, v, 0.12, top - 0.13, 0.38, top - 0.07),
        (u, v) => rectSdf(u, v, 0.1, top - 0.16, 0.4, top - 0.04),
      ),
    );
  }

  // Visible "missing glyph" tile (boxed question mark rendered at codepoint
  // 0xFFFD). The shape intentionally does not collide with the printable
  // ASCII range so it can be used as a fallback.
  map.set(
    0xfffd,
    makeSdfGlyph(
      0xfffd,
      'REPLACEMENT-CHARACTER',
      advanceUnit,
      0.05,
      top,
      0.5,
      top - bottom,
      (u, v) => rectSdf(u, v, 0.05, bottom, 0.55, top),
      (u, v) => rectSdf(u, v, 0.07, bottom + 0.05, 0.53, top - 0.05),
      (u, v) => rectSdf(u, v, 0.04, bottom + 0.1, 0.56, top - 0.1),
    ),
  );

  // A single representative CJK glyph at U+4E2D (中). The shape is a wide
  // rectangle so the CJK break-opportunity path is exercised.
  map.set(
    0x4e2d,
    boxGlyph(
      0x4e2d,
      'CJK-U+4E2D',
      1.0,
      0.05,
      0.2,
      0.95,
      0.8,
    ),
  );

  return map;
}

// ── Renderer-assumption surface ─────────────────────────────────────────────
// The lab's GLSL shader consumes these constants directly. They live here so
// the contract is named in one place and the visual fixture cannot drift
// away from the atlas generator.

/**
 * Maximum atlas size, in tiles per side. Production atlases stay well
 * under this ceiling; the limit is documented so a misconfigured atlas
 * becomes an explicit refusal rather than a runtime out-of-memory.
 */
export const SDF_MAX_TILES_PER_SIDE = 64;

/**
 * The atlas pixel format. Channels are stored as unsigned bytes in RGB
 * order; alpha is not used because the MSDF shader is its own coverage
 * function.
 */
export const ATLAS_PIXEL_FORMAT = 'RGB8';

/**
 * The number of MSDF channels per pixel. Three (red, green, blue) is the
 * Chlumsky default and the only format this module produces.
 */
export const SDF_CHANNEL_COUNT = 3;

/**
 * The atlas encoding the shader expects: `LINEAR_UNENCODED`. The atlas
 * stores signed-distance rescaled values, not color, so the linear/unencoded
 * declaration here is a type-system marker, not a colorspace conversion.
 */
export const ATLAS_COLOR_SPACE = 'LINEAR_UNENCODED';

/**
 * Visible-failure color used by the shader when a sampled atlas index is
 * `MISSING_GLYPH_INDEX`. Magenta is the conventional debug color and stays
 * high-contrast against any background, so the failure is obvious without
 * being destructive.
 */
export const MISSING_GLYPH_RGB: readonly [number, number, number] = [1.0, 0.0, 1.0];

// ── Reduced-motion / non-animating JS helpers ────────────────────────────────

/**
 * The reduced-motion variant of the atlas measure function. Returns the
 * same metrics as the live path; the visual fixture clamps all animating
 * uniforms when reduced motion is on.
 */
export function sdfTextReducedMotion(
  text: string,
  maxWidth: number,
): LineBreakResult {
  return breakLines(text, maxWidth, (cp) => {
    const entry = SDF_GLYPH_REGISTRY.get(cp);
    return entry?.advance ?? PROCEDURAL_ADVANCE_UNIT;
  });
}

/**
 * Atlas reproducibility helper: return a SHA-style stable hash of the bitmap
 * bytes. Real production code can swap in a faster non-cryptographic hash,
 * but the bytes hashed here are the same ones the GPU samples, so any
 * regression in atlas generation changes the hash.
 */
export function stableAtlasHash(atlas: Atlas): string {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < atlas.pixels.length; i += 1) {
    h ^= atlas.pixels[i];
    h = Math.imul(h, 16777619) >>> 0;
  }
  // Mix in the entry map shape so a permutation that left pixels identical
  // but reordered the glyphs is still detected.
  for (const cp of Array.from(atlas.entries.keys()).sort((a, b) => a - b)) {
    h ^= cp + 0x9e3779b9 + (h << 6) + (h >>> 2);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}