import dagre from 'dagre';
import { getNodeDim } from '../../diagram/nodes.jsx';
import { EDGE_LABEL_STYLE } from '../../diagram/edges.js';

const GRID_STEP = 20;
const LABEL_CHAR_WIDTH = Math.max(8, EDGE_LABEL_STYLE.charWidth || 7.4);

function labelRequiredPx(label, extra = 56) {
  if (!label) return 0;
  return Math.ceil(String(label).length * LABEL_CHAR_WIDTH + extra);
}

function snap(value) {
  return Math.round(value / GRID_STEP) * GRID_STEP;
}

function compactErdNetwork(nodes, edges) {
  if (nodes.length < 3 || edges.length === 0) return nodes;

  const byId = new Map(nodes.map(n => [String(n.id), { ...n }]));
  const springs = edges
    .map(e => {
      const from = String(e.from || e.sourceId);
      const to = String(e.to || e.targetId);
      if (!byId.has(from) || !byId.has(to)) return null;
      const labelReserve = e.label ? Math.min(220, labelRequiredPx(e.label, 96)) : 44;
      return { from, to, desiredLen: 300 + labelReserve, maxLen: 430 + labelReserve };
    })
    .filter(Boolean);

  const minPad = 68;
  const locked = new Set(nodes.filter(n => n.lockPos).map(n => String(n.id)));

  const move = (node, dx, dy) => {
    if (!node || locked.has(String(node.id))) return;
    node.x += dx;
    node.y += dy;
  };

  for (let iter = 0; iter < 44; iter++) {
    for (const edge of springs) {
      const a = byId.get(edge.from);
      const b = byId.get(edge.to);
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy) || 1;
      const target = dist > edge.maxLen
        ? edge.desiredLen
        : Math.max(edge.desiredLen * 0.72, Math.min(edge.desiredLen, dist));
      const force = (dist - target) * 0.055;
      const ux = dx / dist;
      const uy = dy / dist;
      move(a, ux * force, uy * force);
      move(b, -ux * force, -uy * force);
    }

    const arr = [...byId.values()];
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        const a = arr[i];
        const b = arr[j];
        const minX = ((a.w || getNodeDim(a).width) + (b.w || getNodeDim(b).width)) / 2 + minPad;
        const minY = ((a.h || getNodeDim(a).height) + (b.h || getNodeDim(b).height)) / 2 + minPad;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        if (Math.abs(dx) >= minX || Math.abs(dy) >= minY) continue;

        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
          dx = (i % 2 === 0 ? 1 : -1) * 20;
          dy = (j % 2 === 0 ? 1 : -1) * 20;
        }

        const overlapX = minX - Math.abs(dx);
        const overlapY = minY - Math.abs(dy);
        if (overlapX < overlapY) {
          const push = (overlapX / 2) + 2;
          const dir = dx >= 0 ? 1 : -1;
          move(a, -dir * push, 0);
          move(b, dir * push, 0);
        } else {
          const push = (overlapY / 2) + 2;
          const dir = dy >= 0 ? 1 : -1;
          move(a, 0, -dir * push);
          move(b, 0, dir * push);
        }
      }
    }
  }

  return nodes.map(n => {
    const compacted = byId.get(String(n.id));
    if (!compacted || n.lockPos) return n;
    return { ...n, x: snap(compacted.x), y: snap(compacted.y) };
  });
}

function boxesOverlap(a, b, pad = 24) {
  const aw = a.w || getNodeDim(a).width;
  const ah = a.h || getNodeDim(a).height;
  const bw = b.w || getNodeDim(b).width;
  const bh = b.h || getNodeDim(b).height;
  return Math.abs((a.x || 0) - (b.x || 0)) < (aw + bw) / 2 + pad
    && Math.abs((a.y || 0) - (b.y || 0)) < (ah + bh) / 2 + pad;
}

function canMoveTo(nodes, nodeId, nextY) {
  const candidate = nodes.find(n => String(n.id) === String(nodeId));
  if (!candidate || candidate.lockPos) return false;
  const moved = { ...candidate, y: nextY };
  return nodes.every(other => {
    if (String(other.id) === String(nodeId)) return true;
    return !boxesOverlap(moved, other);
  });
}

