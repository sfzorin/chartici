import { getTrueBox } from './geometry.js';
import { GRID } from '../../diagram/canvas.js';
import { addPortUsage, canUsePort } from './portUsage.js';

const ARROW_MARKER_LENGTH = 20;
const LABEL_TO_ARROW_GAP = 5;
const SEQUENCE_LABEL_CHAR_WIDTH = 8;
const SEQUENCE_LABEL_BASE_PADDING = 14;
const SEQUENCE_LABEL_ARROW_PADDING = 18;
const SEQUENCE_LABEL_PREFERRED_GAP = 20;
const SEQUENCE_LABEL_TIGHT_GAP = 5;
export function routeSequenceDeterministic(edgeInfos, allNodes = [], routingRules = {}) {
  const result = {};
  const occupied = [];
  const obstacles = erdObstacles(allNodes, routingRules.PADDING ?? 10);
  const portCtx = { usedPorts: new Map() };
  const routes = [];
  edgeInfos.forEach(info => {
    const route = sequenceRoute(info, portCtx, occupied, obstacles);
    const pts = route.pts;
    if (route.startPort) {
      addPortUsage(portCtx, info.startNode?.id ?? info.edge.from, route.startPort, pts[0], route.edgeType, 'start');
    }
    if (route.endPort) {
      addPortUsage(portCtx, info.endNode?.id ?? info.edge.to, route.endPort, pts[pts.length - 1], route.edgeType, 'end');
    }
    routes.push({ ...route, info });
    collectSegments(pts).forEach(segment => occupied.push({
      ...segment,
      edgeId: info.edge.id,
      edgeType: route.edgeType,
      direction: `${info.edge.from ?? info.edge.sourceId}->${info.edge.to ?? info.edge.targetId}`,
    }));
  });
  optimizeSequenceSharedNodePortSwaps(routes, obstacles);
  routes.forEach(route => {
    result[route.info.edge.id] = pathResult(route.pts, route.info.edge, { sequenceLabelWindow: true, preserveTerminals: true });
  });
  return result;
}

export function routeTreeDeterministic(edgeInfos, allNodes = [], routingRules = {}) {
  const result = {};
  const padding = routingRules.PADDING ?? GRID.step;
  const obstacles = erdObstacles(allNodes, padding);
  const stackGroups = collectTreeStackGroups(edgeInfos);

  stackGroups.forEach(group => {
    const start = { x: group.startBox.cx, y: group.startBox.bottom };
    const sharedY = chooseTreeSharedY(group.items, obstacles, padding, buildTreeStackPts);
    const columnTrunks = treeStackColumnTrunks(group, padding);

    group.items.forEach(info => {
      const trunkX = columnTrunks.get(treeStackColumnKey(info)) ?? snapLeft(info.endBox.left - padding - GRID.step);
      const pts = buildTreeStackPts(info, sharedY, trunkX);
      result[info.edge.id] = pathResult(cleanPts(pts), info.edge, { preferLongest: true });
    });
  });

  collectTreeSourceGroups(edgeInfos.filter(info => !result[info.edge.id])).forEach(group => {
    const sharedY = chooseTreeSharedY(group.items, obstacles, padding, buildTreeFanoutPts);
    group.items.forEach(info => {
      const pts = chooseTreeFanoutPts(info, sharedY, obstacles, padding);
      result[info.edge.id] = pathResult(cleanPts(pts), info.edge, { preferLongest: true });
    });
  });
  return result;
}

function collectTreeStackGroups(edgeInfos) {
  const groups = new Map();
  edgeInfos.forEach(info => {
    if (info.endNode?._stackEntry !== 'Left') return;
    const key = String(info.edge.from ?? info.edge.sourceId);
    if (!groups.has(key)) {
      groups.set(key, {
        startBox: info.startBox,
        items: [],
      });
    }
    groups.get(key).items.push(info);
  });
  return [...groups.values()]
    .filter(group => group.items.length > 0)
    .map(group => ({
      ...group,
      items: group.items.sort((a, b) => a.endBox.cy - b.endBox.cy || a.endBox.cx - b.endBox.cx),
    }));
}

function collectTreeSourceGroups(edgeInfos) {
  const groups = new Map();
  edgeInfos.forEach(info => {
    const key = String(info.edge.from ?? info.edge.sourceId);
    if (!groups.has(key)) groups.set(key, { startBox: info.startBox, items: [] });
    groups.get(key).items.push(info);
  });
  return [...groups.values()].map(group => ({
    ...group,
    items: group.items.sort((a, b) => a.endBox.cx - b.endBox.cx || a.endBox.cy - b.endBox.cy),
  }));
}

