import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { layoutNodesHeuristically } from '../src/utils/nodeLayouter';
import { calculateAllPaths } from '../src/utils/routing';
import { getNodeDim } from '../src/utils/constants';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SAMPLES_DIR = path.join(__dirname, '..', 'samples');

function getTrueBox(node) {
  const dim = getNodeDim(node);
  const left = node.x;
  const right = node.x + dim.width;
  const top = node.y;
  const bottom = node.y + dim.height;
  return { left, right, top, bottom, cx: left + (right - left)/2, cy: top + (bottom - top)/2 };
}

// Check if orthogonal segment p1-p2 intersects segment p3-p4
function segmentsIntersectIdx(p1, p2, p3, p4) {
  // Bounding box overlap check
  if (Math.max(p1.x, p2.x) < Math.min(p3.x, p4.x) || Math.min(p1.x, p2.x) > Math.max(p3.x, p4.x) ||
      Math.max(p1.y, p2.y) < Math.min(p3.y, p4.y) || Math.min(p1.y, p2.y) > Math.max(p3.y, p4.y)) {
      return false;
  }
  
  const ccw = (A, B, C) => (C.y - A.y) * (B.x - A.x) > (B.y - A.y) * (C.x - A.x);
  return (ccw(p1, p3, p4) !== ccw(p2, p3, p4)) && (ccw(p1, p2, p3) !== ccw(p1, p2, p4));
}

// Check if segment crosses inside a bounding box
function segmentCrossesBox(p1, p2, box) {
   // A segment crosses a box if it enters its interior.
   // Point in box: strict <
   const pointInBox = (pt) => (pt.x > box.left && pt.x < box.right && pt.y > box.top && pt.y < box.bottom);
   if (pointInBox(p1) || pointInBox(p2)) return true;
   
   // It could also just pass completely through it crossing two borders.
   const tl = {x: box.left, y: box.top};
   const tr = {x: box.right, y: box.top};
   const bl = {x: box.left, y: box.bottom};
   const br = {x: box.right, y: box.bottom};
   if (segmentsIntersectIdx(p1, p2, tl, tr)) return true;
   if (segmentsIntersectIdx(p1, p2, tr, br)) return true;
   if (segmentsIntersectIdx(p1, p2, br, bl)) return true;
   if (segmentsIntersectIdx(p1, p2, bl, tl)) return true;
   
   return false;
}

