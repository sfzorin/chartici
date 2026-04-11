export default {
    exportEdges: (gMap, edges, explicitEdges) => {
        edges.forEach(e => {
            const targetGroupId = Object.keys(gMap).find(gId => gMap[gId].nodes.some(n => String(n.id) === String(e.targetId)));
            if (targetGroupId) {
                if (!gMap[targetGroupId].parentId || gMap[targetGroupId].parentId === e.sourceId) {
                    gMap[targetGroupId].parentId = e.sourceId;
                } else {
                    for (let gId in gMap) {
                        const sNode = gMap[gId].nodes.find(n => String(n.id) === String(e.sourceId));
                        if (sNode) {
                            const route = e.label ? `${e.targetId}[${e.label}]` : e.targetId;
                            sNode.nextSteps = sNode.nextSteps ? `${sNode.nextSteps}, ${route}` : route;
                        }
                    }
                }
            }
        });
    }
};