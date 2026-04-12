import React from 'react';

/**
 * NODE_REGISTRY — единственный источник истины для всех типов нод.
 *
 * Потребители:
 *   constants.js      -> getNodeDim()
 *   geometry.js       -> getNodePorts()
 *   DiagramNode.jsx   -> shapePlugins (render, getTextLimits, getSelectionBounds)
 *                        + outline, selection, text colors
 *
 * Чтобы добавить новый тип ноды — добавить один ключ здесь.
 * Больше никаких файлов редактировать не нужно (кроме LeftToolbox для меню и
 * engines schema.js для включения в конкретный тип диаграммы).
 *
 * ─── Структура каждой записи ────────────────────────────────────────────────
 *
 * sizes
 *   Статические ноды: { width, height, fontSize }
 *   Динамические (text/title): { fontSize } — w/h вычисляются из контента
 *
 * ports
 *   'all'       — 4 кардинальных + bifurcation при больших размерах
 *   'topbottom' — только Top и Bottom (chevron, timeline spine)
 *   'none'      — не подключаются к рёбрам (pie_slice, text, title)
 *
 * portCatalog
 *   Список именованных портов из PORT_CATALOG. Описывает геометрию портов.
 *   Пенальти определяются в engine's engine.js → routing.portPenalty().
 *
 * diagonalPorts (только circle)
 *   Предвычисленные swoop-выходы для S/M/L — дополнение к cardinal портам.
 *
 * outline
 *   Внешний вид в режиме outlined-группы (полый, только контур).
 *
 * selection
 *   Подсветка при наведении и выборе ноды.
 *
 * render(w, h, fill, stroke, strokeW, dash, filter, node) -> JSX
 *   SVG-элемент формы ноды.
 *
 * getTextLimits(w, h) -> { maxWidth, maxHeight }
 *   Ограничения для текстового лейбла внутри ноды.
 *
 * getSelectionBounds(w, h, padding, color, node) -> JSX
 *   SVG-элемент подсветки выбора/hover (форма повторяет форму ноды).
 */

// ─── Shared selection presets ─────────────────────────────────────────────
const SEL = {
  rect:   { shape: 'rect',   padding: 5, rx: 10, haloWidth: 10, haloOpacity: 0.3, ringWidth: 2 },
  circle: { shape: 'circle', padding: 5,          haloWidth: 10, haloOpacity: 0.3, ringWidth: 2 },
  oval:   { shape: 'oval',   padding: 5,          haloWidth: 10, haloOpacity: 0.3, ringWidth: 2 },
  text:   { shape: 'rect',   padding: 4, rx: 4,  haloWidth:  6, haloOpacity: 0.2, ringWidth: 1 },
};

// ─── Shared selection bound helpers ──────────────────────────────────────
const selRect = (w, h, pad, color, rx = 10) => (
  <g>
    <rect x={-pad} y={-pad} width={w + pad*2} height={h + pad*2} rx={rx} fill="none" stroke={color} strokeWidth="10" opacity="0.3" />
    <rect x={-pad} y={-pad} width={w + pad*2} height={h + pad*2} rx={rx} fill="none" stroke={color} strokeWidth="2" />
  </g>
);

// ─── Shared outline presets ───────────────────────────────────────────────
const OUTLINE = {
  normal: { strokeWidth: 2 },
  thick:  { strokeWidth: 3 },
};