function treeStackColumnTrunks(group, padding) {
  const columns = new Map();
  group.items.forEach(info => {
    const key = treeStackColumnKey(info);
    if (!columns.has(key)) columns.set(key, []);
    columns.get(key).push(info);
  });
  const out = new Map();
  const sortedColumns = [...columns.entries()]
    .map(([key, items]) => ({
      key,
      items,
      left: Math.min(...items.map(info => info.endBox.left)),
      right: Math.max(...items.map(info => info.endBox.right)),
    }))
    .sort((a, b) => a.left - b.left);

  let previousRight = null;
  sortedColumns.forEach(column => {
    const { key, left } = column;
    let trunkX = snapLeft(left - padding - GRID.step);
    if (previousRight !== null && trunkX <= previousRight) {
      trunkX = snap((previousRight + left) / 2);
      if (trunkX <= previousRight || trunkX >= left) trunkX = snapLeft(left - padding - GRID.step);
    }
    out.set(key, trunkX);
    previousRight = Math.max(previousRight ?? -Infinity, column.right);
  });
  return out;
}

function treeStackColumnKey(info) {
  return String(snap(info.endBox.left));
}

function buildTreeStackPts(info, sharedY, trunkX = snapLeft(info.endBox.left - GRID.step * 2)) {
  const start = { x: info.startBox.cx, y: info.startBox.bottom };
  const end = { x: info.endBox.left, y: info.endBox.cy };
  return cleanPts([
    start,
    { x: start.x, y: sharedY },
    { x: trunkX, y: sharedY },
    { x: trunkX, y: end.y },
    end,
  ]);
}

function buildTreeFanoutPts(info, sharedY) {
  const start = { x: info.startBox.cx, y: info.startBox.bottom };
  const end = { x: info.endBox.cx, y: info.endBox.top };
  if (Math.abs(start.x - end.x) < 1) return cleanPts([start, end]);
  return cleanPts([start, { x: start.x, y: sharedY }, { x: end.x, y: sharedY }, end]);
}

function chooseTreeFanoutPts(info, sharedY, obstacles, padding) {
  const candidates = buildTreeFanoutCandidates(info, sharedY, obstacles, padding);
  return candidates
    .map(pts => ({ pts, score: treeSharedYScore([info], obstacles, sharedY, () => pts) }))
    .sort((a, b) => a.score - b.score)[0]?.pts || buildTreeFanoutPts(info, sharedY);
}

function buildTreeFanoutCandidates(info, sharedY, obstacles, padding) {
  const direct = buildTreeFanoutPts(info, sharedY);
  const start = { x: info.startBox.cx, y: info.startBox.bottom };
  const end = { x: info.endBox.cx, y: info.endBox.top };
  const own = new Set([String(info.edge.from ?? info.edge.sourceId), String(info.edge.to ?? info.edge.targetId)]);
  const verticalStart = { x: end.x, y: sharedY };
  const blockers = obstacles.filter(obstacle => (
    !own.has(obstacle.id) && segmentCrossesBox(verticalStart, end, obstacle)
  ));

  if (blockers.length === 0) return [direct];

  const highestClearY = end.y - GRID.step;
  const belowBlockersY = Math.max(...blockers.map(obstacle => obstacle.bottom)) + padding + GRID.step;
  const betweenY = snap(Math.min(highestClearY, Math.max(sharedY + GRID.step, belowBlockersY)));
  if (!Number.isFinite(betweenY) || betweenY <= sharedY || betweenY >= end.y) return [direct];

  const rowBlockers = obstacles.filter(obstacle => (
    !own.has(obstacle.id)
    && Math.max(sharedY, obstacle.top) <= Math.min(betweenY, obstacle.bottom)
  ));
  const corridorBlockers = rowBlockers.length > 0 ? rowBlockers : blockers;
  const innerCorridorXs = treeInnerCorridorXs(corridorBlockers);
  const outerCorridorXs = [
    snapLeft(Math.min(...corridorBlockers.map(obstacle => obstacle.left)) - GRID.step),
    snapRight(Math.max(...corridorBlockers.map(obstacle => obstacle.right)) + GRID.step),
  ];
  const corridorXs = [...new Set([...innerCorridorXs, ...outerCorridorXs])];

  return [
    direct,
    ...corridorXs.map(x => cleanPts([
      start,
      { x: start.x, y: sharedY },
      { x, y: sharedY },
      { x, y: betweenY },
      { x: end.x, y: betweenY },
      end,
    ])),
  ];
}

function treeInnerCorridorXs(blockers) {
  return [...blockers]
    .sort((a, b) => a.left - b.left)
    .flatMap((leftBox, index, sorted) => {
      const rightBox = sorted[index + 1];
      if (!rightBox) return [];
      const gap = rightBox.left - leftBox.right;
      if (gap < GRID.step) return [];
      const x = snap((leftBox.right + rightBox.left) / 2);
      return x > leftBox.right && x < rightBox.left ? [x] : [];
    });
}

