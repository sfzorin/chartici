import { getTrueBox, getNodePorts } from './geometry.js';
import { getRoutingPolicy } from './routingPolicy.js';
import { GRID } from '../../diagram/canvas.js';
import { EDGE_LABEL_STYLE } from '../../diagram/edges.js';
import {
  getEdgeLabelPolicy,
  getEdgeLabelStyle,
  getFittedManualEdgeLabel,
  getManualEdgeLabelPlacement,
} from '../../diagram/edgeLabelPlacement.js';

const EPS = 0.01;
const OFFSET_PORT_PENALTY = 260;
const ARROW_MARKER_LENGTH = 20;
const LABEL_TO_ARROW_GAP = 5;
const NODE_BODY_CLEARANCE = 10;
const MAX_ROUTE_OPTIMIZATION_PASSES = 1;
const PREFERRED_CLEARANCE = 40;
const TIGHT_CLEARANCE = 20;
const COMFORT_CLEARANCE_LENGTH_BUDGET = 60;
const FLOWCHART_CORNER_RADIUS = 8;

export function routeFlowchartNegotiated(edgeInfos, allNodes, routingRules) {
  const ctx = buildFlowchartCtx(edgeInfos, allNodes, routingRules);
  const routes = new Map();
  const occupiedPorts = new Map();
  const occupiedLines = [];

  const directInfos = [...edgeInfos].sort((a, b) => a.dist - b.dist);
  for (const info of directInfos) {
    const route = chooseRoute(info, ctx, occupiedPorts, occupiedLines, { directOnly: true });
    if (!route) continue;
    commitRoute(route, routes, occupiedPorts, occupiedLines, ctx);
  }

  const remaining = edgeInfos
    .filter(info => !routes.has(String(info.edge.id)))
    .sort((a, b) => a.dist - b.dist);
  for (const info of remaining) {
    const route = chooseRoute(info, ctx, occupiedPorts, occupiedLines, { directOnly: false });
    if (route) {
      commitRoute(route, routes, occupiedPorts, occupiedLines, ctx);
      continue;
    }
    routes.set(String(info.edge.id), buildCenterFallback(info, 'no-negotiated-route'));
  }

  improveSharedNodeCrossings(routes, edgeInfos, ctx, occupiedPorts, occupiedLines);
  improveNonDirectRoutes(routes, edgeInfos, ctx, occupiedPorts, occupiedLines);
  rotateNodePortsIfBetter(routes, edgeInfos, ctx, occupiedPorts, occupiedLines);
  improveRouteClearance(routes, ctx);

  const result = {};
  for (const info of edgeInfos) {
    const route = routes.get(String(info.edge.id)) || buildCenterFallback(info, 'missing-route');
    result[info.edge.id] = toPathResult(route, info, edgeInfos, routes);
  }
  applyDecisionFanInGrouping(result, edgeInfos);
  applyVisualBreaks(result, edgeInfos);
  return result;
}

function buildFlowchartCtx(edgeInfos, allNodes, routingRules) {
  const nodeMap = new Map(allNodes.map(node => [String(node.id), node]));
  const boxes = new Map();
  const obstacles = [];
  const padding = routingRules.PADDING || NODE_BODY_CLEARANCE;
  const degree = new Map();
  const incomingDegree = new Map();
  const outgoingDegree = new Map();

  for (const info of edgeInfos) {
    degree.set(String(info.edge.from), (degree.get(String(info.edge.from)) || 0) + 1);
    degree.set(String(info.edge.to), (degree.get(String(info.edge.to)) || 0) + 1);
    outgoingDegree.set(String(info.edge.from), (outgoingDegree.get(String(info.edge.from)) || 0) + 1);
    incomingDegree.set(String(info.edge.to), (incomingDegree.get(String(info.edge.to)) || 0) + 1);
  }
  const effectiveDegree = new Map(degree);
  for (const node of allNodes) {
    if (node.type !== 'rhombus') continue;
    const id = String(node.id);
    const incomingFanInSlot = (incomingDegree.get(id) || 0) > 0 ? 1 : 0;
    effectiveDegree.set(id, (outgoingDegree.get(id) || 0) + incomingFanInSlot);
  }

  for (const node of allNodes) {
    const box = getTrueBox(node);
    boxes.set(String(node.id), box);
    if (node.type !== 'text' && node.type !== 'title') {
      obstacles.push({
        id: String(node.id),
        left: box.left - padding,
        right: box.right + padding,
        top: box.top - padding,
        bottom: box.bottom + padding,
        vLeft: box.left,
        vRight: box.right,
        vTop: box.top,
        vBottom: box.bottom,
      });
    }
  }

  const fanInPlans = buildDecisionFanInPlans(edgeInfos);
  const bounds = obstacles.length > 0
    ? {
      left: Math.min(...obstacles.map(box => box.left)),
      right: Math.max(...obstacles.map(box => box.right)),
      top: Math.min(...obstacles.map(box => box.top)),
      bottom: Math.max(...obstacles.map(box => box.bottom)),
    }
    : { left: 0, right: 0, top: 0, bottom: 0 };

  return { nodeMap, boxes, obstacles, bounds, degree, effectiveDegree, fanInPlans, routingRules };
}

function buildDecisionFanInPlans(edgeInfos) {
  const incoming = new Map();
  for (const info of edgeInfos) {
    if (info.endNode?.type !== 'rhombus') continue;
    const key = decisionFanInKey(info.edge.to, info.edge);
    if (!incoming.has(key)) incoming.set(key, []);
    incoming.get(key).push(info);
  }
  const plans = new Map();
  for (const [key, infos] of incoming) {
    if (infos.length < 2) continue;
    const dir = chooseDecisionFanInDir(infos, infos[0].endBox);
    const entry = sidePoint(infos[0].endBox, dir);
    const merge = mergePoint(entry, dir);
    plans.set(key, { dir, entry, merge });
  }
  return plans;
}

function decisionFanInKey(nodeId, edge) {
  return `${nodeId}:${edgeStyleKey(edge)}`;
}

function chooseRoute(info, ctx, occupiedPorts, occupiedLines, options) {
  const startPorts = availablePorts(info.startNode, info.startBox, ctx, occupiedPorts, 'start');
  const endPorts = availablePorts(info.endNode, info.endBox, ctx, occupiedPorts, 'end');
  let best = null;

  for (const startPort of startPorts) {
    for (const endPort of endPorts) {
      const candidates = options.directOnly
        ? directCandidates(startPort, endPort, info)
        : orthogonalCandidates(startPort, endPort, info, ctx);
      for (const pts of candidates) {
        const metrics = measureRoute(pts, info, startPort, endPort, ctx, occupiedLines, options);
        if (!metrics) continue;
        if (!best || compareRouteMetrics(metrics, best.metrics) < 0) {
          best = {
            edge: info.edge,
            info,
            pts,
            startPort,
            endPort,
            score: metrics.scalar,
            metrics,
            sourceId: String(info.edge.from),
            targetId: String(info.edge.to),
          };
        }
      }
    }
  }

  return best;
}

function availablePorts(node, box, ctx, occupiedPorts, role) {
  const policy = getRoutingPolicy('flowchart');
  const allPorts = getNodePorts(node, box, policy.portPenalty, { cardinalOnly: false })
    .filter(port => !(node.type === 'oval' && port.isDiagonal))
    .filter(port => !(node.type === 'rhombus' && isOffsetPort(port)));
  const needsOffset = ((ctx.effectiveDegree || ctx.degree).get(String(node.id)) || 0) > 4;
  const ports = needsOffset && role === 'start'
    ? allPorts
    : allPorts.filter(port => !isAuxiliaryPort(port));
  const used = occupiedPorts.get(String(node.id)) || new Set();
  const allowDecisionFanIn = role === 'end' && node.type === 'rhombus';
  return ports
    .filter(port => allowDecisionFanIn || !used.has(portKey(port)))
    .map(port => ({
      ...port,
      routerPenalty: (port.penalty || 0) + (isOffsetPort(port) ? OFFSET_PORT_PENALTY : 0),
    }));
}

function directCandidates(startPort, endPort, info) {
  if (startPort.axis !== endPort.axis) return [];
  if (startPort.sign !== -endPort.sign) return [];
  if (startPort.axis === 'H' && Math.abs(startPort.pt.y - endPort.pt.y) > EPS) return [];
  if (startPort.axis === 'V' && Math.abs(startPort.pt.x - endPort.pt.x) > EPS) return [];
  const startStub = stubPoint(startPort, terminalStubLength(info.edge, 'start'));
  const endStub = stubPoint(endPort, terminalStubLength(info.edge, 'end'));
  const axisDelta = startPort.axis === 'H'
    ? endStub.x - startStub.x
    : endStub.y - startStub.y;
  if (Math.sign(axisDelta) !== startPort.sign) return [];
  return [cleanPathPreservingTerminalStubs([
    ...startAnchorPoints(startPort),
    startStub,
    endStub,
    ...endAnchorPoints(endPort),
  ])];
}

