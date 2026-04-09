export const DIAGRAM_SCHEMAS = {
  flowchart: {
    allowedNodes: ['process', 'circle', 'oval', 'rhombus', 'text'],
    allowedEdges: ['solid', 'dashed', 'bold', 'none'],
    features: { hasNodeValue: false, allowConnections: true, hasGroups: true },
    promptRule: "4. Use 'oval' ONLY for start/end nodes. Use 'rhombus' for decisions/conditions. Use 'process' for regular steps."
  },
  sequence: {
    allowedNodes: ['process', 'circle', 'text'],
    allowedEdges: ['solid', 'dashed', 'bold', 'none'],
    features: { hasNodeValue: false, allowConnections: true, hasGroups: true },
    promptRule: "4. Create interaction blocks between systems. Use lineStyle appropriately for synchronous (solid) vs asynchronous (dashed) calls."
  },
  erd: {
    allowedNodes: ['process', 'text'],
    allowedEdges: ['solid', 'dashed', 'bold', 'none'],
    features: { hasNodeValue: false, allowConnections: true, hasGroups: true },
    promptRule: "4. Use groups for Tables. Use 'process' nodes for columns. Use standard 1:1, 1:N relations where possible."
  },
  radial: {
    allowedNodes: ['process', 'circle', 'text'],
    allowedEdges: ['solid', 'dashed', 'bold', 'none'],
    features: { hasNodeValue: false, allowConnections: true, hasGroups: true },
    promptRule: "4. Choose node 'size' and 'lineStyle' that best represent the logic described. Place the core concept at the center (or as the main node), and radiating sub-concepts pointing outwards."
  },
  array: {
    allowedNodes: ['process', 'text'],
    allowedEdges: ['solid', 'dashed', 'bold', 'none'],
    features: { hasNodeValue: false, allowConnections: true, hasGroups: true },
    promptRule: "4. Use 'process' nodes to represent sequential elements, queues, or arrays."
  },
  matrix: {
    allowedNodes: ['process', 'text'],
    allowedEdges: ['none', 'solid'],
    features: { hasNodeValue: false, allowConnections: true, hasGroups: true },
    promptRule: "4. Use groups to represent the distinct grid cells or zones. Place related items inside their respective cell group. Cross-connections between cells are allowed."
  },
  timeline: {
    allowedNodes: ['chevron', 'process', 'circle', 'text'],
    allowedEdges: ['solid', 'dashed', 'none'],
    features: { hasNodeValue: false, allowConnections: true, hasGroups: true },
    promptRule: "4. Use 'chevron' node type for the central chronological spine periods. Use 'circle' or 'process' for specific events attached to the spine."
  },
  tree: {
    allowedNodes: ['process', 'circle', 'text'],
    allowedEdges: ['solid', 'dashed', 'bold', 'none'],
    features: { hasNodeValue: false, allowConnections: true, hasGroups: true },
    promptRule: "4. Ensure a strict hierarchy with one root (or a few top-level roots) branching downwards. Do not route cyclic connections."
  },
  piechart: {
    allowedNodes: ['pie_slice'],
    allowedEdges: ['none'],
    features: { hasNodeValue: true, allowConnections: false, hasGroups: false },
    promptRule: "4. Use a single general group. Nodes represent slices. Populate the 'value' field with an exact number (e.g. 25, 400). Edges are structurally unnecessary and should be avoided."
  },
  default: {
    allowedNodes: ['process', 'circle', 'oval', 'rhombus', 'text'],
    allowedEdges: ['solid', 'dashed', 'bold', 'none'],
    features: { hasNodeValue: false, allowConnections: true, hasGroups: true },
    promptRule: "4. Choose node 'size' and 'lineStyle' that best represent the logic described."
  }
};
