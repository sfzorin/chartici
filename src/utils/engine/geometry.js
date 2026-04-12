import { getNodeDim } from '../constants';
import { NODE_REGISTRY } from '../../registry/nodes.js';


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

export function getNodePorts(node, box) {
  const w = box.right - box.left;
  const h = box.bottom - box.top;
  const nodeDef = NODE_REGISTRY[node.type] || NODE_REGISTRY.process;
  const portMode = nodeDef.ports; // 'all' | 'topbottom' | 'radial' | 'none'

  if (portMode === 'none') return [];

  // Universal Off-Grid Snapper
  const gyTop    = Math.floor(box.top    / 20) * 20;
  const gyBottom = Math.ceil (box.bottom / 20) * 20;
  const gxLeft   = Math.floor(box.left   / 20) * 20;
  const gxRight  = Math.ceil (box.right  / 20) * 20;

  // 4 Primary cardinal ports (always present, penalty 0)
  let ports = [
    { pt: { x: box.cx, y: gyTop    }, anchorPt: { x: box.cx,    y: box.top    }, axis: 'V', sign: -1, dir: 'Top',    penalty: 0 },
    { pt: { x: box.cx, y: gyBottom }, anchorPt: { x: box.cx,    y: box.bottom }, axis: 'V', sign:  1, dir: 'Bottom', penalty: 0 },
    { pt: { x: gxRight, y: box.cy  }, anchorPt: { x: box.right, y: box.cy     }, axis: 'H', sign:  1, dir: 'Right',  penalty: 0 },
    { pt: { x: gxLeft,  y: box.cy  }, anchorPt: { x: box.left,  y: box.cy     }, axis: 'H', sign: -1, dir: 'Left',   penalty: 0 },
  ];

  // topbottom: keep only Top and Bottom
  if (portMode === 'topbottom') {
    return ports.filter(p => p.dir === 'Top' || p.dir === 'Bottom');
  }

  // radial (circle): replace side bifurcations with precomputed diagonal swoops
  if (portMode === 'radial') {
    const size = node.size || 'M';
    const resolvedSize = (size === 'XS' ? 'S' : size === 'XL' ? 'L' : size);
    const swoopDefs = nodeDef.diagonalPorts?.[resolvedSize] || nodeDef.diagonalPorts?.M || [];
    swoopDefs.forEach(d => {
      ports.push({
        pt:       { x: box.cx + d.exit.dx,   y: box.cy + d.exit.dy },
        anchorPt: [
          { x: box.cx + d.anchor.dx, y: box.cy + d.anchor.dy },
          { x: box.cx + d.exit.dx,   y: box.cy + d.exit.dy   },
        ],
        axis: d.axis, sign: d.sign, dir: d.dir, penalty: 0,
      });
    });
    return ports;
  }

  // 'all': add bifurcation offsets for large nodes
  const isCurved = node.type === 'oval' || node.type === 'rhombus';

  // Lateral Bifurcation — add 2 outer ports per side when h >= 80px
  if (h >= 80 && !isCurved) {
    const sidePenalty = h * 2;
    let y1 = Math.floor((box.cy - 20) / 20) * 20;
    let y2 = Math.ceil ((box.cy + 20) / 20) * 20;
    ports.push({ pt: { x: gxRight, y: y1 }, anchorPt: { x: box.right, y: y1 }, axis: 'H', sign:  1, dir: 'Right', penalty: sidePenalty });
    ports.push({ pt: { x: gxRight, y: y2 }, anchorPt: { x: box.right, y: y2 }, axis: 'H', sign:  1, dir: 'Right', penalty: sidePenalty });
    ports.push({ pt: { x: gxLeft,  y: y1 }, anchorPt: { x: box.left,  y: y1 }, axis: 'H', sign: -1, dir: 'Left',  penalty: sidePenalty });
    ports.push({ pt: { x: gxLeft,  y: y2 }, anchorPt: { x: box.left,  y: y2 }, axis: 'H', sign: -1, dir: 'Left',  penalty: sidePenalty });
  }

  // Vertical Bifurcation — add 2 outer ports per side when w >= 80px
  if (w >= 80 && node.type !== 'rhombus') {
    const bifPenaltyX = w * 2;
    let x1 = Math.floor((box.cx - 20) / 20) * 20;
    let x2 = Math.ceil ((box.cx + 20) / 20) * 20;
    ports.push({ pt: { x: x1, y: gyTop    }, anchorPt: { x: x1, y: box.top    }, axis: 'V', sign: -1, dir: 'Top',    penalty: bifPenaltyX });
    ports.push({ pt: { x: x2, y: gyTop    }, anchorPt: { x: x2, y: box.top    }, axis: 'V', sign: -1, dir: 'Top',    penalty: bifPenaltyX });
    ports.push({ pt: { x: x1, y: gyBottom }, anchorPt: { x: x1, y: box.bottom }, axis: 'V', sign:  1, dir: 'Bottom', penalty: bifPenaltyX });
    ports.push({ pt: { x: x2, y: gyBottom }, anchorPt: { x: x2, y: box.bottom }, axis: 'V', sign:  1, dir: 'Bottom', penalty: bifPenaltyX });
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
