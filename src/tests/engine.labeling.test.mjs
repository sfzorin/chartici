import assert from 'node:assert';
import {
  getEdgeLabelPolicy,
  getManualEdgeLabelPlacement,
  getTextPathStartOffset,
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

const flowchartPlacement = getManualEdgeLabelPlacement({
  labelPolicy: flowchartPolicy,
  displayLabel: 'Submit Creds',
  pts: horizontalPath,
  labelStyle,
});
assert.ok(flowchartPlacement, 'flowchart labels should use manual source-biased placement');
assert.ok(flowchartPlacement.x < 100, 'flowchart labels should stay close to the source');

const sequencePolicy = getEdgeLabelPolicy('sequence');
assert.equal(sequencePolicy.strategy, 'message-center');
assert.equal(getTextPathStartOffset(sequencePolicy), '50%');
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

const erdPolicy = getEdgeLabelPolicy('erd');
assert.equal(erdPolicy.strategy, 'relationship-center');
assert.equal(getTextPathStartOffset(erdPolicy), '50%');

const erdPlacement = getManualEdgeLabelPlacement({
  labelPolicy: erdPolicy,
  displayLabel: 'contains',
  pts: horizontalPath,
  labelStyle,
});
assert.ok(erdPlacement, 'ERD labels should use relationship-centered placement');
assert.ok(erdPlacement.x > 120 && erdPlacement.x < 180, 'ERD labels should stay near the relationship center');

console.log('  ✅ flowchart labels are source-biased');
console.log('  ✅ sequence labels are centered on message paths');
console.log('  ✅ ERD labels are relationship-centered');
