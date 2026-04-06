/**
 * Chartici Routing Engine — Sample Metrics Report
 * 
 * Loads ALL .cci sample files, runs layout + routing, and reports:
 * - Tier usage (how many edges needed fallback tiers)
 * - Node crossings (paths going through node vBox)
 * - Edge crossings (perpendicular path intersections)
 * - Path lengths and bend counts
 * - Timing
 * 
 * Run: npx tsx src/tests/engine_samples.test.mjs
 */
import fs from 'fs';
import path from 'path';
import { calculateAllPaths } from '../utils/engine/index.js';
import { layoutNodesHeuristically } from '../utils/nodeLayouter.js';
import { getTrueBox } from '../utils/engine/geometry.js';
import { SIZES, getNodeDim } from '../utils/constants.js';

// ─── Load sample ─────────────────────────────────────────────
function loadSample(filePath) {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const data = raw.data || raw;
  const diagramType = data.diagramType || path.basename(filePath).split('_')[0];
  
  const nodes = [];
  if (data.groups && data.groups.length > 0) {
    data.groups.forEach(g => {
      (g.nodes || []).forEach(n => {
        const sz = n.size || g.size || 'M';
        const dim = SIZES[sz] || SIZES.M;
        nodes.push({
          ...n,
          type: n.type || g.type || 'rect',
          size: sz,
          width: dim.width,
          height: dim.height
        });
      });
    });
  }
  
  const edges = (data.edges || []).map(e => ({
    ...e,
    from: e.sourceId || e.from,
    to: e.targetId || e.to
  }));
  
  return { nodes, edges, diagramType, title: data.title || path.basename(filePath) };
}

// ─── Helpers ─────────────────────────────────────────────────
function isSegBlocked(x1, y1, x2, y2, edge, nodes, allSegments) {
  const pad = 20; // padding around nodes
  const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
  const isH = y1 === y2;
  // Check node collisions + proximity (stub distance)
  for (const node of nodes) {
    if (node.id === edge.from || node.id === edge.to) continue;
    if (node.type === 'text' || node.type === 'title') continue;
    const box = getTrueBox(node);
    const pLeft = box.left - pad, pRight = box.right + pad;
    const pTop = box.top - pad, pBottom = box.bottom + pad;
    if (isH) {
      if (y1 > pTop && y1 < pBottom && maxX > pLeft && minX < pRight) return true;
    } else {
      if (x1 > pLeft && x1 < pRight && maxY > pTop && minY < pBottom) return true;
    }
    // Also block if shortcut endpoint is within stub distance of node
    const stubDist = 30;
    const nearLeft = box.left - stubDist, nearRight = box.right + stubDist;
    const nearTop = box.top - stubDist, nearBottom = box.bottom + stubDist;
    if (x1 > nearLeft && x1 < nearRight && y1 > nearTop && y1 < nearBottom) return true;
    if (x2 > nearLeft && x2 < nearRight && y2 > nearTop && y2 < nearBottom) return true;
  }
  // Check crossing with other edges' segments
  if (allSegments) {
    for (const seg of allSegments) {
      if (seg.edgeId === edge.id) continue; // skip own segments
      const segH = seg.y1 === seg.y2;
      if (isH === segH) {
        // Parallel — check collinear overlap (shared line)
        if (isH && y1 === seg.y1) {
          const sMinX = Math.min(seg.x1, seg.x2), sMaxX = Math.max(seg.x1, seg.x2);
          if (maxX > sMinX && minX < sMaxX) return true; // overlap on same horizontal line
        }
        if (!isH && x1 === seg.x1) {
          const sMinY = Math.min(seg.y1, seg.y2), sMaxY = Math.max(seg.y1, seg.y2);
          if (maxY > sMinY && minY < sMaxY) return true; // overlap on same vertical line
        }
        continue;
      }
      // Perpendicular crossing
      const hS = isH ? { x1: minX, x2: maxX, y: y1 } : { x1: Math.min(seg.x1,seg.x2), x2: Math.max(seg.x1,seg.x2), y: seg.y1 };
      const vS = isH ? { y1: Math.min(seg.y1,seg.y2), y2: Math.max(seg.y1,seg.y2), x: seg.x1 } : { y1: minY, y2: maxY, x: x1 };
      if (vS.x > hS.x1 && vS.x < hS.x2 && hS.y > vS.y1 && hS.y < vS.y2) return true;
    }
  }
  return false;
}

