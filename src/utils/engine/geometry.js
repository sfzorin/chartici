import { getNodeDim } from '../constants';
import { NODE_REGISTRY } from '../../diagram/nodes.jsx';



export function getTrueBox(node) {
  const dim = getNodeDim(node);
  const cx = node.x || 0;
  const cy = node.y || 0;
  
  let left = cx - dim.width / 2;
  let right = cx + dim.width / 2;
  let top = cy - dim.height / 2;
  let bottom = cy + dim.height / 2;
  
  if (node.type === 'circle') {
     const r = Math.min(dim.width, dim.height) / 2;
     left = cx - r;
     right = cx + r;
     top = cy - r;
     bottom = cy + r;
  }
  
  return { left, right, top, bottom, cx, cy };
}

export function getClipDist(node, cx, cy, dirX, dirY) {
  const box = getTrueBox(node);
  const w = (box.right - box.left) / 2, h = (box.bottom - box.top) / 2;
  if (node.type === 'circle') return Math.max(w, h);
  if (node.type === 'decision' || node.type === 'rhombus') {
     return 1 / (Math.abs(dirX) / w + Math.abs(dirY) / h);
  }
  if (node.type === 'oval' || node.type === 'element') {
     const dx = Math.abs(dirX);
     const dy = Math.abs(dirY);
     if (Math.abs(w - h) < 1) return Math.max(w, h);
     
     if (w > h) {
         const cx = w - h;
         if (dy > 0.00001) {
             const t_rect = h / dy;
             if (t_rect * dx <= cx) return t_rect;
         }
         return cx * dx + Math.sqrt(Math.max(0, h * h - cx * cx * dy * dy));
     } else {
         const cy = h - w;
         if (dx > 0.00001) {
             const t_rect = w / dx;
             if (t_rect * dy <= cy) return t_rect;
         }
         return cy * dy + Math.sqrt(Math.max(0, w * w - cy * cy * dx * dx));
     }
  }
  if (Math.abs(dirX) < 0.001) return h;
  if (Math.abs(dirY) < 0.001) return w;
  const tx = w / Math.abs(dirX), ty = h / Math.abs(dirY);
  return Math.min(tx, ty);
}

// Default port penalty — matches previous hardcoded behaviour.
// Переопределяется плагинами движков engines/*/engine.js → routing.portPenalty(portId, w, h).

const defaultPortPenalty = (portId, w, h) => {
  if (portId === 'BifTop'  || portId === 'BifBottom') return w * 2;
  if (portId === 'BifLeft' || portId === 'BifRight')  return h * 2;
  return 0;
};

/**
 * @param {object}   node       — node data
 * @param {object}   box        — bounding box from getTrueBox()
 * @param {Function} [penaltyFn] — (portId, w, h) → number, from engine's routing.portPenalty
 */
