import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseCharticiFile } from '../utils/charticiFormat.js';
import { layoutNodesHeuristically } from '../utils/nodeLayouter.js';
import { calculateAllPaths } from '../utils/engine/index.js';
import { getNodeDim } from '../diagram/nodes.jsx';
import { EDGE_LABEL_STYLE } from '../diagram/edges.js';
import { getDiagramRules } from '../utils/diagramRules.js';
import {
  getEdgeLabelPolicy,
  getEdgeLabelStyle,
  getManualEdgeLabelPlacement,
} from '../diagram/edgeLabelPlacement.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');
const samplesDir = path.join(rootDir, 'samples');

const EPS = 0.001;

function edgeFrom(edge) {
  return edge.from ?? edge.sourceId;
}

function edgeTo(edge) {
  return edge.to ?? edge.targetId;
}

function isFinitePath(pathD) {
  return Boolean(pathD)
    && !/NaN|Infinity|-Infinity/.test(pathD)
    && (pathD.match(/-?\d+(?:\.\d+)?/g) || []).every(n => Number.isFinite(Number(n)));
}

function nodeRadius(node) {
  const dim = getNodeDim(node);
  return Math.min(dim.width, dim.height) / 2;
}

function distance(a, b) {
  return Math.hypot((a.x || 0) - (b.x || 0), (a.y || 0) - (b.y || 0));
}

function radialDeviation(edge, nodes, pathData) {
  const src = nodes.find(n => String(n.id) === String(edgeFrom(edge)));
  const dst = nodes.find(n => String(n.id) === String(edgeTo(edge)));
  if (!src || !dst || !pathData?.pts || pathData.pts.length < 2) return 0;
  const [sp, ep] = pathData.pts;
  const centerDx = (dst.x || 0) - (src.x || 0);
  const centerDy = (dst.y || 0) - (src.y || 0);
  const pathDx = ep.x - sp.x;
  const pathDy = ep.y - sp.y;
  const denom = Math.hypot(centerDx, centerDy) * Math.hypot(pathDx, pathDy);
  if (denom < EPS) return 0;
  return Math.abs(centerDx * pathDy - centerDy * pathDx) / denom;
}

function visibleEdgesFor(type, nodes, edges) {
  return edges.filter(edge => {
    const src = nodes.find(n => String(n.id) === String(edgeFrom(edge)));
    const dst = nodes.find(n => String(n.id) === String(edgeTo(edge)));
    if (!src || !dst) return false;
    if (edge.lineStyle === 'none') return false;
    if (type === 'timeline' && src?.isTimelineSpine && dst?.isTimelineSpine) return false;
    return true;
  });
}

function edgeLabelFits(type, edge, pathData) {
  if (!edge.label || type !== 'erd') return true;
  return Boolean(pathData.textPathD) && (pathData.textPathLen || 0) >= 36;
}

function sequenceLabelFits(edge, pathData) {
  if (!edge.label) return true;
  const required = String(edge.label).length * Math.max(8, EDGE_LABEL_STYLE.charWidth || 7.4) + 34;
  return Boolean(pathData?.textPathD) && (pathData.textPathLen || 0) >= Math.min(180, required);
}

function requiredLabelSpace(label, extra = 34, cap = 180) {
  if (!label) return 0;
  const width = String(label).length * Math.max(8, EDGE_LABEL_STYLE.charWidth || 7.4) + extra;
  return Math.min(cap, width);
}

function hasPath(edges, start, goal, skipEdgeId) {
  const target = String(goal);
  const queue = [String(start)];
  const seen = new Set(queue);
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === target) return true;
    edges.forEach(edge => {
      if (skipEdgeId && String(edge.id) === String(skipEdgeId)) return;
      if (String(edgeFrom(edge)) !== current) return;
      const next = String(edgeTo(edge));
      if (seen.has(next)) return;
      seen.add(next);
      queue.push(next);
    });
  }
  return false;
}

function boundsOf(nodes) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const n of nodes) {
    const dim = getNodeDim(n);
    minX = Math.min(minX, (n.x || 0) - dim.width / 2);
    maxX = Math.max(maxX, (n.x || 0) + dim.width / 2);
    minY = Math.min(minY, (n.y || 0) - dim.height / 2);
    maxY = Math.max(maxY, (n.y || 0) + dim.height / 2);
  }
  return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
}

function pathSegments(edge, pathData) {
  const pts = pathData?.pts || [];
  const segments = [];
  for (let i = 0; i < pts.length - 1; i++) {
    segments.push({ edge, p1: pts[i], p2: pts[i + 1], index: i, count: pts.length - 1 });
  }
  return segments;
}

