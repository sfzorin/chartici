import { getDiagramRules } from '../diagramRules.js';
import { RoutingContext } from './RoutingContext.js';
import { getTrueBox, isBlockedPointCheck, isSegmentBlockedCheck, getNodePorts, getClipDist } from './geometry.js';
import { runAStar } from './astar.js';
import { generateSVGPaths } from './svgPaths.js';
import { GRID } from '../../diagram/canvas.js';
import { assignPorts } from './portAssigner.js';

import { DIAGRAM_SCHEMAS } from '../diagramSchemas.js';
import { getEngine } from '../../engines/index.js';
import { PATH_STYLE_REGISTRY } from '../../diagram/edges.js';
import { getRoutingPolicy } from './routingPolicy.js';

export function calculateAllPaths(edges, allNodes, config = {}, draggedNodeId = null, prevPaths = null) {
  const result = {};
  if (!edges || edges.length === 0) return result;
  const normalizedEdges = edges.map(edge => {
    const from = edge.from ?? edge.sourceId;
    const to = edge.to ?? edge.targetId;
    return {
      ...edge,
      from,
      to,
      sourceId: edge.sourceId ?? from,
      targetId: edge.targetId ?? to,
    };
  });

  const diagramType = (config.diagramType === 'org_chart' ? 'tree' : config.diagramType) || 'flowchart';
  const activeSchema = DIAGRAM_SCHEMAS[diagramType] || DIAGRAM_SCHEMAS.flowchart;
  const engine = getEngine(diagramType);
  const routingStyle = engine?.layout?.edgeStyle || 'orthogonal_astar';

  if (routingStyle === 'none') {
      return result; // Edges are hidden natively (e.g. Pie chart)
  }

  // Shared helper for straight/curved 2-point clip paths
  const isStraightStyle = routingStyle === 'straight' || routingStyle === 'curved';
  if (isStraightStyle) {
    const pathStyleDef = PATH_STYLE_REGISTRY[routingStyle] || PATH_STYLE_REGISTRY.straight;
    const curveStrength = pathStyleDef.curveStrength || 0;

    normalizedEdges.forEach(edge => {
      const fromId = edge.from;
      const toId = edge.to;
      const startNode = allNodes.find(n => n.id === fromId);
      const endNode = allNodes.find(n => n.id === toId);
      if (!startNode || !endNode) return;
      if (edge.style === 'invisible' || edge.logical || edge.isBlank) return;
      if (activeSchema?.engineManifest?.suppressSpineEdges && startNode.type === 'chevron' && endNode.type === 'chevron') return;

      const scx = startNode.x, scy = startNode.y;
      const ecx = endNode.x,   ecy = endNode.y;
      const dx = ecx - scx, dy = ecy - scy;
      const len = Math.sqrt(dx*dx + dy*dy);
      if (len < 1) return;
      const ux = dx/len, uy = dy/len;

      const startDist = getClipDist(startNode, scx, scy,  ux,  uy);
      const endDist   = getClipDist(endNode,   ecx, ecy, -ux, -uy);
      const sp = { x: scx + ux * startDist, y: scy + uy * startDist };
      const ep = { x: ecx - ux * endDist,   y: ecy - uy * endDist   };

      let pathD;
      if (curveStrength > 0) {
        const segLen = Math.hypot(ep.x - sp.x, ep.y - sp.y);
        // Amplitude scales with length, capped to prevent excessive curvature on long edges
        const curveCap = pathStyleDef.curveCap ?? 120;
        const amp = Math.min(segLen * curveStrength, curveCap);
        // Perpendicular direction (CCW): (-uy, ux)
        const px = -uy, py = ux;

        if (pathStyleDef.curveStyle === 'flow') {
          // S-curve: cp1 perpendicular CCW, cp2 perpendicular CW
          const cp1x = sp.x * 0.75 + ep.x * 0.25 + px * amp;
          const cp1y = sp.y * 0.75 + ep.y * 0.25 + py * amp;
          const cp2x = sp.x * 0.25 + ep.x * 0.75 - px * amp;
          const cp2y = sp.y * 0.25 + ep.y * 0.75 - py * amp;
          pathD = `M ${sp.x} ${sp.y} C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${ep.x} ${ep.y}`;
        } else {
          // Arc (default): both control points offset same direction — true chord arc
          const cp1x = sp.x * 0.67 + ep.x * 0.33 + px * amp;
          const cp1y = sp.y * 0.67 + ep.y * 0.33 + py * amp;
          const cp2x = sp.x * 0.33 + ep.x * 0.67 + px * amp;
          const cp2y = sp.y * 0.33 + ep.y * 0.67 + py * amp;
          pathD = `M ${sp.x} ${sp.y} C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${ep.x} ${ep.y}`;
        }
      } else {
        pathD = `M ${sp.x} ${sp.y} L ${ep.x} ${ep.y}`;
      }


      // textPathD: always L-R or B-T for readable labels
      const isNearVertical = Math.abs(sp.x - ep.x) < Math.abs(sp.y - ep.y);
      let textPathD;
      if (isNearVertical) {
        textPathD = sp.y <= ep.y ? `M ${sp.x} ${sp.y} L ${ep.x} ${ep.y}` : `M ${ep.x} ${ep.y} L ${sp.x} ${sp.y}`;
      } else {
        textPathD = sp.x <= ep.x ? `M ${sp.x} ${sp.y} L ${ep.x} ${ep.y}` : `M ${ep.x} ${ep.y} L ${sp.x} ${sp.y}`;
      }
      result[edge.id] = { pathD, textPathD, textPathLen: len, pts: [sp, ep] };
    });
    return result;
  }
  
  const { layout: layoutRules, routing: routingRules } = getDiagramRules(diagramType);
  const PADDING = routingRules.PADDING;
  const ctx = new RoutingContext(normalizedEdges, allNodes, false, draggedNodeId, routingRules, diagramType);
  ctx.usedEndPorts = new Map();
  ctx.usedStartPorts = new Map();
  ctx.usedPorts = new Map();

  // 1. Convert all nodes to bounding boxes (obstacles)
  allNodes.forEach(n => {
    const b = getTrueBox(n);
    ctx.nodeBoxes.set(n.id, b);
    if (n.type !== 'text' && n.type !== 'title') {
      ctx.obstacles.push({
        id: n.id,
        left: b.left - PADDING,
        right: b.right + PADDING,
        top: b.top - PADDING,
        bottom: b.bottom + PADDING,
        vLeft: b.left,
        vRight: b.right,
        vTop: b.top,
        vBottom: b.bottom
      });
    }
  });

  const edgeInfos = normalizedEdges.map(edge => {
    const startNode = allNodes.find(n => n.id === edge.from);
    const endNode = allNodes.find(n => n.id === edge.to);
    if (!startNode || !endNode) return null;
    
    // Ignore logical (invisible) links
    if (edge.style === 'invisible' || edge.logical || edge.isBlank) return null;
    
    // Hide implicit spines between chevrons on Timeline
    if (activeSchema?.engineManifest?.suppressSpineEdges && startNode.type === 'chevron' && endNode.type === 'chevron') return null;

    const startBox = ctx.nodeBoxes.get(startNode.id);
    const endBox = ctx.nodeBoxes.get(endNode.id);

    const dx = endBox.cx - startBox.cx;
    const dy = endBox.cy - startBox.cy;
    const dist = Math.abs(dx) + Math.abs(dy);
    
    let textSpaceReq = 0;
    if (edge.label && edge.label.length > 0) {
        textSpaceReq = edge.label.length * 8.4 + 40; // Approx 8.4px per char + 40px for arrows/padding buffer
    }

    return { edge, startNode, endNode, startBox, endBox, dist, textSpaceReq };
  }).filter(Boolean);

  edgeInfos.sort((a, b) => {
      if (a.dist !== b.dist) return a.dist - b.dist;
      // Group siblings (same from) together, but sort geometrically by target Y to prevent overlapping diagonals
      if (a.edge.from === b.edge.from) return a.endBox.cy - b.endBox.cy;
      if (a.edge.to === b.edge.to) return 0;
      return a.edge.from < b.edge.from ? -1 : 1;
  });

  // ─── Port Assignment (Phase 1) ─────────────────────────────
  const isHorizontalFlow = getEngine(diagramType)?.layout?.isHorizontalFlow ?? true;

  const portMap = assignPorts(
    edgeInfos.map(i => i.edge),
    allNodes,
    diagramType,
    isHorizontalFlow,
    ctx
  );

  // Global time budget: 1s total, fair split with carry-over
  const TOTAL_BUDGET_MS = 1000;
  const routingStartTime = performance.now();
  const perEdgeBudget = TOTAL_BUDGET_MS / Math.max(edgeInfos.length, 1);

  // ─── A* Routing (Phase 2) ─────────────────────────────────
  edgeInfos.forEach((info, idx) => {
    const { startBox, endBox, edge, startNode, endNode, textSpaceReq } = info;

    if (draggedNodeId) {
      if (edge.from === draggedNodeId || edge.to === draggedNodeId) {
        const pathD = `M ${startBox.cx} ${startBox.cy} L ${endBox.cx} ${endBox.cy}`;
        result[edge.id] = { pathD, textPathD: pathD };
        return;
      } else if (prevPaths && prevPaths[edge.id]) {
        result[edge.id] = prevPaths[edge.id];
        return;
      }
    }

    // Use pre-assigned ports from Phase 1
    const assigned = portMap.get(edge.id);
    const routingPolicy = getRoutingPolicy(diagramType);
    const penaltyFn = routingPolicy.portPenalty;
    const portOptions = { cardinalOnly: routingPolicy.cardinalOnly };
    let startPorts = assigned ? assigned.startPorts : getNodePorts(startNode, startBox, penaltyFn, portOptions);
    let endPorts = assigned ? assigned.endPorts : getNodePorts(endNode, endBox, penaltyFn, portOptions);


    if (edge.lineStyle === 'none') {
        const scx = startBox.cx;
        const scy = startBox.cy;
        const ecx = endBox.cx;
        const ecy = endBox.cy;
        
        const dx = ecx - scx, dy = ecy - scy;
        const len = Math.hypot(dx, dy);
        
        if (len < 1) {
            result[edge.id] = { pathD: '', textPathD: '', pts: [] };
            return;
        }
        
        const ux = dx/len, uy = dy/len;
        const startDist = getClipDist(startNode, scx, scy, ux, uy);
        const endDist = getClipDist(endNode, ecx, ecy, -ux, -uy);
        
        const sp = { x: scx + ux * startDist, y: scy + uy * startDist };
        const ep = { x: ecx - ux * endDist, y: ecy - uy * endDist };
        
        const straightPath = `M ${sp.x} ${sp.y} L ${ep.x} ${ep.y}`;
        result[edge.id] = { 
            pathD: straightPath, 
            textPathD: straightPath,
            textPathLen: Math.hypot(ep.x - sp.x, ep.y - sp.y),
            pts: [sp, ep]
        };
        return; // Bypass A* and avoid registering as obstacle
    }

    const fallbackTiers = GRID.routingTiers;

    let finalPts = null;
    let fallbackPts = null;
    let chosenStartPt = null;
    let chosenEndPt = null;
    let usedTier = -1;
    let timedOut = false;
    const edgeT0 = performance.now();

    // Compute deadline for this edge
    const fairDeadline = routingStartTime + perEdgeBudget * (idx + 1);
    const absoluteDeadline = Math.max(fairDeadline, performance.now() + 20);
    const globalDeadline = routingStartTime + TOTAL_BUDGET_MS;
    const deadlineMs = Math.min(absoluteDeadline, globalDeadline);

    // TRICK: On Timeline, "Chevron -> Event" routing often traps A* at the chevron's dense border because it lacks side ports.
    // The user confirmed "Event -> Chevron" routes fast and perfectly. 
    // We dynamically swap the A* routing direction and reverse the path returned to get perfect lines instantly!
    const startIsChevron = startNode.isTimelineSpine || startNode.type === 'chevron';
    const endIsChevron = endNode.isTimelineSpine || endNode.type === 'chevron';
    const isChevronToEvent = activeSchema?.engineManifest?.spineNodeType === 'chevron' && startIsChevron && !endIsChevron;
    
    const rStartPorts = isChevronToEvent ? endPorts : startPorts;
    const rEndPorts = isChevronToEvent ? startPorts : endPorts;
    const rStartNodeId = isChevronToEvent ? endNode.id : startNode.id;
    const rEndNodeId = isChevronToEvent ? startNode.id : endNode.id;

    for (let tierIdx = 0; tierIdx < fallbackTiers.length; tierIdx++) {
       const tier = fallbackTiers[tierIdx];
       const fullEdgeType = `${edge.lineStyle || 'solid'}-${edge.arrowType || edge.connectionType || 'target'}`;
       const res = runAStar(rStartPorts, rEndPorts, rStartNodeId, rEndNodeId, textSpaceReq, fullEdgeType, tier.gridStep, tier.allowOverlap, tier.allowCrossing, 0, ctx, deadlineMs, tier.ignorePadding);
       if (res && res.pts.length > 0) {
           if (res.timedOut) timedOut = true;
           if (res.isFallback) {
               fallbackPts = isChevronToEvent ? [...res.pts].reverse() : res.pts;
               if (usedTier < 0) usedTier = tierIdx;
           } else {
               finalPts = isChevronToEvent ? [...res.pts].reverse() : res.pts;
               chosenStartPt = isChevronToEvent ? res.trueEndPt : res.trueStartPt;
               chosenEndPt = isChevronToEvent ? res.trueStartPt : res.trueEndPt;
               usedTier = tierIdx;
               break;
           }
       }
    }

    if (!finalPts) {
       const portFallback = fallbackPts ? null : buildPortRespectingFallback(
         rStartPorts,
         rEndPorts,
         rStartNodeId,
         rEndNodeId,
         ctx,
         GRID.step
       );
       finalPts = fallbackPts || portFallback?.pts || [ { x: startBox.cx, y: startBox.cy }, { x: endBox.cx, y: endBox.cy } ];
       if (!fallbackPts && !portFallback) result[edge.id] = { isFallback: true };
       chosenStartPt = portFallback
         ? (isChevronToEvent ? portFallback.trueEndPt : portFallback.trueStartPt)
         : finalPts[0];
       chosenEndPt = portFallback
         ? (isChevronToEvent ? portFallback.trueStartPt : portFallback.trueEndPt)
         : finalPts[finalPts.length - 1];
       if (portFallback && isChevronToEvent) finalPts = [...finalPts].reverse();
    }

    reservePort(ctx, startNode.id, chosenStartPt, diagramType);
    reservePort(ctx, endNode.id, chosenEndPt, diagramType);

    const rawPts = finalPts;
    const cleanPts = [rawPts[0]];
    for (let i = 1; i < rawPts.length - 1; i++) {
      const prev = cleanPts[cleanPts.length - 1];
      const curr = rawPts[i];
      const next = rawPts[i+1];
      if ((prev.x === curr.x && curr.x === next.x) || (prev.y === curr.y && curr.y === next.y)) continue;
      cleanPts.push(curr);
    }
    cleanPts.push(rawPts[rawPts.length - 1]);

    for (let i = 0; i < cleanPts.length - 1; i++) {
       ctx.occupiedLines.push({ 
         x1: cleanPts[i].x, y1: cleanPts[i].y, 
         x2: cleanPts[i+1].x, y2: cleanPts[i+1].y,
         startNodeId: startNode.id,
         endNodeId: endNode.id,
         edgeId: edge.id,
         edgeType: `${edge.lineStyle || 'solid'}-${edge.arrowType || edge.connectionType || 'target'}`,
         routeOrder: idx,
         startPortKey: chosenStartPt ? `${chosenStartPt.x},${chosenStartPt.y}` : null,
         endPortKey: chosenEndPt ? `${chosenEndPt.x},${chosenEndPt.y}` : null
       });
       if (i > 0) {
           ctx.addTurn({
             x: cleanPts[i].x, y: cleanPts[i].y,
             edgeId: edge.id, startNodeId: startNode.id, endNodeId: endNode.id
          });
       }
    }

    let totalLength = 0;
    const segments = [];
    for (let i = 0; i < cleanPts.length - 1; i++) {
      const p1 = cleanPts[i];
      const p2 = cleanPts[i+1];
      const len = Math.abs(p2.x - p1.x) + Math.abs(p2.y - p1.y);
      segments.push({ p1, p2, len });
      totalLength += len;
    }

    const edgeMs = performance.now() - edgeT0;
    result[edge.id] = { 
        ...result[edge.id], 
        pts: cleanPts,
        usedTier,
        timedOut,
        routeMs: Math.round(edgeMs * 10) / 10,
        _genInfo: { cleanPts, chosenStartPt, chosenEndPt, totalLength, segments, routeOrder: idx }
    };
  });

  // Pass 2: Generate SVG Paths strictly after all occupiedLines are globally known
  ctx.edgePaths = result;
  edgeInfos.forEach(info => {
      const edge = info.edge;
      const data = result[edge.id];
      if (data && data._genInfo) {
          const { cleanPts, chosenStartPt, chosenEndPt, totalLength, segments, routeOrder } = data._genInfo;
          const paths = generateSVGPaths(cleanPts, edge.id, totalLength, segments, ctx, routeOrder);
          data.pathD = paths.pathD;
          data.textPathD = paths.textPathD;
          data.textPathLen = paths.textPathLen;
      }
  });

  edgeInfos.forEach(info => {
      const data = result[info.edge.id];
      if (data && data._genInfo) delete data._genInfo;
  });

  applyDecisionFanInGrouping(result, edgeInfos, diagramType);

  return result;
}

