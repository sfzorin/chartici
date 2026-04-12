// Full schema for this diagram type — single source of truth
// No imports — pure static data (Level 0 in plugin hierarchy)
export default {
    id: "sequence",
    name: "Sequence",
    description: "chronological interactions between systems or actors.",
    allowedNodes: ["process", "circle"],
    allowedEdges: ["solid", "dashed", "bold", "none"],
    features: {
        hasNodeValue: false,
        allowConnections: true
    },
    promptRule: "4. Create interaction blocks between systems. Use lineStyle appropriately for synchronous (solid) vs asynchronous (dashed) calls.",
    semanticScale: {
        L: "system",
        M: "action",
        S: "state"
    },
    engineManifest: {
        layout: "sugiyama",
        edgeStyle: "orthogonal_astar",
        isHorizontalFlow: true,
        nodeTypes: ["process", "circle"],
        matrixGridOverlays: true
    },
};
