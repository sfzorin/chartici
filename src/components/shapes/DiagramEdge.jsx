import React from 'react';
import { DIAGRAM_SCHEMAS } from '../../utils/diagramSchemas.js';
import {
  LINE_STYLE_REGISTRY,
  EDGE_LABEL_STYLE,
  ARROW_MARKER,
  CF_MARKERS,
  ARROW_TYPE_REGISTRY,
  CONNECTION_TYPE_REGISTRY,
} from '../../diagram/edges.js';

const DiagramEdge = React.memo(({ edge, pathData, isSelected, theme, diagramType, onEdgeSelect, onEdgeDoubleClick }) => {
  if (!pathData) return null;

  const { pathD, textPathD, textPathLen, pts = [] } = pathData;

  // ── Line style ─────────────────────────────────────────────────────────────
  let styleKey = edge.lineStyle || 'solid';
  // Legacy: AI might have put lineStyle into connectionType
  if (['solid', 'dashed', 'dotted', 'bold'].includes(edge.connectionType)) styleKey = edge.connectionType;

  const styleDef = LINE_STYLE_REGISTRY[styleKey] || LINE_STYLE_REGISTRY.solid;
  const isPrintTheme = theme === 'print-book';
  const dashArray = styleDef.dashArray;
  const strokeW   = String(isPrintTheme ? (styleDef.print?.strokeWidth ?? styleDef.strokeWidth) : styleDef.strokeWidth);
  const isLogical = styleKey === 'none';
  const baseOpacity = isLogical ? (styleDef.logicalOpacity ?? 0.4) : styleDef.opacity ?? 1;

  // ── Markers ────────────────────────────────────────────────────────────────
  const edgeColorStr = 'var(--diagram-edge)';
  const selColor     = '#3b82f6';
  const activeColor  = isSelected ? selColor : edgeColorStr;

  const markerId = `url(#arrow-${edge.id})`;
  let mStart = 'none';
  let mEnd   = 'none';

  const activeSchema = DIAGRAM_SCHEMAS[diagramType] || DIAGRAM_SCHEMAS.flowchart;
  const manifest = activeSchema.engineManifest || {};

  if (!manifest.suppressEdgeMarkers) {
    if (edge.connectionType && CONNECTION_TYPE_REGISTRY[edge.connectionType]) {
      const ctDef = CONNECTION_TYPE_REGISTRY[edge.connectionType];
      mStart = ctDef.markerStart === 'cf-one'  ? `url(#cf-one-${edge.id})`
             : ctDef.markerStart === 'cf-many' ? `url(#cf-many-${edge.id})` : 'none';
      mEnd   = ctDef.markerEnd   === 'cf-one'  ? `url(#cf-one-${edge.id})`
             : ctDef.markerEnd   === 'cf-many' ? `url(#cf-many-${edge.id})` : 'none';
    } else {
      const at = edge.arrowType || edge.connectionType || 'target';
      const atDef = ARROW_TYPE_REGISTRY[at] || ARROW_TYPE_REGISTRY.target;
      if (atDef.markerStart) mStart = markerId;
      if (atDef.markerEnd)   mEnd   = markerId;
    }
  }

  // ── Label ──────────────────────────────────────────────────────────────────
  const L = diagramType === 'erd'
    ? {
        ...EDGE_LABEL_STYLE,
        fontSize: 11,
        charWidth: 5.9,
        basePadding: 2,
        arrowPadding: 0,
        haloWidth: 3,
        offsetY: -5,
      }
    : EDGE_LABEL_STYLE;
  let displayLabel = edge.label;
  if (manifest.suppressEdgeLabels) {
    displayLabel = null;
  } else if (displayLabel) {
    if (!textPathD) {
      displayLabel = null;
    } else if (diagramType !== 'erd' && diagramType !== 'flowchart') {
      let padding = L.basePadding;
      if (mStart !== 'none') padding += L.arrowPadding;
      if (mEnd   !== 'none') padding += L.arrowPadding;
      const maxChars = Math.floor(((textPathLen || 0) - padding) / L.charWidth);
      if (displayLabel.length > maxChars && displayLabel.length > 10) displayLabel = null;
    } else if (diagramType === 'flowchart' && (textPathLen || 0) < 24) {
      displayLabel = null;
    } else if ((textPathLen || 0) < 36) {
      displayLabel = null;
    }
  }

  // ── Arrow marker defs ──────────────────────────────────────────────────────
  const AM = ARROW_MARKER;
  const cfOne  = CF_MARKERS.one;
  const cfMany = CF_MARKERS.many;
  const isErdLabel = diagramType === 'erd' && displayLabel && !isLogical;
  const isFlowchartLabel = diagramType === 'flowchart' && displayLabel && !isLogical;

  const getSegmentLabelPlacement = ({ sourceBiased = false } = {}) => {
    if (!pts || pts.length < 2) return null;
    const labelWidth = Math.max(36, String(displayLabel).length * L.charWidth + 14);
    const labelHeight = L.fontSize + 8;
    const sourceGap = 6;
    let best = null;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy);
      if (len < 24) continue;
      const horizontal = Math.abs(dx) >= Math.abs(dy);
      const readableLen = labelWidth + sourceGap * 2;
      if (sourceBiased && len >= readableLen) {
        best = { a, b, dx, dy, len, horizontal, labelWidth, labelHeight, score: Infinity, index: i };
        break;
      }
      const tooShortPenalty = len < readableLen ? (readableLen - len) * (sourceBiased ? 8 : 3) : 0;
      const sourcePenalty = sourceBiased ? i * 220 : -i * 0.1;
      const score = -sourcePenalty
        + Math.min(len, 240)
        + (horizontal ? 80 : 0)
        + (len >= readableLen ? 160 : 0)
        - tooShortPenalty;
      if (!best || score > best.score) best = { a, b, dx, dy, len, horizontal, labelWidth, labelHeight, score, index: i };
    }
    if (!best) return null;
    const t = sourceBiased ? Math.min(0.48, (labelWidth / 2 + sourceGap) / best.len) : 0.36;
    const x = best.a.x + best.dx * t + (best.horizontal ? 0 : -7);
    const y = best.a.y + best.dy * t + (best.horizontal ? -7 : 0);
    return { x, y, labelWidth: best.labelWidth, labelHeight: best.labelHeight, angle: best.horizontal ? 0 : -90 };
  };

  const getErdLabelPlacement = () => {
    if (!pts || pts.length < 2) return null;
    const midIndex = Math.max(0, Math.floor((pts.length - 1) / 2));
    const labelWidth = Math.max(36, String(displayLabel).length * L.charWidth + 18);
    const candidates = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy);
      if (len < 32) continue;
      const horizontal = Math.abs(dx) >= Math.abs(dy);
      const nearEndpointPenalty = (i === 0 || i === pts.length - 2) ? 140 : 0;
      const centerPenalty = Math.abs(i - midIndex) * 10;
      const readableBonus = len >= labelWidth + 32 ? 180 : -(labelWidth + 32 - len) * 2.5;
      const score = Math.min(len, 260) + readableBonus + (horizontal ? 24 : 12) - nearEndpointPenalty - centerPenalty;
      candidates.push({ a, b, dx, dy, len, horizontal, score });
    }
    const best = candidates.sort((a, b) => b.score - a.score)[0];
    if (!best) return null;

    const labelHeight = L.fontSize + 6;
    const t = 0.5;
    const normalX = best.horizontal ? 0 : -1;
    const normalY = best.horizontal ? -1 : 0;
    const offset = 7;
    const x = best.a.x + best.dx * t + normalX * offset;
    const y = best.a.y + best.dy * t + normalY * offset;
    return { x, y, labelWidth, labelHeight, angle: best.horizontal ? 0 : -90 };
  };

  const erdLabelPlacement = isErdLabel ? getErdLabelPlacement() : null;
  const flowchartLabelPlacement = isFlowchartLabel ? getSegmentLabelPlacement({ sourceBiased: true }) : null;

  return (
    <g
      onClick={() => onEdgeSelect && onEdgeSelect(edge.id)}
      onDoubleClick={(e) => { e.stopPropagation(); onEdgeDoubleClick && onEdgeDoubleClick(edge.id); }}
      style={{ cursor: 'pointer' }}
      className={isLogical ? 'logical-link' : ''}
    >
      {/* Hit area for easier clicking */}
      <path d={pathD} fill="none" stroke="transparent" strokeWidth="20" />

      {isSelected && !isLogical && (
        <path d={pathD} fill="none" stroke={selColor} strokeWidth={parseFloat(strokeW) + 8} opacity={0.25} strokeLinecap="round" strokeLinejoin="round" />
      )}

      <path
        d={pathD}
        fill="none"
        stroke={activeColor}
        strokeWidth={strokeW}
        strokeDasharray={dashArray}
        opacity={isLogical ? (isSelected ? 1 : baseOpacity) : baseOpacity}
        markerStart={mStart}
        markerEnd={mEnd}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {isErdLabel && erdLabelPlacement && (
        <g
          transform={`rotate(${erdLabelPlacement.angle} ${erdLabelPlacement.x} ${erdLabelPlacement.y})`}
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          <text
            x={erdLabelPlacement.x}
            y={erdLabelPlacement.y + 0.5}
            fontSize={L.fontSize}
            fill={edgeColorStr}
            stroke="var(--diagram-label-halo)"
            strokeWidth={L.haloWidth}
            paintOrder="stroke fill"
            dominantBaseline="middle"
            textAnchor="middle"
            fontWeight={L.fontWeight}
            letterSpacing="0"
          >
            {displayLabel}
          </text>
        </g>
      )}

      {isFlowchartLabel && flowchartLabelPlacement && (
        <g
          transform={`rotate(${flowchartLabelPlacement.angle} ${flowchartLabelPlacement.x} ${flowchartLabelPlacement.y})`}
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          <text
            x={flowchartLabelPlacement.x}
            y={flowchartLabelPlacement.y}
            fontSize={L.fontSize}
            fill={edgeColorStr}
            stroke="var(--diagram-label-halo)"
            strokeWidth={L.haloWidth}
            paintOrder="stroke fill"
            dominantBaseline="middle"
            textAnchor="middle"
            fontWeight={L.fontWeight}
            letterSpacing="0"
          >
            {displayLabel}
          </text>
        </g>
      )}

      {displayLabel && !isLogical && !isErdLabel && !isFlowchartLabel && (
        <text
          fontSize={L.fontSize}
          fill={edgeColorStr}
          stroke="var(--diagram-label-halo)"
          strokeWidth={L.haloWidth}
          paintOrder="stroke fill"
          dominantBaseline="middle"
          fontWeight={L.fontWeight}
          letterSpacing="0"
          dy={L.offsetY}
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          <textPath href={`#${edge.id}_path`} startOffset="14%" textAnchor="middle">
            {displayLabel}
          </textPath>
        </text>
      )}
      <path id={`${edge.id}_path`} d={textPathD} fill="none" stroke="none" />

      <defs>
        {/* Standard arrowhead */}
        <marker id={`arrow-${edge.id}`} markerWidth={AM.width} markerHeight={AM.height} refX={AM.refX} refY={AM.refY} orient={AM.orient}>
          {isLogical ? (
            <path d={AM.logicalD} fill="none" stroke={activeColor} strokeWidth={AM.logicalStrokeWidth} strokeDasharray={AM.logicalDashArray} strokeLinecap="round" strokeLinejoin="round" />
          ) : (
            <path d={AM.solidD} fill={activeColor} stroke="none" />
          )}
        </marker>

        {/* ERD one-marker */}
        <marker id={`cf-one-${edge.id}`} markerWidth={cfOne.width} markerHeight={cfOne.height} refX={cfOne.refX} refY={cfOne.refY} orient={cfOne.orient}>
          {cfOne.lines.map((l, i) => (
            <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke={activeColor} strokeWidth={l.strokeWidth} />
          ))}
        </marker>

        {/* ERD many-marker */}
        <marker id={`cf-many-${edge.id}`} markerWidth={cfMany.width} markerHeight={cfMany.height} refX={cfMany.refX} refY={cfMany.refY} orient={cfMany.orient}>
          {cfMany.lines.map((l, i) => (
            <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke={activeColor} strokeWidth={l.strokeWidth} />
          ))}
        </marker>
      </defs>
    </g>
  );
});

export default DiagramEdge;
