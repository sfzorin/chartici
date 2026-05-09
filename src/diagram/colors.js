/**
 * COLOR_REGISTRY — единственный источник истины для всех цветов приложения.
 *
 * Потребители:
 *   (direct imports)  — PALETTES
 *   exportSVG.js      — EXPORT_DEFAULTS (дефолты CSS-переменных при экспорте)
 *   index.css         — CSS custom properties (UI тема — остаётся в CSS)
 *
 * ─── Структура ───────────────────────────────────────────────────────────────
 *
 * BRAND             — бренд-цвета Chartici
 * CANVAS_THEMES     — canvas + diagram-semantic цвета для light/dark режима
 *                     используются при headless рендере и как дефолты экспорта
 * PALETTES          — именованные палитры нод (→ CSS --color-N)
 *                     Каждая запись: { name, colors[], unfilledText, rules }
 *                     colors[]: { bg, text, border? }
 *                     rules: маппинг "кол-во нод → индексы цветов" для авто-назначения
 */

// ─── Brand ───────────────────────────────────────────────────────────────────
export const BRAND = {
  primary:      '#be355d',
  primaryHover: '#d73c69',
  error:        '#ef4444',
};

// ─── Canvas & diagram semantic tokens (light / dark) ─────────────────────────
/**
 * Эти значения зеркалят CSS custom properties из index.css.
 * Используются там, где CSS недоступен: headless SVG export, Node.js рендеринг.
 *
 * Каждый объект — набор key: cssVarName → value.
 */
export const CANVAS_THEMES = {
  light: {
    '--canvas-bg':           '#ffffff',
    '--desk-bg':             '#e2e8f0',
    '--desk-grid':           '#cbd5e1',
    '--grid-line-color':     '#f1f5f9',
    '--edge-color':          '#475569',
    '--color-text-main':     '#0f172a',
    '--color-text-dim':      '#64748b',
    '--color-secondary':     '#94a3b8',
    '--border-color-soft':   '#e2e8f0',
    '--border-color-medium': '#cbd5e1',
    '--border-color-active': '#1e293b',
    // Diagram semantic (applied inline on <svg>)
    '--diagram-text':        '#1a1a1a',
    '--diagram-edge':        '#475569',
    '--diagram-group':       '#64748b',
  },
  dark: {
    '--canvas-bg':           '#0f172a',
    '--desk-bg':             '#0f172a',
    '--desk-grid':           '#1e293b',
    '--grid-line-color':     'rgba(255,255,255,0.04)',
    '--edge-color':          '#cbd5e1',
    '--color-text-main':     '#f8fafc',
    '--color-text-dim':      '#94a3b8',
    '--color-secondary':     '#cbd5e1',
    '--border-color-soft':   'rgba(255,255,255,0.08)',
    '--border-color-medium': 'rgba(255,255,255,0.15)',
    '--border-color-active': '#f8fafc',
    // Diagram semantic
    '--diagram-text':        '#f1f5f9',
    '--diagram-edge':        '#cbd5e1',
    '--diagram-group':       '#94a3b8',
  },
};

/**
 * Дефолтные значения CSS-переменных для SVG-экспорта.
 * exportSVG.js читает живые значения из DOM через getPropertyValue(),
 * но эти значения используются как fallback если DOM недоступен
 * или значение пустое (headless, тест, print).
 */
export const EXPORT_DEFAULTS = CANVAS_THEMES.light;

// ─── Palette helpers ──────────────────────────────────────────────────────────
/**
 * rules: маппинг "кол-во нод с цветом → какие слоты использовать".
 * Индексы 1-based (1..9 — слоты solid цветов).
 * При авто-назначении система берёт rules[n] и циклически назначает слоты.
 */
const paletteRules = {
  1: [1],
  2: [1, 2],
  3: [1, 2, 5],
  4: [1, 2, 5, 3],
  5: [1, 2, 5, 3, 4],
  6: [1, 2, 5, 3, 4, 6],
  7: [1, 2, 5, 3, 4, 6, 7],
  8: [1, 2, 5, 3, 4, 6, 7, 8],
  9: [1, 2, 5, 3, 4, 6, 7, 8, 9],
};

/**
 * @param {string} name — отображаемое название палитры
 * @param {{ c: string, t: string }[]} solids — 9 solid цветов: c=bg, t=text
 * @param {object} rules — авто-назначение слотов
 * @returns {{ name, colors, unfilledText, rules }}
 *
 * colors layout:
 *   [0]  = black  { bg:'#000000', text:'#ffffff' }
 *   [1-9] = solids
 *   [10] = transparent (пустой/spacer)
 */
function makePalette(name, solids, rules) {
  const colors = [{ bg: '#000000', text: '#ffffff' }];
  for (const s of solids) colors.push({ bg: s.c, text: s.t });
  colors.push({ bg: 'transparent', text: '#1f2937' });
  return { name, unfilledText: '#1f2937', colors, rules };
}

