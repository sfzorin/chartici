import { getDiagramRules } from '../diagramRules.js';
import { RoutingContext } from './RoutingContext.js';
import { getTrueBox, isBlockedPointCheck, isSegmentBlockedCheck, getNodePorts, getClipDist } from './geometry.js';
import { runAStar } from './astar.js';
import { generateSVGPaths } from './svgPaths.js';
import { GRID } from '../../diagram/canvas.js';
import { assignPorts } from './portAssigner.js';
import { routeFlowchartNegotiated } from './flowchartRouter.js';
import {
  routeErdDeterministic,
  routeSequenceDeterministic,
  routeTreeDeterministic,
} from './deterministicRouters.js';

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
        const labelPad = diagramType === 'flowchart' ? 24 : 40;
        textSpaceReq = edge.label.length * 8.4 + labelPad; // Approx 8.4px per char + marker/padding buffer
    }

    return { edge, startNode, endNode, startBox, endBox, dist, textSpaceReq };
  }).filter(Boolean);

  if (diagramType === 'flowchart' && config.flowchartRouter !== 'astar') {
    return routeFlowchartNegotiated(edgeInfos, allNodes, routingRules);
  }
  if (diagramType === 'sequence' && config.sequenceRouter !== 'astar') {
    return routeSequenceDeterministic(edgeInfos, allNodes, routingRules);
  }
  if ((diagramType === 'tree' || diagramType === 'org_chart') && config.treeRouter !== 'astar') {
    return routeTreeDeterministic(edgeInfos, allNodes, routingRules);
  }
  if (diagramType === 'erd' && config.erdRouter !== 'astar') {
    return routeErdDeterministic(edgeInfos, allNodes, routingRules);
  }

  const outDegree = new Map();
  const inDegree = new Map();
  edgeInfos.forEach(info => {
    outDegree.set(String(info.edge.from), (outDegree.get(String(info.edge.from)) || 0) + 1);
    inDegree.set(String(info.edge.to), (inDegree.get(String(info.edge.to)) || 0) + 1);
  });

  edgeInfos.sort((a, b) => {
      if (diagramType === 'flowchart') {
        const directA = isLocalAlignedFlowEdge(a) ? 1 : 0;
        const directB = isLocalAlignedFlowEdge(b) ? 1 : 0;
        if (directA !== directB) return directB - directA;
        if (a.dist !== b.dist) return a.dist - b.dist;
        const fanA = Math.max(outDegree.get(String(a.edge.from)) || 0, inDegree.get(String(a.edge.to)) || 0);
        const fanB = Math.max(outDegree.get(String(b.edge.from)) || 0, inDegree.get(String(b.edge.to)) || 0);
        if (fanA !== fanB) return fanB - fanA;
        if (a.dist !== b.dist) return b.dist - a.dist;
      }
      // For strict no-port-reuse routing, reserve ports for the harder sibling first.
      // A short sibling can usually take an offset port; a long one can become a huge detour.
      if (a.edge.from === b.edge.from) {
        if (a.dist !== b.dist) return b.dist - a.dist;
        return a.endBox.cy - b.endBox.cy;
      }
      if (a.edge.to === b.edge.to) {
        if (a.dist !== b.dist) return b.dist - a.dist;
        return a.startBox.cy - b.startBox.cy;
      }
      if (a.dist !== b.dist) return a.dist - b.dist;
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
    if (routingPolicy.sidePortsOnly && !assigned) {
      startPorts = startPorts.filter(port => port.axis === 'H' && !port.isDiagonal);
      endPorts = endPorts.filter(port => port.axis === 'H' && !port.isDiagonal);
    }


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
    let lastRejectedReason = null;
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
           const rawRoutedPts = isChevronToEvent ? [...res.pts].reverse() : res.pts;
           const routedPts = diagramType === 'flowchart' ? simplifyCollinearPath(rawRoutedPts) : rawRoutedPts;
           const quality = validateRouteCandidate(routedPts, edge, startNode.id, endNode.id, textSpaceReq, ctx);
           if (!quality.valid) {
             lastRejectedReason = quality.reason;
             continue;
           }
           if (res.timedOut) timedOut = true;
           if (res.isFallback) {
               if (diagramType === 'flowchart') continue;
               fallbackPts = routedPts;
               if (usedTier < 0) usedTier = tierIdx;
           } else {
               finalPts = routedPts;
               chosenStartPt = isChevronToEvent ? res.trueEndPt : res.trueStartPt;
               chosenEndPt = isChevronToEvent ? res.trueStartPt : res.trueEndPt;
               usedTier = tierIdx;
               break;
           }
       }
    }

    if (!finalPts) {
       if (diagramType === 'flowchart') {
         result[edge.id] = buildCenterLineFallback(startBox, endBox, lastRejectedReason || 'no-strict-route');
         return;
       }
       const portFallback = fallbackPts ? null : buildPortRespectingFallback(
         rStartPorts,
         rEndPorts,
         rStartNodeId,
         rEndNodeId,
         edge,
         ctx,
         GRID.step,
         textSpaceReq
       );
       const relaxedPortFallback = null;
       const relaxedPortRoute = null;
       const boxPortFallback = (!fallbackPts && !portFallback && diagramType === 'flowchart')
         ? buildBoxPortFallback(startBox, endBox, startNode.id, endNode.id, edge, ctx, GRID.step, textSpaceReq)
         : null;
       const nodeCleanFallback = null;
       const centerFallback = (!fallbackPts && !portFallback && diagramType !== 'flowchart')
         ? buildCenterOrthogonalFallback(startBox, endBox, GRID.step)
         : null;
       const emergencyFallback = centerFallback || (diagramType !== 'flowchart' ? buildCenterOrthogonalFallback(startBox, endBox, GRID.step) : null);
       finalPts = fallbackPts || portFallback?.pts || relaxedPortFallback?.pts || relaxedPortRoute?.pts || boxPortFallback?.pts || nodeCleanFallback?.pts || emergencyFallback || [];
       const emergencyQuality = validateRouteCandidate(emergencyFallback, edge, startNode.id, endNode.id, textSpaceReq, ctx);
       if (!fallbackPts && !portFallback && !relaxedPortFallback && !relaxedPortRoute && !boxPortFallback && !nodeCleanFallback && !emergencyQuality.valid) result[edge.id] = { isFallback: true };
       chosenStartPt = portFallback
         ? (isChevronToEvent ? portFallback.trueEndPt : portFallback.trueStartPt)
         : relaxedPortFallback
           ? (isChevronToEvent ? relaxedPortFallback.trueEndPt : relaxedPortFallback.trueStartPt)
         : relaxedPortRoute
           ? (isChevronToEvent ? relaxedPortRoute.trueEndPt : relaxedPortRoute.trueStartPt)
          : boxPortFallback
            ? boxPortFallback.trueStartPt
          : nodeCleanFallback
            ? nodeCleanFallback.trueStartPt
           : finalPts[0];
       chosenEndPt = portFallback
         ? (isChevronToEvent ? portFallback.trueStartPt : portFallback.trueEndPt)
         : relaxedPortFallback
           ? (isChevronToEvent ? relaxedPortFallback.trueStartPt : relaxedPortFallback.trueEndPt)
         : relaxedPortRoute
           ? (isChevronToEvent ? relaxedPortRoute.trueStartPt : relaxedPortRoute.trueEndPt)
          : boxPortFallback
            ? boxPortFallback.trueEndPt
          : nodeCleanFallback
            ? nodeCleanFallback.trueEndPt
           : finalPts[finalPts.length - 1];
       if (portFallback && isChevronToEvent) finalPts = [...finalPts].reverse();
       if (relaxedPortFallback && isChevronToEvent) finalPts = [...finalPts].reverse();
       if (relaxedPortRoute && isChevronToEvent) finalPts = [...finalPts].reverse();
    }

    reservePort(ctx, startNode.id, chosenStartPt, diagramType);
    reservePort(ctx, endNode.id, chosenEndPt, diagramType);

    if (!finalPts || finalPts.length < 2) {
      result[edge.id] = diagramType === 'flowchart'
        ? buildCenterLineFallback(startBox, endBox, 'empty-route')
        : { isFallback: true, pts: [], pathD: '', textPathD: '', textPathLen: 0 };
      return;
    }

    if (diagramType === 'flowchart') {
      finalPts = repairForeignNodeZoneCrossings(finalPts, edge, startNode.id, endNode.id, textSpaceReq, ctx, GRID.step);
      const finalQuality = validateRouteCandidate(finalPts, edge, startNode.id, endNode.id, textSpaceReq, ctx);
      if (!finalQuality.valid) {
        result[edge.id] = buildCenterLineFallback(startBox, endBox, finalQuality.reason);
        return;
      }
    }

    const rawPts = finalPts;
    const cleanPts = [rawPts[0]];
    const preserveStartStub = edgeHasStartMarker(edge);
    const preserveEndStub = edgeHasEndMarker(edge);
    for (let i = 1; i < rawPts.length - 1; i++) {
      const prev = cleanPts[cleanPts.length - 1];
      const curr = rawPts[i];
      const next = rawPts[i+1];
      const isProtectedTerminalStub = (preserveStartStub && i === 1) || (preserveEndStub && i === rawPts.length - 2);
      if (!isProtectedTerminalStub && ((prev.x === curr.x && curr.x === next.x) || (prev.y === curr.y && curr.y === next.y))) continue;
      cleanPts.push(curr);
    }
    cleanPts.push(rawPts[rawPts.length - 1]);
    normalizeSequenceTerminalStubs(cleanPts, edge, diagramType, GRID.step);

    for (let i = 0; i < cleanPts.length - 1; i++) {
       const isStartTerminalSegment = i === 0;
       const isEndTerminalSegment = i === cleanPts.length - 2;
       ctx.occupiedLines.push({ 
         x1: cleanPts[i].x, y1: cleanPts[i].y, 
         x2: cleanPts[i+1].x, y2: cleanPts[i+1].y,
         startNodeId: startNode.id,
         endNodeId: endNode.id,
         edgeId: edge.id,
         edgeType: `${edge.lineStyle || 'solid'}-${edge.arrowType || edge.connectionType || 'target'}`,
         routeOrder: idx,
         startPortKey: chosenStartPt ? `${chosenStartPt.x},${chosenStartPt.y}` : null,
         endPortKey: chosenEndPt ? `${chosenEndPt.x},${chosenEndPt.y}` : null,
         protectedArrow: (isStartTerminalSegment && preserveStartStub) || (isEndTerminalSegment && preserveEndStub)
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

function isLocalAlignedFlowEdge(info) {
  const sameRow = Math.abs(info.startBox.cy - info.endBox.cy) < 1;
  const sameColumn = Math.abs(info.startBox.cx - info.endBox.cx) < 1;
  return (sameRow || sameColumn) && info.dist <= 380;
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

      const proposed = new Map();
      bucket.infos.forEach(info => {
        const isCarrier = info.edge.id === carrier.edge.id;
        const pathData = buildGroupedFanInPath(result[info.edge.id]?.pts, entry, merge, dir, { isCarrier });
        proposed.set(info.edge.id, { info, isCarrier, pathData });
      });

      if (!groupedFanInIsClean(result, proposed)) continue;

      bucket.infos.forEach(info => {
        const proposedPath = proposed.get(info.edge.id);
        if (!proposedPath) return;
        result[info.edge.id] = {
          ...result[info.edge.id],
          ...proposedPath.pathData,
          groupedFanIn: true,
          fanInCarrier: proposedPath.isCarrier,
          suppressMarkerEnd: !proposedPath.isCarrier,
        };
      });
    }
  }
}

function groupedFanInIsClean(result, proposed) {
  const groupedIds = new Set(proposed.keys());
  const outsideSegments = [];

  Object.entries(result).forEach(([edgeId, data]) => {
    if (groupedIds.has(edgeId)) return;
    outsideSegments.push(...segmentsFromPts(data?.pts || [], edgeId));
  });

  for (const [edgeId, item] of proposed.entries()) {
    const pts = item.pathData?.pts || [];
    for (let i = 1; i < pts.length - 1; i++) {
      const bend = pts[i];
      if (outsideSegments.some(segment => pointOnSegmentInterior(bend, segment))) return false;
    }
    for (const segment of segmentsFromPts(pts, edgeId)) {
      if (outsideSegments.some(outside => segmentsOverlapLine(segment.a, segment.b, {
        x1: outside.a.x,
        y1: outside.a.y,
        x2: outside.b.x,
        y2: outside.b.y,
      }))) return false;
    }
  }

  return true;
}

function segmentsFromPts(pts, edgeId) {
  const segments = [];
  for (let i = 0; i < pts.length - 1; i++) {
    segments.push({
      edgeId,
      a: pts[i],
      b: pts[i + 1],
      x1: pts[i].x,
      y1: pts[i].y,
      x2: pts[i + 1].x,
      y2: pts[i + 1].y,
    });
  }
  return segments;
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

function edgeHasStartMarker(edge) {
  const type = edge?.connectionType || edge?.arrowType || 'target';
  return type === 'reverse' || type === 'both';
}

function normalizeSequenceTerminalStubs(pts, edge, diagramType, gridStep) {
  if (diagramType !== 'sequence' || !Array.isArray(pts) || pts.length < 4) return;
  normalizeSequenceStubAtStart(pts, terminalStubLength(edge, 'start', gridStep));
  normalizeSequenceStubAtEnd(pts, terminalStubLength(edge, 'end', gridStep));
}

function normalizeSequenceStubAtStart(pts, desiredLen) {
  const first = pts[0];
  const stub = pts[1];
  const next = pts[2];
  if (!first || !stub || !next) return;
  if (Math.abs(first.y - stub.y) > 0.01 || Math.abs(stub.x - next.x) > 0.01) return;
  const sign = Math.sign(stub.x - first.x);
  if (!sign) return;
  const currentLen = Math.abs(stub.x - first.x);
  if (currentLen <= desiredLen) return;
  const oldX = stub.x;
  stub.x = first.x + sign * desiredLen;
  if (Math.abs(next.x - oldX) < 0.01) next.x = stub.x;
}

function normalizeSequenceStubAtEnd(pts, desiredLen) {
  const last = pts[pts.length - 1];
  const stub = pts[pts.length - 2];
  const prev = pts[pts.length - 3];
  if (!last || !stub || !prev) return;
  if (Math.abs(stub.y - last.y) > 0.01 || Math.abs(prev.x - stub.x) > 0.01) return;
  const sign = Math.sign(last.x - stub.x);
  if (!sign) return;
  const currentLen = Math.abs(last.x - stub.x);
  if (currentLen <= desiredLen) return;
  const oldX = stub.x;
  stub.x = last.x - sign * desiredLen;
  if (Math.abs(prev.x - oldX) < 0.01) prev.x = stub.x;
}

function buildPortRespectingFallback(startPorts, endPorts, startNodeId, endNodeId, edge, ctx, gridStep, textSpaceReq = 0) {
  const starts = filterPortsForFallback(startPorts, startNodeId, 'start', ctx);
  const ends = filterPortsForFallback(endPorts, endNodeId, 'end', ctx);
  if (starts.length === 0 || ends.length === 0) return null;

  const startStubLen = terminalStubLength(edge, 'start', gridStep);
  const endStubLen = terminalStubLength(edge, 'end', gridStep);
  let best = null;
  for (const startPort of starts) {
    for (const endPort of ends) {
      for (const pts of buildOrthogonalFallbackCandidates(startPort, endPort, gridStep, startStubLen, endStubLen)) {
        const blocked = ctx?.diagramType === 'flowchart'
          ? pathBlockedExceptTerminalClips(pts, startNodeId, endNodeId, ctx)
          : pathBlocked(pts, startNodeId, endNodeId, ctx);
        if (blocked) continue;
        const quality = validateRouteCandidate(pts, edge, startNodeId, endNodeId, textSpaceReq, ctx);
        if (!quality.valid) continue;
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

function findRelaxedFlowchartRoute(startPorts, endPorts, startNodeId, endNodeId, edge, textSpaceReq, fallbackTiers, routingCtx, validationCtx) {
  const fullEdgeType = `${edge.lineStyle || 'solid'}-${edge.arrowType || edge.connectionType || 'target'}`;
  const deadlineMs = performance.now() + 80;

  for (const tier of fallbackTiers) {
    const res = runAStar(
      startPorts,
      endPorts,
      startNodeId,
      endNodeId,
      textSpaceReq,
      fullEdgeType,
      tier.gridStep,
      tier.allowOverlap,
      tier.allowCrossing,
      0,
      routingCtx,
      deadlineMs,
      tier.ignorePadding
    );
    if (!res?.pts?.length) continue;
    const quality = validateRouteCandidate(res.pts, edge, startNodeId, endNodeId, textSpaceReq, validationCtx);
    if (!quality.valid) continue;
    return res;
  }

  return null;
}

function buildBoxPortFallback(startBox, endBox, startNodeId, endNodeId, edge, ctx, gridStep, textSpaceReq = 0) {
  const startPorts = boxCardinalPorts(startBox);
  const endPorts = boxCardinalPorts(endBox);
  return buildPortRespectingFallback(startPorts, endPorts, startNodeId, endNodeId, edge, ctx, gridStep, textSpaceReq);
}

function boxCardinalPorts(box) {
  return [
    { pt: { x: box.left, y: box.cy }, anchorPt: { x: box.left, y: box.cy }, axis: 'H', sign: -1, dir: 'Left', penalty: 30 },
    { pt: { x: box.right, y: box.cy }, anchorPt: { x: box.right, y: box.cy }, axis: 'H', sign: 1, dir: 'Right', penalty: 0 },
    { pt: { x: box.cx, y: box.top }, anchorPt: { x: box.cx, y: box.top }, axis: 'V', sign: -1, dir: 'Top', penalty: 30 },
    { pt: { x: box.cx, y: box.bottom }, anchorPt: { x: box.cx, y: box.bottom }, axis: 'V', sign: 1, dir: 'Bottom', penalty: 30 },
  ];
}

function validateRouteCandidate(pts, edge, startNodeId, endNodeId, textSpaceReq, ctx) {
  if (!Array.isArray(pts) || pts.length < 2) return { valid: false, reason: 'empty' };
  if (ctx?.diagramType !== 'flowchart') return { valid: true };
  if (!isOrthogonalPath(pts)) return { valid: false, reason: 'diagonal' };
  if (pathBlockedExceptTerminalClips(pts, startNodeId, endNodeId, ctx)) return { valid: false, reason: 'node-crossing' };
  if (hasForbiddenFlowchartCorner(pts, ctx)) return { valid: false, reason: 'corner-kiss' };
  if (hasSegmentThroughForeignTurn(pts, edge?.id, ctx)) return { valid: false, reason: 'segment-through-turn' };
  if (hasForbiddenFlowchartLineContact(pts, edge, ctx)) return { valid: false, reason: 'line-contact' };
  if (hasForbiddenFlowchartCrossing(pts, edge?.id, ctx)) return { valid: false, reason: 'line-crossing' };
  if (textSpaceReq > 0 && !hasClearLabelSegment(pts, edge?.id, textSpaceReq, ctx)) {
    return { valid: false, reason: 'label-space' };
  }
  return { valid: true };
}

function repairForeignNodeZoneCrossings(pts, edge, startNodeId, endNodeId, textSpaceReq, ctx, gridStep) {
  let current = cleanPointList(pts || []);
  for (let attempt = 0; attempt < 8; attempt++) {
    const crossing = findForeignNodeZoneCrossing(current, startNodeId, endNodeId, ctx);
    if (!crossing) return current;

    const repaired = buildObstacleDoglegRepair(current, crossing, edge, startNodeId, endNodeId, textSpaceReq, ctx, gridStep);
    if (!repaired) return current;
    current = repaired;
  }
  return current;
}

function findForeignNodeZoneCrossing(pts, startNodeId, endNodeId, ctx) {
  if (!Array.isArray(pts) || pts.length < 2 || !ctx?.obstacles) return null;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    for (const obstacle of ctx.obstacles) {
      if (String(obstacle.id) === String(startNodeId) || String(obstacle.id) === String(endNodeId)) continue;
      if (segmentCrossesObstacleZone(a, b, obstacle)) {
        return { index: i, obstacle };
      }
    }
  }
  return null;
}

function segmentCrossesObstacleZone(a, b, obstacle) {
  if (Math.abs(a.y - b.y) < 0.01) {
    const minX = Math.min(a.x, b.x);
    const maxX = Math.max(a.x, b.x);
    return a.y > obstacle.top && a.y < obstacle.bottom && Math.max(minX, obstacle.left) < Math.min(maxX, obstacle.right);
  }
  if (Math.abs(a.x - b.x) < 0.01) {
    const minY = Math.min(a.y, b.y);
    const maxY = Math.max(a.y, b.y);
    return a.x > obstacle.left && a.x < obstacle.right && Math.max(minY, obstacle.top) < Math.min(maxY, obstacle.bottom);
  }
  return true;
}

function pointInsideObstacleZone(point, obstacle) {
  return point.x > obstacle.left && point.x < obstacle.right && point.y > obstacle.top && point.y < obstacle.bottom;
}

function buildObstacleDoglegRepair(pts, crossing, edge, startNodeId, endNodeId, textSpaceReq, ctx, gridStep) {
  const { index, obstacle } = crossing;
  const fromIndex = index;
  const through = pts[index + 1];
  let toIndex = pointInsideObstacleZone(through, obstacle) && index + 2 < pts.length ? index + 2 : index + 1;
  while (toIndex + 1 < pts.length && pointInsideAnyForeignObstacleZone(pts[toIndex], startNodeId, endNodeId, ctx)) {
    toIndex += 1;
  }
  let a = pts[fromIndex];
  let c = pts[toIndex];
  let prefix = pts.slice(0, fromIndex);
  let suffix = pts.slice(toIndex + 1);

  if (fromIndex === 0) {
    const startStub = ownTerminalStubPoint(pts[0], startNodeId, 'start', ctx, gridStep, edge);
    if (startStub) {
      prefix = [pts[0]];
      a = startStub;
    }
  }
  if (toIndex === pts.length - 1) {
    const endStub = ownTerminalStubPoint(pts[pts.length - 1], endNodeId, 'end', ctx, gridStep, edge);
    if (endStub) {
      c = endStub;
      suffix = [pts[pts.length - 1]];
    }
  }

  const lanes = [
    { axis: 'x', value: snapToGrid(obstacle.left - gridStep, gridStep) },
    { axis: 'x', value: snapToGrid(obstacle.right + gridStep, gridStep) },
    { axis: 'y', value: snapToGrid(obstacle.top - gridStep, gridStep) },
    { axis: 'y', value: snapToGrid(obstacle.bottom + gridStep, gridStep) },
  ];

  let best = null;
  for (const lane of lanes) {
    const patch = lane.axis === 'x'
      ? cleanPointList([a, { x: lane.value, y: a.y }, { x: lane.value, y: c.y }, c])
      : cleanPointList([a, { x: a.x, y: lane.value }, { x: c.x, y: lane.value }, c]);
    const candidate = cleanPointList([...prefix, ...patch, ...suffix]);
    if (!isOrthogonalPath(candidate)) continue;
    if (pathBlockedExceptTerminalClips(candidate, startNodeId, endNodeId, ctx)) continue;
    const score = pathLength(candidate) + countBends(candidate) * 120;
    if (!best || score < best.score) best = { pts: candidate, score };
  }

  return best?.pts || null;
}

function pointInsideAnyForeignObstacleZone(point, startNodeId, endNodeId, ctx) {
  return (ctx?.obstacles || []).some(obstacle => {
    if (String(obstacle.id) === String(startNodeId) || String(obstacle.id) === String(endNodeId)) return false;
    return pointInsideObstacleZone(point, obstacle);
  });
}

function ownTerminalStubPoint(port, nodeId, role, ctx, gridStep, edge) {
  const obstacle = (ctx?.obstacles || []).find(o => String(o.id) === String(nodeId));
  if (!obstacle || !port) return null;
  const stubLen = terminalStubLength(edge, role, gridStep);
  const margin = 0.01;
  if (Math.abs(port.x - obstacle.vLeft) < margin && port.y >= obstacle.vTop - margin && port.y <= obstacle.vBottom + margin) {
    return { x: port.x - stubLen, y: port.y };
  }
  if (Math.abs(port.x - obstacle.vRight) < margin && port.y >= obstacle.vTop - margin && port.y <= obstacle.vBottom + margin) {
    return { x: port.x + stubLen, y: port.y };
  }
  if (Math.abs(port.y - obstacle.vTop) < margin && port.x >= obstacle.vLeft - margin && port.x <= obstacle.vRight + margin) {
    return { x: port.x, y: port.y - stubLen };
  }
  if (Math.abs(port.y - obstacle.vBottom) < margin && port.x >= obstacle.vLeft - margin && port.x <= obstacle.vRight + margin) {
    return { x: port.x, y: port.y + stubLen };
  }
  return null;
}

function snapToGrid(value, gridStep) {
  return Math.round(value / gridStep) * gridStep;
}

function isOrthogonalPath(pts) {
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if (Math.abs(a.x - b.x) > 0.01 && Math.abs(a.y - b.y) > 0.01) return false;
  }
  return true;
}

function hasForbiddenFlowchartCorner(pts, ctx) {
  for (let i = 1; i < pts.length - 1; i++) {
    const point = pts[i];
    for (const turn of ctx.occupiedTurns) {
      if (samePoint(point, turn)) return true;
    }
    for (const line of ctx.occupiedLines) {
      if (pointOnSegmentInterior(point, line)) return true;
    }
  }
  return false;
}

function hasForbiddenFlowchartLineContact(pts, edge, ctx) {
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    for (const line of ctx.occupiedLines) {
      if (line.edgeId === edge?.id) continue;
      if (canMergeDecisionFanIn(edge, line, ctx)) continue;
      if (segmentsOverlapLine(a, b, line)) return true;
    }
  }
  return false;
}

function hasForbiddenFlowchartCrossing(pts, edgeId, ctx) {
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    for (const line of ctx.occupiedLines) {
      if (line.edgeId === edgeId) continue;
      if (segmentsCrossLineInterior(a, b, line)) return true;
    }
  }
  return false;
}

function hasSegmentThroughForeignTurn(pts, edgeId, ctx) {
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    for (const turn of ctx.occupiedTurns) {
      if (turn.edgeId === edgeId) continue;
      if (pointOnPathSegmentInterior(turn, a, b)) return true;
    }
  }
  return false;
}

function segmentsCrossLineInterior(a, b, line) {
  const segH = Math.abs(a.y - b.y) < 0.01;
  const lineH = line.y1 === line.y2;
  if (segH === lineH) return false;

  const margin = 0.5;
  if (segH) {
    const minX = Math.min(a.x, b.x);
    const maxX = Math.max(a.x, b.x);
    const lMinY = Math.min(line.y1, line.y2);
    const lMaxY = Math.max(line.y1, line.y2);
    return line.x1 > minX + margin
      && line.x1 < maxX - margin
      && a.y > lMinY + margin
      && a.y < lMaxY - margin;
  }

  const minY = Math.min(a.y, b.y);
  const maxY = Math.max(a.y, b.y);
  const lMinX = Math.min(line.x1, line.x2);
  const lMaxX = Math.max(line.x1, line.x2);
  return line.y1 > minY + margin
    && line.y1 < maxY - margin
    && a.x > lMinX + margin
    && a.x < lMaxX - margin;
}

function hasClearLabelSegment(pts, edgeId, textSpaceReq, ctx) {
  const required = Math.max(36, textSpaceReq);
  const jumpPad = 20;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const len = Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
    if (len <= 0) continue;
    if (segmentHasParallelOverlap(a, b, edgeId, ctx)) continue;

    const cuts = [0, len];
    for (const line of ctx.occupiedLines) {
      if (line.edgeId === edgeId) continue;
      const distance = crossingDistanceAlongSegment(a, b, line);
      if (distance === null) continue;
      cuts.push(Math.max(0, distance - jumpPad), Math.min(len, distance + jumpPad));
    }

    cuts.sort((x, y) => x - y);
    for (let j = 0; j < cuts.length - 1; j++) {
      if (cuts[j + 1] - cuts[j] >= required) return true;
    }
  }
  return false;
}

