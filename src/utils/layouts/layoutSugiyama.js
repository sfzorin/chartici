import dagre from 'dagre';
import { getNodeDim } from '../../diagram/nodes.jsx';
import { EDGE_LABEL_STYLE } from '../../diagram/edges.js';

const GRID_STEP = 20;
const LABEL_CHAR_WIDTH = Math.max(8, EDGE_LABEL_STYLE.charWidth || 7.4);

function labelRequiredPx(label, extra = 56) {
  if (!label) return 0;
  return Math.ceil(String(label).length * LABEL_CHAR_WIDTH + extra);
}

function flowLabelLayoutWidth(label) {
  const text = String(label || '').trim();
  if (!text) return 0;
  const effectiveChars = Math.min(text.length, 14);
  return Math.ceil(effectiveChars * LABEL_CHAR_WIDTH);
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

function getGraphIds(nodes, edges) {
  const nodeIds = new Set(nodes.map(n => String(n.id)));
  return edges
    .map(edge => ({ from: edgeFrom(edge), to: edgeTo(edge) }))
    .filter(edge => nodeIds.has(edge.from) && nodeIds.has(edge.to));
}

function findStronglyConnectedComponents(nodes, edges) {
  const graphEdges = getGraphIds(nodes, edges);
  const adj = new Map(nodes.map(node => [String(node.id), []]));
  graphEdges.forEach(edge => adj.get(edge.from)?.push(edge.to));

  let index = 0;
  const stack = [];
  const onStack = new Set();
  const indices = new Map();
  const lowLink = new Map();
  const components = [];

  const strongConnect = (id) => {
    indices.set(id, index);
    lowLink.set(id, index);
    index += 1;
    stack.push(id);
    onStack.add(id);

    for (const next of adj.get(id) || []) {
      if (!indices.has(next)) {
        strongConnect(next);
        lowLink.set(id, Math.min(lowLink.get(id), lowLink.get(next)));
      } else if (onStack.has(next)) {
        lowLink.set(id, Math.min(lowLink.get(id), indices.get(next)));
      }
    }

    if (lowLink.get(id) !== indices.get(id)) return;
    const component = [];
    let current = null;
    do {
      current = stack.pop();
      onStack.delete(current);
      component.push(current);
    } while (current !== id);
    components.push(component);
  };

  nodes.forEach(node => {
    const id = String(node.id);
    if (!indices.has(id)) strongConnect(id);
  });

  return components;
}

function shouldUseFeedbackFlowLayout(nodes, edges, dt) {
  if (dt !== 'flowchart' || nodes.length < 4 || nodes.length > 16 || edges.length < nodes.length) return false;
  if (nodes.some(node => node.lockPos)) return false;
  const components = findStronglyConnectedComponents(nodes, edges);
  const largest = components.reduce((best, component) => component.length > best.length ? component : best, []);
  if (largest.length >= 3) return true;

  const graphEdges = getGraphIds(nodes, edges);
  let cyclicEdges = 0;
  graphEdges.forEach(edge => {
    if (hasPath(graphEdges, edge.to, edge.from, `${edge.from}->${edge.to}`)) cyclicEdges += 1;
  });
  return cyclicEdges >= 3 && cyclicEdges >= Math.ceil(nodes.length / 2);
}

function hasPath(graphEdges, startId, goalId, skipKey = null) {
  const queue = [String(startId)];
  const seen = new Set(queue);
  const target = String(goalId);

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === target) return true;
    graphEdges.forEach(edge => {
      if (skipKey && `${edge.from}->${edge.to}` === skipKey) return;
      if (edge.from !== current || seen.has(edge.to)) return;
      seen.add(edge.to);
      queue.push(edge.to);
    });
  }

  return false;
}

