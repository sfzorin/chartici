// Full schema for this diagram type — single source of truth
// No imports — pure static data (Level 0 in plugin hierarchy)
export default {
    id: "radial",
    name: "Radial",
    description: "mind-maps, concentric layers, or hub-and-spoke architectures.",
    allowedNodes: ["process"],
    allowedEdges: ["solid", "dashed", "bold", "none"],
    features: {
        hasNodeValue: false,
        allowConnections: true
    },
    engineManifest: {
        layout: "radial",
        edgeStyle: "straight_clipped",
        isHorizontalFlow: false,
        nodeTypes: ["process"],
        suppressEdgeMarkers: true,
        suppressEdgeLabels: true
    },
};
