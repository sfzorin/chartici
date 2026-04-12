// Full schema for this diagram type — single source of truth
// No imports — pure static data (Level 0 in plugin hierarchy)
export default {
    id: "matrix",
    name: "Matrix",
    description: "grid-like comparisons, or categorization into distinct cluster zones/cells.",
    allowedNodes: ["process"],
    allowedEdges: ["none"],
    features: {
        hasNodeValue: false,
        allowConnections: true
    },
    connectionRules: ["Edges MUST NOT be used in matrices."],
    engineManifest: {
        layout: "matrix",
        edgeStyle: "orthogonal_astar",
        isHorizontalFlow: true,
        nodeTypes: ["process"],
        matrixGridOverlays: true
    },
};