function layoutFeedbackFlow(nodes, edges) {
  const components = findStronglyConnectedComponents(nodes, edges);
  const coreIds = new Set(
    components.reduce((best, component) => component.length > best.length ? component : best, [])
  );
  if (coreIds.size < 2) return nodes;

  const graphEdges = getGraphIds(nodes, edges);
  const byId = new Map(nodes.map(node => [String(node.id), node]));
  const degree = new Map(nodes.map(node => [String(node.id), { in: 0, out: 0, coreOut: 0, coreIn: 0 }]));
  graphEdges.forEach(edge => {
    const from = degree.get(edge.from);
    const to = degree.get(edge.to);
    if (from) {
      from.out += 1;
      if (coreIds.has(edge.to)) from.coreOut += 1;
    }
    if (to) {
      to.in += 1;
      if (coreIds.has(edge.from)) to.coreIn += 1;
    }
  });

  const centerCandidate = [...nodes]
    .filter(node => !coreIds.has(String(node.id)) && node.type !== 'rhombus')
    .map(node => {
      const stats = degree.get(String(node.id)) || { coreOut: 0, coreIn: 0, out: 0, in: 0 };
      return {
        node,
        score: stats.coreOut * 6 + stats.coreIn * 3 + stats.out + stats.in,
      };
    })
    .filter(item => item.score >= 4)
    .sort((a, b) => b.score - a.score)[0]?.node || null;
  const centerId = centerCandidate ? String(centerCandidate.id) : null;

  const result = new Map();
  const maxW = Math.max(...nodes.map(node => nodeWidth(node)));
  const maxH = Math.max(...nodes.map(node => nodeHeight(node)));
  const radiusX = snap(Math.max(260, maxW * 1.65));
  const radiusY = snap(Math.max(130, maxH * 1.35));

  if (centerCandidate) {
    result.set(centerId, { ...centerCandidate, x: 0, y: snap(radiusY + maxH * 0.85) });
  }

  const coreNodes = [...coreIds]
    .map(id => byId.get(id))
    .filter(Boolean)
    .sort((a, b) => {
      const da = degree.get(String(a.id)) || { in: 0, out: 0 };
      const db = degree.get(String(b.id)) || { in: 0, out: 0 };
      return (db.in + db.out) - (da.in + da.out);
    });

  const coreAngles = coreNodes.length === 3
    ? [-90, 25, 145]
    : coreNodes.map((_, index) => -90 + (360 * index / coreNodes.length));

  coreNodes.forEach((node, index) => {
    const angle = (coreAngles[index] * Math.PI) / 180;
    result.set(String(node.id), {
      ...node,
      x: snap(Math.cos(angle) * radiusX),
      y: snap(Math.sin(angle) * radiusY),
    });
  });

  const remaining = nodes.filter(node => !result.has(String(node.id)));
  const left = [];
  const right = [];
  const bottom = [];

  remaining.forEach(node => {
    const id = String(node.id);
    const stats = degree.get(id) || { coreOut: 0, coreIn: 0, out: 0, in: 0 };
    if (stats.coreOut > stats.coreIn || node.type === 'rhombus') left.push(node);
    else if (stats.coreIn > stats.coreOut) right.push(node);
    else bottom.push(node);
  });

  const hubY = centerId && result.get(centerId) ? result.get(centerId).y : 0;
  const interventionY = snap(hubY * 0.55);
  placeSideNodes(result, left, -radiusX - maxW * 1.15, interventionY, maxH + 60);
  placeSideNodes(result, right, radiusX + maxW * 1.15, 0, maxH + 60);
  placeBottomNodes(result, bottom, radiusY + maxH * 2.4, maxW + 70);

  return nodes.map(node => result.get(String(node.id)) || node);
}

function placeSideNodes(result, nodes, x, centerY, gap) {
  const startY = centerY - ((nodes.length - 1) * gap) / 2;
  nodes.forEach((node, index) => {
    result.set(String(node.id), {
      ...node,
      x: snap(x),
      y: snap(startY + index * gap),
    });
  });
}

function placeBottomNodes(result, nodes, y, gap) {
  const startX = -((nodes.length - 1) * gap) / 2;
  nodes.forEach((node, index) => {
    result.set(String(node.id), {
      ...node,
      x: snap(startX + index * gap),
      y: snap(y),
    });
  });
}

function nodeWidth(node) {
  return node.w || getNodeDim(node).width;
}

function nodeHeight(node) {
  return node.h || getNodeDim(node).height;
}

function edgeFrom(edge) {
  return String(edge.from || edge.sourceId);
}

function edgeTo(edge) {
  return String(edge.to || edge.targetId);
}

function collectReachable(outgoing, startId) {
  const seen = new Set();
  const queue = [...(outgoing.get(startId) || [])];

  while (queue.length > 0) {
    const id = queue.shift();
    if (seen.has(id)) continue;
    seen.add(id);
    queue.push(...(outgoing.get(id) || []));
  }

  return seen;
}

function shiftNode(node, dx, dy) {
  if (node.lockPos) return node;
  return {
    ...node,
    x: snap((node.x || 0) + dx),
    y: snap((node.y || 0) + dy),
  };
}