function applyDecisionFanInGrouping(result, edgeInfos, diagramType) {
  if (diagramType !== 'flowchart') return;

  const incoming = new Map();
  for (const info of edgeInfos) {
    if (info.endNode?.type !== 'rhombus') continue;
    if (!incoming.has(info.endNode.id)) incoming.set(info.endNode.id, []);
    incoming.get(info.endNode.id).push(info);
  }

  for (const [, infos] of incoming) {
    const buckets = new Map();
    for (const info of infos) {
      const key = edgeStyleKey(info.edge);
      if (!buckets.has(key)) buckets.set(key, { infos: [] });
      buckets.get(key).infos.push(info);
    }

    for (const bucket of buckets.values()) {
      if (bucket.infos.length < 2) continue;
      const endBox = bucket.infos[0].endBox;
      const dir = chooseDecisionFanInDir(bucket.infos, endBox);
      const entry = getBoxSidePoint(endBox, dir);
      const carrier = chooseFanInCarrier(bucket.infos, result, entry, dir);
      if (!carrier) continue;
      const merge = chooseFanInMergePoint(result[carrier.edge.id]?.pts, entry, dir, carrier.edge);

      bucket.infos.forEach(info => {
        const isCarrier = info.edge.id === carrier.edge.id;
        const pathData = buildGroupedFanInPath(result[info.edge.id]?.pts, entry, merge, dir, { isCarrier });
        result[info.edge.id] = {
          ...result[info.edge.id],
          ...pathData,
          groupedFanIn: true,
          fanInCarrier: isCarrier,
          suppressMarkerEnd: !isCarrier,
        };
      });
    }
  }
}

