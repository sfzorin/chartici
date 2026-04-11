/**
 * Timeline parser plugin
 * Implicit edges: node.spineId → edge from chevron spine to event node
 */
const idGen = () => `ie_${Math.random().toString(36).substr(2, 9)}`;

export default {
    exportEdges: (gMap, edges) => {
        edges.forEach(e => {
            for (let gId in gMap) {
                const tNode = gMap[gId].nodes.find(n => String(n.id) === String(e.targetId));
                if (tNode && gMap[gId].type !== 'chevron') tNode.spineId = e.sourceId;
            }
        });
    },

    resolveImplicitEdges: (flatNodes, _rawGroups) => {
        const edges = [];
        flatNodes.forEach(n => {
            if (!n.spineId) return;
            edges.push({ id: idGen(), from: String(n.spineId), to: String(n.id), lineStyle: 'dashed', connectionType: 'none' });
        });
        return edges;
    }
};