import { getDiagramRules } from './diagramRules.js';
import { getNodeDim } from './constants.js';
import { layoutSugiyamaDAG } from './layouts/layoutSugiyama.js';
import { layoutRadial } from './layouts/layoutRadial.js';
import { layoutTimeline } from './layouts/layoutTimeline.js';
import { layoutMatrix } from './layouts/layoutMatrix.js';
import { layoutTree } from './layouts/layoutTree.js';

export function layoutNodesHeuristically(nodes, edges, config = {}) {
  if (!nodes || nodes.length === 0) return [];
  if (nodes.length === 1) return [{ ...nodes[0], x: 0, y: 0 }];

  // 0. Extract text nodes so they don't participate in layout
  const textNodes = nodes.filter(n => n.type === 'text' || n.type === 'title');
  const layoutNodes = nodes.filter(n => n.type !== 'text' && n.type !== 'title');

  if (layoutNodes.length === 0) return textNodes;

  // 1. Identify Flow Direction
  let isHorizontalFlow = false;
  if (['tree', 'radial'].includes(config.diagramType)) {
      isHorizontalFlow = false;
  } else {
      isHorizontalFlow = true;
  }

  // Pre-calculate physical dimensions
  const processedNodes = layoutNodes.map(n => {
     const dim = getNodeDim(n);
     return { ...n, w: dim.width, h: dim.height };
  });

  const layoutNodeIds = new Set(layoutNodes.map(n => String(n.id)));
  const layoutEdges = edges.filter(e => layoutNodeIds.has(String(e.sourceId || e.from)) && layoutNodeIds.has(String(e.targetId || e.to)));

  const layoutRules = getDiagramRules(config.diagramType).layout;

  // 2. Delegate to strategy
  let result;
  const dt = config.diagramType === 'org_chart' ? 'tree' : config.diagramType;
  switch (dt) {
    case 'flowchart':
        result = layoutSugiyamaDAG(processedNodes, layoutEdges, isHorizontalFlow, layoutRules, true, dt);
        break;
    case 'radial':
        result = layoutRadial(processedNodes, layoutEdges, layoutRules);
        break;
    case 'timeline':
        result = layoutTimeline(processedNodes, layoutEdges, layoutRules, isHorizontalFlow);
        break;
    case 'matrix':
        result = layoutMatrix(processedNodes, layoutEdges, layoutRules);
        break;
    case 'tree':
        result = layoutTree(processedNodes, layoutEdges, isHorizontalFlow, layoutRules);
        break;
    case 'sequence':
    case 'erd':
    default:
        result = layoutSugiyamaDAG(processedNodes, layoutEdges, isHorizontalFlow, layoutRules, false, dt);
        break;
  }

  // 3. Clean up proxy metrics and snap to strict 20px grid
  const laidOutResult = result.map(n => {
      const out = { ...n };
      delete out.w;
      delete out.h;
      delete out.subTreeBreadth;
      
      out.x = Math.round(out.x / 20) * 20;
      out.y = Math.round(out.y / 20) * 20;
      
      return out;
  });

  // 4. Merge back text nodes
  return [...laidOutResult, ...textNodes];
}
