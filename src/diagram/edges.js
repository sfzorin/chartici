import { DIAGRAM_DESIGN } from './design.js';

/**
 * EDGE_REGISTRY — единственный источник истины для всех параметров рёбер.
 *
 * Потребители:
 *   DiagramEdge.jsx   — stroke, dashArray, label, маркеры стрелок
 *   engine/index.js   — стиль рендера (straight, curved, orthogonal)
 *   engine/svgPaths.js — cornerRadius, jumpRadius
 *
 * LINE_STYLE_REGISTRY   — внешний вид линии (штрих, толщина, прозрачность)
 * PATH_STYLE_REGISTRY   — способ рендера пути (прямой, коленчатый, изогнутый)
 * EDGE_LABEL_STYLE      — размеры и метрики подписей рёбер
 * ARROW_MARKER          — геометрия стандартного наконечника стрелки
 * CF_MARKERS            — геометрия ERD crow's-foot маркеров
 * ARROW_TYPE_REGISTRY   — направление стрелок (target/reverse/both/none)
 * CONNECTION_TYPE_REGISTRY — ERD семантика (1:1, 1:N, N:M...)
 */

// ─── Line stroke styles ──────────────────────────────────────────────────────
/**
 * strokeWidth   — в обычном режиме
 * print         — override для темы print-book
 * dashArray     — SVG strokeDasharray
 * opacity       — базовая прозрачность линии
 * logicalOpacity — прозрачность для hidden/none стилей
 */
export const LINE_STYLE_REGISTRY = {
  solid:  { label: 'Solid',  dashArray: 'none', strokeWidth: DIAGRAM_DESIGN.edge.solidWidth, opacity: DIAGRAM_DESIGN.edge.solidOpacity, exportable: true, print: { strokeWidth: 1.4 } },
  dashed: { label: 'Dashed', dashArray: DIAGRAM_DESIGN.edge.dashedPattern, strokeWidth: DIAGRAM_DESIGN.edge.dashedWidth, opacity: DIAGRAM_DESIGN.edge.dashedOpacity, exportable: true, print: { strokeWidth: 1.2 } },
  none:   { label: 'Hidden', dashArray: '4, 5', strokeWidth: 2, opacity: 0.4, exportable: false, logicalOpacity: DIAGRAM_DESIGN.edge.logicalOpacity },
};

// ─── Path routing/rendering styles ──────────────────────────────────────────
/**
 * Три способа рендера рёбер:
 *
 *  orthogonal_astar — коленчатый (L-образный), A* маршрутизатор
 *    cornerRadius  — скругление угла (px)
 *    jumpRadius    — радиус дуги перехода на перекрёстке
 *
 *  straight — прямой, просто клипим на границе ноды
 *
 *  curved — изогнутый безье (для radial и других органических разводок)
 *    curveStrength — перпендикулярное смещение контрольной точки,
 *                   как доля от длины линии (0..1)
 *    cornerRadius  — скругление для Multi-Segment путей
 *
 *  none — скрытый (piechart)
 *
 * edgeStyle ключ в engines engine/layout.js ссылается на один из этих ключей.
 */
export const PATH_STYLE_REGISTRY = {
  orthogonal_astar: {
    label: 'Orthogonal',
    cornerRadius: 4,
    jumpRadius: 6,
  },
  straight: {
    label: 'Straight',
    cornerRadius: 0,
    jumpRadius: 0,
  },

  curved: {
    label: 'Curved',
    /**
     * curveStyle:
     *   'arc'  — кубический безье, обе точки в одну сторону (дуга, как струна).
     *             Intensity варьируется по длине линии → короткие почти прямые,
     *             длинные — заметная дуга. Лучший выбор для radial.
     *   'flow' — S-образный кубический безье (точки в разные стороны).
     *             Подходит для потоковых схем.
     */
    curveStyle: 'flow',
    /**
     * curveStrength — базовая сила изгиба как доля от длины линии.
     * Итоговое смещение = min(len * curveStrength, curveCap).
     */
    curveStrength: 0.1,
    curveCap: 120,   // максимальный изгиб в пикселях (ограничивает очень длинные рёбра)
    cornerRadius: 8,
    jumpRadius: 0,
  },
  none: {
    label: 'Hidden',
  },
};