function chooseTreeSharedY(items, obstacles, padding, buildPts) {
  const startY = items[0]?.startBox?.bottom ?? 0;
  const minTargetTop = Math.min(...items.map(info => info.endBox.top));
  const low = startY + GRID.step;
  const high = minTargetTop - padding - GRID.step;
  const preferred = startY + GRID.step * 2;
  const raw = [
    preferred,
    low,
    startY + GRID.step * 3,
    (startY + minTargetTop) / 2,
    high,
  ];
  const candidates = [...new Set(raw
    .map(value => snap(clamp(value, low, Math.max(low, high))))
    .filter(Number.isFinite))];
  return candidates
    .map(y => ({ y, score: treeSharedYScore(items, obstacles, y, buildPts) }))
    .sort((a, b) => a.score - b.score || Math.abs(a.y - preferred) - Math.abs(b.y - preferred))[0]?.y ?? snap(preferred);
}

function treeSharedYScore(items, obstacles, sharedY, buildPts) {
  return items.reduce((score, info) => {
    const pts = buildPts(info, sharedY);
    return score
      + countObstacleCrossings(pts, obstacles, info) * 1000000
      + countBends(pts) * 1000
      + pathLength(pts);
  }, 0);
}

export function routeErdDeterministic(edgeInfos, allNodes = [], routingRules = {}) {
  const result = {};
  const occupied = [];
  const obstacles = erdObstacles(allNodes, routingRules.PADDING ?? GRID.step);
  [...edgeInfos]
    .sort((a, b) => a.dist - b.dist)
    .forEach(info => {
      const candidates = erdCandidates(info);
      const best = candidates
        .map(pts => ({ pts, score: erdScore(pts, occupied, obstacles, info) }))
        .sort((a, b) => a.score - b.score)[0];
      const pts = best?.pts || centerOrthogonalPts(info);
      result[info.edge.id] = pathResult(pts, info.edge, { preferLongest: true });
      collectSegments(pts).forEach(segment => occupied.push(segment));
    });
  return result;
}

function sequenceRoute(info, portCtx, occupied, obstacles) {
  const startSide = 'right';
  const endSide = 'left';
  const edgeType = edgeTypeKey(info.edge);
  const startPorts = freeSequencePorts(info.startBox, startSide, info.startNode?.id ?? info.edge.from, edgeType, 'start', portCtx);
  const endPorts = freeSequencePorts(info.endBox, endSide, info.endNode?.id ?? info.edge.to, edgeType, 'end', portCtx);
  const candidates = [];

  for (const startPort of startPorts) {
    for (const endPort of endPorts) {
      const routeCandidates = sequencePathCandidates(info.edge, startPort, endPort, info);
      routeCandidates.forEach(pts => {
        const clean = cleanPtsPreservingTerminals(pts);
        candidates.push({
          pts: clean,
          startPort,
          endPort,
          edgeType,
          score: sequenceRouteScore(clean, occupied, obstacles, info, startPort, endPort),
        });
      });
    }
  }

  const best = candidates.sort((a, b) => a.score - b.score)[0];
  if (best) return best;

  const startPort = sequenceSidePortCandidates(info.startBox, startSide)[0];
  const endPort = sequenceSidePortCandidates(info.endBox, endSide)[0];
  return {
    pts: cleanPtsPreservingTerminals(sequencePathCandidates(info.edge, startPort, endPort, info)[0]),
    startPort,
    endPort,
    edgeType,
  };
}

function freeSequencePorts(box, side, nodeId, edgeType, role, portCtx) {
  const nodeKey = String(nodeId);
  const used = portCtx.usedPorts.get(nodeKey);
  const primary = sequenceSidePortCandidates(box, side)
    .filter(port => canUsePort(used, port, edgeType, role, false));
  if (primary.length > 0) return primary;
  const fallbackSide = side === 'right' ? 'left' : 'right';
  return sequenceSidePortCandidates(box, fallbackSide)
    .map(port => ({ ...port, sideFallback: true }))
    .filter(port => canUsePort(used, port, edgeType, role, false));
}

