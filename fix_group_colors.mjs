import fs from 'fs';

const genFile = './scripts/generate_cci_samples.mjs';
let gen = fs.readFileSync(genFile, 'utf-8');

// Update makeGroup to assign an explicit color from 0-7
gen = gen.replace(/function makeGroup\(label, type, size, nodes\) {/g, `let colorCounter = 0;\nfunction makeGroup(label, type, size, nodes) {\n  const color = colorCounter % 8;\n  colorCounter++;`);
gen = gen.replace(/return \{ id: \`g_\$\{label\}\`, label, type, size, nodes \};/g, `return { id: \`g_\$\{label\}\`, label, type, size, color, nodes };`);

fs.writeFileSync(genFile, gen);
