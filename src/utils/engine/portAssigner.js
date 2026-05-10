/**
 * Port Assigner — Phase 1 of routing
 * 
 * Assigns exit/entry ports BEFORE A* runs.
 * Now acts as a robust penalty weighted matrix evaluating obstacle L-Rays 
 * and delegating heavy lifting to A* Priority Queue.
 */
import { getTrueBox, getNodePorts, isSegmentBlockedCheck } from './geometry.js';
import { getRoutingPolicy } from './routingPolicy.js';

/**
 * Assign ports for all edges.
 * @param {Array} edges - [{id, from, to, ...}]
 * @param {Array} nodes - [{id, x, y, type, size, width, height}]
 * @param {string} diagramType
 * @returns {Map<string, {startPorts, endPorts}>} edgeId → filtered port arrays
 */
export function assignPorts(edges, nodes, diagramType, isHorizontalFlow = false, ctx = null) {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const result = new Map();
  const routingPolicy = getRoutingPolicy(diagramType);
  // Plugin declares which port penalty strategy to use:
  //   'topdown'  — golden-port assignment for strict top→bottom trees
  //   'dynamic'  — L-ray obstacle avoidance for freeform diagrams
  //   'none'     — no A* (straight or no-edge diagrams)
  const portStrategy = routingPolicy.portStrategy;
  const penaltyFn = routingPolicy.portPenalty;
  const isTopdown = portStrategy === 'topdown';
  const portOptions = { cardinalOnly: routingPolicy.cardinalOnly };

  // For 'topdown' strategy: pre-compute shared golden ports first
  const treeExitAssignments = new Map();
  const treeEntryAssignments = new Map();

  if (isTopdown) {
    const outgoing = new Map();
    const incoming = new Map();
    for (const edge of edges) {
      const src = nodeMap.get(edge.from);
      const tgt = nodeMap.get(edge.to);
      if (!src || !tgt) continue;
      
      const srcBox = getTrueBox(src);
      const tgtBox = getTrueBox(tgt);
      const dx = tgtBox.cx - srcBox.cx;
      const dy = tgtBox.cy - srcBox.cy;
      const angle = Math.atan2(dy, dx); 
      
      if (!outgoing.has(edge.from)) outgoing.set(edge.from, []);
      outgoing.get(edge.from).push({ edge, angle, dx, dy, node: src });
      
      if (!incoming.has(edge.to)) incoming.set(edge.to, []);
      incoming.get(edge.to).push({ edge, angle: Math.atan2(-dy, -dx), dx: -dx, dy: -dy, node: tgt });
    }
    for (const [, edgeInfos] of outgoing) {
      assignDirectionsTree(edgeInfos, treeExitAssignments, 'exit', isHorizontalFlow);
    }
    for (const [, edgeInfos] of incoming) {
      assignDirectionsTree(edgeInfos, treeEntryAssignments, 'entry', isHorizontalFlow);
    }
  }

  const circleExitAssignments = assignCircleExitPorts(edges, nodeMap);
  const flowchartExitAssignments = diagramType === 'flowchart'
    ? assignFlowchartExitPorts(edges, nodeMap)
    : new Map();
  const decisionEntryAssignments = assignDecisionEntryPorts(edges, nodeMap);
  const flowchartEntryAssignments = diagramType === 'flowchart'
    ? assignFlowchartEntryPorts(edges, nodeMap)
    : new Map();

  // Iterate all edges to compute robust penalties
  for (const edge of edges) {
    const src = nodeMap.get(edge.from);
    const tgt = nodeMap.get(edge.to);
    if (!src || !tgt) continue;

    const srcBox = getTrueBox(src);
    const tgtBox = getTrueBox(tgt);

    let startPorts = getNodePorts(src, srcBox, penaltyFn, portOptions);
    let endPorts = getNodePorts(tgt, tgtBox, penaltyFn, portOptions);

    if (isTopdown) {
      // 'topdown' strategy: golden-port penalty (preferred top/bottom exit per edge)
      applyTreePenalties(startPorts, treeExitAssignments.get(edge.id), srcBox, src);
      applyTreePenalties(endPorts, treeEntryAssignments.get(edge.id), tgtBox, tgt);
      // Note: we keep all ports so A* can fall back if the golden port is saturated
    } else {
      if (diagramType === 'flowchart') {
        startPorts = keepFlowchartFallbackPorts(startPorts, src);
        endPorts = keepFlowchartFallbackPorts(endPorts, tgt);
      }
      if (routingPolicy.sidePortsOnly) {
        startPorts = keepSidePorts(startPorts);
        endPorts = keepSidePorts(endPorts);
      }
      // 'dynamic' strategy: L-ray obstacle-aware penalties (default for freeform graphs)
      applyFlowchartPenalties(startPorts, src, tgtBox, ctx, src.id, tgt.id);
      applyFlowchartPenalties(endPorts, tgt, srcBox, ctx, src.id, tgt.id);
      applyPreferredPortPenalty(startPorts, circleExitAssignments.get(edge.id), srcBox, src);
      if (diagramType === 'flowchart') {
        startPorts = forcePreferredPort(startPorts, circleExitAssignments.get(edge.id) || flowchartExitAssignments.get(edge.id));
      }
      applyDirectionalPortPenalty(endPorts, flowchartEntryAssignments.get(edge.id), tgtBox);
      endPorts = forcePreferredPort(endPorts, decisionEntryAssignments.get(edge.id));
    }

    result.set(edge.id, { startPorts, endPorts });
  }

  return result;
}