function chooseFanInCarrier(infos, result, entry, dir) {
  return infos.reduce((best, info) => {
    const pts = result[info.edge.id]?.pts || [];
    const score = scoreFanInCarrier(pts, entry, dir);
    if (!best || score < best.score) return { info, edge: info.edge, score };
    return best;
  }, null);
}

function scoreFanInCarrier(pts, entry, dir) {
  if (!Array.isArray(pts) || pts.length < 2) return Infinity;
  const sourcePts = pts.slice(0, -1);
  const last = sourcePts[sourcePts.length - 1];
  const dist = Math.abs(last.x - entry.x) + Math.abs(last.y - entry.y);
  const axisPenalty = isAlignedForDir(last, entry, dir) ? 0 : 10000;
  return axisPenalty + dist + pts.length * 12;
}

function chooseFanInMergePoint(carrierPts, entry, dir, edge) {
  const sourcePts = Array.isArray(carrierPts) && carrierPts.length >= 2
    ? carrierPts.slice(0, -1)
    : [];
  const last = sourcePts[sourcePts.length - 1];
  const minArrowGap = edgeHasEndMarker(edge) ? 44 : 18;
  const idealGap = 64;
  const maxGap = last ? Math.max(minArrowGap, Math.abs(last.x - entry.x) + Math.abs(last.y - entry.y) + 24) : idealGap;
  const gap = Math.min(idealGap, maxGap);
  if (dir === 'Left') return { x: entry.x - gap, y: entry.y };
  if (dir === 'Right') return { x: entry.x + gap, y: entry.y };
  if (dir === 'Top') return { x: entry.x, y: entry.y - gap };
  return { x: entry.x, y: entry.y + gap };
}

