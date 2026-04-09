import React from 'react';

export const ShapeRegistry = {
  process: {
    getTextLimits: (w, h) => ({ maxWidth: w, maxHeight: h }),
    getSelectionBounds: (w, h, padding, color) => (
      <g>
        <rect x={-padding} y={-padding} width={w+(padding*2)} height={h+(padding*2)} fill="none" stroke={color} strokeWidth="10" opacity="0.3" rx="10" />
        <rect x={-padding} y={-padding} width={w+(padding*2)} height={h+(padding*2)} fill="none" stroke={color} strokeWidth="2" rx="10" />
      </g>
    ),
    render: (w, h, fill, stroke, strokeW, dash, filter) => (
      <rect x="0" y="0" width={w} height={h} rx="25" fill={fill} stroke={stroke} strokeWidth={strokeW} strokeDasharray={dash} filter={filter} />
    )
  },
  element: {
    getTextLimits: (w, h) => ({ maxWidth: w * 0.85, maxHeight: h * 0.85 }),
    getSelectionBounds: (w, h, padding, color) => ShapeRegistry.process.getSelectionBounds(w, h, padding, color),
    render: (w, h, fill, stroke, strokeW, dash, filter) => (
      <rect x="0" y="0" width={w} height={h} rx="10" fill={fill} stroke={stroke} strokeWidth={strokeW} strokeDasharray={dash} filter={filter} />
    )
  },
  circle: {
    getTextLimits: (w, h) => ({ maxWidth: Math.min(w, h) * 0.75, maxHeight: Math.min(w, h) * 0.75 }),
    getSelectionBounds: (w, h, padding, color) => {
      const r = Math.min(w, h) / 2;
      return (
        <g>
          <circle cx={w/2} cy={h/2} r={r + padding} fill="none" stroke={color} strokeWidth="10" opacity="0.3" />
          <circle cx={w/2} cy={h/2} r={r + padding} fill="none" stroke={color} strokeWidth="2" />
        </g>
      );
    },
    render: (w, h, fill, stroke, strokeW, dash, filter) => {
      const r = Math.min(w, h) / 2;
      return <circle cx={w/2} cy={h/2} r={r} fill={fill} stroke={stroke} strokeWidth={strokeW} strokeDasharray={dash} filter={filter} />
    }
  },
  oval: {
    getTextLimits: (w, h) => ({ maxWidth: w - Math.min(w, h) * 0.5, maxHeight: h }),
    getSelectionBounds: (w, h, padding, color) => (
      <g>
        <ellipse cx={w/2} cy={h/2} rx={(w/2) + padding} ry={(h/2) + padding} fill="none" stroke={color} strokeWidth="10" opacity="0.3" />
        <ellipse cx={w/2} cy={h/2} rx={(w/2) + padding} ry={(h/2) + padding} fill="none" stroke={color} strokeWidth="2" />
      </g>
    ),
    render: (w, h, fill, stroke, strokeW, dash, filter) => (
      <ellipse cx={w/2} cy={h/2} rx={w/2} ry={h/2} fill={fill} stroke={stroke} strokeWidth={strokeW} strokeDasharray={dash} filter={filter} />
    )
  },
  rhombus: {
    getTextLimits: (w, h) => ({ maxWidth: w * 0.6, maxHeight: h * 0.6 }),
    getSelectionBounds: (w, h, padding, color) => {
      const cx = w/2, cy = h/2;
      const pts = `${cx},${-padding} ${w+padding},${cy} ${cx},${h+padding} ${-padding},${cy}`;
      return (
        <g>
          <polygon points={pts} fill="none" stroke={color} strokeWidth="10" opacity="0.3" />
          <polygon points={pts} fill="none" stroke={color} strokeWidth="2" />
        </g>
      );
    },
    render: (w, h, fill, stroke, strokeW, dash, filter) => {
      const pts = `${w/2},0 ${w},${h/2} ${w/2},${h} 0,${h/2}`;
      return <polygon points={pts} fill={fill} stroke={stroke} strokeWidth={strokeW} strokeDasharray={dash} filter={filter} />
    }
  },
  pie_slice: {
    getTextLimits: (w, h) => ({ maxWidth: (Math.min(w, h) / 2) * 0.6, maxHeight: (Math.min(w, h) / 2) * 0.6 }),
    getSelectionBounds: (w, h, padding, color) => ShapeRegistry.circle.getSelectionBounds(w, h, padding, color),
    render: (w, h, fill, stroke, strokeW, dash, filter, node) => {
        const cx = w / 2;
        const cy = h / 2;
        const r = Math.min(w, h) / 2;
        const startRaw = node.pieStartAngle || 0;
        const endRaw = node.pieEndAngle || Math.PI * 2;
        const rStartRaw = node.ringStartRaw || 0;
        
        let pathD;
        if (endRaw - startRaw >= Math.PI * 2 - 0.001) {
            // Full 360 circle
            pathD = `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx} ${cy + r} A ${r} ${r} 0 1 1 ${cx} ${cy - r} Z`;
        } else {
            const start = startRaw - Math.PI / 2;
            const end = endRaw - Math.PI / 2;
            const x1 = cx + r * Math.cos(start);
            const y1 = cy + r * Math.sin(start);
            const x2 = cx + r * Math.cos(end);
            const y2 = cy + r * Math.sin(end);
            const largeArcFlag = end - start <= Math.PI ? "0" : "1";
            pathD = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
        }
        return <path d={pathD} fill={fill} stroke={stroke} strokeWidth={strokeW} strokeDasharray={dash} filter={filter} />;
    }
  },
  chevron: {
    getTextLimits: (w, h) => ({ maxWidth: w - 24, maxHeight: h }),
    getSelectionBounds: (w, h, padding, color) => {
        let cut = 15;
        let dExt = 5;
        if (h === 40) { cut = 10; dExt = 7.5; }
        else if (h === 60) { cut = 15; dExt = 6; }
        else if (h === 80) { cut = 20; dExt = 5; }
        else if (h === 120) { cut = 30; dExt = 12.5; }
        else if (h === 160) { cut = 40; dExt = 10; }
        
        const pd = padding + 2;
        const d = `M -${cut + dExt + pd} -${pd} L ${w + dExt + pd - cut} -${pd} L ${w + cut + dExt + pd} ${h/2} L ${w + dExt + pd - cut} ${h + pd} L -${cut + dExt + pd} ${h + pd} L -${dExt + pd} ${h/2} Z`;
        return (
          <g>
            <path d={d} fill="none" stroke={color} strokeWidth="6" strokeLinejoin="round" opacity="0.3" />
            <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
          </g>
        );
    },
    render: (w, h, fill, stroke, strokeW, dash, filter, node) => {
        // Explicit dimensions for each size (cut = arrow depth, dExt = horizontal extra width)
        let cut = 15;
        let dExt = 5;
        if (h === 40) { cut = 10; dExt = 7.5; }        // XS
        else if (h === 60) { cut = 15; dExt = 6; }     // S
        else if (h === 80) { cut = 20; dExt = 5; }     // M
        else if (h === 120) { cut = 30; dExt = 12.5; } // L
        else if (h === 160) { cut = 40; dExt = 10; }   // XL

        const d = `M -${cut + dExt} 0 L ${w + dExt} 0 L ${w + cut + dExt} ${h/2} L ${w + dExt} ${h} L -${cut + dExt} ${h} L -${dExt} ${h/2} Z`;
        return <path d={d} fill={fill} stroke={stroke} strokeWidth={strokeW} strokeDasharray={dash} strokeLinejoin="round" filter={filter} />;
    }
  },
  text: {
    getTextLimits: (w, h) => ({ maxWidth: w, maxHeight: h }),
    getSelectionBounds: (w, h, padding, color) => ShapeRegistry.process.getSelectionBounds(w, h, padding, color),
    render: (w, h, fill, stroke, strokeW, dash, filter) => (
      <rect x="0" y="0" width={w} height={h} fill="transparent" stroke="transparent" />
    )
  },
  title: {
    getTextLimits: (w, h) => ({ maxWidth: w, maxHeight: h }),
    getSelectionBounds: (w, h, padding, color) => ShapeRegistry.process.getSelectionBounds(w, h, padding, color),
    render: (w, h, fill, stroke, strokeW, dash, filter) => (
      <rect x="0" y="0" width={w} height={h} fill="transparent" stroke="transparent" />
    )
  }
};
