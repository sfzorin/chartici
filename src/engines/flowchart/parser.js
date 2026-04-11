export default {
    exportEdges: (gMap, edges, explicitEdges) => {
        Object.keys(gMap).forEach(gId => {
            gMap[gId].nodes.forEach(n => {
                const outgoings = edges.filter(e => String(e.sourceId) === String(n.id));
                if (outgoings.length > 0) {
                   n.nextSteps = outgoings.map(e => e.label ? `${e.targetId}[${e.label}]` : e.targetId).join(', ');
                }
            });
        });
    }
};