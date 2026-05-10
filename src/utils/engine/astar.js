import { isBlockedPointCheck, isSegmentBlockedCheck, checkPathOverlap } from './geometry.js';
import { getRoutingPolicy } from './routingPolicy.js';

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
  const startStubLen = terminalStubLength(edgeType, 'start', gridStep);
  const endStubLen = terminalStubLength(edgeType, 'end', gridStep);

  let bestFallbackNode = null;
  let bestFallbackH = Infinity;

  const routingPolicy = getRoutingPolicy(ctx?.diagramType);
  const pointKeyFor = (point, fallback) => {
    const p = Array.isArray(point) ? point[0] : point;
    const keyPoint = p || fallback;
    return `${keyPoint.x},${keyPoint.y}`;
  };
  const portKeyFor = (port) => pointKeyFor(port.anchorPt, port.pt);
  const filterFreePorts = (ports, nodeId, role) => {
    if (routingPolicy.allowPortReuse || !ctx?.usedPorts) return ports;
    const node = ctx.allNodes?.find(n => String(n.id) === String(nodeId));
    const isDecisionFanInTarget = role === 'end' && ctx.diagramType === 'flowchart' && node?.type === 'rhombus';
    if (isDecisionFanInTarget) return ports;

    const used = ctx.usedPorts.get(String(nodeId));
    if (!used) return ports;

    const free = ports.filter(port => !used.has(portKeyFor(port)));
    return free;
  };
  const candidateStartPorts = filterFreePorts(startPorts, startNodeId, 'start');
  const candidateEndPorts = filterFreePorts(endPorts, endNodeId, 'end');
  if (candidateStartPorts.length === 0 || candidateEndPorts.length === 0) return null;

  const directPath = findDirectPortPath(
      candidateStartPorts,
      candidateEndPorts,
      startNodeId,
      endNodeId,
      edgeType,
      startStubLen,
      endStubLen,
      allowOverlap,
      allowCrossing,
      ctx
  );
  if (directPath) return directPath;

  if (ctx?.diagramType === 'flowchart') {
      const simpleOrthogonalPath = findSimpleOrthogonalPortPath(
          candidateStartPorts,
          candidateEndPorts,
          startNodeId,
          endNodeId,
          startStubLen,
          endStubLen,
          allowOverlap,
          allowCrossing,
          ctx
      );
      if (simpleOrthogonalPath) return simpleOrthogonalPath;
  }

  // Map end ports to their safe approach coordinates
  const safeTargets = candidateEndPorts.map(p => {
      const eDir = p.axis;
      const dx = eDir === 'H' ? p.sign * endStubLen : 0;
      const dy = eDir === 'V' ? p.sign * endStubLen : 0;
      return {
          x: p.pt.x + dx,
          y: p.pt.y + dy,
          pt: p.pt,
          trueEndPt: p.anchorPt || p.pt,
          dir: eDir,
          portDir: p.dir,
          approachSign: -p.sign,
          penalty: p.penalty || 0,
      };
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
  candidateStartPorts.forEach(port => {
     const sDir = port.axis;
     const dx = sDir === 'H' ? port.sign * startStubLen : 0;
     const dy = sDir === 'V' ? port.sign * startStubLen : 0;
     
     const nx = port.pt.x + dx;
     const ny = port.pt.y + dy;
     
     let startPenalty = port.penalty || 0;

     // Port Saturation Rule: Do not share ports with edges of different styles/arrows
     if (ctx && ctx.occupiedLines) {
         const portKey = portKeyFor(port);
         const startNode = ctx.allNodes?.find(n => String(n.id) === String(startNodeId));
         const conflict = ctx.occupiedLines.find(l => 
             l.startNodeId === String(startNodeId) && 
             l.startPortKey === portKey
         );
         if (conflict) {
             if (conflict.edgeType !== edgeType) {
                 startPenalty += 10 * (port.sizeD || 50);
             } else if (startNode?.type === 'circle') {
                 startPenalty += 8 * (port.sizeD || 50);
             }
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
             currSegLen: startStubLen,
             lastSegLen: 0,
             prevLastSegLen: 0,
             ppLastSegLen: 0,
             trueStartPt: port.anchorPt || port.pt,
             unbundledSegIndex: 0,
             unbundledSegLen: startStubLen,
             isBundled: false,
             wasBundled: false,
             maxSegLen: startStubLen
         };
         openHeap.push(node);
         openMap.set(id, node);
     }
  });

   // Search bounding box: don't explore far from src→dst corridor
   const allPtsX = [...candidateStartPorts.map(p => p.pt.x), ...safeTargets.map(t => t.x)];
   const allPtsY = [...candidateStartPorts.map(p => p.pt.y), ...safeTargets.map(t => t.y)];
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
             const fallbackEnd = candidateEndPorts[0];
             const fallbackPort = fallbackEnd.pt;
             pts.push(fallbackPort);
             return { pts, isFallback: true, timedOut: true, trueStartPt: bestFallbackNode.trueStartPt, trueEndPt: fallbackEnd.anchorPt || fallbackPort };
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
          const moveSign = current.dir === 'H'
              ? Math.sign(current.x - current.parent.x)
              : Math.sign(current.y - current.parent.y);
          if (current.dir === correctApproach && moveSign && moveSign !== target.approachSign) {
              // Same-axis approach from the wrong side would create a U-turn before the marker.
              // Perpendicular approach is fine: the safe target becomes the bend before the terminal stub.
          } else if (isBendOnForbiddenCorner(current, ctx, target.dir)) {
              // The safe target can itself be the final bend before the terminal stub.
              // It must obey the same no-corner-kiss rule as normal A* bends.
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

        const routing = getRoutingPolicy(ctx.diagramType);
        const allowCornerKisses = routing.allowCornerKisses;
        const allowSiblingCrossings = routing.allowSiblingCrossings;
        const allowBusPremium = routing.enableBusRouting;

        // Kissing Bends Prevention (X-meeting). Tree is the only mode that
        // intentionally allows bus/T-branch joins.
        if (isBend && !allowCornerKisses) {
            let touch = false;
            for (let turn of ctx.occupiedTurns) {
                // The bend actually happens at current.x, current.y
                if (turn.x === current.x && turn.y === current.y) {
                    touch = true; break;
                }
            }
            if (!touch) {
                for (let line of ctx.occupiedLines) {
                    if (isPointOnSegmentInterior(current, line)) {
                        touch = true; break;
                    }
                }
            }
            if (touch) continue; // Forbidden kissing point on non-tree diagrams
        }

        const overlapCheck = checkPathOverlap(current.x, current.y, n.x, n.y, ctx);

        let overlapPenalty = 0;
        let isBusOverlap = false;

        let actualCrossings = 0;
        for (let crossLine of overlapCheck.crossings) {
            const isSibling = crossLine.startNodeId === startNodeId || crossLine.endNodeId === endNodeId;
            if (isSibling && allowSiblingCrossings) continue;
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

                if (!allowBusPremium) {
                    strictBan = true; break; // Non-tree diagrams NEVER bundle shared trunks.
                }
                
                const sameStartNode = line.startNodeId === startNodeId;
                if (!sameStartNode) {
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
                overlapPenalty += gridStep * (ctx.rules.BUS_OVERLAP_PENALTY_FACTOR ?? 2);
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
                        tForkDiscount = ctx.rules.T_FORK_EXACT_DISCOUNT ?? 100;
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
                                    tForkDiscount = ctx.rules.T_FORK_EXACT_DISCOUNT ?? 100;
                                    break;
                                }
                            }
                        }
                        if (tForkDiscount === 0) {
                            tForkDiscount = ctx.rules.T_FORK_TRUNK_DISCOUNT ?? 80;
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
            stepCost = ctx.rules.BUS_STEP_COST ?? 0.5;
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
                        medianBendDiscount = ctx.rules.Z_BEND_DISCOUNT ?? 20;
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
                        medianBendDiscount = ctx.rules.Z_BEND_DISCOUNT ?? 20;
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
            if (stepDx !== 0 && Math.sign(stepDx) !== Math.sign(dxToTarget)) backtrackPenalty = ctx.rules.BACKTRACK_PENALTY ?? 200;
        } else {
            if (stepDy !== 0 && Math.sign(stepDy) !== Math.sign(dyToTarget)) backtrackPenalty = ctx.rules.BACKTRACK_PENALTY ?? 200;
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

function isPointOnSegmentInterior(point, line) {
    const margin = 0.5;
    if (line.y1 === line.y2 && point.y === line.y1) {
        const minX = Math.min(line.x1, line.x2);
        const maxX = Math.max(line.x1, line.x2);
        return point.x > minX + margin && point.x < maxX - margin;
    }
    if (line.x1 === line.x2 && point.x === line.x1) {
        const minY = Math.min(line.y1, line.y2);
        const maxY = Math.max(line.y1, line.y2);
        return point.y > minY + margin && point.y < maxY - margin;
    }
    return false;
}

function pathHasForbiddenCornerKiss(pts, ctx) {
    const routing = getRoutingPolicy(ctx?.diagramType);
    if (routing.allowCornerKisses) return false;
    for (let i = 1; i < pts.length - 1; i++) {
        const point = pts[i];
        for (let turn of ctx.occupiedTurns) {
            if (turn.x === point.x && turn.y === point.y) return true;
        }
        for (let line of ctx.occupiedLines) {
            if (isPointOnSegmentInterior(point, line)) return true;
        }
    }
    return false;
}

function isBendOnForbiddenCorner(node, ctx, nextDir = null) {
    const routing = getRoutingPolicy(ctx?.diagramType);
    const bendsFromParent = node?.parent?.dir && node.parent.dir !== node.dir;
    const bendsToNext = nextDir && node.dir !== nextDir;
    if (routing.allowCornerKisses || (!bendsFromParent && !bendsToNext)) return false;
    return pointHasForbiddenCornerKiss(node, ctx);
}

function pointHasForbiddenCornerKiss(point, ctx) {
    for (let turn of ctx.occupiedTurns) {
        if (turn.x === point.x && turn.y === point.y) return true;
    }
    for (let line of ctx.occupiedLines) {
        if (isPointOnSegmentInterior(point, line)) return true;
    }
    return false;
}

function terminalStubLength(edgeType, role, gridStep) {
    const markerType = String(edgeType || '').split('-').pop() || 'target';
    const hasStartMarker = markerType === 'reverse' || markerType === 'both';
    const hasEndMarker = markerType === 'target' || markerType === 'both';
    const needsArrowRoom = role === 'start' ? hasStartMarker : hasEndMarker;
    if (!needsArrowRoom) return gridStep;
    return Math.max(gridStep, Math.ceil(40 / gridStep) * gridStep);
}

function findDirectPortPath(startPorts, endPorts, startNodeId, endNodeId, edgeType, startStubLen, endStubLen, allowOverlap, allowCrossing, ctx) {
    let best = null;
    for (const startPort of startPorts) {
        for (const endPort of endPorts) {
            if (startPort.isDiagonal || endPort.isDiagonal) continue;
            if (startPort.axis !== endPort.axis) continue;
            if (startPort.axis === 'H' && Math.abs(startPort.pt.y - endPort.pt.y) > 0.01) continue;
            if (startPort.axis === 'V' && Math.abs(startPort.pt.x - endPort.pt.x) > 0.01) continue;

            const dx = endPort.pt.x - startPort.pt.x;
            const dy = endPort.pt.y - startPort.pt.y;
            const len = Math.abs(dx) + Math.abs(dy);
            if (len <= 0) continue;

            const sign = startPort.axis === 'H' ? Math.sign(dx) : Math.sign(dy);
            if (sign === 0) continue;
            if (startPort.sign !== sign || endPort.sign !== -sign) continue;
            if (len < Math.max(startStubLen, endStubLen)) continue;
            if (isSegmentBlockedCheck(startPort.pt.x, startPort.pt.y, endPort.pt.x, endPort.pt.y, startNodeId, endNodeId, allowOverlap, ctx)) continue;

            const overlapCheck = checkPathOverlap(startPort.pt.x, startPort.pt.y, endPort.pt.x, endPort.pt.y, ctx);
            if (!allowCrossing && overlapCheck.crossings.length > 0) continue;
            if (!allowOverlap && overlapCheck.overlaps.length > 0) continue;

            const pts = cleanDirectPath(startPort, endPort);
            const score = len + (startPort.penalty || 0) + (endPort.penalty || 0);
            if (!best || score < best.score) {
                best = {
                    score,
                    pts,
                    isFallback: false,
                    trueStartPt: startPort.anchorPt || startPort.pt,
                    trueEndPt: endPort.anchorPt || endPort.pt,
                };
            }
        }
    }
    return best;
}

function findSimpleOrthogonalPortPath(startPorts, endPorts, startNodeId, endNodeId, startStubLen, endStubLen, allowOverlap, allowCrossing, ctx) {
    let best = null;
    for (const startPort of startPorts) {
        for (const endPort of endPorts) {
            if (startPort.isDiagonal || endPort.isDiagonal) continue;
            if (startPort.axis !== endPort.axis || startPort.sign !== -endPort.sign) continue;
            if (startPort.axis !== 'H') continue;

            const axisDelta = startPort.axis === 'H'
                ? endPort.pt.x - startPort.pt.x
                : endPort.pt.y - startPort.pt.y;
            if (Math.sign(axisDelta) !== startPort.sign) continue;

            const startStub = portStubPoint(startPort, startStubLen);
            const endStub = portStubPoint(endPort, endStubLen);
            const pts = cleanDuplicatePoints([
                ...(Array.isArray(startPort.anchorPt) ? startPort.anchorPt : [startPort.anchorPt || startPort.pt]),
                startPort.pt,
                startStub,
                startPort.axis === 'H'
                    ? { x: startStub.x, y: endStub.y }
                    : { x: endStub.x, y: startStub.y },
                endStub,
                endPort.pt,
                ...(Array.isArray(endPort.anchorPt) ? endPort.anchorPt.slice().reverse() : [endPort.anchorPt || endPort.pt]),
            ]);

            if (pathBlocked(pts, startNodeId, endNodeId, allowOverlap, ctx)) continue;
            if (pathHasForbiddenCornerKiss(pts, ctx)) continue;
            const overlapCheck = pathOverlap(pts, ctx);
            if (!allowCrossing && overlapCheck.crossings > 0) continue;
            if (!allowOverlap && overlapCheck.overlaps > 0) continue;

            const score = pathLength(pts) + countBends(pts) * 90 + (startPort.penalty || 0) + (endPort.penalty || 0);
            if (!best || score < best.score) {
                best = {
                    score,
                    pts,
                    isFallback: false,
                    trueStartPt: startPort.anchorPt || startPort.pt,
                    trueEndPt: endPort.anchorPt || endPort.pt,
                };
            }
        }
    }
    return best;
}

function cleanDirectPath(startPort, endPort) {
    const pts = [];
    appendPathPoints(pts, startPort.anchorPt || startPort.pt);
    appendPathPoints(pts, startPort.pt);
    appendPathPoints(pts, endPort.pt);
    const endAnchors = Array.isArray(endPort.anchorPt) ? endPort.anchorPt.slice().reverse() : [endPort.anchorPt || endPort.pt];
    appendPathPoints(pts, endAnchors);
    return pts;
}

function cleanDirectPoints(points) {
    const pts = [];
    appendPathPoints(pts, points);
    const out = [pts[0]];
    for (let i = 1; i < pts.length - 1; i++) {
        const prev = out[out.length - 1];
        const curr = pts[i];
        const next = pts[i + 1];
        if ((prev.x === curr.x && curr.x === next.x) || (prev.y === curr.y && curr.y === next.y)) continue;
        out.push(curr);
    }
    out.push(pts[pts.length - 1]);
    return out;
}

function cleanDuplicatePoints(points) {
    const pts = [];
    appendPathPoints(pts, points);
    return pts;
}

function appendPathPoints(out, points) {
    const list = Array.isArray(points) ? points : [points];
    for (const point of list) {
        if (!point) continue;
        const prev = out[out.length - 1];
        if (!prev || Math.abs(prev.x - point.x) > 0.01 || Math.abs(prev.y - point.y) > 0.01) {
            out.push({ x: point.x, y: point.y });
        }
    }
}

function portStubPoint(port, stubLen) {
    return {
        x: port.pt.x + (port.axis === 'H' ? port.sign * stubLen : 0),
        y: port.pt.y + (port.axis === 'V' ? port.sign * stubLen : 0),
    };
}

function pathBlocked(pts, startNodeId, endNodeId, allowOverlap, ctx) {
    for (let i = 0; i < pts.length - 1; i++) {
        if (isSegmentBlockedCheck(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, startNodeId, endNodeId, allowOverlap, ctx)) {
            return true;
        }
    }
    return false;
}

function pathOverlap(pts, ctx) {
    let crossings = 0;
    let overlaps = 0;
    for (let i = 0; i < pts.length - 1; i++) {
        const check = checkPathOverlap(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, ctx);
        crossings += check.crossings.length;
        overlaps += check.overlaps.length;
    }
    return { crossings, overlaps };
}

function pathLength(pts) {
    return pts.slice(1).reduce((sum, pt, index) => sum + Math.abs(pt.x - pts[index].x) + Math.abs(pt.y - pts[index].y), 0);
}

function countBends(pts) {
    let bends = 0;
    for (let i = 1; i < pts.length - 1; i++) {
        const prevH = pts[i].y === pts[i - 1].y;
        const nextH = pts[i + 1].y === pts[i].y;
        if (prevH !== nextH) bends += 1;
    }
    return bends;
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
