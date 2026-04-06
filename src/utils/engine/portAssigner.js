/**
 * Port Assigner — Phase 1 of routing
 * 
 * Assigns exit/entry ports BEFORE A* runs.
 * Now acts as a robust penalty weighted matrix evaluating obstacle L-Rays 
 * and delegating heavy lifting to A* Priority Queue.
 */
import { getTrueBox, getNodePorts, isSegmentBlockedCheck } from './geometry.js';

/**
 * Assign ports for all edges.
 * @param {Array} edges - [{id, from, to, ...}]
 * @param {Array} nodes - [{id, x, y, type, size, width, height}]
 * @param {string} diagramType
 * @returns {Map<string, {startPorts, endPorts}>} edgeId → filtered port arrays
 */
export function assignPorts(edges, nodes, diagramType, isHorizontalFlow = false, ctx = null) {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const result = new Map();
  const isTree = diagramType === 'tree';

  // For trees ONLY: we need to find the shared Golden port
  const treeExitAssignments = new Map();
  const treeEntryAssignments = new Map();

  if (isTree) {
    const outgoing = new Map();
    const incoming = new Map();
    for (const edge of edges) {
      const src = nodeMap.get(edge.from);
      const tgt = nodeMap.get(edge.to);
      if (!src || !tgt) continue;
      
      const srcBox = getTrueBox(src);
      const tgtBox = getTrueBox(tgt);
      const dx = tgtBox.cx - srcBox.cx;
      const dy = tgtBox.cy - srcBox.cy;
      const angle = Math.atan2(dy, dx); 
      
      if (!outgoing.has(edge.from)) outgoing.set(edge.from, []);
      outgoing.get(edge.from).push({ edge, angle, dx, dy, node: src });
      
      if (!incoming.has(edge.to)) incoming.set(edge.to, []);
      incoming.get(edge.to).push({ edge, angle: Math.atan2(-dy, -dx), dx: -dx, dy: -dy, node: tgt });
    }
    for (const [, edgeInfos] of outgoing) {
      assignDirectionsTree(edgeInfos, treeExitAssignments, 'exit', isHorizontalFlow);
    }
    for (const [, edgeInfos] of incoming) {
      assignDirectionsTree(edgeInfos, treeEntryAssignments, 'entry', isHorizontalFlow);
    }
  }

  // Iterate all edges to compute robust penalties
  for (const edge of edges) {
    const src = nodeMap.get(edge.from);
    const tgt = nodeMap.get(edge.to);
    if (!src || !tgt) continue;

    const srcBox = getTrueBox(src);
    const tgtBox = getTrueBox(tgt);

    let startPorts = getNodePorts(src, srcBox);
    let endPorts = getNodePorts(tgt, tgtBox);

    if (isTree) {
      // Tree Penalty Assignment
      applyTreePenalties(startPorts, treeExitAssignments.get(edge.id), srcBox, src);
      applyTreePenalties(endPorts, treeEntryAssignments.get(edge.id), tgtBox, tgt);
      
      // We used to rigidly filter to [goldenStart] here, but that broke the Port Saturation Rule
      // (A* had no alternatives to pick if the golden port was occupied by a different edge Type).
      // Now we keep all ports; applyTreePenalties already assigned +4D/+8D to non-golden ports!
    } else {
      // Flowchart (Dynamic Penalty) Assignment
      applyFlowchartPenalties(startPorts, src, tgtBox, ctx, src.id, tgt.id);
      applyFlowchartPenalties(endPorts, tgt, srcBox, ctx, src.id, tgt.id);
    }

    result.set(edge.id, { startPorts, endPorts });
  }

  return result;
}

function applyTreePenalties(ports, goldenDir, box, node) {
  if (!goldenDir) return;
  const isStackEntry = node && !!node._stackEntry;

  for (const p of ports) {
    const sizeD = Math.max(20, p.axis === 'V' ? (box.right - box.left) : (box.bottom - box.top));
    p.sizeD = sizeD;
    
    // A center port is any primary cardinal port explicitly spawned with 0 initial penalty
    const isCenter = (!p.penalty || p.penalty === 0) && !!p.dir; 
    
    if (p.dir === goldenDir && isCenter) {
      p.penalty = 0;
    } else if (isCenter) {
      p.penalty = isStackEntry ? 20 * sizeD : 4 * sizeD;
    } else {
      p.penalty = isStackEntry ? 40 * sizeD : 8 * sizeD;
    }
  }
}

