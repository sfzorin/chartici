export const DIAGRAM_SCHEMAS = {
  flowchart: {
    id: 'flowchart',
    name: 'Flowchart',
    description: 'logical step-by-step processes or algorithms.',
    allowedNodes: ['process', 'circle', 'oval', 'rhombus', 'text'],
    allowedEdges: ['solid', 'dashed', 'bold', 'none'],
    features: { hasNodeValue: false, allowConnections: true },
    promptRule: "4. Use 'oval' ONLY for start/end nodes. Use 'rhombus' for decisions/conditions. Use 'process' for regular steps.",
    semanticScale: { L: 'system', M: 'process', S: 'step' },
    semanticDescription: {
      L: 'Major macro system or overarching flow',
      M: 'Standard operational process or functional block',
      S: 'Micro-step or isolated detailed action'
    },
    engineManifest: { layout: 'sugiyama', edgeStyle: 'orthogonal_astar', isHorizontalFlow: true, nodeTypes: ['process', 'circle', 'oval', 'rhombus', 'text'] }
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
    semanticDescription: {
      L: 'Main actor, service, or system participant',
      M: 'Standard interaction, request, or action',
      S: 'Internal state change or micro-callback'
    },
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
    semanticDescription: {
      L: 'Broad database schema or service domain',
      M: 'Standard database table or entity',
      S: 'Specific column, attribute, or property'
    },
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
    semanticDescription: {
      L: 'The absolute core or central hub of the map',
      M: 'Primary radiating arms or secondary rings',
      S: 'Outer-edge leaves or minor sub-concepts'
    },
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
    semanticDescription: {
      L: 'Overall memory structure or architecture',
      M: 'The array, queue, or main buffer itself',
      S: 'Individual elements or discrete blocks of data'
    },
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
    semanticDescription: {
      L: 'Major overarching zone or quadrant',
      M: 'Specific cell or distinct cluster grouping',
      S: 'Individual item placed inside a cell'
    },
    connectionRules: [
      "process -> process : Allowed across different groups/cells using 'solid'."
    ],
    engineManifest: { layout: 'matrix', edgeStyle: 'orthogonal_astar', isHorizontalFlow: true, nodeTypes: ['process', 'text'], matrixGridOverlays: true }
  },
  timeline: {
    id: 'timeline',
    name: 'Timeline',
    description: 'events plotted on a generic chronological spine.',
    allowedNodes: ['chevron', 'process', 'circle', 'text'],
    allowedEdges: ['solid', 'dashed', 'none'],
    features: { hasNodeValue: false, allowConnections: true },
    promptRule: "4. Use 'chevron' node type for the central chronological spine periods. Use 'circle' or 'process' for specific events attached to the spine. 5. This diagram maintains topological order without drawing visible links on the spine.",
    semanticScale: { L: 'era', M: 'event', S: 'sub-event' },
    semanticDescription: {
      L: 'Major historical eras or macroscopic periods',
      M: 'Standard chronological events or milestones',
      S: 'Minor sub-events or granular moments in time'
    },
    connectionRules: [
      "chevron -> chevron : MUST use 'lineStyle': 'none' (invisible topological spine)",
      "circle/process -> chevron : Use 'solid' or 'dashed' (visible event links)",
      "text -> any : Use 'none' (invisible text binding)"
    ],
    engineManifest: { layout: 'timeline', edgeStyle: 'orthogonal_astar', isHorizontalFlow: true, nodeTypes: ['chevron', 'process', 'circle', 'text'], suppressSpineEdges: true, spineNodeType: 'chevron' }
  },
  tree: {
    id: 'tree',
    name: 'Tree',
    description: 'strict hierarchical org-charts or breakdowns.',
    allowedNodes: ['process', 'circle', 'text'],
    allowedEdges: ['solid', 'dashed', 'bold', 'none'],
    features: { hasNodeValue: false, allowConnections: true },
    promptRule: "4. Ensure a strict hierarchy with one root (or a few top-level roots) branching downwards. Do not route cyclic connections.",
    semanticScale: { L: 'parent', M: 'branch', S: 'leaf' },
    semanticDescription: {
      L: 'The root or absolute top-level parent',
      M: 'Middle-management branches or sub-departments',
      S: 'End-node leaves or individual contributors'
    },
    engineManifest: { layout: 'tree', edgeStyle: 'orthogonal_astar', isHorizontalFlow: false, nodeTypes: ['process', 'circle', 'text'], isTree: true, enableBusRouting: true }
  },
  piechart: {
    id: 'piechart',
    name: 'Pie Chart',
    description: 'breakdown of items into proportional circular slices.',
    allowedNodes: ['pie_slice'],
    allowedEdges: ['none'],
    features: { hasNodeValue: true, allowConnections: false, autoIncrementColors: true, recalculateOnEdit: true, enforceMaxNodes: 9 },
    promptRule: "4. Create a single group with 'Type: pie_slice'. The nodes represent the items inside it, providing 'id', 'label', and 'value' fields.",
    semanticScale: { L: 'category', M: 'slice', S: 'detail' },
    semanticDescription: {
      L: 'Broad macro-category spanning multiple parts',
      M: 'Standard slice or proportional segment',
      S: 'Sub-slice or minor proportional detail'
    },
    connectionRules: [
      "Edges MUST NOT be used in piecharts."
    ],
    engineManifest: { layout: 'piechart', edgeStyle: 'none', isHorizontalFlow: false, nodeTypes: ['pie_slice'] }
  },
  default: {
    id: 'default',
    name: 'Custom',
    description: 'a generic mixed-architecture design.',
    allowedNodes: ['process', 'circle', 'oval', 'rhombus', 'text'],
    allowedEdges: ['solid', 'dashed', 'bold', 'none'],
    features: { hasNodeValue: false, allowConnections: true },
    promptRule: "4. Choose node 'lineStyle' that best represent the logic described.",
    semanticScale: { L: 'primary', M: 'secondary', S: 'minor' },
    semanticDescription: {
      L: 'Top overarching parent or absolute dominant component',
      M: 'Standard feature or secondary component',
      S: 'Micro-detail or nested child element'
    },
    engineManifest: { layout: 'sugiyama', edgeStyle: 'orthogonal_astar', isHorizontalFlow: true, nodeTypes: ['process', 'circle', 'oval', 'rhombus', 'text'] }
  }
};

export const DIAGRAM_TYPES = Object.keys(DIAGRAM_SCHEMAS)
  .filter(key => key !== 'default')
  .map(key => ({
    id: DIAGRAM_SCHEMAS[key].id,
    name: DIAGRAM_SCHEMAS[key].name
  }));