function isPointOnSegmentInterior(point, segment) {
  const { p1, p2 } = segment;
  const margin = 0.5;
  if (Math.abs(p1.y - p2.y) < EPS && Math.abs(point.y - p1.y) < EPS) {
    const minX = Math.min(p1.x, p2.x);
    const maxX = Math.max(p1.x, p2.x);
    return point.x > minX + margin && point.x < maxX - margin;
  }
  if (Math.abs(p1.x - p2.x) < EPS && Math.abs(point.x - p1.x) < EPS) {
    const minY = Math.min(p1.y, p2.y);
    const maxY = Math.max(p1.y, p2.y);
    return point.y > minY + margin && point.y < maxY - margin;
  }
  return false;
}

function assertNoCornerKisses(file, visibleEdges, paths) {
  const segments = visibleEdges.flatMap(edge => pathSegments(edge, paths[edge.id]));

  visibleEdges.forEach(edge => {
    const pts = paths[edge.id]?.pts || [];
    for (let i = 1; i < pts.length - 1; i++) {
      const bend = pts[i];
      segments
        .filter(segment => String(segment.edge.id) !== String(edge.id))
        .forEach(segment => {
          assert.ok(
            !isPointOnSegmentInterior(bend, segment),
            `${file}: edge ${edge.id} bend lands on edge ${segment.edge.id}`
          );
        });
    }
  });
}

function segmentCrossesBox(a, b, box) {
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

function paddedNodeBox(node, padding) {
  const dim = getNodeDim(node);
  return {
    left: (node.x || 0) - dim.width / 2 - padding,
    right: (node.x || 0) + dim.width / 2 + padding,
    top: (node.y || 0) - dim.height / 2 - padding,
    bottom: (node.y || 0) + dim.height / 2 + padding,
  };
}

function assertNoForeignNodeZoneCrossings(file, type, nodes, visibleEdges, paths) {
  const padding = getDiagramRules(type).routing.PADDING || 0;
  visibleEdges.forEach(edge => {
    const pts = paths[edge.id]?.pts || [];
    const own = new Set([String(edgeFrom(edge)), String(edgeTo(edge))]);
    nodes
      .filter(node => !own.has(String(node.id)) && node.type !== 'text' && node.type !== 'title')
      .forEach(node => {
        const box = paddedNodeBox(node, padding);
        for (let i = 0; i < pts.length - 1; i++) {
          assert.ok(
            !segmentCrossesBox(pts[i], pts[i + 1], box),
            `${file}: edge ${edge.id} crosses protected zone of node ${node.id}`
          );
        }
      });
  });
}

function overlapLength(a, b) {
  const aH = Math.abs(a.p1.y - a.p2.y) < EPS;
  const bH = Math.abs(b.p1.y - b.p2.y) < EPS;
  if (aH !== bH) return 0;
  if (aH) {
    if (Math.abs(a.p1.y - b.p1.y) > EPS) return 0;
    return Math.max(0, Math.min(Math.max(a.p1.x, a.p2.x), Math.max(b.p1.x, b.p2.x)) - Math.max(Math.min(a.p1.x, a.p2.x), Math.min(b.p1.x, b.p2.x)));
  }
  if (Math.abs(a.p1.x - b.p1.x) > EPS) return 0;
  return Math.max(0, Math.min(Math.max(a.p1.y, a.p2.y), Math.max(b.p1.y, b.p2.y)) - Math.max(Math.min(a.p1.y, a.p2.y), Math.min(b.p1.y, b.p2.y)));
}

function assertNoLineMerging(file, nodes, visibleEdges, paths) {
  const segments = visibleEdges.flatMap(edge => pathSegments(edge, paths[edge.id]));
  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      if (String(segments[i].edge.id) === String(segments[j].edge.id)) continue;
      if (canMergeDecisionFanIn(nodes, segments[i].edge, segments[j].edge)) continue;
      const len = overlapLength(segments[i], segments[j]);
      assert.ok(len <= 0.5, `${file}: edge ${segments[i].edge.id} overlaps edge ${segments[j].edge.id} for ${len}px`);
    }
  }
}

function canMergeDecisionFanIn(nodes, edgeA, edgeB) {
  const targetA = String(edgeTo(edgeA));
  const targetB = String(edgeTo(edgeB));
  if (!targetA || targetA !== targetB) return false;
  const target = nodes.find(node => String(node.id) === targetA);
  return target?.type === 'rhombus';
}

