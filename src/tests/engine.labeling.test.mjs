import assert from 'node:assert';
import {
  getEdgeLabelPolicy,
  getEdgeLabelStyle,
  getFittedManualEdgeLabel,
  getManualEdgeLabelPlacement,
  getTextPathStartOffset,
  truncateLabelToWidth,
  usesManualEdgeLabels,
} from '../diagram/edgeLabelPlacement.js';

const labelStyle = {
  fontSize: 12,
  charWidth: 7.4,
};

const horizontalPath = [
  { x: 0, y: 0 },
  { x: 300, y: 0 },
];

console.log('\n🏷️ Engine label policies');

const flowchartPolicy = getEdgeLabelPolicy('flowchart');
assert.equal(flowchartPolicy.strategy, 'source-near');
assert.equal(getTextPathStartOffset(flowchartPolicy), '14%');
assert.equal(usesManualEdgeLabels(flowchartPolicy), true);

const flowchartPlacement = getManualEdgeLabelPlacement({
  labelPolicy: flowchartPolicy,
  displayLabel: 'Submit Creds',
  pts: horizontalPath,
  labelStyle,
});
assert.ok(flowchartPlacement, 'flowchart labels should use manual source-biased placement');
assert.equal(flowchartPlacement.x, 20, 'flowchart labels should start at the source-side 20px gap');
assert.equal(flowchartPlacement.textAnchor, 'start', 'rightward flowchart labels should start at the gap');

const roomyFlowchartPlacement = getManualEdgeLabelPlacement({
  labelPolicy: flowchartPolicy,
  displayLabel: 'Go',
  pts: [{ x: 0, y: 0 }, { x: 200, y: 0 }],
  labelStyle,
});
assert.equal(roomyFlowchartPlacement.x, 20, 'roomy flowchart labels should start at a 20px source gap');

const tightFlowchartPlacement = getManualEdgeLabelPlacement({
  labelPolicy: flowchartPolicy,
  displayLabel: 'Go',
  pts: [{ x: 0, y: 0 }, { x: 46, y: 0 }],
  labelStyle,
});
assert.equal(tightFlowchartPlacement.x, 5, 'tight flowchart labels should start at a 5px source gap');

const leftwardFlowchartPlacement = getManualEdgeLabelPlacement({
  labelPolicy: flowchartPolicy,
  displayLabel: 'Go',
  pts: [{ x: 100, y: 0 }, { x: 0, y: 0 }],
  labelStyle,
});
assert.equal(leftwardFlowchartPlacement.x, 80, 'leftward flowchart labels should keep the near edge at the gap');
assert.equal(leftwardFlowchartPlacement.textAnchor, 'end', 'leftward flowchart labels should end at the source-side gap');

assert.equal(
  getFittedManualEdgeLabel({
    labelPolicy: flowchartPolicy,
    displayLabel: 'Very Long Label',
    pts: [{ x: 0, y: 0 }, { x: 70, y: 0 }],
    labelStyle,
  }),
  'Ver...',
  'flowchart labels should truncate at the end when even the 5px gap is tight'
);

const sequencePolicy = getEdgeLabelPolicy('sequence');
assert.equal(sequencePolicy.strategy, 'message-center');
assert.equal(getTextPathStartOffset(sequencePolicy), '50%');
assert.equal(usesManualEdgeLabels(sequencePolicy), false);
assert.equal(getEdgeLabelStyle(sequencePolicy).fontSize, 12);
assert.equal(
  getManualEdgeLabelPlacement({
    labelPolicy: sequencePolicy,
    displayLabel: 'Token Received',
    pts: horizontalPath,
    labelStyle,
  }),
  null,
  'sequence labels should stay on the message path instead of inheriting flowchart placement'
);

assert.equal(
  truncateLabelToWidth('Token Received', 34, labelStyle.charWidth),
  'T...',
  'path labels should truncate at the end instead of disappearing'
);

const erdPolicy = getEdgeLabelPolicy('erd');
assert.equal(erdPolicy.strategy, 'relationship-center');
assert.equal(getTextPathStartOffset(erdPolicy), '50%');
assert.equal(usesManualEdgeLabels(erdPolicy), true);
assert.equal(getEdgeLabelStyle(erdPolicy).fontSize, 11);

const erdPlacement = getManualEdgeLabelPlacement({
  labelPolicy: erdPolicy,
  displayLabel: 'contains',
  pts: horizontalPath,
  labelStyle,
});
assert.ok(erdPlacement, 'ERD labels should use relationship-centered placement');
assert.ok(erdPlacement.x > 120 && erdPlacement.x < 180, 'ERD labels should stay near the relationship center');

console.log('  ✅ flowchart labels are source-biased');
console.log('  ✅ flowchart label gaps compress only when space is tight');
console.log('  ✅ labels truncate at the end when space is too tight');
console.log('  ✅ sequence labels are centered on message paths');
console.log('  ✅ ERD labels are relationship-centered');
