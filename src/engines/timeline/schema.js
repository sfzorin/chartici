export default {
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
    engineManifest: { layout: 'timeline', edgeStyle: 'straight_clipped', isHorizontalFlow: true, nodeTypes: ['chevron', 'process'], suppressSpineEdges: true, spineNodeType: 'chevron' }
};
