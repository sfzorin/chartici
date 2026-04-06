const fs = require('fs');

const COLORS = ['primary-contrast', 'primary-surface', 'primary-subtle', 'neutral-text', 'neutral-stroke', 'neutral-base'];
const TYPES = ['square', 'circle', 'decision', 'capsule', 'element', 'chevron-right', 'chevron-down'];

const nodes = [];
const cols = 8;
const rows = 5;

// Create 40 nodes in a grid
for (let r = 0; r < rows; r++) {
  for (let c = 0; c < cols; c++) {
    const id = `node-${r}-${c}`;
    const x = c * 250 + 50;
    const y = r * 200 + 50;
    const type = TYPES[(r * cols + c) % TYPES.length];
    const color = COLORS[(r * cols + c) % COLORS.length];
    
    nodes.push(`  <node id="${id}" x="${x}" y="${y}" type="${type}" size="M" color="${color}" fillStyle="filled">
    Node ${r}-${c}
  </node>`);
  }
}

// Create edges
const edges = [];
let edgeCount = 0;

// Create horizontal chains
for (let r = 0; r < rows; r++) {
  for (let c = 0; c < cols - 1; c++) {
    edges.push(`  <edge from="node-${r}-${c}" to="node-${r}-${c+1}" color="neutral-stroke" lineStyle="solid" />`);
    edgeCount++;
  }
}

// Create vertical chains
for (let r = 0; r < rows - 1; r++) {
  for (let c = 0; c < cols; c++) {
    edges.push(`  <edge from="node-${r}-${c}" to="node-${r+1}-${c}" color="neutral-stroke" lineStyle="solid" />`);
    edgeCount++;
  }
}

// Add some diagonal / complex routing cross connections to test A* and buses
const complexConnections = [
  ['node-0-0', 'node-3-3', 'primary-contrast', 'dashed'],
  ['node-0-0', 'node-4-4', 'primary-subtle', 'solid'],
  ['node-0-0', 'node-2-1', 'neutral-text', 'dashed'],
  ['node-4-0', 'node-0-7', 'primary-surface', 'bold'],
  ['node-1-5', 'node-4-6', 'primary-contrast', 'bold-dashed'],
  ['node-4-7', 'node-3-2', 'neutral-text', 'dashed'],
  ['node-3-4', 'node-1-2', 'primary-surface', 'solid']
];

for (const [from, to, color, style] of complexConnections) {
  edges.push(`  <edge from="${from}" to="${to}" color="${color}" lineStyle="${style}">Deep Link</edge>`);
  edgeCount++;
}

console.log(`Generated ${edgeCount} edges and 40 nodes.`);

// Write XML
const xml = `<diagram viewBox="0 0 2200 1200" bgColor="white" theme="wireframe">
${nodes.join('\n')}

${edges.join('\n')}
</diagram>`;

fs.writeFileSync('complex_test.xml', xml);
console.log('complex_test.xml generated successfully.');
