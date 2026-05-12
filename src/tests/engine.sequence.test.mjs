import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { calculateAllPaths } from '../utils/engine/index.js';
import { layoutNodesHeuristically } from '../utils/nodeLayouter.js';
import { parseCharticiFile } from '../utils/charticiFormat.js';
import { test, summary, makeNode, makeEdge } from './testRunner.mjs';

console.log('\n🎬 Sequence Engine: Side-port message routing');

{
  const nodes = [
    makeNode('producer', 0, 0, 'process', 'M', { groupId: 'lane_a' }),
    makeNode('broker', 360, 140, 'process', 'M', { groupId: 'lane_b' }),
    makeNode('consumer', 720, 320, 'process', 'M', { groupId: 'lane_c' }),
  ];
  const edges = [
    makeEdge('publish', 'producer', 'broker', { label: 'publish' }),
    makeEdge('deliver', 'broker', 'consumer', { label: 'deliver' }),
  ];
  const paths = calculateAllPaths(edges, nodes, { diagramType: 'sequence' });

  test('Cross-lane sequence messages exit and enter through side ports', () => {
    edges.forEach(edge => assertSidePorts(paths[edge.id]?.pts, edge.id));
  });

  test('Cross-lane sequence terminal stubs use real diagram lengths', () => {
    edges.forEach(edge => {
      const pts = paths[edge.id]?.pts || [];
      assertTerminalStub(pts, edge.id, 'start', 20);
      assertTerminalStub(pts, edge.id, 'end', 40);
    });
  });
}

{
  const nodes = [
    makeNode('left', 0, 0, 'process', 'M', { groupId: 'lane_a' }),
    makeNode('right', 360, 0, 'process', 'M', { groupId: 'lane_a' }),
  ];
  const edges = [
    makeEdge('forward', 'left', 'right', { label: 'request' }),
    makeEdge('back', 'right', 'left', { label: 'reply', connectionType: 'reverse' }),
  ];
  const paths = calculateAllPaths(edges, nodes, { diagramType: 'sequence' });

  test('Same-lane sequence messages also stay side-to-side', () => {
    edges.forEach(edge => assertSidePorts(paths[edge.id]?.pts, edge.id));
  });

  test('Reverse sequence arrows keep a 40px source terminal stub', () => {
    assertTerminalStub(paths.back?.pts, 'back', 'start', 40);
  });
}

{
  const nodes = [
    makeNode('right_source', 520, 0, 'process', 'M'),
    makeNode('left_target', 0, 120, 'process', 'M'),
  ];
  const edges = [
    makeEdge('return_msg', 'right_source', 'left_target', { label: 'Return', lineStyle: 'dashed' }),
  ];
  const paths = calculateAllPaths(edges, nodes, { diagramType: 'sequence' });

  test('Sequence messages always exit right and enter left even for backward links', () => {
    const pts = paths.return_msg?.pts || [];
    if (pts.length < 2) throw new Error('missing backward sequence route');
    const first = pts[0];
    const second = pts[1];
    const beforeLast = pts[pts.length - 2];
    const last = pts[pts.length - 1];
    if (second.x <= first.x || Math.abs(second.y - first.y) > 0.01) {
      throw new Error(`backward message did not exit right: ${point(first)} -> ${point(second)}`);
    }
    if (beforeLast.x >= last.x || Math.abs(beforeLast.y - last.y) > 0.01) {
      throw new Error(`backward message did not enter left: ${point(beforeLast)} -> ${point(last)}`);
    }
  });
}

{
  const nodes = [
    makeNode('commit', 0, 0, 'process', 'M', { groupId: 'broker' }),
    makeNode('consume', 0, 0, 'process', 'M', { groupId: 'consumer_a' }),
  ];
  const edges = [
    makeEdge('pull', 'commit', 'consume', { label: 'Pull Request A' }),
  ];
  const laidOut = layoutNodesHeuristically(nodes, edges, { diagramType: 'sequence' });

  test('Sequence layout keeps at least 60px horizontal node clearance', () => {
    assertHorizontalGap(laidOut, 'commit', 'consume', 60);
  });
}

