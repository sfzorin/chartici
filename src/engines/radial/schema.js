export default {
    description: 'mind-maps, concentric layers, or hub-and-spoke architectures.',
    allowedNodes: ['process'],
    allowedEdges: ['solid', 'dashed', 'none'],
    features: { hasNodeValue: false, allowConnections: true },
    promptRule: "4. Choose node 'lineStyle' that best represent the logic described. Place the core concept at the center (or as the main node), and radiating sub-concepts pointing outwards.",
    semanticScale: { L: 'core', M: 'ring1', S: 'leaf' },
    engineManifest: { layout: 'radial', edgeStyle: 'straight_clipped', isHorizontalFlow: false, nodeTypes: ['process'], suppressEdgeMarkers: true, suppressEdgeLabels: true }
};
