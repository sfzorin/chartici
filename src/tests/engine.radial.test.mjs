import { calculateAllPaths } from '../utils/engine/index.js';
import { test, expect, summary, makeNode, makeEdge } from './testRunner.mjs';

console.log('\n☀️ Radial Engine: Straight clipped lines');

const nodes = [
  makeNode('center', 0, 0, 'circle', 'L'),
  makeNode('n1', 300, 0),
  makeNode('n2', -300, 0),
  makeNode('n3', 0, 300),
  makeNode('n4', 0, -300),
];
const edges = [
  makeEdge('e1', 'center', 'n1'),
  makeEdge('e2', 'center', 'n2'),
  makeEdge('e3', 'center', 'n3'),
  makeEdge('e4', 'center', 'n4'),
];
const paths = calculateAllPaths(edges, nodes, { diagramType: 'radial' });

test('Returns proper direct paths', () => {
    for (const eid of ['e1','e2','e3','e4']) {
        const p = paths[eid];
        if (!p || !p.pts || p.pts.length < 2) throw new Error('no path');
        expect(p.pts.length, 2, 'points');
        if (p.pathD.includes('NaN')) throw new Error('NaN in pathD');
    }
});

test('Paths are clipped (do not start at exact center of circle)', () => {
    for (const eid of ['e1','e2','e3','e4']) {
        const p = paths[eid];
        if (p.pts[0].x === 0 && p.pts[0].y === 0) throw new Error('starts at exact center');
    }
});

summary('engine.radial.test.mjs');
