export default {
    exportEdges: (gMap, edges, explicitEdges) => {
        edges.forEach(e => {
            const ex = { sourceId: e.sourceId, targetId: e.targetId };
            if (e.label) ex.label = e.label;
            if (e.connectionType) ex.connectionType = e.connectionType;
            explicitEdges.push(ex);
        });
    }
};