function sequencePathCandidates(edge, startPort, endPort, info) {
  const start = startPort.pt;
  const end = endPort.pt;
  const startStubLen = terminalStubLength(edge, 'start');
  const endStubLen = terminalStubLength(edge, 'end');
  const startStub = {
    x: start.x + (startPort.sign || 1) * startStubLen,
    y: start.y,
  };
  const endStub = {
    x: end.x + (endPort.sign || -1) * endStubLen,
    y: end.y,
  };
  if (Math.abs(start.y - end.y) < 1) {
    const direct = [start, startStub, endStub, end];
    const laneOffsets = [-GRID.step * 3, GRID.step * 3, -GRID.step * 5, GRID.step * 5];
    return [
      direct,
      ...laneOffsets.map(offset => [
        start,
        startStub,
        { x: startStub.x, y: startStub.y + offset },
        { x: endStub.x, y: endStub.y + offset },
        endStub,
        end,
      ]),
    ];
  }
  const minX = Math.min(info.startBox.left, info.endBox.left);
  const maxX = Math.max(info.startBox.right, info.endBox.right);
  const outsideLeft = snapLeft(minX - GRID.step * 2);
  const outsideRight = snapRight(maxX + GRID.step * 2);
  const midX = snap((startStub.x + endStub.x) / 2);
  const insideXs = [startStub.x, endStub.x, midX];
  const outsideXs = [outsideRight, outsideLeft];
  return [
    [start, startStub, { x: startStub.x, y: endStub.y }, endStub, end],
    [start, startStub, { x: endStub.x, y: startStub.y }, endStub, end],
    ...outsideXs.map(x => [start, startStub, { x, y: startStub.y }, { x, y: endStub.y }, endStub, end]),
    ...insideXs.flatMap(x => [
      [start, startStub, { x, y: startStub.y }, { x, y: endStub.y }, endStub, end],
      [start, startStub, { x, y: startStub.y }, { x, y: (startStub.y + endStub.y) / 2 }, { x: endStub.x, y: (startStub.y + endStub.y) / 2 }, endStub, end],
    ]),
  ];
}

function sequenceRouteScore(pts, occupied, obstacles, info, startPort, endPort) {
  return countObstacleCrossings(pts, obstacles, info) * 1000000000
    + countIncompatibleSequenceOverlaps(pts, occupied, info.edge) * 500000000
    + countOverlaps(pts, occupied) * 10000000
    + countCrossings(pts, occupied) * 1000000
    + countBends(pts) * 10000
    + sequencePortPenalty(startPort) + sequencePortPenalty(endPort)
    + pathLength(pts);
}

function countIncompatibleSequenceOverlaps(pts, occupied, edge) {
  let count = 0;
  const edgeType = edgeTypeKey(edge);
  const direction = `${edge?.from ?? edge?.sourceId}->${edge?.to ?? edge?.targetId}`;
  for (const segment of collectSegments(pts)) {
    for (const other of occupied) {
      if (!segmentsOverlap(segment.a, segment.b, other.a, other.b)) continue;
      if (other.edgeType !== edgeType || other.direction !== direction) count += 1;
    }
  }
  return count;
}

function optimizeSequenceSharedNodePortSwaps(routes, obstacles) {
  const maxPasses = 3;
  for (let pass = 0; pass < maxPasses; pass++) {
    let changed = false;
    for (let i = 0; i < routes.length; i++) {
      for (let j = i + 1; j < routes.length; j++) {
        const a = routes[i];
        const b = routes[j];
        const role = sharedSequencePortRole(a.info, b.info);
        if (!role || !routesCross(a.pts, b.pts)) continue;
        const improved = trySequencePortSwap(routes, i, j, role, obstacles);
        if (improved) changed = true;
      }
    }
    if (!changed) break;
  }
}

function sharedSequencePortRole(a, b) {
  const aFrom = String(a.edge.from ?? a.edge.sourceId);
  const bFrom = String(b.edge.from ?? b.edge.sourceId);
  if (aFrom === bFrom) return 'start';
  const aTo = String(a.edge.to ?? a.edge.targetId);
  const bTo = String(b.edge.to ?? b.edge.targetId);
  if (aTo === bTo) return 'end';
  return null;
}

function routesCross(ptsA, ptsB) {
  for (const a of collectSegments(ptsA || [])) {
    for (const b of collectSegments(ptsB || [])) {
      if (segmentsCross(a.a, a.b, b.a, b.b)) return true;
    }
  }
  return false;
}

function trySequencePortSwap(routes, indexA, indexB, role, obstacles) {
  const routeA = routes[indexA];
  const routeB = routes[indexB];
  const swappedA = {
    startPort: role === 'start' ? routeB.startPort : routeA.startPort,
    endPort: role === 'end' ? routeB.endPort : routeA.endPort,
  };
  const swappedB = {
    startPort: role === 'start' ? routeA.startPort : routeB.startPort,
    endPort: role === 'end' ? routeA.endPort : routeB.endPort,
  };
  if (!swappedA.startPort || !swappedA.endPort || !swappedB.startPort || !swappedB.endPort) return false;

  const baseOccupied = buildSequenceOccupied(routes, new Set([routeA.info.edge.id, routeB.info.edge.id]));
  const currentScore = scoreSequencePair(routeA, routeB, baseOccupied, obstacles);
  const nextA = bestSequenceRouteForPorts(routeA.info, swappedA.startPort, swappedA.endPort, baseOccupied, obstacles);
  const occupiedAfterA = [
    ...baseOccupied,
    ...sequenceOccupiedSegments(nextA.pts, nextA.info.edge, nextA.edgeType),
  ];
  const nextB = bestSequenceRouteForPorts(routeB.info, swappedB.startPort, swappedB.endPort, occupiedAfterA, obstacles);
  const proposedScore = scoreSequencePair(nextA, nextB, baseOccupied, obstacles);

  if (proposedScore + 0.01 >= currentScore) return false;
  routes[indexA] = nextA;
  routes[indexB] = nextB;
  return true;
}