function orthogonalCandidates(startPort, endPort, info, ctx, extraLanes = null) {
  const startStub = stubPoint(startPort, terminalStubLength(info.edge, 'start'));
  const endStub = stubPoint(endPort, terminalStubLength(info.edge, 'end'));
  const prefix = [...startAnchorPoints(startPort), startStub];
  const suffix = [endStub, ...endAnchorPoints(endPort)];
  const candidates = [];

  candidates.push(cleanPathPreservingTerminalStubs([...prefix, { x: endStub.x, y: startStub.y }, ...suffix]));
  candidates.push(cleanPathPreservingTerminalStubs([...prefix, { x: startStub.x, y: endStub.y }, ...suffix]));

  const globalLanes = globalEscapeLanes(ctx);
  const xs = [
    startStub.x,
    endStub.x,
    info.startBox.left - 40,
    info.startBox.right + 40,
    info.endBox.left - 40,
    info.endBox.right + 40,
    ...globalLanes.xs,
    ...(extraLanes?.xs || []),
  ];
  const ys = [
    startStub.y,
    endStub.y,
    info.startBox.top - 40,
    info.startBox.bottom + 40,
    info.endBox.top - 40,
    info.endBox.bottom + 40,
    ...globalLanes.ys,
    ...(extraLanes?.ys || []),
  ];
  const xLanes = uniqueSnapped(xs);
  const yLanes = uniqueSnapped(ys);
  const xRouteLanes = extraLanes?.detour ? xLanes : nearestLanes(xLanes, [startStub.x, endStub.x], 8);
  const yRouteLanes = extraLanes?.detour ? yLanes : nearestLanes(yLanes, [startStub.y, endStub.y], 8);
  const xDetourLanes = nearestLanes(xLanes, [startStub.x, endStub.x], 6);
  const yDetourLanes = nearestLanes(yLanes, [startStub.y, endStub.y], 6);
  for (const x of xRouteLanes) {
    candidates.push(cleanPathPreservingTerminalStubs([...prefix, { x, y: startStub.y }, { x, y: endStub.y }, ...suffix]));
  }
  for (const y of yRouteLanes) {
    candidates.push(cleanPathPreservingTerminalStubs([...prefix, { x: startStub.x, y }, { x: endStub.x, y }, ...suffix]));
  }
  if (extraLanes?.detour) {
    for (const x of xDetourLanes) {
      for (const y of yDetourLanes) {
        candidates.push(cleanPathPreservingTerminalStubs([
          ...prefix,
          { x, y: startStub.y },
          { x, y },
          { x: endStub.x, y },
          ...suffix,
        ]));
        candidates.push(cleanPathPreservingTerminalStubs([
          ...prefix,
          { x: startStub.x, y },
          { x, y },
          { x, y: endStub.y },
          ...suffix,
        ]));
      }
    }
  }

  return candidates.filter(pts => pts.length >= 2 && isOrthogonal(pts));
}

function globalEscapeLanes(ctx) {
  const b = ctx?.bounds || { left: 0, right: 0, top: 0, bottom: 0 };
  return {
    xs: [b.left - 60, b.left - 100, b.right + 60, b.right + 100],
    ys: [b.top - 60, b.top - 100, b.bottom + 60, b.bottom + 100],
  };
}

function lanesFromLines(lines, ctx) {
  const xs = [];
  const ys = [];
  const verticalXs = [];
  const horizontalYs = [];

  for (const line of lines || []) {
    if (Math.abs(line.a.x - line.b.x) < EPS) {
      verticalXs.push(line.a.x);
      xs.push(line.a.x - 40, line.a.x + 40);
    }
    if (Math.abs(line.a.y - line.b.y) < EPS) {
      horizontalYs.push(line.a.y);
      ys.push(line.a.y - 40, line.a.y + 40);
    }
  }

  if (verticalXs.length > 0) {
    const minX = Math.min(...verticalXs);
    const maxX = Math.max(...verticalXs);
    xs.push(minX - 40, minX - 80, maxX + 40, maxX + 80);
  }
  if (horizontalYs.length > 0) {
    const minY = Math.min(...horizontalYs);
    const maxY = Math.max(...horizontalYs);
    ys.push(minY - 40, minY - 80, maxY + 40, maxY + 80);
  }

  const global = globalEscapeLanes(ctx);
  return {
    xs: [...xs, ...global.xs],
    ys: [...ys, ...global.ys],
  };
}

function nodeComfortLanes(ctx) {
  const xs = [];
  const ys = [];
  for (const obstacle of ctx?.obstacles || []) {
    xs.push(obstacle.vLeft - PREFERRED_CLEARANCE, obstacle.vRight + PREFERRED_CLEARANCE);
    ys.push(obstacle.vTop - PREFERRED_CLEARANCE, obstacle.vBottom + PREFERRED_CLEARANCE);
  }
  return { xs, ys };
}

function lanesForRouteOptimization(route, otherLines, ctx) {
  const base = lanesFromLines(otherLines, ctx);
  const xs = [...base.xs];
  const ys = [...base.ys];
  const currentLines = collectLines(route);
  for (const current of currentLines) {
    xs.push(current.a.x, current.b.x);
    ys.push(current.a.y, current.b.y);
    for (const other of otherLines) {
      const point = segmentIntersectionPoint(current.a, current.b, other.a, other.b);
      if (!point) continue;
      xs.push(point.x - 40, point.x + 40);
      ys.push(point.y - 40, point.y + 40);
      if (Math.abs(other.a.x - other.b.x) < EPS) xs.push(other.a.x - 40, other.a.x + 40);
      if (Math.abs(other.a.y - other.b.y) < EPS) ys.push(other.a.y - 40, other.a.y + 40);
    }
  }
  const global = globalEscapeLanes(ctx);
  return { xs: [...xs, ...global.xs], ys: [...ys, ...global.ys], detour: true };
}

function measureRoute(pts, info, startPort, endPort, ctx, occupiedLines, options = {}) {
  if (!isOrthogonal(pts)) return null;
  if (hasBacktrackingSegment(pts)) return null;
  if (!terminalSegmentsFit(pts, info.edge)) return null;
  let crossings = 0;
  let overlaps = 0;
  let clearancePenalty = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if (segmentViolatesNodeClearance(a, b, info, ctx, i, pts.length - 1)) return null;
    clearancePenalty += nodeClearancePenalty(a, b, info, ctx, i, pts.length - 1);
    for (const line of occupiedLines) {
      if (segmentsOverlap(a, b, line.a, line.b)) {
        if (!canMergeDecisionFanIn(info, line, i, pts.length - 1)) return null;
        overlaps += 1;
      }
      if (segmentsTouchAtInteriorPoint(a, b, line.a, line.b)) {
        if (!canMergeDecisionFanIn(info, line, i, pts.length - 1)) return null;
      }
      if (segmentsCross(a, b, line.a, line.b)) {
        crossings += 1;
      }
      clearancePenalty += lineClearancePenalty(a, b, line);
    }
  }
  const bends = countBends(pts);
  const length = pathLength(pts);
  const portPenalty = (startPort.routerPenalty || 0) + (endPort.routerPenalty || 0);
  return {
    crossings,
    overlaps,
    clearancePenalty,
    bends,
    length,
    portPenalty,
    scalar: crossings * 1000000 + overlaps * 100000 + clearancePenalty * 100 + bends * 10000 + length + portPenalty,
  };
}

function compareRouteMetrics(a, b) {
  return a.crossings - b.crossings
    || a.overlaps - b.overlaps
    || a.bends - b.bends
    || a.portPenalty - b.portPenalty
    || compareLengthAndClearance(a, b);
}

function compareLengthAndClearance(a, b) {
  const lengthDelta = a.length - b.length;
  const clearanceDelta = (a.clearancePenalty || 0) - (b.clearancePenalty || 0);
  if (clearanceDelta && Math.abs(lengthDelta) <= COMFORT_CLEARANCE_LENGTH_BUDGET) {
    return clearanceDelta;
  }
  return lengthDelta || clearanceDelta;
}

function applyDecisionFanInGrouping(result, edgeInfos) {
  const incoming = new Map();
  for (const info of edgeInfos) {
    if (info.endNode?.type !== 'rhombus') continue;
    const key = `${info.endNode.id}:${edgeStyleKey(info.edge)}`;
    if (!incoming.has(key)) incoming.set(key, []);
    incoming.get(key).push(info);
  }

  for (const infos of incoming.values()) {
    if (infos.length < 2) continue;
    const dir = chooseDecisionFanInDir(infos, infos[0].endBox);
    const entry = sidePoint(infos[0].endBox, dir);
    const merge = mergePoint(entry, dir);
    const carrier = chooseCarrier(infos, result, merge);
    if (!carrier) continue;

    for (const info of infos) {
      const path = result[info.edge.id];
      if (!path?.pts?.length || path.isFallback) continue;
      const isCarrier = info.edge.id === carrier.edge.id;
      const start = path.pts[0];
      const sourceTerminal = path.pts[1] || start;
      const groupedPts = cleanDuplicatePoints([
        start,
        sourceTerminal,
        axisFirstPoint(sourceTerminal, merge),
        merge,
        ...(isCarrier ? [entry] : []),
      ]);
      result[info.edge.id] = {
        ...path,
        pts: groupedPts,
        pathD: pathFromPts(groupedPts, { fanInJoinDir: dir }),
        groupedFanIn: true,
        fanInCarrier: isCarrier,
        fanInJoinDir: dir,
        suppressMarkerEnd: !isCarrier,
      };
    }
  }
}

function applyVisualBreaks(result, edgeInfos) {
  const routes = new Map();
  const routeOrder = new Map(edgeInfos.map((info, index) => [String(info.edge.id), index]));
  for (const info of edgeInfos) {
    const path = result[info.edge.id];
    if (!path?.pts?.length || path.isFallback) continue;
    assignFlowchartLabelData(path, info.edge);
    routes.set(String(info.edge.id), {
      edge: info.edge,
      info,
      pts: path.pts,
      textPathD: path.textPathD,
      labelPlacement: path.manualLabelPlacement,
      isFallback: path.isFallback,
      sourceId: String(info.edge.from),
      targetId: String(info.edge.to),
    });
  }
  const breakPlan = buildBreakPlan(routes, routeOrder);
  for (const info of edgeInfos) {
    const path = result[info.edge.id];
    if (!path?.pts?.length || path.isFallback) continue;
    path.pathD = pathFromPtsWithBreakPlan(path.pts, String(info.edge.id), breakPlan, {
      fanInJoinDir: path.groupedFanIn ? path.fanInJoinDir : null,
    });
  }
}

