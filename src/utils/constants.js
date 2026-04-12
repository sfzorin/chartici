/**
 * constants.js — backward-compat re-exports only.
 * Source of truth has moved to:
 *   src/diagram/nodes.jsx   → NODE_REGISTRY, getNodeDim
 *   src/diagram/colors.js   → PALETTES
 */
import { NODE_REGISTRY, getNodeDim as _getNodeDimFromRegistry } from '../diagram/nodes.jsx';
export { PALETTES } from '../diagram/colors.js';

export const SIZES = {
  S: NODE_REGISTRY.process.sizes.S,
  M: NODE_REGISTRY.process.sizes.M,
  L: NODE_REGISTRY.process.sizes.L,
};

// Re-exported here for backward compatibility with all existing imports.
export { _getNodeDimFromRegistry as getNodeDim };