{
  const nodes = [
    makeNode('consume', 0, 0, 'process', 'M', { groupId: 'consumer_a' }),
    makeNode('db', 240, 0, 'process', 'M', { groupId: 'consumer_a' }),
  ];
  const edges = [
    makeEdge('db_tx', 'consume', 'db', { label: 'DB Transaction' }),
  ];
  const laidOut = layoutNodesHeuristically(nodes, edges, { diagramType: 'sequence' });
  const paths = calculateAllPaths(edges, laidOut, { diagramType: 'sequence' });

  test('Sequence labels reserve enough readable text-path width', () => {
    const required = 'DB Transaction'.length * 8 + 14 + 18;
    if (!paths.db_tx?.textPathD) throw new Error('missing text path');
    if ((paths.db_tx.textPathLen || 0) < required) {
      throw new Error(`expected text path >=${required}, got ${paths.db_tx.textPathLen || 0}`);
    }
  });
}

{
  const nodes = [
    makeNode('read', 0, 0, 'process', 'M', { groupId: 'consumer_b' }),
    makeNode('mail', 240, 0, 'process', 'M', { groupId: 'consumer_b' }),
  ];
  const edges = [
    makeEdge('smtp', 'read', 'mail', { label: 'SMTP' }),
  ];
  const paths = calculateAllPaths(edges, nodes, { diagramType: 'sequence' });

  test('Sequence labels leave target arrow clearance', () => {
    const path = paths.smtp;
    const textPts = parseTextPath(path?.textPathD);
    const routeEnd = path?.pts?.[path.pts.length - 1];
    if (!textPts || !routeEnd) throw new Error('missing route or text path for smtp');
    const minDistance = Math.min(...textPts.map(p => Math.abs(p.x - routeEnd.x) + Math.abs(p.y - routeEnd.y)));
    if (minDistance < 24) {
      throw new Error(`expected label path to avoid target marker, got ${minDistance}px clearance`);
    }
  });
}

{
  const nodes = [
    makeNode('source', 0, 0, 'process', 'M'),
    makeNode('target', 640, 0, 'process', 'M'),
  ];
  const edges = [
    makeEdge('leads', 'source', 'target', { label: 'leads to' }),
  ];
  const paths = calculateAllPaths(edges, nodes, { diagramType: 'sequence' });

  test('Sequence labels stay near the source side of long message segments', () => {
    const textPts = parseTextPath(paths.leads?.textPathD);
    const route = paths.leads?.pts || [];
    if (!textPts || route.length < 2) throw new Error('missing sequence text path');
    const textMidX = (textPts[0].x + textPts[1].x) / 2;
    const sourceX = route[0].x;
    const targetX = route[route.length - 1].x;
    if (Math.abs(textMidX - sourceX) >= Math.abs(targetX - textMidX)) {
      throw new Error(`label is closer to target arrow than source: source=${sourceX}, text=${textMidX}, target=${targetX}`);
    }
  });
}

{
  const nodes = [
    makeNode('source', 0, 0, 'process', 'M'),
    makeNode('target', 640, 0, 'process', 'M'),
  ];
  const edges = [
    makeEdge('leads', 'source', 'target', { label: 'leads to' }),
  ];
  const paths = calculateAllPaths(edges, nodes, { diagramType: 'sequence' });

  test('Sequence rightward labels anchor at the source-side 20px gap', () => {
    const path = paths.leads;
    if (path?.textPathTextAnchor !== 'start') {
      throw new Error(`expected rightward source-side start anchor, got ${path?.textPathTextAnchor}`);
    }
    if (path?.textPathStartOffset !== 20) {
      throw new Error(`expected rightward source-side 20px offset, got ${path?.textPathStartOffset}`);
    }
  });
}

{
  const nodes = [
    makeNode('source', 640, 0, 'process', 'M'),
    makeNode('target', 0, 0, 'process', 'M'),
  ];
  const edges = [
    makeEdge('leftward', 'source', 'target', { label: 'reply' }),
  ];
  const paths = calculateAllPaths(edges, nodes, { diagramType: 'sequence' });

  test('Sequence leftward labels anchor by their text end near the source', () => {
    const path = paths.leftward;
    if (path?.textPathTextAnchor !== 'end') {
      throw new Error(`expected leftward source-side end anchor, got ${path?.textPathTextAnchor}`);
    }
    if (path?.textPathStartOffset !== (path?.textPathLen || 0) - 20) {
      throw new Error(`expected leftward source-side 20px end offset, got ${path?.textPathStartOffset}/${path?.textPathLen}`);
    }
  });
}

