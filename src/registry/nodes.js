/**
 * Global Node Type Registry
 * Defines ALL possible node shapes and their port availability.
 * Engine plugins reference these IDs in schema.allowedNodes[].
 *
 * ports: which connection points are available for edge routing
 *   'all' = top/bottom/left/right
 *   'center' = single anchor point at center (chevron, timeline)
 *   'none' = not connectable (pie slices)
 */
export const NODE_REGISTRY = {
  process:   { label: 'Block',    icon: 'shape-rect',    ports: 'all'    },
  circle:    { label: 'Circle',   icon: 'shape-circle',  ports: 'all'    },
  oval:      { label: 'Oval',     icon: 'shape-oval',    ports: 'all'    },
  rhombus:   { label: 'Diamond',  icon: 'shape-diamond', ports: 'all'    },
  chevron:   { label: 'Chevron',  icon: 'shape-chevron', ports: 'center' },
  pie_slice: { label: 'Slice',    icon: 'shape-slice',   ports: 'none'   },
};
