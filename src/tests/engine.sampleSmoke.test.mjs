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

const files = fs.readdirSync(samplesDir).filter(f => f.endsWith('.cci')).sort();

function countOverlaps(nodes) {
  const realNodes = nodes.filter(n => !['text', 'title', 'pie_slice'].includes(n.type));
  let overlaps = 0;
  for (let i = 0; i < realNodes.length; i++) {
    for (let j = i + 1; j < realNodes.length; j++) {
      const a = realNodes[i];
      const b = realNodes[j];
      const ad = getNodeDim(a);
      const bd = getNodeDim(b);
      const overlapX = Math.abs((a.x || 0) - (b.x || 0)) < (ad.width + bd.width) / 2 + 8;
      const overlapY = Math.abs((a.y || 0) - (b.y || 0)) < (ad.height + bd.height) / 2 + 8;
      if (overlapX && overlapY) overlaps++;
    }
  }
  return overlaps;
}

console.log('\n🧯 Public sample smoke test');

for (const file of files) {
  const fullPath = path.join(samplesDir, file);
  const parsed = parseCharticiFile(fs.readFileSync(fullPath, 'utf8'));
  const type = parsed.meta?.type || 'flowchart';
  const laidOut = layoutNodesHeuristically(parsed.nodes, parsed.edges, { diagramType: type, groups: parsed.groups });
  const paths = calculateAllPaths(parsed.edges, laidOut, { diagramType: type });
  const pathCount = Object.keys(paths).length;
  const overlaps = countOverlaps(laidOut);

  assert.ok(parsed.nodes.length > 0, `${file}: no nodes`);
  if (!['matrix', 'piechart'].includes(type)) {
    assert.ok(parsed.edges.length > 0, `${file}: no edges`);
    assert.ok(pathCount > 0, `${file}: no rendered paths`);
  }
  assert.strictEqual(overlaps, 0, `${file}: ${overlaps} node overlaps after layout`);

  if (type === 'piechart') {
    assert.ok(laidOut.some(n => n.type === 'pie_slice'), `${file}: no pie slices`);
  }

  console.log(`  ✅ ${file}: ${type}, nodes=${parsed.nodes.length}, edges=${parsed.edges.length}, paths=${pathCount}`);
}
