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
  const stackedNodes = [
    makeNode('parent', 0, 0),
    makeNode('leaf_1', 0, 180, 'rect', 'M', { _stackEntry: 'Left' }),
    makeNode('leaf_2', 0, 300, 'rect', 'M', { _stackEntry: 'Left' }),
    makeNode('leaf_3', 0, 420, 'rect', 'M', { _stackEntry: 'Left' }),
  ];
  const stackedEdges = [
    makeEdge('stack_1', 'parent', 'leaf_1'),
    makeEdge('stack_2', 'parent', 'leaf_2'),
    makeEdge('stack_3', 'parent', 'leaf_3'),
  ];
  const stackedPaths = calculateAllPaths(stackedEdges, stackedNodes, { diagramType: 'tree' });
  const s1 = analyzeEdge(stackedPaths, 'stack_1', stackedNodes);
  const s2 = analyzeEdge(stackedPaths, 'stack_2', stackedNodes);
  const s3 = analyzeEdge(stackedPaths, 'stack_3', stackedNodes);

  test('Stacked tree children exit bottom and enter from Left', () => {
    expect(s1.exitPort, 'Bottom', 'stack_1 exit'); expect(s1.entryPort, 'Left', 'stack_1 entry');
    expect(s2.exitPort, 'Bottom', 'stack_2 exit'); expect(s2.entryPort, 'Left', 'stack_2 entry');
    expect(s3.exitPort, 'Bottom', 'stack_3 exit'); expect(s3.entryPort, 'Left', 'stack_3 entry');
  });

  test('Stacked tree children share one left vertical trunk', () => {
    const trunkXs = [s1, s2, s3].map(route => route.pts[2]?.x);
    if (new Set(trunkXs).size !== 1) throw new Error(`expected shared trunk x, got ${trunkXs.join(', ')}`);
    if (!(trunkXs[0] < s1.pts[0].x)) throw new Error(`expected trunk left of parent, got ${trunkXs[0]} >= ${s1.pts[0].x}`);
    [s1, s2, s3].forEach((route, index) => {
      const beforeLast = route.pts[route.pts.length - 2];
      const last = route.pts[route.pts.length - 1];
      if (!(beforeLast.x < last.x && beforeLast.y === last.y)) {
        throw new Error(`stack_${index + 1} should enter child horizontally from the left`);
      }
    });
  });
}

{
  const twoColumnNodes = [
    makeNode('parent', 0, 0),
    makeNode('left_1', -140, 180, 'rect', 'M', { _stackEntry: 'Left' }),
    makeNode('left_2', -140, 300, 'rect', 'M', { _stackEntry: 'Left' }),
    makeNode('right_1', 180, 180, 'rect', 'M', { _stackEntry: 'Left' }),
    makeNode('right_2', 180, 300, 'rect', 'M', { _stackEntry: 'Left' }),
  ];
  const twoColumnEdges = [
    makeEdge('left_a', 'parent', 'left_1'),
    makeEdge('left_b', 'parent', 'left_2'),
    makeEdge('right_a', 'parent', 'right_1'),
    makeEdge('right_b', 'parent', 'right_2'),
  ];
  const twoColumnPaths = calculateAllPaths(twoColumnEdges, twoColumnNodes, { diagramType: 'tree' });
  const routes = twoColumnEdges.map(edge => analyzeEdge(twoColumnPaths, edge.id, twoColumnNodes));

  test('Two stacked tree columns split from one T fork', () => {
    const forkPoints = routes.map(route => `${route.pts[1]?.x},${route.pts[1]?.y}`);
    if (new Set(forkPoints).size !== 1) throw new Error(`expected one shared T fork, got ${forkPoints.join(' | ')}`);
    const trunks = routes.map(route => route.pts[2]?.x);
    if (new Set(trunks).size !== 2) throw new Error(`expected two column trunks, got ${trunks.join(', ')}`);
  });

  test('Stacked tree trunks keep clearance before entering children from left', () => {
    routes.forEach((route, index) => {
      expect(route.entryPort, 'Left', `route ${index + 1} entry`);
      const beforeLast = route.pts[route.pts.length - 2];
      const last = route.pts[route.pts.length - 1];
      if (last.x - beforeLast.x < 40) throw new Error(`route ${index + 1} has too short left-entry clearance`);
    });
  });
}

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
