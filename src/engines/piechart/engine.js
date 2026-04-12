/**
 * Piechart engine plugin
 * AI prompt → ai_prompt.js
 */
import ai_prompt from './ai_prompt.js';

export default {
    type: 'piechart',
    name: 'Pie Chart',
    ai_prompt,

    schema: {
        id: 'piechart',
        name: 'Pie Chart',
        description: 'breakdown of items into proportional circular slices.',
        allowedNodes: ['pie_slice'],
        connectionRules: ['Edges MUST NOT be used in piecharts.'],
        allowedLineStyles: [],
        allowedArrowTypes: [],
        features: {
            hasNodeValue: true,
            allowConnections: false,
            autoIncrementColors: true,
            recalculateOnEdit: true,
            enforceMaxNodes: 9,
        },
        // Кодировка в .cci: плоский data.nodes[] без групп и рёбер
        ioFormat: { edgeEncoding: 'none', flatNodes: true },

        engineManifest: {
            layout: 'piechart',
            edgeStyle: 'none',
            nodeTypes: ['pie_slice'],
        },
    },

    layout: {
        algorithm: 'piechart',
        isHorizontalFlow: false,
        edgeStyle: 'none',
    },

    routing: {
        portStrategy: 'none',
        portPenalty() { return 0; },
    },

    parser: {
        exportEdges: () => {},
        resolveImplicitEdges: () => [],
    },
};
