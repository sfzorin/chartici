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

  const wrapLines = (size) => {
    const words = tokenizeWrapWords(text);
    let lines = [];
    let currentLine = words[0]?.text || '';

    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      const testLine = joinWrapToken(currentLine, word);
      if (measure(testLine, size) < maxWidth - paddingX) {
        currentLine = testLine;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word.text;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines;
  };

  while (currentSize >= minSize) {
    const lines = wrapLines(currentSize);

    const totalHeight = lines.length * (currentSize * 1.2);
    const allLinesFit = lines.every(l => measure(l, currentSize) <= maxWidth - paddingX);
    if (totalHeight <= maxHeight - paddingY && allLinesFit) {
      return finish(lines, currentSize);
    }
    currentSize -= 1;
  }
  
  const lines = wrapLines(minSize);

  const maxAllowedLines = Math.max(1, Math.floor((maxHeight - paddingY) / (minSize * 1.2)));
  return finish(lines.slice(0, maxAllowedLines), minSize);
}

export function tokenizeWrapWords(text) {
  return String(text || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .flatMap(word => splitHyphenatedWord(word));
}

function splitHyphenatedWord(word) {
  if (!word.includes('-') || /^-+$/.test(word)) return [{ text: word, noSpaceBefore: false }];
  const parts = word.split(/(-)/).filter(Boolean);
  const tokens = [];
  let buffer = '';
  parts.forEach(part => {
    buffer += part;
    if (part === '-') {
      tokens.push({ text: buffer, noSpaceBefore: tokens.length > 0 });
      buffer = '';
    }
  });
  if (buffer) tokens.push({ text: buffer, noSpaceBefore: tokens.length > 0 });
  return tokens.length > 0 ? tokens : [{ text: word, noSpaceBefore: false }];
}

function joinWrapToken(line, token) {
  if (!line) return token.text;
  return token.noSpaceBefore ? `${line}${token.text}` : `${line} ${token.text}`;
}