// ─── Metrics ─────────────────────────────────────────────────
function computeMetrics(paths, edges, nodes, diagramType) {
  const metrics = {
    totalEdges: edges.length,
    routedEdges: 0,
    tierCounts: [0, 0, 0, 0, 0],  // edges per tier (0-3 + fallback)
    fallbacks: 0,                   // emergency straight-line fallbacks  
    nodeCrossings: 0,               // intermediate points inside a node
    edgeCrossings: 0,               // perpendicular edge intersections (stranger)
    siblingCrossings: 0,            // perpendicular intersections between siblings
    selfCrossings: 0,               // single edge crossing itself
    totalLength: 0,
    totalBends: 0,
    maxBends: 0,
    hasNaN: 0,
    timedOut: 0,
    slowEdges: [],             // edges that took >50ms
    selfCrossings: 0,          // edges that cross themselves
    unnecessaryBends: 0,       // bends where straight path was open
    errors: []
  };
  
  const allSegments = []; // {x1,y1,x2,y2,edgeId} for crossing detection
  
  for (const edge of edges) {
    const p = paths[edge.id];
    if (!p) { metrics.errors.push(`${edge.id}: no path`); continue; }
    if (!p.pts || p.pts.length < 2) {
      // Radial or drag line — check pathD exists
      if (p.pathD && !p.pathD.includes('NaN')) {
        metrics.routedEdges++;
        continue;
      }
      metrics.errors.push(`${edge.id}: invalid pts`);
      continue;
    }
    
    metrics.routedEdges++;
    
    // Tier
    const tier = p.usedTier !== undefined ? p.usedTier : 0;
    if (p.isFallback) {
      metrics.fallbacks++;
      metrics.tierCounts[4]++;
    } else {
      metrics.tierCounts[Math.min(tier, 3)]++;
    }
    
    // Timeout
    if (p.timedOut) metrics.timedOut++;
    if (p.routeMs > 50) metrics.slowEdges.push({ id: edge.id, ms: p.routeMs, tier });
    
    // NaN
    if (p.pathD && p.pathD.includes('NaN')) metrics.hasNaN++;
    
    // Length & bends
    let length = 0;
    let bends = 0;
    const pts = p.pts;
    for (let i = 0; i < pts.length - 1; i++) {
      const dx = Math.abs(pts[i+1].x - pts[i].x);
      const dy = Math.abs(pts[i+1].y - pts[i].y);
      length += dx + dy;
      
      // Collect segment for crossing detection
      allSegments.push({
        x1: pts[i].x, y1: pts[i].y,
        x2: pts[i+1].x, y2: pts[i+1].y,
        edgeId: edge.id,
        from: edge.from, to: edge.to
      });
    }
    for (let i = 1; i < pts.length - 1; i++) {
      const prevH = pts[i].y === pts[i-1].y;
      const nextH = pts[i+1].y === pts[i].y;
      if (prevH !== nextH) bends++;
    }
    metrics.totalLength += length;
    metrics.totalBends += bends;
    if (bends > metrics.maxBends) metrics.maxBends = bends;
    // Unnecessary detour check: can point i reach point j (3+ bends apart) 
    // via unobstructed L-path? If yes, the bends in between are a loop.
    if (pts.length >= 5) { // need at least 3 bends between start/end
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 4; j < pts.length; j++) { // skip at least 3 segments
          const a = pts[i], b = pts[j];
          if (a.x === b.x || a.y === b.y) {
            // Straight line possible — check if unobstructed
            if (!isSegBlocked(a.x, a.y, b.x, b.y, edge, nodes, allSegments)) {
              metrics.unnecessaryBends++;
              break; // one detection per starting point is enough
            }
          } else {
            // L-shape: try both corners
            const c1 = { x: b.x, y: a.y };
            const c2 = { x: a.x, y: b.y };
            if ((!isSegBlocked(a.x, a.y, c1.x, c1.y, edge, nodes, allSegments) &&
                 !isSegBlocked(c1.x, c1.y, b.x, b.y, edge, nodes, allSegments)) ||
                (!isSegBlocked(a.x, a.y, c2.x, c2.y, edge, nodes, allSegments) &&
                 !isSegBlocked(c2.x, c2.y, b.x, b.y, edge, nodes, allSegments))) {
              metrics.unnecessaryBends++;
              break;
            }
          }
        }
      }
    }
    
    // Node crossing check — SEGMENT-based (not just points)
    // A segment from pts[i] to pts[i+1] crosses a node if the segment
    // passes through the node's vBox (excluding source/target nodes)
    for (let i = 0; i < pts.length - 1; i++) {
      const sx = pts[i].x, sy = pts[i].y;
      const ex = pts[i+1].x, ey = pts[i+1].y;
      const segMinX = Math.min(sx, ex), segMaxX = Math.max(sx, ex);
      const segMinY = Math.min(sy, ey), segMaxY = Math.max(sy, ey);
      const isH = sy === ey;
      
      for (const node of nodes) {
        if (node.id === edge.from || node.id === edge.to) continue;
        if (node.type === 'text' || node.type === 'title') continue;
        const box = getTrueBox(node);
        
        if (isH) {
          // Horizontal segment: crosses node if y is within vBox and x range overlaps
          if (sy > box.top && sy < box.bottom &&
              segMaxX > box.left && segMinX < box.right) {
            metrics.nodeCrossings++;
          }
        } else {
          // Vertical segment: crosses node if x is within vBox and y range overlaps
          if (sx > box.left && sx < box.right &&
              segMaxY > box.top && segMinY < box.bottom) {
            metrics.nodeCrossings++;
          }
        }
      }
    }
    
    // Self-crossing check: do any two segments of THIS edge cross each other?
    const edgeSegs = allSegments.filter(s => s.edgeId === edge.id);
    for (let i = 0; i < edgeSegs.length; i++) {
      for (let j = i + 2; j < edgeSegs.length; j++) { // skip adjacent (i+1)
        const a = edgeSegs[i], b = edgeSegs[j];
        const aH = a.y1 === a.y2, bH = b.y1 === b.y2;
        if (aH === bH) continue;
        const hSeg = aH ? a : b;
        const vSeg = aH ? b : a;
        const hMinX = Math.min(hSeg.x1, hSeg.x2), hMaxX = Math.max(hSeg.x1, hSeg.x2);
        const vMinY = Math.min(vSeg.y1, vSeg.y2), vMaxY = Math.max(vSeg.y1, vSeg.y2);
        if (vSeg.x1 > hMinX && vSeg.x1 < hMaxX && hSeg.y1 > vMinY && hSeg.y1 < vMaxY) {
          metrics.selfCrossings++;
          metrics.errors.push(`SC: ${edge.id} seg${i}(${a.x1},${a.y1}→${a.x2},${a.y2}) × seg${j}(${b.x1},${b.y1}→${b.x2},${b.y2})`);
        }
      }
    }
  }
  
  // Edge crossing detection (perpendicular intersections)
  for (let i = 0; i < allSegments.length; i++) {
    for (let j = i + 1; j < allSegments.length; j++) {
      const a = allSegments[i], b = allSegments[j];
      if (a.edgeId === b.edgeId) continue;
      
      const aH = a.y1 === a.y2;
      const bH = b.y1 === b.y2;
      if (aH === bH) continue; // parallel, no crossing
      
      const hSeg = aH ? a : b;
      const vSeg = aH ? b : a;
      
      const hMinX = Math.min(hSeg.x1, hSeg.x2), hMaxX = Math.max(hSeg.x1, hSeg.x2);
      const vMinY = Math.min(vSeg.y1, vSeg.y2), vMaxY = Math.max(vSeg.y1, vSeg.y2);
      
      if (vSeg.x1 > hMinX && vSeg.x1 < hMaxX && hSeg.y1 > vMinY && hSeg.y1 < vMaxY) {
        const isSibling = a.from === b.from || a.to === b.to;
        if (isSibling) {
          metrics.siblingCrossings++;
        } else {
          metrics.edgeCrossings++;
        }
      }
    }
  }
  
  return metrics;
}

