// SIZES is kept for legacy consumers that read SIZES.M.width etc.
// Source of truth has moved to src/registry/nodes.js → NODE_REGISTRY[type].sizes
import { NODE_REGISTRY, getNodeDim as _getNodeDimFromRegistry } from '../registry/nodes.js';

export const SIZES = {
  S: NODE_REGISTRY.process.sizes.S,
  M: NODE_REGISTRY.process.sizes.M,
  L: NODE_REGISTRY.process.sizes.L,
};


const monoRules = { 2: [1,4], 3: [1,4,7], 4: [1,3,5,8], 5: [1,3,5,7,9], 6: [1,2,4,6,8,9], 7: [1,2,3,5,7,8,9], 8: [1,2,3,4,6,7,8,9] };
const dualRules = { 2: [2,7], 3: [1,3,7], 4: [1,2,7,8], 5: [1,2,4,7,8], 6: [1,3,5,6,7,9], 7: [1,2,4,5,6,7,9], 8: [1,2,4,5,6,7,8,9] };
const triRules  = { 2: [2,5], 3: [2,5,8], 4: [1,2,5,8], 5: [1,2,4,5,8], 6: [1,2,4,5,7,8], 7: [1,2,3,4,5,7,8], 8: [1,2,3,4,5,6,7,8] };

const createPaletteObj = (name, colorsMap, rules) => {
  const c = [ { bg: '#000000', text: '#FFFFFF' } ]; // 0
  
  // 1-9 (Solids)
  colorsMap.forEach(item => c.push({ bg: item.c, text: item.t }));
  
  // 10 (Spacer/Empty)
  c.push({ bg: 'transparent', text: '#1f2937' });
  
  // Note: Outlines are now controlled strictly by the `outlined` boolean flag on Groups, not by tokens.
  

  return { name, unfilledText: '#1f2937', colors: c, rules };
};

export const PALETTES = {
  'vibrant-rainbow': createPaletteObj('Vibrant Rainbow', [
    { c: '#e11d48', t: '#ffffff' }, { c: '#f97316', t: '#ffffff' }, { c: '#facc15', t: '#1f2937' },
    { c: '#22c55e', t: '#1f2937' }, { c: '#06b6d4', t: '#ffffff' }, { c: '#3b82f6', t: '#ffffff' },
    { c: '#6366f1', t: '#ffffff' }, { c: '#a855f7', t: '#ffffff' }, { c: '#ec4899', t: '#ffffff' }
  ], monoRules),
  'muted-rainbow': createPaletteObj('Muted Rainbow', [
    { c: '#991b1b', t: '#ffffff' }, { c: '#9a3412', t: '#ffffff' }, { c: '#854d0e', t: '#ffffff' },
    { c: '#166534', t: '#ffffff' }, { c: '#134e4a', t: '#ffffff' }, { c: '#1e40af', t: '#ffffff' },
    { c: '#3730a3', t: '#ffffff' }, { c: '#6b21a8', t: '#ffffff' }, { c: '#831843', t: '#ffffff' }
  ], monoRules),
  'blue-orange': createPaletteObj('Blue & Orange', [
    { c: '#1e3a8a', t: '#ffffff' }, { c: '#2563eb', t: '#ffffff' }, { c: '#60a5fa', t: '#1f2937' },
    { c: '#93c5fd', t: '#1f2937' }, { c: '#bfdbfe', t: '#1f2937' }, { c: '#9a3412', t: '#ffffff' },
    { c: '#ea580c', t: '#ffffff' }, { c: '#fb923c', t: '#1f2937' }, { c: '#fdba74', t: '#1f2937' }
  ], dualRules),
  'green-purple': createPaletteObj('Green & Purple', [
    { c: '#064e3b', t: '#ffffff' }, { c: '#059669', t: '#ffffff' }, { c: '#34d399', t: '#1f2937' },
    { c: '#6ee7b7', t: '#1f2937' }, { c: '#a7f3d0', t: '#1f2937' }, { c: '#581c87', t: '#ffffff' },
    { c: '#9333ea', t: '#ffffff' }, { c: '#c084fc', t: '#1f2937' }, { c: '#e9d5ff', t: '#1f2937' }
  ], dualRules),
  'slate-rose': createPaletteObj('Slate & Rose', [
    { c: '#0f172a', t: '#ffffff' }, { c: '#334155', t: '#ffffff' }, { c: '#64748b', t: '#ffffff' },
    { c: '#94a3b8', t: '#1f2937' }, { c: '#cbd5e1', t: '#1f2937' }, { c: '#881337', t: '#ffffff' },
    { c: '#e11d48', t: '#ffffff' }, { c: '#fb7185', t: '#1f2937' }, { c: '#fda4af', t: '#1f2937' }
  ], dualRules),
  'blue-teal-slate': createPaletteObj('Blue & Teal & Slate', [
    { c: '#1e3a8a', t: '#ffffff' }, { c: '#3b82f6', t: '#ffffff' }, { c: '#93c5fd', t: '#1f2937' },
    { c: '#134e4a', t: '#ffffff' }, { c: '#0d9488', t: '#ffffff' }, { c: '#5eead4', t: '#1f2937' },
    { c: '#334155', t: '#ffffff' }, { c: '#64748b', t: '#ffffff' }, { c: '#cbd5e1', t: '#1f2937' }
  ], triRules),
  'indigo-green-red': createPaletteObj('Indigo & Green & Red', [
    { c: '#312e81', t: '#ffffff' }, { c: '#4f46e5', t: '#ffffff' }, { c: '#818cf8', t: '#1f2937' },
    { c: '#065f46', t: '#ffffff' }, { c: '#10b981', t: '#ffffff' }, { c: '#6ee7b7', t: '#1f2937' },
    { c: '#9f1239', t: '#ffffff' }, { c: '#e11d48', t: '#ffffff' }, { c: '#fb7185', t: '#1f2937' }
  ], triRules),
  'brown-amber-grey': createPaletteObj('Brown & Amber & Grey', [
    { c: '#451a03', t: '#ffffff' }, { c: '#78350f', t: '#ffffff' }, { c: '#92400e', t: '#ffffff' },
    { c: '#b45309', t: '#ffffff' }, { c: '#f59e0b', t: '#1f2937' }, { c: '#fbbf24', t: '#1f2937' },
    { c: '#1e293b', t: '#ffffff' }, { c: '#475569', t: '#ffffff' }, { c: '#94a3b8', t: '#1f2937' }
  ], triRules)
};



// getNodeDim is now implemented in src/registry/nodes.js
// Re-exported here for backward compatibility with all existing imports.
export { _getNodeDimFromRegistry as getNodeDim };