function chooseDecisionFanInDir(infos, endBox) {
  if (infos.some(info => info.startBox.cx < endBox.cx)) return 'Left';
  if (infos.some(info => info.startBox.cx > endBox.cx)) return 'Right';
  const avgX = infos.reduce((sum, info) => sum + info.startBox.cx, 0) / infos.length;
  const avgY = infos.reduce((sum, info) => sum + info.startBox.cy, 0) / infos.length;
  return Math.abs(avgX - endBox.cx) >= Math.abs(avgY - endBox.cy)
    ? (avgX < endBox.cx ? 'Left' : 'Right')
    : (avgY < endBox.cy ? 'Top' : 'Bottom');
}

function terminalSegmentsFit(pts, edge) {
  if (pts.length < 2) return false;
  const startRequired = terminalStubLength(edge, 'start');
  const endRequired = terminalStubLength(edge, 'end');
  if (segmentLen(pts[0], pts[1]) + EPS < startRequired) return false;
  if (segmentLen(pts[pts.length - 2], pts[pts.length - 1]) + EPS < endRequired) return false;
  return true;
}

function segmentLen(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function chooseCarrier(infos, result, merge) {
  let best = null;
  for (const info of infos) {
    const pts = result[info.edge.id]?.pts || [];
    if (!pts.length) continue;
    const d = Math.abs(pts[0].x - merge.x) + Math.abs(pts[0].y - merge.y);
    if (!best || d < best.d) best = { info, edge: info.edge, d };
  }
  return best;
}

function sidePoint(box, dir) {
  if (dir === 'Left') return { x: box.left, y: box.cy };
  if (dir === 'Right') return { x: box.right, y: box.cy };
  if (dir === 'Top') return { x: box.cx, y: box.top };
  return { x: box.cx, y: box.bottom };
}

function mergePoint(entry, dir) {
  const len = 40;
  if (dir === 'Left') return { x: entry.x - len, y: entry.y };
  if (dir === 'Right') return { x: entry.x + len, y: entry.y };
  if (dir === 'Top') return { x: entry.x, y: entry.y - len };
  return { x: entry.x, y: entry.y + len };
}

function axisFirstPoint(a, b) {
  return { x: b.x, y: a.y };
}

function edgeStyleKey(edge) {
  return `${edge?.lineStyle || 'solid'}:${edge?.connectionType || edge?.arrowType || 'target'}`;
}

function improveSharedNodeCrossings(routes, edgeInfos, ctx, occupiedPorts, occupiedLines) {
  for (let pass = 0; pass < 2; pass++) {
    const conflicts = findCrossings([...routes.values()]);
    let changed = false;
    for (const conflict of conflicts) {
      const nextRoutes = trySwapSharedNodePorts(conflict.a, conflict.b, routes, edgeInfos, ctx);
      if (!nextRoutes) continue;
      routes.set(String(conflict.a.edge.id), nextRoutes.a);
      routes.set(String(conflict.b.edge.id), nextRoutes.b);
      rebuildOccupancy(routes, occupiedPorts, occupiedLines, ctx);
      changed = true;
    }
    if (!changed) break;
  }
}

function trySwapSharedNodePorts(routeA, routeB, routes, edgeInfos, ctx) {
  const infoA = edgeInfos.find(info => String(info.edge.id) === String(routeA.edge.id));
  const infoB = edgeInfos.find(info => String(info.edge.id) === String(routeB.edge.id));
  if (!infoA || !infoB) return null;

  const shared = sharedNodePortRoles(routeA, routeB);
  if (!shared) return null;
  const portA = routeA[shared.roleA === 'start' ? 'startPort' : 'endPort'];
  const portB = routeB[shared.roleB === 'start' ? 'startPort' : 'endPort'];
  if (!portA || !portB || portKey(portA) === portKey(portB)) return null;

  const otherLines = linesExcept(routes, routeA, routeB, ctx);
  const occupiedWithoutPair = occupiedPortsExcept(routes, routeA, routeB);
  const oldPair = scoreRoutePair(routeA, routeB, ctx, otherLines);
  if (!oldPair) return null;

  const swappedPair = bestSwappedRoutePair(infoA, routeA, shared.roleA, portB, infoB, routeB, shared.roleB, portA, ctx, otherLines, occupiedWithoutPair);
  if (!swappedPair) return null;

  const { nextA, nextB, metrics: newPair } = swappedPair;
  if (!newPair) return null;
  return compareRouteMetrics(newPair, oldPair) < 0 ? { a: nextA, b: nextB } : null;
}

function rotateNodePortsIfBetter(routes, edgeInfos, ctx, occupiedPorts, occupiedLines) {
  // First implementation placeholder: the route representation is now rich enough
  // for local port rotation, but we keep this phase conservative until conflicts
  // expose a concrete profitable rotation case.
}

function improveNonDirectRoutes(routes, edgeInfos, ctx, occupiedPorts, occupiedLines) {
  const seenRouteStates = new Map();

  for (let pass = 0; pass < MAX_ROUTE_OPTIMIZATION_PASSES; pass++) {
    let changed = false;
    const queue = routeOptimizationQueue(routes).slice(0, 1);

    for (const item of queue) {
      const currentRoute = routes.get(String(item.route.edge.id));
      if (!currentRoute || currentRoute.isFallback || isStraightRoute(currentRoute)) continue;
      const currentStats = routeCrossingStats(routes).get(String(currentRoute.edge.id));
      const currentScore = {
        route: currentRoute,
        crossings: currentStats?.crossings || 0,
        clearancePenalty: currentRoute.metrics?.clearancePenalty || 0,
        bends: countBends(currentRoute.pts || []),
        length: pathLength(currentRoute.pts || []),
      };
      const info = edgeInfos.find(edgeInfo => String(edgeInfo.edge.id) === String(currentRoute.edge.id));
      if (!info) continue;

      const routeId = String(currentRoute.edge.id);
      if (!seenRouteStates.has(routeId)) seenRouteStates.set(routeId, new Set([routeSignature(currentRoute)]));
      const next = bestAlternativeForRoute(info, currentRoute, routes, ctx, currentScore, seenRouteStates.get(routeId));
      if (!next) continue;

      routes.set(routeId, next);
      seenRouteStates.get(routeId).add(routeSignature(next));
      rebuildOccupancy(routes, occupiedPorts, occupiedLines, ctx);
      changed = true;
      break;
    }

    if (!changed) break;
  }
}

function routeOptimizationQueue(routes) {
  const stats = routeCrossingStats(routes);
  return [...routes.values()]
    .filter(route => !route.isFallback)
    .map(route => ({
      route,
      crossings: stats.get(String(route.edge.id))?.crossings || 0,
      bends: countBends(route.pts || []),
      length: pathLength(route.pts || []),
    }))
    .filter(item => !isStraightRoute(item.route))
    .filter(item => item.crossings > 0)
    .sort((a, b) => b.crossings - a.crossings || b.bends - a.bends || b.length - a.length);
}

function improveRouteClearance(routes, ctx) {
  for (const route of routes.values()) {
    if (route.isFallback || isStraightRoute(route)) continue;
    const otherLines = linesExceptOne(routes, route, ctx);
    const currentScore = measureRoute(route.pts, route.info, route.startPort, route.endPort, ctx, otherLines);
    if (!currentScore) continue;
    const extraLanes = comfortLanesForRoute(otherLines, ctx);
    let best = null;

    for (const pts of candidatePathsForPorts(route.info, route.startPort, route.endPort, ctx, extraLanes)) {
      const metrics = measureRoute(pts, route.info, route.startPort, route.endPort, ctx, otherLines);
      if (!metrics) continue;
      if (!routeKeepsHardQuality(metrics, currentScore)) continue;
      if (compareLengthAndClearance(metrics, currentScore) >= 0) continue;
      if (!best || compareRouteMetrics(metrics, best.metrics) < 0) {
        best = { ...route, pts, metrics, score: metrics.scalar };
      }
    }

    if (best) routes.set(String(route.edge.id), best);
  }
}

function routeKeepsHardQuality(metrics, currentScore) {
  if (metrics.crossings > currentScore.crossings) return false;
  if (metrics.overlaps > currentScore.overlaps) return false;
  if (metrics.bends > currentScore.bends) return false;
  return true;
}

function comfortLanesForRoute(otherLines, ctx) {
  const nodeLanes = nodeComfortLanes(ctx);
  const lineLanes = lanesFromLines(otherLines, ctx);
  return {
    xs: [...nodeLanes.xs, ...lineLanes.xs],
    ys: [...nodeLanes.ys, ...lineLanes.ys],
  };
}

function bestAlternativeForRoute(info, currentRoute, routes, ctx, currentScore, seenRouteStates) {
  const otherLines = linesExceptOne(routes, currentRoute, ctx);
  const extraLanes = lanesForRouteOptimization(currentRoute, otherLines, ctx);
  const occupiedWithoutRoute = occupiedPortsExceptOne(routes, currentRoute);
  const startPorts = availablePorts(info.startNode, info.startBox, ctx, occupiedWithoutRoute, 'start');
  const endPorts = availablePorts(info.endNode, info.endBox, ctx, occupiedWithoutRoute, 'end');
  let best = null;

  for (const startPort of startPorts) {
    for (const endPort of endPorts) {
      for (const pts of candidatePathsForPorts(info, startPort, endPort, ctx, extraLanes)) {
        const candidate = makeRouteForPorts(info, pts, startPort, endPort);
        const metrics = measureRoute(candidate.pts, candidate.info, candidate.startPort, candidate.endPort, ctx, otherLines);
        if (!metrics) continue;
        const next = { ...candidate, metrics, score: metrics.scalar };
        if (seenRouteStates?.has(routeSignature(next))) continue;
        if (!best || compareWorstRouteAlternative(next.metrics, best.metrics, currentScore) < 0) {
          best = next;
        }
      }
    }
  }

  if (!best) return null;
  return routeImprovesWorstScore(best.metrics, currentScore) ? best : null;
}

function compareWorstRouteAlternative(a, b, currentScore) {
  if ((currentScore?.crossings || 0) > 0) {
    return a.crossings - b.crossings
      || compareLengthAndClearance(a, b)
      || a.bends - b.bends
      || a.overlaps - b.overlaps
      || a.portPenalty - b.portPenalty;
  }
  return a.crossings - b.crossings
    || a.bends - b.bends
    || compareLengthAndClearance(a, b)
    || a.overlaps - b.overlaps
    || a.portPenalty - b.portPenalty;
}

function routeImprovesWorstScore(metrics, currentScore) {
  if (metrics.crossings < currentScore.crossings) return true;
  if (metrics.crossings > currentScore.crossings) return false;
  if (currentScore.crossings <= 0) {
    if (metrics.bends < currentScore.bends) return true;
    if (metrics.bends > currentScore.bends) return false;
    if (compareLengthAndClearance(metrics, currentScore) < 0) return true;
    if (compareLengthAndClearance(metrics, currentScore) > 0) return false;
    return metrics.clearancePenalty < (currentScore.clearancePenalty || 0);
  }
  if (compareLengthAndClearance(metrics, currentScore) < 0) return true;
  if (compareLengthAndClearance(metrics, currentScore) > 0) return false;
  return metrics.bends < currentScore.bends;
}

function isStraightRoute(route) {
  return countBends(route?.pts || []) === 0;
}

function routeSignature(route) {
  return (route.pts || [])
    .map(pt => `${Math.round(pt.x * 10) / 10},${Math.round(pt.y * 10) / 10}`)
    .join(';');
}

function bestRouteWithPorts(info, startPort, endPort, ctx, occupiedLines) {
  let best = null;
  const candidates = candidatePathsForPorts(info, startPort, endPort, ctx);
  for (const pts of candidates) {
    const metrics = measureRoute(pts, info, startPort, endPort, ctx, occupiedLines);
    if (!metrics) continue;
    if (!best || compareRouteMetrics(metrics, best.metrics) < 0) {
      best = {
        edge: info.edge,
        info,
        pts,
        startPort,
        endPort,
        score: metrics.scalar,
        metrics,
        sourceId: String(info.edge.from),
        targetId: String(info.edge.to),
      };
    }
  }
  return best;
}

function bestSwappedRoutePair(infoA, routeA, roleA, portA, infoB, routeB, roleB, portB, ctx, otherLines, occupiedPorts) {
  const choicesA = swappedRoutePortChoices(infoA, roleA, portA, ctx, occupiedPorts);
  const choicesB = swappedRoutePortChoices(infoB, roleB, portB, ctx, occupiedPorts);
  let best = null;

  for (const startPortA of choicesA.startPorts) {
    for (const endPortA of choicesA.endPorts) {
      for (const ptsA of candidatePathsForPorts(infoA, startPortA, endPortA, ctx)) {
        const nextA = makeRouteForPorts(infoA, ptsA, startPortA, endPortA);
        const metricsA = measureRoute(nextA.pts, nextA.info, nextA.startPort, nextA.endPort, ctx, otherLines);
        if (!metricsA) continue;
        const linesAfterA = [...otherLines, ...collectRoutingLines(nextA, ctx)];

        for (const startPortB of choicesB.startPorts) {
          for (const endPortB of choicesB.endPorts) {
            for (const ptsB of candidatePathsForPorts(infoB, startPortB, endPortB, ctx)) {
              const nextB = makeRouteForPorts(infoB, ptsB, startPortB, endPortB);
              if (routesHavePortConflict(nextA, nextB)) continue;
              const metricsB = measureRoute(nextB.pts, nextB.info, nextB.startPort, nextB.endPort, ctx, linesAfterA);
              if (!metricsB) continue;
              const metrics = addRouteMetrics(metricsA, metricsB);
              if (!best || compareRouteMetrics(metrics, best.metrics) < 0) {
                best = {
                  nextA: { ...nextA, metrics: metricsA, score: metricsA.scalar },
                  nextB: { ...nextB, metrics: metricsB, score: metricsB.scalar },
                  metrics,
                };
              }
            }
          }
        }
      }
    }
  }

  return best;
}

function swappedRoutePortChoices(info, fixedRole, fixedPort, ctx, occupiedPorts) {
  if (fixedRole === 'start') {
    return {
      startPorts: [fixedPort],
      endPorts: availablePorts(info.endNode, info.endBox, ctx, occupiedPorts, 'end'),
    };
  }
  return {
    startPorts: availablePorts(info.startNode, info.startBox, ctx, occupiedPorts, 'start'),
    endPorts: [fixedPort],
  };
}

function candidatePathsForPorts(info, startPort, endPort, ctx, extraLanes = null) {
  return [
    ...directCandidates(startPort, endPort, info),
    ...orthogonalCandidates(startPort, endPort, info, ctx, extraLanes),
  ];
}

function makeRouteForPorts(info, pts, startPort, endPort) {
  return {
    edge: info.edge,
    info,
    pts,
    startPort,
    endPort,
    sourceId: String(info.edge.from),
    targetId: String(info.edge.to),
  };
}

function sharedNodePortRoles(routeA, routeB) {
  if (routeA.sourceId === routeB.sourceId) return { roleA: 'start', roleB: 'start' };
  if (routeA.targetId === routeB.targetId) return { roleA: 'end', roleB: 'end' };
  if (routeA.sourceId === routeB.targetId) return { roleA: 'start', roleB: 'end' };
  if (routeA.targetId === routeB.sourceId) return { roleA: 'end', roleB: 'start' };
  return null;
}

function linesExcept(routes, routeA, routeB, ctx) {
  const skip = new Set([String(routeA.edge.id), String(routeB.edge.id)]);
  const out = [];
  for (const route of routes.values()) {
    if (skip.has(String(route.edge.id)) || route.isFallback) continue;
    collectRoutingLines(route, ctx).forEach(line => out.push(line));
  }
  return out;
}

function linesExceptOne(routes, skipRoute, ctx) {
  const out = [];
  const skipId = String(skipRoute.edge.id);
  for (const route of routes.values()) {
    if (String(route.edge.id) === skipId || route.isFallback) continue;
    collectRoutingLines(route, ctx).forEach(line => out.push(line));
  }
  return out;
}

function occupiedPortsExcept(routes, routeA, routeB) {
  const skip = new Set([String(routeA.edge.id), String(routeB.edge.id)]);
  const occupied = new Map();
  for (const route of routes.values()) {
    if (skip.has(String(route.edge.id)) || route.isFallback) continue;
    reserveRoutePorts(occupied, route);
  }
  return occupied;
}

function occupiedPortsExceptOne(routes, skipRoute) {
  const occupied = new Map();
  const skipId = String(skipRoute.edge.id);
  for (const route of routes.values()) {
    if (String(route.edge.id) === skipId || route.isFallback) continue;
    reserveRoutePorts(occupied, route);
  }
  return occupied;
}

function routesHavePortConflict(routeA, routeB) {
  const portsA = routePorts(routeA);
  const portsB = routePorts(routeB);
  return portsA.some(a => portsB.some(b => (
    a.nodeId === b.nodeId
    && a.key === b.key
    && !canShareRoutePort(a, b)
  )));
}

function routePorts(route) {
  return [
    { nodeId: route.sourceId, key: portKey(route.startPort), role: 'start', route },
    { nodeId: route.targetId, key: portKey(route.endPort), role: 'end', route },
  ];
}

function canShareRoutePort(a, b) {
  return a.role === 'end'
    && b.role === 'end'
    && a.route.info.endNode.type === 'rhombus'
    && b.route.info.endNode.type === 'rhombus';
}

function scoreRoutePair(routeA, routeB, ctx, otherLines) {
  const first = measureRoute(routeA.pts, routeA.info, routeA.startPort, routeA.endPort, ctx, otherLines);
  if (!first) return null;
  const second = measureRoute(routeB.pts, routeB.info, routeB.startPort, routeB.endPort, ctx, [...otherLines, ...collectRoutingLines(routeA, ctx)]);
  if (!second) return null;
  return addRouteMetrics(first, second);
}

function addRouteMetrics(a, b) {
  return {
    crossings: a.crossings + b.crossings,
    overlaps: a.overlaps + b.overlaps,
    clearancePenalty: (a.clearancePenalty || 0) + (b.clearancePenalty || 0),
    bends: a.bends + b.bends,
    length: a.length + b.length,
    portPenalty: a.portPenalty + b.portPenalty,
    scalar: a.scalar + b.scalar,
  };
}

function commitRoute(route, routes, occupiedPorts, occupiedLines, ctx) {
  routes.set(String(route.edge.id), route);
  reserveRoutePorts(occupiedPorts, route);
  collectRoutingLines(route, ctx).forEach(line => occupiedLines.push(line));
}

function rebuildOccupancy(routes, occupiedPorts, occupiedLines, ctx) {
  occupiedPorts.clear();
  occupiedLines.length = 0;
  for (const route of routes.values()) {
    if (route.isFallback) continue;
    reserveRoutePorts(occupiedPorts, route);
    collectRoutingLines(route, ctx).forEach(line => occupiedLines.push(line));
  }
}

function collectLines(route) {
  const out = [];
  const pts = route.pts || [];
  for (let i = 0; i < pts.length - 1; i++) {
    out.push({
      edgeId: String(route.edge.id),
      index: i,
      route,
      a: pts[i],
      b: pts[i + 1],
      sourceId: route.sourceId,
      targetId: route.targetId,
      protectedArrow: segmentIsProtectedArrow(route.edge, i, pts.length - 1),
    });
  }
  return out;
}

function collectRoutingLines(route, ctx) {
  const pts = normalizedRoutingPts(route, ctx) || route.pts || [];
  return collectLines({ ...route, pts });
}

function normalizedRoutingPts(route, ctx) {
  const plan = decisionFanInPlanForRoute(route, ctx);
  if (!plan) return null;
  const pts = route.pts || [];
  if (pts.length < 2) return pts;
  const start = pts[0];
  const sourceTerminal = pts[1] || start;
  return cleanDuplicatePoints([
    start,
    sourceTerminal,
    axisFirstPoint(sourceTerminal, plan.merge),
    plan.merge,
  ]);
}

function decisionFanInPlanForRoute(route, ctx) {
  if (route.info?.endNode?.type !== 'rhombus') return null;
  return ctx?.fanInPlans?.get(decisionFanInKey(route.targetId, route.edge)) || null;
}

function reservePort(occupiedPorts, nodeId, port) {
  if (!port) return;
  const key = String(nodeId);
  if (!occupiedPorts.has(key)) occupiedPorts.set(key, new Set());
  occupiedPorts.get(key).add(portKey(port));
}

function reserveRoutePorts(occupiedPorts, route) {
  reservePort(occupiedPorts, route.sourceId, route.startPort);
  if (route.info?.endNode?.type === 'rhombus') {
    reserveDecisionFanInPort(occupiedPorts, route);
    return;
  }
  reservePort(occupiedPorts, route.targetId, route.endPort);
}

function reserveDecisionFanInPort(occupiedPorts, route) {
  if (!route.endPort) return;
  const key = String(route.targetId);
  if (!occupiedPorts.has(key)) occupiedPorts.set(key, new Set());
  const used = occupiedPorts.get(key);
  const fanInKey = `__decision_fanin:${edgeStyleKey(route.edge)}`;
  if (used.has(fanInKey)) return;
  used.add(fanInKey);
  used.add(portKey(route.endPort));
}

function buildCenterFallback(info, reason) {
  return {
    edge: info.edge,
    info,
    pts: [{ x: info.startBox.cx, y: info.startBox.cy }, { x: info.endBox.cx, y: info.endBox.cy }],
    isFallback: true,
    routeError: reason,
    sourceId: String(info.edge.from),
    targetId: String(info.edge.to),
  };
}

function toPathResult(route, info, edgeInfos, routes) {
  const pts = route.pts || [];
  const pathD = pathFromPtsWithBreaks(pts, String(route.edge.id), routes, edgeInfos);
  const segments = routeSegments(pts);
  const text = chooseTextPath(routeSegments(labelPtsForRoute(pts, info.edge)), info.edge);
  const result = {
    pts,
    pathD,
    textPathD: text.d,
    textPathLen: text.len,
    isFallback: route.isFallback || undefined,
    routeError: route.routeError,
    _genInfo: {
      cleanPts: pts,
      chosenStartPt: route.startPort?.anchorPt || route.startPort?.pt || pts[0],
      chosenEndPt: route.endPort?.anchorPt || route.endPort?.pt || pts[pts.length - 1],
      totalLength: pathLength(pts),
      segments,
      routeOrder: edgeInfos.indexOf(info),
    },
  };
  assignFlowchartLabelData(result, info.edge);
  return result;
}

function pathFromPts(pts, options = {}) {
  if (!pts.length) return '';
  return roundedPathFromPts(pts, () => '', options);
}

function pathFromPtsWithBreaks(pts, edgeId, routes, edgeInfos) {
  if (!pts.length) return '';
  const routeOrder = new Map(edgeInfos.map((info, index) => [String(info.edge.id), index]));
  const currentOrder = routeOrder.get(String(edgeId)) ?? 0;
  const otherLines = [...routes.values()]
    .filter(route => !route.isFallback && String(route.edge.id) !== String(edgeId))
    .flatMap(route => collectLines(route).map(line => ({
      ...line,
      routeOrder: routeOrder.get(String(route.edge.id)) ?? 0,
    })));
  return roundedPathFromPts(pts, (a, b, i) => {
    const currentProtectedArrow = segmentIsProtectedArrow(routes.get(String(edgeId))?.edge, i, pts.length - 1);
    return segmentPathWithBreaks(a, b, otherLines, currentOrder, currentProtectedArrow);
  });
}

function buildBreakPlan(routes, routeOrder) {
  const lines = [...routes.values()].flatMap(route => collectLines(route).map(line => ({
    ...line,
    textPathD: route.textPathD,
    labelPlacement: route.labelPlacement,
    routeOrder: routeOrder.get(String(route.edge.id)) ?? 0,
  })));
  const plan = new Map();

  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      const a = lines[i];
      const b = lines[j];
      if (a.edgeId === b.edgeId) continue;
      const point = segmentIntersectionPoint(a.a, a.b, b.a, b.b);
      if (!point) continue;
      const aHasLabelHere = labelPlacementContainsPoint(a.labelPlacement, point);
      const bHasLabelHere = labelPlacementContainsPoint(b.labelPlacement, point);
      const breaker = chooseBreakLine(a, b, aHasLabelHere, bHasLabelHere);
      if (!breaker) continue;
      const labelLine = aHasLabelHere ? a : (bHasLabelHere ? b : null);
      const protectedLine = a.protectedArrow ? a : (b.protectedArrow ? b : null);
      const gaps = breakGapsForCrossing(breaker, labelLine, point, protectedLine);
      addBreakCut(plan, breaker.edgeId, breaker.index, point, gaps, breaker === a ? b.edgeId : a.edgeId);
    }
  }

  return plan;
}