function edgeMarkerType(edge) {
  return edge.connectionType || edge.arrowType || 'target';
}

function hasEndMarker(edge) {
  const type = edgeMarkerType(edge);
  return type === 'target' || type === 'both' || type === 'arrow';
}

function hasStartMarker(edge) {
  const type = edgeMarkerType(edge);
  return type === 'reverse' || type === 'both';
}

function segmentIntersection(a, b, c, d) {
  const aH = Math.abs(a.y - b.y) < EPS;
  const cH = Math.abs(c.y - d.y) < EPS;
  if (aH === cH) return null;
  const h1 = aH ? a : c;
  const h2 = aH ? b : d;
  const v1 = aH ? c : a;
  const v2 = aH ? d : b;
  const minX = Math.min(h1.x, h2.x);
  const maxX = Math.max(h1.x, h2.x);
  const minY = Math.min(v1.y, v2.y);
  const maxY = Math.max(v1.y, v2.y);
  const margin = 0.5;
  if (v1.x <= minX + margin || v1.x >= maxX - margin) return null;
  if (h1.y <= minY + margin || h1.y >= maxY - margin) return null;
  return { x: v1.x, y: h1.y };
}

function isArrowTerminalSegment(segment) {
  return (segment.index === 0 && hasStartMarker(segment.edge))
    || (segment.index === segment.count - 1 && hasEndMarker(segment.edge));
}

function assertNoFlowchartCrossings(file, visibleEdges, paths) {
  const segments = visibleEdges.flatMap(edge => pathSegments(edge, paths[edge.id]));
  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      const a = segments[i];
      const b = segments[j];
      if (String(a.edge.id) === String(b.edge.id)) continue;
      const point = segmentIntersection(a.p1, a.p2, b.p1, b.p2);
      assert.ok(!point, `${file}: edge ${a.edge.id} crosses edge ${b.edge.id} at ${point?.x},${point?.y}`);
    }
  }
}

function assertNoArrowApproachCrossings(file, visibleEdges, paths) {
  const segments = visibleEdges.flatMap(edge => pathSegments(edge, paths[edge.id]));
  const arrowSegments = segments.filter(isArrowTerminalSegment);
  for (const arrowSegment of arrowSegments) {
    for (const segment of segments) {
      if (String(segment.edge.id) === String(arrowSegment.edge.id)) continue;
      const point = segmentIntersection(arrowSegment.p1, arrowSegment.p2, segment.p1, segment.p2);
      const hasVisualBreak = point && (
        pathHasBreakNear(paths[segment.edge.id]?.pathD, point)
        || pathHasBreakNear(paths[arrowSegment.edge.id]?.pathD, point)
      );
      assert.ok(
        !point || hasVisualBreak,
        `${file}: edge ${segment.edge.id} crosses arrow approach of edge ${arrowSegment.edge.id} at ${point?.x},${point?.y}`
      );
    }
  }
}

function assertWideCrossingBreaksOnlyCoverLabels(file, visibleEdges, paths) {
  const segments = visibleEdges.flatMap(edge => pathSegments(edge, paths[edge.id]));
  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      const a = segments[i];
      const b = segments[j];
      if (String(a.edge.id) === String(b.edge.id)) continue;
      const point = segmentIntersection(a.p1, a.p2, b.p1, b.p2);
      if (!point) continue;

      const aGap = breakGapAtPoint(paths[a.edge.id]?.pathD, point);
      const bGap = breakGapAtPoint(paths[b.edge.id]?.pathD, point);
      const aWide = aGap > 16;
      const bWide = bGap > 16;
      if (!aWide && !bWide) continue;

      const aLabelHere = flowchartLabelContainsPoint(a.edge, paths[a.edge.id], point);
      const bLabelHere = flowchartLabelContainsPoint(b.edge, paths[b.edge.id], point);
      assert.ok(
        (aWide && bLabelHere && !aLabelHere) || (bWide && aLabelHere && !bLabelHere),
        `${file}: wide crossing gap at ${point.x},${point.y} is not protecting a real label`
      );
    }
  }
}

function pathHasBreakNear(pathD, point) {
  if (!pathD || !point) return false;
  const commands = [...pathD.matchAll(/([ML])\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g)];
  let seenFirstMove = false;
  for (const match of commands) {
    const cmd = match[1];
    const x = Number(match[2]);
    const y = Number(match[3]);
    if (cmd !== 'M') continue;
    if (!seenFirstMove) {
      seenFirstMove = true;
      continue;
    }
    if (Math.abs(x - point.x) + Math.abs(y - point.y) <= 22) return true;
  }
  return false;
}

