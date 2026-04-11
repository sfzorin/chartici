/**
 * Tree parser plugin
 * Implicit edges: group.parentId → edges to each child node (skip self-loops)
 *                 node.nextSteps → outbound arrows (fallback for flat structures)
 */
const idGen = () => `ie_${Math.random().toString(36).substr(2, 9)}`;

export default {
    exportEdges: (gMap, edges) => {
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
    },

    resolveImplicitEdges: (flatNodes, rawGroups) => {
        const edges = [];

        // 1. group.parentId → edges (skip self-loops: parent node inside its own group)
        (rawGroups || []).forEach(g => {
            if (!g.parentId) return;
            (g.nodes || []).forEach(n => {
                if (String(g.parentId) === String(n.id)) return;
                edges.push({ id: idGen(), from: String(g.parentId), to: String(n.id), lineStyle: 'solid', connectionType: 'none' });
            });
        });

        // 2. node.nextSteps → outbound arrows
        flatNodes.forEach(n => {
            if (!n.nextSteps) return;
            String(n.nextSteps).split(',').map(s => s.trim()).filter(Boolean).forEach(step => {
                const m = step.match(/^([^\[]+)(?:\[([^\]]*)\])?$/);
                if (!m) return;
                edges.push({ id: idGen(), from: String(n.id), to: m[1].trim(), label: m[2]?.trim(), lineStyle: 'solid', connectionType: 'none' });
            });
        });

        return edges;
    }
};