function chooseBreakLine(a, b, aHasLabelHere = false, bHasLabelHere = false) {
  if (aHasLabelHere && !bHasLabelHere) return b;
  if (bHasLabelHere && !aHasLabelHere) return a;
  if (a.protectedArrow) return b;
  if (b.protectedArrow) return a;
  return a.routeOrder >= b.routeOrder ? a : b;
}

function assignFlowchartLabelData(path, edge) {
  if (!path || !edge?.label) {
    if (path) {
      path.manualLabelPlacement = null;
      path.displayLabel = edge?.label || null;
    }
    return path;
  }
  const labelData = getFlowchartRouteLabelData(edge, path.pts || []);
  path.displayLabel = labelData.displayLabel;
  path.manualLabelPlacement = labelData.placement;
  return path;
}

function getFlowchartRouteLabelData(edge, pts) {
  if (!edge?.label) return null;
  const labelPts = labelPtsForRoute(pts, edge);
  const labelPolicy = getEdgeLabelPolicy('flowchart');
  const labelStyle = getEdgeLabelStyle(labelPolicy);
  const displayLabel = getFittedManualEdgeLabel({
    labelPolicy,
    displayLabel: edge.label,
    pts: labelPts,
    labelStyle,
  });
  if (!displayLabel) return { displayLabel: null, placement: null };
  const placement = getManualEdgeLabelPlacement({
    labelPolicy,
    displayLabel,
    pts: labelPts,
    labelStyle,
  });
  return { displayLabel, placement };
}

