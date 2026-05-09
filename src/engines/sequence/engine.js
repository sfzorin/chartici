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
            layout: 'sequence',
            edgeStyle: 'orthogonal_astar',
            nodeTypes: ['process', 'circle'],
            matrixGridOverlays: true,
            overlay: {
                groupPad: 24,
                globalLeftMargin: 116,
                globalRightMargin: 24,
                lane: {
                    fillOpacity: 0.04,
                    stroke: { width: 1.4, dash: 'none', rx: 6, opacity: 0.38 },
                    divider: { width: 1.2, opacity: 0.28 },
                },
                label: { fontSize: 13, fontWeight: 700, opacity: 0.9 },
            },
        },
    },

    layout: {
        algorithm: 'sequence',
        isHorizontalFlow: false,
        edgeStyle: 'orthogonal_astar',
        rules: {
            MIN_GAP_X: 120,
            MIN_GAP_Y: 80,
            RANKER: 'network-simplex',
            SEQUENCE_MIN_STEP_GAP: 48,
            SEQUENCE_CROSS_LANE_GAP: 52,
            SEQUENCE_SAME_LANE_LABEL_CAP: 220,
            SEQUENCE_LANE_GAP: 56,
            SEQUENCE_LANE_PAD: 26,
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
        strategy: 'message-center',
        textPathStartOffset: '50%',
        labelStyle: {
            fontSize: 12,
            charWidth: 6.9,
            basePadding: 14,
            arrowPadding: 18,
            haloWidth: 3.5,
            offsetY: -7,
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
