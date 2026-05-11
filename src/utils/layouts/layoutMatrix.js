import { getNodeDim } from '../../diagram/nodes.jsx';
import { getGroupId } from '../groupUtils.js';

export function layoutMatrix(nodes, edges, layoutRules) {
  if (nodes.length === 0) return [];

  const snapGap = (value) => Math.max(20, Math.round(value / 20) * 20);
  const ITEM_GAP_X = snapGap((layoutRules.MIN_GAP_X || 60) * 0.45);
  const ITEM_GAP_Y = snapGap((layoutRules.MIN_GAP_Y || 60) * 0.42);
  const GROUP_GAP_X = Math.max(100, snapGap((layoutRules.MIN_GAP_X || 60) * 1.7));
  const GROUP_GAP_Y = Math.max(50, snapGap((layoutRules.MIN_GAP_Y || 60) * 0.85));
  const groupLabelById = new Map((layoutRules.groups || []).map(group => [
    String(group.id),
    String(group.label || group.id || ''),
  ]));

  // Group nodes by groupId
  const groups = new Map(); // groupId -> [node]
  const orphans = [];
  nodes.forEach(n => {
    const gid = getGroupId(n);
    if (gid) {
      if (!groups.has(gid)) groups.set(gid, []);
      groups.get(gid).push(n);
    } else {
      orphans.push(n);
    }
  });

  // If no groups, treat all nodes as a single flat grid
  if (groups.size === 0) {
    const cols = Math.ceil(Math.sqrt(nodes.length));
    const maxW = Math.max(...nodes.map(n => n.w || 120));
    const maxH = Math.max(...nodes.map(n => n.h || 60));
    return nodes.map((n, i) => ({
      ...n,
      x: (i % cols) * (maxW + ITEM_GAP_X),
      y: Math.floor(i / cols) * (maxH + ITEM_GAP_Y)
    }));
  }

  // Calculate grid dimensions for groups
  let groupIds = [...groups.keys()];
  if (orphans.length > 0) {
    groupIds.push('__orphans__');
    groups.set('__orphans__', orphans);
  }
  
  if (groupIds.length > 12) {
    groupIds = groupIds.slice(0, 12);
  }

  const gridCols = Math.ceil(Math.sqrt(groupIds.length));

  const groupMetrics = new Map();
  groupIds.forEach(gid => {
    const groupNodes = groups.get(gid) || [];
    const subCols = Math.max(1, Math.ceil(Math.sqrt(groupNodes.length)));
    const rowCount = Math.max(1, Math.ceil(groupNodes.length / subCols));
    const maxW = Math.max(...groupNodes.map(nodeWidth));
    const maxH = Math.max(...groupNodes.map(nodeHeight));
    const contentW = subCols * maxW + Math.max(0, subCols - 1) * ITEM_GAP_X;
    const contentH = rowCount * maxH + Math.max(0, rowCount - 1) * ITEM_GAP_Y;
    const label = groupLabelById.get(String(gid)) || gid;
    const labelW = estimateMatrixGroupLabelWidth(label);
    const overlay = matrixOverlayMetrics(label);
    groupMetrics.set(gid, {
      subCols,
      maxW,
      maxH,
      contentW,
      contentH,
      overlayTop: overlay.top,
      overlayBottom: overlay.bottom,
      cellW: snapGap(Math.max(contentW, labelW)),
      cellH: snapGap(overlay.top + contentH + overlay.bottom),
    });
  });

  const colWidths = Array.from({ length: gridCols }, (_, col) => {
    const ids = groupIds.filter((_, index) => index % gridCols === col);
    return Math.max(...ids.map(gid => groupMetrics.get(gid).cellW));
  });
  const gridRows = Math.ceil(groupIds.length / gridCols);
  const rowHeights = Array.from({ length: gridRows }, (_, row) => {
    const ids = groupIds.filter((_, index) => Math.floor(index / gridCols) === row);
    return Math.max(...ids.map(gid => groupMetrics.get(gid).cellH));
  });

  const result = [];

  groupIds.forEach((gid, gi) => {
    const col = gi % gridCols;
    const row = Math.floor(gi / gridCols);
    const cellOriginX = colWidths.slice(0, col).reduce((sum, width) => sum + width, 0) + col * GROUP_GAP_X;
    const cellOriginY = rowHeights.slice(0, row).reduce((sum, height) => sum + height, 0) + row * GROUP_GAP_Y;
    const metric = groupMetrics.get(gid);
    const groupOffsetX = Math.max(0, (colWidths[col] - metric.cellW) / 2);
    const groupOffsetY = Math.max(0, (rowHeights[row] - metric.cellH) / 2);

    const groupNodes = groups.get(gid);
    const contentOffsetX = Math.max(0, (metric.cellW - metric.contentW) / 2);
    const contentOffsetY = metric.overlayTop;
    groupNodes.forEach((n, ni) => {
      const subCol = ni % metric.subCols;
      const subRow = Math.floor(ni / metric.subCols);
      result.push({
        ...n,
        x: cellOriginX + groupOffsetX + contentOffsetX + subCol * (metric.maxW + ITEM_GAP_X) + metric.maxW / 2,
        y: cellOriginY + groupOffsetY + contentOffsetY + subRow * (metric.maxH + ITEM_GAP_Y) + metric.maxH / 2
      });
    });
  });

  return result;
}

function nodeWidth(node) {
  return node.w || node.width || getNodeDim(node).width || 120;
}

function nodeHeight(node) {
  return node.h || node.height || getNodeDim(node).height || 60;
}

function matrixOverlayMetrics(label) {
  const lines = wrapMatrixGroupLabel(label);
  const groupPad = 30;
  const labelTopExtra = lines.length > 1 ? 26 : 10;
  const labelH = lines.length === 1 ? 30 : 52;
  return {
    top: groupPad + labelTopExtra + labelH / 2,
    bottom: groupPad,
  };
}

function wrapMatrixGroupLabel(label) {
  const words = String(label || '').replace(/_/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];
  const lines = [];
  let current = '';
  words.forEach(word => {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= 22 || !current) {
      current = next;
    } else if (lines.length < 1) {
      lines.push(current);
      current = word;
    }
  });
  if (current && lines.length < 2) lines.push(current);
  return lines.slice(0, 2);
}

function estimateMatrixGroupLabelWidth(label) {
  const lines = wrapMatrixGroupLabel(label);
  const longest = Math.max(...lines.slice(0, 2).map(line => line.length), 1);
  const desiredTabW = longest * 12 + 40;
  return Math.min(520, Math.max(180, Math.ceil(desiredTabW / 0.8) - 56));
}