function samePoint(a, b) {
  return Math.abs(a.x - b.x) < 0.01 && Math.abs(a.y - b.y) < 0.01;
}

function pointOnSegmentInterior(point, line) {
  const margin = 0.5;
  if (line.y1 === line.y2 && Math.abs(point.y - line.y1) < 0.01) {
    const minX = Math.min(line.x1, line.x2);
    const maxX = Math.max(line.x1, line.x2);
    return point.x > minX + margin && point.x < maxX - margin;
  }
  if (line.x1 === line.x2 && Math.abs(point.x - line.x1) < 0.01) {
    const minY = Math.min(line.y1, line.y2);
    const maxY = Math.max(line.y1, line.y2);
    return point.y > minY + margin && point.y < maxY - margin;
  }
  return false;
}

function pointOnPathSegmentInterior(point, a, b) {
  const margin = 0.5;
  if (Math.abs(a.y - b.y) < 0.01 && Math.abs(point.y - a.y) < 0.01) {
    const minX = Math.min(a.x, b.x);
    const maxX = Math.max(a.x, b.x);
    return point.x > minX + margin && point.x < maxX - margin;
  }
  if (Math.abs(a.x - b.x) < 0.01 && Math.abs(point.x - a.x) < 0.01) {
    const minY = Math.min(a.y, b.y);
    const maxY = Math.max(a.y, b.y);
    return point.y > minY + margin && point.y < maxY - margin;
  }
  return false;
}

