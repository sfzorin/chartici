import dagre from 'dagre';
import { getNodeDim } from '../constants.js';
import { getGroupId } from '../groupUtils.js';

export function layoutSugiyamaDAG(nodes, edges, layoutRules, isHorizontalFlow, dt = 'flowchart') {
  const applyHappyPath = dt !== 'sequence' && dt !== 'erd';
  const g = new dagre.graphlib.Graph();
  
  const MIN_GAP_MAIN = isHorizontalFlow ? layoutRules.MIN_GAP_X : layoutRules.MIN_GAP_Y;
  const MIN_GAP_CROSS = (dt === 'tree' && !isHorizontalFlow) ? 40 : (isHorizontalFlow ? layoutRules.MIN_GAP_Y : layoutRules.MIN_GAP_X);

  g.setGraph({
    rankdir: isHorizontalFlow ? 'LR' : 'TB',
    nodesep: MIN_GAP_CROSS,
    ranksep: MIN_GAP_MAIN,
    marginx: 0,
    marginy: 0
  });

  g.setDefaultEdgeLabel(() => ({ weight: 1 }));



  const childMap = new Map();
  const nodeById = new Map(nodes.map(n => [String(n.id), n]));
  
  edges.forEach(e => {
    const from = String(e.from || e.sourceId);
    const to = String(e.to || e.targetId);
    if (!childMap.has(from)) childMap.set(from, []);
    childMap.get(from).push(to);
  });


  
  // Calculate Node Depths (Roots = 0, Level 2 = 1, Level 3 = 2)
  const inDeg = new Map();
  nodes.forEach(n => inDeg.set(String(n.id), 0));
  edges.forEach(e => {
      const tgt = String(e.to || e.targetId);
      if (inDeg.has(tgt)) inDeg.set(tgt, inDeg.get(tgt) + 1);
  });
  
  const depthMap = new Map();
  let queue = [];
  inDeg.forEach((count, id) => {
      if (count === 0) {
          depthMap.set(id, 0);
          queue.push(id);
      }
  });
  
  while (queue.length > 0) {
      const curr = queue.shift();
      const currDepth = depthMap.get(curr);
      const kids = childMap.get(curr) || [];
      for (const kid of kids) {
          if (!depthMap.has(kid)) {
              depthMap.set(kid, currDepth + 1);
              queue.push(kid);
          }
      }
  }

  nodes.forEach(n => {
    g.setNode(String(n.id), { width: n.w, height: n.h });
  });

  // Calculate Longest Path for Happy Path weighting
  let happyEdges = new Set();
  let forwardEdges = new Set();
  
  if (applyHappyPath && nodes.length > 0) {
      const adj = {};
      const localInDeg = {};
      nodes.forEach(n => {
         adj[String(n.id)] = [];
         localInDeg[String(n.id)] = 0;
      });
      edges.forEach(e => {
         const from = String(e.from || e.sourceId);
         const to = String(e.to || e.targetId);
         if (!adj[from]) adj[from] = [];
         adj[from].push(to);
         localInDeg[to] = (localInDeg[to] || 0) + 1;
      });

      let roots = Object.keys(localInDeg).filter(k => localInDeg[k] === 0);
      if (roots.length === 0 && nodes.length > 0) roots = [String(nodes[0].id)]; 

      // 1. Detect and filter out back-edges to prevent Dagre dummy-node displacement
      const color = {};
      nodes.forEach(n => color[String(n.id)] = 0);

      const dfsCycle = (u) => {
          color[u] = 1;
          for (const v of (adj[u] || [])) {
              if (color[v] === 1) continue; // Back-edge detected!
              forwardEdges.add(`${u}->${v}`);
              if (color[v] === 0) dfsCycle(v);
          }
          color[u] = 2;
      };

      roots.forEach(r => { if (color[r] === 0) dfsCycle(r); });
      nodes.forEach(n => { if (color[String(n.id)] === 0) dfsCycle(String(n.id)); });

      // 2. DFS Longest Path (Happy Path)
      const memo = {};
      const nextNode = {};

      const dfs = (u, visited) => {
         if (visited.has(u)) return -10000; // Break cycles, do not reward them
         if (memo[u] !== undefined) return memo[u];

         const children = adj[u] || [];
         if (children.length === 0) {
             memo[u] = 1; // True leaf node without exits
             return 1;
         }

         visited.add(u);
         let maxLen = -10000;
         let bestNext = null;

         for (const v of children) {
             const len = 1 + dfs(v, visited);
             if (len > maxLen) {
                 maxLen = len;
                 bestNext = v;
             }
         }

         visited.delete(u);
         nextNode[u] = bestNext;
         memo[u] = maxLen;
         return maxLen;
      };

      let overallMax = -1;
      let bestRoot = null;
      roots.forEach(r => {
         const len = dfs(r, new Set());
         if (len > overallMax) {
             overallMax = len;
             bestRoot = r;
         }
      });

      let curr = bestRoot;
      const pathVisited = new Set();
      while (curr && nextNode[curr] && !pathVisited.has(curr)) {
         pathVisited.add(curr);
         const nxt = nextNode[curr];
         happyEdges.add(`${curr}->${nxt}`);
         curr = nxt;
      }
  }

  edges.forEach(e => {
    const from = String(e.from || e.sourceId);
    const to = String(e.to || e.targetId);
    
    // Hide back-edges from Dagre layout to prevent off-axis displacement!
    if (applyHappyPath && !forwardEdges.has(`${from}->${to}`)) return;



    let weight = 1;
    let minlen = 1;

    // Dynamically calculate required distance for Text Labels to prevent visual snapping collisions
    if (e.label && e.label.length > 0) {
       const charCount = Math.min(e.label.length, 15);
       const reqPixels = charCount * 8 + 24; // ~8px per char + 24px structural buffer
       const hopSpan = Math.ceil(reqPixels / MIN_GAP_MAIN);
       if (hopSpan > 1) {
           minlen = hopSpan;
       }
    }

    if (happyEdges.has(`${from}->${to}`)) {
       weight = 100; // Straight line priority for Happy Path
    }

    g.setEdge(from, to, { weight, minlen });
  });

  dagre.layout(g);

  // Top-Align Nodes within each rank (pull shorter elements up to match the tallest in the row)
  const rankGroups = {};
  const shiftMap = {};
  g.nodes().forEach(id => {
      const info = g.node(id);
      if (!info) return;
      const mainPos = Math.round(isHorizontalFlow ? info.x : info.y);
      if (!rankGroups[mainPos]) rankGroups[mainPos] = [];
      const dim = isHorizontalFlow ? info.width : info.height;
      rankGroups[mainPos].push({ id, dim });
  });

  for (const mainPos in rankGroups) {
      const members = rankGroups[mainPos];
      if (members.length === 0) continue;
      const maxDim = Math.max(...members.map(m => m.dim || 0));
      const rankTopEdge = Number(mainPos) - maxDim / 2;
      members.forEach(m => {
          shiftMap[m.id] = (rankTopEdge + (m.dim || 0) / 2) - Number(mainPos);
      });
  }

  // Map back to output format with Swiss-Industrial snapping
  const result = nodes.map(n => {
     const nodeInfo = g.node(String(n.id));
     const shift = shiftMap[String(n.id)] || 0;
     
     let centerX = Math.round((nodeInfo.x + (isHorizontalFlow ? shift : 0)) / 20) * 20;
     let centerY = Math.round((nodeInfo.y + (isHorizontalFlow ? 0 : shift)) / 20) * 20;

     if (n.lockPos) {
       centerX = n.x;
       centerY = n.y;
     }

     return {
        ...n,
        x: centerX,
        y: centerY
     };
  });

  return result;
}