function bestSequenceRouteForPorts(info, startPort, endPort, occupied, obstacles) {
  const edgeType = edgeTypeKey(info.edge);
  const candidates = sequencePathCandidates(info.edge, startPort, endPort, info)
    .map(pts => {
      const clean = cleanPtsPreservingTerminals(pts);
      return {
        info,
        pts: clean,
        startPort,
        endPort,
        edgeType,
        score: sequenceRouteScore(clean, occupied, obstacles, info, startPort, endPort),
      };
    })
    .sort((a, b) => a.score - b.score);
  return candidates[0] || { info, pts: [], startPort, endPort, edgeType };
}

function scoreSequencePair(routeA, routeB, baseOccupied, obstacles) {
  const scoreA = sequenceRouteScore(routeA.pts, baseOccupied, obstacles, routeA.info, routeA.startPort, routeA.endPort);
  const occupiedAfterA = [
    ...baseOccupied,
    ...sequenceOccupiedSegments(routeA.pts, routeA.info.edge, routeA.edgeType),
  ];
  const scoreB = sequenceRouteScore(routeB.pts, occupiedAfterA, obstacles, routeB.info, routeB.startPort, routeB.endPort);
  return scoreA + scoreB;
}

function buildSequenceOccupied(routes, excludeEdgeIds = new Set()) {
  return routes
    .filter(route => !excludeEdgeIds.has(route.info.edge.id))
    .flatMap(route => sequenceOccupiedSegments(route.pts, route.info.edge, route.edgeType));
}

function sequenceOccupiedSegments(pts, edge, edgeType) {
  const direction = `${edge.from ?? edge.sourceId}->${edge.to ?? edge.targetId}`;
  return collectSegments(pts || []).map(segment => ({
    ...segment,
    edgeId: edge.id,
    edgeType,
    direction,
  }));
}

function sequencePortPenalty(port) {
  const offset = Math.abs((port?.pt?.y ?? 0) - (port?.centerY ?? port?.pt?.y ?? 0));
  return offset * 20 + (port?.dir?.startsWith('Bif') ? 800 : 0) + (port?.sideFallback ? 50000 : 0);
}

function sequenceSidePortCandidates(box, side) {
  const sign = side === 'right' ? 1 : -1;
  const x = side === 'right' ? box.right : box.left;
  const maxOffset = Math.max(0, (box.bottom - box.top) / 2 - 8);
  const offsets = [0, -GRID.step, GRID.step, -GRID.step * 2, GRID.step * 2, -GRID.step * 3, GRID.step * 3]
    .filter(offset => Math.abs(offset) <= maxOffset + 0.01);
  if (!offsets.includes(0)) offsets.unshift(0);
  return offsets.map((offset, index) => ({
    pt: { x, y: box.cy + offset },
    anchorPt: { x, y: box.cy + offset },
    centerY: box.cy,
    axis: 'H',
    sign,
    dir: side === 'right' ? (index === 0 ? 'Right' : 'BifRight') : (index === 0 ? 'Left' : 'BifLeft'),
  }));
}

function edgeTypeKey(edge) {
  return `${edge?.lineStyle || 'solid'}-${edge?.arrowType || edge?.connectionType || 'target'}`;
}

function erdCandidates(info) {
  const dirs = preferredErdDirections(info);
  const out = [];
  for (const startDir of dirs.start) {
    for (const endDir of dirs.end) {
      const start = sidePoint(info.startBox, startDir);
      const end = sidePoint(info.endBox, endDir);
      out.push(...orthogonalCandidates(start, end, startDir, endDir, GRID.step * 2));
    }
  }
  return out;
}

function preferredErdDirections(info) {
  const dx = info.endBox.cx - info.startBox.cx;
  const dy = info.endBox.cy - info.startBox.cy;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? { start: ['right', 'top', 'bottom'], end: ['left', 'top', 'bottom'] }
      : { start: ['left', 'top', 'bottom'], end: ['right', 'top', 'bottom'] };
  }
  return dy >= 0
    ? { start: ['bottom', 'right', 'left'], end: ['top', 'right', 'left'] }
    : { start: ['top', 'right', 'left'], end: ['bottom', 'right', 'left'] };
}

function orthogonalCandidates(start, end, startDir, endDir, stubLen = GRID.step) {
  const startStub = stubPoint(start, startDir, stubLen);
  const endStub = stubPoint(end, endDir, stubLen);
  const candidates = [];
  if (Math.abs(startStub.y - endStub.y) < 1 || Math.abs(startStub.x - endStub.x) < 1) {
    candidates.push(cleanPts([start, startStub, endStub, end]));
  }
  candidates.push(cleanPts([start, startStub, { x: endStub.x, y: startStub.y }, endStub, end]));
  candidates.push(cleanPts([start, startStub, { x: startStub.x, y: endStub.y }, endStub, end]));
  const midX = snap((startStub.x + endStub.x) / 2);
  const midY = snap((startStub.y + endStub.y) / 2);
  candidates.push(cleanPts([start, startStub, { x: midX, y: startStub.y }, { x: midX, y: endStub.y }, endStub, end]));
  candidates.push(cleanPts([start, startStub, { x: startStub.x, y: midY }, { x: endStub.x, y: midY }, endStub, end]));
  return candidates.filter(pts => pts.length >= 2);
}

