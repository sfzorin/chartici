export function layoutPiechart(nodes, edges, layoutRules) {
  if (nodes.length === 0) return [];
  
  const sizeVal = (size) => {
    const sizeMap = { 'S': 1, 'M': 2, 'L': 4 };
    return sizeMap[size] || 2;
  };

  const sortedNodes = [...nodes].sort((a, b) => {
      let aVal = parseFloat(a.value);
      if (isNaN(aVal)) aVal = sizeVal(a.size);
      let bVal = parseFloat(b.value);
      if (isNaN(bVal)) bVal = sizeVal(b.size);
      return Math.max(0, bVal) - Math.max(0, aVal);
  });

  const totalSize = sortedNodes.reduce((acc, n) => {
    let val = parseFloat(n.value);
    if (isNaN(val)) val = sizeVal(n.size);
    return acc + Math.max(val, 0);
  }, 0);

  if (totalSize === 0) return nodes;

  let currentAngle = 0;
  const layedOut = sortedNodes.map((n, idx) => {
    let val = parseFloat(n.value);
    if (isNaN(val)) val = sizeVal(n.size);
    val = Math.max(val, 0);
    const angleSpan = (val / totalSize) * Math.PI * 2;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angleSpan;
    currentAngle += angleSpan;
    
    return {
      ...n,
      x: 0,              // Snap to center
      y: 0,
      pieStartAngle: startAngle,
      pieEndAngle: endAngle
    };
  });

  // Second pass: Rigorous angular collision detection
  const R = 150; // Inner approx radius
  const TEXT_SPAN_PIXELS = 22; // Physical pixel leeway requested per line
  const STAGGER_STEP = 25; // Radial spacing between cascade levels
  
  // Track maximum occupied angle for levels [0, 1, 2]
  let lastOccupiedAngles = [0, 0, 0];
  // Start rightward overflow slightly past 12 o'clock (2*PI)
  let overflowAngle = 2 * Math.PI + 0.05; 

  const layedOutStaggered = layedOut.map((n) => {
       const midAngle = (n.pieStartAngle + n.pieEndAngle) / 2;
       const angleSpan = n.pieEndAngle - n.pieStartAngle;
       
       let targetStagger = 0;
       let targetLabelAngle = midAngle;
       let placed = false;
       
       // Process up to 3 radial levels for collision cascading
       for (let level = 0; level <= 2; level++) {
           const labelR = R + 20 + level * STAGGER_STEP;
           // Convert required pixel span to angular span at this specific radius
           const trueRequiredHalf = (TEXT_SPAN_PIXELS / labelR) / 2;
           const desiredStart = midAngle - trueRequiredHalf;
           
           if (desiredStart >= lastOccupiedAngles[level]) {
               targetStagger = level * STAGGER_STEP;
               targetLabelAngle = midAngle;
               lastOccupiedAngles[level] = midAngle + trueRequiredHalf;
               placed = true;
               break;
           }
       }
       
       if (!placed) {
           // Cascade exhausted. Throw label over 12 o'clock boundary to right side.
           targetStagger = 0; 
           const labelR = R + 20;
           const trueRequiredHalf = (TEXT_SPAN_PIXELS / labelR) / 2;
           targetLabelAngle = overflowAngle + trueRequiredHalf;
           overflowAngle = targetLabelAngle + trueRequiredHalf;
       }
       
       return { 
           ...n, 
           pieLabelStagger: targetStagger,
           pieLabelAngle: targetLabelAngle 
       };
  });
  
  return layedOutStaggered;
}
