/**
 * Global Edge Registry
 * Three orthogonal dimensions of an edge:
 *
 *  lineStyle     — visual stroke style of the line itself
 *  arrowType     — direction/shape of arrowheads (non-semantic, applies to all non-ERD diagrams)
 *  connectionType — ERD semantic cardinality markers (replaces erdMarkers: true flag)
 *
 * Engine plugins declare which options are available in their schema:
 *   allowedLineStyles:      ['solid', 'dashed', 'none']
 *   allowedArrowTypes:      ['target', 'reverse', 'both', 'none']
 *   allowedConnectionTypes: ['1:1', '1:N', 'N:1', 'N:M']   ← ERD only
 */

export const LINE_STYLE_REGISTRY = {
  solid:  { label: 'Solid',  dashArray: 'none', strokeWidth: 2 },
  dashed: { label: 'Dashed', dashArray: '5, 5', strokeWidth: 2 },
  bold:   { label: 'Bold',   dashArray: 'none', strokeWidth: 4 },
  none:   { label: 'Hidden', dashArray: '4, 4', strokeWidth: 2 },
};

export const ARROW_TYPE_REGISTRY = {
  target:  { label: '→',  markerStart: null,    markerEnd: 'arrow'  },
  reverse: { label: '←',  markerStart: 'arrow', markerEnd: null     },
  both:    { label: '↔',  markerStart: 'arrow', markerEnd: 'arrow'  },
  none:    { label: '—',  markerStart: null,    markerEnd: null     },
};

/** ERD crows-foot cardinality markers */
export const CONNECTION_TYPE_REGISTRY = {
  '1:1': { label: '1:1', markerStart: 'cf-one',  markerEnd: 'cf-one'  },
  '1:N': { label: '1:N', markerStart: 'cf-one',  markerEnd: 'cf-many' },
  'N:1': { label: 'N:1', markerStart: 'cf-many', markerEnd: 'cf-one'  },
  'N:M': { label: 'N:M', markerStart: 'cf-many', markerEnd: 'cf-many' },
};
