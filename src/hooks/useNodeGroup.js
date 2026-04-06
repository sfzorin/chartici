import { useMemo } from 'react';
import { getGroupId } from '../utils/groupUtils';

/**
 * Custom hook that resolves the group object for a selected node.
 * Replaces 11+ repeated `groupsList.find(gx => gx.id === (node.groupId || node.group))` calls in HUD.
 * 
 * @param {object|null} selectedNode - The currently selected node
 * @param {Array} groupsList - Array of group definitions
 * @returns {{ groupId: string|null, group: object|null }}
 */
export function useNodeGroup(selectedNode, groupsList = []) {
  return useMemo(() => {
    if (!selectedNode) return { groupId: null, group: null };
    const gId = getGroupId(selectedNode);
    if (!gId) return { groupId: null, group: null };
    const group = groupsList.find(g => g.id === gId) || null;
    return { groupId: gId, group };
  }, [selectedNode, groupsList]);
}
