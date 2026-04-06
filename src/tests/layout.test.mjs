/**
 * Chartici Layout Tests — Node Placement Validation
 * 
 * Tests that validatenode positioning after layout:
 * - Parent always above children (in TB flow)
 * - No excessive horizontal spread
 * - Dense fan-outs are vertically stacked
 * - No huge vertical gaps between ranks
 * - Rank compactness (nodes at same level close together)
 * 
 * Run: npx tsx src/tests/layout.test.mjs
 */
import fs from 'fs';
import path from 'path';
import { layoutNodesHeuristically } from '../utils/nodeLayouter.js';
import { SIZES } from '../utils/constants.js';
import { parseCharticiFile } from '../utils/charticiFormat.js';

// ─── Load sample ─────────────────────────────────────────────
function loadSample(filePath) {
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  let parsed;
  try {
     parsed = parseCharticiFile(fileContent);
  } catch(e) {
     return { nodes: [], edges: [], diagramType: 'flowchart' };
  }
  
  const nodes = [];
  parsed.nodes.forEach(n => {
    const sz = n.size || 'M';
    const dim = SIZES[sz] || SIZES.M;
    nodes.push({
      ...n,
      type: n.type || 'rect',
      size: sz,
      width: dim.width,
      height: dim.height
    });
  });

  return { nodes, edges: parsed.edges || [], diagramType: parsed.config?.diagramType || 'flowchart', title: path.basename(filePath), aspect: parsed.config?.aspect };
}