// ─── Run all samples ─────────────────────────────────────────
const samplesDir = path.resolve('./samples');
const files = fs.readdirSync(samplesDir).filter(f => f.endsWith('.cci')).sort();

console.log('╔══════════════════════════════════════════════════════════════════════════════════╗');
console.log('║  CHARTICI ROUTING ENGINE — SAMPLE METRICS REPORT                                ║');
console.log('╚══════════════════════════════════════════════════════════════════════════════════╝\n');

const totals = { edges: 0, tier0: 0, tier1: 0, tier2: 0, tier3: 0, fallback: 0, 
                 nodeCross: 0, edgeCross: 0, sibCross: 0, selfCross: 0, unnBends: 0,
                 length: 0, bends: 0, nan: 0, time: 0, timedOut: 0 };

const rows = [];

for (const file of files) {
  const filePath = path.join(samplesDir, file);
  const { nodes, edges, diagramType, title } = loadSample(filePath);
  
  if (nodes.length === 0 || edges.length === 0) {
    console.log(`  ⏭️  ${file} — skipped (${nodes.length} nodes, ${edges.length} edges)`);
    continue;
  }
  
  // Layout
  const laid = layoutNodesHeuristically(nodes, edges, { diagramType });
  
  // Route
  const t0 = performance.now();
  const paths = calculateAllPaths(edges, laid, { diagramType });
  const dt = performance.now() - t0;
  
  const m = computeMetrics(paths, edges, laid, diagramType);
  
  const tierStr = `T0:${m.tierCounts[0]} T1:${m.tierCounts[1]} T2:${m.tierCounts[2]} T3:${m.tierCounts[3]}`;
  const fbStr = m.fallbacks > 0 ? ` FB:${m.fallbacks}` : '';
  const totalCross = m.edgeCrossings + m.siblingCrossings;
  const crossStr = m.nodeCrossings > 0 ? `⚠️ NC:${m.nodeCrossings}` : 'NC:0';
  const edgeCrossStr = totalCross > 0 ? `⚠️ EC:${totalCross}(sib:${m.siblingCrossings})` : 'EC:0';
  const nanStr = m.hasNaN > 0 ? ` ❌NaN:${m.hasNaN}` : '';
  const selfStr = m.selfCrossings > 0 ? ` ❌SC:${m.selfCrossings}` : '';
  const ubStr = m.unnecessaryBends > 0 ? ` UB:${m.unnecessaryBends}` : '';
  const toStr = m.timedOut > 0 ? ` ⏱️TO:${m.timedOut}` : '';
  const status = (m.fallbacks === 0 && m.nodeCrossings === 0 && m.hasNaN === 0 && totalCross === 0 && m.timedOut === 0 && m.selfCrossings === 0) ? '✅' : '⚠️';
  
  console.log(`  ${status} ${file.padEnd(30)} ${String(m.totalEdges).padStart(3)} edges | ${tierStr}${fbStr} | ${crossStr} ${edgeCrossStr} | ${Math.round(dt)}ms${toStr}${selfStr}${ubStr}${nanStr}`);
  
  if (m.slowEdges.length > 0) {
    m.slowEdges.forEach(s => console.log(`     🐢 ${s.id}: ${s.ms}ms (tier ${s.tier})`));
  }
  if (m.errors.length > 0) {
    m.errors.forEach(e => console.log(`     ⚠️  ${e}`));
  }
  
  totals.edges += m.totalEdges;
  totals.tier0 += m.tierCounts[0];
  totals.tier1 += m.tierCounts[1];
  totals.tier2 += m.tierCounts[2];
  totals.tier3 += m.tierCounts[3];
  totals.fallback += m.fallbacks;
  totals.nodeCross += m.nodeCrossings;
  totals.edgeCross += m.edgeCrossings;
  totals.sibCross += m.siblingCrossings;
  totals.selfCross += m.selfCrossings;
  totals.unnBends += m.unnecessaryBends;
  totals.length += m.totalLength;
  totals.bends += m.totalBends;
  totals.nan += m.hasNaN;
  totals.timedOut += m.timedOut;
  totals.time += dt;
}

