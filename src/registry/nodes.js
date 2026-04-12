/**
 * NODE_REGISTRY — single source of truth for ALL node types.
 *
 * Consumed by:
 *   constants.js      → getNodeDim()
 *   geometry.js       → getNodePorts()
 *   DiagramNode.jsx   → outline, selection, text colors
 *
 * Dependency rule: this file has ZERO imports — pure static data.
 *
 * sizes
 *   Static node types: { width, height, fontSize }
 *   Dynamic node types (text/title): { fontSize } only — w/h computed from content
 *
 * ports
 *   'all'       → 4 cardinal + bifurcation offsets for large nodes
 *   'topbottom' → Top and Bottom only (chevron, timeline spine)
 *   'radial'    → 4 cardinal + 8 diagonal swoops (circle)
 *   'none'      → not connectable (pie_slice, text, title)
 *
 * diagonalPorts (circle only)
 *   Pre-computed swoop exits for S/M/L so geometry.js needs zero trig.
 *   anchor: surface point on the circle (for line drawing)
 *   exit:   snapped routing grid point outside the circle
 *   All coordinates are offsets relative to node center (cx, cy).
 *
 * outline
 *   Visual when a node is in "outlined" group mode (hollow, border only).
 *   strokeWidth: border thickness
 *
 * selection
 *   Visual used for both hover (pointer) and selected state.
 *   shape:   'rect' | 'circle' | 'oval' — determines SVG element used
 *   padding: extra space around node bounds
 *   haloWidth:   outer glow stroke width
 *   haloOpacity: outer glow opacity
 *   ringWidth:   sharp ring stroke width
 */

// ─── Shared selection presets ──────────────────────────────────────────────
const SEL = {
  rect:   { shape: 'rect',   padding: 5, rx: 10, haloWidth: 10, haloOpacity: 0.3, ringWidth: 2 },
  circle: { shape: 'circle', padding: 5,          haloWidth: 10, haloOpacity: 0.3, ringWidth: 2 },
  oval:   { shape: 'oval',   padding: 5,          haloWidth: 10, haloOpacity: 0.3, ringWidth: 2 },
  text:   { shape: 'rect',   padding: 4, rx: 4,  haloWidth:  6, haloOpacity: 0.2, ringWidth: 1 },
};

// ─── Shared outline presets ────────────────────────────────────────────────
const OUTLINE = {
  normal: { strokeWidth: 2 },
  thick:  { strokeWidth: 3 },
};

/**
 * PORT_CATALOG primitives — reused across node types.
 *
 * Each entry describes PORT GEOMETRY only — no routing cost.
 * Penalty (routing cost) is defined per engine in each engine's routing.js -> portPenalty().
 *
 * Primary ports:    no threshold — always generated
 * Bifurcation ports: threshold — generated when node dimension ≥ value
 *   BifTop / BifBottom  active when w ≥ 80px (node is wide enough to bifurcate Top/Bottom)
 *   BifLeft / BifRight  active when h ≥ 80px (node is tall enough to bifurcate Left/Right)
 *   count: 2 → geometry generates 2 ports: at cx-20 and cx+20 (or cy-20 and cy+20)
 */
const P = {
  Top:       { id: 'Top',       axis: 'V', sign: -1 },
  Bottom:    { id: 'Bottom',    axis: 'V', sign:  1 },
  Left:      { id: 'Left',      axis: 'H', sign: -1 },
  Right:     { id: 'Right',     axis: 'H', sign:  1 },
  BifTop:    { id: 'BifTop',    axis: 'V', sign: -1, threshold: { w: 80 }, count: 2 },
  BifBottom: { id: 'BifBottom', axis: 'V', sign:  1, threshold: { w: 80 }, count: 2 },
  BifLeft:   { id: 'BifLeft',   axis: 'H', sign: -1, threshold: { h: 80 }, count: 2 },
  BifRight:  { id: 'BifRight',  axis: 'H', sign:  1, threshold: { h: 80 }, count: 2 },
};

// Full standard port set (primary + bifurcation) — used by process, circle, oval*, rhombus*
// *oval and rhombus suppress some entries via their own portCatalog
const ALL_PORTS = [P.Top, P.Bottom, P.Left, P.Right, P.BifTop, P.BifBottom, P.BifLeft, P.BifRight];

