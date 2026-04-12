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

  const { pathD, textPathD, textPathLen } = pathData;

  // ── Line style ─────────────────────────────────────────────────────────────
  let styleKey = edge.lineStyle || 'solid';
  // Legacy: AI might have put lineStyle into connectionType
  if (['solid', 'dashed', 'dotted', 'bold'].includes(edge.connectionType)) styleKey = edge.connectionType;

  const styleDef = LINE_STYLE_REGISTRY[styleKey] || LINE_STYLE_REGISTRY.solid;
  const isPrintTheme = theme === 'print-book';
  const dashArray = styleDef.dashArray;
  const strokeW   = String(isPrintTheme ? (styleDef.print?.strokeWidth ?? styleDef.strokeWidth) : styleDef.strokeWidth);
  const isLogical = styleKey === 'none' || styleKey === 'hidden';
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
  const L = EDGE_LABEL_STYLE;
  let displayLabel = edge.label;
  if (manifest.suppressEdgeLabels) {
    displayLabel = null;
  } else if (displayLabel) {
    if (!textPathD) {
      displayLabel = null;
    } else {
      let padding = L.basePadding;
      if (mStart !== 'none') padding += L.arrowPadding;
      if (mEnd   !== 'none') padding += L.arrowPadding;
      const maxChars = Math.floor(((textPathLen || 0) - padding) / L.charWidth);
      if (displayLabel.length > maxChars) displayLabel = null;
    }
  }

  // ── Arrow marker defs ──────────────────────────────────────────────────────
  const AM = ARROW_MARKER;
  const cfOne  = CF_MARKERS.one;
  const cfMany = CF_MARKERS.many;

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
      />

      {edge.label && !isLogical && (
        <text
          fontSize={L.fontSize}
          fill={edgeColorStr}
          dominantBaseline="text-after-edge"
          fontWeight={L.fontWeight}
        >
          <textPath href={`#${edge.id}_path`} startOffset="50%" textAnchor="middle">
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