console.log('\n' + '═'.repeat(82));
console.log('  TOTALS:');
console.log(`    Edges: ${totals.edges}`);
console.log(`    Tier 0 (strict):     ${totals.tier0}`);
console.log(`    Tier 1 (crossings):  ${totals.tier1}`);
console.log(`    Tier 2 (fine grid):  ${totals.tier2}`);
console.log(`    Tier 3 (overlap):    ${totals.tier3}`);
console.log(`    Fallbacks:           ${totals.fallback}`);
console.log(`    Timed out:           ${totals.timedOut}`);
console.log(`    Node crossings:      ${totals.nodeCross}`);
console.log(`    Edge crossings:      ${totals.edgeCross + totals.sibCross} (stranger:${totals.edgeCross} sibling:${totals.sibCross})`);
console.log(`    Self crossings:      ${totals.selfCross}`);
console.log(`    Unnecessary bends:   ${totals.unnBends}`);
console.log(`    Total path length:   ${Math.round(totals.length)}px`);
console.log(`    Total bends:         ${totals.bends}`);
console.log(`    NaN errors:          ${totals.nan}`);
console.log(`    Total time:          ${Math.round(totals.time)}ms`);
console.log('═'.repeat(82));

// ─── Tree Port Audit ─────────────────────────────────────────
// In tree diagrams, parent→child (child is BELOW parent) must:
//   - Exit from Bottom port of parent
//   - Enter through Top port of child
console.log('\n🌳 TREE PORT AUDIT');
let treeViolations = 0;

