import { getGroupId } from './groupUtils.js';
import { resolveColorIndex } from '../diagram/colors.js';

/**
 * Sanitize and normalize color assignments for nodes and edges.
 * - Nodes: resolves color from group, auto-assigns sequential semantic colors
 * - Edges: strips color property (edges inherit from CSS)
 * 
 * @param {Array} elements - Nodes or edges to sanitize
 * @param {boolean} isNode - true for nodes, false for edges
 * @param {Array} groups - Group definitions for color resolution
 * @param {Array} safeIndices - Allowed semantic color tokens
 * @param {Object} sharedMap - Shared hex→index map for consistent mapping
 * @param {Object} autoIndexTracker - Mutable counter for auto-assignment
 * @returns {Array} Sanitized elements with valid semantic color tokens
 */
export function sanitizeColors(elements, isNode, groups = [], safeIndices = ['navy', 'teal', 'gray', 'yellow', 'green', 'red', 'purple', 'brown', 'blue', 'orange'], sharedMap = {}, autoIndexTracker = { current: 0 }) {
    return elements.map(el => {

      if (!isNode) {
        const { color, ...rest } = el;
        return rest;
      }

      let resolvedColor;
      if (el.type === 'pie_slice') {
          resolvedColor = el.color;
      } else {
          let gId = getGroupId(el);
          let g = groups?.find(gx => gx.id === gId);
          if (g?.color !== undefined) {
             resolvedColor = g.color;
          } else {
             resolvedColor = el.color;
          }
      }

      if (resolvedColor === undefined || resolvedColor === null) {
         const chosen = safeIndices[autoIndexTracker.current % safeIndices.length];
         autoIndexTracker.current += 1;
         return { ...el, color: chosen };
      }

      const c = resolvedColor;

      if (typeof c === 'string') {
        const resolved = resolveColorIndex(c);
        if (typeof resolved === 'string' && resolved.startsWith('#')) {
          return { ...el, color: resolved };
        }
        if (typeof resolved === 'number') {
          return { ...el, color: c.trim().toLowerCase() };
        }
      }
      
      const key = String(c);
      if (!(key in sharedMap)) {
        sharedMap[key] = safeIndices[Object.keys(sharedMap).length % safeIndices.length];
      }
      return { ...el, color: sharedMap[key] };
    });
}
