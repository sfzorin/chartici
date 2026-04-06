import { getNodeDim } from './constants.js';

export function smartAlign(nodes) {
  const result = nodes.map(n => ({ ...n }));

  // Helper to align along a specific axis (X or Y)
  const alignAxis = (axis, threshold, gridStep) => {
    // Sort nodes to group nearby
    const sorted = [...result].sort((a, b) => (a[axis] || 0) - (b[axis] || 0));
    let clusters = [];
    let currentCluster = [];

    sorted.forEach(node => {
      const val = node[axis] || 0;
      if (currentCluster.length === 0) {
        currentCluster.push(node);
      } else {
        const lastVal = currentCluster[currentCluster.length - 1][axis] || 0;
        if (val - lastVal <= threshold) {
          currentCluster.push(node);
        } else {
          clusters.push(currentCluster);
          currentCluster = [node];
        }
      }
    });
    if (currentCluster.length > 0) {
      clusters.push(currentCluster);
    }

    // Align each cluster to grid
    clusters.forEach(cluster => {
      if (cluster.length === 1) {
        // Just snap single node
        const val = cluster[0][axis] || 0;
        const snapped = Math.round(val / gridStep) * gridStep;
        cluster[0][axis] = snapped;
      } else {
        // Average and snap
        const sum = cluster.reduce((acc, n) => acc + (n[axis] || 0), 0);
        const avg = sum / cluster.length;
        const snapped = Math.round(avg / gridStep) * gridStep;
        cluster.forEach(n => {
          n[axis] = snapped;
        });
      }
    });
  };

  alignAxis('y', 40, 20); // Group nodes within 40px vertically, snap to 20px grid
  alignAxis('x', 40, 20); // Group nodes within 40px horizontally, snap to 20px grid

  return result;
}

export const getAxisDir = (dir) => {
  if (dir === 'left' || dir === 'right' || dir === 'horizontal') return 'horizontal';
  return 'vertical';
};

export function computeBindings(nodes) {
  let computed = nodes.map(n => ({...n}));
  
  // simple 1-level bindings
  const boundNodes = computed.filter(n => n.bindTo);
  
  boundNodes.forEach(child => {
    const parent = computed.find(n => n.id === child.bindTo);
    if (parent) {
      const fDim = getNodeDim(parent);
      const tDim = getNodeDim(child);
      
      const pX = parent.x || 0;
      const pY = parent.y || 0;
      
      if (child.offsetX !== undefined && child.offsetY !== undefined) {
        // Annotation absolute offset binding
        child.x = pX + child.offsetX;
        child.y = pY + child.offsetY;
      } else {
        // Legacy structural binding
        const dir = getAxisDir(child.bindDir);
        if (dir === 'vertical') {
          child.x = pX + fDim.width/2 - tDim.width/2;
        } else if (dir === 'horizontal') {
          child.y = pY + fDim.height/2 - tDim.height/2;
        }
      }
    }
  });
  return computed;
}