{
  const nodes = [
    makeNode('source_a', 0, -100, 'process', 'M'),
    makeNode('source_b', 0, 100, 'process', 'M'),
    makeNode('target_a', 520, 100, 'process', 'M'),
    makeNode('target_b', 520, -100, 'process', 'M'),
  ];
  const edges = [
    makeEdge('solid_down', 'source_a', 'target_a', { label: 'Solid', lineStyle: 'solid' }),
    makeEdge('dashed_up', 'source_b', 'target_b', { label: 'Dashed', lineStyle: 'dashed' }),
  ];
  const paths = calculateAllPaths(edges, nodes, { diagramType: 'sequence' });

  test('Sequence vertical segments of different styles or directions do not merge', () => {
    const a = routeSegments(paths.solid_down?.pts || []);
    const b = routeSegments(paths.dashed_up?.pts || []);
    for (const segA of a) {
      for (const segB of b) {
        if (segmentsOverlapForTest(segA.a, segA.b, segB.a, segB.b)) {
          throw new Error(`different sequence messages overlap: ${point(segA.a)} -> ${point(segA.b)} and ${point(segB.a)} -> ${point(segB.b)}`);
        }
      }
    }
  });
}

{
  const nodes = [
    makeNode('source', 0, 0, 'process', 'M'),
    makeNode('upper', 520, -120, 'process', 'M'),
    makeNode('lower', 520, 120, 'process', 'M'),
  ];
  const edges = [
    makeEdge('to_lower', 'source', 'lower', { label: 'Lower', lineStyle: 'solid' }),
    makeEdge('to_upper', 'source', 'upper', { label: 'Upper', lineStyle: 'solid' }),
  ];
  const paths = calculateAllPaths(edges, nodes, { diagramType: 'sequence' });

  test('Sequence shared-source links can swap ports to avoid crossings', () => {
    const lower = paths.to_lower?.pts || [];
    const upper = paths.to_upper?.pts || [];
    if (routesCrossForTest(lower, upper)) {
      throw new Error(`shared-source sequence routes still cross after port swap: ${JSON.stringify({ lower, upper })}`);
    }
    const lowerStart = lower[0];
    const upperStart = upper[0];
    if (!lowerStart || !upperStart) throw new Error('missing swapped source routes');
    if (upperStart.y > lowerStart.y) {
      throw new Error(`upper target should receive the upper source port: upper=${point(upperStart)}, lower=${point(lowerStart)}`);
    }
  });
}

{
  const nodes = [
    makeNode('source', 0, 0, 'process', 'M'),
    makeNode('target', 240, 180, 'process', 'M'),
  ];
  const edges = [
    makeEdge('downward', 'source', 'target', { label: 'causes' }),
  ];
  const paths = calculateAllPaths(edges, nodes, { diagramType: 'sequence' });

  test('Sequence downward labels anchor by their text end near the source turn', () => {
    const path = paths.downward;
    if (path?.textPathTextAnchor !== 'end') {
      throw new Error(`expected downward source-side end anchor, got ${path?.textPathTextAnchor}`);
    }
    if (path?.textPathStartOffset !== (path?.textPathLen || 0) - 20) {
      throw new Error(`expected downward source-side 20px end offset, got ${path?.textPathStartOffset}/${path?.textPathLen}`);
    }
  });
}

{
  const nodes = [
    makeNode('source', 0, 0, 'process', 'M'),
    makeNode('target', 300, 0, 'process', 'M'),
  ];
  const edges = [
    makeEdge('tight_handoff', 'source', 'target', { label: 'Handoff' }),
  ];
  const paths = calculateAllPaths(edges, nodes, { diagramType: 'sequence' });

  test('Sequence labels use the 5px tight window when the 20px window does not fit', () => {
    const expectedTightWindow = 'Handoff'.length * 8 + 14 + 18 + 5 * 2;
    const expectedPreferredWindow = 'Handoff'.length * 8 + 14 + 18 + 20 * 2;
    const len = paths.tight_handoff?.textPathLen || 0;
    if (len < expectedTightWindow) {
      throw new Error(`expected tight text path >=${expectedTightWindow}, got ${len}`);
    }
    if (len >= expectedPreferredWindow) {
      throw new Error(`expected tight text path <${expectedPreferredWindow}, got ${len}`);
    }
  });
}

