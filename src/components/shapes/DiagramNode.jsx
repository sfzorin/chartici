import React from 'react';
import { getNodeDim } from '../../utils/constants';
import { getFittedText } from '../../utils/textUtils';
import { ShapeRegistry } from './ShapeRegistry';
import { DIAGRAM_SCHEMAS } from '../../utils/diagramSchemas.js';

const DiagramNode = React.memo(({ 
  node, 
  isSelected, 
  theme, 
  dragStateId, 
  onPointerDown,
  onDoubleClick,
  isHovered,
  isTargetHovered,
  onHoverChange,
  onStartConnection,
  isActiveLinkSource,
  diagramType
}) => {
  const dim = getNodeDim(node);
  const NODE_WIDTH = node.w || dim.width;
  const NODE_HEIGHT = node.h || dim.height;
  const FONT_SIZE = dim.fontSize;
  
  const isDraggingNode = dragStateId === node.id;

  const commonProps = {
    className: `diagram-node ${isSelected ? 'selected' : ''} ${isActiveLinkSource ? 'node-link-active' : ''}`,
    onPointerDown: (e) => onPointerDown(e, node.id),
    onPointerEnter: (e) => onHoverChange && onHoverChange(node.id, true),
    onPointerLeave: (e) => onHoverChange && onHoverChange(node.id, false),
    style: { cursor: isDraggingNode ? 'grabbing' : 'grab' },
    'data-node-id': node.id,
    'data-logical-x': node.x || 0,
    'data-logical-y': node.y || 0
  };

  const getContrastYIQ = (hexcolor) => {
    hexcolor = hexcolor.replace("#", "");
    if (hexcolor.length === 3) {
      hexcolor = hexcolor.split('').map(x => x + x).join('');
    }
    const r = parseInt(hexcolor.slice(0, 2), 16);
    const g = parseInt(hexcolor.slice(2, 4), 16);
    const b = parseInt(hexcolor.slice(4, 6), 16);
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return (yiq >= 128) ? '#1a1a1a' : '#ffffff';
  };

  const resolveColor = (c, type) => {
    if (c === undefined || c === null) return 'transparent';
    const isHex = String(c).startsWith('#');
    
    if (node.outlined) {
       // Outline Mode Logic
       if (isHex) {
          if (type === 'bg') return 'transparent';
          if (type === 'text') return 'var(--diagram-text)';
          if (type === 'border') return c;
       } else {
          // Standard Palette Outline
          if (type === 'bg') return 'transparent';
          if (type === 'text') return 'var(--diagram-text)';
          if (type === 'border') return `var(--color-${c})`;
       }
    } else {
       // Solid Mode Logic (Default)
       if (isHex) {
          if (type === 'text') return getContrastYIQ(String(c));
          if (type === 'border') return 'transparent'; 
          return c; // bg
       }
       if (type === 'bg') return `var(--color-${c})`;
       if (type === 'text') return `var(--text-color-${c})`;
       if (type === 'border') return `var(--border-color-${c})`;
       return `var(--color-${c})`;
    }
  };
  const isPrintTheme = theme === 'print-book';
  
  const isTransp = (node.color === 'transparent');
  const baseColorToken = (node.color !== undefined && node.color !== 'transparent') ? node.color : 5;

  let panelFill, strokeColor, textColor;

  if (isTransp) {
    panelFill = 'transparent';
    strokeColor = resolveColor(baseColorToken, 'bg'); 
    textColor = 'var(--unfilled-text-color)'; 
  } else {
    panelFill = resolveColor(baseColorToken, 'bg');
    strokeColor = resolveColor(baseColorToken, 'border'); 
    textColor = resolveColor(baseColorToken, 'text');
  }
  const fontWeight = node.fontStyle === 'bold' ? 'bold' : 'normal';
  const fontStyle = node.fontStyle === 'italic' ? 'italic' : 'normal';
  
  let strokeW = isPrintTheme ? "1" : (node.outlined ? "3" : "2");
  
  if (isDraggingNode) {
    strokeColor = 'var(--color-primary-dark)';
    strokeW = "4";
  }

  const numColor = Number(baseColorToken);
  
  // Override for Text Only nodes
  if (node.type === 'text' || node.type === 'title') {
    textColor = 'var(--diagram-text)';
  }

  if (!isNaN(numColor) && numColor >= 11 && numColor <= 19) {
    strokeW = isPrintTheme ? "2" : "4";
  }
  const shadowFilter = 'none';

  let actualType = node.type;
  const activeSchema = DIAGRAM_SCHEMAS[diagramType] || DIAGRAM_SCHEMAS.default;
  if (node.isTimelineSpine && activeSchema.engineManifest?.spineNodeType) {
      actualType = activeSchema.engineManifest.spineNodeType;
  }
  if (node.isPieSlice) {
      actualType = 'pie_slice';
  }
  if (!ShapeRegistry[actualType]) {
      actualType = 'process';
  }

  const shapePlugins = ShapeRegistry[actualType];
  const limits = shapePlugins.getTextLimits(NODE_WIDTH, NODE_HEIGHT);
  const textMaxWidth = limits.maxWidth;
  const textMaxHeight = limits.maxHeight;

  const renderLabel = (precomputedWrap = null) => {
    const rawLabel = String(node.label || '');
    if (rawLabel.toLowerCase().startsWith('void')) return null;
    
    const wrap = precomputedWrap || getFittedText(rawLabel, textMaxWidth, textMaxHeight, Number(FONT_SIZE), fontStyle, fontWeight);
    const totalH = wrap.lines.length * (wrap.fontSize * 1.2);
    const startY = (NODE_HEIGHT / 2) - (totalH / 2) + ((wrap.fontSize * 1.2) / 2);
    return wrap.lines.map((line, i) => (
      <text 
        key={i}
        x={NODE_WIDTH/2} 
        y={startY + i * (wrap.fontSize * 1.2) - (wrap.fontSize * 0.1)} 
        textAnchor="middle" 
        dominantBaseline="central"
        fill={textColor}
        fontSize={wrap.fontSize}
        fontWeight={fontWeight}
        fontStyle={fontStyle}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        {line}
      </text>
    ));
  };
  

  let shape = shapePlugins.render(NODE_WIDTH, NODE_HEIGHT, panelFill, strokeColor, strokeW, node.borderStyle === 'dashed' ? '5,5' : 'none', shadowFilter, node);

  const renderPorts = () => {
    if (!isHovered && !isTargetHovered) return null;
    
    let leftX = 0;
    let rightX = NODE_WIDTH;
    let topY = 0;
    let bottomY = NODE_HEIGHT;
    
    if (node.type === 'circle') {
       const r = Math.min(NODE_WIDTH, NODE_HEIGHT) / 2;
       leftX = (NODE_WIDTH / 2) - r;
       rightX = (NODE_WIDTH / 2) + r;
       topY = (NODE_HEIGHT / 2) - r;
       bottomY = (NODE_HEIGHT / 2) + r;
    }

    let ports = [
      { id: 'top', cx: NODE_WIDTH / 2, cy: topY },
      { id: 'right', cx: rightX, cy: NODE_HEIGHT / 2 },
      { id: 'bottom', cx: NODE_WIDTH / 2, cy: bottomY },
      { id: 'left', cx: leftX, cy: NODE_HEIGHT / 2 }
    ];
    if (actualType === 'chevron' || node.isTimelineSpine) {
      ports = ports.filter(p => p.id === 'top' || p.id === 'bottom');
    }

    return ports.map(p => (
       <g 
          key={p.id}
          style={{ cursor: 'crosshair', pointerEvents: 'all' }}
          onPointerDown={(e) => {
             e.stopPropagation();
             e.preventDefault();
             try { e.target.setPointerCapture(e.pointerId); } catch {}
             if (onStartConnection) onStartConnection(node.id, {
                 ...p,
                 cx: p.cx - NODE_WIDTH / 2,
                 cy: p.cy - NODE_HEIGHT / 2
             });
          }}
        >
         {/* Desktop hit area (32px diameter) */}
         <circle cx={p.cx} cy={p.cy} r="16" fill="none" pointerEvents="all" stroke="none" />
         {/* Touch hit area (72px diameter, shown only on mobile via CSS) */}
         <circle cx={p.cx} cy={p.cy} r="36" fill="none" pointerEvents="all" stroke="none" className="touch-port-hitbox" />
         {/* Visual dot */}
         <circle cx={p.cx} cy={p.cy} r="5" fill="#007BFF" stroke="#fff" strokeWidth="2" />
       </g>
    ));
  };

  const SEL_PADDING = 5;
  const SEL_COLOR = "#3b82f6";
  let selectionBound = (
    <g>
      <rect x={-SEL_PADDING} y={-SEL_PADDING} width={NODE_WIDTH+(SEL_PADDING*2)} height={NODE_HEIGHT+(SEL_PADDING*2)} fill="none" stroke={SEL_COLOR} strokeWidth="10" opacity="0.3" rx="10" />
      <rect x={-SEL_PADDING} y={-SEL_PADDING} width={NODE_WIDTH+(SEL_PADDING*2)} height={NODE_HEIGHT+(SEL_PADDING*2)} fill="none" stroke={SEL_COLOR} strokeWidth="2" rx="10" />
    </g>
  );
  if (node.type === 'circle' || actualType === 'pie_slice') {
     const r = Math.min(NODE_WIDTH, NODE_HEIGHT) / 2;
     selectionBound = (
        <g>
          <circle cx={NODE_WIDTH/2} cy={NODE_HEIGHT/2} r={r + SEL_PADDING} fill="none" stroke={SEL_COLOR} strokeWidth="10" opacity="0.3" />
          <circle cx={NODE_WIDTH/2} cy={NODE_HEIGHT/2} r={r + SEL_PADDING} fill="none" stroke={SEL_COLOR} strokeWidth="2" />
        </g>
     );
  } else if (node.type === 'oval') {
     const ovalRx = (Math.min(NODE_WIDTH, NODE_HEIGHT)/2)+SEL_PADDING;
     selectionBound = (
        <g>
          <rect x={-SEL_PADDING} y={-SEL_PADDING} width={NODE_WIDTH+(SEL_PADDING*2)} height={NODE_HEIGHT+(SEL_PADDING*2)} rx={ovalRx} fill="none" stroke={SEL_COLOR} strokeWidth="10" opacity="0.3" />
          <rect x={-SEL_PADDING} y={-SEL_PADDING} width={NODE_WIDTH+(SEL_PADDING*2)} height={NODE_HEIGHT+(SEL_PADDING*2)} rx={ovalRx} fill="none" stroke={SEL_COLOR} strokeWidth="2" />
        </g>
     );
  }

  return (
    <g transform={`translate(${(node.x || 0) - NODE_WIDTH / 2}, ${(node.y || 0) - NODE_HEIGHT / 2})`} filter={shadowFilter} {...commonProps}
       onDoubleClick={(e) => onDoubleClick && onDoubleClick(e, node.id)}
    >
      {shape}
      {renderLabel()}
      {isSelected && React.cloneElement(selectionBound, { style: { pointerEvents: 'none' } })}
      {renderPorts()}
    </g>
  );
});

export default DiagramNode;
