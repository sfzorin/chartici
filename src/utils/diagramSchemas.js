export const DIAGRAM_SCHEMAS = {
  flowchart: {
    id: 'flowchart',
    name: 'Flowchart',
    description: 'logical step-by-step processes or algorithms.',
    allowedNodes: ['process', 'circle', 'oval', 'rhombus'],
    allowedEdges: ['solid', 'dashed', 'bold', 'none'],
    features: { hasNodeValue: false, allowConnections: true },
    promptRule: "4. Use 'oval' ONLY for start/end nodes. Use 'rhombus' for decisions/conditions. Use 'process' for regular steps.",
    semanticScale: { L: 'system', M: 'process', S: 'step' },
    engineManifest: { layout: 'sugiyama', edgeStyle: 'orthogonal_astar', isHorizontalFlow: true, nodeTypes: ['process', 'circle', 'oval', 'rhombus'] }
  },
  sequence: {
    id: 'sequence',
    name: 'Sequence',
    description: 'chronological interactions between systems or actors.',
    allowedNodes: ['process', 'circle', 'text'],
    allowedEdges: ['solid', 'dashed', 'bold', 'none'],
    features: { hasNodeValue: false, allowConnections: true },
    promptRule: "4. Create interaction blocks between systems. Use lineStyle appropriately for synchronous (solid) vs asynchronous (dashed) calls.",
    semanticScale: { L: 'system', M: 'action', S: 'state' },
    engineManifest: { layout: 'sugiyama', edgeStyle: 'orthogonal_astar', isHorizontalFlow: true, nodeTypes: ['process', 'circle', 'text'], lifelineOverlays: true }
  },
  erd: {
    id: 'erd',
    name: 'Entity-Relationship',
    description: 'database schemas, entities, and relationships.',
    allowedNodes: ['process', 'text'],
    allowedEdges: ['solid', 'dashed', 'bold', 'none'],
    features: { hasNodeValue: false, allowConnections: true, erdMarkers: true },
    promptRule: "4. Use groups for Tables. Use 'process' nodes for columns. Use standard 1:1, 1:N relations where possible.",
    semanticScale: { L: 'schema', M: 'table', S: 'column' },
    engineManifest: { layout: 'sugiyama', edgeStyle: 'orthogonal_astar', isHorizontalFlow: true, nodeTypes: ['process', 'text'] }
  },
  radial: {
    id: 'radial',
    name: 'Radial',
    description: 'mind-maps, concentric layers, or hub-and-spoke architectures.',
    allowedNodes: ['process', 'circle', 'text'],
    allowedEdges: ['solid', 'dashed', 'bold', 'none'],
    features: { hasNodeValue: false, allowConnections: true },
    promptRule: "4. Choose node 'lineStyle' that best represent the logic described. Place the core concept at the center (or as the main node), and radiating sub-concepts pointing outwards.",
    semanticScale: { L: 'core', M: 'ring1', S: 'leaf' },
    engineManifest: { layout: 'radial', edgeStyle: 'straight_clipped', isHorizontalFlow: false, nodeTypes: ['process', 'circle', 'text'], suppressEdgeMarkers: true, suppressEdgeLabels: true }
  },
  array: {
    id: 'array',
    name: 'Array',
    description: 'memory buffers, queues, or sequential data structures.',
    allowedNodes: ['process', 'text'],
    allowedEdges: ['solid', 'dashed', 'bold', 'none'],
    features: { hasNodeValue: false, allowConnections: true },
    promptRule: "4. Use 'process' nodes to represent sequential elements, queues, or arrays.",
    semanticScale: { L: 'structure', M: 'array', S: 'element' },
    engineManifest: { layout: 'sugiyama', edgeStyle: 'orthogonal_astar', isHorizontalFlow: true, nodeTypes: ['process', 'text'] }
  },
  matrix: {
    id: 'matrix',
    name: 'Matrix',
    description: 'grid-like comparisons, or categorization into distinct cluster zones/cells.',
    allowedNodes: ['process', 'text'],
    allowedEdges: ['none', 'solid'],
    features: { hasNodeValue: false, allowConnections: true },
    promptRule: "4. Use groups to represent the distinct grid cells or zones. Place related items inside their respective cell group. Cross-connections between cells are allowed.",
    semanticScale: { L: 'zone', M: 'cell', S: 'item' },
    connectionRules: [
      "process -> process : Allowed across different groups/cells using 'solid'."
    ],
    engineManifest: { layout: 'matrix', edgeStyle: 'orthogonal_astar', isHorizontalFlow: true, nodeTypes: ['process', 'text'], matrixGridOverlays: true }
  },
  timeline: {
    id: 'timeline',
    name: 'Timeline',
    description: 'events plotted on a generic chronological spine.',
    allowedNodes: ['chevron', 'process'],
    allowedEdges: ['solid', 'dashed', 'none'],
    features: { hasNodeValue: false, allowConnections: true },
    promptRule: "4. Use 'chevron' node type for the central chronological spine periods. Use 'process' for specific events attached to the spine. 5. This diagram maintains topological order without drawing visible links on the spine.",
    semanticScale: { L: 'era', M: 'event', S: 'sub-event' },
    connectionRules: [
      "chevron -> chevron : MUST use 'lineStyle': 'none' (invisible topological spine)",
      "process -> chevron : Use 'solid' or 'dashed' (visible event links)"
    ],
    engineManifest: { layout: 'timeline', edgeStyle: 'orthogonal_astar', isHorizontalFlow: true, nodeTypes: ['chevron', 'process'], suppressSpineEdges: true, spineNodeType: 'chevron' }
  },
  tree: {
    id: 'tree',
    name: 'Tree',
    description: 'hierarchical structure with one or few roots branching downwards.',
    allowedNodes: ['process'],
    allowedEdges: ['solid', 'dashed', 'bold', 'none'],
    features: { hasNodeValue: false, allowConnections: true },
    promptRule: "4. Ensure a strict hierarchy with one root (or a few top-level roots) branching downwards. Do not route cyclic connections.",
    semanticScale: { L: 'parent', M: 'branch', S: 'leaf' },
    engineManifest: { layout: 'tree', edgeStyle: 'orthogonal_astar', isHorizontalFlow: false, nodeTypes: ['process'], isTree: true, enableBusRouting: true }
  },
  piechart: {
    id: 'piechart',
    name: 'Pie Chart',
    description: 'breakdown of items into proportional circular slices.',
    allowedNodes: ['pie_slice'],
    allowedEdges: ['none'],
    features: { hasNodeValue: true, allowConnections: false, autoIncrementColors: true, recalculateOnEdit: true, enforceMaxNodes: 9 },
    promptRule: "4. Create a single group with 'Type: pie_slice'. The nodes represent the items inside it, providing 'id', 'label', and 'value' fields.",
    semanticScale: { L: 'highlight', M: 'standard', S: 'muted' },
    connectionRules: [
      "Edges MUST NOT be used in piecharts."
    ],
    engineManifest: { layout: 'piechart', edgeStyle: 'none', isHorizontalFlow: false, nodeTypes: ['pie_slice'] }
  }
};

export const DIAGRAM_TYPES = Object.keys(DIAGRAM_SCHEMAS)
  .map(key => ({
    id: DIAGRAM_SCHEMAS[key].id,
    name: DIAGRAM_SCHEMAS[key].name
  }));
