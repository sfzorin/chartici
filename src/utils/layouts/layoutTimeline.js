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

  // Add any missed nodes (cycles or disconnected)
  nodes.forEach(n => {
    const id = String(n.id);
    if (!visited.has(id)) sorted.push(id);
  });

  const nodeMap = new Map(nodes.map(n => [String(n.id), n]));
  const maxDim = Math.max(...nodes.map(n => isHorizontal ? n.w : n.h));
  const maxCrossDim = Math.max(...nodes.map(n => isHorizontal ? n.h : n.w));
  const step = maxDim + GAP_MAIN;
  const crossOffset = maxCrossDim / 2 + GAP_CROSS;

  return sorted.map((id, i) => {
    const n = nodeMap.get(id);
    if (!n) return null;

    // Alternate above/below the baseline
    const sign = (i % 2 === 0) ? -1 : 1;

    if (isHorizontal) {
      return { ...n, x: i * step, y: sign * crossOffset };
    } else {
      return { ...n, x: sign * crossOffset, y: i * step };
    }
  }).filter(Boolean);
}