export const NODE_REGISTRY = {

  // ── process (rectangle / block) ──────────────────────────────────────────
  process: {
    label: 'Block',
    icon:  'shape-rect',
    sizes: {
      S: { width: 120, height:  60, fontSize: 12 },
      M: { width: 160, height:  80, fontSize: 16 },
      L: { width: 240, height: 120, fontSize: 22 },
    },
    ports: 'all',
    portCatalog: ALL_PORTS,
    outline:  OUTLINE.thick,
    selection: SEL.rect,
  },

  // ── circle ────────────────────────────────────────────────────────────────
  circle: {
    label: 'Circle',
    icon:  'shape-circle',
    // Circle is always square (width === height === 2r)
    sizes: {
      S: { width:  60, height:  60, fontSize: 11 }, // r = 30
      M: { width:  80, height:  80, fontSize: 14 }, // r = 40
      L: { width: 120, height: 120, fontSize: 18 }, // r = 60
    },
    // Same bifurcation structure as any other node.
    // diagonalPorts are ADDITIONAL primary exits added on top by geometry.js.
    ports: 'all',
    portCatalog: ALL_PORTS,
    outline:  OUTLINE.thick,
    selection: SEL.circle,

    /**
     * Pre-computed diagonal swoop ports for A* routing.
     * 4 steep swoops (~30° from vertical) and 4 shallow swoops (~60°).
     * Offsets are relative to the node center (cx, cy).
     * Values derived from: anchor = (r·sinθ, r·cosθ), exit = snap20(anchor + projection)
     */
    diagonalPorts: {
      S: [ // r = 30
        // Steep swoops (~30° from vertical) — exit axis V
        { anchor: { dx:  15, dy: -26 }, exit: { dx:  20, dy: -40 }, axis: 'V', sign: -1, dir: 'Top'    },
        { anchor: { dx: -15, dy: -26 }, exit: { dx: -20, dy: -40 }, axis: 'V', sign: -1, dir: 'Top'    },
        { anchor: { dx:  15, dy:  26 }, exit: { dx:  20, dy:  40 }, axis: 'V', sign:  1, dir: 'Bottom' },
        { anchor: { dx: -15, dy:  26 }, exit: { dx: -20, dy:  40 }, axis: 'V', sign:  1, dir: 'Bottom' },
        // Shallow swoops (~60° from vertical) — exit axis H
        { anchor: { dx:  26, dy: -15 }, exit: { dx:  40, dy: -20 }, axis: 'H', sign:  1, dir: 'Right'  },
        { anchor: { dx: -26, dy: -15 }, exit: { dx: -40, dy: -20 }, axis: 'H', sign: -1, dir: 'Left'   },
        { anchor: { dx:  26, dy:  15 }, exit: { dx:  40, dy:  20 }, axis: 'H', sign:  1, dir: 'Right'  },
        { anchor: { dx: -26, dy:  15 }, exit: { dx: -40, dy:  20 }, axis: 'H', sign: -1, dir: 'Left'   },
      ],
      M: [ // r = 40
        // Steep swoops — exit axis V
        { anchor: { dx:  20, dy: -35 }, exit: { dx:  40, dy: -80 }, axis: 'V', sign: -1, dir: 'Top'    },
        { anchor: { dx: -20, dy: -35 }, exit: { dx: -40, dy: -80 }, axis: 'V', sign: -1, dir: 'Top'    },
        { anchor: { dx:  20, dy:  35 }, exit: { dx:  40, dy:  80 }, axis: 'V', sign:  1, dir: 'Bottom' },
        { anchor: { dx: -20, dy:  35 }, exit: { dx: -40, dy:  80 }, axis: 'V', sign:  1, dir: 'Bottom' },
        // Shallow swoops — exit axis H
        { anchor: { dx:  35, dy: -20 }, exit: { dx:  80, dy: -40 }, axis: 'H', sign:  1, dir: 'Right'  },
        { anchor: { dx: -35, dy: -20 }, exit: { dx: -80, dy: -40 }, axis: 'H', sign: -1, dir: 'Left'   },
        { anchor: { dx:  35, dy:  20 }, exit: { dx:  80, dy:  40 }, axis: 'H', sign:  1, dir: 'Right'  },
        { anchor: { dx: -35, dy:  20 }, exit: { dx: -80, dy:  40 }, axis: 'H', sign: -1, dir: 'Left'   },
      ],
      L: [ // r = 60 — exits coincide with M; anchors are wider
        // Steep swoops — exit axis V
        { anchor: { dx:  30, dy: -52 }, exit: { dx:  40, dy: -80 }, axis: 'V', sign: -1, dir: 'Top'    },
        { anchor: { dx: -30, dy: -52 }, exit: { dx: -40, dy: -80 }, axis: 'V', sign: -1, dir: 'Top'    },
        { anchor: { dx:  30, dy:  52 }, exit: { dx:  40, dy:  80 }, axis: 'V', sign:  1, dir: 'Bottom' },
        { anchor: { dx: -30, dy:  52 }, exit: { dx: -40, dy:  80 }, axis: 'V', sign:  1, dir: 'Bottom' },
        // Shallow swoops — exit axis H
        { anchor: { dx:  52, dy: -30 }, exit: { dx:  80, dy: -40 }, axis: 'H', sign:  1, dir: 'Right'  },
        { anchor: { dx: -52, dy: -30 }, exit: { dx: -80, dy: -40 }, axis: 'H', sign: -1, dir: 'Left'   },
        { anchor: { dx:  52, dy:  30 }, exit: { dx:  80, dy:  40 }, axis: 'H', sign:  1, dir: 'Right'  },
        { anchor: { dx: -52, dy:  30 }, exit: { dx: -80, dy:  40 }, axis: 'H', sign: -1, dir: 'Left'   },
      ],
    },
  },

  // ── oval (stadium / pill) ─────────────────────────────────────────────────
  oval: {
    label: 'Oval',
    icon:  'shape-oval',
    // Width = round((baseWidth + baseHeight/4) / 40) * 40
    sizes: {
      S: { width: 120, height:  60, fontSize: 12 }, // round((120+15)/40)*40 = 120
      M: { width: 200, height:  80, fontSize: 16 }, // round((160+20)/40)*40 = 200
      L: { width: 280, height: 120, fontSize: 22 }, // round((240+30)/40)*40 = 280
    },
    ports: 'all',
    // Curved shape: no lateral bifurcation (BifLeft/BifRight suppressed)
    portCatalog: [P.Top, P.Bottom, P.Left, P.Right, P.BifTop, P.BifBottom],
    outline:  OUTLINE.thick,
    selection: SEL.oval,
  },

  // ── rhombus (diamond / decision) ─────────────────────────────────────────
  rhombus: {
    label: 'Diamond',
    icon:  'shape-diamond',
    sizes: {
      S: { width: 120, height:  60, fontSize: 11 },
      M: { width: 160, height:  80, fontSize: 14 },
      L: { width: 240, height: 120, fontSize: 18 },
    },
    ports: 'all',
    // Curved/pointed shape: no bifurcation at all
    portCatalog: [P.Top, P.Bottom, P.Left, P.Right],
    outline:  OUTLINE.thick,
    // ShapeRegistry.getSelectionBounds handles rhombus-shaped halo
    selection: SEL.rect,
  },

  // ── chevron (timeline phase) ──────────────────────────────────────────────
  chevron: {
    label: 'Chevron',
    icon:  'shape-chevron',
    sizes: {
      S: { width: 120, height:  60, fontSize: 12 },
      M: { width: 160, height:  80, fontSize: 16 },
      L: { width: 240, height: 120, fontSize: 22 },
    },
    ports: 'topbottom',
    portCatalog: [P.Top, P.Bottom],
    outline:  OUTLINE.thick,
    selection: SEL.rect,
  },

  // ── pie_slice (piechart sector) ───────────────────────────────────────────
  pie_slice: {
    label: 'Slice',
    icon:  'shape-slice',
    // Pie is always square; the actual sector is drawn by ShapeRegistry
    sizes: {
      S: { width: 240, height: 240, fontSize: 14 },
      M: { width: 400, height: 400, fontSize: 16 },
      L: { width: 560, height: 560, fontSize: 18 },
    },
    ports: 'none',
    portCatalog: [],
    outline:  OUTLINE.normal,
    selection: { shape: 'slice', padding: 4, haloWidth: 10, haloOpacity: 0.3, ringWidth: 2 },

    // Piechart-specific: external label positioned at slice midpoint
    externalLabel: {
      fontSize:    13,
      fontWeight:  600,
      offsetRatio: 1.18, // push label outward by this factor from center
      showPercent: true,
    },
    // Legend rendered below the pie
    legend: {
      fontSize:   14,
      swatchSize: 16,
      gap:         8,
      position:  'bottom',
    },
  },

  // ── text (free annotation) ────────────────────────────────────────────────
  text: {
    label: 'Annotation',
    icon:  'shape-text',
    dynamicSize: true, // width/height computed from content at runtime
    sizes: {
      S: { fontSize: 14 },
      M: { fontSize: 18 },
      L: { fontSize: 28 },
    },
    ports: 'none',
    portCatalog: [],
    outline:  OUTLINE.normal,
    selection: SEL.text,
  },

  // ── title (diagram heading) ───────────────────────────────────────────────
  title: {
    label: 'Heading',
    icon:  'shape-title',
    dynamicSize: true,
    sizes: {
      S: { fontSize: 40 },
      M: { fontSize: 56 },
      L: { fontSize: 80 },
    },
    ports: 'none',
    portCatalog: [],
    outline:  OUTLINE.normal,
    selection: SEL.text,
  },
};


/**
 * Resolve pixel dimensions for a node instance.
 * Replaces the previous getNodeDim() in constants.js.
 * For static nodes: returns { width, height, fontSize }.
 * For dynamic nodes (text/title): computes width/height from content.
 */
export function getNodeDim(node) {
  if (!node) return { width: 160, height: 80, fontSize: 16 };

  let size = node.size || 'M';
  if (size === 'XS') size = 'S';
  if (size === 'XL') size = 'L';

  const def = NODE_REGISTRY[node.type];
  const sizeDef = def?.sizes?.[size] || NODE_REGISTRY.process.sizes[size];

  // Dynamic nodes: compute bounds from text content
  if (def?.dynamicSize) {
    const fs = sizeDef.fontSize;
    const text = node.label || 'Text';
    const lines = text.split('\n');
    const longestLine = Math.max(...lines.map(l => l.length));
    const estWidth  = longestLine * fs * 0.62;
    const estHeight = lines.length * fs * 1.2;
    return {
      width:    Math.max(Math.ceil(estWidth  / 40) * 40, 40),
      height:   Math.max(Math.ceil(estHeight / 40) * 40, 40),
      fontSize: fs,
    };
  }

  return { ...sizeDef };
}