// ─── Test Metrics ────────────────────────────────────────────
function analyzeLayout(laidOut, edges, diagramType) {
  const nodeMap = new Map(laidOut.map(n => [n.id, n]));
  const result = {
    parentAboveChild: { pass: 0, fail: 0, violations: [] },
    horizontalSpread: 0,
    verticalSpread: 0,
    maxGap: 0,
    maxGapBetween: '',
    rankCount: 0,
    avgRankGap: 0,
    denseStacked: { expected: 0, actual: 0, violations: [] },
    overlappingNodes: [],
    totalArea: 0,
    filledArea: 0,
    density: 0
  };

  // 1. Parent above child check (TB flow: parent.y < child.y)
  for (const edge of edges) {
    const src = nodeMap.get(edge.from);
    const tgt = nodeMap.get(edge.to);
    if (!src || !tgt) continue;
    
    if (src.y < tgt.y) {
      result.parentAboveChild.pass++;
    } else {
      result.parentAboveChild.fail++;
      result.parentAboveChild.violations.push(
        `${edge.from}(y=${src.y}) → ${edge.to}(y=${tgt.y}): parent NOT above child`
      );
    }
  }

  // 2. Horizontal and vertical spread
  const xs = laidOut.map(n => n.x);
  const ys = laidOut.map(n => n.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  result.horizontalSpread = maxX - minX;
  result.verticalSpread = maxY - minY;

  // 3. Rank analysis (group by Y ±20px)
  const ranks = new Map();
  for (const n of laidOut) {
    const rankY = Math.round(n.y / 40) * 40;
    if (!ranks.has(rankY)) ranks.set(rankY, []);
    ranks.get(rankY).push(n);
  }
  result.rankCount = ranks.size;
  
  const sortedRanks = [...ranks.keys()].sort((a, b) => a - b);
  if (sortedRanks.length > 1) {
    const gaps = [];
    for (let i = 1; i < sortedRanks.length; i++) {
      const gap = sortedRanks[i] - sortedRanks[i - 1];
      gaps.push({ gap, from: sortedRanks[i - 1], to: sortedRanks[i] });
    }
    result.avgRankGap = gaps.reduce((s, g) => s + g.gap, 0) / gaps.length;
    const worst = gaps.reduce((w, g) => g.gap > w.gap ? g : w, gaps[0]);
    result.maxGap = worst.gap;
    
    // Find what nodes are at those ranks
    const fromNodes = ranks.get(worst.from)?.map(n => n.id).join(',') || '';
    const toNodes = ranks.get(worst.to)?.map(n => n.id).join(',') || '';
    result.maxGapBetween = `[${fromNodes}] → [${toNodes}]`;
  }

  // 4. Dense fan-out stacking check
  const childMap = new Map();
  for (const edge of edges) {
    if (!childMap.has(edge.from)) childMap.set(edge.from, []);
    childMap.get(edge.from).push(edge.to);
  }
  const hasChildren = id => (childMap.get(id) || []).length > 0;

  for (const [pid, kids] of childMap) {
    const leafKids = kids.filter(k => !hasChildren(k) && nodeMap.has(k));
    if (leafKids.length > 4) {
      result.denseStacked.expected++;
      
      // Check if they're vertically stacked (all at similar X, different Y)
      const childNodes = leafKids.map(id => nodeMap.get(id)).filter(Boolean);
      const xSpread = Math.max(...childNodes.map(n => n.x)) - Math.min(...childNodes.map(n => n.x));
      const ySpread = Math.max(...childNodes.map(n => n.y)) - Math.min(...childNodes.map(n => n.y));
      
      // Stacked = Y spread >> X spread, and X spread < 300px (max 2 columns)
      if (ySpread > xSpread && xSpread < 300) {
        result.denseStacked.actual++;
      } else {
        result.denseStacked.violations.push(
          `${pid}: ${leafKids.length} leaf children — xSpread=${xSpread} ySpread=${ySpread} (horizontal, not stacked)`
        );
      }
    }
  }

  // 5. Node overlap check
  for (let i = 0; i < laidOut.length; i++) {
    for (let j = i + 1; j < laidOut.length; j++) {
      const a = laidOut[i], b = laidOut[j];
      const aw = (a.width || 120) / 2, ah = (a.height || 40) / 2;
      const bw = (b.width || 120) / 2, bh = (b.height || 40) / 2;
      
      if (Math.abs(a.x - b.x) < aw + bw && Math.abs(a.y - b.y) < ah + bh) {
        result.overlappingNodes.push(`${a.id} ↔ ${b.id}`);
      }
    }
  }

  // 6. Density: filled area / total bounding box
  result.filledArea = laidOut.reduce((s, n) => s + (n.width || 120) * (n.height || 40), 0);
  result.totalArea = (result.horizontalSpread + 200) * (result.verticalSpread + 100);
  result.density = result.totalArea > 0 ? (result.filledArea / result.totalArea * 100) : 0;

  return result;
}

// ─── Main ────────────────────────────────────────────────────
const samplesDir = path.resolve('samples');
const files = fs.readdirSync(samplesDir).filter(f => f.endsWith('.cci'));

console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║          LAYOUT QUALITY — Node Placement Tests             ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

let totalIssues = 0;

for (const file of files.sort()) {
  const { nodes, edges, diagramType, title, aspect } = loadSample(path.join(samplesDir, file));
  
  if (nodes.length === 0) continue;
  
  const laidOut = layoutNodesHeuristically(nodes, edges, { diagramType, aspect });
  const metrics = analyzeLayout(laidOut, edges, diagramType);
  
  // Scoring
  const issues = [];
  
  // Rule 1: Parent above child (mandatory for trees)
  if (metrics.parentAboveChild.fail > 0) {
    issues.push(`⛔ P>C: ${metrics.parentAboveChild.fail} parent-NOT-above-child`);
  }
  
  // Rule 2: Max gap < 3x avg gap (no huge empty spaces)
  if (metrics.avgRankGap > 0 && metrics.maxGap > metrics.avgRankGap * 3) {
    issues.push(`⛔ GAP: max=${metrics.maxGap}px vs avg=${Math.round(metrics.avgRankGap)}px (${(metrics.maxGap/metrics.avgRankGap).toFixed(1)}x) ${metrics.maxGapBetween}`);
  }
  
  // Rule 3: Dense fan-outs must be stacked
  if (metrics.denseStacked.expected > 0 && metrics.denseStacked.actual < metrics.denseStacked.expected) {
    const missing = metrics.denseStacked.expected - metrics.denseStacked.actual;
    issues.push(`⛔ STACK: ${missing}/${metrics.denseStacked.expected} dense parents NOT stacked`);
    metrics.denseStacked.violations.forEach(v => issues.push(`    ${v}`));
  }
  
  // Rule 4: No node overlaps
  if (metrics.overlappingNodes.length > 0) {
    issues.push(`⛔ OVERLAP: ${metrics.overlappingNodes.length} pairs overlap`);
  }
  
  // Rule 5: Density not too sparse (>2% for multi-node diagrams)
  if (laidOut.length > 5 && metrics.density < 2) {
    issues.push(`⚠️ SPARSE: density=${metrics.density.toFixed(1)}% (too spread out)`);
  }
  
  // Rule 6: Horizontal spread sanity (< nodeCount * 300px)
  const maxSpread = laidOut.length * 250;
  if (metrics.horizontalSpread > maxSpread) {
    issues.push(`⚠️ WIDE: ${metrics.horizontalSpread}px > ${maxSpread}px limit`);
  }

  const status = issues.length === 0 ? '✅' : '⚠️';
  totalIssues += issues.length;
  
  console.log(`  ${status} ${file.padEnd(30)} ${laidOut.length} nodes | ${edges.length} edges | W:${metrics.horizontalSpread} H:${metrics.verticalSpread} | ranks:${metrics.rankCount} | density:${metrics.density.toFixed(1)}% | gaps:avg=${Math.round(metrics.avgRankGap)}px max=${metrics.maxGap}px`);
  
  if (metrics.denseStacked.expected > 0) {
    console.log(`    Dense stacking: ${metrics.denseStacked.actual}/${metrics.denseStacked.expected} stacked`);
  }
  
  if (issues.length > 0) {
    issues.forEach(i => console.log(`    ${i}`));
  }
}

console.log(`\n${'═'.repeat(60)}`);
console.log(`Total layout issues: ${totalIssues}`);
console.log(`${'═'.repeat(60)}`);
