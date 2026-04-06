/**
 * Chartici Routing Engine — Golden Reference Tests
 * 
 * Each test defines a small diagram (nodes + edges) with FIXED positions,
 * runs the routing engine, and checks results against agreed expectations.
 * 
 * Run: node src/tests/engine_golden.test.mjs
 */
import { calculateAllPaths } from '../utils/engine/index.js';
import { getTrueBox, getNodePorts } from '../utils/engine/geometry.js';

// ─── Helpers ─────────────────────────────────────────────────
function makeNode(id, x, y, type = 'rect', size = 'M') {
  const dims = { S: { width: 80, height: 40 }, M: { width: 160, height: 80 }, L: { width: 240, height: 120 } };
  const d = dims[size] || dims.M;
  return { id, x, y, type, size, width: d.width, height: d.height };
}
function makeEdge(id, from, to, opts = {}) {
  return { id, from, to, sourceId: from, targetId: to, ...opts };
}

function analyzeEdge(paths, edgeId, nodes) {
  const p = paths[edgeId];
  if (!p || !p.pts || p.pts.length < 2) return { valid: false };
  
  const pts = p.pts;
  const first = pts[0], second = pts[1];
  const last = pts[pts.length - 1], beforeLast = pts[pts.length - 2];
  
  // Determine exit direction from first segment
  const exitDx = second.x - first.x, exitDy = second.y - first.y;
  const exitPort = Math.abs(exitDy) > 0.01 ? (exitDy > 0 ? 'Bottom' : 'Top') : (exitDx > 0 ? 'Right' : 'Left');
  
  // Determine entry direction from last segment
  const entryDx = last.x - beforeLast.x, entryDy = last.y - beforeLast.y;
  const entryPort = Math.abs(entryDy) > 0.01 ? (entryDy > 0 ? 'Top' : 'Bottom') : (entryDx > 0 ? 'Left' : 'Right');
  // Note: entryPort is the port name on the TARGET node (where the line arrives)
  // If line comes from above (entryDy > 0), it enters through Top port
  
  // Count bends (direction changes)
  let bends = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const prevH = pts[i].y === pts[i-1].y;
    const nextH = pts[i+1].y === pts[i].y;
    if (prevH !== nextH) bends++;
  }
  
  // Check pathD for NaN
  const hasNaN = p.pathD && p.pathD.includes('NaN');
  
  // Check no node crossing (simplified: path points should not be inside any node's vBox)
  let crossesNode = false;
  for (let i = 1; i < pts.length - 1; i++) {
    for (const node of nodes) {
      const box = getTrueBox(node);
      if (pts[i].x > box.left && pts[i].x < box.right && 
          pts[i].y > box.top && pts[i].y < box.bottom) {
        crossesNode = true;
      }
    }
  }
  
  return { valid: true, exitPort, entryPort, bends, hasNaN, crossesNode, pts };
}

// ─── Test Runner ─────────────────────────────────────────────
let passed = 0, failed = 0, total = 0;

