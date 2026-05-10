import { EDGE_LABEL_STYLE } from '../../diagram/edges.js';
import { getGroupId } from '../groupUtils.js';

const GRID_STEP = 20;
const LABEL_CHAR_WIDTH = Math.max(8, EDGE_LABEL_STYLE.charWidth || 7.4);

function snap(value) {
  return Math.round(value / GRID_STEP) * GRID_STEP;
}

function snapUp(value) {
  return Math.ceil(value / GRID_STEP) * GRID_STEP;
}

function labelRequiredPx(label, extra = 56) {
  if (!label) return 0;
  return Math.ceil(String(label).length * LABEL_CHAR_WIDTH + extra);
}

function edgeEndpoint(edge, key) {
  return String(edge[key] || edge[key === 'from' ? 'sourceId' : 'targetId']);
}

function buildNodeOrder(nodes, edges) {
  const nodeById = new Map(nodes.map(n => [String(n.id), n]));
  const seen = new Set();
  const orderedIds = [];

  const pushId = (id) => {
    const key = String(id);
    if (!nodeById.has(key) || seen.has(key)) return;
    seen.add(key);
    orderedIds.push(key);
  };

  edges.forEach(edge => {
    pushId(edge.from || edge.sourceId);
    pushId(edge.to || edge.targetId);
  });
  nodes.forEach(node => pushId(node.id));

  return orderedIds;
}

function buildLanePositions(nodes, layoutRules) {
  const gids = [...new Set(nodes.map(n => getGroupId(n)).filter(Boolean))];
  const laneGap = layoutRules.SEQUENCE_LANE_GAP ?? 56;
  const lanePad = layoutRules.SEQUENCE_LANE_PAD ?? 26;
  const maxH = {};

  gids.forEach(gid => {
    maxH[gid] = Math.max(...nodes
      .filter(n => getGroupId(n) === gid)
      .map(n => n.h || 80));
  });

  const laneY = {};
  let currentY = 0;
  gids.forEach((gid, index) => {
    if (index === 0) {
      laneY[gid] = currentY;
      return;
    }

    const prevHalf = (maxH[gids[index - 1]] || 80) / 2 + lanePad;
    const currHalf = (maxH[gid] || 80) / 2 + lanePad;
    currentY += prevHalf + currHalf + laneGap;
    laneY[gid] = currentY;
  });

  return laneY;
}

function makeMessageLookup(edges) {
  const lookup = new Map();
  edges.forEach(edge => {
    lookup.set(`${edgeEndpoint(edge, 'from')}->${edgeEndpoint(edge, 'to')}`, edge);
  });
  return lookup;
}

export function layoutSequence(nodes, edges, layoutRules) {
  const nodeById = new Map(nodes.map(n => [String(n.id), n]));
  const laneY = buildLanePositions(nodes, layoutRules);
  const orderedIds = buildNodeOrder(nodes, edges);
  const messageLookup = makeMessageLookup(edges);

  const minGap = layoutRules.SEQUENCE_MIN_STEP_GAP ?? 48;
  const sameLaneLabelCap = layoutRules.SEQUENCE_SAME_LANE_LABEL_CAP ?? 220;
  const crossLaneGap = layoutRules.SEQUENCE_CROSS_LANE_GAP ?? 52;

  const nodeW = (id) => nodeById.get(String(id))?.w || 160;
  const labelGapFor = (from, to) => {
    const msg = messageLookup.get(`${String(from)}->${String(to)}`);
    if (!msg?.label) return minGap;

    const sourceGroup = getGroupId(nodeById.get(String(from)));
    const targetGroup = getGroupId(nodeById.get(String(to)));
    if (sourceGroup && sourceGroup === targetGroup) {
      return Math.max(minGap, Math.min(sameLaneLabelCap, labelRequiredPx(msg.label, 74)));
    }

    return crossLaneGap;
  };

  const positioned = [];
  orderedIds.forEach((id, index) => {
    const node = nodeById.get(String(id));
    let x;
    if (index === 0) {
      x = snap(nodeW(id) / 2);
    } else {
      const prevId = orderedIds[index - 1];
      const prev = positioned[positioned.length - 1];
      const requiredGap = labelGapFor(prevId, id);
      x = snapUp(prev.x + nodeW(prevId) / 2 + requiredGap + nodeW(id) / 2);
    }

    const gid = getGroupId(node);
    positioned.push({
      ...node,
      x,
      y: snap(gid && laneY[gid] !== undefined ? laneY[gid] : node.y || 0),
    });
  });

  return positioned;
}
