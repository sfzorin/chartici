import { getNodeDim } from '../../diagram/nodes.jsx';
import { getGroupId } from '../groupUtils.js';

export function layoutMatrix(nodes, edges, layoutRules) {
  if (nodes.length === 0) return [];

  const snapGap = (value) => Math.max(20, Math.round(value / 20) * 20);
  const ITEM_GAP_X = snapGap((layoutRules.MIN_GAP_X || 60) * 0.45);
  const ITEM_GAP_Y = snapGap((layoutRules.MIN_GAP_Y || 60) * 0.42);
  const GROUP_GAP_X = snapGap((layoutRules.MIN_GAP_X || 60) * 0.7);
  const GROUP_GAP_Y = snapGap((layoutRules.MIN_GAP_Y || 60) * 0.65);

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

  // Calculate cell dimensions based on largest group
  const maxNodesPerGroup = Math.max(...[...groups.values()].map(g => g.length));
  const subCols = Math.ceil(Math.sqrt(maxNodesPerGroup));
  const maxW = Math.max(...nodes.map(n => n.w || 120));
  const maxH = Math.max(...nodes.map(n => n.h || 60));
  const cellW = subCols * maxW + Math.max(0, subCols - 1) * ITEM_GAP_X;
  const rowCount = Math.ceil(maxNodesPerGroup / subCols);
  const cellH = rowCount * maxH + Math.max(0, rowCount - 1) * ITEM_GAP_Y;

  const result = [];

  groupIds.forEach((gid, gi) => {
    const col = gi % gridCols;
    const row = Math.floor(gi / gridCols);
    const cellOriginX = col * (cellW + GROUP_GAP_X);
    const cellOriginY = row * (cellH + GROUP_GAP_Y);

    const groupNodes = groups.get(gid);
    groupNodes.forEach((n, ni) => {
      const subCol = ni % subCols;
      const subRow = Math.floor(ni / subCols);
      result.push({
        ...n,
        x: cellOriginX + subCol * (maxW + ITEM_GAP_X) + maxW / 2,
        y: cellOriginY + subRow * (maxH + ITEM_GAP_Y) + maxH / 2
      });
    });
  });

  return result;
}