export function getNodePorts(node, box, penaltyFn = defaultPortPenalty) {
  const w = box.right - box.left;
  const h = box.bottom - box.top;
  const nodeDef = NODE_REGISTRY[node.type] || NODE_REGISTRY.process;

  // Runtime override: timeline spine nodes behave like chevron (topbottom)
  const portMode = node.isTimelineSpine ? 'topbottom' : nodeDef.ports;

  if (portMode === 'none') return [];

  // Universal Off-Grid Snapper
  const gyTop    = Math.floor(box.top    / 20) * 20;
  const gyBottom = Math.ceil (box.bottom / 20) * 20;
  const gxLeft   = Math.floor(box.left   / 20) * 20;
  const gxRight  = Math.ceil (box.right  / 20) * 20;

  // Helper: build a cardinal port object from a catalog entry
  const cardinalPos = (def) => {
    const penalty = penaltyFn(def.id, w, h);
    if (def.axis === 'V') {
      const y = def.sign === -1 ? gyTop : gyBottom;
      const ay = def.sign === -1 ? box.top : box.bottom;
      return { pt: { x: box.cx, y }, anchorPt: { x: box.cx, y: ay }, axis: 'V', sign: def.sign, dir: def.id, penalty };
    } else {
      const x = def.sign === 1 ? gxRight : gxLeft;
      const ax = def.sign === 1 ? box.right : box.left;
      return { pt: { x, y: box.cy }, anchorPt: { x: ax, y: box.cy }, axis: 'H', sign: def.sign, dir: def.id, penalty };
    }
  };

  // Build ports from portCatalog (handles topbottom, all, and the cardinal part of radial)
  const rawCatalog = node.isTimelineSpine
    ? [{ id: 'Top', axis: 'V', sign: -1 }, { id: 'Bottom', axis: 'V', sign: 1 }]
    : (nodeDef.portCatalog || []);

  const ports = [];

  for (const def of rawCatalog) {
    if (!def.threshold) {
      // Primary port — single cardinal exit
      ports.push(cardinalPos(def));
      continue;
    }

    // Bifurcation port — only active when node dimension ≥ threshold
    const dimVal = def.threshold.w !== undefined ? w : h;
    const thresh = def.threshold.w ?? def.threshold.h;
    if (dimVal < thresh) continue;

    const penalty = penaltyFn(def.id, w, h);
    const isV = def.axis === 'V';

    // Generate 2 offset exits (±20px from center axis)
    const c1 = isV
      ? Math.floor((box.cx - 20) / 20) * 20
      : Math.floor((box.cy - 20) / 20) * 20;
    const c2 = isV
      ? Math.ceil((box.cx + 20) / 20) * 20
      : Math.ceil((box.cy + 20) / 20) * 20;

    if (isV) {
      const gridY = def.sign === -1 ? gyTop : gyBottom;
      const anchY = def.sign === -1 ? box.top : box.bottom;
      ports.push({ pt: { x: c1, y: gridY }, anchorPt: { x: c1, y: anchY }, axis: 'V', sign: def.sign, dir: def.id, penalty });
      ports.push({ pt: { x: c2, y: gridY }, anchorPt: { x: c2, y: anchY }, axis: 'V', sign: def.sign, dir: def.id, penalty });
    } else {
      const gridX = def.sign === 1 ? gxRight : gxLeft;
      const anchX = def.sign === 1 ? box.right : box.left;
      ports.push({ pt: { x: gridX, y: c1 }, anchorPt: { x: anchX, y: c1 }, axis: 'H', sign: def.sign, dir: def.id, penalty });
      ports.push({ pt: { x: gridX, y: c2 }, anchorPt: { x: anchX, y: c2 }, axis: 'H', sign: def.sign, dir: def.id, penalty });
    }
  }

  // Supplement with pre-computed diagonal swoops for circle (and any future node with diagonalPorts)
  if (nodeDef.diagonalPorts && portMode !== 'topbottom' && portMode !== 'none') {
    const size = node.size || 'M';
    const sz = (size === 'XS' ? 'S' : size === 'XL' ? 'L' : size);
    const swoopDefs = nodeDef.diagonalPorts[sz] || nodeDef.diagonalPorts.M || [];
    swoopDefs.forEach(d => {
      ports.push({
        pt:       { x: box.cx + d.exit.dx,   y: box.cy + d.exit.dy },
        anchorPt: [
          { x: box.cx + d.anchor.dx, y: box.cy + d.anchor.dy },
          { x: box.cx + d.exit.dx,   y: box.cy + d.exit.dy   },
        ],
        axis: d.axis, sign: d.sign, dir: d.dir, penalty: penaltyFn(d.dir, w, h),
      });
    });
  }

  return ports;
}



