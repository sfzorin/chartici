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

{
  const grouped = [
    makeNode('A', 0, 0, 'process', 'M', { groupId: 'g1' }),
    makeNode('B', 0, 0, 'process', 'M', { groupId: 'g1' }),
    makeNode('C', 0, 0, 'process', 'M', { groupId: 'g2' }),
    makeNode('D', 0, 0, 'process', 'M', { groupId: 'g2' }),
  ];
  const out = layoutMatrix(grouped, [], { PADDING: 40, MIN_GAP_X: 40, MIN_GAP_Y: 40 });
  const leftGroupRight = Math.max(...out.filter(n => n.groupId === 'g1').map(n => n.x + 60));
  const rightGroupLeft = Math.min(...out.filter(n => n.groupId === 'g2').map(n => n.x - 60));

  test('Keeps matrix groups visibly separated', () => {
    const gap = rightGroupLeft - leftGroupRight;
    if (gap < 90) throw new Error(`expected group gap >=90px, got ${gap}px`);
  });
}

{
  const grouped = [
    makeNode('A', 0, 0, 'process', 'M', { groupId: 'long' }),
    makeNode('B', 0, 0, 'process', 'M', { groupId: 'short' }),
  ];
  const out = layoutMatrix(grouped, [], {
    PADDING: 40,
    MIN_GAP_X: 40,
    MIN_GAP_Y: 40,
    groups: [
      { id: 'long', label: 'High Risk Dependencies' },
      { id: 'short', label: 'Stable' },
    ],
  });
  const long = out.find(n => n.groupId === 'long');
  const short = out.find(n => n.groupId === 'short');

  test('Long matrix group headings expand zone width', () => {
    const gap = short.x - long.x;
    if (gap < 300) throw new Error(`expected long heading to widen matrix zone, got center gap ${gap}px`);
  });
}

{
  const grouped = [
    makeNode('A', 0, 0, 'process', 'M', { groupId: 'wide' }),
    makeNode('B', 0, 0, 'process', 'M', { groupId: 'wide' }),
    makeNode('C', 0, 0, 'process', 'M', { groupId: 'narrow' }),
    makeNode('D', 0, 0, 'process', 'M', { groupId: 'right' }),
  ];
  const out = layoutMatrix(grouped, [], {
    PADDING: 40,
    MIN_GAP_X: 40,
    MIN_GAP_Y: 40,
    groups: [
      { id: 'wide', label: 'Long Comparison Zone' },
      { id: 'narrow', label: 'Tiny' },
      { id: 'right', label: 'Right' },
    ],
  });
  const wide = out.filter(n => n.groupId === 'wide');
  const lowerSameColumn = out.find(n => n.groupId === 'right');
  const wideCenter = (Math.min(...wide.map(n => n.x - 80)) + Math.max(...wide.map(n => n.x + 80))) / 2;

  test('Aligns matrix groups by column center', () => {
    if (Math.abs(wideCenter - lowerSameColumn.x) > 1) {
      throw new Error(`expected column centers to align, got ${wideCenter}px and ${lowerSameColumn.x}px`);
    }
  });
}

summary('engine.matrix.test.mjs');
