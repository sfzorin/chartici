import { getGroupId } from './groupUtils.js';

/**
 * Sanitize and normalize color assignments for nodes and edges.
 * - Nodes: resolves color from group, auto-assigns sequential palette indices
 * - Edges: strips color property (edges inherit from CSS)
 * 
 * @param {Array} elements - Nodes or edges to sanitize
 * @param {boolean} isNode - true for nodes, false for edges
 * @param {Array} groups - Group definitions for color resolution
 * @param {Array} safeIndices - Allowed palette token indices
 * @param {Object} sharedMap - Shared hex→index map for consistent mapping
 * @param {Object} autoIndexTracker - Mutable counter for auto-assignment
 * @returns {Array} Sanitized elements with valid color indices
 */
export function sanitizeColors(elements, isNode, groups = [], safeIndices = [1, 2, 3, 4, 5, 6, 7, 8, 9], sharedMap = {}, autoIndexTracker = { current: 0 }) {
    return elements.map(el => {

      if (!isNode) {
        const { color, ...rest } = el;
        return rest;
      }

      let resolvedColor;
      let gId = getGroupId(el);
      let g = groups?.find(gx => gx.id === gId);
      resolvedColor = g?.color;

      if (resolvedColor === undefined || resolvedColor === null || String(resolvedColor).toLowerCase() === 'transparent') {
         const chosen = safeIndices[autoIndexTracker.current % safeIndices.length];
         autoIndexTracker.current += 1;
         return { ...el, color: chosen };
      }

      const c = resolvedColor;

      if (typeof c === 'number' && c >= 0 && c <= 19) return el;
      if (typeof c === 'string') {
        const parsed = parseInt(c, 10);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 19) {
          return { ...el, color: parsed };
        }
      }
      
      const key = String(c);
      if (!(key in sharedMap)) {
        sharedMap[key] = safeIndices[Object.keys(sharedMap).length % safeIndices.length];
      }
      return { ...el, color: sharedMap[key] };
    });
}
