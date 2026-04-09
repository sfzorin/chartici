import { layoutMatrix } from '../utils/layouts/layoutMatrix.js';
import { test, expect, summary, makeNode } from './testRunner.mjs';

console.log('\n🔲 Matrix Engine: Grid Array Logic');

const nodes = [
  makeNode('A', 0, 0),
  makeNode('B', 0, 0),
  makeNode('C', 0, 0),
  makeNode('D', 0, 0)
];

const laidOut = layoutMatrix(nodes, [], { PADDING: 40, MIN_GAP_X: 40, MIN_GAP_Y: 40 });

const a = laidOut.find(n => n.id === 'A');
const b = laidOut.find(n => n.id === 'B');
const c = laidOut.find(n => n.id === 'C');
const d = laidOut.find(n => n.id === 'D');

test('Places elements in a grid', () => {
    // A grid of 4 should be 2x2
    expect(a.y, b.y, 'A and B on same row');
    expect(c.y, d.y, 'C and D on same row');
    
    expect(a.x, c.x, 'A and C on same column');
    expect(b.x, d.x, 'B and D on same column');
    
    if (a.y === c.y) throw new Error('A and C should be on different rows');
});

test('Snaps to 20px grid perfectly', () => {
   laidOut.forEach(n => {
       if (n.x % 20 !== 0) throw new Error(`${n.id} x is not snapped to 20`);
       if (n.y % 20 !== 0) throw new Error(`${n.id} y is not snapped to 20`);
   });
});

summary('engine.matrix.test.mjs');