function reserveDecisionFanInPockets(nodes, edges, isHorizontalFlow) {
  if (nodes.length < 4 || edges.length < 3) return nodes;

  let result = nodes.map(n => ({ ...n }));
  const incoming = new Map();
  const outgoing = new Map();

  edges.forEach(edge => {
    const from = edgeFrom(edge);
    const to = edgeTo(edge);
    if (!incoming.has(to)) incoming.set(to, []);
    incoming.get(to).push(from);
    if (!outgoing.has(from)) outgoing.set(from, []);
    outgoing.get(from).push(to);
  });

  const decisionIds = nodes
    .filter(node => node.type === 'rhombus' && (incoming.get(String(node.id)) || []).length >= 3)
    .map(node => String(node.id));

  const minPocket = isHorizontalFlow ? 100 : 90;
  const maxPocket = isHorizontalFlow ? 140 : 130;

  decisionIds.forEach(decisionId => {
    const byId = new Map(result.map(node => [String(node.id), node]));
    const target = byId.get(decisionId);
    if (!target || target.lockPos) return;

    const sources = (incoming.get(decisionId) || [])
      .map(id => byId.get(id))
      .filter(Boolean);
    if (sources.length < 3) return;

    const reachable = collectReachable(outgoing, decisionId);

    if (isHorizontalFlow) {
      const avgSourceX = sources.reduce((sum, node) => sum + (node.x || 0), 0) / sources.length;
      if (avgSourceX <= (target.x || 0)) {
        const sourceRight = Math.max(...sources.map(node => (node.x || 0) + nodeWidth(node) / 2));
        const targetLeft = (target.x || 0) - nodeWidth(target) / 2;
        const excess = snap(Math.max(0, (targetLeft - sourceRight) - maxPocket));
        if (excess > 0) {
          result = result.map(node => {
            const id = String(node.id);
            const shouldShift = id === decisionId || reachable.has(id) || (node.x || 0) >= (target.x || 0) - 1;
            return shouldShift ? shiftNode(node, -excess, 0) : node;
          });
          return;
        }
        const delta = snap(Math.max(0, minPocket - (targetLeft - sourceRight)));
        if (delta <= 0) return;
        result = result.map(node => {
          const id = String(node.id);
          const shouldShift = id === decisionId || reachable.has(id) || (node.x || 0) >= (target.x || 0) - 1;
          return shouldShift ? shiftNode(node, delta, 0) : node;
        });
        return;
      }

      const sourceLeft = Math.min(...sources.map(node => (node.x || 0) - nodeWidth(node) / 2));
      const targetRight = (target.x || 0) + nodeWidth(target) / 2;
      const excess = snap(Math.max(0, (sourceLeft - targetRight) - maxPocket));
      if (excess > 0) {
        result = result.map(node => {
          const id = String(node.id);
          const shouldShift = id === decisionId || reachable.has(id) || (node.x || 0) <= (target.x || 0) + 1;
          return shouldShift ? shiftNode(node, excess, 0) : node;
        });
        return;
      }
      const delta = snap(Math.max(0, minPocket - (sourceLeft - targetRight)));
      if (delta <= 0) return;
      result = result.map(node => {
        const id = String(node.id);
        const shouldShift = id === decisionId || reachable.has(id) || (node.x || 0) <= (target.x || 0) + 1;
        return shouldShift ? shiftNode(node, -delta, 0) : node;
      });
      return;
    }

    const avgSourceY = sources.reduce((sum, node) => sum + (node.y || 0), 0) / sources.length;
    if (avgSourceY <= (target.y || 0)) {
      const sourceBottom = Math.max(...sources.map(node => (node.y || 0) + nodeHeight(node) / 2));
      const targetTop = (target.y || 0) - nodeHeight(target) / 2;
      const delta = snap(Math.max(0, minPocket - (targetTop - sourceBottom)));
      if (delta <= 0) return;
      result = result.map(node => {
        const id = String(node.id);
        const shouldShift = id === decisionId || reachable.has(id) || (node.y || 0) >= (target.y || 0) - 1;
        return shouldShift ? shiftNode(node, 0, delta) : node;
      });
      return;
    }

    const sourceTop = Math.min(...sources.map(node => (node.y || 0) - nodeHeight(node) / 2));
    const targetBottom = (target.y || 0) + nodeHeight(target) / 2;
    const delta = snap(Math.max(0, minPocket - (sourceTop - targetBottom)));
    if (delta <= 0) return;
    result = result.map(node => {
      const id = String(node.id);
      const shouldShift = id === decisionId || reachable.has(id) || (node.y || 0) <= (target.y || 0) + 1;
      return shouldShift ? shiftNode(node, 0, -delta) : node;
    });
  });

  return result;
}

function layoutFlowchartGravity(nodes, edges, layoutRules) {
  const graph = buildForwardFlowGraph(nodes, edges);
  const backbone = chooseBackbonePath(graph);
  const density = flowchartDensityProfile(edges, layoutRules);
  if (backbone.length < 2) return layoutSimpleFlowchart(nodes, layoutRules, density);

  const backboneIndex = new Map(backbone.map((id, index) => [id, index]));
  const tierMap = assignGravityTiers(graph, backbone, backboneIndex);
  let laneMap = assignGravityLanes(graph, backboneIndex, tierMap);
  laneMap = balanceParallelJoinLanes(graph, backboneIndex, tierMap, laneMap);
  laneMap = compactGravityLanes(graph, backboneIndex, tierMap, laneMap);
  laneMap = centerMultiParentJoins(graph, backboneIndex, tierMap, laneMap);
  laneMap = optimizeGravityLanes(graph, backboneIndex, tierMap, laneMap);
  let result = placeGravityNodes(nodes, tierMap, laneMap, layoutRules, density);

  result = separateGravityTierCollisions(result, tierMap, layoutRules, density);
  result = reserveDecisionFanInPockets(result, edges, true);
  result = separateNodeBoxCollisions(result, density);
  result = compressSparseFlowchartVerticalGaps(result, edges, density);
  result = centerGravityLayout(result);
  return result;
}

