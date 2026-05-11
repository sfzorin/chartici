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

summary('engine.sequence.test.mjs');
