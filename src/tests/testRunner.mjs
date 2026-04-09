export let passed = 0, failed = 0, total = 0;

export function test(name, fn) {
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

export function expect(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

export function summary(filename) {
  console.log(`\n${'═'.repeat(50)}`);
  console.log(`[${filename}] Results: ${passed}/${total} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

export function makeNode(id, x, y, type = 'rect', size = 'M', additional = {}) {
  const dims = { S: { width: 80, height: 40 }, M: { width: 160, height: 80 }, L: { width: 240, height: 120 } };
  const d = dims[size] || dims.M;
  return { id, x, y, type, size, width: d.width, height: d.height, ...additional };
}

export function makeEdge(id, from, to, opts = {}) {
  return { id, from, to, sourceId: from, targetId: to, ...opts };
}

export function analyzeEdge(paths, edgeId, nodes) {
  const p = paths[edgeId];
  if (!p || !p.pts || p.pts.length < 2) return { valid: false };
  
  const pts = p.pts;
  const first = pts[0], second = pts[1];
  const last = pts[pts.length - 1], beforeLast = pts[pts.length - 2];
  
  const exitDx = second.x - first.x, exitDy = second.y - first.y;
  const exitPort = Math.abs(exitDy) > 0.01 ? (exitDy > 0 ? 'Bottom' : 'Top') : (exitDx > 0 ? 'Right' : 'Left');
  
  const entryDx = last.x - beforeLast.x, entryDy = last.y - beforeLast.y;
  const entryPort = Math.abs(entryDy) > 0.01 ? (entryDy > 0 ? 'Top' : 'Bottom') : (entryDx > 0 ? 'Left' : 'Right');
  
  let bends = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const prevH = pts[i].y === pts[i-1].y;
    const nextH = pts[i+1].y === pts[i].y;
    if (prevH !== nextH) bends++;
  }
  
  const hasNaN = p.pathD && p.pathD.includes('NaN');
  
  return { valid: true, exitPort, entryPort, bends, hasNaN, pts };
}
