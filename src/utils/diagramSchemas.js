export const DIAGRAM_SCHEMAS = {
  flowchart: {
    id: 'flowchart',
    name: 'Flowchart',
    description: 'logical step-by-step processes or algorithms.',
    allowedNodes: ['process', 'circle', 'oval', 'rhombus', 'text'],
    allowedEdges: ['solid', 'dashed', 'bold', 'none'],
    features: { hasNodeValue: false, allowConnections: true, hasGroups: true },
    promptRule: "4. Use 'oval' ONLY for start/end nodes. Use 'rhombus' for decisions/conditions. Use 'process' for regular steps."
  },
  sequence: {
    id: 'sequence',
    name: 'Sequence',
    description: 'chronological interactions between systems or actors.',
    allowedNodes: ['process', 'circle', 'text'],
    allowedEdges: ['solid', 'dashed', 'bold', 'none'],
    features: { hasNodeValue: false, allowConnections: true, hasGroups: true },
    promptRule: "4. Create interaction blocks between systems. Use lineStyle appropriately for synchronous (solid) vs asynchronous (dashed) calls."
  },
  erd: {
    id: 'erd',
    name: 'Entity-Relationship',
    description: 'database schemas, entities, and relationships.',
    allowedNodes: ['process', 'text'],
    allowedEdges: ['solid', 'dashed', 'bold', 'none'],
    features: { hasNodeValue: false, allowConnections: true, hasGroups: true },
    promptRule: "4. Use groups for Tables. Use 'process' nodes for columns. Use standard 1:1, 1:N relations where possible."
  },
  radial: {
    id: 'radial',
    name: 'Radial',
    description: 'mind-maps, concentric layers, or hub-and-spoke architectures.',
    allowedNodes: ['process', 'circle', 'text'],
    allowedEdges: ['solid', 'dashed', 'bold', 'none'],
    features: { hasNodeValue: false, allowConnections: true, hasGroups: true },
    promptRule: "4. Choose node 'size' and 'lineStyle' that best represent the logic described. Place the core concept at the center (or as the main node), and radiating sub-concepts pointing outwards."
  },
  array: {
    id: 'array',
    name: 'Array',
    description: 'memory buffers, queues, or sequential data structures.',
    allowedNodes: ['process', 'text'],
    allowedEdges: ['solid', 'dashed', 'bold', 'none'],
    features: { hasNodeValue: false, allowConnections: true, hasGroups: true },
    promptRule: "4. Use 'process' nodes to represent sequential elements, queues, or arrays."
  },
  matrix: {
    id: 'matrix',
    name: 'Matrix',
    description: 'grid-like comparisons, or categorization into distinct cluster zones/cells.',
    allowedNodes: ['process', 'text'],
    allowedEdges: ['none', 'solid'],
    features: { hasNodeValue: false, allowConnections: true, hasGroups: true },
    promptRule: "4. Use groups to represent the distinct grid cells or zones. Place related items inside their respective cell group. Cross-connections between cells are allowed.",
    connectionRules: [
      "process -> process : Allowed across different groups/cells using 'solid'."
    ]
  },
  timeline: {
    id: 'timeline',
    name: 'Timeline',
    description: 'events plotted on a generic chronological spine.',
    allowedNodes: ['chevron', 'process', 'circle', 'text'],
    allowedEdges: ['solid', 'dashed', 'none'],
    features: { hasNodeValue: false, allowConnections: true, hasGroups: true },
    promptRule: "4. Use 'chevron' node type for the central chronological spine periods. Use 'circle' or 'process' for specific events attached to the spine. 5. This diagram maintains topological order without drawing visible links on the spine.",
    connectionRules: [
      "chevron -> chevron : MUST use 'lineStyle': 'none' (invisible topological spine)",
      "circle/process -> chevron : Use 'solid' or 'dashed' (visible event links)",
      "text -> any : Use 'none' (invisible text binding)"
    ]
  },
  tree: {
    id: 'tree',
    name: 'Tree',
    description: 'strict hierarchical org-charts or breakdowns.',
    allowedNodes: ['process', 'circle', 'text'],
    allowedEdges: ['solid', 'dashed', 'bold', 'none'],
    features: { hasNodeValue: false, allowConnections: true, hasGroups: true },
    promptRule: "4. Ensure a strict hierarchy with one root (or a few top-level roots) branching downwards. Do not route cyclic connections."
  },
  piechart: {
    id: 'piechart',
    name: 'Pie Chart',
    description: 'breakdown of items into proportional circular slices.',
    allowedNodes: ['pie_slice'],
    allowedEdges: ['none'],
    features: { hasNodeValue: true, allowConnections: false, hasGroups: false },
    promptRule: "4. Use a single general group. Nodes represent slices. Populate the 'value' field with an exact number (e.g. 25, 400).",
    connectionRules: [
      "Edges MUST NOT be used in piecharts."
    ]
  },
  default: {
    id: 'default',
    name: 'Custom',
    description: 'a generic mixed-architecture design.',
    allowedNodes: ['process', 'circle', 'oval', 'rhombus', 'text'],
    allowedEdges: ['solid', 'dashed', 'bold', 'none'],
    features: { hasNodeValue: false, allowConnections: true, hasGroups: true },
    promptRule: "4. Choose node 'size' and 'lineStyle' that best represent the logic described."
  }
};

export const DIAGRAM_TYPES = Object.keys(DIAGRAM_SCHEMAS)
  .filter(key => key !== 'default')
  .map(key => ({
    id: DIAGRAM_SCHEMAS[key].id,
    name: DIAGRAM_SCHEMAS[key].name
  }));