function segmentsOverlapLine(a, b, line) {
  const segH = Math.abs(a.y - b.y) < 0.01;
  const lineH = line.y1 === line.y2;
  if (segH !== lineH) return false;
  if (segH) {
    if (Math.abs(a.y - line.y1) > 0.01) return false;
    return rangeOverlapLength(a.x, b.x, line.x1, line.x2) > 0.5;
  }
  if (Math.abs(a.x - line.x1) > 0.01) return false;
  return rangeOverlapLength(a.y, b.y, line.y1, line.y2) > 0.5;
}

function segmentHasParallelOverlap(a, b, edgeId, ctx) {
  return ctx.occupiedLines.some(line => line.edgeId !== edgeId && segmentsOverlapLine(a, b, line));
}

function canMergeDecisionFanIn(edge, line, ctx) {
  if (!edge || !line || ctx?.diagramType !== 'flowchart') return false;
  const edgeTarget = String(edge.to ?? edge.targetId ?? '');
  if (!edgeTarget || edgeTarget !== String(line.endNodeId)) return false;
  const targetNode = ctx.allNodes?.find(node => String(node.id) === edgeTarget);
  return targetNode?.type === 'rhombus';
}

function crossingDistanceAlongSegment(a, b, line) {
  const segH = Math.abs(a.y - b.y) < 0.01;
  const lineH = line.y1 === line.y2;
  if (segH === lineH) return null;
  if (segH) {
    const minX = Math.min(a.x, b.x);
    const maxX = Math.max(a.x, b.x);
    const lMinY = Math.min(line.y1, line.y2);
    const lMaxY = Math.max(line.y1, line.y2);
    if (line.x1 <= minX || line.x1 >= maxX || a.y < lMinY || a.y > lMaxY) return null;
    return Math.abs(line.x1 - a.x);
  }
  const minY = Math.min(a.y, b.y);
  const maxY = Math.max(a.y, b.y);
  const lMinX = Math.min(line.x1, line.x2);
  const lMaxX = Math.max(line.x1, line.x2);
  if (line.y1 <= minY || line.y1 >= maxY || a.x < lMinX || a.x > lMaxX) return null;
  return Math.abs(line.y1 - a.y);
}

