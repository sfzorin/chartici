function getEdgePriorityAtIntersection(edgeId, pt, ctx) {
   let priority = 0; 
   const info = ctx.edgePaths && ctx.edgePaths[edgeId] && ctx.edgePaths[edgeId]._genInfo;
   if (!info) return 0;
   
   const pts = info.cleanPts;
   if (!pts || pts.length < 2) return 0;
   
   const firstPt = pts[0];
   const lastPt = pts[pts.length - 1];
   
   const distStart = Math.hypot(pt.x - firstPt.x, pt.y - firstPt.y);
   const distEnd = Math.hypot(pt.x - lastPt.x, pt.y - lastPt.y);
   
   const threshold = 40; 
   if (distEnd < threshold) priority += (threshold - distEnd); 
   if (distStart < threshold) priority += (threshold - distStart);
   
   return priority;
}

export function getIntersections(pA, pB, edgeId, routeOrder, ctx) {
    let intersections = [];
    const minX = Math.min(pA.x, pB.x);
    const maxX = Math.max(pA.x, pB.x);
    const minY = Math.min(pA.y, pB.y);
    const maxY = Math.max(pA.y, pB.y);
    const isCurrentH = pA.y === pB.y;
    
    for (let line of ctx.occupiedLines) {
      if (line.edgeId === edgeId) continue;

      let intersectionPt = null;
      const lMinX = Math.min(line.x1, line.x2);
      const lMaxX = Math.max(line.x1, line.x2);
      const lMinY = Math.min(line.y1, line.y2);
      const lMaxY = Math.max(line.y1, line.y2);
      const isLineH = line.y1 === line.y2;
      
      if (isCurrentH && !isLineH) {
        if (line.x1 > minX && line.x1 < maxX && pA.y > lMinY && pA.y < lMaxY) {
          intersectionPt = { x: line.x1, y: pA.y };
        }
      } else if (!isCurrentH && isLineH) {
        if (line.y1 > minY && line.y1 < maxY && pA.x > lMinX && pA.x < lMaxX) {
          intersectionPt = { x: pA.x, y: line.y1 };
        }
      }

      if (!intersectionPt) continue;

      const currentPriority = getEdgePriorityAtIntersection(edgeId, intersectionPt, ctx);
      const otherPriority = getEdgePriorityAtIntersection(line.edgeId, intersectionPt, ctx);
      
      if (currentPriority > otherPriority) {
          continue; 
      } else if (otherPriority > currentPriority) {
          // fall through to break
      } else {
          // Only later-routed edge draws jump arc — earlier stays straight
          if (routeOrder !== undefined && line.routeOrder !== undefined && routeOrder < line.routeOrder) continue;
      }
      
      intersections.push(intersectionPt);
    }
    
    if (isCurrentH) {
      intersections.sort((a,b) => (pB.x > pA.x) ? (a.x - b.x) : (b.x - a.x));
    } else {
      intersections.sort((a,b) => (pB.y > pA.y) ? (a.y - b.y) : (b.y - a.y));
    }
    return intersections;
}

export function drawSegmentWithJumps(start, end, inters, jr) {
    if (inters.length === 0) return ` L ${end.x} ${end.y}`;
    let str = '';
    const dTotal = Math.hypot(end.x - start.x, end.y - start.y);
    if (dTotal === 0) return '';
    
    const dx = (end.x - start.x) / dTotal;
    const dy = (end.y - start.y) / dTotal;
    
    let validInters = [];
    for (let i = 0; i < inters.length; i++) {
       const pt = inters[i];
       const distStart = Math.hypot(pt.x - start.x, pt.y - start.y);
       const distEnd = Math.hypot(end.x - pt.x, end.y - pt.y);
       if (distStart <= jr + 1 || distEnd <= jr + 1) continue;
       if (validInters.length > 0) {
          const last = validInters[validInters.length - 1];
          if (Math.hypot(pt.x - last.x, pt.y - last.y) < jr * 2) continue;
       }
       validInters.push(pt);
    }
    
    for (let pt of validInters) {
       const jStart = { x: pt.x - dx * jr, y: pt.y - dy * jr };
       const jEnd = { x: pt.x + dx * jr, y: pt.y + dy * jr };
       str += ` L ${jStart.x} ${jStart.y} M ${jEnd.x} ${jEnd.y}`;
    }
    str += ` L ${end.x} ${end.y}`;
    return str;
}