export function isSegmentBlockedCheck(x1, y1, x2, y2, allowObsId1, allowObsId2, ignorePadding, ctx) {
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);
    for (let o of ctx.obstacles) {
      // Prevent resting exactly on the strict corners of the node boundary
      const isCorner1 = (x1 === o.vLeft || x1 === o.vRight) && (y1 === o.vTop || y1 === o.vBottom);
      const isCorner2 = (x2 === o.vLeft || x2 === o.vRight) && (y2 === o.vTop || y2 === o.vBottom);
      if (isCorner1 || isCorner2) return true;

      const isCrossVBoxX = Math.max(minX, o.vLeft) < Math.min(maxX, o.vRight);
      const isCrossVBoxY = Math.max(minY, o.vTop) < Math.min(maxY, o.vBottom);
      if (y1 === y2) { // horizontal
        if (y1 >= o.vTop && y1 <= o.vBottom && isCrossVBoxX) return true;
      } else if (x1 === x2) { // vertical
        if (x1 >= o.vLeft && x1 <= o.vRight && isCrossVBoxY) return true;
      }

      if (o.id === allowObsId1 || o.id === allowObsId2) continue;
      
      if (!ignorePadding) {
          const isCrossPadX = Math.max(minX, o.left) < Math.min(maxX, o.right);
          const isCrossPadY = Math.max(minY, o.top) < Math.min(maxY, o.bottom);
          if (y1 === y2) {
              if (y1 > o.top && y1 < o.bottom && isCrossPadX) return true;
          } else if (x1 === x2) {
              if (x1 > o.left && x1 < o.right && isCrossPadY) return true;
          }
      }
    }
    return false;
}





export function isBlockedPointCheck(x, y, allowObsId1, allowObsId2, ignorePadding, ctx) {
    for (let o of ctx.obstacles) {
      if (x > o.vLeft && x < o.vRight && y > o.vTop && y < o.vBottom) {
          return true;
      }
      if (o.id === allowObsId1 || o.id === allowObsId2) continue;
      if (!ignorePadding) {
           if (x > o.left && x < o.right && y > o.top && y < o.bottom) {
             return true;
          }
      }
    }
    return false;
}





export function checkPathOverlap(x1, y1, x2, y2, ctx) {
    let overlaps = [];
    let crossings = [];
    
    const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
    const isSegH = y1 === y2;

    for (let line of ctx.occupiedLines) {
        const lMinX = Math.min(line.x1, line.x2), lMaxX = Math.max(line.x1, line.x2);
        const lMinY = Math.min(line.y1, line.y2), lMaxY = Math.max(line.y1, line.y2);
        const isLineH = line.y1 === line.y2;

        if (isSegH !== isLineH) { // Crossing perpendicularly
            if (isSegH && y1 >= lMinY && y1 <= lMaxY && line.x1 >= minX && line.x1 <= maxX) {
                crossings.push(line);
            }
            else if (!isSegH && x1 >= lMinX && x1 <= lMaxX && line.y1 >= minY && line.y1 <= maxY) {
                crossings.push(line);
            }
        } else { // Parallel
            if (isSegH && isLineH && y1 === line.y1) {
                const overlapAmt = Math.max(0, Math.min(maxX, lMaxX) - Math.max(minX, lMinX));
                if (overlapAmt > 0) overlaps.push(line);
            } else if (!isSegH && !isLineH && x1 === line.x1) {
                const overlapAmt = Math.max(0, Math.min(maxY, lMaxY) - Math.max(minY, lMinY));
                if (overlapAmt > 0) overlaps.push(line);
            }
        }
    }
    return { overlaps, crossings };
}

export function checkCollision(testNode, allNodes) {
    const mBox = getTrueBox(testNode);
    for (let oNode of allNodes) {
        if (oNode.id === testNode.id) continue;
        const oBox = getTrueBox(oNode);
        const dx = Math.max(0, Math.max(mBox.left - oBox.right, oBox.left - mBox.right));
        const dy = Math.max(0, Math.max(mBox.top - oBox.bottom, oBox.top - mBox.bottom));
        if (dx < 40 && dy < 40) return true;
    }
    return false;
}
