/**
 * Chartici Headless SVG Renderer
 * 
 * Takes a parsed .cci diagram and renders it to an SVG string
 * without any browser/React dependency.
 */
import { layoutNodesHeuristically } from './nodeLayouter.js';
import { calculateAllPaths } from './engine/index.js';
import { SIZES, PALETTES, getNodeDim } from './constants.js';
import { parseCharticiFile } from './charticiFormat.js';
import { getGroupId } from './groupUtils.js';
import { DIAGRAM_SCHEMAS } from './diagramSchemas.js';
import { LINE_STYLE_REGISTRY } from '../diagram/edges.js';

/**
 * Render a .cci JSON string to SVG
 * @param {string} cciJson - Raw .cci JSON content
 * @returns {{ svg: string, width: number, height: number }}
 */
export function renderToSVG(cciJson) {
  const raw = typeof cciJson === 'string' ? JSON.parse(cciJson) : cciJson;
  const parsed = parseCharticiFile(typeof cciJson === 'string' ? cciJson : JSON.stringify(raw));
  
  if (!parsed || !parsed.nodes || parsed.nodes.length === 0) {
    throw new Error('Invalid .cci format or no nodes found');
  }

  const { nodes, edges, groups, config: parsedConfig } = parsed;
  const diagramType = parsedConfig?.diagramType || 'tree';
  const title = parsedConfig?.title || '';
  const theme = parsedConfig?.theme || 'slate';
  const palette = PALETTES[theme] || PALETTES['blue-teal-slate'] || Object.values(PALETTES)[0];

  // Layout
  const laidOut = layoutNodesHeuristically(nodes, edges, { 
    diagramType, 
    aspect: raw.aspect || raw.data?.config?.aspect 
  });

  // Route edges
  const config = { diagramType };
  const pathData = calculateAllPaths(edges, laidOut, config);

  // Calculate bounding box
  const PAD = 60;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  
  for (const n of laidOut) {
    if (n.type === 'text' || n.type === 'title') continue;
    const dim = getNodeDim(n);
    minX = Math.min(minX, n.x - dim.width / 2);
    maxX = Math.max(maxX, n.x + dim.width / 2);
    minY = Math.min(minY, n.y - dim.height / 2);
    maxY = Math.max(maxY, n.y + dim.height / 2);
  }

  // Paths
  for (const pd of Object.values(pathData)) {
    if (pd && pd.pts) {
      pd.pts.forEach(pt => {
        if (pt.x < minX) minX = Math.min(minX, pt.x);
        if (pt.x > maxX) maxX = Math.max(maxX, pt.x);
        if (pt.y < minY) minY = Math.min(minY, pt.y);
        if (pt.y > maxY) maxY = Math.max(maxY, pt.y);
      });
    }
  }

  const activeSchema = DIAGRAM_SCHEMAS[diagramType] || DIAGRAM_SCHEMAS.flowchart;
  const manifest = activeSchema.engineManifest || {};

  // Groups bounds
  if (manifest.matrixGridOverlays && groups && groups.length > 1) {
    const realNodes = laidOut.filter(n => n.type !== 'text' && n.type !== 'title');
    groups.forEach(g => {
      const gNodes = realNodes.filter(n => getGroupId(n) === g.id);
      if (gNodes.length === 0) return;
      const pad = 30;
      gNodes.forEach(n => {
        const dim = getNodeDim(n);
        const l = n.x - dim.width / 2 - pad - 8;
        const r = n.x + dim.width / 2 + pad + 8;
        const t = n.y - dim.height / 2 - pad - 8;
        const b = n.y + dim.height / 2 + pad + 8;
        if (l < minX) minX = l; if (r > maxX) maxX = r;
        if (t < minY) minY = t; if (b > maxY) maxY = b;
      });
    });
  }

  const width = (maxX - minX) + PAD * 2;
  const height = (maxY - minY) + PAD * 2;
  const offsetX = -minX + PAD;
  const offsetY = -minY + PAD;

  // Build SVG
  const parts = [];
  
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`);
  parts.push(`<style>
    text { font-family: 'Inter', 'Segoe UI', Arial, sans-serif; }
    .edge-line { fill: none; stroke: #475569; stroke-width: 2; }
    .edge-label { font-size: 16px; fill: #475569; font-weight: 600; }
  </style>`);
  
  // Defs: arrow markers
  parts.push(`<defs>`);
  parts.push(`  <marker id="arrow" markerWidth="10" markerHeight="6.4" refX="8" refY="3.2" orient="auto-start-reverse">`);
  parts.push(`    <path d="M 0 0 L 8 3.2 L 0 6.4 z" fill="#475569" />`);
  parts.push(`  </marker>`);
  parts.push(`</defs>`);

  // Background
  parts.push(`<rect width="${width}" height="${height}" fill="#ffffff" />`);

  // Matrix Groups Layer
  if (manifest.matrixGridOverlays && groups && groups.length > 1) {
    const realNodes = laidOut.filter(n => n.type !== 'text' && n.type !== 'title');
    const groupBoxes = {};
    groups.forEach(g => {
      const gNodes = realNodes.filter(n => getGroupId(n) === g.id);
      if (gNodes.length === 0) return;
      const dims = gNodes.map(n => { const d = getNodeDim(n); return { x: n.x||0, y: n.y||0, w: d.width, h: d.height }; });
      const pad = 30;
      groupBoxes[g.id] = {
        left: Math.min(...dims.map(d => d.x - d.w/2)) - pad + offsetX,
        right: Math.max(...dims.map(d => d.x + d.w/2)) + pad + offsetX,
        top: Math.min(...dims.map(d => d.y - d.h/2)) - pad + offsetY,
        bottom: Math.max(...dims.map(d => d.y + d.h/2)) + pad + offsetY,
        label: g.label || g.id
      };
    });
    
    Object.values(groupBoxes).forEach(box => {
      const margin = Math.min((box.right - box.left - 16) / 2, box.label.length * 5.5 + 16);
      const cx = (box.left + box.right) / 2;
      const dGroup = '#94a3b8'; // Matching Slate 400 matrix bond logic
      parts.push(`<path d="M ${cx + margin} ${box.top} L ${box.right - 8} ${box.top} Q ${box.right} ${box.top} ${box.right} ${box.top + 8} L ${box.right} ${box.bottom - 8} Q ${box.right} ${box.bottom} ${box.right - 8} ${box.bottom} L ${box.left + 8} ${box.bottom} Q ${box.left} ${box.bottom} ${box.left} ${box.bottom - 8} L ${box.left} ${box.top + 8} Q ${box.left} ${box.top} ${box.left + 8} ${box.top} L ${cx - margin} ${box.top}" fill="none" stroke="${dGroup}" stroke-width="2" stroke-dasharray="6, 6" opacity="0.6" />`);
      if (!box.label.toLowerCase().startsWith('void')) {
        parts.push(`<text x="${cx}" y="${box.top + 6}" font-size="20" fill="${dGroup}" opacity="0.85" font-weight="700" text-anchor="middle">${escapeXml(box.label.replace(/_/g, ' '))}</text>`);
      }
    });
  }

  // Title
  if (title) {
    parts.push(`<text x="${width/2}" y="30" text-anchor="middle" font-size="20" font-weight="700" fill="#1f2937">${escapeXml(title)}</text>`);
  }

  // Edges
  for (const edge of edges) {
    const pd = pathData[edge.id];
    if (!pd) continue;

    // Skip non-exportable edges (hidden/logical — visual helpers only)
    const style = edge.lineStyle || 'solid';
    const styleDef = LINE_STYLE_REGISTRY[style] || LINE_STYLE_REGISTRY.solid;
    if (styleDef.exportable === false || edge.logical || edge.isBlank) continue;

    const { pathD, textPathD } = pd;
    let dashArray = '';
    if (style === 'dashed') dashArray = ' stroke-dasharray="5,5"';
    if (style === 'dotted') dashArray = ' stroke-dasharray="2,4"';
    const sw = 2;

    
    const ct = edge.arrowType || edge.connectionType || edge.cardinality || 'target';
    let markerEnd = '', markerStart = '';
    if (ct === 'target' || ct === 'both') markerEnd = ' marker-end="url(#arrow)"';
    if (ct === 'source' || ct === 'both') markerStart = ' marker-start="url(#arrow)"';

    // Translate path
    const translatedPath = translatePath(pathD, offsetX, offsetY);
    parts.push(`<path d="${translatedPath}" class="edge-line" stroke-width="${sw}"${dashArray}${markerStart}${markerEnd} />`);
    
    // Edge label
    if (edge.label && diagramType !== 'radial') {
      const translatedTextPath = translatePath(textPathD || pathD, offsetX, offsetY);
      const tpId = `tp_${edge.id}`;
      parts.push(`<path id="${tpId}" d="${translatedTextPath}" fill="none" stroke="none" />`);
      parts.push(`<text class="edge-label"><textPath href="#${tpId}" startOffset="50%" text-anchor="middle">${escapeXml(edge.label)}</textPath></text>`);
    }
  }

  // Nodes
  for (const node of laidOut) {
    const dim = getNodeDim(node);
    const cx = node.x + offsetX;
    const cy = node.y + offsetY;
    const w = node.w || dim.width;
    const h = node.h || dim.height;
    
    // Resolve color from group (matches interactive renderer logic)
    const gId = getGroupId(node);
    const matchedGroup = groups?.find(g => g.id === gId);
    const colorIdx = matchedGroup?.color ?? node.color ?? 0;
    const colorEntry = palette.colors[colorIdx] || palette.colors[1] || { bg: '#e2e8f0', text: '#1f2937' };
    const fill = colorEntry.bg;
    const textColor = colorEntry.text;
    const isOutlined = matchedGroup?.outlined || node.outlined;
    
    if (node.type === 'title' || node.type === 'text') {
      renderNodeText(parts, node, cx, cy, dim, '#1f2937');
    } else if (node.type === 'circle') {
      const r = Math.min(w, h) / 2;
      if (isOutlined) {
        parts.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${fill}" stroke-width="2" />`);
      } else {
        parts.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" rx="6" />`);
      }
      renderNodeText(parts, node, cx, cy, dim, isOutlined ? '#1f2937' : textColor);
    } else if (node.type === 'rhombus') {
      const pts = `${cx},${cy-h/2} ${cx+w/2},${cy} ${cx},${cy+h/2} ${cx-w/2},${cy}`;
      if (isOutlined) {
        parts.push(`<polygon points="${pts}" fill="none" stroke="${fill}" stroke-width="2" />`);
      } else {
        parts.push(`<polygon points="${pts}" fill="${fill}" />`);
      }
      renderNodeText(parts, node, cx, cy, dim, isOutlined ? '#1f2937' : textColor);
    } else {
      // Rectangle (default)
      const rx = node.type === 'oval' ? h / 2 : 6;
      if (isOutlined) {
        parts.push(`<rect x="${cx - w/2}" y="${cy - h/2}" width="${w}" height="${h}" rx="${rx}" fill="none" stroke="${fill}" stroke-width="2" />`);
      } else {
        parts.push(`<rect x="${cx - w/2}" y="${cy - h/2}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" />`);
      }
      renderNodeText(parts, node, cx, cy, dim, isOutlined ? '#1f2937' : textColor);
    }
  }

  parts.push(`</svg>`);
  return { svg: parts.join('\n'), width, height };
}

