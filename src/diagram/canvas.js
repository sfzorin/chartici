/**
 * CANVAS — единственный источник истины для параметров холста.
 *
 * Потребители:
 *   DiagramRenderer.jsx  — viewBox defaults, grid pattern, snap step
 *   LeftToolbox.jsx      — aspect/bg options в настройках холста
 *   layout.js            — smartAlign snap/group thresholds
 *   nodeLayouter.js      — grid snap step
 *   engine/index.js      — A* routing gridStep tiers
 *   layoutTimeline.js    — step snap
 *   charticiFormat.js    — config serialization (aspect, bgColor)
 *
 * Чтобы изменить поведение холста — менять только этот файл.
 */

// ─── Grid ────────────────────────────────────────────────────────────────────
export const GRID = {
  /** Base grid step in px — used for snapping, layout, and visual grid pattern */
  step:             20,
  /** Pattern size for UI checkerboard (= step) */
  patternSize:      20,
  /** A* routing grid tiers (relaxation cascade) */
  routingTiers: [
    { gridStep: 20, allowOverlap: false, allowCrossing: false, ignorePadding: false },
    { gridStep: 20, allowOverlap: false, allowCrossing: true,  ignorePadding: false },
    { gridStep: 10, allowOverlap: false, allowCrossing: true,  ignorePadding: false },
    { gridStep: 10, allowOverlap: true,  allowCrossing: true,  ignorePadding: false },
    { gridStep: 10, allowOverlap: true,  allowCrossing: true,  ignorePadding: true  },
  ],
};

/** Smart-align thresholds (used by layout.js smartAlign) */
export const SMART_ALIGN = {
  groupThreshold:   40,   // px — nodes within this distance are grouped
  snapStep:         GRID.step,
};

// ─── Empty canvas defaults ───────────────────────────────────────────────────
/** Default viewBox when no nodes exist (centered ~800×900 area) */
export const EMPTY_CANVAS = {
  minX:   600,
  minY:   420,
  maxX:  1000,
  maxY:   480,
  /** Minimum viewBox dimensions */
  minViewW:  200,
  minViewH:  200,
};

// ─── Background options ──────────────────────────────────────────────────────
/**
 * Available background presets for the Canvas Settings popover.
 * `id` matches keys in CANVAS_COLORS (colors.js).
 */
export const BG_OPTIONS = [
  { id: 'black', label: 'Solid Black' },
  { id: 'white', label: 'Solid White' },
];

// ─── Aspect ratio options ────────────────────────────────────────────────────
/**
 * Available aspect ratio presets for the Canvas Settings popover.
 * `id` is stored as data.config.aspect in .cci files.
 */
export const ASPECT_OPTIONS = [
  { id: '16:9', label: '16:9' },
  { id: '4:3',  label: '4:3'  },
  { id: '1:1',  label: '1:1'  },
];
