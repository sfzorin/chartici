import { getNodeDim } from '../../diagram/nodes.jsx';

export function layoutRadial(nodes, edges, layoutRules) {
  if (nodes.length === 0) return [];
  if (nodes.length === 1) return [{ ...nodes[0], x: 0, y: 0 }];

  const GAP = Math.max(layoutRules.MIN_GAP_X, layoutRules.MIN_GAP_Y);
  const nodeMap = new Map(nodes.map(n => [String(n.id), n]));

  // Build adjacency (undirected)
  const adj = new Map();
  nodes.forEach(n => adj.set(String(n.id), new Set()));
  edges.forEach(e => {
    const from = String(e.from || e.sourceId);
    const to = String(e.to || e.targetId);
    if (adj.has(from) && adj.has(to)) {
      adj.get(from).add(to);
      adj.get(to).add(from);
    }
  });

  // Find root: node with max degree
  let rootId = String(nodes[0].id);
  let maxDeg = 0;
  adj.forEach((neighbors, id) => {
    if (neighbors.size > maxDeg) { maxDeg = neighbors.size; rootId = id; }
  });

  const placed = new Map(); // id -> { x, y }
  placed.set(rootId, { x: 0, y: 0 });

  // Level 1: direct neighbors of root
  const level1 = [...adj.get(rootId)];
  const maxNodeW = Math.max(...nodes.map(n => n.w || 120));
  const maxNodeH = Math.max(...nodes.map(n => n.h || 60));
  const avgDim = (maxNodeW + maxNodeH) / 2;

  const nodeDims = new Map();
  nodes.forEach(n => nodeDims.set(String(n.id), { w: n.w || maxNodeW, h: n.h || maxNodeH }));

  // Depth-weighted subtree size: children=1.0, grandchildren=0.3, deeper=0.1
  const depthWeights = [0.4, 0.1, 0.05];
  const subtreeWeight = new Map();

  level1.forEach(id => {
    let weight = 0;
    const visited = new Set([rootId, ...level1]);
    let currentLevel = [id];
    visited.add(id);
    let depth = 0;
    while (currentLevel.length > 0) {
      const nextLevel = [];
      const dw = depthWeights[Math.min(depth, depthWeights.length - 1)];
      for (const cur of currentLevel) {
        for (const nb of adj.get(cur)) {
          if (!visited.has(nb)) {
            visited.add(nb);
            weight += dw;
            nextLevel.push(nb);
          }
        }
      }
      currentLevel = nextLevel;
      depth++;
    }
    subtreeWeight.set(id, weight);
  });

  // Proportional angle allocation
  const weights = level1.map(id => 1 + (subtreeWeight.get(id) || 0));
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  // Compute dynamic R1 to exactly prevent overlaps symmetrically
  let R1 = 0;
  // 1. Root clearance
  const rootDim = nodeDims.get(rootId) || { w: maxNodeW, h: maxNodeH };
  level1.forEach(id => {
      const dim = nodeDims.get(id) || { w: maxNodeW, h: maxNodeH };
      const reqDist = Math.max(dim.w/2 + rootDim.w/2, dim.h/2 + rootDim.h/2) + GAP;
      if (reqDist > R1) R1 = reqDist;
  });

  // 2. Neighbor clearance
  if (level1.length > 1) {
      for (let i = 0; i < level1.length; i++) {
          const idA = level1[i];
          const idB = level1[(i + 1) % level1.length];
          const dimA = nodeDims.get(idA) || { w: maxNodeW, h: maxNodeH };
          const dimB = nodeDims.get(idB) || { w: maxNodeW, h: maxNodeH };
          
          const sectorA = (weights[i] / totalWeight) * 2 * Math.PI;
          const sectorB = (weights[(i + 1) % level1.length] / totalWeight) * 2 * Math.PI;
          const angDiff = (sectorA + sectorB) / 2;

          if (angDiff < Math.PI) {
               const neededDist = Math.max(dimA.w + dimB.w, dimA.h + dimB.h) / 2 + GAP * 0.8;
               const requiredR1 = neededDist / (2 * Math.sin(angDiff / 2));
               if (requiredR1 > R1) R1 = requiredR1;
          }
      }
  }

  let cumAngle = -Math.PI / 2;
  level1.forEach((id, i) => {
    const sectorSize = (weights[i] / totalWeight) * 2 * Math.PI;
    const angle = cumAngle + sectorSize / 2;
    placed.set(id, {
      x: R1 * Math.cos(angle),
      y: R1 * Math.sin(angle)
    });
    cumAngle += sectorSize;
  });

  // Level 2+: BFS from level 1 with depth-dependent arc spans
  // depth 0 = children of root (level 1), depth 1 = grandchildren, etc.
  const maxArcs = [Math.PI * 0.9, Math.PI * 0.55, Math.PI * 0.4]; // ±45°, ±30°, ±22°
  const perChild = [0.5, 0.4, 0.35]; // radians per child at each depth
  const nodeDepth = new Map();
  level1.forEach(id => nodeDepth.set(id, 0));

  const queue = [...level1.map(id => ({ id, depth: 0 }))];
  while (queue.length > 0) {
    const { id: parentId, depth } = queue.shift();
    const parentPos = placed.get(parentId);
    const children = [...adj.get(parentId)].filter(id => !placed.has(id));
    if (children.length === 0) continue;

    const childDepth = depth + 1;
    const di = Math.min(childDepth - 1, maxArcs.length - 1);
    const parentAngle = Math.atan2(parentPos.y, parentPos.x);
    const arcSpan = Math.min(maxArcs[di], children.length * perChild[di]);
    
    // Dynamic child radius
    let childR = 0;
    const pDim = nodeDims.get(parentId) || { w: maxNodeW, h: maxNodeH };
    children.forEach(id => {
       const cDim = nodeDims.get(id) || { w: maxNodeW, h: maxNodeH };
       const reqR = Math.max(pDim.w/2 + cDim.w/2, pDim.h/2 + cDim.h/2) + GAP * 0.8;
       if (reqR > childR) childR = reqR;
    });
    
    if (children.length > 1) {
        for (let i = 0; i < children.length - 1; i++) {
           const idA = children[i], idB = children[i+1];
           const dimA = nodeDims.get(idA) || { w: maxNodeW, h: maxNodeH };
           const dimB = nodeDims.get(idB) || { w: maxNodeW, h: maxNodeH };
           const neededSpan = Math.max(dimA.w + dimB.w, dimA.h + dimB.h) / 2 + GAP * 0.5;
           const angDiff = arcSpan / (children.length - 1);
           if (angDiff < Math.PI) {
               const reqR = neededSpan / (2 * Math.sin(angDiff / 2));
               if (reqR > childR) childR = reqR;
           }
        }
    }

    children.forEach((id, i) => {
      const t = children.length === 1 ? 0 : (i / (children.length - 1) - 0.5);
      const angle = parentAngle + t * arcSpan;
      placed.set(id, {
        x: parentPos.x + childR * Math.cos(angle),
        y: parentPos.y + childR * Math.sin(angle)
      });
      nodeDepth.set(id, childDepth);
      queue.push({ id, depth: childDepth });
    });
  }

  // Orphans: not connected at all — place in outer ring
  nodes.forEach(n => {
    const id = String(n.id);
    if (!placed.has(id)) {
      const orphanAngle = placed.size * 0.8;
      const orphanR = R1 * 1.6;
      placed.set(id, {
        x: orphanR * Math.cos(orphanAngle),
        y: orphanR * Math.sin(orphanAngle)
      });
    }
  });

  // ──── Collision Resolution ────
  // Push overlapping nodes apart iteratively (only for anomalies, main symmetry is already guaranteed via dynamic radii)
  const nodeIds = [...placed.keys()];

  for (let iter = 0; iter < 10; iter++) {
    let hadOverlap = false;
    for (let a = 0; a < nodeIds.length; a++) {
      for (let b = a + 1; b < nodeIds.length; b++) {
        const idA = nodeIds[a], idB = nodeIds[b];
        if (idA === rootId || idB === rootId) continue; // don't push root
        const posA = placed.get(idA), posB = placed.get(idB);
        const dimA = nodeDims.get(idA) || { w: maxNodeW, h: maxNodeH };
        const dimB = nodeDims.get(idB) || { w: maxNodeW, h: maxNodeH };
        
        // Tighter collision boxes (tolerate nodes being closer together)
        const padX = (dimA.w + dimB.w) / 2 + GAP * 0.3;
        const padY = (dimA.h + dimB.h) / 2 + GAP * 0.3;
        const dx = posB.x - posA.x;
        const dy = posB.y - posA.y;
        const overlapX = padX - Math.abs(dx);
        const overlapY = padY - Math.abs(dy);

        if (overlapX > 0 && overlapY > 0) {
          hadOverlap = true;
          // Push apart along the radial direction from root
          const angA = Math.atan2(posA.y, posA.x);
          const angB = Math.atan2(posB.y, posB.x);
          // Gentler push to avoid blasting the cluster apart
          const push = Math.min(overlapX, overlapY) * 0.35;
          
          // Push outward from root
          const distA = Math.hypot(posA.x, posA.y);
          const distB = Math.hypot(posB.x, posB.y);
          const closer = distA < distB ? idA : idB;
          const farther = closer === idA ? idB : idA;
          const fPos = placed.get(farther);
          const fAng = Math.atan2(fPos.y, fPos.x);
          
          // Push farther node outward + slightly tangentially
          const tangent = angB > angA ? 1 : -1;
          placed.set(farther, {
            x: fPos.x + Math.cos(fAng) * push + Math.cos(fAng + Math.PI/2) * push * 0.3 * tangent,
            y: fPos.y + Math.sin(fAng) * push + Math.sin(fAng + Math.PI/2) * push * 0.3 * tangent
          });
        }
      }
    }
    if (!hadOverlap) break;
  }

  return nodes.map(n => {
    const pos = placed.get(String(n.id)) || { x: 0, y: 0 };
    return { ...n, x: pos.x, y: pos.y };
  });
}