function buildForwardFlowGraph(nodes, edges) {
  const nodeIds = new Set(nodes.map(node => String(node.id)));
  const byId = new Map(nodes.map(node => [String(node.id), node]));
  const order = new Map(nodes.map((node, index) => [String(node.id), index]));
  const allEdges = edges
    .map(edge => ({ edge, from: edgeFrom(edge), to: edgeTo(edge) }))
    .filter(edge => nodeIds.has(edge.from) && nodeIds.has(edge.to));

  const adjAll = new Map(nodes.map(node => [String(node.id), []]));
  const inAll = new Map(nodes.map(node => [String(node.id), []]));
  allEdges.forEach(edge => {
    adjAll.get(edge.from)?.push(edge);
    inAll.get(edge.to)?.push(edge);
  });

  const roots = [...nodeIds].filter(id => (inAll.get(id) || []).length === 0);
  const startIds = roots.length > 0 ? roots : [String(nodes[0]?.id)];
  const color = new Map([...nodeIds].map(id => [id, 0]));
  const forwardKeys = new Set();

  const visit = (id) => {
    color.set(id, 1);
    for (const edge of adjAll.get(id) || []) {
      if (color.get(edge.to) === 1) continue;
      forwardKeys.add(`${edge.from}->${edge.to}`);
      if (color.get(edge.to) === 0) visit(edge.to);
    }
    color.set(id, 2);
  };

  startIds.forEach(id => {
    if (id && color.get(id) === 0) visit(id);
  });
  [...nodeIds].forEach(id => {
    if (color.get(id) === 0) visit(id);
  });

  const forwardEdges = allEdges.filter(edge => forwardKeys.has(`${edge.from}->${edge.to}`));
  const adj = new Map(nodes.map(node => [String(node.id), []]));
  const incoming = new Map(nodes.map(node => [String(node.id), []]));
  forwardEdges.forEach(edge => {
    adj.get(edge.from)?.push(edge);
    incoming.get(edge.to)?.push(edge);
  });

  return { nodes, nodeIds, byId, order, edges: allEdges, forwardEdges, adj, incoming, roots: startIds.filter(Boolean) };
}

function chooseBackbonePath(graph) {
  const memo = new Map();
  const next = new Map();
  const downstream = new Map();

  const visit = (id, seen = new Set()) => {
    if (memo.has(id)) return memo.get(id);
    if (seen.has(id)) return -100000;
    seen.add(id);
    const edges = graph.adj.get(id) || [];
    if (edges.length === 0) {
      memo.set(id, 1);
      downstream.set(id, 1);
      seen.delete(id);
      return 1;
    }

    let best = 1;
    let bestNext = null;
    let reach = 1;
    edges.forEach(edge => {
      const childLen = visit(edge.to, seen);
      const childReach = downstream.get(edge.to) || 1;
      reach += childReach;
      const semanticBonus = positiveFlowLabel(edge.edge) ? 0.35 : 0;
      const score = 1 + childLen + semanticBonus;
      if (score > best) {
        best = score;
        bestNext = edge.to;
      }
    });

    next.set(id, bestNext);
    memo.set(id, best);
    downstream.set(id, reach);
    seen.delete(id);
    return best;
  };

  const starts = graph.roots.length > 0 ? graph.roots : [...graph.nodeIds];
  let bestRoot = starts[0];
  let bestScore = -Infinity;
  starts.forEach(id => {
    const score = visit(id);
    if (score > bestScore) {
      bestScore = score;
      bestRoot = id;
    }
  });

  const path = [];
  const seen = new Set();
  let current = bestRoot;
  while (current && !seen.has(current)) {
    path.push(current);
    seen.add(current);
    current = next.get(current);
  }
  return path;
}

function positiveFlowLabel(edge) {
  const label = String(edge?.label || '').toLowerCase();
  if (!label) return true;
  if (/(yes|success|done|ok|valid|complete|approved|pass)/.test(label)) return true;
  if (/(no|fail|failed|error|reject|rollback|invalid|timeout)/.test(label)) return false;
  return true;
}

function assignGravityTiers(graph, backbone, backboneIndex) {
  const tier = new Map();
  backbone.forEach((id, index) => tier.set(id, index));

  const inCount = new Map([...graph.nodeIds].map(id => [id, 0]));
  graph.forwardEdges.forEach(edge => inCount.set(edge.to, (inCount.get(edge.to) || 0) + 1));
  const queue = [...graph.nodeIds].filter(id => (inCount.get(id) || 0) === 0);
  if (queue.length === 0) queue.push(...backbone);

  while (queue.length > 0) {
    const id = queue.shift();
    if (!tier.has(id)) tier.set(id, 0);
    for (const edge of graph.adj.get(id) || []) {
      const proposed = (tier.get(id) || 0) + 1;
      if (!backboneIndex.has(edge.to)) {
        tier.set(edge.to, Math.max(tier.get(edge.to) ?? 0, proposed));
      }
      inCount.set(edge.to, (inCount.get(edge.to) || 0) - 1);
      if ((inCount.get(edge.to) || 0) <= 0) queue.push(edge.to);
    }
  }

  [...graph.nodeIds].forEach(id => {
    if (!tier.has(id)) tier.set(id, backboneIndex.get(id) ?? backbone.length);
  });

  graph.forwardEdges.forEach(edge => {
    if (backboneIndex.has(edge.to)) return;
    const sourceTier = tier.get(edge.from) ?? 0;
    if ((tier.get(edge.to) ?? 0) <= sourceTier) tier.set(edge.to, sourceTier + 1);
  });

  return tier;
}

