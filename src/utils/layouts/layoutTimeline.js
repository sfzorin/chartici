import { getNodeDim } from '../../diagram/nodes.jsx';

const asId = (value) => String(value ?? '');

function getEdgeFrom(edge) {
  return asId(edge.from || edge.sourceId);
}

function getEdgeTo(edge) {
  return asId(edge.to || edge.targetId);
}

function extractTimelineOrder(label) {
  const text = String(label || '');
  const fullYear = text.match(/\b(1[5-9]\d{2}|20\d{2}|21\d{2})\b/);
  if (fullYear) return Number(fullYear[1]);

  const decade = text.match(/\b(1[5-9]\d|20\d|21\d)0s\b/i);
  if (decade) return Number(`${decade[1]}0`);

  const century = text.match(/\b(\d{1,2})(?:st|nd|rd|th)\s+century\b/i);
  if (century) return (Number(century[1]) - 1) * 100;

  return null;
}

function orderSpineNodes(spineNodes, edges) {
  const spineIds = new Set(spineNodes.map(n => asId(n.id)));
  const originalIndex = new Map(spineNodes.map((n, index) => [asId(n.id), index]));

  const spineEdges = edges
    .map(edge => ({ from: getEdgeFrom(edge), to: getEdgeTo(edge) }))
    .filter(edge => spineIds.has(edge.from) && spineIds.has(edge.to));

  if (spineEdges.length > 0) {
    const adj = new Map(spineNodes.map(n => [asId(n.id), []]));
    const inDeg = new Map(spineNodes.map(n => [asId(n.id), 0]));

    spineEdges.forEach(edge => {
      adj.get(edge.from).push(edge.to);
      inDeg.set(edge.to, (inDeg.get(edge.to) || 0) + 1);
    });

    const queue = [...spineIds]
      .filter(id => (inDeg.get(id) || 0) === 0)
      .sort((a, b) => (originalIndex.get(a) || 0) - (originalIndex.get(b) || 0));
    const orderedIds = [];

    while (queue.length > 0) {
      const id = queue.shift();
      orderedIds.push(id);
      (adj.get(id) || []).forEach(next => {
        inDeg.set(next, (inDeg.get(next) || 0) - 1);
        if ((inDeg.get(next) || 0) === 0) {
          queue.push(next);
          queue.sort((a, b) => (originalIndex.get(a) || 0) - (originalIndex.get(b) || 0));
        }
      });
    }

    if (orderedIds.length === spineNodes.length) {
      const byId = new Map(spineNodes.map(n => [asId(n.id), n]));
      return orderedIds.map(id => byId.get(id));
    }
  }

  const dated = spineNodes
    .map(node => ({ node, order: extractTimelineOrder(node.label) }))
    .filter(item => item.order !== null);

  if (dated.length >= 2 && dated.length === spineNodes.length) {
    return [...spineNodes].sort((a, b) => {
      const dateA = extractTimelineOrder(a.label);
      const dateB = extractTimelineOrder(b.label);
      if (dateA !== dateB) return dateA - dateB;
      return (originalIndex.get(asId(a.id)) || 0) - (originalIndex.get(asId(b.id)) || 0);
    });
  }

  return [...spineNodes];
}