function canMoveXTo(nodes, nodeId, nextX) {
  const candidate = nodes.find(n => String(n.id) === String(nodeId));
  if (!candidate || candidate.lockPos) return false;
  const moved = { ...candidate, x: nextX };
  return nodes.every(other => {
    if (String(other.id) === String(nodeId)) return true;
    return !boxesOverlap(moved, other);
  });
}

function alignFlowCenters(nodes, edges) {
  if (nodes.length < 2 || edges.length === 0) return nodes;
  let result = nodes.map(n => ({ ...n }));
  const byId = () => new Map(result.map(n => [String(n.id), n]));
  const degree = new Map();
  edges.forEach(e => {
    const from = String(e.from || e.sourceId);
    const to = String(e.to || e.targetId);
    degree.set(from, (degree.get(from) || 0) + 1);
    degree.set(to, (degree.get(to) || 0) + 1);
  });

  for (let pass = 0; pass < 2; pass++) {
    const map = byId();
    const candidates = edges
      .map(e => {
        const from = String(e.from || e.sourceId);
        const to = String(e.to || e.targetId);
        const a = map.get(from);
        const b = map.get(to);
        if (!a || !b) return null;
        const dx = (b.x || 0) - (a.x || 0);
        const dy = (b.y || 0) - (a.y || 0);
        if (Math.abs(dx) < 120 || Math.abs(dy) > 120 || Math.abs(dx) < Math.abs(dy) * 1.4) return null;
        return { from, to, dy: Math.abs(dy), sourceDegree: degree.get(from) || 0, targetDegree: degree.get(to) || 0 };
      })
      .filter(Boolean)
      .sort((a, b) => b.dy - a.dy);

    candidates.forEach(edge => {
      const current = byId();
      const source = current.get(edge.from);
      const target = current.get(edge.to);
      if (!source || !target) return;
      const sourceY = snap(source.y || 0);
      const targetY = snap(target.y || 0);
      if (sourceY === targetY) return;

      const moveTargetFirst = edge.targetDegree <= edge.sourceDegree;
      const attempts = moveTargetFirst
        ? [{ id: edge.to, y: sourceY }, { id: edge.from, y: targetY }]
        : [{ id: edge.from, y: targetY }, { id: edge.to, y: sourceY }];

      const chosen = attempts.find(a => canMoveTo(result, a.id, a.y));
      if (!chosen) return;
      result = result.map(n => String(n.id) === String(chosen.id) ? { ...n, y: chosen.y } : n);
    });
  }

  return result;
}

function alignVisualRows(nodes, threshold = 90) {
  if (nodes.length < 3) return nodes;
  let result = nodes.map(n => ({ ...n }));
  const movable = result
    .filter(n => !n.lockPos)
    .sort((a, b) => (a.y || 0) - (b.y || 0));
  const clusters = [];

  movable.forEach(node => {
    const y = node.y || 0;
    const last = clusters[clusters.length - 1];
    if (!last || Math.abs(y - last.avgY) > threshold) {
      clusters.push({ nodes: [node], avgY: y });
      return;
    }
    last.nodes.push(node);
    last.avgY = last.nodes.reduce((sum, n) => sum + (n.y || 0), 0) / last.nodes.length;
  });

  clusters
    .filter(cluster => cluster.nodes.length >= 2)
    .forEach(cluster => {
      const sortedY = cluster.nodes.map(n => n.y || 0).sort((a, b) => a - b);
      const targetY = snap(sortedY[Math.floor(sortedY.length / 2)]);
      cluster.nodes
        .sort((a, b) => Math.abs((a.y || 0) - targetY) - Math.abs((b.y || 0) - targetY))
        .forEach(node => {
          if (canMoveTo(result, node.id, targetY)) {
            result = result.map(n => String(n.id) === String(node.id) ? { ...n, y: targetY } : n);
          }
        });
    });

  return result;
}

