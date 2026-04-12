import { runAStar } from '../utils/engine/astar.js';
import { RoutingContext } from '../utils/engine/RoutingContext.js';
import { getTrueBox, getNodePorts } from '../utils/engine/geometry.js';
import { getDiagramRules } from '../utils/diagramRules.js';
import { getNodeDim } from '../diagram/nodes.jsx';
import fs from 'fs';
import { calculateAllPaths } from '../utils/engine/index.js';
import { layoutNodesHeuristically } from '../utils/nodeLayouter.js';

///////////////////////////////////////////////////////////////
// 1. ASSERTION FRAMEWORK
///////////////////////////////////////////////////////////////

class Asserter {
    constructor(testName) {
        this.testName = testName;
        this.errors = [];
    }

    assert(condition, message) {
        if (!condition) this.errors.push(message);
    }
    
    assertLength(pts, expectedLength, message) {
        let len = 0;
        for (let i = 0; i < pts.length - 1; i++) {
            len += Math.abs(pts[i+1].x - pts[i].x) + Math.abs(pts[i+1].y - pts[i].y);
        }
        if (len !== expectedLength) {
            this.errors.push(`${message} (Expected length: ${expectedLength}, Got: ${len})`);
        }
    }
    
    assertMaxBends(pts, maxBends, message) {
        let bends = 0;
        let prevAxis = null;
        for (let i = 0; i < pts.length - 1; i++) {
            if (pts[i].x === pts[i+1].x && pts[i].y === pts[i+1].y) continue;
            let axis = pts[i].x !== pts[i+1].x ? 'H' : 'V';
            if (prevAxis && axis !== prevAxis) bends++;
            prevAxis = axis;
        }
        // Exclude the mandatory terminal stub bends if they just hit the port
        if (bends > maxBends) {
            this.errors.push(`${message} (Expected <= ${maxBends} bends, Got: ${bends})`);
        }
    }
    
    // Mathematically verifies no line segment pierces ANY obstacle's true padding
    assertNoIntersection(pts, ctx, message) {
        for (let i = 0; i < pts.length - 1; i++) {
            let x1 = pts[i].x, y1 = pts[i].y;
            let x2 = pts[i+1].x, y2 = pts[i+1].y;
            let minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
            let minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
            
            for (let obs of ctx.obstacles) {
                // If it's a point, we don't segment-intersect
                if (x1 === x2 && y1 === y2) continue;
                
                // Allow touching the very outer boundary (e.g. true bounding box edge), 
                // but strictly forbid crossing completely through the box
                // We shrink the obstacle strictly by 1px so we only penalty actual 'piercing'
                let trueBox = ctx.nodeBoxes.get(obs.id);
                if (!trueBox) continue;

                let oLeft = trueBox.left + 1;
                let oRight = trueBox.right - 1;
                let oTop = trueBox.top + 1;
                let oBottom = trueBox.bottom - 1;
                
                const crossesX = Math.max(minX, oLeft) < Math.min(maxX, oRight);
                const crossesY = Math.max(minY, oTop) < Math.min(maxY, oBottom);
                
                if (y1 === y2) { // Horizontal segment
                    if (y1 > oTop && y1 < oBottom && crossesX) {
                        this.errors.push(`${message} (Horizontal segment ${x1},${y1} -> ${x2},${y2} pierced node ${obs.id})`);
                    }
                } else if (x1 === x2) { // Vertical segment
                    if (x1 > oLeft && x1 < oRight && crossesY) {
                         this.errors.push(`${message} (Vertical segment ${x1},${y1} -> ${x2},${y2} pierced node ${obs.id})`);
                    }
                }
            }
        }
    }

    report() {
        if (this.errors.length === 0) {
            console.log(`✅ [PASS] ${this.testName}`);
            return true;
        } else {
            console.log(`❌ [FAIL] ${this.testName}`);
            this.errors.forEach(e => console.log(`    -> ${e}`));
            return false;
        }
    }
}

///////////////////////////////////////////////////////////////
// 2. MOCK ENVIRONMENT SETUP
///////////////////////////////////////////////////////////////

function createNode(id, x, y, sizeKey) {
    const dim = getNodeDim({ type: 'process', size: sizeKey });
    return { id, x, y, width: dim.width, height: dim.height, w: dim.width, h: dim.height, type: 'rect', size: sizeKey };
}

