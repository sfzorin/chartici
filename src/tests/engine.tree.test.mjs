import { calculateAllPaths } from '../utils/engine/index.js';
import { layoutNodesHeuristically } from '../utils/nodeLayouter.js';
import { getTrueBox } from '../utils/engine/geometry.js';
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
test('Tree orthogonal branches keep square bends', () => {
  if (/ Q /.test(paths.e1?.pathD || '')) throw new Error(`tree bends should not be rounded: ${paths.e1?.pathD}`);
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

  test('Wide tree second-row fan-outs do not run through first-row nodes', () => {
    const paths = calculateAllPaths(wideEdges, laidOut, { diagramType: 'tree' });
    assertNoTreePathRunsThroughForeignNode(wideEdges, paths, laidOut);
  });

  test('Wide tree second-row fan-outs prefer inner row corridors before outer detours', () => {
    const paths = calculateAllPaths(wideEdges, laidOut, { diagramType: 'tree' });
    const children = laidOut.filter(node => String(node.id).startsWith('child_'));
    const firstRowY = Math.min(...children.map(node => node.y));
    const secondRow = children.filter(node => node.y > firstRowY);
    const firstRowBoxes = children
      .filter(node => node.y === firstRowY)
      .map(getTrueBox)
      .sort((a, b) => a.left - b.left);
    const innerGaps = firstRowBoxes.slice(0, -1).map((box, index) => ({
      left: box.right,
      right: firstRowBoxes[index + 1].left,
    }));

    secondRow.forEach(node => {
      const path = paths[`wide_${String(node.id).split('_')[1]}`];
      const descent = path.pts
        .slice(0, -1)
        .map((pt, index) => [pt, path.pts[index + 1]])
        .find(([a, b]) => Math.abs(a.x - b.x) < 0.01 && Math.abs(b.y - getTrueBox(node).top) < 0.01);
      if (!descent) throw new Error(`missing final descent for ${node.id}`);
      const x = descent[0].x;
      if (!innerGaps.some(gap => x > gap.left && x < gap.right)) {
        throw new Error(`${node.id} used outer detour x=${x} despite available inner gaps`);
      }
    });
  });
}

{
  const compactNodes = [
    makeNode('root', 0, 0),
    makeNode('a', 0, 0),
    makeNode('b', 0, 0),
    makeNode('c', 0, 0),
    makeNode('a1', 0, 0),
    makeNode('a2', 0, 0),
    makeNode('b1', 0, 0),
    makeNode('b2', 0, 0),
    makeNode('c1', 0, 0),
    makeNode('c2', 0, 0),
  ];
  const compactEdges = [
    makeEdge('root_a', 'root', 'a'),
    makeEdge('root_b', 'root', 'b'),
    makeEdge('root_c', 'root', 'c'),
    makeEdge('a_1', 'a', 'a1'),
    makeEdge('a_2', 'a', 'a2'),
    makeEdge('b_1', 'b', 'b1'),
    makeEdge('b_2', 'b', 'b2'),
    makeEdge('c_1', 'c', 'c1'),
    makeEdge('c_2', 'c', 'c2'),
  ];
  const laidOut = layoutNodesHeuristically(compactNodes, compactEdges, { diagramType: 'tree' });
  const leaves = laidOut.filter(node => /[abc][12]/.test(String(node.id)));
  const span = Math.max(...leaves.map(node => node.x)) - Math.min(...leaves.map(node => node.x));

  test('Tree layout keeps sibling subtrees compact horizontally', () => {
    if (span > 1000) throw new Error(`expected compact leaf span <=1000px, got ${span}px`);
  });
}

{
  const chainNodes = [
    makeNode('root', 0, 0),
    makeNode('q1', 0, 0),
    makeNode('fix', 0, 0),
    makeNode('q2', 0, 0),
    makeNode('train', 0, 0),
    makeNode('q3', 0, 0),
    makeNode('coach', 0, 0),
    makeNode('repeat', 0, 0),
    makeNode('correct', 0, 0),
    makeNode('warn', 0, 0),
  ];
  const chainEdges = [
    makeEdge('root_q1', 'root', 'q1'),
    makeEdge('q1_fix', 'q1', 'fix'),
    makeEdge('q1_q2', 'q1', 'q2'),
    makeEdge('q2_train', 'q2', 'train'),
    makeEdge('q2_q3', 'q2', 'q3'),
    makeEdge('q3_coach', 'q3', 'coach'),
    makeEdge('q3_repeat', 'q3', 'repeat'),
    makeEdge('repeat_correct', 'repeat', 'correct'),
    makeEdge('repeat_warn', 'repeat', 'warn'),
  ];
  const laidOut = layoutNodesHeuristically(chainNodes, chainEdges, { diagramType: 'tree' });
  const byId = new Map(laidOut.map(node => [node.id, node]));

  test('Mixed leaf-and-branch tree rows keep leaf actions near their parent', () => {
    const q1 = byId.get('q1');
    const fix = byId.get('fix');
    const q2 = byId.get('q2');
    if (Math.abs(fix.x - q1.x) > 260) throw new Error(`leaf action drifted too far from parent: ${Math.abs(fix.x - q1.x)}px`);
    if (!(q2.x > q1.x)) throw new Error(`continuing branch should keep its staircase direction: q1=${q1.x}, q2=${q2.x}`);
  });
}

{
  const stackedNeighborNodes = [
    makeNode('root', 0, 0),
    makeNode('stack_parent', 0, 0),
    makeNode('neighbor', 0, 0),
    makeNode('neighbor_leaf', 0, 0),
    ...Array.from({ length: 5 }, (_, index) => makeNode(`stack_leaf_${index + 1}`, 0, 0)),
  ];
  const stackedNeighborEdges = [
    makeEdge('root_stack', 'root', 'stack_parent'),
    makeEdge('root_neighbor', 'root', 'neighbor'),
    makeEdge('neighbor_leaf', 'neighbor', 'neighbor_leaf'),
    ...Array.from({ length: 5 }, (_, index) => makeEdge(`stack_${index + 1}`, 'stack_parent', `stack_leaf_${index + 1}`)),
  ];
  const laidOut = layoutNodesHeuristically(stackedNeighborNodes, stackedNeighborEdges, { diagramType: 'tree' });
  const byId = new Map(laidOut.map(node => [node.id, node]));
  const stackParent = byId.get('stack_parent');
  const neighbor = byId.get('neighbor');
  const firstLeaf = byId.get('stack_leaf_1');
  const stackLeafDim = { w: firstLeaf.w ?? 140 };
  const neighborDim = { w: neighbor.w ?? 140 };
  const stackTrunkX = firstLeaf.x - stackLeafDim.w / 2 - 40;
  const neighborLeft = neighbor.x - neighborDim.w / 2;

  test('Stacked tree subtrees reserve their left routing trunk in sibling packing', () => {
    if (!(neighbor.x > stackParent.x)) throw new Error('expected neighbor to be packed to the right of the stacked subtree');
    if (neighborLeft - stackTrunkX < 40) {
      throw new Error(`expected >=40px between stack trunk and neighbor, got ${neighborLeft - stackTrunkX}px`);
    }
  });
}

{
  const singleParentNodes = [
    makeNode('root', 0, 0),
    makeNode('branch', 0, 0),
    makeNode('plain', 0, 0),
    ...Array.from({ length: 6 }, (_, index) => makeNode(`leaf_${index + 1}`, 0, 0)),
  ];
  const singleParentEdges = [
    makeEdge('root_branch', 'root', 'branch'),
    makeEdge('root_plain', 'root', 'plain'),
    ...Array.from({ length: 6 }, (_, index) => makeEdge(`branch_leaf_${index + 1}`, 'branch', `leaf_${index + 1}`)),
  ];
  const laidOut = layoutNodesHeuristically(singleParentNodes, singleParentEdges, { diagramType: 'tree' });
  const leafRows = laidOut
    .filter(node => String(node.id).startsWith('leaf_'))
    .reduce((rows, node) => {
      const key = Math.round(node.y / 20) * 20;
      rows.set(key, (rows.get(key) || 0) + 1);
      return rows;
    }, new Map());

  test('Tree uses horizontal children when only one parent on the level has children', () => {
    if (leafRows.size !== 1) throw new Error(`expected one horizontal child row, got ${leafRows.size}`);
    const [count] = leafRows.values();
    if (count !== 6) throw new Error(`expected all 6 children in the row, got ${count}`);
  });
}

{
  const balancedStackNodes = [
    makeNode('root', 0, 0),
    makeNode('branch', 0, 0),
    makeNode('cousin', 0, 0),
    makeNode('cousin_leaf', 0, 0),
    ...Array.from({ length: 6 }, (_, index) => makeNode(`leaf_${index + 1}`, 0, 0)),
  ];
  const balancedStackEdges = [
    makeEdge('root_branch', 'root', 'branch'),
    makeEdge('root_cousin', 'root', 'cousin'),
    makeEdge('cousin_leaf', 'cousin', 'cousin_leaf'),
    ...Array.from({ length: 6 }, (_, index) => makeEdge(`branch_leaf_${index + 1}`, 'branch', `leaf_${index + 1}`)),
  ];
  const laidOut = layoutNodesHeuristically(balancedStackNodes, balancedStackEdges, { diagramType: 'tree' });
  const leafCols = laidOut
    .filter(node => String(node.id).startsWith('leaf_'))
    .reduce((cols, node) => {
      const key = Math.round(node.x / 20) * 20;
      cols.set(key, (cols.get(key) || 0) + 1);
      return cols;
    }, new Map());

  test('Tree stacked leaves split two vertical columns evenly when cousins exist', () => {
    const counts = [...leafCols.values()].sort((a, b) => b - a);
    if (counts.length !== 2) throw new Error(`expected 2 stack columns, got ${counts.length}`);
    if (Math.abs(counts[0] - counts[1]) > 1) {
      throw new Error(`expected balanced stack columns, got ${counts.join(' / ')}`);
    }
  });
}

{
  const promotionNodes = [
    makeNode('root', 0, 0, 'process', 'M'),
    makeNode('reliable', 0, 0, 'process', 'M'),
    makeNode('mission', 0, 0, 'process', 'M'),
    makeNode('inconsistent', 0, 0, 'process', 'M'),
    makeNode('increment', 0, 0, 'process', 'M'),
    makeNode('frozen', 0, 0, 'process', 'M'),
    makeNode('ceiling', 0, 0, 'process', 'M'),
    makeNode('stands', 0, 0, 'process', 'M'),
    makeNode('promotion', 0, 0, 'process', 'M'),
  ];
  const promotionEdges = [
    makeEdge('root_reliable', 'root', 'reliable'),
    makeEdge('root_mission', 'root', 'mission'),
    makeEdge('root_inconsistent', 'root', 'inconsistent'),
    makeEdge('mission_increment', 'mission', 'increment'),
    makeEdge('inconsistent_frozen', 'inconsistent', 'frozen'),
    makeEdge('increment_ceiling', 'increment', 'ceiling'),
    makeEdge('ceiling_stands', 'ceiling', 'stands'),
    makeEdge('ceiling_promotion', 'ceiling', 'promotion'),
  ];
  const laidOut = layoutNodesHeuristically(promotionNodes, promotionEdges, { diagramType: 'tree' });
  const byId = new Map(laidOut.map(node => [node.id, node]));

  test('Tree parents center over direct children, not deeper grandchildren', () => {
    const root = byId.get('root');
    const kids = ['reliable', 'mission', 'inconsistent'].map(id => byId.get(id));
    const left = Math.min(...kids.map(node => node.x - (node.width || 160) / 2));
    const right = Math.max(...kids.map(node => node.x + (node.width || 160) / 2));
    const directChildCenter = (left + right) / 2;
    if (Math.abs(root.x - directChildCenter) > 20) {
      throw new Error(`root drifted ${Math.abs(root.x - directChildCenter)}px from direct child row center`);
    }
  });
}

summary('engine.tree.test.mjs');

function assertNoTreePathRunsThroughForeignNode(edges, paths, nodes) {
  edges.forEach(edge => {
    const path = paths[edge.id];
    if (!path?.pts) throw new Error(`missing path for ${edge.id}`);
    const own = new Set([String(edge.from), String(edge.to)]);
    for (let i = 0; i < path.pts.length - 1; i++) {
      const a = path.pts[i];
      const b = path.pts[i + 1];
      nodes.forEach(node => {
        if (own.has(String(node.id))) return;
        if (segmentCrossesNodeBox(a, b, getTrueBox(node))) {
          throw new Error(`${edge.id} runs through ${node.id}`);
        }
      });
    }
  });
}

function segmentCrossesNodeBox(a, b, box) {
  const minX = Math.min(a.x, b.x);
  const maxX = Math.max(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxY = Math.max(a.y, b.y);
  if (Math.abs(a.y - b.y) < 0.01) {
    return a.y >= box.top - 0.01
      && a.y <= box.bottom + 0.01
      && Math.max(minX, box.left) <= Math.min(maxX, box.right);
  }
  if (Math.abs(a.x - b.x) < 0.01) {
    return a.x >= box.left - 0.01
      && a.x <= box.right + 0.01
      && Math.max(minY, box.top) <= Math.min(maxY, box.bottom);
  }
  return false;
}