function labelPtsForRoute(pts, edge) {
  if (!Array.isArray(pts) || pts.length < 2) return pts || [];
  if (pointsAreCollinear(pts)) {
    let start = pts[0];
    let end = pts[pts.length - 1];
    if (edgeHasStartMarker(edge)) start = pointToward(start, end, ARROW_MARKER_LENGTH);
    if (edgeHasEndMarker(edge)) end = pointToward(end, start, ARROW_MARKER_LENGTH);
    return cleanDuplicatePoints([start, end]);
  }
  if (pts.length < 4) return pts;
  const out = pts.slice(1, -1);
  if (areCollinear(pts[0], pts[1], pts[2])) out[0] = pts[0];
  if (!edgeHasEndMarker(edge) && areCollinear(pts[pts.length - 3], pts[pts.length - 2], pts[pts.length - 1])) {
    out[out.length - 1] = pts[pts.length - 1];
  }
  return out.length >= 2 ? out : pts;
}

function areCollinear(a, b, c) {
  if (!a || !b || !c) return false;
  return (Math.abs(a.x - b.x) < EPS && Math.abs(b.x - c.x) < EPS)
    || (Math.abs(a.y - b.y) < EPS && Math.abs(b.y - c.y) < EPS);
}

function hasBacktrackingSegment(pts) {
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const c = pts[i + 1];
    const abH = Math.abs(a.y - b.y) < EPS;
    const bcH = Math.abs(b.y - c.y) < EPS;
    const abV = Math.abs(a.x - b.x) < EPS;
    const bcV = Math.abs(b.x - c.x) < EPS;
    if (abH && bcH && Math.sign(b.x - a.x) !== Math.sign(c.x - b.x)) return true;
    if (abV && bcV && Math.sign(b.y - a.y) !== Math.sign(c.y - b.y)) return true;
  }
  return false;
}