function applyFlowchartPenalties(ports, node, tgtBox, ctx, srcId, tgtId) {
  const srcBox = getTrueBox(node);
  
  for (const p of ports) {
    const sizeD = Math.max(20, p.axis === 'V' ? (srcBox.right - srcBox.left) : (srcBox.bottom - srcBox.top));
    p.sizeD = sizeD;
    const cat = getPortCategory(p, srcBox, tgtBox);
    
    let basePenalty = 0;
    if (cat === 'LATERAL') basePenalty = 1 * sizeD;
    if (cat === 'REAR') basePenalty = 2 * sizeD;
    if (cat === 'IDEAL') {
      const isVertFirst = p.axis === 'V';
      // Orthogonal L-ray check from the port to target center
      if (isLPathClear(p.pt.x, p.pt.y, tgtBox.cx, tgtBox.cy, isVertFirst, srcId, tgtId, ctx)) {
        basePenalty = 0;
      } else {
        basePenalty = 1 * sizeD; 
      }
    }

    // Offset / Bifurcation penalty addition
    const isOffset = p.penalty > 0;
    if (isOffset) {
      basePenalty += 2 * sizeD;
    }
    if (node.type === 'circle' && p.anchorPt) {
      basePenalty += 4 * sizeD;
    }

    p.penalty = basePenalty;
  }
}

function getPortCategory(port, srcBox, tgtBox) {
  const margin = 20; 
  const dx = tgtBox.cx - srcBox.cx;
  const dy = tgtBox.cy - srcBox.cy;
  
  let isIdeal = false;
  let isRear = false;
  
  if (port.axis === 'H') { 
      if (Math.abs(dx) <= margin) {
          isIdeal = false;
          isRear = false;
      } else {
          isIdeal = (port.dir === 'Right' && dx > 0) || (port.dir === 'Left' && dx < 0);
          isRear = !isIdeal;
      }
  } else { 
      if (Math.abs(dy) <= margin) {
          isIdeal = false;
          isRear = false;
      } else {
          isIdeal = (port.dir === 'Bottom' && dy > 0) || (port.dir === 'Top' && dy < 0);
          isRear = !isIdeal;
      }
  }
  return isIdeal ? 'IDEAL' : (isRear ? 'REAR' : 'LATERAL');
}

function isLPathClear(x1, y1, x2, y2, isVertFirst, startId, endId, ctx) {
  if (!ctx || !ctx.obstacles) return true;
  if (Math.abs(x1 - x2) < 2 && Math.abs(y1 - y2) < 2) return true;

  const bendX = isVertFirst ? x1 : x2;
  const bendY = isVertFirst ? y2 : y1;

  if (!isSegmentBlockedCheck(x1, y1, bendX, bendY, startId, endId, false, ctx)) {
      if (!isSegmentBlockedCheck(bendX, bendY, x2, y2, startId, endId, false, ctx)) {
          return true;
      }
  }
  return false;
}

function assignDirectionsTree(edgeInfos, assignments, role, isHorizontalFlow) {
  for (const info of edgeInfos) {
    let dir = 'Bottom';
    
    // Explicit override for denseGroups (vertically stacked children) configured by layout engine
    if (info.node && info.node._stackEntry) {
       dir = info.node._stackEntry;
    } else {
      if (isHorizontalFlow) {
        if (role === 'exit') {
          dir = info.dx >= 0 ? 'Right' : 'Left';
        } else {
          dir = info.dx <= 0 ? 'Left' : 'Right';
        }
      } else {
        if (role === 'exit') {
          dir = info.dy >= 0 ? 'Bottom' : 'Top';
        } else {
          dir = info.dy <= 0 ? 'Top' : 'Bottom';
        }
      }
    }
    assignments.set(info.edge.id, dir);
  }
}
