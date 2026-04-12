// Full schema for this diagram type — single source of truth
// No imports — pure static data (Level 0 in plugin hierarchy)
export default {
    id: "erd",
    name: "Entity-Relationship",
    description: "database schemas, entities, and relationships.",
    allowedNodes: ["process"],
    allowedLineStyles: ["solid", "dashed", "none"],
    allowedArrowTypes: [],
    allowedConnectionTypes: ["1:1", "1:N", "N:1", "N:M"],
    features: {
        hasNodeValue: false,
        allowConnections: true
    },
    engineManifest: {
        layout: "sugiyama",
        edgeStyle: "orthogonal_astar",
        nodeTypes: ["process"]
    },
};