{
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const rootDir = path.resolve(__dirname, '../..');
  const sampleFiles = ['sequence_1_medium.cci', 'sequence_2_complex.cci'];

  test('Sequence samples never use top or bottom message ports', () => {
    sampleFiles.forEach(file => {
      const parsed = parseCharticiFile(fs.readFileSync(path.join(rootDir, 'samples', file), 'utf8'));
      const nodes = layoutNodesHeuristically(parsed.nodes, parsed.edges, {
        diagramType: 'sequence',
        groups: parsed.groups,
      });
      const paths = calculateAllPaths(parsed.edges, nodes, { diagramType: 'sequence' });
      parsed.edges
        .filter(edge => edge.lineStyle !== 'none')
        .forEach(edge => assertSidePorts(paths[edge.id]?.pts, `${file}:${edge.id}`));
    });
  });
}

{
  const capaNodes = [
    makeNode('c_1', 0, 0, 'process', 'L', { groupId: 'g_containment' }),
    makeNode('r_1', 260, 130, 'process', 'L', { groupId: 'g_root_cause_analysis' }),
    makeNode('a_1', 520, 260, 'process', 'L', { groupId: 'g_corrective_action' }),
    makeNode('v_1', 780, 390, 'process', 'L', { groupId: 'g_verification' }),
  ];
  const capaEdges = [
    makeEdge('c_r', 'c_1', 'r_1', { connectionType: 'target', lineStyle: 'solid', label: 'Handoff' }),
    makeEdge('r_a', 'r_1', 'a_1', { connectionType: 'target', lineStyle: 'solid', label: 'Handoff' }),
    makeEdge('a_v', 'a_1', 'v_1', { connectionType: 'target', lineStyle: 'solid', label: 'Handoff' }),
    makeEdge('v_c', 'v_1', 'c_1', { connectionType: 'target', lineStyle: 'dashed', label: 'Closure' }),
  ];
  const paths = calculateAllPaths(capaEdges, capaNodes, { diagramType: 'sequence' });

  test('Sequence loop does not reuse one side port for different style or direction', () => {
    const handoffEnd = paths.a_v?.pts?.at(-1);
    const closureStart = paths.v_c?.pts?.[0];
    if (!handoffEnd || !closureStart) throw new Error('missing CAPA loop routes');
    if (handoffEnd.x === closureStart.x && handoffEnd.y === closureStart.y) {
      throw new Error(`v_1 reused one port for incoming solid and outgoing dashed: ${point(handoffEnd)}`);
    }
  });
}

{
  const nodes = [
    makeNode('source_a', 0, 0, 'process', 'M'),
    makeNode('source_b', 0, 120, 'process', 'M'),
    makeNode('target', 360, 60, 'process', 'M'),
  ];
  const edges = [
    makeEdge('solid_in', 'source_a', 'target', { label: 'Solid', lineStyle: 'solid' }),
    makeEdge('dashed_in', 'source_b', 'target', { label: 'Dashed', lineStyle: 'dashed' }),
  ];
  const paths = calculateAllPaths(edges, nodes, { diagramType: 'sequence' });

  test('Sequence incoming messages reserve distinct target side ports', () => {
    const a = paths.solid_in?.pts?.at(-1);
    const b = paths.dashed_in?.pts?.at(-1);
    if (!a || !b) throw new Error('missing incoming routes');
    if (a.x === b.x && a.y === b.y) {
      throw new Error(`target port reused by different line styles: ${point(a)}`);
    }
  });
}

{
  const nodes = [
    makeNode('source', 0, 0, 'process', 'M'),
    makeNode('blocker', 260, 0, 'process', 'M'),
    makeNode('target', 520, 0, 'process', 'M'),
  ];
  const edges = [
    makeEdge('around_blocker', 'source', 'target', { label: 'Handoff', lineStyle: 'solid' }),
  ];
  const paths = calculateAllPaths(edges, nodes, { diagramType: 'sequence' });

  test('Sequence same-row messages detour instead of crossing an intermediate node', () => {
    const pts = paths.around_blocker?.pts || [];
    if (pts.length < 2) throw new Error('missing blocker route');
    const blocker = nodes.find(node => node.id === 'blocker');
    const box = {
      left: blocker.x - (blocker.width || 160) / 2,
      right: blocker.x + (blocker.width || 160) / 2,
      top: blocker.y - (blocker.height || 80) / 2,
      bottom: blocker.y + (blocker.height || 80) / 2,
    };
    for (let i = 0; i < pts.length - 1; i++) {
      if (segmentCrossesRectInterior(pts[i], pts[i + 1], box)) {
        throw new Error(`route crosses blocker: ${point(pts[i])} -> ${point(pts[i + 1])}`);
      }
    }
  });
}