function test(name, fn) {
  total++;
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ❌ ${name}: ${e.message}`);
  }
}

function expect(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

// ─── TEST 1: Vertical A→B (B is below A) ────────────────────
console.log('\n📐 Test 1: Vertical A→B');
{
  const nodes = [
    makeNode('A', 0, 0),
    makeNode('B', 0, 200),
  ];
  const edges = [makeEdge('e1', 'A', 'B')];
  const paths = calculateAllPaths(edges, nodes, { diagramType: 'flowchart' });
  const r = analyzeEdge(paths, 'e1', nodes);
  
  test('valid path', () => expect(r.valid, true, 'valid'));
  test('no NaN', () => expect(r.hasNaN, false, 'NaN'));
  test('exit Bottom', () => expect(r.exitPort, 'Bottom', 'exitPort'));
  test('enter Top', () => expect(r.entryPort, 'Top', 'entryPort'));
  test('0 bends', () => expect(r.bends, 0, 'bends'));
  test('no node crossing', () => expect(r.crossesNode, false, 'crossing'));
}

// ─── TEST 2: Horizontal A→B (B is to the right) ─────────────
console.log('\n📐 Test 2: Horizontal A→B');
{
  const nodes = [
    makeNode('A', 0, 0),
    makeNode('B', 300, 0),
  ];
  const edges = [makeEdge('e1', 'A', 'B')];
  const paths = calculateAllPaths(edges, nodes, { diagramType: 'flowchart' });
  const r = analyzeEdge(paths, 'e1', nodes);
  
  test('valid path', () => expect(r.valid, true, 'valid'));
  test('exit Right', () => expect(r.exitPort, 'Right', 'exitPort'));
  test('enter Left', () => expect(r.entryPort, 'Left', 'entryPort'));
  test('0 bends', () => expect(r.bends, 0, 'bends'));
}

// ─── TEST 3: Diagonal A→B (Z-shape) ─────────────────────────
console.log('\n📐 Test 3: Diagonal A→B');
{
  const nodes = [
    makeNode('A', 0, 0),
    makeNode('B', 300, 200),
  ];
  const edges = [makeEdge('e1', 'A', 'B')];
  const paths = calculateAllPaths(edges, nodes, { diagramType: 'flowchart' });
  const r = analyzeEdge(paths, 'e1', nodes);
  
  test('valid path', () => expect(r.valid, true, 'valid'));
  test('2 bends (Z-shape)', () => expect(r.bends, 2, 'bends'));
  test('no node crossing', () => expect(r.crossesNode, false, 'crossing'));
}

// ─── TEST 4: Fan-out A→B,C,D (3 children below) ─────────────
console.log('\n📐 Test 4: Fan-out (tree)');
{
  const nodes = [
    makeNode('A', 0, 0),
    makeNode('B', -200, 200),
    makeNode('C', 0, 200),
    makeNode('D', 200, 200),
  ];
  const edges = [
    makeEdge('e1', 'A', 'B'),
    makeEdge('e2', 'A', 'C'),
    makeEdge('e3', 'A', 'D'),
  ];
  const paths = calculateAllPaths(edges, nodes, { diagramType: 'tree' });
  
  const r1 = analyzeEdge(paths, 'e1', nodes);
  const r2 = analyzeEdge(paths, 'e2', nodes);
  const r3 = analyzeEdge(paths, 'e3', nodes);

  test('all valid', () => {
    expect(r1.valid, true, 'e1'); expect(r2.valid, true, 'e2'); expect(r3.valid, true, 'e3');
  });
  test('all exit Bottom (tree fan-out)', () => {
    expect(r1.exitPort, 'Bottom', 'e1'); expect(r2.exitPort, 'Bottom', 'e2'); expect(r3.exitPort, 'Bottom', 'e3');
  });
  test('all enter Top', () => {
    expect(r1.entryPort, 'Top', 'e1'); expect(r2.entryPort, 'Top', 'e2'); expect(r3.entryPort, 'Top', 'e3');
  });
  test('no node crossing', () => {
    expect(r1.crossesNode, false, 'e1'); expect(r2.crossesNode, false, 'e2'); expect(r3.crossesNode, false, 'e3');
  });
}

// ─── TEST 5: Obstacle avoidance (A→C, B in the middle) ──────
console.log('\n📐 Test 5: Obstacle avoidance');
{
  const nodes = [
    makeNode('A', 0, 0),
    makeNode('B', 0, 200),   // blocker in the middle
    makeNode('C', 0, 400),
  ];
  const edges = [makeEdge('e1', 'A', 'C')];
  const paths = calculateAllPaths(edges, nodes, { diagramType: 'flowchart' });
  const r = analyzeEdge(paths, 'e1', nodes);
  
  test('valid path', () => expect(r.valid, true, 'valid'));
  test('no node crossing', () => expect(r.crossesNode, false, 'crossing'));
  test('has bends (goes around)', () => {
    if (r.bends < 2) throw new Error(`bends: expected >=2, got ${r.bends}`);
  });
}

// ─── TEST 6: Radial — straight lines ────────────────────────
console.log('\n📐 Test 6: Radial straight lines');
{
  const nodes = [
    makeNode('center', 0, 0, 'circle', 'L'),
    makeNode('n1', 300, 0),
    makeNode('n2', -300, 0),
    makeNode('n3', 0, 300),
    makeNode('n4', 0, -300),
  ];
  const edges = [
    makeEdge('e1', 'center', 'n1'),
    makeEdge('e2', 'center', 'n2'),
    makeEdge('e3', 'center', 'n3'),
    makeEdge('e4', 'center', 'n4'),
  ];
  const paths = calculateAllPaths(edges, nodes, { diagramType: 'radial' });
  
  for (const eid of ['e1','e2','e3','e4']) {
    const p = paths[eid];
    test(`${eid}: valid`, () => {
      if (!p || !p.pts || p.pts.length < 2) throw new Error('no path');
    });
    test(`${eid}: straight (2 points)`, () => expect(p.pts.length, 2, 'points'));
    test(`${eid}: no NaN`, () => {
      if (p.pathD.includes('NaN')) throw new Error('NaN in pathD');
    });
    test(`${eid}: clipped (not at center)`, () => {
      // Start should NOT be at (0,0) center
      if (p.pts[0].x === 0 && p.pts[0].y === 0) throw new Error('starts at exact center');
    });
  }
}

// ─── TEST 7: Geometry — circle ports ────────────────────────
console.log('\n📐 Test 7: Circle ports');
{
  const node = makeNode('c1', 0, 0, 'circle', 'L');
  const box = getTrueBox(node);
  const ports = getNodePorts(node, box);
  
  test('has cardinal ports', () => {
    const dirs = ports.map(p => p.dir);
    if (!dirs.includes('Top')) throw new Error('missing Top');
    if (!dirs.includes('Bottom')) throw new Error('missing Bottom');
    if (!dirs.includes('Left')) throw new Error('missing Left');
    if (!dirs.includes('Right')) throw new Error('missing Right');
  });
  test('has bifurcation ports (cx±20)', () => {
    const bottomPorts = ports.filter(p => p.dir === 'Bottom');
    if (bottomPorts.length < 2) throw new Error(`only ${bottomPorts.length} Bottom ports, need >=2`);
  });
  test('box is square (circle)', () => {
    const w = box.right - box.left;
    const h = box.bottom - box.top;
    expect(w, h, 'circle should be square box');
  });
}

// ─── Summary ─────────────────────────────────────────────────
console.log(`\n${'═'.repeat(50)}`);
console.log(`Results: ${passed}/${total} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