function keepFlowchartFallbackPorts(ports, node) {
  if (node?.type === 'rhombus') return ports;
  if (node?.type === 'circle') return ports;
  return ports.filter(port => !port.isDiagonal);
}

function keepSidePorts(ports) {
  return ports.filter(port => port.axis === 'H' && !port.isDiagonal);
}

function assignDecisionEntryPorts(edges, nodeMap) {
  const assignments = new Map();
  const incoming = new Map();

  for (const edge of edges) {
    const src = nodeMap.get(edge.from);
    const tgt = nodeMap.get(edge.to);
    if (!src || !tgt || tgt.type !== 'rhombus') continue;
    const srcBox = getTrueBox(src);
    const tgtBox = getTrueBox(tgt);
    if (!incoming.has(tgt.id)) incoming.set(tgt.id, []);
    incoming.get(tgt.id).push({ edge, srcBox, tgtBox });
  }

  for (const [, list] of incoming) {
    const buckets = new Map();
    for (const item of list) {
      const key = edgeStyleKey(item.edge);
      if (!buckets.has(key)) buckets.set(key, { items: [] });
      buckets.get(key).items.push(item);
    }

    for (const bucket of buckets.values()) {
      if (bucket.items.length < 2) continue;
      const tgtBox = bucket.items[0].tgtBox;
      const dir = chooseDecisionEntryDir(bucket.items, tgtBox);
      bucket.items.forEach(item => assignments.set(item.edge.id, dir));
    }
  }

  return assignments;
}

function assignFlowchartExitPorts(edges, nodeMap) {
  const assignments = new Map();
  const outgoing = new Map();

  for (const edge of edges) {
    const src = nodeMap.get(edge.from);
    const tgt = nodeMap.get(edge.to);
    if (!src || !tgt || src.type === 'circle') continue;
    if (!outgoing.has(src.id)) outgoing.set(src.id, []);
    outgoing.get(src.id).push({ edge, src, srcBox: getTrueBox(src), tgtBox: getTrueBox(tgt) });
  }

  for (const [, list] of outgoing) {
    if (list.length < 2) continue;
    const sorted = [...list].sort((a, b) => Number(isDirectNeighbor(a)) - Number(isDirectNeighbor(b))).reverse();
    const sideCounts = new Map();
    sorted.forEach(item => {
      const preferred = flowchartSideForVector(item.tgtBox.cx - item.srcBox.cx, item.tgtBox.cy - item.srcBox.cy);
      const count = sideCounts.get(preferred) || 0;
      sideCounts.set(preferred, count + 1);
      assignments.set(item.edge.id, alternateExitSide(preferred, count, item.src?.type));
    });
  }

  return assignments;
}

function isDirectNeighbor(item) {
  return Math.abs(item.srcBox.cy - item.tgtBox.cy) < 1 && Math.abs(item.tgtBox.cx - item.srcBox.cx) <= 380;
}

