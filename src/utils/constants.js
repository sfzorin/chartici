/**
 * constants.js — backward-compat re-exports only.
 * Source of truth has moved to:
 *   src/registry/nodes.jsx   → NODE_REGISTRY, getNodeDim
 *   src/registry/colors.js   → PALETTES
 */
import { NODE_REGISTRY, getNodeDim as _getNodeDimFromRegistry } from '../registry/nodes.jsx';
export { PALETTES } from '../registry/colors.js';

export const SIZES = {
  S: NODE_REGISTRY.process.sizes.S,
  M: NODE_REGISTRY.process.sizes.M,
  L: NODE_REGISTRY.process.sizes.L,
};

// Re-exported here for backward compatibility with all existing imports.
export { _getNodeDimFromRegistry as getNodeDim };
