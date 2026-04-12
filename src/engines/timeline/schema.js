// Full schema for this diagram type — single source of truth
// No imports — pure static data (Level 0 in plugin hierarchy)
export default {
    id: "timeline",
    name: "Timeline",
    description: "events plotted on a generic chronological spine.",
    allowedNodes: ["chevron", "process"],
    allowedEdges: ["solid", "dashed", "none"],
    features: {
        hasNodeValue: false,
        allowConnections: true
    },
    connectionRules: ["chevron -> chevron : MUST use 'lineStyle': 'none' (invisible topological spine)", "process -> chevron : Use 'solid' or 'dashed' (visible event links)"],
    engineManifest: {
        layout: "timeline",
        edgeStyle: "straight_clipped",
        nodeTypes: ["chevron", "process"],
        suppressSpineEdges: true,
        spineNodeType: "chevron"
    },
};