function edgeHasEndMarker(edge) {
  const type = edge?.connectionType || edge?.arrowType || 'target';
  return type !== 'none' && type !== 'reverse';
}

function buildPortRespectingFallback(startPorts, endPorts, startNodeId, endNodeId, ctx, gridStep) {
  const starts = filterPortsForFallback(startPorts, startNodeId, 'start', ctx);
  const ends = filterPortsForFallback(endPorts, endNodeId, 'end', ctx);
  if (starts.length === 0 || ends.length === 0) return null;

  let best = null;
  for (const startPort of starts) {
    for (const endPort of ends) {
      for (const pts of buildOrthogonalFallbackCandidates(startPort, endPort, gridStep)) {
        if (pathBlocked(pts, startNodeId, endNodeId, ctx)) continue;
        const score = pathLength(pts) + countBends(pts) * 180 + (startPort.penalty || 0) + (endPort.penalty || 0);
        if (!best || score < best.score) {
          best = {
            score,
            pts,
            trueStartPt: startPort.anchorPt || startPort.pt,
            trueEndPt: endPort.anchorPt || endPort.pt,
          };
        }
      }
    }
  }
  return best;
}

function filterPortsForFallback(ports, nodeId, role, ctx) {
  const routingPolicy = getRoutingPolicy(ctx?.diagramType);
  if (routingPolicy.allowPortReuse || !ctx?.usedPorts) return ports;
  const node = ctx.allNodes?.find(n => String(n.id) === String(nodeId));
  const isDecisionFanInTarget = role === 'end' && ctx.diagramType === 'flowchart' && node?.type === 'rhombus';
  if (isDecisionFanInTarget) return ports;

  const used = ctx.usedPorts.get(String(nodeId));
  if (!used) return ports;
  return ports.filter(port => !used.has(portKeyForFallback(port)));
}

