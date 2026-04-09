import { calculateAllPaths } from '../utils/engine/index.js';
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

summary('engine.flowchart.test.mjs');
