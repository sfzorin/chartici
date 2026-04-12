// Full schema for this diagram type — single source of truth
// No imports — pure static data (Level 0 in plugin hierarchy)
export default {
    id: "matrix",
    name: "Matrix",
    description: "grid-like comparisons, or categorization into distinct cluster zones/cells.",
    allowedNodes: ["process"],
    connectionRules: ["Edges MUST NOT be used in matrices."],
    allowedLineStyles: [],
    allowedArrowTypes: [],
    features: {
        hasNodeValue: false,
        allowConnections: false
    },
    engineManifest: {
        layout: "matrix",
        edgeStyle: "orthogonal_astar",
        nodeTypes: ["process"],
        matrixGridOverlays: true
    },
};