function processDiagram(filepath) {
   const fileContent = fs.readFileSync(filepath, 'utf8');
   const json = JSON.parse(fileContent);
   const data = json.data;
   
   const nodes = [];
   const edges = (data.edges || []).map(e => ({
       ...e,
       from: e.sourceId || e.from,
       to: e.targetId || e.to
   }));
   const config = data.config || {};
   
   (data.groups || []).forEach(g => {
       (g.nodes || []).forEach(n => {
           nodes.push({ ...n, groupId: g.id });
       });
   });
   
   // Run Layouter
   const laidOutNodes = layoutNodesHeuristically(nodes, edges, config);
   
   // Run Routing Engine
   const routingResult = calculateAllPaths(edges, laidOutNodes, true, null, config);
   
   let score = 100;
   const penalties = [];
   
   let totalTurns = 0;
   let pathCollisions = 0;
   let edgeToEdgeCrossings = 0;
   let totalDistance = 0;
   
   const edgePaths = [];
   
   // Create box mapping for node collision detection
   const nodeBoxes = new Map();
   laidOutNodes.forEach(n => nodeBoxes.set(n.id, getTrueBox(n)));
   
   edges.forEach(edge => {
       const res = routingResult[edge.id];
       if (!res || !res.pts) {
           score -= 10;
           penalties.push(`Missing routing path for edge ${edge.id}`);
           return;
       }
       const pts = res.pts;
       edgePaths.push(pts);
       
       // Turns: segments = pts.length - 1. turns = max(0, segments - 1). 
       // Optimal path is 1 to 3 segments (0-2 turns). >3 segments gets penalized.
       const segments = pts.length - 1;
       const turns = Math.max(0, segments - 1);
       totalTurns += turns;
       if (turns > 2) {
           const penalty = (turns - 2) * 2;
           score -= penalty;
           penalties.push(`Edge ${edge.id} has ${turns} turns (-${penalty})`);
       }
       
       // Calculate Manhattan distance vs straight-line distance
       const startPt = pts[0];
       const endPt = pts[pts.length - 1];
       let manhattanDist = 0;
       for (let i = 0; i < pts.length - 1; i++) {
           manhattanDist += Math.max(Math.abs(pts[i+1].x - pts[i].x), Math.abs(pts[i+1].y - pts[i].y));
       }
       totalDistance += manhattanDist;
       
       const straightDist = Math.abs(endPt.x - startPt.x) + Math.abs(endPt.y - startPt.y);
       if (manhattanDist > straightDist * 2.5 && straightDist > 0) {
           score -= 5;
           penalties.push(`Edge ${edge.id} distance excessively inefficient (-5)`);
       }
       
       // Check Collision with nodes
       // We ignore collisions with the immediate source/target nodes (because they connect from the centers outward).
       for (let i = 0; i < pts.length - 1; i++) {
           const p1 = pts[i];
           const p2 = pts[i+1];
           laidOutNodes.forEach(n => {
               if (n.id === edge.sourceId || n.id === edge.targetId) return;
               
               const paddingX = 4;
               const paddingY = 4;
               
               // We add 4px padding so lines don't scrape the absolute bounding box.
               // Since our layout engine adds PADDING natively, intersections with padded boxes indicate a true failure.
               const box = getTrueBox(n);
               box.left -= paddingX; box.right += paddingX;
               box.top -= paddingY; box.bottom += paddingY;
               
               if (segmentCrossesBox(p1, p2, box)) {
                   pathCollisions++;
               }
           });
       }
   });
   
   // Check Edge-Edge cross intersections
   for (let i=0; i < edgePaths.length; i++) {
       for (let j=i+1; j < edgePaths.length; j++) {
           const path1 = edgePaths[i];
           const path2 = edgePaths[j];
           let intersectCount = 0;
           for(let m=0; m < path1.length-1; m++) {
               for(let n=0; n < path2.length-1; n++) {
                   // Ignore overlapping T-junctions at endpoints. Real intersections are crossing middles.
                   if (segmentsIntersectIdx(path1[m], path1[m+1], path2[n], path2[n+1])) {
                       // Ensure they don't just share a common point (like a hub node)
                       const sharedStartEnd = 
                          (path1[m].x === path2[n].x && path1[m].y === path2[n].y) ||
                          (path1[m+1].x === path2[n+1].x && path1[m+1].y === path2[n+1].y);
                       
                       if (!sharedStartEnd) {
                          intersectCount++;
                       }
                   }
               }
           }
           if (intersectCount > 0) edgeToEdgeCrossings++;
       }
   }
   
   if (pathCollisions > 0) {
       score -= (pathCollisions * 15);
       penalties.push(`Node collisions: ${pathCollisions} (-${pathCollisions * 15})`);
   }
   
   if (edgeToEdgeCrossings > 0) {
       score -= (edgeToEdgeCrossings * 2);
       // We do a small penalty for line intersections because some topologies unavoidably require one crossing.
       penalties.push(`Line crossings: ${edgeToEdgeCrossings} (-${edgeToEdgeCrossings * 2})`);
   }
   
   if (score < 0) score = 0;
   
   return {
       file: path.basename(filepath),
       score,
       totalTurns,
       pathCollisions,
       edgeToEdgeCrossings,
       penalties,
       nodesCount: nodes.length,
       edgesCount: edges.length,
       totalDistance
   };
}

async function run() {
   const files = fs.readdirSync(SAMPLES_DIR).filter(f => f.endsWith('.chartici'));
   console.log(`\n======================================================`);
   console.log(` 💎 Chartici Layout & Geometry Engine Validator`);
   console.log(`======================================================\n`);
   
   const results = [];
   
   for (let f of files) {
       const filepath = path.join(SAMPLES_DIR, f);
       try {
          results.push(processDiagram(filepath));
       } catch (e) {
          console.error(`💥 FATAL ERROR on ${f}:`, e.stack);
          results.push({ file: f, score: 0, penalties: ['Crashed during layout/routing'] });
       }
   }
   
   results.sort((a,b) => b.score - a.score);
   
   console.table(results.map(r => ({
       File: r.file,
       Score: `${r.score}/100`,
       Nodes: r.nodesCount || 0,
       Edges: r.edgesCount || 0,
       Turns: r.totalTurns || 0,
       Collisions: r.pathCollisions || 0,
       Crossings: r.edgeToEdgeCrossings || 0
   })));
   
   console.log('\n--- Penalty Logs ---');
   results.filter(r => r.score < 100).forEach(r => {
       console.log(`\n📄 ${r.file} (Score: ${r.score})`);
       r.penalties.forEach(p => console.log(`   - ${p}`));
   });
   
   const avgScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;
   console.log(`\n======================================================`);
   console.log(` 🏆 Average Engine Performance Score: ${avgScore.toFixed(1)}/100`);
   console.log(`======================================================\n`);
   
   if (avgScore < 80) process.exit(1);
}

run();
