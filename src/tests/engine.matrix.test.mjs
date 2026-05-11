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

{
  const grouped = [
    makeNode('A', 0, 0, 'process', 'M', { groupId: 'topLeft' }),
    makeNode('B', 0, 0, 'process', 'M', { groupId: 'topRight' }),
    makeNode('C', 0, 0, 'process', 'M', { groupId: 'bottomLeft' }),
    makeNode('D', 0, 0, 'process', 'M', { groupId: 'bottomRight' }),
  ];
  const groups = [
    { id: 'topLeft', label: 'Low Strength / Low Heat' },
    { id: 'topRight', label: 'High Strength / Low Heat' },
    { id: 'bottomLeft', label: 'Low Strength / High Heat' },
    { id: 'bottomRight', label: 'High Strength / High Heat' },
  ];
  const out = layoutMatrix(grouped, [], {
    PADDING: 40,
    MIN_GAP_X: 40,
    MIN_GAP_Y: 40,
    groups,
  });
  const byGroup = new Map(groups.map(group => [group.id, out.filter(node => node.groupId === group.id)]));

  test('Reserves vertical room for matrix group labels between rows', () => {
    const topBoxBottom = Math.max(
      renderedMatrixGroupBox(byGroup.get('topLeft'), groups[0].label).bottom,
      renderedMatrixGroupBox(byGroup.get('topRight'), groups[1].label).bottom,
    );
    const lowerLabelTop = Math.min(
      renderedMatrixGroupLabelBox(byGroup.get('bottomLeft'), groups[2].label).top,
      renderedMatrixGroupLabelBox(byGroup.get('bottomRight'), groups[3].label).top,
    );
    if (lowerLabelTop - topBoxBottom < 10) {
      throw new Error(`expected lower label to clear upper boxes by >=10px, got ${lowerLabelTop - topBoxBottom}px`);
    }
  });
}

function renderedMatrixGroupBox(nodes, label) {
  const dims = nodes.map(node => ({ x: node.x, y: node.y, w: getNodeW(node), h: getNodeH(node) }));
  const labelLines = wrapMatrixLabel(label);
  const labelTopExtra = labelLines.length > 1 ? 26 : 10;
  const groupPad = 30;
  return {
    top: Math.min(...dims.map(d => d.y - d.h / 2)) - groupPad - labelTopExtra,
    bottom: Math.max(...dims.map(d => d.y + d.h / 2)) + groupPad,
  };
}

function renderedMatrixGroupLabelBox(nodes, label) {
  const box = renderedMatrixGroupBox(nodes, label);
  const labelH = wrapMatrixLabel(label).length === 1 ? 30 : 52;
  return {
    top: box.top - labelH / 2,
    bottom: box.top + labelH / 2,
  };
}

function wrapMatrixLabel(label) {
  const words = String(label || '').replace(/_/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];
  const lines = [];
  let current = '';
  words.forEach(word => {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= 22 || !current) {
      current = next;
    } else if (lines.length < 1) {
      lines.push(current);
      current = word;
    }
  });
  if (current && lines.length < 2) lines.push(current);
  return lines.slice(0, 2);
}

function getNodeW(node) {
  return node.w || node.width || 160;
}

function getNodeH(node) {
  return node.h || node.height || 80;
}

summary('engine.matrix.test.mjs');
