/**
 * Tree engine plugin
 * AI prompt → ai_prompt.js
 */
import ai_prompt from './ai_prompt.js';

const idGen = () => `ie_${Math.random().toString(36).substr(2, 9)}`;

export default {
    type: 'tree',
    name: 'Tree',
    ai_prompt,

    schema: {
        id: 'tree',
        name: 'Tree',
        description: 'hierarchical structure with one or few roots branching downwards.',
        allowedNodes: ['process'],
        allowedLineStyles: ['solid', 'dashed', 'none'],
        allowedArrowTypes: ['none', 'target'],
        features: { hasNodeValue: false, allowConnections: true },
        // Кодировка связей в .cci: группа хранит ID родительской ноды в поле parentId
        ioFormat: { edgeEncoding: 'parentId', connectionField: 'parentId', level: 'group' },
        engineManifest: {
            layout: 'tree',
            edgeStyle: 'orthogonal_astar',
            nodeTypes: ['process'],
        },
    },

    layout: {
        algorithm: 'tree',
        isHorizontalFlow: false,
        edgeStyle: 'orthogonal_astar',
    },

    routing: {
        portStrategy: 'topdown',
        allowSiblingCrossings: true,
        enableBusRouting: true,
        portPenalty(portId, w, h) {
            if (portId === 'BifTop'  || portId === 'BifBottom') return w * 2;
            if (portId === 'BifLeft' || portId === 'BifRight')  return h * 2;
            return 0;
        },
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
                    edges.push({ id: idGen(), from: String(g.parentId), to: String(n.id), lineStyle: 'solid', arrowType: 'none' });
                });
            });
            flatNodes.forEach(n => {
                if (!n.nextSteps) return;
                String(n.nextSteps).split(',').map(s => s.trim()).filter(Boolean).forEach(step => {
                    const m = step.match(/^([^\[]+)(?:\[([^\]]*)\])?$/);
                    if (!m) return;
                    edges.push({ id: idGen(), from: String(n.id), to: m[1].trim(), label: m[2]?.trim(), lineStyle: 'solid', arrowType: 'none' });
                });
            });
            return edges;
        },
    },
};
