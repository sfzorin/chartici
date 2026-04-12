/**
 * Sequence engine plugin
 * AI prompt → ai_prompt.js
 */
import ai_prompt from './ai_prompt.js';

export default {
    type: 'sequence',
    name: 'Sequence',
    ai_prompt,

    schema: {
        id: 'sequence',
        name: 'Sequence',
        description: 'chronological interactions between systems or actors.',
        allowedNodes: ['process', 'circle'],
        allowedLineStyles: ['solid', 'dashed', 'none'],
        allowedArrowTypes: ['target', 'reverse', 'both', 'none'],
        features: { hasNodeValue: false, allowConnections: true, supportsLegend: false},
        // Кодировка связей в .cci: явные рёбра в data.messages[]
        ioFormat: { edgeEncoding: 'explicit', edgeKey: 'messages' },
        engineManifest: {
            layout: 'sugiyama',
            edgeStyle: 'orthogonal_astar',
            nodeTypes: ['process', 'circle'],
            matrixGridOverlays: true,
            overlay: {
                // Бокс вокруг нод в дорожке
                groupPad: 30,
                // Доп. отступы единого bbox
                globalLeftMargin: 50,
                globalRightMargin: 30,
                // Граница дорожки (рамка)
                lane: { fillOpacity: 0.04, stroke: { width: 2, dash: '4 4', rx: 4 } },
                // Подпись дорожки (вертикальная)
                label: { fontSize: 15, fontWeight: 600, opacity: 0.8 },
            },
        },
    },

    layout: {
        algorithm: 'sugiyama',
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