// ─── Palettes ─────────────────────────────────────────────────────────────────
export const PALETTES = {
  basic: makePalette('Basic', [
    { c: '#243B53', t: '#ffffff' },
    { c: '#2F6F73', t: '#ffffff' },
    { c: '#D8A24A', t: '#1f2937' },
    { c: '#5E8C61', t: '#ffffff' },
    { c: '#6B7280', t: '#ffffff' },
    { c: '#B24C4C', t: '#ffffff' },
    { c: '#7C6A9E', t: '#ffffff' },
    { c: '#A67C52', t: '#ffffff' },
    { c: '#D1D5DB', t: '#1f2937' },
  ], paletteRules),
  ink: makePalette('Ink', [
    { c: '#1F3446', t: '#ffffff' },
    { c: '#3F6B74', t: '#ffffff' },
    { c: '#C9A227', t: '#1f2937' },
    { c: '#6E7F4F', t: '#ffffff' },
    { c: '#5C6470', t: '#ffffff' },
    { c: '#9E4F45', t: '#ffffff' },
    { c: '#725D8C', t: '#ffffff' },
    { c: '#8B7355', t: '#ffffff' },
    { c: '#D6D0C4', t: '#1f2937' },
  ], paletteRules),
  library: makePalette('Library', [
    { c: '#274C43', t: '#ffffff' },
    { c: '#405C7A', t: '#ffffff' },
    { c: '#C18C2D', t: '#1f2937' },
    { c: '#7A8B50', t: '#ffffff' },
    { c: '#67717A', t: '#ffffff' },
    { c: '#A6533D', t: '#ffffff' },
    { c: '#6A5F91', t: '#ffffff' },
    { c: '#9C7854', t: '#ffffff' },
    { c: '#D8D6CC', t: '#1f2937' },
  ], paletteRules),
  copper: makePalette('Copper', [
    { c: '#2B4050', t: '#ffffff' },
    { c: '#4E6F64', t: '#ffffff' },
    { c: '#B97842', t: '#ffffff' },
    { c: '#8A955A', t: '#ffffff' },
    { c: '#68727E', t: '#ffffff' },
    { c: '#A64E4E', t: '#ffffff' },
    { c: '#816C9B', t: '#ffffff' },
    { c: '#B08A57', t: '#1f2937' },
    { c: '#D9D1C7', t: '#1f2937' },
  ], paletteRules),
  atlas: makePalette('Atlas', [
    { c: '#24405A', t: '#ffffff' },
    { c: '#39747A', t: '#ffffff' },
    { c: '#D0A044', t: '#1f2937' },
    { c: '#567C63', t: '#ffffff' },
    { c: '#6B7078', t: '#ffffff' },
    { c: '#B15A4C', t: '#ffffff' },
    { c: '#7166A0', t: '#ffffff' },
    { c: '#A47E4B', t: '#ffffff' },
    { c: '#D7DEE2', t: '#1f2937' },
  ], paletteRules),
};

/**
 * CANVAS_COLORS — семантические токены для каждого варианта фона холста.
 *
 * Потребители:
 *   DiagramRenderer.jsx — dEdge, dText, dGroup, resolvedLegendBg, resolvedLegendStroke
 *   nodes.jsx           — pie_slice separator (pieSliceSeparator = stroke между сегментами)
 *   exportSVG.js        — resolvedBg (fallback для --canvas-bg)
 *
 * bgColor значения: 'white' | 'black' | 'transparent-light' | undefined (dark по умолчанию)
 */
export const CANVAS_COLORS = {
  white: {
    canvasFill:        '#ffffff',
    gridColor:         'rgba(0, 0, 0, 0.05)',
    isDark:            false,
    resolvedBg:        '#ffffff',
    diagramText:       '#0f172a',
    diagramEdge:       '#475569',
    diagramGroup:      '#94a3b8',
    legendBg:          '#f8fafc',
    legendStroke:      '#e2e8f0',
    pieSliceSeparator: '#ffffff',
  },
  black: {
    canvasFill:        '#000000',
    gridColor:         'rgba(255, 255, 255, 0.08)',
    isDark:            true,
    resolvedBg:        '#000000',
    diagramText:       '#f8fafc',
    diagramEdge:       '#cbd5e1',
    diagramGroup:      '#64748b',
    legendBg:          '#1e293b',
    legendStroke:      '#334155',
    pieSliceSeparator: '#000000',
  },
  'transparent-light': {
    canvasFill:        'transparent',
    gridColor:         'rgba(0, 0, 0, 0.05)',
    isDark:            false,
    resolvedBg:        '#ffffff',
    diagramText:       '#0f172a',
    diagramEdge:       '#475569',
    diagramGroup:      '#94a3b8',
    legendBg:          '#f8fafc',
    legendStroke:      '#e2e8f0',
    pieSliceSeparator: '#ffffff',
  },
  // default: тёмный прозрачный холст (когда bgColor не задан или неизвестен)
  default: {
    canvasFill:        'transparent',
    gridColor:         'rgba(255, 255, 255, 0.08)',
    isDark:            true,
    resolvedBg:        '#0f172a',
    diagramText:       '#f8fafc',
    diagramEdge:       '#cbd5e1',
    diagramGroup:      '#64748b',
    legendBg:          '#1e293b',
    legendStroke:      '#334155',
    pieSliceSeparator: '#0f172a',
  },
};

/**
 * Получить цветовую схему для конкретного фона холста.
 * @param {string|undefined} bgColor — 'white' | 'black' | 'transparent-light' | undefined
 * @returns {typeof CANVAS_COLORS.default}
 */
export function getCanvasColors(bgColor) {
  return CANVAS_COLORS[bgColor] ?? CANVAS_COLORS.default;
}
