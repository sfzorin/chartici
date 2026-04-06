/**
 * Canonical helper to resolve a node's group ID.
 * Eliminates the legacy `n.groupId || n.group` dual-field pattern.
 * 
 * During migration, this function supports both field names.
 * Once all data is normalized, the `n.group` fallback can be removed.
 */
export function getGroupId(node) {
  if (!node) return null;
  return node.groupId || node.group || null;
}
