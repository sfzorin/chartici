// Full schema for this diagram type — single source of truth
// No imports — pure static data (Level 0 in plugin hierarchy)
export default {
    id: "tree",
    name: "Tree",
    description: "hierarchical structure with one or few roots branching downwards.",
    allowedNodes: ["process"],
    allowedEdges: ["solid", "dashed", "bold", "none"],
    features: {
        hasNodeValue: false,
        allowConnections: true
    },
    engineManifest: {
        layout: "tree",
        edgeStyle: "orthogonal_astar",
        nodeTypes: ["process"],
    },
};
