export default {
    description: 'logical step-by-step processes or algorithms.',
    allowedNodes: ['process', 'circle', 'oval', 'rhombus'],
    allowedEdges: ['solid', 'dashed', 'none'],
    features: { hasNodeValue: false, allowConnections: true },
    promptRule: "4. Use 'oval' ONLY for start/end nodes. Use 'rhombus' for decisions/conditions. Use 'process' for regular steps.",
    semanticScale: { L: 'system', M: 'process', S: 'step' },
    engineManifest: { layout: 'sugiyama', edgeStyle: 'orthogonal_astar', isHorizontalFlow: true, nodeTypes: ['process', 'circle', 'oval', 'rhombus'] }
};