function buildOrthogonalFallbackCandidates(startPort, endPort, gridStep) {
  const startStub = portStubPoint(startPort, gridStep);
  const endStub = portStubPoint(endPort, gridStep);
  const prefix = expandStartPort(startPort, startStub);
  const suffix = expandEndPort(endPort, endStub);
  const midA = { x: endStub.x, y: startStub.y };
  const midB = { x: startStub.x, y: endStub.y };
  return [
    cleanPointList([...prefix, midA, ...suffix]),
    cleanPointList([...prefix, midB, ...suffix]),
  ];
}

function expandStartPort(port, stub) {
  const anchors = Array.isArray(port.anchorPt) ? port.anchorPt : [port.anchorPt || port.pt];
  return cleanPointList([...anchors, port.pt, stub]);
}

function expandEndPort(port, stub) {
  const anchors = Array.isArray(port.anchorPt) ? port.anchorPt : [port.anchorPt || port.pt];
  return cleanPointList([stub, port.pt, ...anchors.slice().reverse()]);
}

function portStubPoint(port, gridStep) {
  return {
    x: port.pt.x + (port.axis === 'H' ? port.sign * gridStep : 0),
    y: port.pt.y + (port.axis === 'V' ? port.sign * gridStep : 0),
  };
}

function portKeyForFallback(port) {
  const point = Array.isArray(port.anchorPt) ? port.anchorPt[0] : (port.anchorPt || port.pt);
  return `${point.x},${point.y}`;
}

