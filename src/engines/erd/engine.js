/**
 * ERD engine plugin
 * AI prompt → ai_prompt.js
 */
import ai_prompt from './ai_prompt.js';

export default {
    type: 'erd',
    name: 'Entity-Relationship',
    ai_prompt,

    schema: {
        id: 'erd',
        name: 'Entity-Relationship',
        description: 'database schemas, entities, and relationships.',
        allowedNodes: ['process'],
        allowedLineStyles: ['solid', 'dashed', 'none'],
        allowedArrowTypes: [],
        allowedConnectionTypes: ['1:1', '1:N', 'N:1', 'N:M'],
        features: { hasNodeValue: false, allowConnections: true },
        engineManifest: {
            layout: 'sugiyama',
            edgeStyle: 'orthogonal_astar',
            nodeTypes: ['process'],
        },
    },

    layout: {
        algorithm: 'sugiyama',
        isHorizontalFlow: true,
        edgeStyle: 'orthogonal_astar',
    },

    routing: {
        portStrategy: 'dynamic',
        portPenalty(portId, w, h) {
            if (portId === 'BifTop'  || portId === 'BifBottom') return w * 2;
            if (portId === 'BifLeft' || portId === 'BifRight')  return h * 2;
            return 0;
        },
    },

    parser: {
        exportEdges(gMap, edges, explicitEdges) {
            edges.forEach(e => {
                const ex = { sourceId: e.sourceId || e.from, targetId: e.targetId || e.to };
                if (e.label)          ex.label = e.label;
                if (e.connectionType) ex.connectionType = e.connectionType;
                if (e.lineStyle)      ex.lineStyle = e.lineStyle;
                explicitEdges.push(ex);
            });
        },
        resolveImplicitEdges: () => [],
    },
};
