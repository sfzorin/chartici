export function layoutPiechart(nodes, edges, layoutRules) {
  if (nodes.length === 0) return [];
  
  // Calculate total size to distribute angles
  let totalSize = 0;
  const processedNodes = nodes.map(n => {
    let val = 1; // Default
    if (n.value !== undefined && n.value !== null && !isNaN(Number(n.value))) {
        val = Number(n.value);
    } else {
        // Fallback to legacy string sizing
        const sizeMap = { 'XS': 1, 'S': 2, 'M': 4, 'L': 8, 'XL': 12 };
        val = sizeMap[n.size] || 1;
    }
    
    val = Math.max(val, 0); // prevent negative pie slices
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
