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
  test('Target arrows keep enough terminal line before the marker', () => {
    const len = terminalSegmentLength(paths.e1?.pts, 'end');
    if (len < 40) throw new Error(`end terminal segment too short for arrow marker: ${len}`);
  });
}

{
  const nodes = [makeNode('A', 0, 0), makeNode('B', 0, 200)];
  const edges = [makeEdge('e1', 'A', 'B', { connectionType: 'reverse' })];
  const paths = calculateAllPaths(edges, nodes, { diagramType: 'flowchart' });
  test('Reverse arrows keep enough terminal line before the marker', () => {
    const len = terminalSegmentLength(paths.e1?.pts, 'start');
    if (len < 40) throw new Error(`start terminal segment too short for arrow marker: ${len}`);
  });
}

{
  const nodes = [
    makeNode('A', 0, 0, 'process', 'L'),
    makeNode('B', 300, 0, 'process', 'L'),
  ];
  const edges = [makeEdge('e1', 'A', 'B')];
  const paths = calculateAllPaths(edges, nodes, { diagramType: 'flowchart' });
  test('Adjacent horizontal process links stay side-to-side when arrow room fits', () => {
    const pts = paths.e1?.pts || [];
    assertOrthogonalPath(pts, 'e1');
    if (pts.length < 3 || !pts.every(pt => pt.y === pts[0].y)) {
      throw new Error(`expected straight side-to-side link with preserved terminals, got ${pts.map(p => `${p.x},${p.y}`).join(' -> ')}`);
    }
    if (terminalSegmentLength(pts, 'start') < 20) throw new Error('straight adjacent link lost its source terminal stub');
    const len = terminalSegmentLength(pts, 'end');
    if (len < 40) throw new Error(`straight adjacent link too short for arrow marker: ${len}`);
  });
}

{
  const nodes = [
    makeNode('A', 0, 0, 'process', 'L'),
    makeNode('B', 500, 0, 'process', 'L'),
  ];
  const edges = [makeEdge('e1', 'A', 'B', { label: 'Go' })];
  const paths = calculateAllPaths(edges, nodes, { diagramType: 'flowchart' });
  test('Flowchart source-near labels measure their gap from the node boundary, not the terminal stub', () => {
    const pts = paths.e1?.pts || [];
    const placement = paths.e1?.manualLabelPlacement;
    if (!placement) throw new Error('missing manual label placement');
    const minX = pts[0].x + 20;
    if (placement.x < minX) {
      throw new Error(`expected label x at least ${minX} from node boundary, got ${placement.x}; path ${formatPts(pts)}`);
    }
    if (placement.y >= pts[0].y) {
      throw new Error(`expected label above horizontal route, got y=${placement.y} for route y=${pts[0].y}`);
    }
  });
}

{
  const nodes = [
    makeNode('P', 0, 0, 'process', 'M'),
    makeNode('A', 220, -80, 'process', 'M'),
    makeNode('B', 220, 60, 'process', 'M'),
  ];
  const edges = [
    makeEdge('e1', 'P', 'A'),
    makeEdge('e2', 'P', 'B'),
  ];
  const paths = calculateAllPaths(edges, nodes, { diagramType: 'flowchart' });
  test('Branched process links preserve a two-step terminal arrow stub', () => {
    edges.forEach(edge => {
      const pts = paths[edge.id]?.pts || [];
      assertOrthogonalPath(pts, edge.id);
      const len = terminalSegmentLength(pts, 'end');
      if (len < 40) throw new Error(`${edge.id} terminal segment too short: ${len}, path ${pts.map(p => `${p.x},${p.y}`).join(' -> ')}`);
    });
  });
}

{
  const nodes = [makeNode('A', 0, 0), makeNode('B', 300, 200)];
  const edges = [makeEdge('e1', 'A', 'B')];
  const paths = calculateAllPaths(edges, nodes, { diagramType: 'flowchart' });
  const r = analyzeEdge(paths, 'e1', nodes);
  test('Diagonal A→B chooses the minimal-bend clear route', () => expect(r.bends, 1, 'bends'));
  test('Bent flowchart routes render rounded corners', () => {
    if (!/ Q /.test(paths.e1?.pathD || '')) throw new Error(`expected rounded corner command in ${paths.e1?.pathD || 'missing path'}`);
  });
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
  const nodes = [
    makeNode('A', 0, 0, 'process', 'S'),
    makeNode('B', 400, 0, 'process', 'S'),
    makeNode('C', 250, 0, 'process', 'S'),
  ];
  const edges = [makeEdge('e1', 'A', 'B')];
  const paths = calculateAllPaths(edges, nodes, { diagramType: 'flowchart' });

  test('Flowchart hard constraint rejects routes under foreign nodes', () => {
    assertNoSegmentCrossesForeignNode(paths.e1?.pts || [], nodes, 'e1', ['A', 'B']);
  });
}

