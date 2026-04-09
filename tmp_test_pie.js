import fs from 'fs';
import { parseCharticiFile } from './src/utils/charticiFormat.js';
import { layoutNodesHeuristically } from './src/utils/nodeLayouter.js';

const content = fs.readFileSync('./src/assets/samples/piechart_2_medium.cci', 'utf8');
const parsed = parseCharticiFile(content);
const laidOut = layoutNodesHeuristically(parsed.nodes, parsed.edges, { diagramType: parsed.meta?.type || 'piechart', groups: parsed.groups });
console.log(laidOut.filter(n => n.isPieSlice).map(n => n.color));
