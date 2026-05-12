import {
  MATRIX_GROUP_PAD,
  estimateMatrixGroupLabelTabWidth,
  layoutMatrix,
  wrapMatrixGroupLabel,
} from '../utils/layouts/layoutMatrix.js';
import { layoutNodesHeuristically } from '../utils/nodeLayouter.js';
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

{
  const grouped = [
    makeNode('A1', 0, 0, 'process', 'M', { groupId: 'large' }),
    makeNode('A2', 0, 0, 'process', 'M', { groupId: 'large' }),
    makeNode('A3', 0, 0, 'process', 'M', { groupId: 'large' }),
    makeNode('A4', 0, 0, 'process', 'M', { groupId: 'large' }),
    makeNode('B1', 0, 0, 'process', 'M', { groupId: 'small' }),
    makeNode('C1', 0, 0, 'process', 'M', { groupId: 'medium' }),
    makeNode('C2', 0, 0, 'process', 'M', { groupId: 'medium' }),
  ];
  const groups = [
    { id: 'large', label: 'Large Group' },
    { id: 'small', label: 'Small Group' },
    { id: 'medium', label: 'Medium Group' },
  ];
  const out = layoutMatrix(grouped, [], {
    PADDING: 40,
    MIN_GAP_X: 40,
    MIN_GAP_Y: 40,
    groups,
  });
  const byGroup = new Map(groups.map(group => [group.id, out.filter(node => node.groupId === group.id)]));
  const equalBoxes = normalizeMatrixBoxes(groups.map(group => renderedMatrixGroupBox(byGroup.get(group.id), group.label)));

  test('Matrix groups render as equal-sized zones based on the largest group', () => {
    const widths = equalBoxes.map(box => box.right - box.left);
    const heights = equalBoxes.map(box => box.bottom - box.top);
    if (new Set(widths.map(Math.round)).size !== 1) throw new Error(`expected equal group widths, got ${widths.join(', ')}`);
    if (new Set(heights.map(Math.round)).size !== 1) throw new Error(`expected equal group heights, got ${heights.join(', ')}`);
  });

  test('Matrix nodes use one shared runtime size within a diagram', () => {
    const sizes = out.map(node => `${node.w}x${node.h}`);
    if (new Set(sizes).size !== 1) throw new Error(`expected shared matrix node size, got ${sizes.join(', ')}`);
  });
}

{
  const sparse = layoutMatrix([
    makeNode('A', 0, 0, 'process', 'M', { groupId: 'g1' }),
    makeNode('B', 0, 0, 'process', 'M', { groupId: 'g2' }),
  ], [], { PADDING: 40, MIN_GAP_X: 40, MIN_GAP_Y: 40 });
  const dense = layoutMatrix([
    ...Array.from({ length: 9 }, (_, index) => makeNode(`D${index}`, 0, 0, 'process', 'M', { groupId: 'dense' })),
    makeNode('E', 0, 0, 'process', 'M', { groupId: 'other' }),
  ], [], { PADDING: 40, MIN_GAP_X: 40, MIN_GAP_Y: 40 });

  test('Matrix node size scales down as the densest group grows', () => {
    if (!(dense[0].w < sparse[0].w && dense[0].h < sparse[0].h)) {
      throw new Error(`expected dense nodes smaller than sparse nodes, got dense ${dense[0].w}x${dense[0].h}, sparse ${sparse[0].w}x${sparse[0].h}`);
    }
  });
}

{
  const nodes = [
    ...Array.from({ length: 5 }, (_, index) => makeNode(`A${index}`, 0, 0, 'process', 'M', { groupId: 'g1' })),
    makeNode('B1', 0, 0, 'process', 'M', { groupId: 'g2' }),
  ];
  const out = layoutNodesHeuristically(nodes, [], {
    diagramType: 'matrix',
    groups: [
      { id: 'g1', label: 'Dense Group' },
      { id: 'g2', label: 'Sparse Group' },
    ],
  });
  const dense = out.filter(node => node.groupId === 'g1');

  test('Matrix runtime node sizes survive the generic layouter', () => {
    if (dense.some(node => !node.w || !node.h)) {
      throw new Error(`matrix nodes lost runtime dimensions: ${dense.map(node => `${node.id}:${node.w}x${node.h}`).join(', ')}`);
    }
  });

  test('Matrix rendered node boxes keep visible gutters after generic layout', () => {
    const rows = new Map();
    dense.forEach(node => {
      const key = String(node.y);
      if (!rows.has(key)) rows.set(key, []);
      rows.get(key).push(node);
    });
    for (const row of rows.values()) {
      const sorted = row.sort((a, b) => a.x - b.x);
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1];
        const curr = sorted[i];
        const gap = (curr.x - curr.w / 2) - (prev.x + prev.w / 2);
        if (gap < 20) throw new Error(`expected matrix gutter >=20px, got ${gap}px between ${prev.id} and ${curr.id}`);
      }
    }
  });
}