function pointsAreCollinear(pts) {
  const first = pts[0];
  const last = pts[pts.length - 1];
  if (!first || !last) return false;
  const horizontal = Math.abs(first.y - last.y) < EPS;
  const vertical = Math.abs(first.x - last.x) < EPS;
  if (!horizontal && !vertical) return false;
  return pts.every(pt => horizontal ? Math.abs(pt.y - first.y) < EPS : Math.abs(pt.x - first.x) < EPS);
}

function pointToward(from, to, distance) {
  const len = Math.abs(to.x - from.x) + Math.abs(to.y - from.y);
  if (len < EPS) return from;
  const step = Math.min(distance, len);
  return {
    x: from.x + Math.sign(to.x - from.x) * step,
    y: from.y + Math.sign(to.y - from.y) * step,
  };
}

function labelPlacementContainsPoint(placement, point) {
  if (!placement || !point) return false;
  const pad = Math.max(4, EDGE_LABEL_STYLE.haloWidth || 0);
  const angle = -(placement.angle || 0) * Math.PI / 180;
  const cx = placement.boxCenterX ?? placement.x;
  const cy = placement.boxCenterY ?? placement.y;
  const dx = point.x - cx;
  const dy = point.y - cy;
  const localX = dx * Math.cos(angle) - dy * Math.sin(angle);
  const localY = dx * Math.sin(angle) + dy * Math.cos(angle);
  return Math.abs(localX) <= placement.labelWidth / 2 + pad
    && Math.abs(localY) <= placement.labelHeight / 2 + pad;
}

function parseLinePath(pathD) {
  const match = /^M\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+L\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)$/.exec(pathD || '');
  if (!match) return null;
  return {
    a: { x: Number(match[1]), y: Number(match[2]) },
    b: { x: Number(match[3]), y: Number(match[4]) },
  };
}

function breakGapsForCrossing(breaker, labelLine, point, protectedLine = null) {
  const tiny = 6;
  const arrowClearance = 16;
  if (!labelLine) {
    return protectedLine
      ? { beforeGap: arrowClearance, afterGap: arrowClearance }
      : { beforeGap: tiny, afterGap: tiny };
  }

  const labelVector = labelSideVector(labelLine, point);
  const breakerVector = segmentUnitVector(breaker.a, breaker.b);
  const labelClearance = Math.max(18, Math.ceil((EDGE_LABEL_STYLE.fontSize + EDGE_LABEL_STYLE.haloWidth * 2) / 2) + 6);
  const farClearance = protectedLine ? Math.max(labelClearance, arrowClearance) : labelClearance;
  const labelIsAfter = breakerVector.x * labelVector.x + breakerVector.y * labelVector.y > 0;
  return labelIsAfter
    ? { beforeGap: tiny, afterGap: farClearance }
    : { beforeGap: farClearance, afterGap: tiny };
}

function labelSideVector(labelLine, point) {
  if (labelLine?.labelPlacement) {
    const dx = (labelLine.labelPlacement.boxCenterX ?? labelLine.labelPlacement.x) - point.x;
    const dy = (labelLine.labelPlacement.boxCenterY ?? labelLine.labelPlacement.y) - point.y;
    const len = Math.hypot(dx, dy);
    if (len > EPS) return { x: dx / len, y: dy / len };
  }
  const segment = parseLinePath(labelLine.textPathD);
  if (!segment) return { x: 0, y: -1 };
  const dx = segment.b.x - segment.a.x;
  const dy = segment.b.y - segment.a.y;
  const len = Math.max(1, Math.hypot(dx, dy));
  const normal = { x: -dy / len, y: dx / len };
  const sign = Math.sign(EDGE_LABEL_STYLE.offsetY || -1) || -1;
  return { x: normal.x * sign, y: normal.y * sign };
}

function segmentUnitVector(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.max(1, Math.hypot(dx, dy));
  return { x: dx / len, y: dy / len };
}

function addBreakCut(plan, edgeId, index, point, gaps, otherEdgeId) {
  const key = `${edgeId}:${index}`;
  if (!plan.has(key)) plan.set(key, []);
  plan.get(key).push({ point, ...gaps, otherEdgeId });
}

function pathFromPtsWithBreakPlan(pts, edgeId, breakPlan, options = {}) {
  if (!pts.length) return '';
  return roundedPathFromPts(pts, (a, b, i) => (
    segmentPathWithPlannedBreaks(a, b, breakPlan.get(`${edgeId}:${i}`) || [])
  ), options);
}

function roundedPathFromPts(pts, drawSegment, options = {}) {
  if (!pts.length) return '';
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  let cursor = pts[0];

  for (let i = 1; i < pts.length - 1; i++) {
    const p1 = pts[i - 1];
    const p2 = pts[i];
    const p3 = pts[i + 1];
    const d1 = euclideanDistance(p1, p2);
    const d2 = euclideanDistance(p2, p3);
    const prevH = Math.abs(p1.y - p2.y) < EPS;
    const nextH = Math.abs(p2.y - p3.y) < EPS;
    const prevV = Math.abs(p1.x - p2.x) < EPS;
    const nextV = Math.abs(p2.x - p3.x) < EPS;
    const isTurn = (prevH && nextV) || (prevV && nextH);
    if (!isTurn || d1 < EPS || d2 < EPS) continue;

    const r = Math.min(FLOWCHART_CORNER_RADIUS, d1 / 2, d2 / 2);
    const qStart = {
      x: p2.x + ((p1.x - p2.x) / d1) * r,
      y: p2.y + ((p1.y - p2.y) / d1) * r,
    };
    const qEnd = {
      x: p2.x + ((p3.x - p2.x) / d2) * r,
      y: p2.y + ((p3.y - p2.y) / d2) * r,
    };
    d += drawSegment(cursor, qStart, i - 1) || ` L ${qStart.x} ${qStart.y}`;
    d += ` Q ${p2.x} ${p2.y} ${qEnd.x} ${qEnd.y}`;
    cursor = qEnd;
  }

  const terminalJoin = terminalFanInJoinCurve(pts, options.fanInJoinDir);
  if (terminalJoin) {
    d += drawSegment(cursor, terminalJoin.start, pts.length - 2) || ` L ${terminalJoin.start.x} ${terminalJoin.start.y}`;
    d += ` Q ${terminalJoin.control.x} ${terminalJoin.control.y} ${terminalJoin.end.x} ${terminalJoin.end.y}`;
    return d;
  }

  d += drawSegment(cursor, pts[pts.length - 1], pts.length - 2) || ` L ${pts[pts.length - 1].x} ${pts[pts.length - 1].y}`;
  return d;
}

function terminalFanInJoinCurve(pts, dir) {
  if (!dir || pts.length < 3) return null;
  const join = fanInJoinUnit(dir);
  if (!join) return null;
  const merge = pts[pts.length - 1];
  const prev = pts[pts.length - 2];
  const incomingLen = euclideanDistance(prev, merge);
  if (incomingLen < EPS) return null;
  const incoming = {
    x: (merge.x - prev.x) / incomingLen,
    y: (merge.y - prev.y) / incomingLen,
  };
  if (Math.abs(incoming.x * join.x + incoming.y * join.y) > 1 - EPS) return null;
  const r = Math.min(FLOWCHART_CORNER_RADIUS, incomingLen / 2);
  return {
    start: {
      x: merge.x - incoming.x * r,
      y: merge.y - incoming.y * r,
    },
    control: merge,
    end: {
      x: merge.x + join.x * r,
      y: merge.y + join.y * r,
    },
  };
}

function fanInJoinUnit(dir) {
  if (dir === 'Left') return { x: 1, y: 0 };
  if (dir === 'Right') return { x: -1, y: 0 };
  if (dir === 'Top') return { x: 0, y: 1 };
  if (dir === 'Bottom') return { x: 0, y: -1 };
  return null;
}

function euclideanDistance(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function segmentPathWithPlannedBreaks(a, b, cuts) {
  const minEdgeDistance = 14;
  const len = segmentLen(a, b);
  const sorted = cuts
    .map(cut => ({ ...cut, distance: segmentLen(a, cut.point) }))
    .filter(cut => cut.distance > minEdgeDistance && cut.distance < len - minEdgeDistance)
    .sort((x, y) => x.distance - y.distance);

  if (sorted.length === 0) return ` L ${b.x} ${b.y}`;

  const ux = Math.sign(b.x - a.x);
  const uy = Math.sign(b.y - a.y);
  let d = '';
  let lastBreakEnd = 0;
  for (const cut of sorted) {
    const beforeGap = cut.beforeGap ?? 6;
    const afterGap = cut.afterGap ?? 6;
    if (cut.distance - beforeGap - lastBreakEnd < 0) continue;
    const before = {
      x: cut.point.x - ux * beforeGap,
      y: cut.point.y - uy * beforeGap,
    };
    const after = {
      x: cut.point.x + ux * afterGap,
      y: cut.point.y + uy * afterGap,
    };
    d += ` L ${before.x} ${before.y} M ${after.x} ${after.y}`;
    lastBreakEnd = cut.distance + afterGap;
  }
  d += ` L ${b.x} ${b.y}`;
  return d;
}

function segmentPathWithBreaks(a, b, otherLines, currentOrder, currentProtectedArrow) {
  if (currentProtectedArrow) return ` L ${b.x} ${b.y}`;
  const gap = 8;
  const minEdgeDistance = 14;
  const len = segmentLen(a, b);
  const cuts = otherLines
    .filter(line => line.protectedArrow || line.routeOrder < currentOrder)
    .map(line => ({ line, point: segmentIntersectionPoint(a, b, line.a, line.b) }))
    .filter(item => item.point)
    .map(item => ({ point: item.point, distance: segmentLen(a, item.point) }))
    .filter(item => item.distance > minEdgeDistance && item.distance < len - minEdgeDistance)
    .sort((x, y) => x.distance - y.distance);

  if (cuts.length === 0) return ` L ${b.x} ${b.y}`;

  const ux = Math.sign(b.x - a.x);
  const uy = Math.sign(b.y - a.y);
  let d = '';
  let lastBreakEnd = 0;
  for (const cut of cuts) {
    if (cut.distance - lastBreakEnd < gap * 2) continue;
    const before = {
      x: cut.point.x - ux * gap,
      y: cut.point.y - uy * gap,
    };
    const after = {
      x: cut.point.x + ux * gap,
      y: cut.point.y + uy * gap,
    };
    d += ` L ${before.x} ${before.y} M ${after.x} ${after.y}`;
    lastBreakEnd = cut.distance + gap;
  }
  d += ` L ${b.x} ${b.y}`;
  return d;
}

function routeSegments(pts) {
  const segments = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p1 = pts[i];
    const p2 = pts[i + 1];
    segments.push({ p1, p2, len: Math.abs(p2.x - p1.x) + Math.abs(p2.y - p1.y) });
  }
  return segments;
}

