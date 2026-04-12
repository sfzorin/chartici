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
 * PALETTES          — 8 именованных палитр нод (→ CSS --color-N)
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
    '--grid-line-color':     'rgba(255,255,255,0.04)',   // repeated for compat
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
const monoRules = {
  2: [1,4], 3: [1,4,7], 4: [1,3,5,8], 5: [1,3,5,7,9],
  6: [1,2,4,6,8,9], 7: [1,2,3,5,7,8,9], 8: [1,2,3,4,6,7,8,9],
};
const dualRules = {
  2: [2,7], 3: [1,3,7], 4: [1,2,7,8], 5: [1,2,4,7,8],
  6: [1,3,5,6,7,9], 7: [1,2,4,5,6,7,9], 8: [1,2,4,5,6,7,8,9],
};
const triRules = {
  2: [2,5], 3: [2,5,8], 4: [1,2,5,8], 5: [1,2,4,5,8],
  6: [1,2,4,5,7,8], 7: [1,2,3,4,5,7,8], 8: [1,2,3,4,5,6,7,8],
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
  'vibrant-rainbow': makePalette('Vibrant Rainbow', [
    { c: '#e11d48', t: '#ffffff' }, { c: '#f97316', t: '#ffffff' }, { c: '#facc15', t: '#1f2937' },
    { c: '#22c55e', t: '#1f2937' }, { c: '#06b6d4', t: '#ffffff' }, { c: '#3b82f6', t: '#ffffff' },
    { c: '#6366f1', t: '#ffffff' }, { c: '#a855f7', t: '#ffffff' }, { c: '#ec4899', t: '#ffffff' },
  ], monoRules),

  'muted-rainbow': makePalette('Muted Rainbow', [
    { c: '#991b1b', t: '#ffffff' }, { c: '#9a3412', t: '#ffffff' }, { c: '#854d0e', t: '#ffffff' },
    { c: '#166534', t: '#ffffff' }, { c: '#134e4a', t: '#ffffff' }, { c: '#1e40af', t: '#ffffff' },
    { c: '#3730a3', t: '#ffffff' }, { c: '#6b21a8', t: '#ffffff' }, { c: '#831843', t: '#ffffff' },
  ], monoRules),

  'blue-orange': makePalette('Blue & Orange', [
    { c: '#1e3a8a', t: '#ffffff' }, { c: '#2563eb', t: '#ffffff' }, { c: '#60a5fa', t: '#1f2937' },
    { c: '#93c5fd', t: '#1f2937' }, { c: '#bfdbfe', t: '#1f2937' }, { c: '#9a3412', t: '#ffffff' },
    { c: '#ea580c', t: '#ffffff' }, { c: '#fb923c', t: '#1f2937' }, { c: '#fdba74', t: '#1f2937' },
  ], dualRules),

  'green-purple': makePalette('Green & Purple', [
    { c: '#064e3b', t: '#ffffff' }, { c: '#059669', t: '#ffffff' }, { c: '#34d399', t: '#1f2937' },
    { c: '#6ee7b7', t: '#1f2937' }, { c: '#a7f3d0', t: '#1f2937' }, { c: '#581c87', t: '#ffffff' },
    { c: '#9333ea', t: '#ffffff' }, { c: '#c084fc', t: '#1f2937' }, { c: '#e9d5ff', t: '#1f2937' },
  ], dualRules),

  'slate-rose': makePalette('Slate & Rose', [
    { c: '#0f172a', t: '#ffffff' }, { c: '#334155', t: '#ffffff' }, { c: '#64748b', t: '#ffffff' },
    { c: '#94a3b8', t: '#1f2937' }, { c: '#cbd5e1', t: '#1f2937' }, { c: '#881337', t: '#ffffff' },
    { c: '#e11d48', t: '#ffffff' }, { c: '#fb7185', t: '#1f2937' }, { c: '#fda4af', t: '#1f2937' },
  ], dualRules),

  'blue-teal-slate': makePalette('Blue & Teal & Slate', [
    { c: '#1e3a8a', t: '#ffffff' }, { c: '#3b82f6', t: '#ffffff' }, { c: '#93c5fd', t: '#1f2937' },
    { c: '#134e4a', t: '#ffffff' }, { c: '#0d9488', t: '#ffffff' }, { c: '#5eead4', t: '#1f2937' },
    { c: '#334155', t: '#ffffff' }, { c: '#64748b', t: '#ffffff' }, { c: '#cbd5e1', t: '#1f2937' },
  ], triRules),

  'indigo-green-red': makePalette('Indigo & Green & Red', [
    { c: '#312e81', t: '#ffffff' }, { c: '#4f46e5', t: '#ffffff' }, { c: '#818cf8', t: '#1f2937' },
    { c: '#065f46', t: '#ffffff' }, { c: '#10b981', t: '#ffffff' }, { c: '#6ee7b7', t: '#1f2937' },
    { c: '#9f1239', t: '#ffffff' }, { c: '#e11d48', t: '#ffffff' }, { c: '#fb7185', t: '#1f2937' },
  ], triRules),

  'brown-amber-grey': makePalette('Brown & Amber & Grey', [
    { c: '#451a03', t: '#ffffff' }, { c: '#78350f', t: '#ffffff' }, { c: '#92400e', t: '#ffffff' },
    { c: '#b45309', t: '#ffffff' }, { c: '#f59e0b', t: '#1f2937' }, { c: '#fbbf24', t: '#1f2937' },
    { c: '#1e293b', t: '#ffffff' }, { c: '#475569', t: '#ffffff' }, { c: '#94a3b8', t: '#1f2937' },
  ], triRules),
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

