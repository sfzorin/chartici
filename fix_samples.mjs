import fs from 'fs';

const schemasFile = './src/utils/diagramSchemas.js';
let schemas = fs.readFileSync(schemasFile, 'utf-8');
// Forbid matrix connections
schemas = schemas.replace("allowedEdges: ['none', 'solid'],", "allowedEdges: ['none'],");
schemas = schemas.replace("features: { hasNodeValue: false, allowConnections: true },", "features: { hasNodeValue: false, allowConnections: false },");
schemas = schemas.replace("\"process -> process : Allowed across different groups/cells using 'solid'.\"", "\"Edges MUST NOT be used in matrices.\"");
fs.writeFileSync(schemasFile, schemas);

const genFile = './scripts/generate_cci_samples.mjs';
let gen = fs.readFileSync(genFile, 'utf-8');
gen = gen.replace(/makeEdge\("q1_1", "q2_1", "target", "dashed"\)/g, "");

// Add themes randomly (but deterministically per file)
const themes = ['muted-rainbow', 'vibrant-rainbow', 'grey', 'red', 'green', 'blue', 'brown', 'purple', 'blue-orange', 'green-purple', 'slate-rose', 'blue-teal-slate', 'indigo-green-red', 'brown-amber-grey'];
let themeIdx = 0;
gen = gen.replace(/meta: \{ type: "(.*?)", version: "(.*?)" \},/g, (match, type, version) => {
    const t = themes[themeIdx % themes.length];
    themeIdx++;
    return `${match}\n    theme: "${t}",`;
});
fs.writeFileSync(genFile, gen);
