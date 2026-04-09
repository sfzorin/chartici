export function layoutPiechart(nodes, edges, layoutRules) {
  if (nodes.length === 0) return [];
  
  // Calculate total size to distribute angles
  let totalSize = 0;
  const processedNodes = nodes.map(n => {
    // Map semantic sizes to relative area weights
    const sizeMap = { 'XS': 1, 'S': 2, 'M': 4, 'L': 8, 'XL': 12 };
    const val = sizeMap[n.size] || 4; // Default to M
    totalSize += val;
    return { ...n, pieVal: val };
  });

  if (totalSize === 0) totalSize = 1;

  let currentAngle = 0;
  return processedNodes.map(n => {
    const angleSpan = (n.pieVal / totalSize) * Math.PI * 2;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angleSpan;
    currentAngle += angleSpan;
    
    return {
      ...n,
      type: 'pie_slice', // force type for rendering
      x: 0,              // Snap to center
      y: 0,
      w: 600,            // Overall pie diameter
      h: 600,
      pieStartAngle: startAngle,
      pieEndAngle: endAngle
    };
  });
}