function erdScore(pts, occupied, obstacles, info) {
  const blocked = countObstacleCrossings(pts, obstacles, info);
  const crossings = countCrossings(pts, occupied);
  const overlaps = countOverlaps(pts, occupied);
  const bends = countBends(pts);
  const length = pathLength(pts);
  return blocked * 1000000000 + crossings * 1000000 + overlaps * 100000 + bends * 10000 + length;
}

function erdObstacles(allNodes, padding) {
  return allNodes
    .filter(node => node.type !== 'text' && node.type !== 'title')
    .map(node => {
      const b = getTrueBox(node);
      return {
        id: String(node.id),
        left: b.left - padding,
        right: b.right + padding,
        top: b.top - padding,
        bottom: b.bottom + padding,
      };
    });
}

function countObstacleCrossings(pts, obstacles, info) {
  let count = 0;
  const own = new Set([String(info.edge.from ?? info.edge.sourceId), String(info.edge.to ?? info.edge.targetId)]);
  for (const segment of collectSegments(pts)) {
    for (const obstacle of obstacles) {
      if (own.has(obstacle.id)) continue;
      if (segmentCrossesBox(segment.a, segment.b, obstacle)) count += 1;
    }
  }
  return count;
}

function countCrossings(pts, occupied) {
  let count = 0;
  for (const segment of collectSegments(pts)) {
    for (const other of occupied) {
      if (segmentsCross(segment.a, segment.b, other.a, other.b)) count += 1;
    }
  }
  return count;
}

function countOverlaps(pts, occupied) {
  let count = 0;
  for (const segment of collectSegments(pts)) {
    for (const other of occupied) {
      if (segmentsOverlap(segment.a, segment.b, other.a, other.b)) count += 1;
    }
  }
  return count;
}

function centerOrthogonalPts(info) {
  const start = { x: info.startBox.cx, y: info.startBox.cy };
  const end = { x: info.endBox.cx, y: info.endBox.cy };
  return cleanPts([start, { x: end.x, y: start.y }, end]);
}

function pathResult(pts, edge, options = {}) {
  const clean = options.preserveTerminals ? cleanPtsPreservingTerminals(pts) : cleanPts(pts);
  const textPts = options.preserveTerminals ? cleanPts(clean) : clean;
  const segments = routeSegments(textPts);
  const text = chooseTextPath(segments, edge, options);
  return {
    pts: clean,
    pathD: pathFromPts(clean, options),
    textPathD: text.d,
    textPathLen: text.len,
    textPathStartOffset: text.startOffset,
    textPathTextAnchor: text.textAnchor,
  };
}

function chooseTextPath(segments, edge, options) {
  const markerPad = edgeHasEndMarker(edge) ? ARROW_MARKER_LENGTH + LABEL_TO_ARROW_GAP : 0;
  const labelWindow = sequenceLabelWindow(edge);
  const candidates = segments
    .map(segment => trimForEndMarker(segment, segment.index === segments.length - 1 ? markerPad : 0))
    .filter(Boolean)
    .sort((a, b) => options.preferLongest
      ? b.len - a.len
      : Math.abs(a.index - (segments.length - 1) / 2) - Math.abs(b.index - (segments.length - 1) / 2) || b.len - a.len);
  const segment = options.sequenceLabelWindow
    ? chooseSequenceLabelSegment(candidates, labelWindow)
    : (candidates[0] || segments[0]);
  if (!segment) return { d: '', len: 0 };
  const a = textStart(segment.p1, segment.p2);
  const b = pointsEqual(a, segment.p1) ? segment.p2 : segment.p1;
  const text = { d: `M ${a.x} ${a.y} L ${b.x} ${b.y}`, len: segment.len };
  if (options.sequenceLabelWindow) {
    const sourceAtTextStart = pointsEqual(a, segment.p1);
    const gap = Math.min(segment.labelGap ?? SEQUENCE_LABEL_TIGHT_GAP, Math.max(0, segment.len));
    text.startOffset = sourceAtTextStart ? gap : Math.max(0, segment.len - gap);
    text.textAnchor = sourceAtTextStart ? 'start' : 'end';
  }
  return text;
}

