import assert from 'node:assert';
import { ARROW_MARKER } from '../diagram/edges.js';
import { getEngine } from '../engines/index.js';
import { getDiagramRules } from '../utils/diagramRules.js';
import { getRoutingPolicy } from '../utils/engine/routingPolicy.js';

console.log('\n🧭 Engine layout and routing rules');

const flowchart = getDiagramRules('flowchart');
assert.equal(flowchart.layout.MIN_GAP_X, 60);
assert.equal(flowchart.layout.MIN_GAP_Y, 60);
assert.equal(flowchart.layout.RANKER, 'network-simplex');
assert.equal(flowchart.routing.PADDING, 10);
assert.equal(flowchart.routing.CROSSING_PENALTY, 1500);

const erd = getDiagramRules('erd');
assert.equal(erd.layout.MIN_GAP_X, 80);
assert.equal(erd.layout.MIN_GAP_Y, 80);
assert.equal(erd.layout.RANKER, 'network-simplex');

const sequence = getDiagramRules('sequence');
assert.equal(getEngine('sequence').layout.algorithm, 'sequence');
assert.equal(sequence.layout.MIN_GAP_X, 120);
assert.equal(sequence.layout.MIN_GAP_Y, 80);
assert.equal(sequence.layout.RANKER, 'network-simplex');
assert.equal(sequence.layout.SEQUENCE_MIN_STEP_GAP, 60);
assert.equal(sequence.layout.SEQUENCE_CROSS_LANE_GAP, 60);

const timeline = getDiagramRules('timeline');
assert.equal(timeline.layout.MIN_GAP_X, 120);
assert.equal(timeline.layout.MIN_GAP_Y, 80);
assert.equal(timeline.layout.RANKER, 'network-simplex');
assert.deepEqual(getEngine('timeline').schema.allowedArrowTypes, ['none']);
assert.equal(getEngine('timeline').schema.engineManifest.suppressEdgeMarkers, true);

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
assert.equal(getEngine('piechart').paper.padFactor, 0.94);
assert.equal(getEngine('piechart').paper.titleGapScale, 0.55);

const flowchartRouting = getRoutingPolicy('flowchart');
assert.equal(flowchartRouting.portStrategy, 'dynamic');
assert.equal(flowchartRouting.allowPortReuse, false);
assert.equal(flowchartRouting.allowCornerKisses, false);
assert.equal(flowchartRouting.allowSiblingCrossings, false);

const erdRouting = getRoutingPolicy('erd');
assert.equal(erdRouting.cardinalOnly, true);
assert.equal(erdRouting.allowPortReuse, false);

const treeRouting = getRoutingPolicy('tree');
assert.equal(treeRouting.portStrategy, 'topdown');
assert.equal(treeRouting.allowPortReuse, true);
assert.equal(treeRouting.allowCornerKisses, true);
assert.equal(treeRouting.allowSiblingCrossings, true);
assert.equal(treeRouting.enableBusRouting, true);

const arrowTipX = 10.5;
assert.equal(ARROW_MARKER.refX, arrowTipX, 'standard arrow tip must sit on the endpoint');
assert.ok(ARROW_MARKER.width > ARROW_MARKER.refX, 'standard arrow marker viewBox must contain the endpoint tip');

console.log('  ✅ layout/routing rules are owned by engines');
console.log('  ✅ org_chart still follows tree rules');
console.log('  ✅ routing policies are owned by engines');
console.log('  ✅ standard arrow marker keeps its tip on the endpoint');