for (const file of files) {
  if (!file.startsWith('tree_')) continue;
  const filePath = path.join(samplesDir, file);
  const { nodes, edges, diagramType } = loadSample(filePath);
  if (nodes.length === 0 || edges.length === 0) continue;
  
  const laid = layoutNodesHeuristically(nodes, edges, { diagramType });
  const paths = calculateAllPaths(edges, laid, { diagramType });
  
  const nodeMap = new Map(laid.map(n => [n.id, n]));
  
  for (const edge of edges) {
    const p = paths[edge.id];
    if (!p || !p.pts || p.pts.length < 2) continue;
    
    const src = nodeMap.get(edge.from);
    const tgt = nodeMap.get(edge.to);
    if (!src || !tgt) continue;
    
    // Only check parent→child where child is below parent
    if (tgt.y <= src.y) continue;
    
    const pts = p.pts;
    const first = pts[0], second = pts[1];
    const last = pts[pts.length - 1], beforeLast = pts[pts.length - 2];
    
    // Exit direction
    const exitDy = second.y - first.y;
    const exitDx = second.x - first.x;
    const exitPort = Math.abs(exitDy) > 0.01 ? (exitDy > 0 ? 'Bottom' : 'Top') : (exitDx > 0 ? 'Right' : 'Left');
    
    // Entry direction  
    const entryDy = last.y - beforeLast.y;
    const entryDx = last.x - beforeLast.x;
    const entryPort = Math.abs(entryDy) > 0.01 ? (entryDy > 0 ? 'Top' : 'Bottom') : (entryDx > 0 ? 'Left' : 'Right');
    
    const exitOk = exitPort === 'Bottom';
    const entryOk = entryPort === 'Top' || (tgt._stackEntry && entryPort === tgt._stackEntry);
    
    if (!exitOk || !entryOk) {
      treeViolations++;
      const exitFlag = exitOk ? '' : ` exit:${exitPort}≠Bottom`;
      const entryFlag = entryOk ? '' : ` entry:${entryPort}≠Top`;
      console.log(`  ⚠️  ${file} ${edge.id} (${edge.from}→${edge.to}):${exitFlag}${entryFlag}`);
    }
  }
}

if (treeViolations === 0) {
  console.log('  ✅ All tree edges exit Bottom → enter Top');
} else {
  console.log(`  ❌ ${treeViolations} tree port violation(s)`);
}

// Exit with error if any critical issues
if (totals.nan > 0 || totals.fallback > 0) {
  console.log('\n❌ CRITICAL: NaN or fallback paths detected');
  process.exit(1);
}
if (totals.nodeCross > 0) {
  console.log('\n⚠️  WARNING: Node crossings detected');
}
console.log('\n✅ All samples processed');
