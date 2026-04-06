const measureTextCache = {};

export function getFittedText(text, maxWidth, maxHeight, baseFontSize, fontStyle, fontWeight) {
  if (!text) return { lines: [], fontSize: baseFontSize, textWidth: 0, textHeight: 0 };
  
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  const measure = (t, size) => {
    const fontDesc = `${fontStyle === 'italic' ? 'italic ' : ''}${fontWeight === 'bold' ? 'bold ' : ''}${size}px 'Inter', sans-serif`;
    const key = fontDesc + ':' + t;
    if (measureTextCache[key]) return measureTextCache[key];
    ctx.font = fontDesc;
    const w = ctx.measureText(t).width;
    measureTextCache[key] = w;
    return w;
  };

  let currentSize = baseFontSize;
  const minSize = 8;
  const paddingX = 16;
  const paddingY = 8;
  
  const finish = (lines, size) => {
    let maxW = 0;
    for (let l of lines) {
       const w = measure(l, size);
       if (w > maxW) maxW = w;
    }
    return { lines, fontSize: size, textWidth: maxW, textHeight: lines.length * (size * 1.2) };
  };

  while (currentSize >= minSize) {
    const words = text.split(/\s+/);
    let lines = [];
    let currentLine = words[0] || '';

    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      const testLine = currentLine + " " + word;
      if (measure(testLine, currentSize) < maxWidth - paddingX) {
        currentLine = testLine;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);

    const totalHeight = lines.length * (currentSize * 1.2);
    const allLinesFit = lines.every(l => measure(l, currentSize) <= maxWidth - paddingX);
    if (totalHeight <= maxHeight - paddingY && allLinesFit) {
      return finish(lines, currentSize);
    }
    currentSize -= 1;
  }
  
  const words = text.split(/\s+/);
  let lines = [];
  let currentLine = words[0] || '';
  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    if (measure(currentLine + " " + word, minSize) < maxWidth - paddingX) {
      currentLine += " " + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);

  const maxAllowedLines = Math.max(1, Math.floor((maxHeight - paddingY) / (minSize * 1.2)));
  return finish(lines.slice(0, maxAllowedLines), minSize);
}
