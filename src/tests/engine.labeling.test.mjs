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
const visualPad = Math.ceil(labelStyle.fontSize / 2);

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
assert.equal(flowchartPlacement.x, 20 + visualPad, 'flowchart labels should keep a visual source-side 20px gap');
assert.equal(flowchartPlacement.textAnchor, 'start', 'rightward flowchart labels should start at the gap');

const roomyFlowchartPlacement = getManualEdgeLabelPlacement({
  labelPolicy: flowchartPolicy,
  displayLabel: 'Go',
  pts: [{ x: 0, y: 0 }, { x: 200, y: 0 }],
  labelStyle,
});
assert.equal(roomyFlowchartPlacement.x, 20 + visualPad, 'roomy flowchart labels should keep a visual 20px source gap');

const tightFlowchartPlacement = getManualEdgeLabelPlacement({
  labelPolicy: flowchartPolicy,
  displayLabel: 'Go',
  pts: [{ x: 0, y: 0 }, { x: 46, y: 0 }],
  labelStyle,
});
assert.equal(tightFlowchartPlacement.x, 5 + visualPad, 'tight flowchart labels should keep a visual 5px source gap');
assert.equal(tightFlowchartPlacement.y, -7, 'horizontal flowchart labels should stay above the line');

const tinyFlowchartLabel = getFittedManualEdgeLabel({
  labelPolicy: flowchartPolicy,
  displayLabel: 'Blocked',
  pts: [{ x: 0, y: 0 }, { x: 12, y: 0 }],
  labelStyle,
});
assert.ok(tinyFlowchartLabel, 'flowchart labels should truncate instead of disappearing on tiny segments');

const leftwardFlowchartPlacement = getManualEdgeLabelPlacement({
  labelPolicy: flowchartPolicy,
  displayLabel: 'Go',
  pts: [{ x: 100, y: 0 }, { x: 0, y: 0 }],
  labelStyle,
});
assert.equal(leftwardFlowchartPlacement.x, 80 - visualPad, 'leftward flowchart labels should keep the near edge at the visual gap');
assert.equal(leftwardFlowchartPlacement.y, -7, 'leftward horizontal flowchart labels should stay above the line');
assert.equal(leftwardFlowchartPlacement.textAnchor, 'end', 'leftward flowchart labels should end at the source-side gap');

const downwardFlowchartPlacement = getManualEdgeLabelPlacement({
  labelPolicy: flowchartPolicy,
  displayLabel: 'Wait',
  pts: [{ x: 0, y: 0 }, { x: 0, y: 200 }],
  labelStyle,
});
assert.equal(downwardFlowchartPlacement.x, -7, 'vertical flowchart labels should stay left of the line');
assert.equal(downwardFlowchartPlacement.y, 20 + visualPad, 'downward flowchart labels should keep the visual source-side 20px gap');
assert.equal(downwardFlowchartPlacement.textAnchor, 'end', 'downward labels should anchor by the text end');

const tightDownwardLabel = getFittedManualEdgeLabel({
  labelPolicy: flowchartPolicy,
  displayLabel: 'Very Long Label',
  pts: [{ x: 0, y: 0 }, { x: 0, y: 92 }],
  labelStyle,
});
const tightDownwardPlacement = getManualEdgeLabelPlacement({
  labelPolicy: flowchartPolicy,
  displayLabel: tightDownwardLabel,
  pts: [{ x: 0, y: 0 }, { x: 0, y: 92 }],
  labelStyle,
});
assert.equal(tightDownwardPlacement.y, 5 + visualPad, 'tight downward labels should still keep a visual 5px source gap');
assert.ok(
  tightDownwardPlacement.y + tightDownwardPlacement.labelWidth <= 87 - visualPad,
  'tight downward labels should preserve the 5px target-side gap using the rendered label width'
);

const upwardFlowchartPlacement = getManualEdgeLabelPlacement({
  labelPolicy: flowchartPolicy,
  displayLabel: 'Done',
  pts: [{ x: 0, y: 200 }, { x: 0, y: 0 }],
  labelStyle,
});
assert.equal(upwardFlowchartPlacement.x, -7, 'upward vertical flowchart labels should stay left of the line');
assert.equal(upwardFlowchartPlacement.y, 180 - visualPad, 'upward flowchart labels should keep the visual source-side 20px gap');
assert.equal(upwardFlowchartPlacement.textAnchor, 'start', 'upward labels should anchor by the text start');

assert.equal(
  getFittedManualEdgeLabel({
    labelPolicy: flowchartPolicy,
    displayLabel: 'Very Long Label',
    pts: [{ x: 0, y: 0 }, { x: 70, y: 0 }],
    labelStyle,
  }),
  'V...',
  'flowchart labels should truncate at the end when even the 5px gap is tight'
);

const tightUpwardLabel = getFittedManualEdgeLabel({
  labelPolicy: flowchartPolicy,
  displayLabel: 'Very Long Label',
  pts: [{ x: 0, y: 92 }, { x: 0, y: 0 }],
  labelStyle,
});
const tightUpwardPlacement = getManualEdgeLabelPlacement({
  labelPolicy: flowchartPolicy,
  displayLabel: tightUpwardLabel,
  pts: [{ x: 0, y: 92 }, { x: 0, y: 0 }],
  labelStyle,
});
assert.equal(tightUpwardPlacement.y, 87 - visualPad, 'tight upward labels should still keep a visual 5px source gap');
assert.ok(
  tightUpwardPlacement.y - tightUpwardPlacement.labelWidth >= 5 + visualPad,
  'tight upward labels should preserve the 5px target-side gap using the rendered label width'
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
