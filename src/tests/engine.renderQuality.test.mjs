import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseCharticiFile } from '../utils/charticiFormat.js';
import { layoutNodesHeuristically } from '../utils/nodeLayouter.js';
import { calculateAllPaths } from '../utils/engine/index.js';
import { getNodeDim } from '../diagram/nodes.jsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');
const samplesDir = path.join(rootDir, 'public/samples');

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

  if (type === 'piechart') {
    const slices = nodes.filter(n => n.type === 'pie_slice');
    assert.ok(slices.length >= 2, `${file}: piechart has too few rendered slices`);
    assert.ok(slices.every(s => Number.isFinite(s.pieStartAngle) && Number.isFinite(s.pieEndAngle)), `${file}: piechart has invalid slice angles`);
  }

  console.log(`  ✅ ${file}: ${type}, visibleEdges=${visibleEdges.length}`);
}
