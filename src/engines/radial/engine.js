/**
 * Radial engine plugin
 * AI prompt → ai_prompt.js
 */
import ai_prompt from './ai_prompt.js';

const idGen = () => `ie_${Math.random().toString(36).substr(2, 9)}`;

export default {
    type: 'radial',
    name: 'Radial',
    ai_prompt,

    schema: {
        id: 'radial',
        name: 'Radial',
        description: 'mind-maps, concentric layers, or hub-and-spoke architectures.',
        allowedNodes: ['process'],
        allowedLineStyles: ['solid', 'dashed', 'none'],
        allowedArrowTypes: ['target', 'none'],
        features: { hasNodeValue: false, allowConnections: true, supportsLegend: true},
        // Кодировка связей в .cci: группа хранит ID родительской ноды в поле parentId
        ioFormat: { edgeEncoding: 'parentId', connectionField: 'parentId', level: 'group' },
        engineManifest: {
            layout: 'radial',
            edgeStyle: 'straight',
            nodeTypes: ['process'],
            suppressEdgeLabels: true,
        },
    },

    layout: {
        algorithm: 'radial',
        isHorizontalFlow: false,
        edgeStyle: 'straight',
        rules: {
            RANKER: 'network-simplex',
        },
    },

    routing: {
        portStrategy: 'none',
        allowPortReuse: false,
        allowCornerKisses: false,
        allowSiblingCrossings: false,
        portPenalty() { return 0; },
    },

    labeling: {
        strategy: 'none',
        textPathStartOffset: '50%',
    },

    parser: {
        exportEdges(gMap, edges) {
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
        resolveImplicitEdges(flatNodes, rawGroups) {
            const edges = [];
            (rawGroups || []).forEach(g => {
                if (!g.parentId) return;
                (g.nodes || []).forEach(n => {
                    if (String(g.parentId) === String(n.id)) return;
                    edges.push({ id: idGen(), from: String(g.parentId), to: String(n.id), lineStyle: 'solid', connectionType: 'target' });
                });
            });
            flatNodes.forEach(n => {
                if (!n.nextSteps) return;
                String(n.nextSteps).split(',').map(s => s.trim()).filter(Boolean).forEach(step => {
                    const m = step.match(/^([^\[]+)(?:\[([^\]]*)\])?$/);
                    if (!m) return;
                    edges.push({ id: idGen(), from: String(n.id), to: m[1].trim(), label: m[2]?.trim(), lineStyle: 'solid', connectionType: 'target' });
                });
            });
            return edges;
        },
    },
};
