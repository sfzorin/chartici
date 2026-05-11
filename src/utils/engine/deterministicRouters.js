import { getTrueBox } from './geometry.js';
import { GRID } from '../../diagram/canvas.js';

const ARROW_MARKER_LENGTH = 20;
const LABEL_TO_ARROW_GAP = 5;
export function routeSequenceDeterministic(edgeInfos) {
  const result = {};
  edgeInfos.forEach(info => {
    const pts = sequencePts(info);
    result[info.edge.id] = pathResult(pts, info.edge, { preferLongest: true, preserveTerminals: true });
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
      const trunkX = columnTrunks.get(treeStackColumnKey(info)) ?? snap(info.endBox.left - padding - GRID.step);
      const pts = buildTreeStackPts(info, sharedY, trunkX);
      result[info.edge.id] = pathResult(cleanPts(pts), info.edge, { preferLongest: true });
    });
  });

  collectTreeSourceGroups(edgeInfos.filter(info => !result[info.edge.id])).forEach(group => {
    const sharedY = chooseTreeSharedY(group.items, obstacles, padding, buildTreeFanoutPts);
    group.items.forEach(info => {
      const pts = buildTreeFanoutPts(info, sharedY);
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
  columns.forEach((items, key) => {
    const left = Math.min(...items.map(info => info.endBox.left));
    out.set(key, snap(left - padding - GRID.step));
  });
  return out;
}

function treeStackColumnKey(info) {
  return String(snap(info.endBox.left));
}

function buildTreeStackPts(info, sharedY, trunkX = snap(info.endBox.left - GRID.step * 2)) {
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

function sequencePts(info) {
  const startRight = info.endBox.cx >= info.startBox.cx;
  const start = sidePort(info.startBox, startRight ? 'right' : 'left');
  const end = sidePort(info.endBox, startRight ? 'left' : 'right');
  const startStubLen = terminalStubLength(info.edge, 'start');
  const endStubLen = terminalStubLength(info.edge, 'end');
  const startStub = {
    x: start.x + (startRight ? startStubLen : -startStubLen),
    y: start.y,
  };
  const endStub = {
    x: end.x + (startRight ? -endStubLen : endStubLen),
    y: end.y,
  };
  if (Math.abs(start.y - end.y) < 1) return cleanPtsPreservingTerminals([start, startStub, endStub, end]);
  return cleanPtsPreservingTerminals([start, startStub, { x: startStub.x, y: endStub.y }, endStub, end]);
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
  };
}

function chooseTextPath(segments, edge, options) {
  const markerPad = edgeHasEndMarker(edge) ? ARROW_MARKER_LENGTH + LABEL_TO_ARROW_GAP : 0;
  const candidates = segments
    .map(segment => trimForEndMarker(segment, markerPad))
    .filter(Boolean)
    .sort((a, b) => options.preferLongest
      ? b.len - a.len
      : Math.abs(a.index - (segments.length - 1) / 2) - Math.abs(b.index - (segments.length - 1) / 2) || b.len - a.len);
  const segment = candidates[0] || segments[0];
  if (!segment) return { d: '', len: 0 };
  const a = textStart(segment.p1, segment.p2);
  const b = a === segment.p1 ? segment.p2 : segment.p1;
  return { d: `M ${a.x} ${a.y} L ${b.x} ${b.y}`, len: segment.len };
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
