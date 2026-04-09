import React from 'react';
import { getNodeDim } from '../../utils/constants';
import { getFittedText } from '../../utils/textUtils';

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

  let textMaxWidth = NODE_WIDTH;
  let textMaxHeight = NODE_HEIGHT;
  
  if (node.type === 'circle') {
    textMaxWidth = Math.min(NODE_WIDTH, NODE_HEIGHT) * 0.75;
    textMaxHeight = textMaxWidth;
  } else if (node.type === 'rhombus') {
    textMaxWidth = NODE_WIDTH * 0.6;
    textMaxHeight = NODE_HEIGHT * 0.6;
  } else if (node.type === 'element') {
    textMaxWidth = NODE_WIDTH * 0.85; 
    textMaxHeight = NODE_HEIGHT * 0.85;
  } else if (node.type === 'oval') {
    textMaxWidth = NODE_WIDTH - Math.min(NODE_WIDTH, NODE_HEIGHT) * 0.5;
  } else if (node.type === 'pie_slice') {
    textMaxWidth = (Math.min(NODE_WIDTH, NODE_HEIGHT) / 2) * 0.6;
    textMaxHeight = textMaxWidth;
  }

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
  
  let actualType = node.type;
  if (diagramType === 'timeline' && node.isTimelineSpine) {
      actualType = 'chevron';
  }
  
  let shape;
  switch(actualType) {
    case 'circle':
      {
        const r = Math.min(NODE_WIDTH, NODE_HEIGHT) / 2;
        shape = (
          <g>
            <circle cx={NODE_WIDTH/2} cy={NODE_HEIGHT/2} r={r} fill={panelFill} stroke={strokeColor} strokeWidth={strokeW} />
            {renderLabel()}
          </g>
        );
      }
      break;
    case 'chevron':
      {
        const w = NODE_WIDTH;
        const h = NODE_HEIGHT;
        const cut = h * 0.25; // 25% height exactly locks angle across all scaled sizes
        const dExt = (node.timelineDelta || 0) / 2; 
        
        // Chevron draws OUTSIDE its logical box to interlock beautifully
        // It stretches left by dExt and right by dExt to consume exactly 'delta' pixels of Daylight!
        // Text perfectly centered organically!
        const d = `M -${cut + dExt} 0 L ${w + dExt} 0 L ${w + cut + dExt} ${h/2} L ${w + dExt} ${h} L -${cut + dExt} ${h} L -${dExt} ${h/2} Z`;
        shape = (
          <g>
            <path d={d} fill={panelFill} stroke={strokeColor} strokeWidth={strokeW} strokeLinejoin="round" />
            {renderLabel()}
          </g>
        );
      }
      break;
    case 'rhombus':
      {
        const r = 3;
        const w = NODE_WIDTH;
        const h = NODE_HEIGHT;
        const ex = 1.5; // Compensate for Q-curve inward shrinkage
        const pts = [ 
          {x: -ex, y: h/2}, 
          {x: w/2, y: -ex}, 
          {x: w+ex, y: h/2}, 
          {x: w/2, y: h+ex} 
        ];
        let d = '';
        for (let i = 0; i < 4; i++) {
          const p1 = pts[(i+3)%4], p2 = pts[i], p3 = pts[(i+1)%4];
          const d1 = Math.hypot(p2.x - p1.x, p2.y - p1.y);
          const d2 = Math.hypot(p3.x - p2.x, p3.y - p2.y);
          const qStartX = p2.x + ((p1.x - p2.x) / d1) * r;
          const qStartY = p2.y + ((p1.y - p2.y) / d1) * r;
          const qEndX = p2.x + ((p3.x - p2.x) / d2) * r;
          const qEndY = p2.y + ((p3.y - p2.y) / d2) * r;
          if (i === 0) d += `M ${qStartX} ${qStartY}`;
          else d += ` L ${qStartX} ${qStartY}`;
          d += ` Q ${p2.x} ${p2.y} ${qEndX} ${qEndY}`;
        }
        d += ' Z';
        
        shape = (
          <g>
            <path d={d} fill={panelFill} stroke={strokeColor} strokeWidth={strokeW} />
            {renderLabel()}
          </g>
        );
      }
      break;
    case 'pie_slice':
      {
        const r = Math.min(NODE_WIDTH, NODE_HEIGHT) / 2;
        const cx = NODE_WIDTH / 2;
        const cy = NODE_HEIGHT / 2;
        const startRaw = node.pieStartAngle || 0;
        const endRaw = node.pieEndAngle || Math.PI * 2;
        
        // Shift by -90 deg so the pie starts at 12 o'clock, which is standard
        const start = startRaw - Math.PI / 2;
        const end = endRaw - Math.PI / 2;
        
        const x1 = cx + r * Math.cos(start);
        const y1 = cy + r * Math.sin(start);
        const x2 = cx + r * Math.cos(end);
        const y2 = cy + r * Math.sin(end);
        
        const largeArcFlag = end - start <= Math.PI ? "0" : "1";
        
        let d = '';
        if (endRaw - startRaw >= Math.PI * 2 - 0.001) {
            // Full 360 circle
            d = `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx} ${cy + r} A ${r} ${r} 0 1 1 ${cx} ${cy - r} Z`;
        } else {
            // Standard arc
            d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
        }

        const midAngle = start + (end - start) / 2;
        const textR = r * 0.65; // Place text inside at 65% of radius
        const textX = cx + textR * Math.cos(midAngle);
        const textY = cy + textR * Math.sin(midAngle);

        shape = (
          <g>
            <path d={d} fill={panelFill} stroke={strokeColor} strokeWidth={strokeW} strokeLinejoin="round" />
            <g transform={`translate(${textX - cx}, ${textY - cy})`}>
                {renderLabel()}
            </g>
          </g>
        );
      }
      break;
    case 'title':
    case 'text':
      {
        const wrap = getFittedText(node.label || '', textMaxWidth, textMaxHeight, Number(FONT_SIZE), fontStyle, fontWeight);
        const pad = 10;
        const realW = Math.max(wrap.textWidth + pad * 2, 20);
        const realH = Math.max(wrap.textHeight + pad * 2, 20);
        const cx = NODE_WIDTH / 2;
        const cy = NODE_HEIGHT / 2;
        
        shape = (
          <g>
            <rect x={cx - realW / 2} y={cy - realH / 2} width={realW} height={realH} fill="none" pointerEvents="all" stroke="none" />
            {renderLabel(wrap)}
          </g>
        );
      }
      break;
    case 'element':
      shape = (
        <g>
          <rect width={NODE_WIDTH} height={NODE_HEIGHT} rx={NODE_HEIGHT/2} ry={NODE_HEIGHT/2} fill={panelFill} stroke={strokeColor} strokeWidth={strokeW} />
          {renderLabel()}
        </g>
      );
      break;
    case 'oval':
      shape = (
        <g>
          <rect width={NODE_WIDTH} height={NODE_HEIGHT} rx={Math.min(NODE_WIDTH, NODE_HEIGHT)/2} fill={panelFill} stroke={strokeColor} strokeWidth={strokeW} />
          {renderLabel()}
        </g>
      );
      break;
    case 'process':
    default:
      shape = (
        <g>
          <rect width={NODE_WIDTH} height={NODE_HEIGHT} rx="4" ry="4" fill={panelFill} stroke={strokeColor} strokeWidth={strokeW} />
          {!isPrintTheme && (
             <rect width={NODE_WIDTH} height="4" rx="4" fill={strokeColor} style={{ clipPath: `inset(0 0 ${NODE_HEIGHT - 4}px 0)` }} />
          )}
          {renderLabel()}
        </g>
      );
      break;
  }

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
  if (node.type === 'circle') {
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
      {isSelected && React.cloneElement(selectionBound, { style: { pointerEvents: 'none' } })}
      {renderPorts()}
    </g>
  );
});

export default DiagramNode;