function alternateExitSide(side, index, nodeType) {
  const orders = nodeType === 'rhombus' ? {
    Right: ['Right', 'Top', 'Bottom', 'Left'],
    Left: ['Left', 'Top', 'Bottom', 'Right'],
    Bottom: ['Bottom', 'Right', 'Left', 'Top'],
    Top: ['Top', 'Right', 'Left', 'Bottom'],
  } : {
    Right: ['Right', 'Bottom', 'Top', 'Left'],
    Left: ['Left', 'Bottom', 'Top', 'Right'],
    Bottom: ['Bottom', 'Right', 'Left', 'Top'],
    Top: ['Top', 'Right', 'Left', 'Bottom'],
  };
  const order = orders[side] || [side];
  return order[Math.min(index, order.length - 1)];
}

function assignFlowchartEntryPorts(edges, nodeMap) {
  const assignments = new Map();
  const incoming = new Map();

  for (const edge of edges) {
    const src = nodeMap.get(edge.from);
    const tgt = nodeMap.get(edge.to);
    if (!src || !tgt || tgt.type === 'rhombus') continue;
    if (!incoming.has(tgt.id)) incoming.set(tgt.id, []);
    incoming.get(tgt.id).push({ edge, srcBox: getTrueBox(src), tgtBox: getTrueBox(tgt) });
  }

  for (const [, list] of incoming) {
    const sorted = [...list].sort((a, b) => {
      const sideA = cardinalForVector(a.srcBox.cx - a.tgtBox.cx, a.srcBox.cy - a.tgtBox.cy);
      const sideB = cardinalForVector(b.srcBox.cx - b.tgtBox.cx, b.srcBox.cy - b.tgtBox.cy);
      if (sideA !== sideB) return sideOrder(sideA) - sideOrder(sideB);
      return a.srcBox.cy - b.srcBox.cy || a.srcBox.cx - b.srcBox.cx;
    });

    const sideCounts = new Map();
    sorted.forEach(item => {
      const preferred = flowchartSideForVector(item.srcBox.cx - item.tgtBox.cx, item.srcBox.cy - item.tgtBox.cy);
      const count = sideCounts.get(preferred) || 0;
      sideCounts.set(preferred, count + 1);
      assignments.set(item.edge.id, alternateEntrySide(preferred, count));
    });
  }

  return assignments;
}

function alternateEntrySide(side, index) {
  const orders = {
    Bottom: ['Bottom', 'Top', 'Right', 'Left'],
    Top: ['Top', 'Bottom', 'Right', 'Left'],
    Left: ['Left', 'Top', 'Bottom', 'Right'],
    Right: ['Right', 'Top', 'Bottom', 'Left'],
  };
  const order = orders[side] || [side];
  return order[Math.min(index, order.length - 1)];
}

function sideOrder(side) {
  if (side === 'Top') return 0;
  if (side === 'Left') return 1;
  if (side === 'Right') return 2;
  return 3;
}

function edgeStyleKey(edge) {
  return [
    edge?.lineStyle || 'solid',
    edge?.connectionType || edge?.arrowType || 'target',
  ].join(':');
}

function chooseDecisionEntryDir(items, tgtBox) {
  if (items.some(item => item.srcBox.cx < tgtBox.left - 20)) return 'Left';
  if (items.some(item => item.srcBox.cx > tgtBox.right + 20)) return 'Right';
  const avgSourceX = average(items.map(item => item.srcBox.cx));
  const avgSourceY = average(items.map(item => item.srcBox.cy));
  return cardinalForVector(avgSourceX - tgtBox.cx, avgSourceY - tgtBox.cy);
}

