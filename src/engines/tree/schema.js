export default {
    description: 'hierarchical structure with one or few roots branching downwards.',
    allowedNodes: ['process'],
    allowedEdges: ['solid', 'dashed', 'none'],
    features: { hasNodeValue: false, allowConnections: true },
    promptRule: "4. Ensure a strict hierarchy with one root (or a few top-level roots) branching downwards. Do not route cyclic connections.",
    semanticScale: { L: 'parent', M: 'branch', S: 'leaf' },
    engineManifest: { layout: 'tree', edgeStyle: 'orthogonal_astar', isHorizontalFlow: false, nodeTypes: ['process'], isTree: true, enableBusRouting: true }
};
