// Full schema for this diagram type — single source of truth
// No imports — pure static data (Level 0 in plugin hierarchy)
export default {
    id: "piechart",
    name: "Pie Chart",
    description: "breakdown of items into proportional circular slices.",
    allowedNodes: ["pie_slice"],
    connectionRules: ["Edges MUST NOT be used in piecharts."],
    allowedLineStyles: [],
    allowedArrowTypes: [],
    features: {
        hasNodeValue: true,
        allowConnections: false,
        autoIncrementColors: true,
        recalculateOnEdit: true,
        enforceMaxNodes: 9
    },
    engineManifest: {
        layout: "piechart",
        edgeStyle: "none",
        nodeTypes: ["pie_slice"]
    },
};
