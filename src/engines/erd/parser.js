/**
 * Parser plugin — no implicit edges for this diagram type.
 * Connections come from explicit relationships/messages arrays.
 */
export default {
    exportEdges: (gMap, edges, explicitEdges) => {
        edges.forEach(e => {
            const ex = { sourceId: e.sourceId || e.from, targetId: e.targetId || e.to };
            if (e.label) ex.label = e.label;
            if (e.connectionType) ex.connectionType = e.connectionType;
            if (e.lineStyle) ex.lineStyle = e.lineStyle;
            explicitEdges.push(ex);
        });
    },

    resolveImplicitEdges: (_flatNodes, _rawGroups) => []
};