function assertSidePorts(pts, edgeId) {
  if (!Array.isArray(pts) || pts.length < 2) {
    throw new Error(`${edgeId} has no route`);
  }
  const first = pts[0];
  const second = pts[1];
  const beforeLast = pts[pts.length - 2];
  const last = pts[pts.length - 1];
  if (Math.abs(first.y - second.y) > 0.01 || Math.abs(first.x - second.x) < 0.01) {
    throw new Error(`${edgeId} exits vertically: ${point(first)} -> ${point(second)}`);
  }
  if (Math.abs(beforeLast.y - last.y) > 0.01 || Math.abs(beforeLast.x - last.x) < 0.01) {
    throw new Error(`${edgeId} enters vertically: ${point(beforeLast)} -> ${point(last)}`);
  }
}

function assertTerminalStub(pts, edgeId, role, expected) {
  if (!Array.isArray(pts) || pts.length < 2) {
    throw new Error(`${edgeId} has no route`);
  }
  const a = role === 'start' ? pts[0] : pts[pts.length - 2];
  const b = role === 'start' ? pts[1] : pts[pts.length - 1];
  const len = Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
  if (len !== expected) {
    throw new Error(`${edgeId} ${role} stub expected ${expected}, got ${len}: ${point(a)} -> ${point(b)}`);
  }
}

function assertHorizontalGap(nodes, leftId, rightId, expected) {
  const byId = new Map(nodes.map(node => [String(node.id), node]));
  const left = byId.get(String(leftId));
  const right = byId.get(String(rightId));
  if (!left || !right) throw new Error(`missing nodes ${leftId}/${rightId}`);
  const gap = (right.x - (right.w || 0) / 2) - (left.x + (left.w || 0) / 2);
  if (gap < expected) {
    throw new Error(`expected ${leftId}->${rightId} horizontal gap >=${expected}, got ${gap}`);
  }
}

function point(p) {
  return `${p.x},${p.y}`;
}

function parseTextPath(d) {
  const match = /^M\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+L\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)$/.exec(d || '');
  if (!match) return null;
  return [
    { x: Number(match[1]), y: Number(match[2]) },
    { x: Number(match[3]), y: Number(match[4]) },
  ];
}

function routeSegments(pts) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) out.push({ a: pts[i], b: pts[i + 1] });
  return out;
}

function segmentsOverlapForTest(a1, a2, b1, b2) {
  const aH = Math.abs(a1.y - a2.y) < 0.01;
  const bH = Math.abs(b1.y - b2.y) < 0.01;
  if (aH !== bH) return false;
  if (aH) {
    if (Math.abs(a1.y - b1.y) > 0.01) return false;
    return Math.max(Math.min(a1.x, a2.x), Math.min(b1.x, b2.x)) < Math.min(Math.max(a1.x, a2.x), Math.max(b1.x, b2.x));
  }
  if (Math.abs(a1.x - b1.x) > 0.01) return false;
  return Math.max(Math.min(a1.y, a2.y), Math.min(b1.y, b2.y)) < Math.min(Math.max(a1.y, a2.y), Math.max(b1.y, b2.y));
}

function routesCrossForTest(ptsA, ptsB) {
  for (const a of routeSegments(ptsA)) {
    for (const b of routeSegments(ptsB)) {
      if (segmentsCrossForTest(a.a, a.b, b.a, b.b)) return true;
    }
  }
  return false;
}

function segmentsCrossForTest(a, b, c, d) {
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

function segmentCrossesRectInterior(a, b, box) {
  const minX = Math.min(a.x, b.x);
  const maxX = Math.max(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxY = Math.max(a.y, b.y);
  if (Math.abs(a.y - b.y) < 0.01) {
    return a.y > box.top && a.y < box.bottom && Math.max(minX, box.left) < Math.min(maxX, box.right);
  }
  if (Math.abs(a.x - b.x) < 0.01) {
    return a.x > box.left && a.x < box.right && Math.max(minY, box.top) < Math.min(maxY, box.bottom);
  }
  return false;
}

summary('engine.sequence.test.mjs');
