import React from 'react';
import { DIAGRAM_SCHEMAS } from '../../utils/diagramSchemas.js';
import { ARROW_TYPE_REGISTRY, CONNECTION_TYPE_REGISTRY } from '../../registry/edges.js';

const DiagramEdge = React.memo(({ edge, pathData, isSelected, theme, diagramType, onEdgeSelect, onEdgeDoubleClick }) => {
  if (!pathData) return null;
  
  const { pathD, textPathD, textPathLen } = pathData;

  // --- Line style ---
  let style = edge.lineStyle || 'solid';
  // Legacy compat: if AI put lineStyle into connectionType
  if (['solid','dashed','dotted','bold'].includes(edge.connectionType)) style = edge.connectionType;

  let dashArray = 'none';
  const isPrintTheme = theme === 'print-book';
  let strokeW = isPrintTheme ? '1' : '2';
  if (style === 'dashed') dashArray = '5, 5';
  if (style === 'dotted') dashArray = '2, 4';
  if (style === 'bold') strokeW = isPrintTheme ? '2' : '4';
  if (style === 'none' || style === 'hidden') { strokeW = '2'; dashArray = '4, 4'; }

  const markerId = `url(#arrow-${edge.id})`;
  let mStart = 'none';
  let mEnd = 'none';
  let isLogical = style === 'none' || style === 'hidden';

  const activeSchema = DIAGRAM_SCHEMAS[diagramType] || DIAGRAM_SCHEMAS.flowchart;
  const manifest = activeSchema.engineManifest || {};

  if (!manifest.suppressEdgeMarkers) {
    if (edge.connectionType && CONNECTION_TYPE_REGISTRY[edge.connectionType]) {
      // ERD crow's-foot markers from registry
      const ctDef = CONNECTION_TYPE_REGISTRY[edge.connectionType];
      mStart = ctDef.markerStart === 'cf-one'  ? `url(#cf-one-${edge.id})`
             : ctDef.markerStart === 'cf-many' ? `url(#cf-many-${edge.id})` : 'none';
      mEnd   = ctDef.markerEnd   === 'cf-one'  ? `url(#cf-one-${edge.id})`
             : ctDef.markerEnd   === 'cf-many' ? `url(#cf-many-${edge.id})` : 'none';
    } else {
      // Arrow direction from arrowType (default: 'target')
      const at = edge.arrowType || edge.connectionType || 'target'; // connectionType fallback for legacy
      const atDef = ARROW_TYPE_REGISTRY[at] || ARROW_TYPE_REGISTRY.target;
      if (atDef.markerStart) mStart = markerId;
      if (atDef.markerEnd)   mEnd   = markerId;
    }
  }

  let displayLabel = edge.label;
  if (manifest.suppressEdgeLabels) {
      displayLabel = null;
  } else if (displayLabel) {
      if (!textPathD) {
          displayLabel = null; // No valid unbundled segment
      } else {
          let padding = 10;
          if (mStart !== "none") padding += 15;
          if (mEnd !== "none") padding += 15;
          
          let maxChars = Math.floor(((textPathLen || 0) - padding) / 9.6);
          
          // If text is 3 chars or less, we can squeeze it if maxChars is at least 3
          // But if length > maxChars, we NEVER show it. No ellipsis.
          if (displayLabel.length > maxChars) {
              displayLabel = null;
          }
      }
  }

  return (
    <g onClick={() => onEdgeSelect && onEdgeSelect(edge.id)} onDoubleClick={(e) => { e.stopPropagation(); onEdgeDoubleClick && onEdgeDoubleClick(edge.id); }} style={{ cursor: 'pointer' }} className={isLogical ? "logical-link" : ""}>
      {/* Hit area for easier clicking */}
      <path d={pathD} fill="none" stroke="transparent" strokeWidth="20" />
      
      {isSelected && !isLogical && (
        <path d={pathD} fill="none" stroke="#3b82f6" strokeWidth={parseFloat(strokeW) + 8} opacity={0.25} strokeLinecap="round" strokeLinejoin="round" />
      )}
      
      <path 
        d={pathD} 
        fill="none" 
        stroke={isSelected ? "#3b82f6" : edgeColorStr} 
        strokeWidth={strokeW} 
        strokeDasharray={dashArray}
        opacity={isLogical ? (isSelected ? 1 : 0.4) : 1}
        markerStart={mStart}
        markerEnd={mEnd}
      />
      {edge.label && !isLogical && (
        <text 
            fontSize="16" 
            fill={edgeColorStr} 
            dominantBaseline="text-after-edge" 
            fontWeight="bold"
        >
          <textPath href={`#${edge.id}_path`} startOffset="50%" textAnchor="middle">
            {displayLabel}
          </textPath>
      </text>
      )}
      <path id={`${edge.id}_path`} d={textPathD} fill="none" stroke="none" />
      <defs>
        <marker id={`arrow-${edge.id}`} markerWidth="10" markerHeight="6.4" refX="8" refY="3.2" orient="auto-start-reverse">
          {isLogical ? (
              <path d="M 0 0 L 8 3.2 L 0 6.4 z" fill="none" stroke={isSelected ? "#3b82f6" : edgeColorStr} strokeWidth="1" strokeDasharray="1,1" strokeLinecap="round" strokeLinejoin="round" />
          ) : (
              <path d="M 0 0 L 8 3.2 L 0 6.4 z" fill={isSelected ? "#3b82f6" : edgeColorStr} stroke="none" />
          )}
        </marker>
        {/* ERD crow's foot markers */}
        <marker id={`cf-one-${edge.id}`} markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto-start-reverse">
          <line x1="8" y1="1" x2="8" y2="11" stroke={isSelected ? "#3b82f6" : edgeColorStr} strokeWidth="2" />
        </marker>
        <marker id={`cf-many-${edge.id}`} markerWidth="14" markerHeight="14" refX="12" refY="7" orient="auto-start-reverse">
          <line x1="12" y1="1" x2="4" y2="7" stroke={isSelected ? "#3b82f6" : edgeColorStr} strokeWidth="1.5" />
          <line x1="12" y1="13" x2="4" y2="7" stroke={isSelected ? "#3b82f6" : edgeColorStr} strokeWidth="1.5" />
          <line x1="12" y1="7" x2="4" y2="7" stroke={isSelected ? "#3b82f6" : edgeColorStr} strokeWidth="1.5" />
        </marker>
      </defs>
    </g>
  );
});

export default DiagramEdge;
