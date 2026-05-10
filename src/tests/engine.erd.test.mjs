import { calculateAllPaths } from '../utils/engine/index.js';
import { getNodeDim } from '../diagram/nodes.jsx';
import { test, summary, makeNode, makeEdge, analyzeEdge } from './testRunner.mjs';

console.log('\n🧩 ERD Engine: Obstacle-aware deterministic routing');

{
  const nodes = [
    makeNode('User', -220, 0, 'process', 'M'),
    makeNode('Badge', 0, 0, 'process', 'M'),
    makeNode('Attempt', 220, 0, 'process', 'M'),
  ];
  const edges = [makeEdge('earns', 'User', 'Attempt', { label: 'earns', connectionType: '1:N' })];
  const paths = calculateAllPaths(edges, nodes, { diagramType: 'erd' });
  const route = analyzeEdge(paths, 'earns', nodes);

  test('ERD routes do not cross or touch foreign protected zones', () => {
    assertNoSegmentTouchesForeignProtectedZone(route.pts, nodes, 'earns', ['User', 'Attempt'], 20);
  });

  test('ERD obstacle detours use the shortest simple orthogonal shape', () => {
    if (route.bends > 2) throw new Error(`expected <=2 bends around middle entity, got ${route.bends}`);
  });
}

function assertNoSegmentTouchesForeignProtectedZone(pts, nodes, edgeId, ownIds = [], padding = 20) {
  const own = new Set(ownIds.map(String));
  nodes
    .filter(node => !own.has(String(node.id)))
    .forEach(node => {
      const dim = getNodeDim(node);
      const box = {
        left: (node.x || 0) - dim.width / 2 - padding,
        right: (node.x || 0) + dim.width / 2 + padding,
        top: (node.y || 0) - dim.height / 2 - padding,
        bottom: (node.y || 0) + dim.height / 2 + padding,
      };
      for (let i = 0; i < pts.length - 1; i++) {
        if (segmentTouchesBox(pts[i], pts[i + 1], box)) {
          throw new Error(`${edgeId} segment ${pts[i].x},${pts[i].y} -> ${pts[i + 1].x},${pts[i + 1].y} touches protected zone of node ${node.id}`);
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

summary('engine.erd.test.mjs');