function breakGapAtPoint(pathD, point) {
  if (!pathD || !point) return 0;
  const commands = [...pathD.matchAll(/([ML])\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g)]
    .map(match => ({ cmd: match[1], x: Number(match[2]), y: Number(match[3]) }));
  let maxGap = 0;
  for (let i = 1; i < commands.length; i++) {
    if (commands[i].cmd !== 'M' || commands[i - 1].cmd !== 'L') continue;
    const before = commands[i - 1];
    const after = commands[i];
    if (!pointBetweenBreakEnds(point, before, after)) continue;
    maxGap = Math.max(maxGap, Math.abs(after.x - before.x) + Math.abs(after.y - before.y));
  }
  return maxGap;
}

function pointBetweenBreakEnds(point, before, after) {
  const horizontal = Math.abs(before.y - after.y) < EPS && Math.abs(point.y - before.y) < EPS;
  const vertical = Math.abs(before.x - after.x) < EPS && Math.abs(point.x - before.x) < EPS;
  if (!horizontal && !vertical) return false;
  return point.x >= Math.min(before.x, after.x) - EPS
    && point.x <= Math.max(before.x, after.x) + EPS
    && point.y >= Math.min(before.y, after.y) - EPS
    && point.y <= Math.max(before.y, after.y) + EPS;
}

function flowchartLabelContainsPoint(edge, pathData, point) {
  if (!edge?.label || !pathData?.pts || (pathData.textPathLen || 0) < 36) return false;
  const policy = getEdgeLabelPolicy('flowchart');
  const style = getEdgeLabelStyle(policy);
  const placement = getManualEdgeLabelPlacement({
    labelPolicy: policy,
    displayLabel: edge.label,
    pts: pathData.pts,
    labelStyle: style,
  });
  if (!placement) return false;
  const pad = Math.max(4, EDGE_LABEL_STYLE.haloWidth || 0);
  const angle = -(placement.angle || 0) * Math.PI / 180;
  const dx = point.x - placement.x;
  const dy = point.y - placement.y;
  const localX = dx * Math.cos(angle) - dy * Math.sin(angle);
  const localY = dx * Math.sin(angle) + dy * Math.cos(angle);
  return Math.abs(localX) <= placement.labelWidth / 2 + pad
    && Math.abs(localY) <= placement.labelHeight / 2 + pad;
}

console.log('\n🎯 Render quality smoke test');

const files = fs.readdirSync(samplesDir).filter(f => f.endsWith('.cci')).sort();