function assignCircleExitPorts(edges, nodeMap) {
  const assignments = new Map();
  const outgoing = new Map();

  for (const edge of edges) {
    const src = nodeMap.get(edge.from);
    const tgt = nodeMap.get(edge.to);
    if (!src || !tgt || src.type !== 'circle') continue;
    const srcBox = getTrueBox(src);
    const tgtBox = getTrueBox(tgt);
    const dx = tgtBox.cx - srcBox.cx;
    const dy = tgtBox.cy - srcBox.cy;
    if (!outgoing.has(src.id)) outgoing.set(src.id, []);
    outgoing.get(src.id).push({ edge, dx, dy, targetY: tgtBox.cy, targetX: tgtBox.cx });
  }

  for (const [, list] of outgoing) {
    if (list.length === 1) {
      assignments.set(list[0].edge.id, cardinalForVector(list[0].dx, list[0].dy));
      continue;
    }

    const circleIncoming = edges
      .filter(edge => edge.to === list[0].edge.from)
      .map(edge => {
        const src = nodeMap.get(edge.from);
        const circle = nodeMap.get(edge.to);
        if (!src || !circle) return null;
        const srcBox = getTrueBox(src);
        const circleBox = getTrueBox(circle);
        return cardinalForVector(srcBox.cx - circleBox.cx, srcBox.cy - circleBox.cy);
      })
      .filter(Boolean);
    const avoidTop = circleIncoming.includes('Top');
    const avoidBottom = circleIncoming.includes('Bottom');
    const mostlyHorizontal = list.filter(item => Math.abs(item.dx) >= Math.abs(item.dy)).length >= list.length / 2;
    const sorted = [...list].sort((a, b) => mostlyHorizontal ? a.targetY - b.targetY : a.targetX - b.targetX);
    let dirs = mostlyHorizontal
      ? (average(sorted.map(i => i.dx)) >= 0 ? ['Top', 'Right', 'Bottom', 'Left'] : ['Top', 'Left', 'Bottom', 'Right'])
      : (average(sorted.map(i => i.dy)) >= 0 ? ['Left', 'Bottom', 'Right', 'Top'] : ['Left', 'Top', 'Right', 'Bottom']);
    if (avoidTop) dirs = dirs.filter(dir => dir !== 'Top').concat('Top');
    if (avoidBottom) dirs = dirs.filter(dir => dir !== 'Bottom').concat('Bottom');

    sorted.forEach((item, index) => {
      assignments.set(item.edge.id, dirs[Math.min(index, dirs.length - 1)]);
    });
  }

  return assignments;
}

function cardinalForVector(dx, dy) {
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'Right' : 'Left';
  return dy >= 0 ? 'Bottom' : 'Top';
}

function flowchartSideForVector(dx, dy) {
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);
  if (absDy > absDx * 1.2) return dy >= 0 ? 'Bottom' : 'Top';
  return dx >= 0 ? 'Right' : 'Left';
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function applyPreferredPortPenalty(ports, preferredDir, box, node) {
  if (!preferredDir || node?.type !== 'circle') return;
  const sizeD = Math.max(20, box.right - box.left, box.bottom - box.top);
  for (const p of ports) {
    if (p.dir === preferredDir) {
      p.penalty = Math.min(p.penalty || 0, 0);
    } else {
      p.penalty = (p.penalty || 0) + 12 * sizeD;
    }
  }
}

function applyDirectionalPortPenalty(ports, preferredDir, box) {
  if (!preferredDir) return;
  const sizeD = Math.max(20, box.right - box.left, box.bottom - box.top);
  for (const p of ports) {
    if (portSide(p) !== preferredDir) {
      p.penalty = (p.penalty || 0) + 12 * sizeD;
    }
  }
}

function forcePreferredPort(ports, preferredDir) {
  if (!preferredDir) return ports;
  const preferred = ports.filter(port => portSide(port) === preferredDir && !port.isDiagonal);
  return preferred.length > 0 ? preferred : ports;
}

function applyTreePenalties(ports, goldenDir, box, node) {
  if (!goldenDir) return;
  const isStackEntry = node && !!node._stackEntry;

  for (const p of ports) {
    const sizeD = Math.max(20, p.axis === 'V' ? (box.right - box.left) : (box.bottom - box.top));
    p.sizeD = sizeD;
    
    // A center port is any primary cardinal port explicitly spawned with 0 initial penalty
    const isCenter = (!p.penalty || p.penalty === 0) && !!p.dir; 
    
    if (p.dir === goldenDir && isCenter) {
      p.penalty = 0;
    } else if (isCenter) {
      p.penalty = isStackEntry ? 20 * sizeD : 4 * sizeD;
    } else {
      p.penalty = isStackEntry ? 40 * sizeD : 8 * sizeD;
    }
  }
}