// ─── Label typography ────────────────────────────────────────────────────────
/**
 * Едиточный набор параметров для отрисовки подписи ребра.
 * DiagramEdge.jsx использует charWidth и padding для проверки вхождения.
 */
export const EDGE_LABEL_STYLE = {
  fontSize: DIAGRAM_DESIGN.edge.labelFontSize,
  fontWeight: DIAGRAM_DESIGN.edge.labelWeight,
  charWidth: DIAGRAM_DESIGN.edge.labelCharWidth,
  basePadding: 18,
  arrowPadding: 22,
  haloWidth: DIAGRAM_DESIGN.edge.labelHaloWidth,
  offsetY: DIAGRAM_DESIGN.edge.labelOffsetY,
};

// ─── Standard arrow marker geometry ─────────────────────────────────────────
/**
 * Используется для markerStart/markerEnd стандартных стрелок (non-ERD).
 * DiagramEdge.jsx инстанцирует <marker> с этими параметрами.
 */
export const ARROW_MARKER = {
  width: 11,
  height: 8,
  refX: 9.5,
  refY: 4,
  orient: 'auto-start-reverse',
  // d: path для заполненной стрелки (isLogical=false)
  solidD: 'M 1.4 1.3 L 9.5 4 L 1.4 6.7 Q 3.1 4 1.4 1.3 Z',
  // для пунктирной/логической стрелки (isLogical=true)
  logicalD: 'M 1.5 1.5 L 9.5 4 L 1.5 6.5',
  logicalStrokeWidth: 1.4,
  logicalDashArray: '1,1',
};

// ─── ERD crow's-foot marker geometry ─────────────────────────────────────────
/**
 * Маркеры кардинальности ERD. DiagramEdge.jsx рендерит <marker> из этих данных.
 * lines[]: { x1, y1, x2, y2, strokeWidth }
 */
export const CF_MARKERS = {
  one: {
    width: 14, height: 14, refX: 11, refY: 7,
    orient: 'auto-start-reverse',
    lines: [
      { x1: 9, y1: 2, x2: 9, y2: 12, strokeWidth: 2 },
    ],
  },
  many: {
    width: 16, height: 16, refX: 13, refY: 8,
    orient: 'auto-start-reverse',
    lines: [
      { x1: 13, y1: 2, x2: 4, y2: 8, strokeWidth: 1.6 },
      { x1: 13, y1: 14, x2: 4, y2: 8, strokeWidth: 1.6 },
      { x1: 13, y1: 8, x2: 4, y2: 8, strokeWidth: 1.6 },
    ],
  },
};

// ─── Arrow direction ─────────────────────────────────────────────────────────
export const ARROW_TYPE_REGISTRY = {
  target: { label: '→', markerStart: null, markerEnd: 'arrow' },
  reverse: { label: '←', markerStart: 'arrow', markerEnd: null },
  both: { label: '↔', markerStart: 'arrow', markerEnd: 'arrow' },
  none: { label: '—', markerStart: null, markerEnd: null },
};

// ─── ERD semantic cardinality ─────────────────────────────────────────────────
export const CONNECTION_TYPE_REGISTRY = {
  '1:1': { label: '1:1', markerStart: 'cf-one', markerEnd: 'cf-one' },
  '1:N': { label: '1:N', markerStart: 'cf-one', markerEnd: 'cf-many' },
  'N:1': { label: 'N:1', markerStart: 'cf-many', markerEnd: 'cf-one' },
  'N:M': { label: 'N:M', markerStart: 'cf-many', markerEnd: 'cf-many' },
};
