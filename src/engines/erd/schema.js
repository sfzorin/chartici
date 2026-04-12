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
    promptRule: "4. Use groups for Tables. Use 'process' nodes for columns. Use standard 1:1, 1:N relations where possible.",
    semanticScale: {
        L: "schema",
        M: "table",
        S: "column"
    },
    engineManifest: {
        layout: "sugiyama",
        edgeStyle: "orthogonal_astar",
        isHorizontalFlow: true,
        nodeTypes: ["process"]
    },
};