function pathBlocked(pts, startNodeId, endNodeId, ctx) {
  for (let i = 0; i < pts.length - 1; i++) {
    if (isSegmentBlockedCheck(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, startNodeId, endNodeId, false, ctx)) {
      return true;
    }
  }
  return false;
}

function pathLength(pts) {
  return pts.slice(1).reduce((sum, pt, index) => sum + Math.abs(pt.x - pts[index].x) + Math.abs(pt.y - pts[index].y), 0);
}

function countBends(pts) {
  let bends = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const prevH = pts[i].y === pts[i - 1].y;
    const nextH = pts[i + 1].y === pts[i].y;
    if (prevH !== nextH) bends++;
  }
  return bends;
}

function cleanPointList(pts) {
  const out = [];
  for (const pt of pts) {
    const prev = out[out.length - 1];
    if (!prev || Math.abs(prev.x - pt.x) > 0.01 || Math.abs(prev.y - pt.y) > 0.01) {
      out.push(pt);
    }
  }
  return out;
}

function edgeStyleKey(edge) {
  return [
    edge?.lineStyle || 'solid',
    edge?.connectionType || edge?.arrowType || 'target',
  ].join(':');
}

function getRelativeCardinal(dx, dy) {
  if (Math.abs(dx) >= Math.abs(dy)) return dx < 0 ? 'Left' : 'Right';
  return dy < 0 ? 'Top' : 'Bottom';
}