// ─── PORT_CATALOG primitives ──────────────────────────────────────────────
/**
 * Описывает только ГЕОМЕТРИЮ порта — без стоимости маршрутизации.
 * Пенальти задаётся в каждом engine's routing.js -> portPenalty().
 *
 * Primary ports:   нет threshold — генерируются всегда
 * Bifurcation:     threshold — генерируются когда размер ноды >= значения
 *   BifTop/BifBottom  w >= 80px
 *   BifLeft/BifRight  h >= 80px
 *   count: 2 -> geometry генерирует 2 порта: cx-20 и cx+20 (или cy-20/cy+20)
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

const ALL_PORTS = [P.Top, P.Bottom, P.Left, P.Right, P.BifTop, P.BifBottom, P.BifLeft, P.BifRight];

// ─────────────────────────────────────────────────────────────────────────────
export const NODE_REGISTRY = {

  // ── process (rectangle / block) ────────────────────────────────────────────
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
    outline:   OUTLINE.thick,
    selection: SEL.rect,

    getTextLimits:    (w, h) => ({ maxWidth: w, maxHeight: h }),
    getSelectionBounds: (w, h, pad, color) => selRect(w, h, pad, color, 10),
    render: (w, h, fill, stroke, strokeW, dash, filter) =>
      <rect x={0} y={0} width={w} height={h} rx={2} fill={fill} stroke={stroke} strokeWidth={strokeW} strokeDasharray={dash} filter={filter} />,
  },

  // ── element (alias for process used by some engines) ───────────────────────
  element: {
    label: 'Element',
    icon:  'shape-rect',
    sizes: {
      S: { width: 120, height:  60, fontSize: 12 },
      M: { width: 160, height:  80, fontSize: 16 },
      L: { width: 240, height: 120, fontSize: 22 },
    },
    ports: 'all',
    portCatalog: ALL_PORTS,
    outline:   OUTLINE.thick,
    selection: SEL.rect,

    getTextLimits:    (w, h) => ({ maxWidth: w * 0.85, maxHeight: h * 0.85 }),
    getSelectionBounds: (w, h, pad, color) => selRect(w, h, pad, color, 10),
    render: (w, h, fill, stroke, strokeW, dash, filter) =>
      <rect x={0} y={0} width={w} height={h} rx={2} fill={fill} stroke={stroke} strokeWidth={strokeW} strokeDasharray={dash} filter={filter} />,
  },

  // ── circle ─────────────────────────────────────────────────────────────────
  circle: {
    label: 'Circle',
    icon:  'shape-circle',
    // Always square: width === height === 2r
    sizes: {
      S: { width:  60, height:  60, fontSize: 11 }, // r = 30
      M: { width:  80, height:  80, fontSize: 14 }, // r = 40
      L: { width: 120, height: 120, fontSize: 18 }, // r = 60
    },
    // Same bifurcation as any other node; diagonalPorts added as supplement by geometry.js
    ports: 'all',
    portCatalog: ALL_PORTS,
    outline:   OUTLINE.thick,
    selection: SEL.circle,

    /**
     * Pre-computed diagonal swoop ports for A* routing.
     * 4 steep swoops (~30 deg from vertical) + 4 shallow (~60 deg).
     * Offsets relative to node center (cx, cy).
     * anchor = surface point, exit = snapped grid exit.
     */
    diagonalPorts: {
      S: [ // r = 30
        { anchor: { dx:  15, dy: -26 }, exit: { dx:  20, dy: -40 }, axis: 'V', sign: -1, dir: 'Top'    },
        { anchor: { dx: -15, dy: -26 }, exit: { dx: -20, dy: -40 }, axis: 'V', sign: -1, dir: 'Top'    },
        { anchor: { dx:  15, dy:  26 }, exit: { dx:  20, dy:  40 }, axis: 'V', sign:  1, dir: 'Bottom' },
        { anchor: { dx: -15, dy:  26 }, exit: { dx: -20, dy:  40 }, axis: 'V', sign:  1, dir: 'Bottom' },
        { anchor: { dx:  26, dy: -15 }, exit: { dx:  40, dy: -20 }, axis: 'H', sign:  1, dir: 'Right'  },
        { anchor: { dx: -26, dy: -15 }, exit: { dx: -40, dy: -20 }, axis: 'H', sign: -1, dir: 'Left'   },
        { anchor: { dx:  26, dy:  15 }, exit: { dx:  40, dy:  20 }, axis: 'H', sign:  1, dir: 'Right'  },
        { anchor: { dx: -26, dy:  15 }, exit: { dx: -40, dy:  20 }, axis: 'H', sign: -1, dir: 'Left'   },
      ],
      M: [ // r = 40
        { anchor: { dx:  20, dy: -35 }, exit: { dx:  40, dy: -80 }, axis: 'V', sign: -1, dir: 'Top'    },
        { anchor: { dx: -20, dy: -35 }, exit: { dx: -40, dy: -80 }, axis: 'V', sign: -1, dir: 'Top'    },
        { anchor: { dx:  20, dy:  35 }, exit: { dx:  40, dy:  80 }, axis: 'V', sign:  1, dir: 'Bottom' },
        { anchor: { dx: -20, dy:  35 }, exit: { dx: -40, dy:  80 }, axis: 'V', sign:  1, dir: 'Bottom' },
        { anchor: { dx:  35, dy: -20 }, exit: { dx:  80, dy: -40 }, axis: 'H', sign:  1, dir: 'Right'  },
        { anchor: { dx: -35, dy: -20 }, exit: { dx: -80, dy: -40 }, axis: 'H', sign: -1, dir: 'Left'   },
        { anchor: { dx:  35, dy:  20 }, exit: { dx:  80, dy:  40 }, axis: 'H', sign:  1, dir: 'Right'  },
        { anchor: { dx: -35, dy:  20 }, exit: { dx: -80, dy:  40 }, axis: 'H', sign: -1, dir: 'Left'   },
      ],
      L: [ // r = 60 — same exits as M, wider anchors
        { anchor: { dx:  30, dy: -52 }, exit: { dx:  40, dy: -80 }, axis: 'V', sign: -1, dir: 'Top'    },
        { anchor: { dx: -30, dy: -52 }, exit: { dx: -40, dy: -80 }, axis: 'V', sign: -1, dir: 'Top'    },
        { anchor: { dx:  30, dy:  52 }, exit: { dx:  40, dy:  80 }, axis: 'V', sign:  1, dir: 'Bottom' },
        { anchor: { dx: -30, dy:  52 }, exit: { dx: -40, dy:  80 }, axis: 'V', sign:  1, dir: 'Bottom' },
        { anchor: { dx:  52, dy: -30 }, exit: { dx:  80, dy: -40 }, axis: 'H', sign:  1, dir: 'Right'  },
        { anchor: { dx: -52, dy: -30 }, exit: { dx: -80, dy: -40 }, axis: 'H', sign: -1, dir: 'Left'   },
        { anchor: { dx:  52, dy:  30 }, exit: { dx:  80, dy:  40 }, axis: 'H', sign:  1, dir: 'Right'  },
        { anchor: { dx: -52, dy:  30 }, exit: { dx: -80, dy:  40 }, axis: 'H', sign: -1, dir: 'Left'   },
      ],
    },

    getTextLimits: (w, h) => ({ maxWidth: Math.min(w, h) * 0.75, maxHeight: Math.min(w, h) * 0.75 }),
    getSelectionBounds: (w, h, pad, color) => {
      const r = Math.min(w, h) / 2;
      return (
        <g>
          <circle cx={w/2} cy={h/2} r={r + pad} fill="none" stroke={color} strokeWidth="10" opacity="0.3" />
          <circle cx={w/2} cy={h/2} r={r + pad} fill="none" stroke={color} strokeWidth="2" />
        </g>
      );
    },
    render: (w, h, fill, stroke, strokeW, dash, filter) => {
      const r = Math.min(w, h) / 2;
      return <circle cx={w/2} cy={h/2} r={r} fill={fill} stroke={stroke} strokeWidth={strokeW} strokeDasharray={dash} filter={filter} />;
    },
  },

  // ── oval (stadium / pill) ──────────────────────────────────────────────────
  oval: {
    label: 'Oval',
    icon:  'shape-oval',
    sizes: {
      S: { width: 120, height:  60, fontSize: 12 },
      M: { width: 200, height:  80, fontSize: 16 },
      L: { width: 280, height: 120, fontSize: 22 },
    },
    ports: 'all',
    // Curved: lateral bifurcation suppressed
    portCatalog: [P.Top, P.Bottom, P.Left, P.Right, P.BifTop, P.BifBottom],
    outline:   OUTLINE.thick,
    selection: SEL.oval,

    getTextLimits: (w, h) => ({ maxWidth: w - Math.min(w, h) * 0.5, maxHeight: h }),
    getSelectionBounds: (w, h, pad, color) => {
      const rx = Math.min(w, h) / 2 + pad;
      return selRect(w, h, pad, color, rx);
    },
    render: (w, h, fill, stroke, strokeW, dash, filter) => {
      const rx = Math.min(w, h) / 2;
      return <rect x={0} y={0} width={w} height={h} rx={rx} fill={fill} stroke={stroke} strokeWidth={strokeW} strokeDasharray={dash} filter={filter} />;
    },
  },

  // ── rhombus (diamond / decision) ──────────────────────────────────────────
  rhombus: {
    label: 'Diamond',
    icon:  'shape-diamond',
    sizes: {
      S: { width: 120, height:  60, fontSize: 11 },
      M: { width: 160, height:  80, fontSize: 14 },
      L: { width: 240, height: 120, fontSize: 18 },
    },
    ports: 'all',
    // Pointed shape: no bifurcation
    portCatalog: [P.Top, P.Bottom, P.Left, P.Right],
    outline:   OUTLINE.thick,
    selection: SEL.rect,

    getTextLimits: (w, h) => ({ maxWidth: w * 0.6, maxHeight: h * 0.6 }),
    getSelectionBounds: (w, h, pad, color) => {
      const cx = w/2, cy = h/2;
      const pts = `${cx},${-pad} ${w+pad},${cy} ${cx},${h+pad} ${-pad},${cy}`;
      return (
        <g>
          <polygon points={pts} fill="none" stroke={color} strokeWidth="10" opacity="0.3" />
          <polygon points={pts} fill="none" stroke={color} strokeWidth="2" />
        </g>
      );
    },
    render: (w, h, fill, stroke, strokeW, dash, filter) => {
      const r = 3, ex = 1.5;
      const pts = [
        { x: -ex,   y: h/2 },
        { x: w/2,   y: -ex },
        { x: w+ex,  y: h/2 },
        { x: w/2,   y: h+ex },
      ];
      let d = '';
      for (let i = 0; i < 4; i++) {
        const p1 = pts[(i+3)%4], p2 = pts[i], p3 = pts[(i+1)%4];
        const d1 = Math.hypot(p2.x-p1.x, p2.y-p1.y);
        const d2 = Math.hypot(p3.x-p2.x, p3.y-p2.y);
        const qSx = p2.x + ((p1.x-p2.x)/d1)*r, qSy = p2.y + ((p1.y-p2.y)/d1)*r;
        const qEx = p2.x + ((p3.x-p2.x)/d2)*r, qEy = p2.y + ((p3.y-p2.y)/d2)*r;
        d += i === 0 ? `M ${qSx} ${qSy}` : ` L ${qSx} ${qSy}`;
        d += ` Q ${p2.x} ${p2.y} ${qEx} ${qEy}`;
      }
      d += ' Z';
      return <path d={d} fill={fill} stroke={stroke} strokeWidth={strokeW} strokeDasharray={dash} filter={filter} />;
    },
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
    outline:   OUTLINE.thick,
    selection: SEL.rect,

    // Pre-computed paths per height to avoid float imprecision at design time
    _paths: {
       40: { shape: 'M -20 0 L 90 0 L 100 20 L 90 40 L -20 40 L -10 20 Z',    sel: 'M -20 0 L 90 0 L 100 20 L 90 40 L -20 40 L -10 20 Z' },
       60: { shape: 'M -22 0 L 127 0 L 142 30 L 127 60 L -22 60 L -7 30 Z',   sel: 'M -22 0 L 127 0 L 142 30 L 127 60 L -22 60 L -7 30 Z' },
       80: { shape: 'M -25 0 L 165 0 L 185 40 L 165 80 L -25 80 L -5 40 Z',   sel: 'M -25 0 L 165 0 L 185 40 L 165 80 L -25 80 L -5 40 Z' },
      120: { shape: 'M -47.5 0 L 257.5 0 L 287.5 60 L 257.5 120 L -47.5 120 L -17.5 60 Z', sel: 'M -47.5 0 L 257.5 0 L 287.5 60 L 257.5 120 L -47.5 120 L -17.5 60 Z' },
      160: { shape: 'M -50 0 L 330 0 L 370 80 L 330 160 L -50 160 L -10 80 Z', sel: 'M -50 0 L 330 0 L 370 80 L 330 160 L -50 160 L -10 80 Z' },
    },

    getTextLimits: (w, h) => ({ maxWidth: w - 24, maxHeight: h }),
    getSelectionBounds(w, h, pad, color) {
      const d = this._paths[h]?.sel
        || `M -15 0 L ${w+5} 0 L ${w+20} ${h/2} L ${w+5} ${h} L -15 ${h} L -5 ${h/2} Z`;
      return (
        <g>
          <path d={d} fill="none" stroke={color} strokeWidth={pad * 2} strokeLinejoin="round" opacity="0.3" />
          <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
        </g>
      );
    },
    render(w, h, fill, stroke, strokeW, dash, filter) {
      const d = this._paths[h]?.shape
        || `M -15 0 L ${w+5} 0 L ${w+20} ${h/2} L ${w+5} ${h} L -15 ${h} L -5 ${h/2} Z`;
      return <path d={d} fill={fill} stroke={stroke} strokeWidth={strokeW} strokeDasharray={dash} strokeLinejoin="round" filter={filter} />;
    },
  },

  // ── pie_slice (piechart sector) ────────────────────────────────────────────
  pie_slice: {
    label: 'Slice',
    icon:  'shape-slice',
    sizes: {
      // M = нормальный сектор; L = "выдвинутый" (explode-смещение наружу)
      // Радиус всех секторов 300px; size влияет только на explode
      M: { width: 600, height: 600, fontSize: 16 },
      L: { width: 600, height: 600, fontSize: 16 },
    },
    ports: 'none',
    portCatalog: [],
    outline:   OUTLINE.normal,
    selection: { shape: 'slice', padding: 4, haloWidth: 10, haloOpacity: 0.3, ringWidth: 2 },

    externalLabel: {
      fontSize:    13,
      fontWeight:  600,
      offsetRatio: 1.18,
      showPercent: true,
    },
    legend: {
      fontSize:   14,
      swatchSize: 16,
      gap:         8,
      position:  'bottom',
    },

    getTextLimits: (w, h) => ({ maxWidth: (Math.min(w, h) / 2) * 0.6, maxHeight: (Math.min(w, h) / 2) * 0.6 }),
    getSelectionBounds: (w, h, pad, color, node) => {
      const cx = w/2, cy = h/2;
      const r = Math.min(w, h) / 2 + pad;
      const startRaw = node?.pieStartAngle || 0;
      const endRaw   = node?.pieEndAngle   || Math.PI * 2;
      let pathD;
      if (endRaw - startRaw >= Math.PI * 2 - 0.001) {
        pathD = `M ${cx} ${cy-r} A ${r} ${r} 0 1 1 ${cx} ${cy+r} A ${r} ${r} 0 1 1 ${cx} ${cy-r} Z`;
      } else {
        const start = startRaw - Math.PI/2 - pad/r;
        const end   = endRaw   - Math.PI/2 + pad/r;
        const x1 = cx + r*Math.cos(start), y1 = cy + r*Math.sin(start);
        const x2 = cx + r*Math.cos(end),   y2 = cy + r*Math.sin(end);
        const laf = end - start <= Math.PI ? '0' : '1';
        pathD = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${laf} 1 ${x2} ${y2} Z`;
      }
      return (
        <g>
          <path d={pathD} fill="none" stroke={color} strokeWidth="10" strokeLinejoin="round" opacity="0.3" />
          <path d={pathD} fill="none" stroke={color} strokeWidth="2"  strokeLinejoin="round" />
        </g>
      );
    },
    render: (w, h, fill, stroke, strokeW, dash, filter, node) => {
      const cx = w/2, cy = h/2, r = Math.min(w, h) / 2;
      const startRaw = node?.pieStartAngle || 0;
      const endRaw   = node?.pieEndAngle   || Math.PI * 2;
      let pathD;
      if (endRaw - startRaw >= Math.PI * 2 - 0.001) {
        pathD = `M ${cx} ${cy-r} A ${r} ${r} 0 1 1 ${cx} ${cy+r} A ${r} ${r} 0 1 1 ${cx} ${cy-r} Z`;
      } else {
        const start = startRaw - Math.PI/2;
        const end   = endRaw   - Math.PI/2;
        const x1 = cx + r*Math.cos(start), y1 = cy + r*Math.sin(start);
        const x2 = cx + r*Math.cos(end),   y2 = cy + r*Math.sin(end);
        const laf = end - start <= Math.PI ? '0' : '1';
        pathD = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${laf} 1 ${x2} ${y2} Z`;
      }
      const actualFill = node?.color ? `var(--color-${node.color})` : fill;
      return <path d={pathD} fill={actualFill} stroke={node?._canvasBg} strokeWidth="2" strokeDasharray="none" filter={filter} />;
    },
  },

  // ── text (free annotation) ─────────────────────────────────────────────────
  text: {
    label: 'Annotation',
    icon:  'text-shape',
    dynamicSize: true,
    sizes: {
      S: { fontSize: 14 },
      M: { fontSize: 18 },
      L: { fontSize: 28 },
    },
    ports: 'none',
    portCatalog: [],
    outline:   OUTLINE.normal,
    selection: SEL.text,

    getTextLimits:    (w, h) => ({ maxWidth: w, maxHeight: h }),
    getSelectionBounds: (w, h, pad, color) => selRect(w, h, pad, color, 4),
    render: (w, h) =>
      <rect x={0} y={0} width={w} height={h} fill="transparent" stroke="transparent" />,
  },

  // ── title (diagram heading) ────────────────────────────────────────────────
  title: {
    label: 'Heading',
    icon:  'text-shape',
    dynamicSize: true,
    defaultSize: 'M',         // размер по умолчанию при создании
    sizes: {
      S: { fontSize: 40 },
      M: { fontSize: 56 },
      L: { fontSize: 80 },
    },
    /**
     * layoutSpacing — вертикальный отступ (px), резервируемый над диаграммой
     * для заголовка при авто-лэйауте (DiagramRenderer.jsx).
     * Значения подобраны под высоту строки с учётом межстрочного интервала 1.2.
     */
    layoutSpacing: {
      S: 60,
      M: 80,
      L: 120,
    },
    ports: 'none',
    portCatalog: [],
    outline:   OUTLINE.normal,
    selection: SEL.text,

    getTextLimits:    (w, h) => ({ maxWidth: w, maxHeight: h }),
    getSelectionBounds: (w, h, pad, color) => selRect(w, h, pad, color, 4),
    render: (w, h) =>
      <rect x={0} y={0} width={w} height={h} fill="transparent" stroke="transparent" />,
  },
};

