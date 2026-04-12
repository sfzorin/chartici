/**
 * Timeline engine plugin
 * AI prompt → ai_prompt.js
 */
import ai_prompt from './ai_prompt.js';

const idGen = () => `ie_${Math.random().toString(36).substr(2, 9)}`;

export default {
    type: 'timeline',
    name: 'Timeline',
    ai_prompt,

    schema: {
        id: 'timeline',
        name: 'Timeline',
        description: 'events plotted on a generic chronological spine.',
        allowedNodes: ['chevron', 'process'],
        connectionRules: [
            "chevron -> chevron : MUST use 'lineStyle': 'none' (invisible topological spine)",
            "process -> chevron : Use 'solid' or 'dashed' (visible event links)",
        ],
        allowedLineStyles: ['solid', 'dashed', 'none'],
        allowedArrowTypes: ['target', 'none'],
        features: { hasNodeValue: false, allowConnections: true },
        // Кодировка связей в .cci: событие-нода хранит ID шеврона в поле spineId
        ioFormat: { edgeEncoding: 'spineId', connectionField: 'spineId', level: 'node' },
        engineManifest: {
            layout: 'timeline',
            edgeStyle: 'straight_clipped',
            nodeTypes: ['chevron', 'process'],
            suppressSpineEdges: true,
            spineNodeType: 'chevron',
        },
    },

    layout: {
        algorithm: 'timeline',
        isHorizontalFlow: true,
        edgeStyle: 'straight_clipped',
    },

    routing: {
        portStrategy: 'none',
        portPenalty() { return 0; },
    },

    parser: {
        exportEdges(gMap, edges) {
            edges.forEach(e => {
                for (let gId in gMap) {
                    const tNode = gMap[gId].nodes.find(n => String(n.id) === String(e.targetId));
                    if (tNode && gMap[gId].type !== 'chevron') tNode.spineId = e.sourceId;
                }
            });
        },
        resolveImplicitEdges(flatNodes) {
            const edges = [];
            flatNodes.forEach(n => {
                if (!n.spineId) return;
                edges.push({ id: idGen(), from: String(n.spineId), to: String(n.id), lineStyle: 'dashed', arrowType: 'none' });
            });
            return edges;
        },
    },
};
