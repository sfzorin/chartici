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

export function routeFlowchartNegotiated(edgeInfos, allNodes, routingRules) {
  const ctx = buildFlowchartCtx(edgeInfos, allNodes, routingRules);
  const routes = new Map();
  const occupiedPorts = new Map();
  const occupiedLines = [];

  const directInfos = [...edgeInfos].sort((a, b) => a.dist - b.dist);
  for (const info of directInfos) {
    const route = chooseRoute(info, ctx, occupiedPorts, occupiedLines, { directOnly: true });
    if (!route) continue;
    commitRoute(route, routes, occupiedPorts, occupiedLines);
  }

  const remaining = edgeInfos
    .filter(info => !routes.has(String(info.edge.id)))
    .sort((a, b) => a.dist - b.dist);
  for (const info of remaining) {
    const route = chooseRoute(info, ctx, occupiedPorts, occupiedLines, { directOnly: false });
    if (route) {
      commitRoute(route, routes, occupiedPorts, occupiedLines);
      continue;
    }
    routes.set(String(info.edge.id), buildCenterFallback(info, 'no-negotiated-route'));
  }

  improveSharedNodeCrossings(routes, edgeInfos, ctx, occupiedPorts, occupiedLines);
  rotateNodePortsIfBetter(routes, edgeInfos, ctx, occupiedPorts, occupiedLines);

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

  for (const info of edgeInfos) {
    degree.set(String(info.edge.from), (degree.get(String(info.edge.from)) || 0) + 1);
    degree.set(String(info.edge.to), (degree.get(String(info.edge.to)) || 0) + 1);
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

  return { nodeMap, boxes, obstacles, degree, routingRules };
}

function chooseRoute(info, ctx, occupiedPorts, occupiedLines, options) {
  const startPorts = availablePorts(info.startNode, info.startBox, ctx, occupiedPorts, 'start');
  const endPorts = availablePorts(info.endNode, info.endBox, ctx, occupiedPorts, 'end');
  let best = null;

  for (const startPort of startPorts) {
    for (const endPort of endPorts) {
      const candidates = options.directOnly
        ? directCandidates(startPort, endPort, info)
        : orthogonalCandidates(startPort, endPort, info);
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
    .filter(port => !port.isDiagonal);
  const needsOffset = (ctx.degree.get(String(node.id)) || 0) > 4;
  const ports = needsOffset
    ? allPorts
    : allPorts.filter(port => !isOffsetPort(port));
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
  return [cleanPathPreservingTerminalStubs([startAnchor(startPort), startStub, endStub, endAnchor(endPort)])];
}

function orthogonalCandidates(startPort, endPort, info) {
  const startStub = stubPoint(startPort, terminalStubLength(info.edge, 'start'));
  const endStub = stubPoint(endPort, terminalStubLength(info.edge, 'end'));
  const prefix = [startAnchor(startPort), startStub];
  const suffix = [endStub, endAnchor(endPort)];
  const candidates = [];

  candidates.push(cleanPathPreservingTerminalStubs([...prefix, { x: endStub.x, y: startStub.y }, ...suffix]));
  candidates.push(cleanPathPreservingTerminalStubs([...prefix, { x: startStub.x, y: endStub.y }, ...suffix]));

  const xs = [startStub.x, endStub.x, info.startBox.left - 40, info.startBox.right + 40, info.endBox.left - 40, info.endBox.right + 40];
  const ys = [startStub.y, endStub.y, info.startBox.top - 40, info.startBox.bottom + 40, info.endBox.top - 40, info.endBox.bottom + 40];
  for (const x of uniqueSnapped(xs)) {
    candidates.push(cleanPathPreservingTerminalStubs([...prefix, { x, y: startStub.y }, { x, y: endStub.y }, ...suffix]));
  }
  for (const y of uniqueSnapped(ys)) {
    candidates.push(cleanPathPreservingTerminalStubs([...prefix, { x: startStub.x, y }, { x: endStub.x, y }, ...suffix]));
  }

  return candidates.filter(pts => pts.length >= 2 && isOrthogonal(pts));
}

function measureRoute(pts, info, startPort, endPort, ctx, occupiedLines, options = {}) {
  if (!isOrthogonal(pts)) return null;
  if (hasBacktrackingSegment(pts)) return null;
  if (!terminalSegmentsFit(pts, info.edge)) return null;
  let crossings = 0;
  let overlaps = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if (segmentViolatesNodeClearance(a, b, info, ctx, i, pts.length - 1)) return null;
    for (const line of occupiedLines) {
      if (segmentsOverlap(a, b, line.a, line.b)) {
        if (!canMergeDecisionFanIn(info, line)) return null;
        overlaps += 1;
      }
      if (segmentsTouchAtInteriorPoint(a, b, line.a, line.b)) {
        if (!canMergeDecisionFanIn(info, line)) return null;
      }
      if (segmentsCross(a, b, line.a, line.b)) {
        crossings += 1;
      }
    }
  }
  const bends = countBends(pts);
  const length = pathLength(pts);
  const portPenalty = (startPort.routerPenalty || 0) + (endPort.routerPenalty || 0);
  return {
    crossings,
    overlaps,
    bends,
    length,
    portPenalty,
    scalar: crossings * 1000000 + overlaps * 100000 + bends * 10000 + length + portPenalty,
  };
}

function compareRouteMetrics(a, b) {
  return a.crossings - b.crossings
    || a.overlaps - b.overlaps
    || a.bends - b.bends
    || a.length - b.length
    || a.portPenalty - b.portPenalty;
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
        pathD: pathFromPts(groupedPts),
        groupedFanIn: true,
        fanInCarrier: isCarrier,
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
    path.pathD = pathFromPtsWithBreakPlan(path.pts, String(info.edge.id), breakPlan);
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
      rebuildOccupancy(routes, occupiedPorts, occupiedLines);
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

  const otherLines = linesExcept(routes, routeA, routeB);
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

function bestRouteWithPorts(info, startPort, endPort, ctx, occupiedLines) {
  let best = null;
  const candidates = candidatePathsForPorts(info, startPort, endPort);
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
      for (const ptsA of candidatePathsForPorts(infoA, startPortA, endPortA)) {
        const nextA = makeRouteForPorts(infoA, ptsA, startPortA, endPortA);
        const metricsA = measureRoute(nextA.pts, nextA.info, nextA.startPort, nextA.endPort, ctx, otherLines);
        if (!metricsA) continue;
        const linesAfterA = [...otherLines, ...collectLines(nextA)];

        for (const startPortB of choicesB.startPorts) {
          for (const endPortB of choicesB.endPorts) {
            for (const ptsB of candidatePathsForPorts(infoB, startPortB, endPortB)) {
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

function candidatePathsForPorts(info, startPort, endPort) {
  return [
    ...directCandidates(startPort, endPort, info),
    ...orthogonalCandidates(startPort, endPort, info),
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

function linesExcept(routes, routeA, routeB) {
  const skip = new Set([String(routeA.edge.id), String(routeB.edge.id)]);
  const out = [];
  for (const route of routes.values()) {
    if (skip.has(String(route.edge.id)) || route.isFallback) continue;
    collectLines(route).forEach(line => out.push(line));
  }
  return out;
}

function occupiedPortsExcept(routes, routeA, routeB) {
  const skip = new Set([String(routeA.edge.id), String(routeB.edge.id)]);
  const occupied = new Map();
  for (const route of routes.values()) {
    if (skip.has(String(route.edge.id)) || route.isFallback) continue;
    reservePort(occupied, route.sourceId, route.startPort);
    reservePort(occupied, route.targetId, route.endPort);
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
  const second = measureRoute(routeB.pts, routeB.info, routeB.startPort, routeB.endPort, ctx, [...otherLines, ...collectLines(routeA)]);
  if (!second) return null;
  return addRouteMetrics(first, second);
}

function addRouteMetrics(a, b) {
  return {
    crossings: a.crossings + b.crossings,
    overlaps: a.overlaps + b.overlaps,
    bends: a.bends + b.bends,
    length: a.length + b.length,
    portPenalty: a.portPenalty + b.portPenalty,
    scalar: a.scalar + b.scalar,
  };
}

function commitRoute(route, routes, occupiedPorts, occupiedLines) {
  routes.set(String(route.edge.id), route);
  reservePort(occupiedPorts, route.sourceId, route.startPort);
  reservePort(occupiedPorts, route.targetId, route.endPort);
  collectLines(route).forEach(line => occupiedLines.push(line));
}

function rebuildOccupancy(routes, occupiedPorts, occupiedLines) {
  occupiedPorts.clear();
  occupiedLines.length = 0;
  for (const route of routes.values()) {
    if (route.isFallback) continue;
    reservePort(occupiedPorts, route.sourceId, route.startPort);
    reservePort(occupiedPorts, route.targetId, route.endPort);
    collectLines(route).forEach(line => occupiedLines.push(line));
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

function reservePort(occupiedPorts, nodeId, port) {
  if (!port) return;
  const key = String(nodeId);
  if (!occupiedPorts.has(key)) occupiedPorts.set(key, new Set());
  occupiedPorts.get(key).add(portKey(port));
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

function pathFromPts(pts) {
  if (!pts.length) return '';
  return pts.map((pt, index) => `${index === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`).join(' ');
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
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const currentProtectedArrow = segmentIsProtectedArrow(routes.get(String(edgeId))?.edge, i, pts.length - 1);
    d += segmentPathWithBreaks(pts[i], pts[i + 1], otherLines, currentOrder, currentProtectedArrow);
  }
  return d;
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
      const gaps = breakGapsForCrossing(breaker, labelLine, point);
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

function breakGapsForCrossing(breaker, labelLine, point) {
  const tiny = 6;
  if (!labelLine) return { beforeGap: tiny, afterGap: tiny };

  const labelVector = labelSideVector(labelLine, point);
  const breakerVector = segmentUnitVector(breaker.a, breaker.b);
  const labelClearance = Math.max(18, Math.ceil((EDGE_LABEL_STYLE.fontSize + EDGE_LABEL_STYLE.haloWidth * 2) / 2) + 6);
  const labelIsAfter = breakerVector.x * labelVector.x + breakerVector.y * labelVector.y > 0;
  return labelIsAfter
    ? { beforeGap: tiny, afterGap: labelClearance }
    : { beforeGap: labelClearance, afterGap: tiny };
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

function pathFromPtsWithBreakPlan(pts, edgeId, breakPlan) {
  if (!pts.length) return '';
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    d += segmentPathWithPlannedBreaks(pts[i], pts[i + 1], breakPlan.get(`${edgeId}:${i}`) || []);
  }
  return d;
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

function stubPoint(port, len) {
  return {
    x: port.pt.x + (port.axis === 'H' ? port.sign * len : 0),
    y: port.pt.y + (port.axis === 'V' ? port.sign * len : 0),
  };
}

function isOffsetPort(port) {
  return String(port.dir || '').startsWith('Bif');
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
  if (Math.abs(a.y - b.y) < EPS) {
    const minX = Math.min(a.x, b.x);
    const maxX = Math.max(a.x, b.x);
    return a.y >= box.top - EPS && a.y <= box.bottom + EPS && Math.max(minX, box.left) <= Math.min(maxX, box.right);
  }
  if (Math.abs(a.x - b.x) < EPS) {
    const minY = Math.min(a.y, b.y);
    const maxY = Math.max(a.y, b.y);
    return a.x >= box.left - EPS && a.x <= box.right + EPS && Math.max(minY, box.top) <= Math.min(maxY, box.bottom);
  }
  return true;
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

function canMergeDecisionFanIn(info, line) {
  if (String(info.edge.to) !== String(line.targetId)) return false;
  return info.endNode.type === 'rhombus';
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
    if (Math.abs(pts[i].x - pts[i + 1].x) > EPS && Math.abs(pts[i].y - pts[i + 1].y) > EPS) return false;
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
