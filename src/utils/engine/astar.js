import { isBlockedPointCheck, isSegmentBlockedCheck, checkPathOverlap } from './geometry.js';

// Binary min-heap keyed on f-score for O(log n) extract-min
class MinHeap {
  constructor() { this.data = []; }
  get length() { return this.data.length; }
  push(node) {
    this.data.push(node);
    this._siftUp(this.data.length - 1);
  }
  pop() {
    const top = this.data[0];
    const last = this.data.pop();
    if (this.data.length > 0) {
      this.data[0] = last;
      this._siftDown(0);
    }
    return top;
  }
  _siftUp(i) {
    const d = this.data;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (d[p].f <= d[i].f) break;
      [d[p], d[i]] = [d[i], d[p]];
      i = p;
    }
  }
  _siftDown(i) {
    const d = this.data;
    const n = d.length;
    while (true) {
      let smallest = i;
      const l = 2 * i + 1, r = 2 * i + 2;
      if (l < n && d[l].f < d[smallest].f) smallest = l;
      if (r < n && d[r].f < d[smallest].f) smallest = r;
      if (smallest === i) break;
      [d[smallest], d[i]] = [d[i], d[smallest]];
      i = smallest;
    }
  }
}

export function runAStar(startPorts, endPorts, startNodeId, endNodeId, textSpaceReq, edgeType, gridStep, allowOverlap, allowCrossing, _unused, ctx, deadlineMs, ignorePadding = false) {
  const hasText = textSpaceReq > 0;
  const startTime = performance.now();

  let bestFallbackNode = null;
  let bestFallbackH = Infinity;

  // Map end ports to their safe approach coordinates
  const safeTargets = endPorts.map(p => {
      const eDir = p.axis;
      const dx = eDir === 'H' ? p.sign * gridStep : 0;
      const dy = eDir === 'V' ? p.sign * gridStep : 0;
      return { x: p.pt.x + dx, y: p.pt.y + dy, pt: p.pt, trueEndPt: p.anchorPt || p.pt, dir: eDir, portDir: p.dir, penalty: p.penalty || 0 };
  });

  const getH = (x, y) => {
     let best = Infinity;
     for (let t of safeTargets) {
         let h = Math.abs(t.x - x) + Math.abs(t.y - y) + t.penalty;
         if (h < best) best = h;
     }
     return best;
  };

  
  const openHeap = new MinHeap();

  const openMap = new Map();
  const closedSet = new Set();

  // Seed open set with stub points from all free ports
  startPorts.forEach(port => {
     const sDir = port.axis;
     const dx = sDir === 'H' ? port.sign * gridStep : 0;
     const dy = sDir === 'V' ? port.sign * gridStep : 0;
     
     const nx = port.pt.x + dx;
     const ny = port.pt.y + dy;
     
     let startPenalty = port.penalty || 0;

     // Port Saturation Rule: Do not share ports with edges of different styles/arrows
     if (ctx && ctx.occupiedLines) {
         const portKey = `${port.anchorPt ? port.anchorPt.x : port.pt.x},${port.anchorPt ? port.anchorPt.y : port.pt.y}`;
         const conflict = ctx.occupiedLines.find(l => 
             l.startNodeId === String(startNodeId) && 
             l.startPortKey === portKey && 
             l.edgeType !== edgeType
         );
         if (conflict) {
             startPenalty += 10 * (port.sizeD || 50); // Heavy penalty to force using a different port
         }
     }

     if (!isBlockedPointCheck(nx, ny, startNodeId, endNodeId, allowOverlap, ctx)) {
         const id = `${nx},${ny},${sDir}`;
         const h = getH(nx, ny);
         const ptNode = { x: port.pt.x, y: port.pt.y, parent: null, trueStartPt: port.anchorPt || port.pt };
         const node = {
             x: nx, y: ny, id, 
             g: startPenalty, f: h + startPenalty, dir: sDir,
             parent: ptNode,
             bends: 0,
             currSegLen: gridStep,
             lastSegLen: 0,
             prevLastSegLen: 0,
             ppLastSegLen: 0,
             trueStartPt: port.anchorPt || port.pt,
             unbundledSegIndex: 0,
             unbundledSegLen: gridStep,
             isBundled: false,
             wasBundled: false,
             maxSegLen: gridStep
         };
         openHeap.push(node);
         openMap.set(id, node);
     }
  });

   // Search bounding box: don't explore far from src→dst corridor
   const allPtsX = [...startPorts.map(p => p.pt.x), ...safeTargets.map(t => t.x)];
   const allPtsY = [...startPorts.map(p => p.pt.y), ...safeTargets.map(t => t.y)];
   const spanX = Math.max(...allPtsX) - Math.min(...allPtsX);
   const spanY = Math.max(...allPtsY) - Math.min(...allPtsY);
   const searchMargin = Math.max(200, Math.round((spanX + spanY) * 0.5));
   const searchMinX = Math.min(...allPtsX) - searchMargin;
   const searchMaxX = Math.max(...allPtsX) + searchMargin;
   const searchMinY = Math.min(...allPtsY) - searchMargin;
   const searchMaxY = Math.max(...allPtsY) + searchMargin;

   
   const isSafeTarget = (x, y) => {
      return safeTargets.find(t => t.x === x && t.y === y);
  };

    let bestCompletedPath = null;

    while (openHeap.length > 0) {
      if (deadlineMs && performance.now() > deadlineMs) {
         if (bestCompletedPath) return { pts: bestCompletedPath.pts, isFallback: false, timedOut: true, trueStartPt: bestCompletedPath.trueStartPt, trueEndPt: bestCompletedPath.trueEndPt };
         if (bestFallbackNode) {
             const pts = reconstructPath(bestFallbackNode);
             const fallbackPort = endPorts[0].pt; 
             pts.push(fallbackPort);
             return { pts, isFallback: true, timedOut: true, trueStartPt: bestFallbackNode.trueStartPt, trueEndPt: fallbackPort };
         }
         return null;
      }

       // O(log n) extract-min via binary heap
       const current = openHeap.pop();
       // Lazy deletion: skip stale entries (superseded by a better path)
       if (openMap.get(current.id) !== current) continue;
      
      if (bestCompletedPath && current.f > bestCompletedPath.gScore) {
          // All remaining paths are worse than our best completed path
          return { pts: bestCompletedPath.pts, isFallback: false, trueStartPt: bestCompletedPath.trueStartPt, trueEndPt: bestCompletedPath.trueEndPt };
      }

      openMap.delete(current.id);

      const target = isSafeTarget(current.x, current.y);
      if (target) {
          // Must end approaching correctly!
           const correctApproach = (target.portDir === 'Top' || target.portDir === 'Bottom') ? 'V' : 'H';
          if (current.dir && current.dir !== correctApproach) {
              // Not a valid target approach, treat as a normal node
          } else {

          // Calculate text abbreviation penalty (the ONLY text penalty)
          const finalMaxSegLen = current.maxSegLen || 0;
          const textPenalty = (hasText && finalMaxSegLen < textSpaceReq) ? 100 : 0;
          const totalG = current.g + (target.penalty || 0) + textPenalty;
          if (!bestCompletedPath || totalG < bestCompletedPath.gScore) {
              const finalNode = { x: target.pt.x, y: target.pt.y, parent: current };
              let realFinalNode = finalNode;
              if (target.trueEndPt) {
                  if (Array.isArray(target.trueEndPt)) {
                      for (let i = target.trueEndPt.length - 1; i >= 0; i--) {
                          const pt = target.trueEndPt[i];
                          if (realFinalNode.x !== pt.x || realFinalNode.y !== pt.y) {
                              realFinalNode = { x: pt.x, y: pt.y, parent: realFinalNode };
                          }
                      }
                  } else {
                      const isSame = target.trueEndPt.x === target.pt.x && target.trueEndPt.y === target.pt.y;
                      if (!isSame) realFinalNode = { x: target.trueEndPt.x, y: target.trueEndPt.y, parent: finalNode };
                  }
              }

              bestCompletedPath = { 
                  pts: reconstructPath(realFinalNode), 
                  gScore: totalG,
                  trueStartPt: current.trueStartPt, 
                  trueEndPt: target.trueEndPt || target.pt 
              };
          }
          continue;
          }
      }

      closedSet.add(current.id);

    const neighbors = [
        { x: current.x - gridStep, y: current.y, dir: 'H' },
        { x: current.x + gridStep, y: current.y, dir: 'H' },
        { x: current.x, y: current.y - gridStep, dir: 'V' },
        { x: current.x, y: current.y + gridStep, dir: 'V' }
    ];

    for (let n of neighbors) {
        // Prevent U-turns instantly
        if (current.dir === 'H' && n.dir === 'H' && ((n.x - current.x) === -(current.x - current.parent.x))) continue;
        if (current.dir === 'V' && n.dir === 'V' && ((n.y - current.y) === -(current.y - current.parent.y))) continue;

        // Search bounding box check
        if (n.x < searchMinX || n.x > searchMaxX || n.y < searchMinY || n.y > searchMaxY) continue;

        // Self-crossing ban was removed per user request to optimize routing speed.

        
        if (isBlockedPointCheck(n.x, n.y, startNodeId, endNodeId, ignorePadding, ctx)) continue;
        if (isSegmentBlockedCheck(current.x, current.y, n.x, n.y, startNodeId, endNodeId, ignorePadding, ctx)) continue;

        const nId = `${n.x},${n.y},${n.dir}`;
        if (closedSet.has(nId)) continue;

        
        const isBend = current.dir !== n.dir;

        // Kissing Bends Prevention (X-meeting)
        if (isBend && !allowOverlap) {
            let touch = false;
            for (let turn of ctx.occupiedTurns) {
                // Ignore siblings (buses naturally share bends)
                if (turn.startNodeId === startNodeId) continue;
                
                // The bend actually happens at current.x, current.y
                if (turn.x === current.x && turn.y === current.y) {
                    touch = true; break;
                }
            }
            if (touch && !allowCrossing) continue; // Forbidden kissing point on strict tiers
        }

        const overlapCheck = checkPathOverlap(current.x, current.y, n.x, n.y, ctx);

        
        const allowBusPremium = (ctx.diagramType === 'tree');
        let overlapPenalty = 0;
        let isBusOverlap = false;

        let actualCrossings = 0;
        for (let crossLine of overlapCheck.crossings) {
            // For tree diagrams, sibling crossings are allowed (T-fork branching from bus trunk)
            // For all other diagrams, ALL crossings are banned
            const isSibling = crossLine.startNodeId === startNodeId || crossLine.endNodeId === endNodeId;
            if (isSibling && ctx.diagramType === 'tree') continue;
            actualCrossings++;
        }

        if (actualCrossings > 0) {
            if (!allowCrossing) continue; // STRICT BAN on crossings unless Tier specifically allows it
            overlapPenalty += ctx.rules.CROSSING_PENALTY * actualCrossings;
        }

        if (overlapCheck.overlaps.length > 0) {
            let invalidOverlap = false;
            let strictBan = false;

            for (let line of overlapCheck.overlaps) {
                const sameType = line.edgeType === edgeType;
                if (!sameType) {
                    strictBan = true; break; // Different types NEVER bundle
                }
                
                const sameStartNode = line.startNodeId === startNodeId;
                if (!sameStartNode) {
                    invalidOverlap = true;
                    continue;
                }

                if (ctx.diagramType !== 'tree') {
                    invalidOverlap = true;
                    continue;
                }
                
                isBusOverlap = true; 
            }

            if (strictBan) continue; // INSTANT BAN FOR TEXT AND MULTI-TYPES

            if (invalidOverlap) {
                if (!allowOverlap) continue; // Forbid overlaps based on Tier
                overlapPenalty += ctx.rules.COLLISION_OVERLAP_PENALTY;
            } else if (isBusOverlap && !allowBusPremium) {
                overlapPenalty += gridStep * 2; // 2 points per pixel penalty for 'slipping' on non-bus diagrams
            }
        }

        let tForkDiscount = 0;
        if (isBend && allowBusPremium) {
            // O(1) spatial lookup for turns at current position
            const turnsHere = ctx.getTurnsAt(current.x, current.y);
            // Check 1: sibling turn at same point (classic T-fork)
            if (turnsHere) {
                for (let turn of turnsHere) {
                    if (turn.startNodeId === startNodeId || turn.endNodeId === endNodeId) {
                        tForkDiscount = 100;
                        break;
                    }
                }
            }
            // Check 2: branching off a straight sibling trunk
            if (tForkDiscount === 0) {
                for (let sibLine of ctx.occupiedLines) {
                    if (sibLine.startNodeId !== startNodeId && sibLine.endNodeId !== endNodeId) continue;
                    if (sibLine.edgeType !== edgeType) continue;
                    const onSegH = sibLine.y1 === sibLine.y2 && current.y === sibLine.y1 &&
                        current.x >= Math.min(sibLine.x1, sibLine.x2) && current.x <= Math.max(sibLine.x1, sibLine.x2);
                    const onSegV = sibLine.x1 === sibLine.x2 && current.x === sibLine.x1 &&
                        current.y >= Math.min(sibLine.y1, sibLine.y2) && current.y <= Math.max(sibLine.y1, sibLine.y2);
                    if (onSegH || onSegV) {
                        if (turnsHere) {
                            for (let otherTurn of turnsHere) {
                                if (otherTurn.startNodeId === startNodeId || otherTurn.endNodeId === endNodeId) {
                                    tForkDiscount = 100;
                                    break;
                                }
                            }
                        }
                        if (tForkDiscount === 0) {
                            tForkDiscount = 80;
                        }
                        break;
                    }
                }
            }
        }

        let currLen = isBend ? gridStep : current.currSegLen + gridStep;
        let lastLen = isBend ? current.currSegLen : current.lastSegLen;
        let prevLast = isBend ? current.lastSegLen : current.prevLastSegLen;

        let newIsBundled = overlapCheck.overlaps.length > 0;
        let newWasBundled = current.wasBundled || newIsBundled;
        let newUnbundledSegLen = current.unbundledSegLen || 0;

        if (newIsBundled) {
             newUnbundledSegLen = 0;
        } else {
             if (current.isBundled) {
                 newUnbundledSegLen = gridStep;
             } else {
                 if (isBend) {
                     newUnbundledSegLen = gridStep;
                 } else {
                     newUnbundledSegLen += gridStep;
                 }
             }
        }
        
        if (!newWasBundled) {
             newUnbundledSegLen = isBend ? gridStep : (current.currSegLen + gridStep);
        }
        
        const newMaxSegLen = Math.max(current.maxSegLen || 0, newUnbundledSegLen);

        let stepCost = gridStep * ctx.rules.LENGTH_PENALTY;
        if (isBusOverlap && allowBusPremium) {
            stepCost = 0.5; // Busing is extremely cheap — strongly attracts lines to shared buses
        }

        let bendPenaltyVal = isBend ? ctx.rules.BEND_PENALTY : 0;
        
        let medianBendDiscount = 0;
        
        if (isBend && current.bends === 0) {
            // STRICT RULE: EARLY_BEND_BAN
            const distFromStart = Math.abs(current.x - current.trueStartPt.x) + Math.abs(current.y - current.trueStartPt.y);
            if (distFromStart < ctx.rules.STUB_LENGTH) {
                continue; // Absolutely blocked by stub distance
            }
            
            // Median bend discount (ONLY for Z shapes, forbid U shapes / П)
            // Dynamic median from real start to first safe target, snapped to grid
            // We use safeTargets[0] as an approximation to avoid expensive reduce logic
            const st = safeTargets[0];
            const medX = (current.trueStartPt.x + st.x) / 2;
            const medY = (current.trueStartPt.y + st.y) / 2;
            const snappedMedX = Math.round(medX / gridStep) * gridStep;
            const snappedMedY = Math.round(medY / gridStep) * gridStep;

            let validZ = false;
            if (current.dir === 'V') {
                const startSign = Math.sign(current.y - current.trueStartPt.y);
                if (startSign !== 0) {
                    validZ = safeTargets.some(st => 
                        (st.portDir === 'Top' && startSign > 0) || 
                        (st.portDir === 'Bottom' && startSign < 0)
                    );
                    if (validZ && n.dir === 'H' && Math.abs(n.y - snappedMedY) <= gridStep/2) {
                        medianBendDiscount = 20;
                    }
                }
            } else if (current.dir === 'H') {
                const startSign = Math.sign(current.x - current.trueStartPt.x);
                if (startSign !== 0) {
                    validZ = safeTargets.some(st => 
                        (st.portDir === 'Left' && startSign > 0) || 
                        (st.portDir === 'Right' && startSign < 0)
                    );
                    if (validZ && n.dir === 'V' && Math.abs(n.x - snappedMedX) <= gridStep/2) {
                        medianBendDiscount = 20;
                    }
                }
            }
        }
        bendPenaltyVal = bendPenaltyVal - medianBendDiscount;
        
        // Backtrack penalty: penalize steps going AWAY from src→dst vector
        let backtrackPenalty = 0;
        
        const dxToTarget = safeTargets[0].x - current.trueStartPt.x;
        const dyToTarget = safeTargets[0].y - current.trueStartPt.y;
        const stepDx = n.x - current.x;
        const stepDy = n.y - current.y;
        if (Math.abs(dxToTarget) >= Math.abs(dyToTarget)) {
            if (stepDx !== 0 && Math.sign(stepDx) !== Math.sign(dxToTarget)) backtrackPenalty = 200;
        } else {
            if (stepDy !== 0 && Math.sign(stepDy) !== Math.sign(dyToTarget)) backtrackPenalty = 200;
        }

        const matchedST = safeTargets.find(st => st.x === n.x && st.y === n.y);
        const targetMatched = !!matchedST;
        let finalBendPenalty = 0;

        if (targetMatched && n.dir !== matchedST.dir) {
            finalBendPenalty = ctx.rules.BEND_PENALTY;
        }

        const textPenalty = (hasText && newMaxSegLen < textSpaceReq) ? 100 : 0;
        const gScore = current.g + stepCost + bendPenaltyVal + finalBendPenalty + overlapPenalty + backtrackPenalty;
        const hScore = getH(n.x, n.y) + textPenalty;
        const fScore = gScore + hScore;

        const newBends = current.bends + (isBend ? 1 : 0);

        if (hScore < bestFallbackH) {
            bestFallbackH = hScore;
            bestFallbackNode = { x: n.x, y: n.y, parent: current, trueStartPt: current.trueStartPt };
        }

        const existing = openMap.get(nId);
        if (!existing || gScore < existing.g) {

            const newNode = {
                id: nId,
                x: n.x,
                y: n.y,
                g: gScore,
                f: fScore,
                parent: current,
                dir: n.dir,
                bends: newBends,
                currSegLen: currLen,
                lastSegLen: lastLen,
                prevLastSegLen: prevLast,
                ppLastSegLen: isBend ? current.prevLastSegLen : current.ppLastSegLen,
                trueStartPt: current.trueStartPt,
                isBundled: newIsBundled,
                wasBundled: newWasBundled,
                unbundledSegLen: newUnbundledSegLen,
                maxSegLen: newMaxSegLen
            };
            if (!existing) { openHeap.push(newNode); openMap.set(nId, newNode); }
            else { openHeap.push(newNode); openMap.set(nId, newNode); }
        }
    }
  }
  return null;
}

function reconstructPath(leaf) {
    const pts = [];
    let curr = leaf;
    let root = null;
    while (curr) {
        pts.unshift({ x: curr.x, y: curr.y });
        root = curr;
        curr = curr.parent;
    }
    if (root && root.trueStartPt) {
        if (Array.isArray(root.trueStartPt)) {
            for (let i = root.trueStartPt.length - 1; i >= 0; i--) {
                const pt = root.trueStartPt[i];
                if (pts[0].x !== pt.x || pts[0].y !== pt.y) {
                    pts.unshift({ x: pt.x, y: pt.y });
                }
            }
        } else {
            if (pts[0].x !== root.trueStartPt.x || pts[0].y !== root.trueStartPt.y) {
                pts.unshift({ x: root.trueStartPt.x, y: root.trueStartPt.y });
            }
        }
    }
    return pts;
}
