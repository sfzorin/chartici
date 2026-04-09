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
  
  // Sort spine nodes strictly by depth, and FILTER out non-rectangular nodes!
  const nodeMap = new Map(nodes.map(n => [String(n.id), n]));
  
  let rectSpineSet = new Set();
  
  // Find forced spine nodes (chevrons)
  const chevronIds = nodes.filter(n => n.type === 'chevron').map(n => String(n.id));
  
  if (chevronIds.length > 0) {
      // If the user or AI explicitly used chevrons, THEY are the spine!
      chevronIds.forEach(id => rectSpineSet.add(id));
  } else {
      // Fallback to Longest Path calculation for process nodes
      spineSet.forEach(u => {
        const n = nodeMap.get(u);
        if (!n) return;
        const isCurved = n.type === 'oval' || n.type === 'circle' || n.type === 'decision' || n.type === 'rhombus' || n.type === 'text' || n.type === 'title';
        if (!isCurved) {
            rectSpineSet.add(u);
        }
      });
      // Fallback: if totally empty, just use the original set
      if (rectSpineSet.size === 0 && spineSet.size > 0) rectSpineSet = new Set(spineSet);
  }

  const spineNodesTemp = [];
  sorted.forEach(u => {
    if (rectSpineSet.has(u)) spineNodesTemp.push(u);
  });
  
  spineNodesTemp.sort((a, b) => {
      // Sort primarily by depth (topological)
      if (depth[a] !== depth[b]) return depth[a] - depth[b];
      // Fallback to visual X coordinate if isolated/no links
      const na = nodeMap.get(a);
      const nb = nodeMap.get(b);
      return (na.x || 0) - (nb.x || 0);
  });

  const result = [];
  const spineXMap = {};
  
  let currentLeftEdge = 0;
  const getGroupId = (n) => n.groupId || n.group || null;

  // 3. Place Spine Nodes (Force to Chevron)
  spineNodesTemp.forEach((u, i) => {
    const n = nodeMap.get(u);
    if (!n) return;
    
    const size = n.size || 'M';
    const deltaMap = {
        'XS': 15,
        'S': 12,
        'M': 10,
        'L': 25,
        'XL': 20
    };
    const delta = deltaMap[size] || 10;
    
    const rawDim = getNodeDim(n);
    const hBase = isHorizontal ? rawDim.height : rawDim.width;
    const wBase = isHorizontal ? rawDim.width : rawDim.height;
    
    // Центр привязан строго к базовой расчетной ширине, в то время как DiagramNode будет "свешивать" шеврон за пределы ширины
    const centerX = currentLeftEdge + wBase / 2;
    
    // Передаем реальный сдвиг левого края дальше 
    currentLeftEdge = centerX - wBase / 2;
    spineXMap[u] = centerX;
    
    result.push({
      ...n,
      isTimelineSpine: true, // Automagically flag timeline spine, renderer will show as chevron
      timelineDelta: delta, // Inject exact delta for daylight calculation in DiagramNode!
      w: wBase,
      h: hBase,
      x: isHorizontal ? centerX : 0,
      y: isHorizontal ? 0 : centerX
    });
    
    let gapForStep = 20; // Default for Micro step XS/S/M
    
    let isSameGroup = false;
    if (i < spineNodesTemp.length - 1) {
       const nextId = spineNodesTemp[i+1];
       const nextN = nodeMap.get(nextId);
       if (nextN) {
           const g1 = getGroupId(n);
           const g2 = getGroupId(nextN);
           if (g1 && g2 && g1 === g2) {
               isSameGroup = true;
           }
       }
    }
    
    // Подгоняем микро и макро зазоры так, чтобы (wBase + cut + gap) всегда давало кратное 20!
    // XS: 80 + 10 = 90.   +30 = 120 (Micro), +50 = 140 (Macro)
    // S:  120 + 15 = 135. +25 = 160 (Micro), +45 = 180 (Macro)
    // M:  160 + 20 = 180. +20 = 200 (Micro), +40 = 220 (Macro)
    // L:  240 + 30 = 270. +50 = 320 (Micro), +90 = 360 (Macro)
    // XL: 320 + 40 = 360. +40 = 400 (Micro), +80 = 440 (Macro)
    const microGapMap = { 'XS': 30, 'S': 25, 'M': 20, 'L': 50, 'XL': 40 };
    const macroGapMap = { 'XS': 50, 'S': 45, 'M': 40, 'L': 90, 'XL': 80 };
    
    if (isSameGroup) {
        gapForStep = microGapMap[size] || 20;
    } else {
        gapForStep = macroGapMap[size] || 40;
    }

    // Шаг до следующего узла...
    const cut = hBase * 0.25;
    currentLeftEdge += wBase + cut + gapForStep;
  });

  // 4. Place Bubble Nodes
  const spineRef = {};
  nodes.forEach(n => {
    if (rectSpineSet.has(String(n.id))) spineRef[String(n.id)] = String(n.id);
  });

  // Inherit spine reference top-down (for outgoing events)
  sorted.forEach(u => {
    if (!spineRef[u] && parent[u]) {
      spineRef[u] = spineRef[parent[u]];
    }
  });
  
  // Inherit spine reference bottom-up (for incoming events pointing into the timeline)
  for (let i = sorted.length - 1; i >= 0; i--) {
    const u = sorted[i];
    if (!spineRef[u]) {
      for (const v of (adj[u] || [])) {
        if (spineRef[v]) {
          spineRef[u] = spineRef[v];
          break;
        }
      }
    }
  }

  const topEdgesMap = {};
  const bottomEdgesMap = {};
  let nextGlobalSide = 'top';

  sorted.forEach(u => {
    if (rectSpineSet.has(u)) return;
    const n = nodeMap.get(u);
    if (!n) return;

    const ref = spineRef[u] || spineNodesTemp[0]; // fallback to first spine node
    const baseX = spineXMap[ref] || 0;
    
    // Calculate bubble gap based on specific chevron size
    const refNode = nodeMap.get(ref);
    const refDim = getNodeDim(refNode);
    const spineH = isHorizontal ? refDim.height : refDim.width;
    const spineW = isHorizontal ? refDim.width : refDim.height;
    // Exact mathematical formula derived from optical balance:
    // The user visually perfectly aligned M size at exactly 140px (spineW - 20).
    const nDim = getNodeDim(n);
    const evH = isHorizontal ? nDim.height : nDim.width;
    
    // User rule: "Расстояние от событий до шеврона".
    // Пользователь уточнил, что длина коннектора (Daylight) должна быть равна высоте шеврона (spineH - ширине самой ленты).
    const daylight = spineH;
    const initialEdge = (spineH / 2) + daylight;
    
    // Пользователь запросил жестко зафиксировать этот зазор на 40 пикселей между событиями всегда
    const stackGap = 40; 

    if (topEdgesMap[ref] === undefined) topEdgesMap[ref] = initialEdge;
    if (bottomEdgesMap[ref] === undefined) bottomEdgesMap[ref] = initialEdge;

    // Alternate popouts globally: Top -> Bottom -> Top -> Bottom
    const isTop = nextGlobalSide === 'top';
    nextGlobalSide = isTop ? 'bottom' : 'top'; // Toggle for the next event!
    
    let yOffset = 0;

    if (isTop) {
      if (topEdgesMap[ref] > initialEdge) {
        topEdgesMap[ref] += stackGap; // Add 40px gap for the second+ row
      }
      yOffset = -(topEdgesMap[ref] + (evH / 2));
      topEdgesMap[ref] += evH; // Advance the graphical outer edge
    } else {
      if (bottomEdgesMap[ref] > initialEdge) {
        bottomEdgesMap[ref] += stackGap;
      }
      yOffset = (bottomEdgesMap[ref] + (evH / 2));
      bottomEdgesMap[ref] += evH;
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


