import { calculateAllPaths } from '../utils/engine/index.js';
import { getNodeDim } from '../diagram/nodes.jsx';
import { layoutNodesHeuristically } from '../utils/nodeLayouter.js';
import { test, expect, summary, makeNode, makeEdge, analyzeEdge } from './testRunner.mjs';

console.log('\n📐 Flowchart Engine: Horizontal & Vertical Routing');

{
  const nodes = [makeNode('A', 0, 0), makeNode('B', 0, 200)];
  const edges = [makeEdge('e1', 'A', 'B')];
  const paths = calculateAllPaths(edges, nodes, { diagramType: 'flowchart' });
  const r = analyzeEdge(paths, 'e1', nodes);
  test('Vertical A→B is valid', () => expect(r.valid, true, 'valid'));
  test('Vertical A→B exits Bottom', () => expect(r.exitPort, 'Bottom', 'exitPort'));
  test('Vertical A→B enters Top', () => expect(r.entryPort, 'Top', 'entryPort'));
}

{
  const nodes = [makeNode('A', 0, 0), makeNode('B', 300, 200)];
  const edges = [makeEdge('e1', 'A', 'B')];
  const paths = calculateAllPaths(edges, nodes, { diagramType: 'flowchart' });
  const r = analyzeEdge(paths, 'e1', nodes);
  test('Diagonal A→B has 2 bends (Z-shape)', () => expect(r.bends, 2, 'bends'));
}

{
  const nodes = [makeNode('A', 0, 0), makeNode('B', 0, 200), makeNode('C', 0, 400)];
  const edges = [makeEdge('e1', 'A', 'C')];
  const paths = calculateAllPaths(edges, nodes, { diagramType: 'flowchart' });
  const r = analyzeEdge(paths, 'e1', nodes);
  test('Obstacle avoidance creates multiple bends', () => {
    if (r.bends < 2) throw new Error(`bends: expected >=2, got ${r.bends}`);
  });
}

{
  const nodes = [makeNode('A', 0, 0), makeNode('B', 0, 200)];
  const edges = [{ id: 'e1', sourceId: 'A', targetId: 'B' }];
  const paths = calculateAllPaths(edges, nodes, { diagramType: 'flowchart' });
  const r = analyzeEdge(paths, 'e1', nodes);
  test('sourceId/targetId-only edge is routable', () => expect(r.valid, true, 'valid'));
}

{
  const nodes = [
    makeNode('A', -360, -120),
    makeNode('B', -360, 0),
    makeNode('C', -360, 120),
    makeNode('D', 0, 0, 'rhombus'),
  ];
  const edges = [
    makeEdge('e1', 'A', 'D'),
    makeEdge('e2', 'B', 'D'),
    makeEdge('e3', 'C', 'D'),
  ];
  const paths = calculateAllPaths(edges, nodes, { diagramType: 'flowchart' });
  const entries = edges.map(edge => analyzeEdge(paths, edge.id, nodes).entryPort);
  test('Multiple inputs to a decision share one grouped entry side', () => {
    const uniqueEntries = new Set(entries);
    expect(uniqueEntries.size, 1, 'entry side count');
    expect(entries[0], 'Left', 'entry side');
  });
}

{
  const nodes = [
    makeNode('A', 0, -160, 'process'),
    makeNode('B', 0, 0, 'process'),
    makeNode('C', 0, 160, 'process'),
    makeNode('D', 320, 0, 'rhombus'),
    makeNode('E', 640, 0, 'process'),
  ];
  const edges = [
    makeEdge('e1', 'A', 'D'),
    makeEdge('e2', 'B', 'D'),
    makeEdge('e3', 'C', 'D'),
    makeEdge('e4', 'D', 'E'),
  ];
  const laidOut = layoutNodesHeuristically(nodes, edges, { diagramType: 'flowchart' });
  const byId = new Map(laidOut.map(node => [String(node.id), node]));
  const sources = ['A', 'B', 'C'].map(id => byId.get(id));
  const decision = byId.get('D');
  const sourceRight = Math.max(...sources.map(node => (node.x || 0) + getNodeDim(node).width / 2));
  const decisionLeft = (decision.x || 0) - getNodeDim(decision).width / 2;

  test('Layout reserves a compact merge pocket before multi-input decisions', () => {
    const pocket = decisionLeft - sourceRight;
    if (pocket < 80) throw new Error(`expected pocket >=80px, got ${pocket}px`);
    if (pocket > 140) throw new Error(`expected pocket <=140px, got ${pocket}px`);
  });
}

{
  const nodes = [
    makeNode('D', 0, 0, 'rhombus'),
    makeNode('A', 360, -240),
    makeNode('B', 360, -120),
    makeNode('C', 360, 0),
    makeNode('E', 360, 120),
    makeNode('F', 360, 240),
  ];
  const edges = [
    makeEdge('e1', 'D', 'A'),
    makeEdge('e2', 'D', 'B'),
    makeEdge('e3', 'D', 'C'),
    makeEdge('e4', 'D', 'E'),
    makeEdge('e5', 'D', 'F'),
  ];
  const paths = calculateAllPaths(edges, nodes, { diagramType: 'flowchart' });
  test('Dense decision outputs can use extra diamond side ports', () => {
    const fallbacks = edges.filter(edge => paths[edge.id]?.isFallback);
    if (fallbacks.length > 0) throw new Error(`expected no fallback routes, got ${fallbacks.map(edge => edge.id).join(', ')}`);
    const uniqueStarts = new Set(edges.map(edge => {
      const pt = paths[edge.id]?.pts?.[0];
      return pt ? `${Math.round(pt.x)},${Math.round(pt.y)}` : 'missing';
    }));
    if (uniqueStarts.size < 5) throw new Error(`expected at least 5 unique start ports, got ${uniqueStarts.size}`);
  });
}

summary('engine.flowchart.test.mjs');