function sequenceLabelWindow(edge) {
  if (!edge?.label) return { preferredLen: 48, tightLen: 48 };
  const textWidth = Math.ceil(String(edge.label).length * SEQUENCE_LABEL_CHAR_WIDTH);
  const renderPadding = SEQUENCE_LABEL_BASE_PADDING
    + (edgeHasEndMarker(edge) ? SEQUENCE_LABEL_ARROW_PADDING : 0)
    + (edgeHasStartMarker(edge) ? SEQUENCE_LABEL_ARROW_PADDING : 0);
  return {
    preferredLen: textWidth + renderPadding + SEQUENCE_LABEL_PREFERRED_GAP * 2,
    tightLen: textWidth + renderPadding + SEQUENCE_LABEL_TIGHT_GAP * 2,
  };
}

function chooseSequenceLabelSegment(candidates, labelWindow) {
  if (candidates.length === 0) return null;
  const preferredLen = Math.max(44, labelWindow.preferredLen);
  const tightLen = Math.max(44, labelWindow.tightLen);
  const usable = candidates.find(segment => segment.len >= tightLen);
  const segment = usable || [...candidates].sort((a, b) => b.len - a.len)[0];
  if (!segment) return null;
  const usesPreferredGap = segment.len >= preferredLen;
  const targetLen = Math.min(segment.len, usesPreferredGap ? preferredLen : tightLen);
  return cropSegmentFromStart(segment, targetLen, usesPreferredGap ? SEQUENCE_LABEL_PREFERRED_GAP : SEQUENCE_LABEL_TIGHT_GAP);
}

function cropSegmentFromStart(segment, targetLen, labelGap = SEQUENCE_LABEL_TIGHT_GAP) {
  if (!segment) return segment;
  if (segment.len <= targetLen) return { ...segment, labelGap };
  const dx = segment.p2.x - segment.p1.x;
  const dy = segment.p2.y - segment.p1.y;
  const ratio = targetLen / segment.len;
  return {
    ...segment,
    p2: {
      x: segment.p1.x + dx * ratio,
      y: segment.p1.y + dy * ratio,
    },
    len: targetLen,
    labelGap,
  };
}

function trimForEndMarker(segment, markerPad) {
  if (!markerPad) return segment;
  const { p1, p2 } = segment;
  if (segment.len <= markerPad + 8) return null;
  return {
    ...segment,
    p2: {
      x: p2.x - Math.sign(p2.x - p1.x) * markerPad,
      y: p2.y - Math.sign(p2.y - p1.y) * markerPad,
    },
    len: segment.len - markerPad,
  };
}

function terminalStubLength(edge, role) {
  const hasMarker = role === 'start' ? edgeHasStartMarker(edge) : edgeHasEndMarker(edge);
  return hasMarker ? ARROW_MARKER_LENGTH + LABEL_TO_ARROW_GAP + 15 : GRID.step;
}

function textStart(a, b) {
  if (Math.abs(a.x - b.x) >= Math.abs(a.y - b.y)) return a.x <= b.x ? a : b;
  return a.y >= b.y ? a : b;
}

function pointsEqual(a, b) {
  return Math.abs(a.x - b.x) < 0.01 && Math.abs(a.y - b.y) < 0.01;
}

function routeSegments(pts) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    out.push({ p1: pts[i], p2: pts[i + 1], len: segmentLen(pts[i], pts[i + 1]), index: i });
  }
  return out;
}

function collectSegments(pts) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) out.push({ a: pts[i], b: pts[i + 1] });
  return out;
}

function sidePort(box, side) {
  if (side === 'right') return { x: box.right, y: box.cy };
  if (side === 'left') return { x: box.left, y: box.cy };
  if (side === 'top') return { x: box.cx, y: box.top };
  return { x: box.cx, y: box.bottom };
}

function sidePoint(box, side) {
  return sidePort(box, side);
}

function stubPoint(point, side, len) {
  if (side === 'right') return { x: point.x + len, y: point.y };
  if (side === 'left') return { x: point.x - len, y: point.y };
  if (side === 'top') return { x: point.x, y: point.y - len };
  return { x: point.x, y: point.y + len };
}

function pathFromPts(pts) {
  if (!pts.length) return '';
  return pts.map((pt, index) => `${index === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`).join(' ');
}

function cleanPts(pts) {
  const out = [];
  for (const pt of pts) {
    if (!pt) continue;
    const prev = out[out.length - 1];
    if (!prev || Math.abs(prev.x - pt.x) > 0.01 || Math.abs(prev.y - pt.y) > 0.01) out.push(pt);
  }
  const slim = [out[0]];
  for (let i = 1; i < out.length - 1; i++) {
    const prev = slim[slim.length - 1];
    const curr = out[i];
    const next = out[i + 1];
    if ((Math.abs(prev.x - curr.x) < 0.01 && Math.abs(curr.x - next.x) < 0.01)
      || (Math.abs(prev.y - curr.y) < 0.01 && Math.abs(curr.y - next.y) < 0.01)) continue;
    slim.push(curr);
  }
  if (out.length > 1) slim.push(out[out.length - 1]);
  return slim.filter(Boolean);
}

