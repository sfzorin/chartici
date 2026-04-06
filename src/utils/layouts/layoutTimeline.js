import { getNodeDim } from '../constants.js';

export function layoutTimeline(nodes, edges, layoutRules, isHorizontal = true) {
  if (nodes.length === 0) return [];

  const GAP_MAIN = isHorizontal ? layoutRules.MIN_GAP_X : layoutRules.MIN_GAP_Y;
  const GAP_CROSS = isHorizontal ? layoutRules.MIN_GAP_Y : layoutRules.MIN_GAP_X;

  // Topological sort to determine order along the timeline
  const adj = {};
  const inDeg = {};
  nodes.forEach(n => { adj[String(n.id)] = []; inDeg[String(n.id)] = 0; });
  edges.forEach(e => {
    const from = String(e.from || e.sourceId);
    const to = String(e.to || e.targetId);
    if (adj[from]) adj[from].push(to);
    if (inDeg[to] !== undefined) inDeg[to]++;
  });

  // Kahn's topological sort
  const sorted = [];
  const queue = Object.keys(inDeg).filter(k => inDeg[k] === 0);
  const visited = new Set();

  while (queue.length > 0) {
    const u = queue.shift();
    if (visited.has(u)) continue;
    visited.add(u);
    sorted.push(u);
    for (const v of (adj[u] || [])) {
      inDeg[v]--;
      if (inDeg[v] <= 0 && !visited.has(v)) queue.push(v);
    }
  }

  // 1. DAG Depth & Parent Calculation (for Longest Path / Spine)
  const depth = {};
  const parent = {};
  nodes.forEach(n => { depth[String(n.id)] = 0; parent[String(n.id)] = null; });

  sorted.forEach(u => {
    (adj[u] || []).forEach(v => {
      if (depth[u] + 1 > depth[v]) {
        depth[v] = depth[u] + 1;
        parent[v] = u;
      }
    });
  });

  // 2. Identify the Spine
  let maxDepth = -1;
  let tail = null;
  sorted.forEach(u => {
    if (depth[u] > maxDepth) { maxDepth = depth[u]; tail = u; }
  });

  const spineSet = new Set();
  let curr = tail;
  while (curr !== null) {
    spineSet.add(curr);
    curr = parent[curr];
  }
  
  // Sort spine nodes strictly by depth
  const spineNodesTemp = [];
  sorted.forEach(u => {
    if (spineSet.has(u)) spineNodesTemp.push(u);
  });
  spineNodesTemp.sort((a, b) => depth[a] - depth[b]);

  const nodeMap = new Map(nodes.map(n => [String(n.id), n]));
  const result = [];
  const spineXMap = {};
  
  let currentLeftEdge = 0;
  const getGroupId = (n) => n.groupId || n.group || null;

  // 3. Place Spine Nodes (Force to Chevron)
  spineNodesTemp.forEach((u, i) => {
    const n = nodeMap.get(u);
    if (!n) return;
    
    // 1. Maintain absolute angles across all sizes. 
    // An identical angle means distance/height ratio must be constant.
    const rawDim = getNodeDim(n);
    const hBase = isHorizontal ? rawDim.height : rawDim.width;
    const wBase = isHorizontal ? rawDim.width : rawDim.height;
    
    // Proportional Cut guarantees angle is identical for S, M, L, XL!
    const cut = hBase * 0.25; 
    const nWidth = wBase + cut; // Extrude
    
    const centerX = currentLeftEdge + nWidth / 2;
    spineXMap[u] = centerX;
    
    result.push({
      ...n,
      type: 'chevron', // Automagically convert timeline spine to chevrons
      w: nWidth,
      h: hBase,
      x: isHorizontal ? centerX : 0,
      y: isHorizontal ? 0 : centerX
    });
    
    // The user requested micro-gaps to be 1.5x smaller (20 / 1.5 = 13.3)
    let gap = 12 - cut; // Visually 12px daylight
    
    if (i < spineNodesTemp.length - 1) {
       const nextId = spineNodesTemp[i+1];
       const nextN = nodeMap.get(nextId);
       if (nextN) {
           const g1 = getGroupId(n);
           const g2 = getGroupId(nextN);
           // If they belong to different groups, use macro gap
           if (g1 !== g2 || !g1 || !g2) {
               gap = 40 - cut; // Visually 40px daylight
           }
       }
    }
    
    currentLeftEdge += nWidth + gap;
  });

  // 4. Place Bubble Nodes
  const spineRef = {};
  nodes.forEach(n => {
    if (spineSet.has(String(n.id))) spineRef[String(n.id)] = String(n.id);
  });

  // Inherit spine reference top-down
  sorted.forEach(u => {
    if (!spineRef[u] && parent[u]) {
      spineRef[u] = spineRef[parent[u]];
    }
  });

  const topBubblesCounts = {};
  const bottomBubblesCounts = {};
  const BUBBLE_GAP_Y = layoutRules.MIN_GAP_Y * 3.5; // Longer legs: e.g. ~180px

  sorted.forEach(u => {
    if (spineSet.has(u)) return;
    const n = nodeMap.get(u);
    if (!n) return;

    const ref = spineRef[u] || spineNodesTemp[0]; // fallback to first spine node
    const baseX = spineXMap[ref] || 0;

    if (!topBubblesCounts[ref]) topBubblesCounts[ref] = 0;
    if (!bottomBubblesCounts[ref]) bottomBubblesCounts[ref] = 0;

    // Alternate popouts Top and Bottom
    const isTop = topBubblesCounts[ref] <= bottomBubblesCounts[ref];
    let yOffset = 0;

    if (isTop) {
      topBubblesCounts[ref]++;
      yOffset = -BUBBLE_GAP_Y * topBubblesCounts[ref];
    } else {
      bottomBubblesCounts[ref]++;
      yOffset = BUBBLE_GAP_Y * bottomBubblesCounts[ref];
    }

    // Strictly vertical! No advanceX used.
    const bX = baseX;

    result.push({
      ...n,
      x: isHorizontal ? bX : yOffset,
      y: isHorizontal ? yOffset : bX
    });
  });

  return result;
}