for (const file of files) {
  const fullPath = path.join(samplesDir, file);
  const parsed = parseCharticiFile(fs.readFileSync(fullPath, 'utf8'));
  const type = parsed.meta?.type || 'flowchart';
  const nodes = layoutNodesHeuristically(parsed.nodes, parsed.edges, { diagramType: type, groups: parsed.groups });
  const paths = calculateAllPaths(parsed.edges, nodes, { diagramType: type });
  const visibleEdges = visibleEdgesFor(type, nodes, parsed.edges);
  const strictVisibleEdges = visibleEdges.filter(edge => !paths[edge.id]?.isFallback);

  for (const edge of visibleEdges) {
    const pathData = paths[edge.id];
    assert.ok(pathData, `${file}: missing rendered path for edge ${edge.id}`);
    assert.ok(isFinitePath(pathData.pathD), `${file}: invalid SVG path for edge ${edge.id}`);
    assert.ok(pathData.pts?.length >= 2, `${file}: edge ${edge.id} has no route points`);
    assert.ok(edgeLabelFits(type, edge, pathData), `${file}: edge ${edge.id} label does not fit`);
    if (pathData.isFallback) {
      assert.strictEqual(pathData.pts.length, 2, `${file}: fallback edge ${edge.id} should be an obvious center-to-center diagnostic`);
      continue;
    }

    const src = nodes.find(n => String(n.id) === String(edgeFrom(edge)));
    const dst = nodes.find(n => String(n.id) === String(edgeTo(edge)));
    const first = pathData.pts[0];
    const last = pathData.pts[pathData.pts.length - 1];
    assert.ok(distance(first, src) >= nodeRadius(src) - 2, `${file}: edge ${edge.id} starts inside source node`);
    assert.ok(distance(last, dst) >= nodeRadius(dst) - 2, `${file}: edge ${edge.id} ends inside target node`);

    if (type === 'radial') {
      assert.ok(radialDeviation(edge, nodes, pathData) < 0.02, `${file}: radial edge ${edge.id} is not aligned with its ray`);
    }
  }

  if (type === 'timeline') {
    const events = nodes.filter(n => !n.isTimelineSpine && n.spineId);
    const renderedEventLinks = visibleEdges.filter(edge => {
      const src = nodes.find(n => String(n.id) === String(edgeFrom(edge)));
      const dst = nodes.find(n => String(n.id) === String(edgeTo(edge)));
      return src?.isTimelineSpine && dst && !dst.isTimelineSpine;
    });
    assert.ok(renderedEventLinks.length >= events.length, `${file}: timeline events are missing visible spine links`);
  }

  if (type !== 'tree' && type !== 'org_chart') {
    assertNoCornerKisses(file, strictVisibleEdges, paths);
  }

  if (type === 'sequence') {
    const box = boundsOf(nodes.filter(n => n.type !== 'text' && n.type !== 'title'));
    assert.ok(box.width <= 3050, `${file}: sequence layout is too wide`);
    visibleEdges
      .filter(edge => edge.label)
      .forEach(edge => {
        const pathData = paths[edge.id];
        assert.ok((pathData?.textPathLen || 0) >= 56, `${file}: sequence message ${edge.id} has too little label space`);
        assert.ok(sequenceLabelFits(edge, pathData), `${file}: sequence message ${edge.id} label does not fit`);
      });
  }

  if (type === 'piechart') {
    const slices = nodes.filter(n => n.type === 'pie_slice');
    assert.ok(slices.length >= 2, `${file}: piechart has too few rendered slices`);
    assert.ok(slices.every(s => Number.isFinite(s.pieStartAngle) && Number.isFinite(s.pieEndAngle)), `${file}: piechart has invalid slice angles`);
  }

  if (type === 'flowchart') {
    assertNoForeignNodeZoneCrossings(file, type, nodes, strictVisibleEdges, paths);
    assertNoLineMerging(file, nodes, strictVisibleEdges, paths);
    assertNoArrowApproachCrossings(file, strictVisibleEdges, paths);
    assertWideCrossingBreaksOnlyCoverLabels(file, strictVisibleEdges, paths);
    // Ordinary line crossings are allowed as a scored compromise in the new
    // flowchart router. Arrow-approach crossings remain forbidden.

    strictVisibleEdges
      .filter(edge => hasPath(strictVisibleEdges, edgeTo(edge), edgeFrom(edge), edge.id))
      .forEach(edge => {
        const src = nodes.find(n => String(n.id) === String(edgeFrom(edge)));
        const dst = nodes.find(n => String(n.id) === String(edgeTo(edge)));
        const allowed = Math.max(520, Math.min(720, String(edge.label || '').length * 16 + 360));
        assert.ok(distance(src, dst) <= allowed, `${file}: feedback edge ${edge.id} stretches related steps too far apart`);
      });

    nodes
      .filter(node => node.type === 'circle')
      .forEach(node => {
        const incomingPorts = strictVisibleEdges
          .filter(edge => String(edgeTo(edge)) === String(node.id))
          .map(edge => paths[edge.id]?.pts?.at(-1))
          .filter(Boolean);
        const outgoingPorts = strictVisibleEdges
          .filter(edge => String(edgeFrom(edge)) === String(node.id))
          .map(edge => paths[edge.id]?.pts?.[0])
          .filter(Boolean);

        incomingPorts.forEach(inPort => {
          outgoingPorts.forEach(outPort => {
            assert.ok(distance(inPort, outPort) > 8, `${file}: circle node ${node.id} reuses a visual port`);
          });
        });
      });
  }

  if (type === 'erd') {
    visibleEdges.forEach(edge => {
      const src = nodes.find(n => String(n.id) === String(edgeFrom(edge)));
      const dst = nodes.find(n => String(n.id) === String(edgeTo(edge)));
      const allowed = 720 + Math.min(180, String(edge.label || '').length * 10);
      assert.ok(distance(src, dst) <= allowed, `${file}: ERD relationship ${edge.id} stretches entities too far apart`);
      if (edge.label) {
        assert.ok((paths[edge.id]?.textPathLen || 0) >= requiredLabelSpace(edge.label, 34, 120), `${file}: ERD relationship ${edge.id} has too little label space`);
      }
    });
  }

  console.log(`  ✅ ${file}: ${type}, visibleEdges=${visibleEdges.length}`);
}
