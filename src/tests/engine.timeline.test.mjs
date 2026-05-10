import { layoutTimeline } from '../utils/layouts/layoutTimeline.js';
import { test, expect, summary, makeNode, makeEdge } from './testRunner.mjs';

console.log('\n⏳ Timeline Engine: Chevron Alignment Logic');

const nodes = [
  makeNode('S1', 0, 0, 'chevron'),
  makeNode('S2', 0, 0, 'chevron'),
  makeNode('A', 0, 0, 'process'),
  makeNode('B', 0, 0, 'process')
];

const edges = [
  makeEdge('e1', 'S1', 'S2', { lineStyle: 'none' }),
  makeEdge('e2', 'A', 'S1'), // Event attached to S1
  makeEdge('e3', 'S2', 'B')  // Event attached to S2
];

const laidOut = layoutTimeline(nodes, edges, { PADDING: 40 }, true);

const s1 = laidOut.find(n => n.id === 'S1');
const s2 = laidOut.find(n => n.id === 'S2');
const a = laidOut.find(n => n.id === 'A');
const b = laidOut.find(n => n.id === 'B');

test('Chevrons are aligned horizontally', () => {
    expect(s1.y, s2.y, 'same Y coordinate');
    if (s2.x <= s1.x) throw new Error('S2 should be to the right of S1');
});

test('Events are placed above or below the spine', () => {
    if (a.y === s1.y) throw new Error('A should not be directly on spine');
    if (b.y === s2.y) throw new Error('B should not be directly on spine');
});

test('Nodes are correctly flagged as spine', () => {
    expect(s1.isTimelineSpine, true, 'S1 is spine');
    expect(!!a.isTimelineSpine, false, 'A is not spine');
});

test('Events align to their referenced chevrons', () => {
    expect(a.x, s1.x, 'A aligns to S1');
    expect(b.x, s2.x, 'B aligns to S2');
});

const generatedTimelineNodes = [
  makeNode('m4', 0, 0, 'chevron', 'L', { label: '2010s: Rovers' }),
  makeNode('d1', 0, 0, 'process', 'M', { spineId: 'm4', label: 'Curiosity Mars' }),
  makeNode('m2', 0, 0, 'chevron', 'L', { label: '1960s: Moon' }),
  makeNode('a1', 0, 0, 'process', 'L', { spineId: 'm2', label: 'Apollo 11 Landing' }),
  makeNode('m1', 0, 0, 'chevron', 'L', { label: '1950s: Dawn' }),
  makeNode('p1', 0, 0, 'process', 'M', { spineId: 'm1', label: 'Sputnik 1' }),
  makeNode('m5', 0, 0, 'chevron', 'L', { label: '2020s: Private' }),
  makeNode('n1', 0, 0, 'process', 'L', { spineId: 'm5', label: 'Artemis I' }),
  makeNode('m3', 0, 0, 'chevron', 'L', { label: '1990s: Orbiters' }),
  makeNode('s1', 0, 0, 'process', 'L', { spineId: 'm3', label: 'ISS Assembly Begins' })
];

const generatedTimelineEdges = generatedTimelineNodes
  .filter(n => n.spineId)
  .map(n => makeEdge(`edge_${n.id}`, n.spineId, n.id, { lineStyle: 'dashed', connectionType: 'none' }));

const generatedLaidOut = layoutTimeline(generatedTimelineNodes, generatedTimelineEdges, { PADDING: 40 }, true);

test('Generated timelines keep chevrons on a horizontal chronological spine', () => {
  const ordered = ['m1', 'm2', 'm3', 'm4', 'm5'].map(id => generatedLaidOut.find(n => n.id === id));
  ordered.slice(1).forEach((node, index) => {
    expect(node.y, ordered[0].y, `${node.id} shares spine Y`);
    if (node.x <= ordered[index].x) throw new Error(`${node.id} should be to the right of ${ordered[index].id}`);
  });
});

test('Generated timeline events stay attached to their own spine phase', () => {
  const dawn = generatedLaidOut.find(n => n.id === 'm1');
  const sputnik = generatedLaidOut.find(n => n.id === 'p1');
  const privateEra = generatedLaidOut.find(n => n.id === 'm5');
  const artemis = generatedLaidOut.find(n => n.id === 'n1');
  expect(sputnik.x, dawn.x, 'Sputnik aligns to 1950s phase');
  expect(artemis.x, privateEra.x, 'Artemis aligns to 2020s phase');
  if (sputnik.y === dawn.y || artemis.y === privateEra.y) {
    throw new Error('events should sit above or below the spine, not on it');
  }
});

summary('engine.timeline.test.mjs');
