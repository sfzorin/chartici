/**
 * Canonical accessor for a node's group ID.
 */
export function getGroupId(node) {
  if (!node) return null;
  return node.groupId || null;
}
