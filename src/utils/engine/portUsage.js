export function portKeyFromPoint(point) {
  const keyPoint = Array.isArray(point) ? point[0] : point;
  if (!keyPoint) return null;
  return `${keyPoint.x},${keyPoint.y}`;
}

export function portKeyFromPort(port) {
  return portKeyFromPoint(port?.anchorPt) || portKeyFromPoint(port?.pt);
}

export function getPortUsages(usedPorts, portKey) {
  if (!usedPorts || !portKey) return [];
  if (usedPorts instanceof Map) return usedPorts.get(portKey) || [];
  if (usedPorts instanceof Set) return usedPorts.has(portKey) ? [{ legacy: true }] : [];
  return [];
}

export function makePortUsage(edgeType, role, port) {
  return {
    edgeType,
    role,
    dir: port?.dir || null,
    axis: port?.axis || null,
    sign: port?.sign || 0,
  };
}

export function portUsageCompatible(a, b) {
  if (!a || !b || a.legacy || b.legacy) return false;
  return a.edgeType === b.edgeType
    && a.role === b.role
    && a.dir === b.dir
    && a.axis === b.axis
    && a.sign === b.sign;
}

export function canUsePort(usedPorts, port, edgeType, role, allowCompatibleReuse) {
  const key = portKeyFromPort(port);
  const usages = getPortUsages(usedPorts, key);
  if (usages.length === 0) return true;
  if (!allowCompatibleReuse) return false;
  const nextUsage = makePortUsage(edgeType, role, port);
  return usages.every(usage => portUsageCompatible(usage, nextUsage));
}

export function addPortUsage(ctx, nodeId, port, fallbackPoint, edgeType, role) {
  const key = portKeyFromPort(port) || portKeyFromPoint(fallbackPoint);
  if (!ctx?.usedPorts || !key) return;
  const nodeKey = String(nodeId);
  let used = ctx.usedPorts.get(nodeKey);
  if (!used || !(used instanceof Map)) {
    used = new Map();
    ctx.usedPorts.set(nodeKey, used);
  }
  const usages = used.get(key) || [];
  usages.push(makePortUsage(edgeType, role, port));
  used.set(key, usages);
}