function cleanPtsPreservingTerminals(pts) {
  const out = [];
  for (const pt of pts) {
    if (!pt) continue;
    const prev = out[out.length - 1];
    if (!prev || Math.abs(prev.x - pt.x) > 0.01 || Math.abs(prev.y - pt.y) > 0.01) out.push(pt);
  }
  const slim = [out[0]];
  for (let i = 1; i < out.length - 1; i++) {
    const isTerminalStub = i === 1 || i === out.length - 2;
    const prev = slim[slim.length - 1];
    const curr = out[i];
    const next = out[i + 1];
    if (!isTerminalStub && ((Math.abs(prev.x - curr.x) < 0.01 && Math.abs(curr.x - next.x) < 0.01)
      || (Math.abs(prev.y - curr.y) < 0.01 && Math.abs(curr.y - next.y) < 0.01))) continue;
    slim.push(curr);
  }
  if (out.length > 1) slim.push(out[out.length - 1]);
  return slim.filter(Boolean);
}

function snap(value) {
  return Math.round(value / GRID.step) * GRID.step;
}

function snapLeft(value) {
  return Math.floor(value / GRID.step) * GRID.step;
}

function snapRight(value) {
  return Math.ceil(value / GRID.step) * GRID.step;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function segmentLen(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function pathLength(pts) {
  return collectSegments(pts).reduce((sum, segment) => sum + segmentLen(segment.a, segment.b), 0);
}

function countBends(pts) {
  let bends = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const prevH = Math.abs(pts[i].y - pts[i - 1].y) < 0.01;
    const nextH = Math.abs(pts[i + 1].y - pts[i].y) < 0.01;
    if (prevH !== nextH) bends += 1;
  }
  return bends;
}

function segmentsCross(a, b, c, d) {
  const abH = Math.abs(a.y - b.y) < 0.01;
  const cdH = Math.abs(c.y - d.y) < 0.01;
  if (abH === cdH) return false;
  const h1 = abH ? a : c;
  const h2 = abH ? b : d;
  const v1 = abH ? c : a;
  const v2 = abH ? d : b;
  return v1.x > Math.min(h1.x, h2.x) + 0.5
    && v1.x < Math.max(h1.x, h2.x) - 0.5
    && h1.y > Math.min(v1.y, v2.y) + 0.5
    && h1.y < Math.max(v1.y, v2.y) - 0.5;
}

function segmentsOverlap(a, b, c, d) {
  const abH = Math.abs(a.y - b.y) < 0.01;
  const cdH = Math.abs(c.y - d.y) < 0.01;
  if (abH !== cdH) return false;
  if (abH) {
    if (Math.abs(a.y - c.y) > 0.01) return false;
    return rangeOverlap(a.x, b.x, c.x, d.x) > 0.5;
  }
  if (Math.abs(a.x - c.x) > 0.01) return false;
  return rangeOverlap(a.y, b.y, c.y, d.y) > 0.5;
}

function segmentCrossesBox(a, b, box) {
  if (Math.abs(a.y - b.y) < 0.01) {
    const minX = Math.min(a.x, b.x);
    const maxX = Math.max(a.x, b.x);
    return a.y >= box.top - 0.01
      && a.y <= box.bottom + 0.01
      && Math.max(minX, box.left) <= Math.min(maxX, box.right);
  }
  if (Math.abs(a.x - b.x) < 0.01) {
    const minY = Math.min(a.y, b.y);
    const maxY = Math.max(a.y, b.y);
    return a.x >= box.left - 0.01
      && a.x <= box.right + 0.01
      && Math.max(minY, box.top) <= Math.min(maxY, box.bottom);
  }
  return true;
}

function rangeOverlap(a1, a2, b1, b2) {
  return Math.max(0, Math.min(Math.max(a1, a2), Math.max(b1, b2)) - Math.max(Math.min(a1, a2), Math.min(b1, b2)));
}

function edgeHasEndMarker(edge) {
  const type = edge?.connectionType || edge?.arrowType || 'target';
  return type === 'target' || type === 'both' || type === 'arrow';
}

function edgeHasStartMarker(edge) {
  const type = edge?.connectionType || edge?.arrowType || 'target';
  return type === 'reverse' || type === 'both';
}

export function buildEdgeInfos(edges, allNodes) {
  return edges.map(edge => {
    const startNode = allNodes.find(n => String(n.id) === String(edge.from ?? edge.sourceId));
    const endNode = allNodes.find(n => String(n.id) === String(edge.to ?? edge.targetId));
    if (!startNode || !endNode) return null;
    const startBox = getTrueBox(startNode);
    const endBox = getTrueBox(endNode);
    return {
      edge,
      startNode,
      endNode,
      startBox,
      endBox,
      dist: Math.abs(endBox.cx - startBox.cx) + Math.abs(endBox.cy - startBox.cy),
    };
  }).filter(Boolean);
}
