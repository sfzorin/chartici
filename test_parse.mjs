import fs from 'fs';
import { parseCharticiFile } from './src/utils/charticiFormat.js';

const data = JSON.parse(fs.readFileSync('vol-01_01-1-1.cci', 'utf-8'));
const res = await parseCharticiFile(data);
console.log('Nodes count:', res.nodes.length);
console.log('Edges count:', res.edges.length);
res.edges.forEach(e => console.log(e.from, '->', e.to));