function chooseTextPath(segments, edge) {
  const markerPad = edgeHasEndMarker(edge) ? ARROW_MARKER_LENGTH + LABEL_TO_ARROW_GAP : 0;
  const candidates = segments
    .map(segment => trimForEndMarker(segment, markerPad))
    .filter(segment => segment && segment.len > 0)
    .sort((a, b) => b.len - a.len);
  const segment = candidates[0] || segments[0];
  if (!segment) return { d: '', len: 0 };
  const leftToRight = segment.p1.x < segment.p2.x || (segment.p1.x === segment.p2.x && segment.p1.y < segment.p2.y);
  const a = leftToRight ? segment.p1 : segment.p2;
  const b = leftToRight ? segment.p2 : segment.p1;
  return { d: `M ${a.x} ${a.y} L ${b.x} ${b.y}`, len: segment.len };
}

function trimForEndMarker(segment, markerPad) {
  if (!markerPad) return segment;
  if (segment.len <= markerPad + 8) return null;
  return {
    p1: segment.p1,
    p2: {
      x: segment.p2.x - Math.sign(segment.p2.x - segment.p1.x) * markerPad,
      y: segment.p2.y - Math.sign(segment.p2.y - segment.p1.y) * markerPad,
    },
    len: segment.len - markerPad,
  };
}

function terminalStubLength(edge, role) {
  const type = edge?.connectionType || edge?.arrowType || 'target';
  const hasStartMarker = type === 'reverse' || type === 'both';
  const hasEndMarker = type === 'target' || type === 'both';
  return role === 'start'
    ? (hasStartMarker ? 40 : GRID.step)
    : (hasEndMarker ? 40 : GRID.step);
}

function segmentIsProtectedArrow(edge, index, segmentCount) {
  return (index === 0 && edgeHasStartMarker(edge)) || (index === segmentCount - 1 && edgeHasEndMarker(edge));
}

function edgeHasStartMarker(edge) {
  const type = edge?.connectionType || edge?.arrowType || 'target';
  return type === 'reverse' || type === 'both';
}

function edgeHasEndMarker(edge) {
  const type = edge?.connectionType || edge?.arrowType || 'target';
  return type === 'target' || type === 'both' || type === 'arrow';
}

function startAnchor(port) {
  return Array.isArray(port.anchorPt) ? port.anchorPt[0] : (port.anchorPt || port.pt);
}

function endAnchor(port) {
  return Array.isArray(port.anchorPt) ? port.anchorPt[0] : (port.anchorPt || port.pt);
}

function startAnchorPoints(port) {
  return Array.isArray(port.anchorPt)
    ? port.anchorPt.map(pt => ({ x: pt.x, y: pt.y }))
    : [startAnchor(port)];
}

function endAnchorPoints(port) {
  return Array.isArray(port.anchorPt)
    ? [...port.anchorPt].reverse().map(pt => ({ x: pt.x, y: pt.y }))
    : [endAnchor(port)];
}

function stubPoint(port, len) {
  return {
    x: port.pt.x + (port.axis === 'H' ? port.sign * len : 0),
    y: port.pt.y + (port.axis === 'V' ? port.sign * len : 0),
  };
}

function isOffsetPort(port) {
  return String(port.dir || '').startsWith('Bif');
}

function isAuxiliaryPort(port) {
  return isOffsetPort(port) || Boolean(port.isDiagonal);
}

function portKey(port) {
  const anchor = Array.isArray(port.anchorPt) ? port.anchorPt[0] : (port.anchorPt || port.pt);
  return `${Math.round(anchor.x * 100) / 100},${Math.round(anchor.y * 100) / 100}`;
}

function segmentViolatesNodeClearance(a, b, info, ctx, segmentIndex, lastSegmentIndex) {
  for (const obstacle of ctx.obstacles) {
    const isOwnNode = obstacle.id === String(info.edge.from) || obstacle.id === String(info.edge.to);
    if (isOwnNode && isAllowedTerminalStub(obstacle.id, info, segmentIndex, lastSegmentIndex)) continue;
    const box = isOwnNode ? nodeBodyClearanceBox(obstacle) : obstacle;
    if (segmentTouchesBox(a, b, box)) return true;
  }
  return false;
}

function nodeClearancePenalty(a, b, info, ctx, segmentIndex, lastSegmentIndex) {
  let penalty = 0;
  for (const obstacle of ctx.obstacles) {
    const isOwnNode = obstacle.id === String(info.edge.from) || obstacle.id === String(info.edge.to);
    if (isOwnNode && isAllowedTerminalStub(obstacle.id, info, segmentIndex, lastSegmentIndex)) continue;
    const box = isOwnNode ? nodeBodyClearanceBox(obstacle) : obstacle;
    penalty += clearanceGapPenalty(segmentBoxDistance(a, b, box));
  }
  return penalty;
}

function isAllowedTerminalStub(obstacleId, info, segmentIndex, lastSegmentIndex) {
  if (obstacleId === String(info.edge.from) && segmentIndex === 0) return true;
  if (obstacleId === String(info.edge.to) && segmentIndex === lastSegmentIndex - 1) return true;
  return false;
}

function nodeBodyClearanceBox(obstacle) {
  return {
    left: obstacle.vLeft - NODE_BODY_CLEARANCE,
    right: obstacle.vRight + NODE_BODY_CLEARANCE,
    top: obstacle.vTop - NODE_BODY_CLEARANCE,
    bottom: obstacle.vBottom + NODE_BODY_CLEARANCE,
  };
}

function segmentTouchesBox(a, b, box) {
  if (!segmentBBoxOverlapsBox(a, b, box)) return false;
  if (Math.abs(a.y - b.y) < EPS) {
    const minX = Math.min(a.x, b.x);
    const maxX = Math.max(a.x, b.x);
    return a.y >= box.top - EPS && a.y <= box.bottom + EPS && Math.max(minX, box.left) <= Math.min(maxX, box.right) + EPS;
  }
  if (Math.abs(a.x - b.x) < EPS) {
    const minY = Math.min(a.y, b.y);
    const maxY = Math.max(a.y, b.y);
    return a.x >= box.left - EPS && a.x <= box.right + EPS && Math.max(minY, box.top) <= Math.min(maxY, box.bottom) + EPS;
  }
  if (pointInsideBox(a, box) || pointInsideBox(b, box)) return true;
  const topLeft = { x: box.left, y: box.top };
  const topRight = { x: box.right, y: box.top };
  const bottomRight = { x: box.right, y: box.bottom };
  const bottomLeft = { x: box.left, y: box.bottom };
  return lineSegmentsIntersect(a, b, topLeft, topRight)
    || lineSegmentsIntersect(a, b, topRight, bottomRight)
    || lineSegmentsIntersect(a, b, bottomRight, bottomLeft)
    || lineSegmentsIntersect(a, b, bottomLeft, topLeft);
}

function segmentBBoxOverlapsBox(a, b, box) {
  return Math.max(a.x, b.x) >= box.left - EPS
    && Math.min(a.x, b.x) <= box.right + EPS
    && Math.max(a.y, b.y) >= box.top - EPS
    && Math.min(a.y, b.y) <= box.bottom + EPS;
}

function pointInsideBox(point, box) {
  return point.x >= box.left - EPS
    && point.x <= box.right + EPS
    && point.y >= box.top - EPS
    && point.y <= box.bottom + EPS;
}

function lineSegmentsIntersect(a, b, c, d) {
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);
  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && pointOnClosedSegment(c, a, b)) return true;
  if (o2 === 0 && pointOnClosedSegment(d, a, b)) return true;
  if (o3 === 0 && pointOnClosedSegment(a, c, d)) return true;
  if (o4 === 0 && pointOnClosedSegment(b, c, d)) return true;
  return false;
}

function orientation(a, b, c) {
  const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  if (Math.abs(cross) < EPS) return 0;
  return cross > 0 ? 1 : -1;
}

function pointOnClosedSegment(point, a, b) {
  return point.x >= Math.min(a.x, b.x) - EPS
    && point.x <= Math.max(a.x, b.x) + EPS
    && point.y >= Math.min(a.y, b.y) - EPS
    && point.y <= Math.max(a.y, b.y) + EPS
    && orientation(a, b, point) === 0;
}