function assignGravityLanes(graph, backboneIndex, tierMap) {
  const lane = new Map([...graph.nodeIds].map(id => [id, 0]));
  const sourceBranchCounts = new Map();
  const occupied = new Set();

  const nodesByTier = [...graph.nodeIds]
    .sort((a, b) => (tierMap.get(a) || 0) - (tierMap.get(b) || 0));

  nodesByTier.forEach(id => {
    if (backboneIndex.has(id)) {
      lane.set(id, 0);
      occupied.add(`${tierMap.get(id) || 0}:0`);
      return;
    }

    const incoming = graph.incoming.get(id) || [];
    const semanticDown = incoming.some(edge => negativeFlowLabel(edge.edge));
    const parentLanes = incoming.map(edge => lane.get(edge.from) || 0).filter(value => value !== 0);
    let preferred = parentLanes.length > 0
      ? Math.round(parentLanes.reduce((sum, value) => sum + value, 0) / parentLanes.length)
      : 0;

    if (preferred === 0) {
      const source = incoming.find(edge => backboneIndex.has(edge.from))?.from || incoming[0]?.from || id;
      const count = sourceBranchCounts.get(source) || 0;
      sourceBranchCounts.set(source, count + 1);
      preferred = semanticDown ? count + 1 : -(count + 1);
      if (!semanticDown && count % 2 === 1) preferred = count + 1;
    }

    if (semanticDown && preferred < 0) preferred = Math.abs(preferred);
    preferred = chooseFreeLane(occupied, tierMap.get(id) || 0, preferred);
    lane.set(id, preferred);
    occupied.add(`${tierMap.get(id) || 0}:${preferred}`);
  });

  return lane;
}

function balanceParallelJoinLanes(graph, backboneIndex, tierMap, laneMap) {
  const clusters = new Map();

  for (const id of graph.nodeIds) {
    const incoming = graph.incoming.get(id) || [];
    if (incoming.length !== 1) continue;
    const positiveOutgoing = (graph.adj.get(id) || []).filter(edge => positiveFlowLabel(edge.edge));
    if (positiveOutgoing.length !== 1) continue;
    const source = incoming[0].from;
    const join = positiveOutgoing[0].to;
    if (source === join) continue;
    const key = `${source}->${join}:${tierMap.get(id) || 0}`;
    if (!clusters.has(key)) clusters.set(key, []);
    clusters.get(key).push(id);
  }

  const balancedIds = new Set();
  for (const ids of clusters.values()) {
    if (ids.length < 3) continue;
    ids.forEach(id => balancedIds.add(id));
  }
  if (balancedIds.size === 0) return laneMap;

  const next = new Map(laneMap);
  const occupied = new Set();
  for (const id of graph.nodeIds) {
    if (balancedIds.has(id)) continue;
    occupied.add(`${tierMap.get(id) || 0}:${next.get(id) || 0}`);
  }

  for (const ids of clusters.values()) {
    if (ids.length < 3) continue;
    const tier = tierMap.get(ids[0]) || 0;
    const center = chooseParallelJoinCenter(ids, graph, laneMap);
    const ordered = [
      center,
      ...ids
        .filter(id => id !== center)
        .sort((a, b) => parallelBranchWeight(b, graph) - parallelBranchWeight(a, graph)
          || (graph.order.get(a) ?? 0) - (graph.order.get(b) ?? 0)),
    ];
    const slots = [0, 1, -1, 2, -2, 3, -3];

    ordered.forEach((id, index) => {
      const preferred = slots[index] ?? index;
      const chosen = chooseFreeLane(occupied, tier, preferred);
      next.set(id, chosen);
      occupied.add(`${tier}:${chosen}`);
      pullSingleChildBranchToLane(id, chosen, graph, tierMap, next, occupied);
    });
  }

  return next;
}

function chooseParallelJoinCenter(ids, graph, laneMap) {
  const clean = ids.filter(id => parallelBranchWeight(id, graph) === 0);
  if (clean.length > 0) {
    return clean.sort((a, b) => Math.abs(laneMap.get(a) || 0) - Math.abs(laneMap.get(b) || 0)
      || String(a).localeCompare(String(b)))[0];
  }
  return [...ids].sort((a, b) => Math.abs(laneMap.get(a) || 0) - Math.abs(laneMap.get(b) || 0)
    || String(a).localeCompare(String(b)))[0];
}

function parallelBranchWeight(id, graph) {
  return (graph.adj.get(id) || []).filter(edge => !positiveFlowLabel(edge.edge)).length;
}

function pullSingleChildBranchToLane(parentId, parentLane, graph, tierMap, laneMap, occupied) {
  const sideChildren = (graph.adj.get(parentId) || [])
    .filter(edge => !positiveFlowLabel(edge.edge))
    .map(edge => edge.to)
    .filter(id => !occupied.has(`${tierMap.get(id) || 0}:${parentLane}`));

  sideChildren.forEach(childId => {
    const tier = tierMap.get(childId) || 0;
    if ((graph.incoming.get(childId) || []).length !== 1) return;
    if ((graph.adj.get(childId) || []).length > 1) return;
    const key = `${tier}:${parentLane}`;
    if (occupied.has(key)) return;
    laneMap.set(childId, parentLane);
    occupied.add(key);
  });
}

function compactGravityLanes(graph, backboneIndex, tierMap, laneMap) {
  const next = new Map(laneMap);
  const occupied = () => {
    const set = new Set();
    for (const id of graph.nodeIds) set.add(`${tierMap.get(id) || 0}:${next.get(id) || 0}`);
    return set;
  };

  for (let pass = 0; pass < 6; pass++) {
    let changed = false;
    const used = occupied();
    const movable = [...graph.nodeIds]
      .filter(id => !backboneIndex.has(id))
      .sort((a, b) => Math.abs(next.get(b) || 0) - Math.abs(next.get(a) || 0));

    for (const id of movable) {
      const lane = next.get(id) || 0;
      if (lane === 0) continue;
      const tier = tierMap.get(id) || 0;
      const candidate = lane + (lane > 0 ? -1 : 1);
      const currentKey = `${tier}:${lane}`;
      const candidateKey = `${tier}:${candidate}`;
      if (used.has(candidateKey)) continue;
      if (gravityLaneScore(id, candidate, graph, next) > gravityLaneScore(id, lane, graph, next)) continue;
      used.delete(currentKey);
      used.add(candidateKey);
      next.set(id, candidate);
      changed = true;
    }
    if (!changed) break;
  }

  return next;
}