function renderNodeText(parts, node, cx, cy, dim, color) {
  const text = node.label || node.text || node.id;
  if (!text || String(text).toLowerCase().startsWith('void')) return;
  
  const { lines, fontSize } = wrapTextHeadless(text, dim.width, dim.height, dim.fontSize || 14);
  const lineH = fontSize * 1.2;
  const startY = cy - (lines.length - 1) * lineH / 2;
  
  const fontWeight = node.type === 'title' ? '700' : (node.type === 'text' ? '400' : '600');

  for (let i = 0; i < lines.length; i++) {
    parts.push(`<text x="${cx}" y="${startY + i * lineH}" text-anchor="middle" dominant-baseline="central" font-size="${fontSize}" font-weight="${fontWeight}" fill="${color}">${escapeXml(lines[i])}</text>`);
  }
}

function wrapTextHeadless(text, maxWidth, maxHeight, baseFontSize) {
  if (!text) return { lines: [], fontSize: baseFontSize };
  
  // Minimal headless mathematical measuring simulation
  const measure = (t, size) => t.length * (size * 0.6);
  
  let currentSize = baseFontSize;
  const minSize = 8, paddingX = 16, paddingY = 8;
  
  while (currentSize >= minSize) {
    const words = text.split(/\s+/);
    let lines = [];
    let currentLine = words[0] || '';

    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      if (measure(currentLine + " " + word, currentSize) < maxWidth - paddingX) {
        currentLine += " " + word;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);

    if (lines.length * (currentSize * 1.2) <= maxHeight - paddingY) {
      return { lines, fontSize: currentSize };
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
  return { lines: lines.slice(0, maxAllowedLines), fontSize: minSize };
}

function translatePath(pathD, dx, dy) {
  return pathD.replace(/(-?\d+\.?\d*)\s+(-?\d+\.?\d*)/g, (_, x, y) => {
    return `${(parseFloat(x) + dx).toFixed(1)} ${(parseFloat(y) + dy).toFixed(1)}`;
  });
}

function escapeXml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