export function generateSVGPaths(cleanPts, edgeId, totalLength, segments, ctx, routeOrder) {
    let pathStr = `M ${cleanPts[0].x} ${cleanPts[0].y}`;
    if (cleanPts.length === 2) {
      const inters = getIntersections(cleanPts[0], cleanPts[1], edgeId, routeOrder, ctx);
      pathStr += drawSegmentWithJumps(cleanPts[0], cleanPts[1], inters, 6);
    } else {
      const r = 4;
      const jr = 6;
      let lastPoint = cleanPts[0];
      
      for (let i = 1; i < cleanPts.length - 1; i++) {
        const p1 = cleanPts[i-1];
        const p2 = cleanPts[i];
        const p3 = cleanPts[i+1];
        
        const d1 = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        const d2 = Math.hypot(p3.x - p2.x, p3.y - p2.y);
        if (d1 === 0 || d2 === 0) continue;
        
        const actualR = Math.min(r, d1/2, d2/2);
        const qStartX = p2.x + ((p1.x - p2.x) / d1) * actualR;
        const qStartY = p2.y + ((p1.y - p2.y) / d1) * actualR;
        const qEndX = p2.x + ((p3.x - p2.x) / d2) * actualR;
        const qEndY = p2.y + ((p3.y - p2.y) / d2) * actualR;
        
        const segmentEnd = { x: qStartX, y: qStartY };
        const inters = getIntersections(lastPoint, segmentEnd, edgeId, routeOrder, ctx);
        pathStr += drawSegmentWithJumps(lastPoint, segmentEnd, inters, jr);
        pathStr += ` Q ${p2.x} ${p2.y} ${qEndX} ${qEndY}`;
        lastPoint = { x: qEndX, y: qEndY };
      }
      const pLast = cleanPts[cleanPts.length - 1];
      const inters = getIntersections(lastPoint, pLast, edgeId, routeOrder, ctx);
      pathStr += drawSegmentWithJumps(lastPoint, pLast, inters, jr);
    }

    let textPathD = pathStr;
    let textPathLen = 0;
    if (segments.length > 0) {
      let unbundledSegments = segments.filter(s => {
          for (let line of ctx.occupiedLines) {
              if (line.edgeId === edgeId) continue;
              if (s.p1.y === s.p2.y && line.y1 === line.y2 && s.p1.y === line.y1) {
                  const sMin = Math.min(s.p1.x, s.p2.x), sMax = Math.max(s.p1.x, s.p2.x);
                  const lMin = Math.min(line.x1, line.x2), lMax = Math.max(line.x1, line.x2);
                  if (sMax > lMin && sMin < lMax) return false;
              } else if (s.p1.x === s.p2.x && line.x1 === line.x2 && s.p1.x === line.x1) {
                  const sMin = Math.min(s.p1.y, s.p2.y), sMax = Math.max(s.p1.y, s.p2.y);
                  const lMin = Math.min(line.y1, line.y2), lMax = Math.max(line.y1, line.y2);
                  if (sMax > lMin && sMin < lMax) return false;
              }
          }
          return true;
      });

      let clearSegments = [];
      const TEXT_JUMP_PAD = 20; // safe zone around crossings
      
      unbundledSegments.forEach(s => {
          const isH = s.p1.y === s.p2.y;
          const minC = isH ? Math.min(s.p1.x, s.p2.x) : Math.min(s.p1.y, s.p2.y);
          const maxC = isH ? Math.max(s.p1.x, s.p2.x) : Math.max(s.p1.y, s.p2.y);
          
          let crosses = [];
          for (let line of ctx.occupiedLines) {
              if (line.edgeId === edgeId) continue;
              const isLineH = line.y1 === line.y2;
              if (isH && !isLineH) {
                  const lMinY = Math.min(line.y1, line.y2), lMaxY = Math.max(line.y1, line.y2);
                  if (line.x1 > minC && line.x1 < maxC && s.p1.y >= lMinY && s.p1.y <= lMaxY) {
                      crosses.push(line.x1);
                  }
              } else if (!isH && isLineH) {
                  const lMinX = Math.min(line.x1, line.x2), lMaxX = Math.max(line.x1, line.x2);
                  if (line.y1 > minC && line.y1 < maxC && s.p1.x >= lMinX && s.p1.x <= lMaxX) {
                      crosses.push(line.y1);
                  }
              }
          }
          
          crosses.sort((a, b) => a - b);
          let currentC = minC;
          for (let c of crosses) {
              const segStartC = currentC;
              const segEndC = c - TEXT_JUMP_PAD;
              if (segEndC - segStartC > 10) {
                 clearSegments.push({
                    p1: isH ? {x: segStartC, y: s.p1.y} : {x: s.p1.x, y: segStartC},
                    p2: isH ? {x: segEndC, y: s.p1.y} : {x: s.p1.x, y: segEndC},
                    len: segEndC - segStartC
                 });
              }
              currentC = c + TEXT_JUMP_PAD;
          }
          if (maxC - currentC > 10) {
             clearSegments.push({
                p1: isH ? {x: currentC, y: s.p1.y} : {x: s.p1.x, y: currentC},
                p2: isH ? {x: maxC, y: s.p1.y} : {x: s.p1.x, y: maxC},
                len: maxC - currentC
             });
          }
      });
      
      unbundledSegments = clearSegments;

      if (unbundledSegments.length === 0) {
          textPathD = null;
          textPathLen = 0;
      } else {
          // Score segments: prefer horizontal, then closer to target
          const scoreSegment = (s, idx) => {
            const isH = s.p1.y === s.p2.y;
            const hBonus = isH ? 1.5 : 1.0;
            const posBonus = idx * 0.1; // minor tiebreaker: prefer later segments
            return s.len * hBonus + posBonus;
          };
          
          let bestSegment = unbundledSegments.reduce((best, cur, idx) => {
            if (!best.seg) return { seg: cur, idx };
            return scoreSegment(cur, idx) > scoreSegment(best.seg, best.idx) ? { seg: cur, idx } : best;
          }, { seg: null, idx: 0 }).seg;
          
          textPathLen = bestSegment.len;
          const { p1, p2 } = bestSegment;
          
          const isSegmentHorizontal = p1.y === p2.y;
          // Rule 1: Text reads Left-to-Right AND Bottom-to-Top
          // If horizontal: reverse if p1.x > p2.x (so it goes L-R)
          // If vertical: reverse if p1.y < p2.y (Top-to-Bottom, so we mathematically reverse it to go Bottom-to-Top)
          const shouldReverseText = isSegmentHorizontal ? (p1.x > p2.x) : (p1.y < p2.y);
          
          if (shouldReverseText) {
              textPathD = `M ${p2.x} ${p2.y} L ${p1.x} ${p1.y}`;
          } else {
              textPathD = `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`;
          }
      }
    }
    
    return { pathD: pathStr, textPathD, textPathLen };
}
