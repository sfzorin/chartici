import { getDiagramRules } from './diagramRules.js';
import { getNodeDim } from './constants.js';
import { layoutSugiyamaDAG } from './layouts/layoutSugiyama.js';
import { layoutRadial } from './layouts/layoutRadial.js';
import { layoutTimeline } from './layouts/layoutTimeline.js';
import { layoutMatrix } from './layouts/layoutMatrix.js';
import { layoutTree } from './layouts/layoutTree.js';
import { layoutPiechart } from './layouts/layoutPiechart.js';

export function layoutNodesHeuristically(nodes, edges, config = {}) {
  if (!nodes || nodes.length === 0) return [];
  if (nodes.length === 1) return [{ ...nodes[0], x: 0, y: 0 }];

  // 0. Extract text nodes so they don't participate in layout
  const textNodes = nodes.filter(n => n.type === 'text' || n.type === 'title');
  const layoutNodes = nodes.filter(n => n.type !== 'text' && n.type !== 'title');

  if (layoutNodes.length === 0) return textNodes;

  // 1. Identify Flow Direction
  let isHorizontalFlow = false;
  if (['tree', 'radial', 'piechart'].includes(config.diagramType)) {
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

  // X. Pre-process piechart groups: collapse them into proxy nodes
  const piechartGroups = (config.groups || []).filter(g => g.type === 'piechart');
  let finalProcessedNodes = [...processedNodes];
  const pieProxyMap = {}; // proxyId -> { group, childNodes }
  
  if (piechartGroups.length > 0) {
     const nodesToExtract = new Set();
     piechartGroups.forEach(g => {
        const children = finalProcessedNodes.filter(n => n.groupId === g.id);
        if (children.length === 0) return;
        
        children.forEach(c => nodesToExtract.add(c.id));
        
        const proxyId = `__pie_proxy_${g.id}`;
        // approximate pie diameter
        const sizeMap = { 'XS': 200, 'S': 300, 'M': 450, 'L': 600, 'XL': 800 };
        const side = sizeMap[g.size] || 450;
        
        pieProxyMap[proxyId] = {
           group: g,
           childNodes: children
        };
        
        finalProcessedNodes.push({
           id: proxyId,
           groupId: g.id,
           type: 'process',
           w: side,
           h: side
        });
     });
     
     finalProcessedNodes = finalProcessedNodes.filter(n => !nodesToExtract.has(n.id));
  }

  // 2. Delegate to strategy
  let result;
  const dt = config.diagramType === 'org_chart' ? 'tree' : config.diagramType;
  switch (dt) {
    case 'flowchart':
        result = layoutSugiyamaDAG(finalProcessedNodes, layoutEdges, isHorizontalFlow, layoutRules, true, dt);
        break;
    case 'piechart':
        result = layoutPiechart(finalProcessedNodes, layoutEdges, layoutRules);
        break;
    case 'radial':
        result = layoutRadial(finalProcessedNodes, layoutEdges, layoutRules);
        break;
    case 'timeline':
        result = layoutTimeline(finalProcessedNodes, layoutEdges, layoutRules, isHorizontalFlow);
        break;
    case 'matrix':
        result = layoutMatrix(finalProcessedNodes, layoutEdges, layoutRules);
        break;
    case 'tree':
        result = layoutTree(finalProcessedNodes, layoutEdges, isHorizontalFlow, layoutRules);
        break;
    case 'sequence':
    case 'erd':
    default:
        result = layoutSugiyamaDAG(finalProcessedNodes, layoutEdges, isHorizontalFlow, layoutRules, false, dt);
        break;
  }

  // 3. Clean up proxy metrics and restore pie slices
  let laidOutResult = [];
  result.forEach(n => {
      if (pieProxyMap[n.id]) {
          // This is a pie proxy! 
          const proxy = pieProxyMap[n.id];
          const cx = Math.round(n.x / 20) * 20;
          const cy = Math.round(n.y / 20) * 20;
          
          // Layout the pie slices using layoutPiechart logic, and assign them cx, cy
          const slices = layoutPiechart(proxy.childNodes, [], layoutRules);
          slices.forEach(slice => {
             slice.x = cx;
             slice.y = cy;
             slice.isPieSlice = true; // flag for DiagramNode to render slice
             laidOutResult.push(slice);
          });
      } else {
          const out = { ...n };
          delete out.w;
          delete out.h;
          delete out.subTreeBreadth;
          
          out.x = Math.round(out.x / 20) * 20;
          out.y = Math.round(out.y / 20) * 20;
          laidOutResult.push(out);
      }
  });

  // 4. Merge back text nodes and dynamically restore relative logical offsets
  const newPositions = {};
  laidOutResult.forEach(rn => newPositions[rn.id] = {x: rn.x, y: rn.y});
  
  const updatedTextNodes = textNodes.map(tn => {
      const edge = edges.find(e => 
         (e.lineStyle === 'none' || e.lineStyle === 'hidden') &&
         (e.from === tn.id || e.to === tn.id)
      );
      if (edge) {
         const parentId = edge.from === tn.id ? edge.to : edge.from;
         const originalParent = nodes.find(pn => pn.id === parentId);
         if (originalParent && newPositions[parentId]) {
             const dx = (tn.x || 0) - (originalParent.x || 0);
             const dy = (tn.y || 0) - (originalParent.y || 0);
             const np = newPositions[parentId];
             return {
                 ...tn,
                 x: Math.round((np.x + dx)/20) * 20,
                 y: Math.round((np.y + dy)/20) * 20
             };
         }
      }
      return tn;
  });

  return [...laidOutResult, ...updatedTextNodes];
}