{
  const nodes = [
    makeNode('D', 0, 0, 'rhombus', 'S'),
    makeNode('T', 180, -80, 'process', 'S'),
  ];
  const edges = [makeEdge('e1', 'D', 'T', { label: 'Нет' })];
  const paths = calculateAllPaths(edges, nodes, { diagramType: 'flowchart' });

  test('Flowchart route bodies start after terminal stubs and stay clear of source/target nodes', () => {
    assertOrthogonalPath(paths.e1?.pts || [], 'e1');
    assertNoBodySegmentTouchesNodeClearance(paths.e1?.pts || [], nodes, 'e1', 'D', 'T', 10);
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
  test('Multiple inputs to a decision share one grouped entry side', () => {
    assertSingleDecisionFanIn(paths, edges, nodes, 'Left');
  });
  test('Grouped decision fan-in renders rounded merge bends', () => {
    edges.forEach(edge => {
      const pts = paths[edge.id]?.pts || [];
      if (countBendsForTest(pts) > 0 && !/ Q /.test(paths[edge.id]?.pathD || '')) {
        throw new Error(`${edge.id} grouped fan-in path is not rounded: ${paths[edge.id]?.pathD || 'missing'}`);
      }
    });
  });
}

{
  const nodes = [
    makeNode('A', -360, -80),
    makeNode('B', -360, 80),
    makeNode('D', 0, 0, 'rhombus'),
  ];
  const edges = [
    makeEdge('e1', 'A', 'D'),
    makeEdge('e2', 'B', 'D'),
  ];
  const paths = calculateAllPaths(edges, nodes, { diagramType: 'flowchart' });
  test('Two inputs to a decision share one grouped entry side', () => {
    assertSingleDecisionFanIn(paths, edges, nodes, 'Left');
  });
}

{
  const nodes = [
    makeNode('A', -360, 0),
    makeNode('B', 0, -220),
    makeNode('D', 0, 0, 'rhombus'),
  ];
  const edges = [
    makeEdge('e1', 'A', 'D'),
    makeEdge('e2', 'B', 'D'),
  ];
  const paths = calculateAllPaths(edges, nodes, { diagramType: 'flowchart' });
  test('Decision fan-in groups matching line types across approach directions', () => {
    assertSingleDecisionFanIn(paths, edges, nodes, 'Left');
  });
}

{
  const nodes = [
    makeNode('A', -360, -80),
    makeNode('B', -360, 80),
    makeNode('D', 0, 0, 'rhombus'),
  ];
  const edges = [
    makeEdge('e1', 'A', 'D', { lineStyle: 'solid' }),
    makeEdge('e2', 'B', 'D', { lineStyle: 'dashed' }),
  ];
  const paths = calculateAllPaths(edges, nodes, { diagramType: 'flowchart' });
  test('Decision fan-in does not group mixed line styles', () => {
    edges.forEach(edge => {
      if (paths[edge.id]?.groupedFanIn) throw new Error(`${edge.id} should not be grouped across mixed line styles`);
    });
  });
}

{
  const nodes = [
    makeNode('A', -360, -80),
    makeNode('B', -360, 80),
    makeNode('P', 0, 0, 'process'),
  ];
  const edges = [
    makeEdge('e1', 'A', 'P'),
    makeEdge('e2', 'B', 'P'),
  ];
  const paths = calculateAllPaths(edges, nodes, { diagramType: 'flowchart' });
  test('Fan-in grouping is not applied to rectangular process nodes', () => {
    edges.forEach(edge => {
      if (paths[edge.id]?.groupedFanIn) throw new Error(`${edge.id} should not group into a process node`);
    });
  });
}

{
  const nodes = [
    makeNode('A', -120, 0),
    makeNode('B', 0, -160),
    makeNode('D', 0, 0, 'rhombus'),
  ];
  const edges = [
    makeEdge('direct', 'A', 'D'),
    makeEdge('loop', 'B', 'D'),
  ];
  const paths = calculateAllPaths(edges, nodes, { diagramType: 'flowchart' });
  test('Short decision inputs still use one clean T-merge', () => {
    assertSingleDecisionFanIn(paths, edges, nodes, 'Left');
  });
}

{
  const nodes = [
    makeNode('D', 0, 0, 'rhombus'),
    makeNode('A', 360, -80),
    makeNode('B', 360, 80),
  ];
  const edges = [
    makeEdge('e1', 'D', 'A'),
    makeEdge('e2', 'D', 'B'),
  ];
  const paths = calculateAllPaths(edges, nodes, { diagramType: 'flowchart' });
  test('Fan-in grouping is not applied to decision outputs', () => {
    edges.forEach(edge => {
      if (paths[edge.id]?.groupedFanIn) throw new Error(`${edge.id} should not group on a decision output`);
    });
  });
}

{
  const nodes = [
    makeNode('D', 0, 0, 'rhombus'),
    makeNode('A', 360, -120),
    makeNode('B', 360, 0),
    makeNode('C', 360, 120),
  ];
  const edges = [
    makeEdge('e1', 'D', 'A'),
    makeEdge('e2', 'D', 'B'),
    makeEdge('e3', 'D', 'C'),
  ];
  const paths = calculateAllPaths(edges, nodes, { diagramType: 'flowchart' });
  test('Decision outputs do not share overlapping trunks', () => {
    const segments = [];
    for (const edge of edges) {
      const pts = paths[edge.id]?.pts || [];
      for (let i = 0; i < pts.length - 1; i++) {
        segments.push({ edgeId: edge.id, a: pts[i], b: pts[i + 1] });
      }
    }
    for (let i = 0; i < segments.length; i++) {
      for (let j = i + 1; j < segments.length; j++) {
        if (segments[i].edgeId === segments[j].edgeId) continue;
        if (segmentsOverlap(segments[i], segments[j])) {
          throw new Error(`${segments[i].edgeId} overlaps ${segments[j].edgeId}`);
        }
      }
    }
  });
}

{
  const nodes = [
    makeNode('Prev', 0, 0, 'rhombus'),
    makeNode('Decision', 220, 0, 'rhombus'),
    makeNode('Next', 180, 260, 'circle'),
  ];
  const edges = [
    makeEdge('input', 'Prev', 'Decision', { label: 'No' }),
    makeEdge('output', 'Decision', 'Next', { label: 'Yes' }),
  ];
  const paths = calculateAllPaths(edges, nodes, { diagramType: 'flowchart' });

  test('Decision outputs do not reuse an occupied decision input port', () => {
    const inputPort = paths.input?.pts?.at(-1);
    const outputPort = paths.output?.pts?.[0];
    if (!inputPort || !outputPort) throw new Error('missing decision ports');
    if (Math.abs(inputPort.x - outputPort.x) < 0.01 && Math.abs(inputPort.y - outputPort.y) < 0.01) {
      throw new Error(`decision output reused input port ${inputPort.x},${inputPort.y}`);
    }
  });
}

{
  const nodes = [
    makeNode('D', 0, 0, 'rhombus'),
    makeNode('P', 320, -120, 'process'),
    makeNode('E', 640, 0, 'oval'),
  ];
  const edges = [
    makeEdge('in', 'D', 'P', { label: 'No' }),
    makeEdge('out', 'P', 'D', { label: 'Retry' }),
    makeEdge('done', 'P', 'E'),
  ];
  const paths = calculateAllPaths(edges, nodes, { diagramType: 'flowchart' });
  test('Process nodes do not reuse one side for incoming and outgoing links', () => {
    const incoming = analyzeEdge(paths, 'in', nodes);
    const outgoing = analyzeEdge(paths, 'out', nodes);
    if (incoming.entryPort === outgoing.exitPort) {
      throw new Error(`process input and output share ${incoming.entryPort}`);
    }
  });
}

{
  const nodes = [
    makeNode('D', 0, 0, 'rhombus'),
    makeNode('P', 260, 120, 'process'),
  ];
  const edges = [
    makeEdge('yes', 'D', 'P', { label: 'Да' }),
  ];
  const paths = calculateAllPaths(edges, nodes, { diagramType: 'flowchart' });
  test('Short decision labels get enough text path space', () => {
    if (!paths.yes?.textPathD) throw new Error('missing textPathD for short decision label');
    if ((paths.yes.textPathLen || 0) < 36) {
      throw new Error(`expected textPathLen >=36, got ${paths.yes.textPathLen || 0}`);
    }
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
    makeNode('start', 0, 0, 'oval'),
    makeNode('a', 0, 0, 'process'),
    makeNode('b', 0, 0, 'process'),
    makeNode('c', 0, 0, 'process'),
    makeNode('end', 0, 0, 'oval'),
    makeNode('side', 0, 0, 'process'),
  ];
  const edges = [
    makeEdge('main_1', 'start', 'a'),
    makeEdge('main_2', 'a', 'b'),
    makeEdge('main_3', 'b', 'c'),
    makeEdge('main_4', 'c', 'end'),
    makeEdge('branch_1', 'a', 'side', { label: 'No' }),
    makeEdge('branch_2', 'side', 'c'),
  ];
  const laidOut = layoutNodesHeuristically(nodes, edges, { diagramType: 'flowchart' });
  const byId = new Map(laidOut.map(node => [String(node.id), node]));

  test('Flowchart gravity layout keeps the longest path on the main axis', () => {
    const main = ['start', 'a', 'b', 'c', 'end'].map(id => byId.get(id));
    const side = byId.get('side');
    if (main.some(node => !node) || !side) throw new Error('missing laid-out nodes');
    const axisY = main[0].y;
    main.forEach(node => {
      if (node.y !== axisY) throw new Error(`main path node ${node.id} left the axis: ${node.x},${node.y}`);
    });
    for (let i = 1; i < main.length; i++) {
      if (main[i].x <= main[i - 1].x) throw new Error(`main path is not left-to-right at ${main[i - 1].id}->${main[i].id}`);
    }
    if (side.y === axisY) throw new Error('side branch should leave the main axis');
  });
}

{
  const nodes = [
    makeNode('control', 0, 0, 'process'),
    makeNode('materials', 0, 0, 'process'),
    makeNode('data', 0, 0, 'process'),
    makeNode('join', 0, 0, 'process'),
    makeNode('product', 0, 0, 'process'),
  ];
  const edges = [
    makeEdge('e_control', 'control', 'join'),
    makeEdge('e_materials', 'materials', 'join'),
    makeEdge('e_data', 'data', 'join'),
    makeEdge('e_product', 'join', 'product'),
  ];
  const laidOut = layoutNodesHeuristically(nodes, edges, { diagramType: 'flowchart' });
  const byId = new Map(laidOut.map(node => [String(node.id), node]));

  test('Flowchart gravity layout centers multi-input joins between their sources', () => {
    const sources = ['control', 'materials', 'data'].map(id => byId.get(id));
    const join = byId.get('join');
    const product = byId.get('product');
    if (sources.some(node => !node) || !join || !product) throw new Error('missing laid-out nodes');
    const sourceYs = sources.map(node => node.y).sort((a, b) => a - b);
    if (!(sourceYs[0] < join.y && sourceYs[sourceYs.length - 1] > join.y)) {
      throw new Error(`join should sit between source lanes, sources=${sourceYs.join(',')}, join=${join.y}`);
    }
    if (product.y !== join.y) throw new Error(`single child should stay on join axis, join=${join.y}, product=${product.y}`);
    if (sourceYs[sourceYs.length - 1] - sourceYs[0] > 360) {
      throw new Error(`source lanes are too spread out: ${sourceYs.join(',')}`);
    }
    const sourceRight = Math.max(...sources.map(node => node.x + getNodeDim(node).width / 2));
    const joinLeft = join.x - getNodeDim(join).width / 2;
    if (joinLeft - sourceRight > 130) throw new Error(`join is too far from sources: gap=${joinLeft - sourceRight}`);
  });
}

{
  const nodes = [
    makeNode('start', 0, 0, 'oval'),
    makeNode('split', 0, 0, 'circle'),
    makeNode('topTask', 0, 0, 'process'),
    makeNode('cleanTask', 0, 0, 'process'),
    makeNode('bottomTask', 0, 0, 'process'),
    makeNode('join', 0, 0, 'process'),
    makeNode('topComp', 0, 0, 'process'),
    makeNode('bottomComp', 0, 0, 'process'),
    makeNode('rollback', 0, 0, 'process'),
    makeNode('commit', 0, 0, 'process'),
    makeNode('end', 0, 0, 'oval'),
  ];
  const edges = [
    makeEdge('e_start', 'start', 'split'),
    makeEdge('e_top', 'split', 'topTask'),
    makeEdge('e_clean', 'split', 'cleanTask'),
    makeEdge('e_bottom', 'split', 'bottomTask'),
    makeEdge('e_top_join', 'topTask', 'join', { label: 'Done' }),
    makeEdge('e_clean_join', 'cleanTask', 'join', { label: 'Wait' }),
    makeEdge('e_bottom_join', 'bottomTask', 'join', { label: 'Done' }),
    makeEdge('e_top_fail', 'topTask', 'topComp', { label: 'Failed' }),
    makeEdge('e_bottom_fail', 'bottomTask', 'bottomComp', { label: 'Failed' }),
    makeEdge('e_top_comp', 'topComp', 'rollback'),
    makeEdge('e_bottom_comp', 'bottomComp', 'rollback'),
    makeEdge('e_join_commit', 'join', 'commit'),
    makeEdge('e_commit_end', 'commit', 'end'),
    makeEdge('e_rollback_end', 'rollback', 'end', { label: 'Error' }),
  ];
  const laidOut = layoutNodesHeuristically(nodes, edges, { diagramType: 'flowchart' });
  const byId = new Map(laidOut.map(node => [String(node.id), node]));

  test('Flowchart parallel fan-in keeps the clean branch on the main axis', () => {
    const split = byId.get('split');
    const clean = byId.get('cleanTask');
    const join = byId.get('join');
    const top = byId.get('topTask');
    const bottom = byId.get('bottomTask');
    const topComp = byId.get('topComp');
    const bottomComp = byId.get('bottomComp');
    const rollback = byId.get('rollback');
    if (!split || !clean || !join || !top || !bottom || !topComp || !bottomComp || !rollback) throw new Error('missing laid-out nodes');
    if (clean.y !== split.y || join.y !== split.y) throw new Error(`clean branch left axis: split=${split.y}, clean=${clean.y}, join=${join.y}`);
    const branchYs = [top.y, bottom.y].sort((a, b) => a - b);
    if (!(branchYs[0] < clean.y && branchYs[1] > clean.y)) throw new Error(`compensating branches should surround the clean axis: branches=${branchYs.join(',')}, clean=${clean.y}`);
    if (topComp.y !== top.y || bottomComp.y !== bottom.y) throw new Error('compensation children should inherit their parent branch lane');
    if (rollback.y !== top.y && rollback.y !== bottom.y) throw new Error(`rollback should compact onto a compensation lane, got ${rollback.y}, branches ${top.y}/${bottom.y}`);
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
    const dim = getNodeDim(nodes[0]);
    edges.forEach(edge => {
      const pt = paths[edge.id]?.pts?.[0];
      if (!pt) throw new Error(`missing start point for ${edge.id}`);
      const diamondEquation = Math.abs(pt.x - nodes[0].x) / (dim.width / 2)
        + Math.abs(pt.y - nodes[0].y) / (dim.height / 2);
      if (Math.abs(diamondEquation - 1) > 0.02) {
        throw new Error(`${edge.id} starts from shifted non-diamond port ${pt.x},${pt.y}`);
      }
    });
  });
}

{
  const nodes = [
    makeNode('D', 0, 0, 'rhombus'),
    makeNode('A', 360, -180),
    makeNode('B', 360, -60),
    makeNode('C', 360, 60),
    makeNode('E', 360, 180),
  ];
  const edges = [
    makeEdge('e1', 'D', 'A'),
    makeEdge('e2', 'D', 'B'),
    makeEdge('e3', 'D', 'C'),
    makeEdge('e4', 'D', 'E'),
  ];
  const paths = calculateAllPaths(edges, nodes, { diagramType: 'flowchart' });
  test('Decision outputs use only main ports until degree exceeds four', () => {
    const dim = getNodeDim(nodes[0]);
    const mainPorts = new Set([
      `${nodes[0].x - dim.width / 2},${nodes[0].y}`,
      `${nodes[0].x + dim.width / 2},${nodes[0].y}`,
      `${nodes[0].x},${nodes[0].y - dim.height / 2}`,
      `${nodes[0].x},${nodes[0].y + dim.height / 2}`,
    ]);
    edges.forEach(edge => {
      const pt = paths[edge.id]?.pts?.[0];
      if (!pt) throw new Error(`missing start point for ${edge.id}`);
      const key = `${Math.round(pt.x)},${Math.round(pt.y)}`;
      if (!mainPorts.has(key)) throw new Error(`${edge.id} used auxiliary port ${key}`);
    });
  });
}

{
  const nodes = [
    makeNode('T1', -300, -180),
    makeNode('T2', -300, 0),
    makeNode('T3', -300, 180),
    makeNode('D', 0, 0, 'rhombus'),
    makeNode('A', 360, -180),
    makeNode('B', 360, 0),
    makeNode('C', 360, 180),
  ];
  const edges = [
    makeEdge('in1', 'T1', 'D'),
    makeEdge('in2', 'T2', 'D'),
    makeEdge('in3', 'T3', 'D'),
    makeEdge('out1', 'D', 'A'),
    makeEdge('out2', 'D', 'B'),
    makeEdge('out3', 'D', 'C'),
  ];
  const paths = calculateAllPaths(edges, nodes, { diagramType: 'flowchart' });
  test('Decision fan-in counts as one port slot for auxiliary output policy', () => {
    const dim = getNodeDim(nodes[3]);
    const mainPorts = new Set([
      `${nodes[3].x - dim.width / 2},${nodes[3].y}`,
      `${nodes[3].x + dim.width / 2},${nodes[3].y}`,
      `${nodes[3].x},${nodes[3].y - dim.height / 2}`,
      `${nodes[3].x},${nodes[3].y + dim.height / 2}`,
    ]);
    ['out1', 'out2', 'out3'].forEach(edgeId => {
      const pt = paths[edgeId]?.pts?.[0];
      if (!pt) throw new Error(`missing start point for ${edgeId}`);
      const key = `${Math.round(pt.x)},${Math.round(pt.y)}`;
      if (!mainPorts.has(key)) throw new Error(`${edgeId} used auxiliary port ${key}`);
    });
    ['out1', 'out3'].forEach(edgeId => {
      const bends = countBendsForTest(paths[edgeId]?.pts || []);
      if (bends > 1) throw new Error(`${edgeId} should route as a simple L after fan-in, got ${bends} bends`);
    });
  });
}

{
  const nodes = [
    makeNode('data', 0, 0, 'process', 'M', { label: 'Data' }),
    makeNode('materials', 0, 0, 'process', 'M', { label: 'Materials' }),
    makeNode('control', 0, 0, 'process', 'M', { label: 'Process Control' }),
    makeNode('failure', 0, 0, 'process', 'M', { label: 'Multiplicative Failure' }),
    makeNode('inspection', 0, 0, 'rhombus', 'M', { label: 'Inspection' }),
  ];
  const edges = [
    makeEdge('e1', 'data', 'control'),
    makeEdge('e2', 'materials', 'control'),
    makeEdge('e3', 'control', 'data'),
    makeEdge('e4', 'control', 'materials'),
    makeEdge('e5', 'failure', 'data'),
    makeEdge('e6', 'failure', 'materials'),
    makeEdge('e7', 'failure', 'control'),
    makeEdge('e8', 'inspection', 'control'),
    makeEdge('e9', 'inspection', 'failure'),
  ];
  const laidOut = layoutNodesHeuristically(nodes, edges, { diagramType: 'flowchart' });
  const paths = calculateAllPaths(edges, laidOut, { diagramType: 'flowchart' });
  const byId = new Map(laidOut.map(node => [node.id, node]));
  test('Cyclic feedback flowcharts use a compact loop layout', () => {
    const failure = byId.get('failure');
    const inspection = byId.get('inspection');
    const core = ['data', 'materials', 'control'].map(id => byId.get(id));
    if (!failure || !inspection || core.some(node => !node)) throw new Error('missing laid-out nodes');
    if (Math.abs(failure.x) > 20 || failure.y <= 0) {
      throw new Error(`expected central feedback node below the cyclic core, got ${failure.x},${failure.y}`);
    }
    if (inspection.x >= failure.x) {
      throw new Error('intervention/source node should stay to the left of the central feedback node');
    }
    const distinctRows = new Set(core.map(node => node.y));
    const distinctCols = new Set(core.map(node => node.x));
    if (distinctRows.size < 2 || distinctCols.size < 2) {
      throw new Error('cyclic core should be arranged around the hub, not collapsed into one row or column');
    }
  });
  test('Cyclic feedback routing stays orthogonal and local', () => {
    const bounds = boundsForTest(laidOut);
    edges.forEach(edge => {
      const pts = paths[edge.id]?.pts || [];
      assertOrthogonalPath(pts, edge.id);
      pts.forEach(pt => {
        if (pt.x < bounds.minX - 140 || pt.x > bounds.maxX + 140 || pt.y < bounds.minY - 140 || pt.y > bounds.maxY + 140) {
          throw new Error(`${edge.id} escaped the local feedback layout at ${pt.x},${pt.y}`);
        }
      });
    });
  });
}

{
  const nodes = [
    makeNode('start', 0, 0, 'oval'),
    makeNode('gate', 280, 0, 'rhombus'),
    makeNode('branch', 560, 260, 'circle'),
    makeNode('topTask', 900, 0, 'process'),
    makeNode('lowTask', 900, 460, 'process'),
    makeNode('join', 1240, 120, 'process'),
    makeNode('final', 1720, 0, 'oval'),
    makeNode('recover', 1460, 460, 'process'),
  ];
  const edges = [
    makeEdge('a', 'start', 'gate'),
    makeEdge('b', 'gate', 'final', { label: 'reject' }),
    makeEdge('c', 'gate', 'branch', { label: 'accept' }),
    makeEdge('d', 'branch', 'topTask'),
    makeEdge('e', 'branch', 'lowTask'),
    makeEdge('f', 'topTask', 'join', { label: 'done' }),
    makeEdge('g', 'lowTask', 'join', { label: 'done' }),
    makeEdge('h', 'join', 'final', { label: 'ok' }),
    makeEdge('i', 'recover', 'final', { label: 'error' }),
  ];
  const paths = calculateAllPaths(edges, nodes, { diagramType: 'flowchart' });

  test('Flowchart segments do not run through bends on other edges', () => {
    assertNoSegmentThroughForeignBend(paths, edges);
  });
}

{
  const nodes = [
    makeNode('S', 0, 0, 'process'),
    makeNode('A', 260, -260, 'process'),
    makeNode('B', -260, -260, 'process'),
    makeNode('C', -420, 0, 'process'),
    makeNode('D', 0, -260, 'process'),
  ];
  const edges = [
    makeEdge('left', 'S', 'C'),
    makeEdge('right', 'S', 'A'),
    makeEdge('upLeft', 'S', 'B'),
    makeEdge('incoming', 'D', 'S'),
  ];
  const paths = calculateAllPaths(edges, nodes, { diagramType: 'flowchart' });

  test('Crossing links from the same node can swap ports as a pair', () => {
    if (paths.left?.isFallback || paths.upLeft?.isFallback) throw new Error('shared-node links should not fall back');
    if (edgePathsCross(paths.left, paths.upLeft)) {
      throw new Error(`expected shared-node port swap to remove crossing, got ${formatPts(paths.left?.pts)} vs ${formatPts(paths.upLeft?.pts)}`);
    }
  });

  test('Shared-node port swaps reselect the opposite endpoint port', () => {
    const bends = countBendsForTest(paths.left?.pts || []);
    if (bends > 2) {
      throw new Error(`expected swapped link to avoid an extra opposite-port bend, got ${bends}: ${formatPts(paths.left?.pts)}`);
    }
  });
}

function boundsForTest(nodes) {
  const xs = nodes.map(node => node.x || 0);
  const ys = nodes.map(node => node.y || 0);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

function terminalSegmentLength(pts, role) {
  if (!Array.isArray(pts) || pts.length < 2) return 0;
  const a = role === 'start' ? pts[0] : pts[pts.length - 2];
  const b = role === 'start' ? pts[1] : pts[pts.length - 1];
  return Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
}

function segmentsOverlap(s1, s2) {
  const s1H = s1.a.y === s1.b.y;
  const s2H = s2.a.y === s2.b.y;
  if (s1H !== s2H) return false;
  if (s1H) {
    if (s1.a.y !== s2.a.y) return false;
    const a1 = Math.min(s1.a.x, s1.b.x);
    const a2 = Math.max(s1.a.x, s1.b.x);
    const b1 = Math.min(s2.a.x, s2.b.x);
    const b2 = Math.max(s2.a.x, s2.b.x);
    return Math.max(a1, b1) < Math.min(a2, b2);
  }
  if (s1.a.x !== s2.a.x) return false;
  const a1 = Math.min(s1.a.y, s1.b.y);
  const a2 = Math.max(s1.a.y, s1.b.y);
  const b1 = Math.min(s2.a.y, s2.b.y);
  const b2 = Math.max(s2.a.y, s2.b.y);
  return Math.max(a1, b1) < Math.min(a2, b2);
}

function assertSingleDecisionFanIn(paths, edges, nodes, expectedEntry) {
  const carriers = edges.filter(edge => paths[edge.id]?.fanInCarrier);
  if (carriers.length !== 1) {
    throw new Error(`expected exactly one fan-in carrier, got ${carriers.map(edge => edge.id).join(', ') || 'none'}`);
  }
  const carrierAnalysis = analyzeEdge(paths, carriers[0].id, nodes);
  expect(carrierAnalysis.entryPort, expectedEntry, 'carrier entry side');

  edges.forEach(edge => {
    const path = paths[edge.id];
    if (!path?.groupedFanIn) throw new Error(`${edge.id} was not grouped into decision fan-in`);
    if (!path.fanInCarrier && !path.suppressMarkerEnd) {
      throw new Error(`${edge.id} should not draw an arrowhead at the T-merge`);
    }
    assertOrthogonalPath(path.pts, edge.id);
  });
}

function assertOrthogonalPath(pts, edgeId) {
  for (let i = 1; i < (pts || []).length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const horizontal = Math.abs(a.y - b.y) < 0.01;
    const vertical = Math.abs(a.x - b.x) < 0.01;
    if (!horizontal && !vertical) {
      throw new Error(`${edgeId} has a diagonal segment ${a.x},${a.y} -> ${b.x},${b.y}`);
    }
  }
}

function assertNoSegmentCrossesForeignNode(pts, nodes, edgeId, ownIds = []) {
  const own = new Set(ownIds.map(String));
  nodes
    .filter(node => !own.has(String(node.id)))
    .forEach(node => {
      const dim = getNodeDim(node);
      const box = {
        left: (node.x || 0) - dim.width / 2,
        right: (node.x || 0) + dim.width / 2,
        top: (node.y || 0) - dim.height / 2,
        bottom: (node.y || 0) + dim.height / 2,
      };
      for (let i = 0; i < pts.length - 1; i++) {
        if (segmentCrossesBoxInterior(pts[i], pts[i + 1], box)) {
          throw new Error(`${edgeId} segment ${pts[i].x},${pts[i].y} -> ${pts[i + 1].x},${pts[i + 1].y} crosses node ${node.id}`);
        }
      }
    });
}

function segmentCrossesBoxInterior(a, b, box) {
  if (Math.abs(a.y - b.y) < 0.01) {
    const minX = Math.min(a.x, b.x);
    const maxX = Math.max(a.x, b.x);
    return a.y > box.top && a.y < box.bottom && Math.max(minX, box.left) < Math.min(maxX, box.right);
  }
  if (Math.abs(a.x - b.x) < 0.01) {
    const minY = Math.min(a.y, b.y);
    const maxY = Math.max(a.y, b.y);
    return a.x > box.left && a.x < box.right && Math.max(minY, box.top) < Math.min(maxY, box.bottom);
  }
  return false;
}

function assertNoBodySegmentTouchesNodeClearance(pts, nodes, edgeId, sourceId, targetId, clearance = 10) {
  nodes.forEach(node => {
    const dim = getNodeDim(node);
    const box = {
      left: (node.x || 0) - dim.width / 2 - clearance,
      right: (node.x || 0) + dim.width / 2 + clearance,
      top: (node.y || 0) - dim.height / 2 - clearance,
      bottom: (node.y || 0) + dim.height / 2 + clearance,
    };
    for (let i = 0; i < pts.length - 1; i++) {
      const isSourceStub = String(node.id) === String(sourceId) && i === 0;
      const isTargetStub = String(node.id) === String(targetId) && i === pts.length - 2;
      if (isSourceStub || isTargetStub) continue;
      if (segmentTouchesBox(pts[i], pts[i + 1], box)) {
        throw new Error(`${edgeId} body segment ${pts[i].x},${pts[i].y} -> ${pts[i + 1].x},${pts[i + 1].y} touches clearance of node ${node.id}`);
      }
    }
  });
}

function segmentTouchesBox(a, b, box) {
  if (Math.abs(a.y - b.y) < 0.01) {
    const minX = Math.min(a.x, b.x);
    const maxX = Math.max(a.x, b.x);
    return a.y >= box.top - 0.01 && a.y <= box.bottom + 0.01 && Math.max(minX, box.left) <= Math.min(maxX, box.right);
  }
  if (Math.abs(a.x - b.x) < 0.01) {
    const minY = Math.min(a.y, b.y);
    const maxY = Math.max(a.y, b.y);
    return a.x >= box.left - 0.01 && a.x <= box.right + 0.01 && Math.max(minY, box.top) <= Math.min(maxY, box.bottom);
  }
  return true;
}

function assertNoSegmentThroughForeignBend(paths, edges) {
  const bends = [];
  edges.forEach(edge => {
    const pts = paths[edge.id]?.pts || [];
    for (let i = 1; i < pts.length - 1; i++) {
      bends.push({ edgeId: edge.id, point: pts[i] });
    }
  });

  edges.forEach(edge => {
    const pts = paths[edge.id]?.pts || [];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      bends
        .filter(bend => bend.edgeId !== edge.id)
        .forEach(bend => {
          if (pointOnSegmentInterior(bend.point, a, b)) {
            throw new Error(`${edge.id} runs through bend on ${bend.edgeId}`);
          }
        });
    }
  });
}

function edgePathsCross(pathA, pathB) {
  const ptsA = pathA?.pts || [];
  const ptsB = pathB?.pts || [];
  for (let i = 0; i < ptsA.length - 1; i++) {
    for (let j = 0; j < ptsB.length - 1; j++) {
      if (segmentsCrossForTest(ptsA[i], ptsA[i + 1], ptsB[j], ptsB[j + 1])) return true;
    }
  }
  return false;
}

function countBendsForTest(pts) {
  let bends = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const prevH = Math.abs(pts[i].y - pts[i - 1].y) < 0.01;
    const nextH = Math.abs(pts[i + 1].y - pts[i].y) < 0.01;
    if (prevH !== nextH) bends++;
  }
  return bends;
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

function pointOnSegmentInterior(point, a, b) {
  const margin = 0.5;
  if (Math.abs(a.y - b.y) < 0.01 && Math.abs(point.y - a.y) < 0.01) {
    const minX = Math.min(a.x, b.x);
    const maxX = Math.max(a.x, b.x);
    return point.x > minX + margin && point.x < maxX - margin;
  }
  if (Math.abs(a.x - b.x) < 0.01 && Math.abs(point.x - a.x) < 0.01) {
    const minY = Math.min(a.y, b.y);
    const maxY = Math.max(a.y, b.y);
    return point.y > minY + margin && point.y < maxY - margin;
  }
  return false;
}

function formatPts(pts = []) {
  return pts.map(pt => `${pt.x},${pt.y}`).join(' -> ');
}

summary('engine.flowchart.test.mjs');