function centerMultiParentJoins(graph, backboneIndex, tierMap, laneMap) {
  const next = new Map(laneMap);
  const occupied = new Set();
  for (const id of graph.nodeIds) occupied.add(`${tierMap.get(id) || 0}:${next.get(id) || 0}`);

  const joins = [...graph.nodeIds]
    .filter(id => (graph.incoming.get(id) || []).length >= 2)
    .sort((a, b) => (graph.incoming.get(b) || []).length - (graph.incoming.get(a) || []).length);

  joins.forEach(id => {
    const parentLanes = (graph.incoming.get(id) || []).map(edge => next.get(edge.from) || 0);
    if (parentLanes.length < 2) return;
    const preferred = Math.round(parentLanes.reduce((sum, value) => sum + value, 0) / parentLanes.length);
    const current = next.get(id) || 0;
    if (current === preferred) return;
    const tier = tierMap.get(id) || 0;
    const currentKey = `${tier}:${current}`;
    const preferredKey = `${tier}:${preferred}`;
    if (occupied.has(preferredKey)) return;
    if (gravityLaneScore(id, preferred, graph, next) > gravityLaneScore(id, current, graph, next)) return;
    occupied.delete(currentKey);
    occupied.add(preferredKey);
    next.set(id, preferred);
  });

  return next;
}

function optimizeGravityLanes(graph, backboneIndex, tierMap, laneMap) {
  const next = new Map(laneMap);
  const occupied = () => {
    const set = new Set();
    for (const id of graph.nodeIds) set.add(`${tierMap.get(id) || 0}:${next.get(id) || 0}`);
    return set;
  };

  const movable = [...graph.nodeIds]
    .filter(id => !backboneIndex.has(id))
    .sort((a, b) => gravityLanePriority(b, graph) - gravityLanePriority(a, graph)
      || (tierMap.get(a) || 0) - (tierMap.get(b) || 0)
      || (graph.order.get(a) ?? 0) - (graph.order.get(b) ?? 0));

  for (let pass = 0; pass < 8; pass++) {
    let changed = false;
    const used = occupied();

    for (const id of movable) {
      const tier = tierMap.get(id) || 0;
      const current = next.get(id) || 0;
      const currentKey = `${tier}:${current}`;
      const candidates = gravityLaneCandidates(id, graph, next, current);
      let bestLane = current;
      let bestScore = gravityLaneObjective(id, current, graph, next);

      for (const candidate of candidates) {
        if (candidate !== current && used.has(`${tier}:${candidate}`)) continue;
        const score = gravityLaneObjective(id, candidate, graph, next);
        if (score >= bestScore - 0.01) continue;
        bestScore = score;
        bestLane = candidate;
      }

      if (bestLane === current) continue;
      used.delete(currentKey);
      used.add(`${tier}:${bestLane}`);
      next.set(id, bestLane);
      changed = true;
    }

    if (!changed) break;
  }

  return next;
}

function gravityLanePriority(id, graph) {
  const incoming = (graph.incoming.get(id) || []).length;
  const outgoing = (graph.adj.get(id) || []).length;
  return incoming * 3 + outgoing + (incoming >= 2 ? 8 : 0);
}

function gravityLaneCandidates(id, graph, laneMap, current) {
  const neighborLanes = [
    ...(graph.incoming.get(id) || []).map(edge => laneMap.get(edge.from) || 0),
    ...(graph.adj.get(id) || []).map(edge => laneMap.get(edge.to) || 0),
    current,
    0,
  ];
  const avg = neighborLanes.reduce((sum, lane) => sum + lane, 0) / Math.max(1, neighborLanes.length);
  const center = Math.round(avg);
  const candidates = new Set([current, 0, center, Math.floor(avg), Math.ceil(avg)]);
  for (const lane of neighborLanes) {
    candidates.add(lane);
    candidates.add(lane - 1);
    candidates.add(lane + 1);
  }
  for (let lane = -4; lane <= 4; lane++) candidates.add(lane);
  return [...candidates].sort((a, b) => Math.abs(a - center) - Math.abs(b - center) || Math.abs(a) - Math.abs(b) || a - b);
}

function gravityLaneObjective(id, lane, graph, laneMap) {
  const incoming = graph.incoming.get(id) || [];
  const outgoing = graph.adj.get(id) || [];
  let score = Math.abs(lane) * 0.35;

  incoming.forEach(edge => {
    const parentLane = laneMap.get(edge.from) || 0;
    const span = Math.max(1, Math.abs((graph.order.get(edge.to) ?? 0) - (graph.order.get(edge.from) ?? 0)));
    score += Math.abs(lane - parentLane) * (incoming.length >= 2 ? 2.4 : 1.5);
    score += Math.abs(lane - parentLane) * Math.min(1.5, span * 0.08);
  });

  outgoing.forEach(edge => {
    const childLane = laneMap.get(edge.to) || 0;
    const positive = positiveFlowLabel(edge.edge);
    score += Math.abs(lane - childLane) * (positive ? 1.4 : 1.1);
  });

  if (incoming.length >= 2) {
    const parentAvg = incoming.reduce((sum, edge) => sum + (laneMap.get(edge.from) || 0), 0) / incoming.length;
    score += Math.abs(lane - parentAvg) * 2.2;
  }

  return score;
}

