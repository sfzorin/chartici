import assert from 'node:assert';
import { getDiagramRules } from '../utils/diagramRules.js';

console.log('\n🧭 Engine layout and routing rules');

const flowchart = getDiagramRules('flowchart');
assert.equal(flowchart.layout.MIN_GAP_X, 60);
assert.equal(flowchart.layout.MIN_GAP_Y, 60);
assert.equal(flowchart.layout.RANKER, 'network-simplex');
assert.equal(flowchart.routing.CROSSING_PENALTY, 1500);

const erd = getDiagramRules('erd');
assert.equal(erd.layout.MIN_GAP_X, 80);
assert.equal(erd.layout.MIN_GAP_Y, 80);
assert.equal(erd.layout.RANKER, 'network-simplex');

const sequence = getDiagramRules('sequence');
assert.equal(sequence.layout.MIN_GAP_X, 120);
assert.equal(sequence.layout.MIN_GAP_Y, 80);
assert.equal(sequence.layout.RANKER, 'network-simplex');

const timeline = getDiagramRules('timeline');
assert.equal(timeline.layout.MIN_GAP_X, 120);
assert.equal(timeline.layout.MIN_GAP_Y, 80);
assert.equal(timeline.layout.RANKER, 'network-simplex');

const tree = getDiagramRules('tree');
assert.equal(tree.layout.MIN_GAP_X, 60);
assert.equal(tree.layout.MIN_GAP_Y, 60);
assert.equal(tree.routing.T_FORK_EXACT_DISCOUNT, 120);
assert.equal(tree.routing.T_FORK_TRUNK_DISCOUNT, 90);
assert.equal(tree.routing.BUS_STEP_COST, 0.3);

const orgChart = getDiagramRules('org_chart');
assert.deepEqual(orgChart, tree);

const piechart = getDiagramRules('piechart');
assert.equal(piechart.layout.RANKER, 'network-simplex');

console.log('  ✅ layout/routing rules are owned by engines');
console.log('  ✅ org_chart still follows tree rules');