{
  const groups = [
    { id: 'exw', label: 'EXW + Customer Risk' },
    { id: 'dap', label: 'DAP + Factory Risk' },
    { id: 'docs', label: 'Docs Mismatch + Hold' },
    { id: 'otif', label: 'OTIF Miss + Claim Clock' },
  ];
  const nodes = groups.map(group => makeNode(`${group.id}_node`, 0, 0, 'process', 'M', { groupId: group.id }));
  const out = layoutNodesHeuristically(nodes, [], { diagramType: 'matrix', groups });
  const byGroup = new Map(groups.map(group => [group.id, out.filter(node => node.groupId === group.id)]));
  const boxes = normalizeMatrixBoxes(groups.map(group => renderedMatrixGroupBox(byGroup.get(group.id), group.label)));

  test('Matrix single-node groups reserve enough width for long heading tabs', () => {
    boxes.forEach((box, index) => {
      const desiredLabelW = estimateMatrixGroupLabelTabWidth(groups[index].label);
      const available = box.right - box.left - 32;
      if (available < desiredLabelW) {
        throw new Error(`${groups[index].id} heading wants ${desiredLabelW}px, available ${available}px`);
      }
    });
  });

  test('Matrix equalized group boxes keep horizontal gutters after label expansion', () => {
    const top = boxes.slice(0, 2).sort((a, b) => a.left - b.left);
    const bottom = boxes.slice(2, 4).sort((a, b) => a.left - b.left);
    [top, bottom].forEach((row, rowIndex) => {
      const gap = row[1].left - row[0].right;
      if (gap < 80) throw new Error(`matrix row ${rowIndex} group boxes overlap or crowd: gap=${gap}`);
    });
  });
}

function renderedMatrixGroupBox(nodes, label) {
  const dims = nodes.map(node => ({ x: node.x, y: node.y, w: getNodeW(node), h: getNodeH(node) }));
  const labelLines = wrapMatrixLabel(label);
  const labelTopExtra = labelLines.length > 1 ? 26 : 10;
  const groupPad = MATRIX_GROUP_PAD;
  const box = {
    left: Math.min(...dims.map(d => d.x - d.w / 2)) - groupPad,
    right: Math.max(...dims.map(d => d.x + d.w / 2)) + groupPad,
    top: Math.min(...dims.map(d => d.y - d.h / 2)) - groupPad - labelTopExtra,
    bottom: Math.max(...dims.map(d => d.y + d.h / 2)) + groupPad,
  };
  const minWidth = estimateMatrixGroupLabelTabWidth(label) + 32;
  const width = box.right - box.left;
  if (width >= minWidth) return box;
  const cx = (box.left + box.right) / 2;
  return { ...box, left: cx - minWidth / 2, right: cx + minWidth / 2 };
}

function normalizeMatrixBoxes(boxes) {
  const maxW = Math.max(...boxes.map(box => box.right - box.left));
  const maxH = Math.max(...boxes.map(box => box.bottom - box.top));
  return boxes.map(box => {
    const cx = (box.left + box.right) / 2;
    const cy = (box.top + box.bottom) / 2;
    return {
      left: cx - maxW / 2,
      right: cx + maxW / 2,
      top: cy - maxH / 2,
      bottom: cy + maxH / 2,
    };
  });
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
  return wrapMatrixGroupLabel(label);
}

function getNodeW(node) {
  return node.w || node.width || 160;
}

function getNodeH(node) {
  return node.h || node.height || 80;
}

summary('engine.matrix.test.mjs');
