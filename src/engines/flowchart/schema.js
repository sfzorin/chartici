// Full schema for this diagram type — single source of truth
// No imports — pure static data (Level 0 in plugin hierarchy)
export default {
    id: "flowchart",
    name: "Flowchart",
    description: "logical step-by-step processes or algorithms.",
    allowedNodes: ["process", "circle", "oval", "rhombus"],
    allowedEdges: ["solid", "dashed", "bold", "none"],
    features: {
        hasNodeValue: false,
        allowConnections: true
    },
    engineManifest: {
        layout: "sugiyama",
        edgeStyle: "orthogonal_astar",
        isHorizontalFlow: true,
        nodeTypes: ["process", "circle", "oval", "rhombus"]
    },
};
