import { getNodeDim } from '../constants';

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

export function getNodePorts(node, box) {
  const w = box.right - box.left;
  const h = box.bottom - box.top;

  let ports = [
    { pt: { x: box.cx, y: box.top }, axis: 'V', sign: -1, dir: 'Top', penalty: 0 },
    { pt: { x: box.right, y: box.cy }, axis: 'H', sign: 1, dir: 'Right', penalty: 0 },
    { pt: { x: box.cx, y: box.bottom }, axis: 'V', sign: 1, dir: 'Bottom', penalty: 0 },
    { pt: { x: box.left, y: box.cy }, axis: 'H', sign: -1, dir: 'Left', penalty: 0 }
  ];

  // Extended ports for bus bifurcation (rectangles and ovals, skip pure circles)
  if (node.type !== 'circle') {
      if (w >= 50) {
          const bifPenaltyX = w * 2;
          ports.push({ pt: { x: box.cx - 20, y: box.top }, axis: 'V', sign: -1, dir: 'Top', penalty: bifPenaltyX });
          ports.push({ pt: { x: box.cx + 20, y: box.top }, axis: 'V', sign: -1, dir: 'Top', penalty: bifPenaltyX });
          ports.push({ pt: { x: box.cx - 20, y: box.bottom }, axis: 'V', sign: 1, dir: 'Bottom', penalty: bifPenaltyX });
          ports.push({ pt: { x: box.cx + 20, y: box.bottom }, axis: 'V', sign: 1, dir: 'Bottom', penalty: bifPenaltyX });
      }
      
      if (h >= 50) {
          const bifPenaltyY = h * 2;
          ports.push({ pt: { x: box.left, y: box.cy - 20 }, axis: 'H', sign: -1, dir: 'Left', penalty: bifPenaltyY });
          ports.push({ pt: { x: box.left, y: box.cy + 20 }, axis: 'H', sign: -1, dir: 'Left', penalty: bifPenaltyY });
          ports.push({ pt: { x: box.right, y: box.cy - 20 }, axis: 'H', sign: 1, dir: 'Right', penalty: bifPenaltyY });
          ports.push({ pt: { x: box.right, y: box.cy + 20 }, axis: 'H', sign: 1, dir: 'Right', penalty: bifPenaltyY });
      }
  }

  // Circle diagonal ports: 4 exits at 45°/135°/225°/315°
  // Placed exactly one grid step (20px) outside the vBox boundary.
  // This guarantees the port never falls on the vBox corner (which triggers the corner ban).
  // Penalty = 0 so A* treats them as primary exits.
  if (node.type === 'circle') {
    const r = (box.right - box.left) / 2;
    const step = 20;

    // 4 standard cardinal exits
    // (Already added at the beginning of the function: Top, Right, Bottom, Left)

    // 8 Elegant Radial Swoops (30-deg and 60-deg from vertical)
    const quadrants = [
        { dxSign: 1, dySign: -1, hDir: 'Right', vDir: 'Top' },
        { dxSign: -1, dySign: -1, hDir: 'Left', vDir: 'Top' },
        { dxSign: 1, dySign: 1, hDir: 'Right', vDir: 'Bottom' },
        { dxSign: -1, dySign: 1, hDir: 'Left', vDir: 'Bottom' }
    ];

    quadrants.forEach(q => {
        // 1. Steep Swoop (~30 degrees from vertical, exits vertically)
        const px1 = box.cx + q.dxSign * r * 0.5;
        const py1 = box.cy + q.dySign * r * 0.866;
        const targetX1 = 20 * (q.dxSign > 0 ? Math.ceil(px1 / 20 + 0.001) : Math.floor(px1 / 20 - 0.001));
        const intY1 = py1 + q.dySign * Math.abs(targetX1 - px1) * Math.sqrt(3);
        const snapY1 = 20 * (q.dySign > 0 ? Math.ceil(intY1 / 20) : Math.floor(intY1 / 20));
        
        ports.push({ 
            pt: { x: targetX1, y: snapY1 }, 
            axis: 'V', sign: q.dySign, dir: q.vDir, penalty: 0, 
            anchorPt: [{ x: px1, y: py1 }, { x: targetX1, y: snapY1 }] 
        });

        // 2. Shallow Swoop (~60 degrees from vertical, exits horizontally)
        const px2 = box.cx + q.dxSign * r * 0.866;
        const py2 = box.cy + q.dySign * r * 0.5;
        const targetY2 = 20 * (q.dySign > 0 ? Math.ceil(py2 / 20 + 0.001) : Math.floor(py2 / 20 - 0.001));
        const intX2 = px2 + q.dxSign * Math.abs(targetY2 - py2) * Math.sqrt(3);
        const snapX2 = 20 * (q.dxSign > 0 ? Math.ceil(intX2 / 20) : Math.floor(intX2 / 20));

        ports.push({ 
            pt: { x: snapX2, y: targetY2 }, 
            axis: 'H', sign: q.dxSign, dir: q.hDir, penalty: 0, 
            anchorPt: [{ x: px2, y: py2 }, { x: snapX2, y: targetY2 }] 
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
