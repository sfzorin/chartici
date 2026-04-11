export default {
    exportEdges: (gMap, edges, explicitEdges) => {
        edges.forEach(e => {
            for (let gId in gMap) {
                const tNode = gMap[gId].nodes.find(n => String(n.id) === String(e.targetId));
                if (tNode && gMap[gId].type !== 'chevron') tNode.spineId = e.sourceId;
            }
        });
    }
};