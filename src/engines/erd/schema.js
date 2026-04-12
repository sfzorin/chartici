// Full schema for this diagram type — single source of truth
// No imports — pure static data (Level 0 in plugin hierarchy)
export default {
    id: "erd",
    name: "Entity-Relationship",
    description: "database schemas, entities, and relationships.",
    allowedNodes: ["process"],
    allowedEdges: ["solid", "dashed", "bold", "none"],
    features: {
        hasNodeValue: false,
        allowConnections: true,
        erdMarkers: true
    },
    engineManifest: {
        layout: "sugiyama",
        edgeStyle: "orthogonal_astar",
        isHorizontalFlow: true,
        nodeTypes: ["process"]
    },
};
