import React from 'react';
import { DIAGRAM_SCHEMAS } from '../../utils/diagramSchemas.js';
import {
  LINE_STYLE_REGISTRY,
  ARROW_MARKER,
  CF_MARKERS,
  ARROW_TYPE_REGISTRY,
  CONNECTION_TYPE_REGISTRY,
} from '../../diagram/edges.js';
import {
  getEdgeLabelPolicy,
  getEdgeLabelStyle,
  getFittedManualEdgeLabel,
  getManualEdgeLabelPlacement,
  getTextPathStartOffset,
  truncateLabelToWidth,
  usesManualEdgeLabels,
} from '../../diagram/edgeLabelPlacement.js';

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
  const selColor     = '#be355d';
  const activeColor  = isSelected ? selColor : edgeColorStr;

  const markerId = `url(#arrow-${edge.id})`;
  let mStart = 'none';
  let mEnd   = 'none';

  const activeSchema = DIAGRAM_SCHEMAS[diagramType] || DIAGRAM_SCHEMAS.flowchart;
  const manifest = activeSchema.engineManifest || {};
  const labelPolicy = getEdgeLabelPolicy(diagramType);

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
  if (pathData.suppressMarkerStart) mStart = 'none';
  if (pathData.suppressMarkerEnd) mEnd = 'none';
  const markedLineCap = (mStart !== 'none' || mEnd !== 'none') ? 'butt' : 'round';
  const masksStandardArrow = mStart === markerId || mEnd === markerId;
  const strokeMaskId = `edge-stroke-mask-${edge.id}`;

  // ── Label ──────────────────────────────────────────────────────────────────
  const L = getEdgeLabelStyle(labelPolicy);
  const useManualLabels = usesManualEdgeLabels(labelPolicy);
  let displayLabel = edge.label;
  let effectiveLabelFontSize = L.fontSize;
  const effectiveCharWidth = Math.max(8, L.charWidth || 0);
  if (manifest.suppressEdgeLabels) {
    displayLabel = null;
  } else if (displayLabel) {
    if (!textPathD) {
      displayLabel = null;
    } else if (!useManualLabels) {
      let padding = L.basePadding;
      if (mStart !== 'none') padding += L.arrowPadding;
      if (mEnd   !== 'none') padding += L.arrowPadding;
      const available = Math.max(0, (textPathLen || 0) - padding);
      const labelWidth = String(displayLabel).length * effectiveCharWidth;
      if (labelWidth > available) {
        const minFontSize = labelPolicy?.strategy === 'message-center' ? 9 : 10;
        const scale = available / Math.max(1, labelWidth);
        effectiveLabelFontSize = Math.max(minFontSize, Math.floor(L.fontSize * scale * 10) / 10);
        if (effectiveLabelFontSize <= minFontSize && labelWidth * (minFontSize / L.fontSize) > available) {
          displayLabel = truncateLabelToWidth(displayLabel, available * (L.fontSize / minFontSize), effectiveCharWidth);
          effectiveLabelFontSize = minFontSize;
        }
      }
    } else {
      displayLabel = pathData.displayLabel ?? getFittedManualEdgeLabel({ labelPolicy, displayLabel, pts, labelStyle: L });
    }
  }

  // ── Arrow marker defs ──────────────────────────────────────────────────────
  const AM = ARROW_MARKER;
  const cfOne  = CF_MARKERS.one;
  const cfMany = CF_MARKERS.many;
  const manualLabelPlacement = !isLogical
    ? (pathData.manualLabelPlacement ?? getManualEdgeLabelPlacement({ labelPolicy, displayLabel, pts, labelStyle: L }))
    : null;
  const textPathStartOffset = getTextPathStartOffset(labelPolicy);
  const terminalMasks = masksStandardArrow
    ? buildTerminalStrokeMasks({ pts, markerStart: mStart === markerId, markerEnd: mEnd === markerId })
    : [];
  const strokeMaskUrl = terminalMasks.length > 0 ? `url(#${strokeMaskId})` : undefined;

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
        <path d={pathD} fill="none" stroke={selColor} strokeWidth={parseFloat(strokeW) + 6} opacity={0.18} strokeLinecap="round" strokeLinejoin="round" />
      )}

      <path
        d={pathD}
        fill="none"
        stroke={activeColor}
        strokeWidth={strokeW}
        strokeDasharray={dashArray}
        opacity={isLogical ? (isSelected ? 1 : baseOpacity) : baseOpacity}
        mask={strokeMaskUrl}
        strokeLinecap={markedLineCap}
        strokeLinejoin="round"
      />

      {(mStart !== 'none' || mEnd !== 'none') && (
        <path
          d={pathD}
          fill="none"
          stroke="transparent"
          strokeWidth={strokeW}
          markerStart={mStart}
          markerEnd={mEnd}
          strokeLinecap="butt"
          strokeLinejoin="round"
          pointerEvents="none"
        />
      )}

      {manualLabelPlacement && (
        <g
          transform={`rotate(${manualLabelPlacement.angle} ${manualLabelPlacement.x} ${manualLabelPlacement.y})`}
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          <text
            x={manualLabelPlacement.x}
            y={manualLabelPlacement.y + 0.5}
            fontSize={L.fontSize}
            fill="none"
            stroke="var(--diagram-label-halo)"
            strokeWidth={L.haloWidth}
            strokeLinejoin="round"
            dominantBaseline="middle"
            textAnchor={manualLabelPlacement.textAnchor || 'middle'}
            fontWeight={L.fontWeight}
            letterSpacing="0"
          >
            {displayLabel}
          </text>
          <text
            x={manualLabelPlacement.x}
            y={manualLabelPlacement.y + 0.5}
            fontSize={L.fontSize}
            fill={edgeColorStr}
            dominantBaseline="middle"
            textAnchor={manualLabelPlacement.textAnchor || 'middle'}
            fontWeight={L.fontWeight}
            letterSpacing="0"
          >
            {displayLabel}
          </text>
        </g>
      )}

      {displayLabel && !isLogical && !manualLabelPlacement && (
        <g style={{ pointerEvents: 'none', userSelect: 'none' }}>
          <text
            fontSize={effectiveLabelFontSize}
            fill="none"
            stroke="var(--diagram-label-halo)"
            strokeWidth={L.haloWidth}
            strokeLinejoin="round"
            dominantBaseline="middle"
            fontWeight={L.fontWeight}
            letterSpacing="0"
            dy={L.offsetY}
          >
            <textPath href={`#${edge.id}_path`} startOffset={textPathStartOffset} textAnchor="middle">
              {displayLabel}
            </textPath>
          </text>
          <text
            fontSize={effectiveLabelFontSize}
            fill={edgeColorStr}
            dominantBaseline="middle"
            fontWeight={L.fontWeight}
            letterSpacing="0"
            dy={L.offsetY}
          >
            <textPath href={`#${edge.id}_path`} startOffset={textPathStartOffset} textAnchor="middle">
              {displayLabel}
            </textPath>
          </text>
        </g>
      )}
      <path id={`${edge.id}_path`} d={textPathD} fill="none" stroke="none" />

      <defs>
        {terminalMasks.length > 0 && (
          <mask id={strokeMaskId} maskUnits="userSpaceOnUse" x="-100000" y="-100000" width="200000" height="200000">
            <rect x="-100000" y="-100000" width="200000" height="200000" fill="white" />
            {terminalMasks.map((m, i) => (
              <line
                key={i}
                x1={m.x1}
                y1={m.y1}
                x2={m.x2}
                y2={m.y2}
                stroke="black"
                strokeWidth={m.width}
                strokeLinecap="butt"
              />
            ))}
          </mask>
        )}

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

function buildTerminalStrokeMasks({ pts, markerStart, markerEnd }) {
  if (!Array.isArray(pts) || pts.length < 2) return [];
  const masks = [];
  if (markerStart) {
    const mask = terminalMaskSegment(pts[0], pts[1]);
    if (mask) masks.push(mask);
  }
  if (markerEnd) {
    const mask = terminalMaskSegment(pts[pts.length - 1], pts[pts.length - 2]);
    if (mask) masks.push(mask);
  }
  return masks;
}

function terminalMaskSegment(endpoint, inward) {
  if (!endpoint || !inward) return null;
  const dx = inward.x - endpoint.x;
  const dy = inward.y - endpoint.y;
  const len = Math.hypot(dx, dy);
  if (len <= 0.01) return null;
  const erase = Math.min(8, Math.max(4, len - 1));
  const ux = dx / len;
  const uy = dy / len;
  return {
    x1: endpoint.x,
    y1: endpoint.y,
    x2: endpoint.x + ux * erase,
    y2: endpoint.y + uy * erase,
    width: 18,
  };
}

export default DiagramEdge;