function lineClearancePenalty(a, b, line) {
  const dist = parallelSegmentDistance(a, b, line.a, line.b);
  return dist == null ? 0 : clearanceGapPenalty(dist);
}

function clearanceGapPenalty(distance) {
  if (distance >= PREFERRED_CLEARANCE) return 0;
  const preferredGap = PREFERRED_CLEARANCE - Math.max(0, distance);
  const tightGap = Math.max(0, TIGHT_CLEARANCE - distance);
  return preferredGap + tightGap * 4;
}

function parallelSegmentDistance(a, b, c, d) {
  const abH = Math.abs(a.y - b.y) < EPS;
  const cdH = Math.abs(c.y - d.y) < EPS;
  if (abH !== cdH) return null;
  if (abH) {
    if (rangeOverlap(a.x, b.x, c.x, d.x) <= 0.5) return null;
    return Math.abs(a.y - c.y);
  }
  if (rangeOverlap(a.y, b.y, c.y, d.y) <= 0.5) return null;
  return Math.abs(a.x - c.x);
}

function segmentBoxDistance(a, b, box) {
  if (segmentTouchesBox(a, b, box)) return 0;
  if (Math.abs(a.y - b.y) < EPS) {
    const minX = Math.min(a.x, b.x);
    const maxX = Math.max(a.x, b.x);
    if (maxX >= box.left && minX <= box.right) {
      if (a.y < box.top) return box.top - a.y;
      if (a.y > box.bottom) return a.y - box.bottom;
    }
  }
  if (Math.abs(a.x - b.x) < EPS) {
    const minY = Math.min(a.y, b.y);
    const maxY = Math.max(a.y, b.y);
    if (maxY >= box.top && minY <= box.bottom) {
      if (a.x < box.left) return box.left - a.x;
      if (a.x > box.right) return a.x - box.right;
    }
  }
  return Math.min(
    pointBoxDistance(a, box),
    pointBoxDistance(b, box)
  );
}

function pointBoxDistance(pt, box) {
  const dx = pt.x < box.left ? box.left - pt.x : (pt.x > box.right ? pt.x - box.right : 0);
  const dy = pt.y < box.top ? box.top - pt.y : (pt.y > box.bottom ? pt.y - box.bottom : 0);
  return Math.hypot(dx, dy);
}

function findCrossings(routes) {
  const lines = routes.filter(route => !route.isFallback).flatMap(collectLines);
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      if (lines[i].edgeId === lines[j].edgeId) continue;
      if (segmentsCross(lines[i].a, lines[i].b, lines[j].a, lines[j].b)) {
        out.push({ a: lines[i].route, b: lines[j].route });
      }
    }
  }
  return out;
}

function routeCrossingStats(routes) {
  const list = [...routes.values()].filter(route => !route.isFallback);
  const lines = list.flatMap(collectLines);
  const stats = new Map(list.map(route => [String(route.edge.id), { crossings: 0 }]));

  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      if (lines[i].edgeId === lines[j].edgeId) continue;
      if (!segmentsCross(lines[i].a, lines[i].b, lines[j].a, lines[j].b)) continue;
      stats.get(lines[i].edgeId).crossings += 1;
      stats.get(lines[j].edgeId).crossings += 1;
    }
  }

  return stats;
}

function segmentsCross(a, b, c, d) {
  return Boolean(segmentIntersectionPoint(a, b, c, d));
}

function segmentsTouchAtInteriorPoint(a, b, c, d) {
  return pointOnSegmentInterior(a, c, d)
    || pointOnSegmentInterior(b, c, d)
    || pointOnSegmentInterior(c, a, b)
    || pointOnSegmentInterior(d, a, b);
}

function pointOnSegmentInterior(point, a, b) {
  const margin = 0.5;
  if (Math.abs(a.y - b.y) < EPS && Math.abs(point.y - a.y) < EPS) {
    const minX = Math.min(a.x, b.x);
    const maxX = Math.max(a.x, b.x);
    return point.x > minX + margin && point.x < maxX - margin;
  }
  if (Math.abs(a.x - b.x) < EPS && Math.abs(point.x - a.x) < EPS) {
    const minY = Math.min(a.y, b.y);
    const maxY = Math.max(a.y, b.y);
    return point.y > minY + margin && point.y < maxY - margin;
  }
  return false;
}

function segmentIntersectionPoint(a, b, c, d) {
  const abH = Math.abs(a.y - b.y) < EPS;
  const cdH = Math.abs(c.y - d.y) < EPS;
  if (abH === cdH) return null;
  const h1 = abH ? a : c;
  const h2 = abH ? b : d;
  const v1 = abH ? c : a;
  const v2 = abH ? d : b;
  const minX = Math.min(h1.x, h2.x);
  const maxX = Math.max(h1.x, h2.x);
  const minY = Math.min(v1.y, v2.y);
  const maxY = Math.max(v1.y, v2.y);
  if (v1.x > minX + 0.5 && v1.x < maxX - 0.5 && h1.y > minY + 0.5 && h1.y < maxY - 0.5) {
    return { x: v1.x, y: h1.y };
  }
  return null;
}

function segmentsOverlap(a, b, c, d) {
  const abH = Math.abs(a.y - b.y) < EPS;
  const cdH = Math.abs(c.y - d.y) < EPS;
  if (abH !== cdH) return false;
  if (abH) {
    if (Math.abs(a.y - c.y) > EPS) return false;
    return rangeOverlap(a.x, b.x, c.x, d.x) > 0.5;
  }
  if (Math.abs(a.x - c.x) > EPS) return false;
  return rangeOverlap(a.y, b.y, c.y, d.y) > 0.5;
}

function canMergeDecisionFanIn(info, line, segmentIndex, lastSegmentIndex) {
  if (String(info.edge.to) !== String(line.targetId)) return false;
  if (info.endNode.type !== 'rhombus') return false;
  const currentIsTargetApproach = segmentIndex === lastSegmentIndex - 1;
  const linePts = line.route?.pts || [];
  const lineIsTargetApproach = line.index === linePts.length - 2;
  return currentIsTargetApproach && lineIsTargetApproach;
}

function rangeOverlap(a1, a2, b1, b2) {
  return Math.max(0, Math.min(Math.max(a1, a2), Math.max(b1, b2)) - Math.max(Math.min(a1, a2), Math.min(b1, b2)));
}

function pathLength(pts) {
  let sum = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    sum += Math.abs(pts[i + 1].x - pts[i].x) + Math.abs(pts[i + 1].y - pts[i].y);
  }
  return sum;
}

function countBends(pts) {
  let bends = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const prevH = Math.abs(pts[i].y - pts[i - 1].y) < EPS;
    const nextH = Math.abs(pts[i + 1].y - pts[i].y) < EPS;
    if (prevH !== nextH) bends++;
  }
  return bends;
}

function isOrthogonal(pts) {
  for (let i = 0; i < pts.length - 1; i++) {
    const isTerminalStub = i === 0 || i === pts.length - 2;
    if (!isTerminalStub && Math.abs(pts[i].x - pts[i + 1].x) > EPS && Math.abs(pts[i].y - pts[i + 1].y) > EPS) return false;
  }
  return true;
}

function cleanPath(pts) {
  const out = [];
  for (const pt of pts.flat()) {
    if (!pt) continue;
    const prev = out[out.length - 1];
    if (!prev || Math.abs(prev.x - pt.x) > EPS || Math.abs(prev.y - pt.y) > EPS) {
      out.push({ x: pt.x, y: pt.y });
    }
  }
  const slim = [out[0]];
  for (let i = 1; i < out.length - 1; i++) {
    const prev = slim[slim.length - 1];
    const curr = out[i];
    const next = out[i + 1];
    if ((Math.abs(prev.x - curr.x) < EPS && Math.abs(curr.x - next.x) < EPS)
      || (Math.abs(prev.y - curr.y) < EPS && Math.abs(curr.y - next.y) < EPS)) continue;
    slim.push(curr);
  }
  if (out.length > 1) slim.push(out[out.length - 1]);
  return slim.filter(Boolean);
}

function cleanPathPreservingTerminalStubs(pts) {
  const out = cleanDuplicatePoints(pts);
  if (out.length <= 4) return out;
  const startTerminal = out[1];
  const endTerminal = out[out.length - 2];
  const slim = [out[0], startTerminal];
  for (let i = 2; i < out.length - 2; i++) {
    const prev = slim[slim.length - 1];
    const curr = out[i];
    const next = out[i + 1];
    if ((Math.abs(prev.x - curr.x) < EPS && Math.abs(curr.x - next.x) < EPS)
      || (Math.abs(prev.y - curr.y) < EPS && Math.abs(curr.y - next.y) < EPS)) continue;
    slim.push(curr);
  }
  slim.push(endTerminal, out[out.length - 1]);
  return cleanDuplicatePoints(slim);
}

function cleanDuplicatePoints(pts) {
  const out = [];
  for (const pt of pts.flat()) {
    if (!pt) continue;
    const prev = out[out.length - 1];
    if (!prev || Math.abs(prev.x - pt.x) > EPS || Math.abs(prev.y - pt.y) > EPS) {
      out.push({ x: pt.x, y: pt.y });
    }
  }
  return out;
}

function uniqueSnapped(values) {
  return [...new Set(values.map(value => Math.round(value / GRID.step) * GRID.step))];
}

function nearestLanes(lanes, anchors, limit) {
  return [...lanes]
    .sort((a, b) => laneDistance(a, anchors) - laneDistance(b, anchors) || a - b)
    .slice(0, limit);
}

function laneDistance(lane, anchors) {
  return Math.min(...anchors.map(anchor => Math.abs(lane - anchor)));
}
