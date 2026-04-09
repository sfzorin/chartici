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

summary('engine.timeline.test.mjs');
