const fs = require('fs');
const AppCode = fs.readFileSync('/Users/sergeyzorin/Desktop/diagram/src/App.jsx', 'utf8');
const DRCode = fs.readFileSync('/Users/sergeyzorin/Desktop/diagram/src/components/DiagramRenderer.jsx', 'utf8');
const DNCode = fs.readFileSync('/Users/sergeyzorin/Desktop/diagram/src/components/shapes/DiagramNode.jsx', 'utf8');
const LPCode = fs.readFileSync('/Users/sergeyzorin/Desktop/diagram/src/utils/layouts/layoutPiechart.js', 'utf8');

console.log("PIE layout width:", LPCode.match(/w:\s*([0-9]+)/)[1]);
console.log("DiagramNode uses:", DNCode.includes("const NODE_WIDTH = node.w || dim.width"));
console.log("DR bounding box logic:", DRCode.includes("const nw = n.w || dim.width"));