function chooseDecisionFanInDir(infos, endBox) {
  const leftInputs = infos.filter(info => info.startBox.cx < endBox.left - 20);
  if (leftInputs.length > 0) return 'Left';

  const rightInputs = infos.filter(info => info.startBox.cx > endBox.right + 20);
  if (rightInputs.length > 0) return 'Right';

  const avgSourceX = infos.reduce((sum, info) => sum + info.startBox.cx, 0) / infos.length;
  const avgSourceY = infos.reduce((sum, info) => sum + info.startBox.cy, 0) / infos.length;
  return getRelativeCardinal(avgSourceX - endBox.cx, avgSourceY - endBox.cy);
}

function getBoxSidePoint(box, dir) {
  if (dir === 'Left') return { x: box.left, y: box.cy };
  if (dir === 'Right') return { x: box.right, y: box.cy };
  if (dir === 'Top') return { x: box.cx, y: box.top };
  return { x: box.cx, y: box.bottom };
}

function buildGroupedFanInPath(existingPts, entry, merge, dir, options = {}) {
  const isCarrier = options.isCarrier !== false;
  let sourcePts = Array.isArray(existingPts) && existingPts.length >= 2
    ? existingPts.slice(0, -1)
    : [];
  if (isCarrier) sourcePts = trimCarrierToOrthogonalMerge(sourcePts, merge, entry, dir);
  const last = sourcePts[sourcePts.length - 1];
  const bend = last
    ? ((dir === 'Left' || dir === 'Right')
      ? { x: merge.x, y: last.y }
      : { x: last.x, y: merge.y })
    : null;

  const pts = isCarrier
    ? [...sourcePts, merge, entry].filter(Boolean)
    : [...sourcePts, bend, merge].filter(Boolean);
  const cleanPts = [];
  appendOrthogonalCleanPoints(cleanPts, pts);

  const pathD = cleanPts.map((pt, index) => `${index === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`).join(' ');
  const textPathLen = cleanPts.slice(1).reduce((sum, pt, index) => {
    const prev = cleanPts[index];
    return sum + Math.abs(pt.x - prev.x) + Math.abs(pt.y - prev.y);
  }, 0);

  return { pathD, textPathD: pathD, textPathLen, pts: cleanPts };
}

