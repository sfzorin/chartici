import React from 'react';

const iconPaths = {
  'new-file': (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="12" y1="18" x2="12" y2="12" />
      <line x1="9" y1="15" x2="15" y2="15" />
    </>
  ),
  'folder-open': (
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  ),
  'edge-style': (
    <>
      <line x1="4" y1="8" x2="20" y2="8" strokeWidth="2" strokeLinecap="round" />
      <line x1="4" y1="16" x2="10" y2="16" strokeWidth="2" strokeLinecap="round" />
      <line x1="14" y1="16" x2="20" y2="16" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  'wand': (
    <>
      <path d="M15 4V2" />
      <path d="M15 16v-2" />
      <path d="M8 9h2" />
      <path d="M20 9h2" />
      <path d="M17.8 11.8L19 13" />
      <path d="M15 9h0" />
      <path d="M17.8 6.2L19 5" />
      <path d="M3 21l9-9" />
      <path d="M12.2 6.2L11 5" />
    </>
  ),
  'connect': (
    <>
      <circle cx="6" cy="6" r="2.5" fill="none" />
      <path d="M6 8.5v9.5h12" fill="none" strokeDasharray="3 3" />
      <polyline points="15 15 19 18 15 21" />
    </>
  ),
  'fit': (
    <>
      <circle cx="10.5" cy="10.5" r="7.5" />
      <line x1="21" y1="21" x2="15.8" y2="15.8" />
      <rect x="7.5" y="8.5" width="6" height="4" />
    </>
  ),
  'text-shape': (
    <>
      <polyline points="5 20 12 4 19 20" strokeWidth="1.5" strokeLinejoin="miter" />
      <line x1="8" y1="14" x2="16" y2="14" strokeWidth="1.5" />
    </>
  ),
  'layout-type': (
    <>
      <rect x="4" y="4" width="6" height="6" rx="1.5" strokeWidth="1.5" />
      <rect x="14" y="14" width="6" height="6" rx="1.5" strokeWidth="1.5" />
      <line x1="10" y1="10" x2="14" y2="14" strokeWidth="1.5" />
    </>
  ),
  'size': (
    <>
      <polyline points="19 3 23 3 23 7" />
      <polyline points="5 21 1 21 1 17" />
      <line x1="23" y1="3" x2="19" y2="7" />
      <line x1="1" y1="21" x2="5" y2="17" />
    </>
  ),
  'palette': (
    <>
      <circle cx="13.5" cy="6.5" r=".5" strokeWidth="1.5" />
      <circle cx="17.5" cy="10.5" r=".5" strokeWidth="1.5" />
      <circle cx="8.5" cy="7.5" r=".5" strokeWidth="1.5" />
      <circle cx="6.5" cy="12.5" r=".5" strokeWidth="1.5" />
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" strokeWidth="1.5" />
    </>
  ),
  'save': (
    <>
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </>
  ),
  'download': (
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </>
  ),
  'sun': (
    <>
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </>
  ),
  'moon': (
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  ),
  'help-circle': (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </>
  ),
  'sidebar': (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <line x1="15" y1="3" x2="15" y2="21" />
      <path d="M10 8h.01" />
      <path d="M10 12h.01" />
      <path d="M10 16h.01" />
    </>
  ),
  'hamburger': (
    <>
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </>
  ),
  'trash': (
    <>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </>
  ),
  'x': (
    <>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </>
  ),
  'frame': (
    <>
      <line x1="6" y1="3" x2="6" y2="21" strokeWidth="1.5" />
      <line x1="18" y1="3" x2="18" y2="21" strokeWidth="1.5" />
      <line x1="3" y1="6" x2="21" y2="6" strokeWidth="1.5" />
      <line x1="3" y1="18" x2="21" y2="18" strokeWidth="1.5" />
    </>
  ),
  'lock': (
    <>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" fill="currentColor" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </>
  ),
  'unlock': (
    <>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" fill="none" />
      <path d="M7 11V7a5 5 0 0 1 9.9-1" />
    </>
  ),
  // Canvas toolbar shapes
  'shape-rect': <rect x="3" y="6" width="18" height="12" rx="0" strokeWidth="1.5" />,
  'shape-oval': <rect x="1" y="6" width="22" height="12" rx="6" strokeWidth="1.5" />,
  'shape-circle': <circle cx="12" cy="12" r="8" strokeWidth="1.5" />,
  'shape-diamond': <polygon points="12 3 21 12 12 21 3 12" strokeWidth="1.5" />,
  'shape-slice': <path d="M12 4 L5 16 A 14 14 0 0 0 19 16 Z" strokeWidth="1.5" strokeLinejoin="miter" />,
  'shape-chevron': <polygon points="6,6 16,6 20,12 16,18 6,18 10,12" strokeWidth="1.5" strokeLinejoin="miter" />,
  'tag': (
    <>
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" strokeWidth="2" />
      <line x1="7" y1="7" x2="7.01" y2="7" strokeWidth="2.5" strokeLinecap="round" />
    </>
  ),
  'layers': (
    <>
      <polygon points="12 2 2 7 12 12 22 7 12 2" strokeWidth="1.5" />
      <polyline points="2 17 12 22 22 17" strokeWidth="1.5" />
      <polyline points="2 12 12 17 22 12" strokeWidth="1.5" />
    </>
  ),
  'plus': (
    <>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </>
  ),
  'minus': <line x1="5" y1="12" x2="19" y2="12" />,
  'filled-square': <rect x="4" y="4" width="16" height="16" rx="4" fill="currentColor" stroke="none" />,
  'outlined-square': <rect x="4" y="4" width="16" height="16" rx="4" fill="none" stroke="currentColor" strokeWidth="2" />,
  'undo': (
    <>
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
    </>
  ),
  'redo': (
    <>
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </>
  ),
};

export default function Icon({ name, size = 18, strokeWidth = 2, className = '', style = {}, textValue, ...rest }) {
  const paths = iconPaths[name];
  if (!paths) return null;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      {...rest}
    >
      {paths}
      {textValue !== undefined && (
        <text 
          x="12" 
          y="13" 
          textAnchor="middle" 
          dominantBaseline="middle" 
          fontSize="9" 
          fontWeight="bold" 
          fontFamily="system-ui, sans-serif" 
          fill="currentColor" 
          stroke="none"
        >
          {textValue}
        </text>
      )}
    </svg>
  );
}
