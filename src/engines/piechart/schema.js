// Full schema for this diagram type — single source of truth
// No imports — pure static data (Level 0 in plugin hierarchy)
export default {
    id: "piechart",
    name: "Pie Chart",
    description: "breakdown of items into proportional circular slices.",
    allowedNodes: ["pie_slice"],
    allowedEdges: ["none"],
    features: {
        hasNodeValue: true,
        allowConnections: false,
        autoIncrementColors: true,
        recalculateOnEdit: true,
        enforceMaxNodes: 9
    },
    promptRule: "4. Create a single group with 'Type: pie_slice'. The nodes represent the items inside it, providing 'id', 'label', and 'value' fields.",
    semanticScale: {
        L: "highlight",
        M: "standard",
        S: "muted"
    },
    connectionRules: ["Edges MUST NOT be used in piecharts."],
    engineManifest: {
        layout: "piechart",
        edgeStyle: "none",
        isHorizontalFlow: false,
        nodeTypes: ["pie_slice"]
    },
};
