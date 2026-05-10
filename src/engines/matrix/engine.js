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
        features: { hasNodeValue: false, allowConnections: false, supportsLegend: false},
        // Кодировка связей в .cci: рёбра запрещены
        ioFormat: { edgeEncoding: 'none' },
        engineManifest: {
            layout: 'matrix',
            edgeStyle: 'orthogonal_astar',
            nodeTypes: ['process'],
            matrixGridOverlays: true,
            overlay: {
                // Бокс вокруг нод в группе
                groupPad: 28,
                // Доп. отступы единого bbox (поверх groupPad)
                globalLeftMargin: 36,
                globalRightMargin: 24,
                // Граница группы
                stroke: { width: 1.6, dash: 'none', opacity: 0.46 },
                // Подпись группы
                label: { fontSize: 20, fontWeight: 700, opacity: 0.85 },
            },
        },
    },

    layout: {
        algorithm: 'matrix',
        isHorizontalFlow: false,
        edgeStyle: 'orthogonal_astar',
        rules: {
            RANKER: 'network-simplex',
        },
    },

    routing: {
        portStrategy: 'dynamic',
        allowPortReuse: false,
        allowCornerKisses: false,
        allowSiblingCrossings: false,
        portPenalty(portId, w, h) {
            if (portId === 'BifTop'  || portId === 'BifBottom') return w * 2;
            if (portId === 'BifLeft' || portId === 'BifRight')  return h * 2;
            return 0;
        },
    },

    labeling: {
        strategy: 'none',
        textPathStartOffset: '50%',
    },

    parser: {
        exportEdges: () => {},      // matrix: рёбра запрещены
        resolveImplicitEdges: () => [],
    },
};
