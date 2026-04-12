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
            enforceMaxNodes: 9,, supportsLegend: true},
        // Кодировка в .cci: плоский data.nodes[] без групп и рёбер
        ioFormat: { edgeEncoding: 'none', flatNodes: true },

        engineManifest: {
            layout: 'piechart',
            edgeStyle: 'none',
            nodeTypes: ['pie_slice'],
            legend: {
                // \u0420\u0430\u0441\u0441\u0442\u043e\u044f\u043d\u0438\u0435 \u043e\u0442 \u043f\u0440\u0430\u0432\u043e\u0433\u043e \u0431\u043e\u043a\u0430 \u043f\u0438\u0440\u043e\u0433\u0430 \u0434\u043e \u043b\u0435\u0432\u043e\u0433\u043e \u043a\u0440\u0430\u044f \u043b\u0435\u0433\u0435\u043d\u0434\u044b
                gapFromPie: 160,
                // \u0412\u044b\u0441\u043e\u0442\u0430 \u0441\u0442\u0440\u043e\u043a\u0438 \u043b\u0435\u0433\u0435\u043d\u0434\u044b (\u043f\u043e 1 \u043d\u0430 \u0441\u0435\u043a\u0442\u043e\u0440)
                rowHeight: 40,
                // \u0421\u0443\u043c\u043c\u0430\u0440\u043d\u044b\u0439 \u0432\u0435\u0440\u0442\u0438\u043a\u0430\u043b\u044c\u043d\u044b\u0439 padding \u0431\u043e\u043a\u0441\u0430 \u043b\u0435\u0433\u0435\u043d\u0434\u044b
                boxPadding: 24,
                boxWidth: 325,
                cornerRadius: 8,
                // \u041f\u0440\u044f\u043c\u043e\u0443\u0433\u043e\u043b\u044c\u043d\u0438\u043a \u0446\u0432\u0435\u0442\u0430 (\u0441\u0432\u043e\u0447)
                swatch: { width: 24, height: 18, cornerRadius: 2 },
                // \u041f\u043e\u0434\u043f\u0438\u0441\u044c
                text: { fontSize: 20, xOffset: 38 },
            },
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