function alignVisualColumns(nodes, edges, {
  clusterThreshold = 120,
  edgeDxMax = 260,
  edgeDyMin = 100,
  edgeVerticalRatio = 0.45,
} = {}) {
  if (nodes.length < 3) return nodes;
  let result = nodes.map(n => ({ ...n }));

  edges
    .map(edge => {
      const from = String(edge.from || edge.sourceId);
      const to = String(edge.to || edge.targetId);
      const source = result.find(n => String(n.id) === from);
      const target = result.find(n => String(n.id) === to);
      if (!source || !target) return null;
      const dx = Math.abs((source.x || 0) - (target.x || 0));
      const dy = Math.abs((source.y || 0) - (target.y || 0));
      if (dy < edgeDyMin || dx > edgeDxMax || dy < dx * edgeVerticalRatio) return null;
      return { from, to, dx, dy };
    })
    .filter(Boolean)
    .sort((a, b) => a.dx - b.dx)
    .forEach(edge => {
      const source = result.find(n => String(n.id) === edge.from);
      const target = result.find(n => String(n.id) === edge.to);
      if (!source || !target) return;
      const sourceX = snap(source.x || 0);
      const targetX = snap(target.x || 0);
      if (sourceX === targetX) return;
      if (canMoveXTo(result, target.id, sourceX)) {
        result = result.map(n => String(n.id) === String(target.id) ? { ...n, x: sourceX } : n);
      } else if (canMoveXTo(result, source.id, targetX)) {
        result = result.map(n => String(n.id) === String(source.id) ? { ...n, x: targetX } : n);
      }
    });

  const movable = result
    .filter(n => !n.lockPos)
    .sort((a, b) => (a.x || 0) - (b.x || 0));
  const clusters = [];

  movable.forEach(node => {
    const x = node.x || 0;
    const last = clusters[clusters.length - 1];
    if (!last || Math.abs(x - last.avgX) > clusterThreshold) {
      clusters.push({ nodes: [node], avgX: x });
      return;
    }
    last.nodes.push(node);
    last.avgX = last.nodes.reduce((sum, n) => sum + (n.x || 0), 0) / last.nodes.length;
  });

  clusters
    .filter(cluster => cluster.nodes.length >= 2)
    .forEach(cluster => {
      const sortedX = cluster.nodes.map(n => n.x || 0).sort((a, b) => a - b);
      const targetX = snap(sortedX[Math.floor(sortedX.length / 2)]);
      cluster.nodes
        .sort((a, b) => Math.abs((a.x || 0) - targetX) - Math.abs((b.x || 0) - targetX))
        .forEach(node => {
          if (canMoveXTo(result, node.id, targetX)) {
            result = result.map(n => String(n.id) === String(node.id) ? { ...n, x: targetX } : n);
          }
        });
    });

  return result;
}

const alignErdRows = (nodes) => alignVisualRows(nodes, 90);
const alignErdColumns = (nodes, edges) => alignVisualColumns(nodes, edges);

function alignFlowchartGrid(nodes, edges) {
  let result = alignVisualRows(nodes, 70);
  result = alignVisualColumns(result, edges, {
    clusterThreshold: 85,
    edgeDxMax: 180,
    edgeDyMin: 120,
    edgeVerticalRatio: 0.75,
  });
  return result;
}

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

    // Reserve label room without letting captions become the dominant graph structure.
    if (e.label && e.label.length > 0 && dt !== 'sequence') {
       const reqPixels = labelRequiredPx(e.label, dt === 'flowchart' ? 34 : 88);
       const hopSpan = Math.ceil(reqPixels / MIN_GAP_MAIN);
       if (hopSpan > 1) {
           minlen = dt === 'flowchart' ? Math.min(2, hopSpan) : hopSpan;
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
  let result = nodes.map(n => {
     const nodeInfo = g.node(String(n.id));
     const shift = shiftMap[String(n.id)] || 0;
     
     let centerX = snap(nodeInfo.x + (isHorizontalFlow ? shift : 0));
     let centerY = snap(nodeInfo.y + (isHorizontalFlow ? 0 : shift));

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

  if (dt === 'erd') {
    result = compactErdNetwork(result, edges);
  }

  if ((dt === 'flowchart' || dt === 'erd') && isHorizontalFlow) {
    result = alignFlowCenters(result, edges);
  }

  if (dt === 'erd') {
    result = alignErdRows(result);
    result = alignErdColumns(result, edges);
  } else if (dt === 'flowchart') {
    result = alignFlowchartGrid(result, edges);
  }

  return result;
}
