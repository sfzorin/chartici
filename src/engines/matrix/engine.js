/**
 * Matrix engine plugin
 * AI prompt → ai_prompt.js
 */
import ai_prompt from './ai_prompt.js';

export default {
    type: 'matrix',
    name: 'Matrix',
    ai_prompt,

    schema: {
        id: 'matrix',
        name: 'Matrix',
        description: 'grid-like comparisons, or categorization into distinct cluster zones/cells.',
        allowedNodes: ['process'],
        connectionRules: ['Edges MUST NOT be used in matrices.'],
        allowedLineStyles: [],
        allowedArrowTypes: [],
        features: { hasNodeValue: false, allowConnections: false },
        // Кодировка связей в .cci: рёбра запрещены
        ioFormat: { edgeEncoding: 'none' },
        engineManifest: {
            layout: 'matrix',
            edgeStyle: 'orthogonal_astar',
            nodeTypes: ['process'],
            matrixGridOverlays: true,
        },
    },

    layout: {
        algorithm: 'matrix',
        isHorizontalFlow: false,
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