function trimCarrierToOrthogonalMerge(sourcePts, merge, entry, dir) {
  const pts = [...sourcePts];
  while (pts.length > 0) {
    const last = pts[pts.length - 1];
    if (!pointBetweenMergeAndEntry(last, merge, entry, dir)) break;
    pts.pop();
  }
  const last = pts[pts.length - 1];
  if (last && !isAlignedForDir(last, merge, dir)) {
    pts.push((dir === 'Left' || dir === 'Right')
      ? { x: merge.x, y: last.y }
      : { x: last.x, y: merge.y });
  }
  return pts;
}

function pointBetweenMergeAndEntry(point, merge, entry, dir) {
  if (dir === 'Left' || dir === 'Right') {
    if (Math.abs(point.y - entry.y) > 0.01) return false;
    const minX = Math.min(merge.x, entry.x);
    const maxX = Math.max(merge.x, entry.x);
    return point.x > minX && point.x < maxX;
  }
  if (Math.abs(point.x - entry.x) > 0.01) return false;
  const minY = Math.min(merge.y, entry.y);
  const maxY = Math.max(merge.y, entry.y);
  return point.y > minY && point.y < maxY;
}

function isAlignedForDir(point, entry, dir) {
  return (dir === 'Left' || dir === 'Right')
    ? Math.abs(point.y - entry.y) < 0.01
    : Math.abs(point.x - entry.x) < 0.01;
}

function appendCleanPoints(out, pts) {
  for (const pt of pts) {
    const prev = out[out.length - 1];
    if (!prev || Math.abs(prev.x - pt.x) > 0.01 || Math.abs(prev.y - pt.y) > 0.01) {
      out.push(pt);
    }
  }
}

function appendOrthogonalCleanPoints(out, pts) {
  for (const pt of pts) {
    const prev = out[out.length - 1];
    if (prev && Math.abs(prev.x - pt.x) > 0.01 && Math.abs(prev.y - pt.y) > 0.01) {
      appendCleanPoints(out, [{ x: pt.x, y: prev.y }]);
    }
    appendCleanPoints(out, [pt]);
  }
}

function reservePort(ctx, nodeId, point, diagramType) {
  if (!point || getRoutingPolicy(diagramType).allowPortReuse) return;
  const keyPoint = Array.isArray(point) ? point[0] : point;
  if (!keyPoint) return;
  const key = String(nodeId);
  let used = ctx.usedPorts.get(key);
  if (!used) {
    used = new Set();
    ctx.usedPorts.set(key, used);
  }
  used.add(`${keyPoint.x},${keyPoint.y}`);
}
