/**
 * Flowchart engine plugin
 * AI prompt → ai_prompt.js
 */
import ai_prompt from './ai_prompt.js';

const idGen = () => `ie_${Math.random().toString(36).substr(2, 9)}`;

export default {
    type: 'flowchart',
    name: 'Flowchart',
    ai_prompt,

    schema: {
        id: 'flowchart',
        name: 'Flowchart',
        description: 'logical step-by-step processes or algorithms.',
        allowedNodes: ['process', 'circle', 'oval', 'rhombus'],
        allowedLineStyles: ['solid', 'dashed', 'none'],
        allowedArrowTypes: ['target', 'reverse', 'both', 'none'],
        features: { hasNodeValue: false, allowConnections: true },
        // Кодировка связей в .cci файле: нода хранит исходящие связи в поле nextSteps
        ioFormat: {
            edgeEncoding: 'nextSteps',  // node.nextSteps = "id1[label], id2"
            connectionField: 'nextSteps',
            level: 'node',
        },
        engineManifest: {
            layout: 'sugiyama',
            edgeStyle: 'orthogonal_astar',
            nodeTypes: ['process', 'circle', 'oval', 'rhombus'],
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
        exportEdges(gMap, edges) {
            Object.keys(gMap).forEach(gId => {
                gMap[gId].nodes.forEach(n => {
                    const outgoings = edges.filter(e => String(e.sourceId) === String(n.id));
                    if (outgoings.length > 0) {
                        n.nextSteps = outgoings.map(e => {
                            const ls = e.lineStyle || 'solid';
                            const ct = e.connectionType || 'target';
                            const label = e.label || '';
                            // Скрываем дефолты (solid/target) — короткая форма; недефолты — расширенная
                            const needsStyle = ls !== 'solid' || ct !== 'target';
                            if (!label && !needsStyle) return e.targetId;
                            if (!needsStyle) return `${e.targetId}[${label}]`;
                            return `${e.targetId}[${label}|${ls}|${ct}]`;
                        }).join(', ');
                    }
                });
            });
        },
        resolveImplicitEdges(flatNodes) {
            const edges = [];
            flatNodes.forEach(n => {
                if (!n.nextSteps) return;
                String(n.nextSteps).split(',').map(s => s.trim()).filter(Boolean).forEach(step => {
                    const m = step.match(/^([^\[]+)(?:\[([^\]]*)\])?$/);
                    if (!m) return;
                    const targetId = m[1].trim();
                    const [label, lineStyle, connectionType] = (m[2] || '').split('|').map(s => s?.trim());
                    edges.push({
                        id: idGen(), from: String(n.id), to: targetId,
                        label:          label          || undefined,
                        lineStyle:      lineStyle      || 'solid',
                        connectionType: connectionType || 'target',
                    });
                });
            });
            return edges;
        },
    },
};
