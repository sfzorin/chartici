export function layoutPiechart(nodes, edges, layoutRules) {
  if (nodes.length === 0) return [];
  
  const sizeVal = (size) => {
    const sizeMap = { 'XS': 1, 'S': 2, 'M': 4, 'L': 8, 'XL': 12 };
    return sizeMap[size] || 1;
  };

  const sortedNodes = [...nodes].sort((a, b) => {
      const aVal = typeof a.value === 'number' ? a.value : sizeVal(a.size);
      const bVal = typeof b.value === 'number' ? b.value : sizeVal(b.size);
      return Math.max(0, bVal) - Math.max(0, aVal);
  });

  const totalSize = sortedNodes.reduce((acc, n) => {
    let val = typeof n.value === 'number' ? n.value : sizeVal(n.size);
    return acc + Math.max(val, 0);
  }, 0);

  if (totalSize === 0) return nodes;

  let currentAngle = 0;
  return sortedNodes.map((n, idx) => {
    let val = typeof n.value === 'number' ? n.value : sizeVal(n.size);
    val = Math.max(val, 0);
    const angleSpan = (val / totalSize) * Math.PI * 2;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angleSpan;
    currentAngle += angleSpan;
    
    return {
      ...n,
      color: (idx % 9) + 1, // Enforce sequential color by size rank
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