export function layoutTimeline(nodes, edges, layoutRules, isHorizontal = true) {
  if (nodes.length === 0) return [];

  const nodeMap = new Map(nodes.map(n => [String(n.id), n]));
  const explicitSpine = nodes.filter(n => n.type === 'chevron' || n.isTimelineSpine);
  const spineNodes = explicitSpine.length > 0 ? explicitSpine : nodes;
  const spineIds = new Set(spineNodes.map(n => asId(n.id)));
  const orderedSpine = orderSpineNodes(spineNodes, edges);
  const orderedSpineIds = orderedSpine.map(n => asId(n.id));
  
  const result = [];
  const spineXMap = {};
  
  let currentLeftEdge = 0;

  // 1. Place the timeline spine independently from event links.
  orderedSpine.forEach((n) => {
    if (!n) return;
    
    const size = n.size || 'M';
    const deltaMap = {
        'S': 12,
        'M': 10,
        'L': 25
    };
    const delta = deltaMap[size] || 10;
    
    const rawDim = getNodeDim(n);
    const hBase = isHorizontal ? rawDim.height : rawDim.width;
    const wBase = isHorizontal ? rawDim.width : rawDim.height;
    
    // Центр привязан строго к базовой расчетной ширине, в то время как DiagramNode будет "свешивать" шеврон за пределы ширины
    const centerX = currentLeftEdge + wBase / 2;
    
    // Передаем реальный сдвиг левого края дальше 
    currentLeftEdge = centerX - wBase / 2;
    spineXMap[asId(n.id)] = centerX;
    
    result.push({
      ...n,
      isTimelineSpine: true, // Automagically flag timeline spine, renderer will show as chevron
      timelineDelta: delta, // Inject exact delta for daylight calculation in DiagramNode!
      w: wBase,
      h: hBase,
      x: isHorizontal ? centerX : 0,
      y: isHorizontal ? 0 : centerX
    });
    
    let gapForStep = 20; // Default for Micro step S/M
    
    const cut = hBase * 0.25;
    const baseGapLevel = 40; // Hardcoded fixed gap between chevrons
    
    // Find the next perfect 20px grid snap that satisfies the minimum base gap requirement
    const requiredTotalStep = wBase + cut + baseGapLevel;
    const snappedTotalStep = Math.ceil(requiredTotalStep / 20) * 20;
    gapForStep = snappedTotalStep - (wBase + cut);

    // Шаг до следующего узла...
    currentLeftEdge += wBase + cut + gapForStep;
  });

  const firstSpineId = orderedSpineIds[0];
  const eventRefs = new Map();

  nodes.forEach(n => {
    const id = asId(n.id);
    if (spineIds.has(id)) return;
    if (n.spineId && spineIds.has(asId(n.spineId))) {
      eventRefs.set(id, asId(n.spineId));
    }
  });

  edges.forEach(edge => {
    const from = getEdgeFrom(edge);
    const to = getEdgeTo(edge);
    if (spineIds.has(from) && !spineIds.has(to)) eventRefs.set(to, from);
    if (!spineIds.has(from) && spineIds.has(to)) eventRefs.set(from, to);
  });

  // If old data has process-only timeline nodes, keep them readable instead of collapsing.
  if (explicitSpine.length === 0) {
    nodes.forEach(n => {
      const id = asId(n.id);
      if (!eventRefs.has(id)) eventRefs.set(id, id);
    });
  }

  const topEdgesMap = new Map();
  const bottomEdgesMap = new Map();
  let nextGlobalSide = 'top';

  nodes.forEach(n => {
    const u = asId(n.id);
    if (spineIds.has(u)) return;
    if (!n) return;

    const ref = eventRefs.get(u) || firstSpineId;
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

    if (topEdgesMap.get(ref) === undefined) topEdgesMap.set(ref, initialEdge);
    if (bottomEdgesMap.get(ref) === undefined) bottomEdgesMap.set(ref, initialEdge);

    // Alternate popouts globally: Top -> Bottom -> Top -> Bottom
    const isTop = nextGlobalSide === 'top';
    nextGlobalSide = isTop ? 'bottom' : 'top'; // Toggle for the next event!
    
    let yOffset = 0;

    if (isTop) {
      let topEdge = topEdgesMap.get(ref);
      if (topEdge > initialEdge) {
        topEdge += stackGap; // Add 40px gap for the second+ row
      }
      yOffset = -(topEdge + (evH / 2));
      topEdgesMap.set(ref, topEdge + evH); // Advance the graphical outer edge
    } else {
      let bottomEdge = bottomEdgesMap.get(ref);
      if (bottomEdge > initialEdge) {
        bottomEdge += stackGap;
      }
      yOffset = (bottomEdge + (evH / 2));
      bottomEdgesMap.set(ref, bottomEdge + evH);
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

