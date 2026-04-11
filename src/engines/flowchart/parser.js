/**
 * Flowchart parser plugin
 * Implicit edges: node.nextSteps → outbound arrows
 */
const idGen = () => `ie_${Math.random().toString(36).substr(2, 9)}`;

export default {
    // EXPORT: convert runtime edges → nextSteps on nodes (for .cci file writing)
    exportEdges: (gMap, edges) => {
        Object.keys(gMap).forEach(gId => {
            gMap[gId].nodes.forEach(n => {
                const outgoings = edges.filter(e => String(e.sourceId) === String(n.id));
                if (outgoings.length > 0) {
                    n.nextSteps = outgoings.map(e => e.label ? `${e.targetId}[${e.label}]` : e.targetId).join(', ');
                }
            });
        });
    },

    // IMPORT: expand nextSteps on nodes → runtime edges (for .cci file reading)
    resolveImplicitEdges: (flatNodes, _rawGroups) => {
        const edges = [];
        flatNodes.forEach(n => {
            if (!n.nextSteps) return;
            String(n.nextSteps).split(',').map(s => s.trim()).filter(Boolean).forEach(step => {
                const m = step.match(/^([^\[]+)(?:\[([^\]]*)\])?$/);
                if (!m) return;
                const targetId = m[1].trim();
                const label = m[2] ? m[2].trim() : undefined;
                edges.push({ id: idGen(), from: String(n.id), to: targetId, label, lineStyle: 'solid', connectionType: 'target' });
            });
        });
        return edges;
    }
};