const fs = require('fs');
const code = fs.readFileSync('/Users/sergeyzorin/Desktop/diagram/src/components/shapes/DiagramNode.jsx', 'utf8');
const match = code.match(/const baseColorToken = .*?;/);
console.log("baseColorToken logic:", match ? match[0] : "Not found");