function rangeOverlapLength(a1, a2, b1, b2) {
  const minA = Math.min(a1, a2);
  const maxA = Math.max(a1, a2);
  const minB = Math.min(b1, b2);
  const maxB = Math.max(b1, b2);
  return Math.max(0, Math.min(maxA, maxB) - Math.max(minA, minB));
}

function buildCenterLineFallback(startBox, endBox, reason = 'fallback') {
  const sp = { x: startBox.cx, y: startBox.cy };
  const ep = { x: endBox.cx, y: endBox.cy };
  const pathD = `M ${sp.x} ${sp.y} L ${ep.x} ${ep.y}`;
  return {
    isFallback: true,
    routeError: reason,
    pts: [sp, ep],
    pathD,
    textPathD: pathD,
    textPathLen: Math.abs(ep.x - sp.x) + Math.abs(ep.y - sp.y),
  };
}

function buildCenterOrthogonalFallback(startBox, endBox, gridStep) {
  const midX = Math.round(((startBox.cx + endBox.cx) / 2) / gridStep) * gridStep;
  const midY = Math.round(((startBox.cy + endBox.cy) / 2) / gridStep) * gridStep;
  const horizontalFirst = Math.abs(endBox.cx - startBox.cx) >= Math.abs(endBox.cy - startBox.cy);
  const dx = endBox.cx - startBox.cx;
  const dy = endBox.cy - startBox.cy;
  const startPt = horizontalFirst
    ? { x: dx >= 0 ? startBox.right : startBox.left, y: startBox.cy }
    : { x: startBox.cx, y: dy >= 0 ? startBox.bottom : startBox.top };
  const endPt = horizontalFirst
    ? { x: dx >= 0 ? endBox.left : endBox.right, y: endBox.cy }
    : { x: endBox.cx, y: dy >= 0 ? endBox.top : endBox.bottom };
  return horizontalFirst
    ? cleanPointList([
      startPt,
      { x: midX, y: startPt.y },
      { x: midX, y: endPt.y },
      endPt,
    ])
    : cleanPointList([
      startPt,
      { x: startPt.x, y: midY },
      { x: endPt.x, y: midY },
      endPt,
    ]);
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

function buildOrthogonalFallbackCandidates(startPort, endPort, gridStep, startStubLen = gridStep, endStubLen = gridStep) {
  const startStub = portStubPoint(startPort, startStubLen);
  const endStub = portStubPoint(endPort, endStubLen);
  const prefix = expandStartPort(startPort, startStub);
  const suffix = expandEndPort(endPort, endStub);
  const midA = { x: endStub.x, y: startStub.y };
  const midB = { x: startStub.x, y: endStub.y };
  const minX = Math.min(startStub.x, endStub.x);
  const maxX = Math.max(startStub.x, endStub.x);
  const minY = Math.min(startStub.y, endStub.y);
  const maxY = Math.max(startStub.y, endStub.y);
  const candidates = [
    cleanPointList([...prefix, midA, ...suffix]),
    cleanPointList([...prefix, midB, ...suffix]),
  ];
  for (const lanes of [2, 4, 6, 8, 12, 16]) {
    const detour = gridStep * lanes;
    const leftX = minX - detour;
    const rightX = maxX + detour;
    const topY = minY - detour;
    const bottomY = maxY + detour;
    candidates.push(
      cleanPointList([...prefix, { x: leftX, y: startStub.y }, { x: leftX, y: endStub.y }, ...suffix]),
      cleanPointList([...prefix, { x: rightX, y: startStub.y }, { x: rightX, y: endStub.y }, ...suffix]),
      cleanPointList([...prefix, { x: startStub.x, y: topY }, { x: endStub.x, y: topY }, ...suffix]),
      cleanPointList([...prefix, { x: startStub.x, y: bottomY }, { x: endStub.x, y: bottomY }, ...suffix]),
    );
  }
  return candidates;
}

function expandStartPort(port, stub) {
  const anchors = Array.isArray(port.anchorPt) ? port.anchorPt : [port.anchorPt || port.pt];
  return cleanPointList([...anchors, port.pt, stub]);
}

function expandEndPort(port, stub) {
  const anchors = Array.isArray(port.anchorPt) ? port.anchorPt : [port.anchorPt || port.pt];
  return cleanPointList([stub, port.pt, ...anchors.slice().reverse()]);
}

function portStubPoint(port, stubLen) {
  return {
    x: port.pt.x + (port.axis === 'H' ? port.sign * stubLen : 0),
    y: port.pt.y + (port.axis === 'V' ? port.sign * stubLen : 0),
  };
}

function terminalStubLength(edge, role, gridStep) {
  const type = edge?.connectionType || edge?.arrowType || 'target';
  const hasStartMarker = type === 'reverse' || type === 'both';
  const hasEndMarker = type === 'target' || type === 'both';
  const needsArrowRoom = role === 'start' ? hasStartMarker : hasEndMarker;
  if (!needsArrowRoom) return gridStep;
  return Math.max(gridStep, Math.ceil(40 / gridStep) * gridStep);
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

function pathBlockedExceptTerminalClips(pts, startNodeId, endNodeId, ctx) {
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const isStartClip = i === 0;
    const isEndClip = i === pts.length - 2;
    const isTerminalClip = isStartClip || isEndClip;
    if (isTerminalClip && isSegmentBlockedByForeignNode(a, b, startNodeId, endNodeId, ctx)) {
      return true;
    }
    if (isStartClip && isSegmentBlockedByOwnNode(a, b, startNodeId, 'start', ctx)) {
      return true;
    }
    if (isEndClip && isSegmentBlockedByOwnNode(a, b, endNodeId, 'end', ctx)) {
      return true;
    }
    if (!isTerminalClip && isSegmentBlockedCheck(a.x, a.y, b.x, b.y, startNodeId, endNodeId, false, ctx)) {
      return true;
    }
  }
  return false;
}

function isSegmentBlockedByOwnNode(a, b, nodeId, role, ctx) {
  const obstacle = (ctx?.obstacles || []).find(o => String(o.id) === String(nodeId));
  if (!obstacle) return false;
  if (isAllowedOwnTerminalStub(a, b, obstacle, role)) return false;
  return segmentCrossesObstacleZone(a, b, obstacle);
}

function isAllowedOwnTerminalStub(a, b, obstacle, role) {
  const port = role === 'start' ? a : b;
  const outside = role === 'start' ? b : a;
  const margin = 0.01;
  const sameY = Math.abs(port.y - outside.y) < margin;
  const sameX = Math.abs(port.x - outside.x) < margin;
  const onVerticalSpan = port.y >= obstacle.vTop - margin && port.y <= obstacle.vBottom + margin;
  const onHorizontalSpan = port.x >= obstacle.vLeft - margin && port.x <= obstacle.vRight + margin;

  if (sameY && onVerticalSpan) {
    if (Math.abs(port.x - obstacle.vLeft) < margin) return outside.x <= port.x + margin;
    if (Math.abs(port.x - obstacle.vRight) < margin) return outside.x >= port.x - margin;
  }
  if (sameX && onHorizontalSpan) {
    if (Math.abs(port.y - obstacle.vTop) < margin) return outside.y <= port.y + margin;
    if (Math.abs(port.y - obstacle.vBottom) < margin) return outside.y >= port.y - margin;
  }
  return false;
}

function isSegmentBlockedByForeignNode(a, b, startNodeId, endNodeId, ctx) {
  if (!ctx?.obstacles) return false;
  const minX = Math.min(a.x, b.x);
  const maxX = Math.max(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxY = Math.max(a.y, b.y);
  const isH = Math.abs(a.y - b.y) < 0.01;
  const isV = Math.abs(a.x - b.x) < 0.01;
  if (!isH && !isV) return true;

  for (const o of ctx.obstacles) {
    if (String(o.id) === String(startNodeId) || String(o.id) === String(endNodeId)) continue;

    const isCornerA = (a.x === o.vLeft || a.x === o.vRight) && (a.y === o.vTop || a.y === o.vBottom);
    const isCornerB = (b.x === o.vLeft || b.x === o.vRight) && (b.y === o.vTop || b.y === o.vBottom);
    if (isCornerA || isCornerB) return true;

    const crossesVBoxX = Math.max(minX, o.vLeft) < Math.min(maxX, o.vRight);
    const crossesVBoxY = Math.max(minY, o.vTop) < Math.min(maxY, o.vBottom);
    if (isH && a.y >= o.vTop && a.y <= o.vBottom && crossesVBoxX) return true;
    if (isV && a.x >= o.vLeft && a.x <= o.vRight && crossesVBoxY) return true;

    const crossesPadX = Math.max(minX, o.left) < Math.min(maxX, o.right);
    const crossesPadY = Math.max(minY, o.top) < Math.min(maxY, o.bottom);
    if (isH && a.y > o.top && a.y < o.bottom && crossesPadX) return true;
    if (isV && a.x > o.left && a.x < o.right && crossesPadY) return true;
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

function simplifyCollinearPath(pts) {
  const clean = cleanPointList(pts || []);
  if (clean.length <= 2) return clean;
  const out = [clean[0]];
  for (let i = 1; i < clean.length - 1; i++) {
    const prev = out[out.length - 1];
    const curr = clean[i];
    const next = clean[i + 1];
    if ((Math.abs(prev.x - curr.x) < 0.01 && Math.abs(curr.x - next.x) < 0.01)
      || (Math.abs(prev.y - curr.y) < 0.01 && Math.abs(curr.y - next.y) < 0.01)) {
      continue;
    }
    out.push(curr);
  }
  out.push(clean[clean.length - 1]);
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
