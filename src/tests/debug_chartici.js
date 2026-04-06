import fs from 'fs';
import { calculateAllPaths } from '../utils/engine/index.js';
import { layoutNodesHeuristically } from '../utils/nodeLayouter.js';

const file = './samples/org_chart_3_enterprise.cci';
const content = fs.readFileSync(file, 'utf-8');
const root = JSON.parse(content).data;
const allNodes = [];
root.groups.forEach(g => {
    g.nodes.forEach(n => {
        n.width = n.size === 'L' ? 200 : (n.size === 'M' ? 160 : 120);
        n.height = n.size === 'L' ? 100 : (n.size === 'M' ? 80 : 60);
        allNodes.push(n);
    });
});

const edges = root.edges.map(e => ({...e, from: e.sourceId || e.from, to: e.targetId || e.to}));

const layoutedNodes = layoutNodesHeuristically(allNodes, edges, 'org_chart');

const paths = calculateAllPaths(edges, layoutedNodes, { diagramType: 'org_chart' });

['e1', 'e2', 'e3'].forEach(eid => {
    const e = paths[eid];
    console.log(`\nEdge ${eid} path:`);
    if(e) {
        e.pathD.split(' L ').forEach((pt, i) => {
            let clean = pt.replace('M ', '');
            console.log(`  PT ${i} : ${clean}`);
        });
    }
});
