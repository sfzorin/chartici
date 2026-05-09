import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseCharticiFile } from '../utils/charticiFormat.js';
import { layoutNodesHeuristically } from '../utils/nodeLayouter.js';
import { calculateAllPaths } from '../utils/engine/index.js';
import { getNodeDim } from '../diagram/nodes.jsx';
import { EDGE_LABEL_STYLE } from '../diagram/edges.js';

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

console.log('\n🎯 Render quality smoke test');

const files = fs.readdirSync(samplesDir).filter(f => f.endsWith('.cci')).sort();

for (const file of files) {
  const fullPath = path.join(samplesDir, file);
  const parsed = parseCharticiFile(fs.readFileSync(fullPath, 'utf8'));
  const type = parsed.meta?.type || 'flowchart';
  const nodes = layoutNodesHeuristically(parsed.nodes, parsed.edges, { diagramType: type, groups: parsed.groups });
  const paths = calculateAllPaths(parsed.edges, nodes, { diagramType: type });
  const visibleEdges = visibleEdgesFor(type, nodes, parsed.edges);

  for (const edge of visibleEdges) {
    const pathData = paths[edge.id];
    assert.ok(pathData, `${file}: missing rendered path for edge ${edge.id}`);
    assert.ok(isFinitePath(pathData.pathD), `${file}: invalid SVG path for edge ${edge.id}`);
    assert.ok(pathData.pts?.length >= 2, `${file}: edge ${edge.id} has no route points`);
    assert.ok(edgeLabelFits(type, edge, pathData), `${file}: edge ${edge.id} label does not fit`);

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
    visibleEdges
      .filter(edge => hasPath(visibleEdges, edgeTo(edge), edgeFrom(edge), edge.id))
      .forEach(edge => {
        const src = nodes.find(n => String(n.id) === String(edgeFrom(edge)));
        const dst = nodes.find(n => String(n.id) === String(edgeTo(edge)));
        const allowed = Math.max(520, Math.min(720, String(edge.label || '').length * 16 + 360));
        assert.ok(distance(src, dst) <= allowed, `${file}: feedback edge ${edge.id} stretches related steps too far apart`);
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