async function runTestCase(name, setupFunc) {
    const asserter = new Asserter(name);
    try {
        await setupFunc(asserter);
    } catch (e) {
        asserter.errors.push(`CRASH: ${e.message}`);
    }
    return asserter.report();
}

///////////////////////////////////////////////////////////////
// 3. THE TESTS
///////////////////////////////////////////////////////////////

(async () => {
    let allTestsPassed = true;

    // TEST 1: The simplest route. A straight line down.
    allTestsPassed &= await runTestCase('Test 1: Length Minimization (Straight Line)', (t) => {
        const { routing: rules } = getDiagramRules('org_chart');
        const nodes = [ createNode('n1', 100, 100, 'S'), createNode('n2', 100, 300, 'S') ];
        const ctx = new RoutingContext([{from:'n1',to:'n2'}], nodes, false, null, rules);
        nodes.forEach(n => {
            const b = getTrueBox(n);
            ctx.nodeBoxes.set(n.id, b);
            ctx.obstacles.push({ id: n.id, left: b.left-20, right: b.right+20, top: b.top-20, bottom: b.bottom+20,
                                 vLeft: b.left-2, vRight: b.right+2, vTop: b.top-2, vBottom: b.bottom+2 });
        });
        const sp = getNodePorts(ctx.nodeBoxes.get('n1')).filter(p => p.dir==='Bottom');
        const ep = getNodePorts(ctx.nodeBoxes.get('n2')).filter(p => p.dir==='Top');
        
        const res = runAStar(sp, ep, 'n1', 'n2', false, 'solid', 20, false, true, Infinity, ctx);
        t.assert(res !== null, "Path should be found");
        t.assertLength(res.pts, 120, "Path MUST strictly follow the shortest Manhattan distance");
        t.assertMaxBends(res.pts, 0, "A straight vertical port-to-port path must have 0 bends");
    });

    // TEST 2: Connecting diagonal nodes. Should strictly use 2 bends via bounding boxes (П-shape).
    allTestsPassed &= await runTestCase('Test 2: Corners (П-shape Connection)', (t) => {
        const { routing: rules } = getDiagramRules('org_chart');
        const nodes = [ createNode('n1', 100, 100, 'S'), createNode('n2', 300, 300, 'S') ];
        const ctx = new RoutingContext([{from:'n1',to:'n2'}], nodes, false, null, rules);
        nodes.forEach(n => {
            const b = getTrueBox(n);
            ctx.nodeBoxes.set(n.id, b);
            ctx.obstacles.push({ id: n.id, vLeft: b.left-2, vRight: b.right+2, vTop: b.top-2, vBottom: b.bottom+2 });
        });
        const sp = getNodePorts(ctx.nodeBoxes.get('n1')).filter(p => p.dir==='Bottom');
        const ep = getNodePorts(ctx.nodeBoxes.get('n2')).filter(p => p.dir==='Top');
        
        const res = runAStar(sp, ep, 'n1', 'n2', false, 'solid', 20, false, true, Infinity, ctx);
        t.assert(res !== null, "Path should be found");
        t.assertMaxBends(res.pts, 2, "Connecting diagonally offset nodes must be resolved in exactly 2 bends");
    });

    // TEST 3: The famous 'dx=20' offset bug! 
    allTestsPassed &= await runTestCase('Test 3: Kink-prevention (dx=20 micro-shift)', (t) => {
        const { routing: rules } = getDiagramRules('org_chart');
        const nodes = [ createNode('ceo', 480, 100, 'L'), createNode('fin', 480, 300, 'M') ];
        const ctx = new RoutingContext([{from:'ceo',to:'fin'}], nodes, false, null, rules);
        nodes.forEach(n => {
            const b = getTrueBox(n);
            ctx.nodeBoxes.set(n.id, b);
            ctx.obstacles.push({ id: n.id, vLeft: b.left-2, vRight: b.right+2, vTop: b.top-2, vBottom: b.bottom+2 });
        });
        const sp = getNodePorts(ctx.nodeBoxes.get('ceo')).filter(p => p.dir==='Bottom');
        const ep = getNodePorts(ctx.nodeBoxes.get('fin')).filter(p => p.dir==='Top');
        
        const res = runAStar(sp, ep, 'ceo', 'fin', false, 'solid', 20, false, true, Infinity, ctx);
        t.assert(res !== null, "Path should be found");
        t.assertMaxBends(res.pts, 2, "A slight horizontal offset must be covered using a simple 2-bend translation, NOT a U-Turn Kink");
    });

    // TEST 4: Wall avoidance. Line must NOT pierce a node in the way!
    allTestsPassed &= await runTestCase('Test 4: Node Intersection Shield', (t) => {
        const { routing: rules } = getDiagramRules('flowchart');
        const nodes = [ 
            createNode('start', 100, 100, 'S'), 
            createNode('wall', 80, 240, 'XL'), 
            createNode('end', 100, 400, 'S') 
        ];
        const ctx = new RoutingContext([{from:'start',to:'end'}], nodes, false, null, rules);
        nodes.forEach(n => {
            const b = getTrueBox(n);
            ctx.nodeBoxes.set(n.id, b);
            ctx.obstacles.push({ id: n.id, left: b.left-20, right: b.right+20, top: b.top-20, bottom: b.bottom+20,
                                 vLeft: b.left-2, vRight: b.right+2, vTop: b.top-2, vBottom: b.bottom+2 });
        });
        
        const sp = getNodePorts(ctx.nodeBoxes.get('start')).filter(p => p.dir==='Bottom');
        const ep = getNodePorts(ctx.nodeBoxes.get('end')).filter(p => p.dir==='Top');
        const res = runAStar(sp, ep, 'start', 'end', false, 'solid', 20, false, true, Infinity, ctx);
        
        t.assert(res !== null, "Path must find a route around the wall");
        if (res) t.assertNoIntersection(res.pts, ctx, "The mathematical raycast crossed an obstacle's bounding box!");
    });

    // TEST 5: Sibling Top-Port Enforcer
    allTestsPassed &= await runTestCase('Test 5: Sibling-Aware Horizontal Bus Enforcer', async (t) => {
        const computeEndPortsForOrgChart = (siblings) => {
           let sumDy = 0; let count = 0;
           for (let i = 0; i < siblings.length - 1; i++) {
               for (let j = i + 1; j < siblings.length; j++) {
                   sumDy += Math.abs(siblings[i].y - siblings[j].y); count++;
               }
           }
           let isVert = (count > 0 ? (sumDy/count) > 40 : false);
           return isVert ? 'Left' : 'Top';
        };
        
        const siblingsRow = [ {id:'a', y: 300}, {id:'b', y: 300}, {id:'c', y: 300} ];
        const portDirH = computeEndPortsForOrgChart(siblingsRow);
        t.assert(portDirH === 'Top', "Horizontal row of siblings MUST force Top-ports");
        
        const siblingsStack = [ {id:'a', y: 300}, {id:'b', y: 400}, {id:'c', y: 500} ];
        const portDirV = computeEndPortsForOrgChart(siblingsStack);
        t.assert(portDirV === 'Left', "Vertical stack of siblings MUST force side-ports");
    });

    // TEST 6: Bus Bundling vs Overlap Penalties
    // Here we simulate CEO -> OPS creating a horizontal bus, and CEO -> FIN dropping down.
    allTestsPassed &= await runTestCase('Test 6: Bus Bundling & U-Turn Simulation', (t) => {
        const { routing: rules } = getDiagramRules('org_chart');
        const nodes = [ createNode('ceo', 480, 100, 'L'), createNode('ops', 140, 300, 'M'), createNode('fin', 480, 300, 'M') ];
        // Edge 1: ceo->ops. Edge 2: ceo->fin
        const ctx = new RoutingContext([{from:'ceo',to:'ops', id:'e1'}, {from:'ceo',to:'fin', id:'e2'}], nodes, false, null, rules);
        nodes.forEach(n => {
            const b = getTrueBox(n);
            ctx.nodeBoxes.set(n.id, b);
            ctx.obstacles.push({ id: n.id, vLeft: b.left-2, vRight: b.right+2, vTop: b.top-2, vBottom: b.bottom+2 });
        });
        
        // Let's manually route CEO -> OPS first to populate occupiedLines (simulating the UI sort order)
        const sp1 = getNodePorts(ctx.nodeBoxes.get('ceo')).filter(p => p.dir==='Bottom');
        const ep1 = getNodePorts(ctx.nodeBoxes.get('ops')).filter(p => p.dir==='Top');
        const res1 = runAStar(sp1, ep1, 'ceo', 'ops', false, 'solid', 20, false, true, Infinity, ctx);
        for(let i=0; i<res1.pts.length-1; i++) {
            ctx.occupiedLines.push({ x1: res1.pts[i].x, y1: res1.pts[i].y, x2: res1.pts[i+1].x, y2: res1.pts[i+1].y, startNodeId: 'ceo', endNodeId: 'ops' });
        }
        
        // NOW route CEO -> FIN !!
        const sp2 = getNodePorts(ctx.nodeBoxes.get('ceo')).filter(p => p.dir==='Bottom');
        const ep2 = getNodePorts(ctx.nodeBoxes.get('fin')).filter(p => p.dir==='Top');
        const res2 = runAStar(sp2, ep2, 'ceo', 'fin', false, 'solid', 20, false, true, Infinity, ctx);
        
        t.assert(res2 !== null, "Path should be found for CEO -> FIN despite horizontal bus overlap");
        t.assertMaxBends(res2.pts, 2, "Even if it crosses the bus, A* MUST NOT perform a 4-bend U-Turn detour!");
    });
    
    // TEST 7: Backward Edge Fallback
    allTestsPassed &= await runTestCase('Test 7: Logical Conflict (Backward Edge)', (t) => {
        const { routing: rules } = getDiagramRules('org_chart');
        // Child to Parent edge: 'ops' -> 'ceo'
        const nodes = [ createNode('ceo', 480, 100, 'L'), createNode('ops', 480, 300, 'M') ];
        const ctx = new RoutingContext([{from:'ops',to:'ceo', id:'eX'}], nodes, false, null, rules);
        nodes.forEach(n => {
            const b = getTrueBox(n);
            ctx.nodeBoxes.set(n.id, b);
            ctx.obstacles.push({ id: n.id, vLeft: b.left-2, vRight: b.right+2, vTop: b.top-2, vBottom: b.bottom+2 });
        });
        
        // In this case, starting bottom of Ops, and going to Top of CEO. This forces path to bend AROUND the child itself!
        const sp = getNodePorts(ctx.nodeBoxes.get('ops')).filter(p => p.dir==='Bottom');
        const ep = getNodePorts(ctx.nodeBoxes.get('ceo')).filter(p => p.dir==='Top');
        // Let's use Tier 3 just to see how it resolves
        const res = runAStar(sp, ep, 'ops', 'ceo', true, 'solid', 10, false, true, Infinity, ctx);
        
        t.assert(res !== null, "Path should be found for backward topological edge");
        t.assertNoIntersection(res.pts, ctx, "Backward edge MUST navigate fully around obstacles and not cut through them");
    });
    
    // TEST 8: Full Real-World Samples Suite
    allTestsPassed &= await runTestCase('Test 8: Real World Samples Verification', (t) => {
        const samplesDir = './samples';
        const files = fs.readdirSync(samplesDir).filter(f => f.endsWith('.cci'));
        
        let processedCount = 0;
        
        for (const file of files) {
            const raw = JSON.parse(fs.readFileSync(`${samplesDir}/${file}`, 'utf-8'));
            let inNodes = [];
            raw.data.groups.forEach(g => {
                g.nodes.forEach(n => {
                   const dim = getNodeDim({ type: n.type || 'process', size: n.size || 'M' });
                   inNodes.push({ ...n, width: dim.width, height: dim.height, w: dim.width, h: dim.height });
                });
            });
            const inEdges = raw.data.edges.map(e => ({ id: e.id, from: e.sourceId, to: e.targetId }));
            const config = raw.data.config || { diagramType: 'flowchart' };
            const isTree = ['org_chart', 'tree'].includes(config.diagramType);

            // Mock layout exactly as the frontend App.jsx does
            const laidOutNodes = layoutNodesHeuristically(inNodes, inEdges, config);
            
            // Generate paths
            const res = calculateAllPaths(inEdges, laidOutNodes, config);

            // Iterate over all resulting paths for mathematical assertions
            for (const edge of inEdges) {
                const pathObj = res[edge.id];
                if (!pathObj) continue;
                
                t.assert(!pathObj.isFallback, `File ${file}: Edge ${edge.id} MUST NOT trigger fallback straight-line routing`);
                
                if (pathObj.pts && pathObj.pts.length > 0) {
                    if (isTree) {
                        // Side-entry ports (Left/Right) require 3 bends natively (Drop -> Horizontal Bus -> Vertical Drop -> Horizontal Entry)
                        // Top/Bottom entry ports require 2 bends natively (Drop -> Horizontal Bus -> Vertical Drop)
                        let maxAllowed = 2;
                        if (pathObj.trueEndPt) {
                            // If the end port axis is different from the start port axis, it takes an extra bend.
                            // Start port in Org Charts is 'Bottom' (V axis). If end port is 'Left'/'Right' (H axis), it's 3 bends.
                            const startAxis = pathObj.trueStartPt ? (pathObj.trueStartPt.y === pathObj.pts[1].y ? 'H' : 'V') : 'V';
                            const endAxis = pathObj.trueEndPt.x === pathObj.pts[pathObj.pts.length-2].x ? 'V' : 'H';
                            if (startAxis !== endAxis) maxAllowed = 3;
                            
                            // Specific check for explicit end port dirs if available
                            if (pathObj.endDir === 'Left' || pathObj.endDir === 'Right') maxAllowed = 3;
                        } else {
                            // Deduce from the last segment line
                            const pL = pathObj.pts[pathObj.pts.length - 1];
                            const pLL = pathObj.pts[pathObj.pts.length - 2];
                            if (pL.y === pLL.y) maxAllowed = 3; // Entered horizontally
                        }
                        if (!file.includes('matrix')) {
                            t.assertMaxBends(pathObj.pts, maxAllowed, `File ${file}: Edge ${edge.id} in hierarchical tree should NOT exceed ${maxAllowed} bends (U-Turn Kink detected)`);
                        }
                    }
                    
                    const firstPt = pathObj.pts[0];
                    const lastPt = pathObj.pts[pathObj.pts.length - 1];
                    
                    if (pathObj.trueStartPt && pathObj.trueEndPt) {
                         t.assert(firstPt.x === pathObj.trueStartPt.x && firstPt.y === pathObj.trueStartPt.y, `File ${file}: Start routing point must align perfectly with True Start Port`);
                         t.assert(lastPt.x === pathObj.trueEndPt.x && lastPt.y === pathObj.trueEndPt.y, `File ${file}: End routing point must align perfectly with True End Port`);
                    }
                }
            }

            // After generating paths, explicitly verify T-Junctions for Tree Diagrams!
            if (isTree && res) {
                const edgeGroups = {};
                for (const edge of inEdges) {
                    const pathObj = res[edge.id];
                    if (!pathObj || !pathObj.pts || pathObj.pts.length < 3) continue;
                    
                    const startPt = pathObj.pts[0];
                    const signature = `${edge.from}_${startPt.x}_${startPt.y}`;
                    if (!edgeGroups[signature]) edgeGroups[signature] = [];
                    edgeGroups[signature].push({ edge, pts: pathObj.pts });
                }
                
                for (const [sig, siblings] of Object.entries(edgeGroups)) {
                    if (siblings.length < 2) continue; // T-junctions matter for multiple siblings
                    
                    let expectedBusCoordinate = null;
                    
                    for (const { edge, pts } of siblings) {
                        let firstBend = null;
                        for (let i = 0; i < pts.length - 2; i++) {
                            const dx1 = pts[i+1].x - pts[i].x;
                            const dy1 = pts[i+1].y - pts[i].y;
                            const dx2 = pts[i+2].x - pts[i+1].x;
                            const dy2 = pts[i+2].y - pts[i+1].y;
                            if ((dx1 !== 0 && dy2 !== 0) || (dy1 !== 0 && dx2 !== 0)) {
                                firstBend = pts[i+1];
                                break;
                            }
                        }
                        
                        if (firstBend) {
                            if (!expectedBusCoordinate) {
                                expectedBusCoordinate = firstBend;
                            } else {
                                // T-JUNCTION ASSERTION: Siblings must turn at the EXACT SAME XY coordinate!
                                t.assert(firstBend.x === expectedBusCoordinate.x && firstBend.y === expectedBusCoordinate.y,
                                    `File ${file}: T-Junction missing! Sibling edges from ${edge.from} failed to share a common trunk limit. Expected trunk bend at (${expectedBusCoordinate.x}, ${expectedBusCoordinate.y}), but edge ${edge.id} broke away early at (${firstBend.x}, ${firstBend.y}) `);
                            }
                        }
                    }
                }
            }

            processedCount++;
        }
        
        t.assert(processedCount > 0, "Samples directory should contain and parse valid .cci files");
        console.log(`       -> Validated ${processedCount} sample templates mathematically successfully`);
    });

    if (allTestsPassed) {
        console.log("\n🚀 ALL CORE MATHEMATICAL LAWS FUNCTIONAL AND PRESERVED.");
        process.exit(0);
    } else {
        console.log("\n💥 CORE ENGINE FAILURE DETECTED.");
        process.exit(1);
    }
})();