function gravityLaneScore(id, lane, graph, laneMap) {
  const neighbors = [
    ...(graph.incoming.get(id) || []).map(edge => edge.from),
    ...(graph.adj.get(id) || []).map(edge => edge.to),
  ];
  if (neighbors.length === 0) return Math.abs(lane) * 0.5;
  return neighbors.reduce((sum, neighbor) => sum + Math.abs(lane - (laneMap.get(neighbor) || 0)), 0)
    + Math.abs(lane) * 0.15;
}

function negativeFlowLabel(edge) {
  return /(no|fail|failed|error|reject|rollback|invalid|timeout)/i.test(String(edge?.label || ''));
}

function chooseFreeLane(occupied, tier, preferred) {
  if (!occupied.has(`${tier}:${preferred}`)) return preferred;
  for (let radius = 1; radius < 12; radius++) {
    const candidates = preferred <= 0 ? [preferred - radius, preferred + radius] : [preferred + radius, preferred - radius];
    const found = candidates.find(lane => !occupied.has(`${tier}:${lane}`));
    if (found !== undefined) return found;
  }
  return preferred;
}

function flowchartDensityProfile(edges, layoutRules) {
  const labels = edges
    .map(edge => String(edge.label || '').trim())
    .filter(Boolean);
  const baseGap = layoutRules.MIN_GAP_X || 60;
  const compactGap = Math.max(80, baseGap + 20);
  if (labels.length === 0 || labels.every(isCompactFlowLabel)) {
    return {
      tierGap: compactGap,
      laneGapExtra: 20,
      laneGapMin: 120,
      tierCollisionGap: 40,
    };
  }

  const maxTextWidth = Math.max(...labels.map(flowLabelLayoutWidth), 0);
  return {
    tierGap: Math.max(90, Math.min(160, snap(maxTextWidth + 30))),
    laneGapExtra: 80,
    laneGapMin: 160,
    tierCollisionGap: Math.max(70, (layoutRules.MIN_GAP_Y || 60) + 20),
  };
}

function isCompactFlowLabel(label) {
  const normalized = String(label || '').trim().toLowerCase();
  if (!normalized) return true;
  if (normalized.length <= 4) return true;
  return /^(yes|no|да|нет|ok|ок|true|y|n)$/i.test(normalized);
}

function placeGravityNodes(nodes, tierMap, laneMap, layoutRules, density = flowchartDensityProfile([], layoutRules)) {
  const tiers = [...new Set([...tierMap.values()])].sort((a, b) => a - b);
  const tierWidths = new Map();
  tiers.forEach(tier => {
    const members = nodes.filter(node => (tierMap.get(String(node.id)) || 0) === tier);
    tierWidths.set(tier, Math.max(...members.map(node => nodeWidth(node)), 80));
  });

  const xByTier = new Map();
  let cursor = 0;
  tiers.forEach((tier, index) => {
    const width = tierWidths.get(tier) || 80;
    if (index === 0) {
      cursor = width / 2;
    } else {
      const prevWidth = tierWidths.get(tiers[index - 1]) || 80;
      cursor += prevWidth / 2 + width / 2 + density.tierGap;
    }
    xByTier.set(tier, snap(cursor));
  });

  const maxH = Math.max(...nodes.map(node => nodeHeight(node)), 80);
  const laneGapExtra = density.laneGapExtra ?? Math.max(70, (layoutRules.MIN_GAP_Y || 60) + 20);
  const laneGapMin = density.laneGapMin ?? 160;
  const laneGap = snap(Math.max(maxH + laneGapExtra, laneGapMin));
  return nodes.map(node => {
    const id = String(node.id);
    return {
      ...node,
      x: xByTier.get(tierMap.get(id) || 0) || 0,
      y: snap((laneMap.get(id) || 0) * laneGap),
    };
  });
}

function separateGravityTierCollisions(nodes, tierMap, layoutRules, density = flowchartDensityProfile([], layoutRules)) {
  let result = nodes.map(node => ({ ...node }));
  const minGap = density.tierCollisionGap ?? Math.max(70, (layoutRules.MIN_GAP_Y || 60) + 20);
  const tiers = new Map();
  result.forEach(node => {
    const tier = tierMap.get(String(node.id)) || 0;
    if (!tiers.has(tier)) tiers.set(tier, []);
    tiers.get(tier).push(node);
  });

  tiers.forEach(members => {
    const sorted = members.sort((a, b) => (a.y || 0) - (b.y || 0));
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      const required = (nodeHeight(prev) + nodeHeight(curr)) / 2 + minGap;
      const gap = (curr.y || 0) - (prev.y || 0);
      if (gap >= required) continue;
      const dy = snap(required - gap);
      curr.y = snap((curr.y || 0) + dy);
    }
  });

  return result.map(node => {
    const adjusted = [...tiers.values()].flat().find(item => String(item.id) === String(node.id));
    return adjusted || node;
  });
}