// ─── Derived pie constants (single source of truth) ──────────────────────────
// All consumers MUST use these instead of hardcoding pixel values.
const _pieM = NODE_REGISTRY.pie_slice.sizes.M;
export const PIE_CONSTS = {
  radius:       _pieM.width / 2,                          // 300
  explodeDist:  Math.round(_pieM.width / 2 * 0.167),      // 50  (~1/6 radius)
  collisionR:   Math.round(_pieM.width / 2 * 0.75),       // 225 (inner approx)
  calloutPad:   Math.round(_pieM.width / 2 * 0.67),       // 200 (label room)
  legendOffset: Math.round(_pieM.width / 2 * 0.4),        // 120 (legend gap)
  explodePad:   Math.round(_pieM.width / 2 * 0.133),      // 40  (explode extra)
};

export const LEGEND_SIZES = {
  S: { fontSize: 16, rowH: 36, padX: 16, padY: 12, charW: 9,  maxLabelW: 220, swW: 20, swH: 14, swRx: 2, textOff: 30 },
  M: { fontSize: 22, rowH: 50, padX: 20, padY: 16, charW: 13, maxLabelW: 300, swW: 28, swH: 20, swRx: 3, textOff: 42 },
  L: { fontSize: 28, rowH: 64, padX: 24, padY: 20, charW: 17, maxLabelW: 400, swW: 36, swH: 26, swRx: 4, textOff: 54 },
};

/**
 * Resolve pixel dimensions for a node instance.
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