function applyFlowchartPenalties(ports, node, tgtBox, ctx, srcId, tgtId) {
  const srcBox = getTrueBox(node);
  
  for (const p of ports) {
    const declaredPenalty = p.penalty || 0;
    const sizeD = Math.max(20, p.axis === 'V' ? (srcBox.right - srcBox.left) : (srcBox.bottom - srcBox.top));
    p.sizeD = sizeD;
    const cat = getPortCategory(p, srcBox, tgtBox);
    
    let basePenalty = 0;
    if (cat === 'LATERAL') basePenalty = 1 * sizeD;
    if (cat === 'REAR') basePenalty = 2 * sizeD;
    if (cat === 'IDEAL') {
      const isVertFirst = p.axis === 'V';
      // Orthogonal L-ray check from the port to target center
      if (isLPathClear(p.pt.x, p.pt.y, tgtBox.cx, tgtBox.cy, isVertFirst, srcId, tgtId, ctx)) {
        basePenalty = 0;
      } else {
        basePenalty = 1 * sizeD; 
      }
    }

    // Offset / Bifurcation penalty addition
    const isOffset = declaredPenalty > 0;
    if (isOffset) {
      basePenalty += declaredPenalty + 2 * sizeD;
    }
    if ((node.type === 'circle' || node.type === 'rhombus') && p.isDiagonal) {
      basePenalty += (node.type === 'rhombus' ? 10 : 5) * sizeD;
    }

    p.penalty = basePenalty;
  }
}

function getPortCategory(port, srcBox, tgtBox) {
  const margin = 20; 
  const dx = tgtBox.cx - srcBox.cx;
  const dy = tgtBox.cy - srcBox.cy;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);
  const horizontalDominates = absDx > margin && absDx >= absDy * 0.72;
  const verticalDominates = absDy > margin && absDy >= absDx * 0.72;
  
  let isIdeal = false;
  let isRear = false;
  
  if (port.axis === 'H') { 
      if (Math.abs(dx) <= margin) {
          isIdeal = false;
          isRear = false;
      } else {
          const side = portSide(port);
          isIdeal = horizontalDominates && ((side === 'Right' && dx > 0) || (side === 'Left' && dx < 0));
          isRear = !isIdeal;
      }
  } else { 
      if (Math.abs(dy) <= margin) {
          isIdeal = false;
          isRear = false;
      } else {
          const side = portSide(port);
          isIdeal = verticalDominates && ((side === 'Bottom' && dy > 0) || (side === 'Top' && dy < 0));
          isRear = !isIdeal;
      }
  }
  return isIdeal ? 'IDEAL' : (isRear ? 'REAR' : 'LATERAL');
}

function portSide(port) {
  if (port.dir === 'BifRight') return 'Right';
  if (port.dir === 'BifLeft') return 'Left';
  if (port.dir === 'BifTop') return 'Top';
  if (port.dir === 'BifBottom') return 'Bottom';
  return port.dir;
}

function isLPathClear(x1, y1, x2, y2, isVertFirst, startId, endId, ctx) {
  if (!ctx || !ctx.obstacles) return true;
  if (Math.abs(x1 - x2) < 2 && Math.abs(y1 - y2) < 2) return true;

  const bendX = isVertFirst ? x1 : x2;
  const bendY = isVertFirst ? y2 : y1;

  if (!isSegmentBlockedCheck(x1, y1, bendX, bendY, startId, endId, false, ctx)) {
      if (!isSegmentBlockedCheck(bendX, bendY, x2, y2, startId, endId, false, ctx)) {
          return true;
      }
  }
  return false;
}

function assignDirectionsTree(edgeInfos, assignments, role, isHorizontalFlow) {
  for (const info of edgeInfos) {
    let dir = 'Bottom';
    
    // Explicit override for denseGroups (vertically stacked children) configured by layout engine
    if (info.node && info.node._stackEntry) {
       dir = info.node._stackEntry;
    } else {
      if (isHorizontalFlow) {
        if (role === 'exit') {
          dir = info.dx >= 0 ? 'Right' : 'Left';
        } else {
          dir = info.dx <= 0 ? 'Left' : 'Right';
        }
      } else {
        if (role === 'exit') {
          dir = info.dy >= 0 ? 'Bottom' : 'Top';
        } else {
          dir = info.dy <= 0 ? 'Top' : 'Bottom';
        }
      }
    }
    assignments.set(info.edge.id, dir);
  }
}