function separateNodeBoxCollisions(nodes, density = flowchartDensityProfile([], {})) {
  let result = nodes.map(node => ({ ...node }));
  const minGap = Math.max(20, Math.min(40, density.tierCollisionGap ?? 40));

  for (let pass = 0; pass < 8; pass++) {
    let changed = false;
    const sorted = [...result].sort((a, b) => (a.y || 0) - (b.y || 0) || (a.x || 0) - (b.x || 0));

    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const a = sorted[i];
        const b = sorted[j];
        const requiredX = (nodeWidth(a) + nodeWidth(b)) / 2 + minGap;
        const dx = Math.abs((b.x || 0) - (a.x || 0));
        if (dx >= requiredX) continue;

        const requiredY = (nodeHeight(a) + nodeHeight(b)) / 2 + minGap;
        const dy = (b.y || 0) - (a.y || 0);
        if (Math.abs(dy) >= requiredY) continue;

        const push = Math.max(GRID_STEP, Math.ceil((requiredY - Math.abs(dy)) / GRID_STEP) * GRID_STEP);
        if (push <= 0) continue;
        const direction = dy >= 0 ? 1 : -1;
        result = result.map(node => {
          if (String(node.id) !== String(b.id) || node.lockPos) return node;
          return { ...node, y: snap((node.y || 0) + direction * push) };
        });
        changed = true;
      }
    }

    if (!changed) break;
  }

  return result;
}

function compressSparseFlowchartVerticalGaps(nodes, edges, density = flowchartDensityProfile([], {})) {
  if (nodes.length < 4 || nodes.length > 9) return nodes;
  if (edges.length > nodes.length + 3) return nodes;

  const rows = groupFlowchartRows(nodes);
  if (rows.length < 2) return nodes;

  const gaps = [];
  for (let i = 1; i < rows.length; i++) gaps.push(rows[i].y - rows[i - 1].y);
  const roomyGap = Math.max(...gaps);
  if (roomyGap < 170) return nodes;

  const clearance = Math.max(40, Math.min(70, density.tierCollisionGap ?? 50));
  const yByRow = new Map();
  let cursor = rows[0].y;
  yByRow.set(rows[0].key, snap(cursor));

  for (let i = 1; i < rows.length; i++) {
    const prev = rows[i - 1];
    const row = rows[i];
    const required = snap((prev.height + row.height) / 2 + clearance);
    const originalGap = row.y - prev.y;
    cursor += Math.min(originalGap, required);
    yByRow.set(row.key, snap(cursor));
  }

  const compacted = nodes.map(node => {
    if (node.lockPos) return node;
    const key = rowKey(node.y || 0);
    return { ...node, y: yByRow.get(key) ?? node.y };
  });

  return separateNodeBoxCollisions(compacted, density);
}

function groupFlowchartRows(nodes) {
  const rows = new Map();
  nodes.forEach(node => {
    const key = rowKey(node.y || 0);
    if (!rows.has(key)) rows.set(key, { key, y: snap(node.y || 0), nodes: [], height: 0 });
    const row = rows.get(key);
    row.nodes.push(node);
    row.height = Math.max(row.height, nodeHeight(node));
  });
  return [...rows.values()].sort((a, b) => a.y - b.y);
}

function rowKey(y) {
  return String(snap(y));
}

function centerGravityLayout(nodes) {
  if (nodes.length === 0) return nodes;
  const top = Math.min(...nodes.map(node => (node.y || 0) - nodeHeight(node) / 2));
  const bottom = Math.max(...nodes.map(node => (node.y || 0) + nodeHeight(node) / 2));
  const shift = snap((top + bottom) / 2);
  if (!shift) return nodes;
  return nodes.map(node => ({
    ...node,
    y: node.lockPos ? node.y : snap((node.y || 0) - shift),
  }));
}

function layoutSimpleFlowchart(nodes, layoutRules, density = flowchartDensityProfile([], layoutRules)) {
  if (nodes.length === 0) return nodes;
  const maxW = Math.max(...nodes.map(node => nodeWidth(node)), 80);
  const maxH = Math.max(...nodes.map(node => nodeHeight(node)), 80);
  const gapY = Math.max(70, (layoutRules.MIN_GAP_Y || 60) + 20);
  const columns = Math.max(1, Math.ceil(Math.sqrt(nodes.length)));
  const stepX = snap(maxW + density.tierGap);
  const stepY = snap(maxH + gapY);
  const centerOffset = (columns - 1) / 2;

  const laidOut = nodes.map((node, index) => {
    if (node.lockPos) return node;
    const col = index % columns;
    const row = Math.floor(index / columns);
    return {
      ...node,
      x: snap((col - centerOffset) * stepX),
      y: snap(row * stepY),
    };
  });

  return centerGravityLayout(laidOut);
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

  if (isHorizontalFlow && shouldUseFeedbackFlowLayout(nodes, edges, dt)) {
    const density = flowchartDensityProfile(edges, layoutRules);
    return centerGravityLayout(compressSparseFlowchartVerticalGaps(
      separateNodeBoxCollisions(layoutFeedbackFlow(nodes, edges), density),
      edges,
      density
    ));
  }

  if (dt === 'flowchart' && isHorizontalFlow) {
    return layoutFlowchartGravity(nodes, edges, layoutRules);
  }
  
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
    result = reserveDecisionFanInPockets(result, edges, isHorizontalFlow);
  }

  return result;
}
