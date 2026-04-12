// Full schema for this diagram type — single source of truth
// No imports — pure static data (Level 0 in plugin hierarchy)
export default {
    id: "sequence",
    name: "Sequence",
    description: "chronological interactions between systems or actors.",
    allowedNodes: ["process", "circle"],
    allowedLineStyles: ["solid", "dashed", "none"],
    allowedArrowTypes: ["target", "reverse", "both", "none"],
    features: {
        hasNodeValue: false,
        allowConnections: true
    },
    engineManifest: {
        layout: "sugiyama",
        edgeStyle: "orthogonal_astar",
        nodeTypes: ["process", "circle"],
        matrixGridOverlays: true
    },
};
