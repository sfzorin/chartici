import { calculateAllPaths } from '../utils/engine/index.js';
import { layoutNodesHeuristically } from '../utils/nodeLayouter.js';
import { test, expect, summary, makeNode, makeEdge, analyzeEdge } from './testRunner.mjs';

console.log('\n🌲 Tree Engine: Hierarchical Fan-out');

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

test('All tree fan-out paths are valid', () => {
  expect(r1.valid, true, 'e1'); expect(r2.valid, true, 'e2'); expect(r3.valid, true, 'e3');
});
test('All tree branches exit from Bottom', () => {
  expect(r1.exitPort, 'Bottom', 'e1'); expect(r2.exitPort, 'Bottom', 'e2'); expect(r3.exitPort, 'Bottom', 'e3');
});
test('All tree branches enter Top', () => {
  expect(r1.entryPort, 'Top', 'e1'); expect(r2.entryPort, 'Top', 'e2'); expect(r3.entryPort, 'Top', 'e3');
});

{
  const wideNodes = [
    makeNode('root', 0, 0),
    ...Array.from({ length: 11 }, (_, index) => makeNode(`child_${index + 1}`, 0, 0)),
  ];
  const wideEdges = Array.from({ length: 11 }, (_, index) => makeEdge(`wide_${index + 1}`, 'root', `child_${index + 1}`));
  const laidOut = layoutNodesHeuristically(wideNodes, wideEdges, { diagramType: 'tree' });
  const childRows = new Map();
  laidOut
    .filter(node => String(node.id).startsWith('child_'))
    .forEach(node => {
      const row = Math.round((node.y || 0) / 20) * 20;
      childRows.set(row, (childRows.get(row) || 0) + 1);
    });

  test('Wide tree fan-outs are balanced into shorter rows', () => {
    const counts = [...childRows.values()].sort((a, b) => b - a);
    if (counts.length < 2) throw new Error(`expected at least 2 child rows, got ${counts.length}`);
    if (counts[0] > 6) throw new Error(`expected max row length <=6, got ${counts[0]}`);
  });
}

summary('engine.tree.test.mjs');
