import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { SIZES, getNodeDim } from '../utils/constants';
import { calculateAllPaths } from '../utils/engine/index.js';
import { getTrueBox, checkCollision } from '../utils/engine/geometry';
import { getGroupId } from '../utils/groupUtils';
import { getCanvasColors } from '../diagram/colors.js';
import { NODE_REGISTRY } from '../diagram/nodes.jsx';
import DiagramNode from './shapes/DiagramNode';
import DiagramEdge from './shapes/DiagramEdge';
import LeftToolbox from './LeftToolbox';
import Icon from './Icons';

import { computeBindings, getAxisDir } from '../utils/layout';
import { DIAGRAM_SCHEMAS } from '../utils/diagramSchemas';

export default function DiagramRenderer({ 
  initialData, 
  theme,
  appTheme,
  svgRef, 
  aspectRatio = 'auto', 
  bgColor = 'white', 
  onNodeSelect, 
  selectedNodeId, 
  onEdgeSelect,
  selectedEdgeId,
  onNodesChange,
  onEdgesChange,
  onGroupLabelChange,
  onAutoLayout,
  diagramTitle,
  diagramType,
  setDiagramType,
  onConnect,
  onAddNode,
  panToNodeId,
  fitTrigger,
  toolboxProps,
  showLegend = false,
}) {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  
  const activeSchema = DIAGRAM_SCHEMAS[diagramType] || DIAGRAM_SCHEMAS.flowchart;
  
  // Dragging state
  const [dragState, setDragState] = useState(null);

  // Connection dragging state
  const [hoveredNodeId, setHoveredNodeId] = useState(null);
  const [connectionState, setConnectionState] = useState(null); // { sourceId, x, y }
  const [activeLinkSource, setActiveLinkSource] = useState(null);

  // Inline editing state
  const [editingNodeId, setEditingNodeId] = useState(null);
  const [editingEdgeId, setEditingEdgeId] = useState(null);
  const [editingGroupId, setEditingGroupId] = useState(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && activeLinkSource) {
        setActiveLinkSource(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeLinkSource]);

  // Pan & Zoom state
  const viewportRef = useRef(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (initialData) {
      const newNodes = [...(initialData.nodes || [])];
      
      const config = initialData.config || {};
      if (newNodes.length > 0 && diagramTitle && diagramTitle.trim() !== '') {
         newNodes.push({
             id: '__SYSTEM_TITLE__',
             type: 'title',
             label: diagramTitle,
             size: config.titleSize || 'M',
             x: config.titleX, // Can be undefined, DiagramRenderer will compute fallback
             y: config.titleY
         });
      }

      setNodes(newNodes);
      setEdges(initialData.edges || []);

      const regularNodes = newNodes.filter(n => n.id !== '__SYSTEM_TITLE__');
      if (regularNodes.length === 0) {
          // Empty sheets will be auto-fitted via fitTrigger
      }
    }
  }, [initialData, diagramTitle]);

  useEffect(() => {
    if (fitTrigger > 0) {
       setPendingZoom(Date.now());
    }
  }, [fitTrigger]);

  // Initial autofit on mount
  const hasMounted = useRef(false);
  useEffect(() => {
    if (!hasMounted.current) {
        hasMounted.current = true;
        setPendingZoom(Date.now());
    }
  }, []);

  useEffect(() => {
    if (panToNodeId) {
      const node = nodes.find(n => n.id === panToNodeId);
      if (node && svgRef.current) {
        const rect = svgRef.current.getBoundingClientRect();
        setPan({
           x: (rect.width / 2) - node.x * zoom,
           y: (rect.height / 2) - node.y * zoom
        });
      }
    }
  }, [panToNodeId]);



  const computedNodes = useMemo(() => {
     const bound = computeBindings(nodes);
     if (diagramType === 'piechart') {
         return bound.map(n => {
            if (n.type !== 'text' && n.type !== 'title') {
                return { ...n, type: 'pie_slice' };
            }
            return n;
         });
     }
     return bound;
  }, [nodes, diagramType]);
  const nodesRef = useRef(nodes);
  const computedNodesRef = useRef(computedNodes);
  
  useEffect(() => {
    nodesRef.current = nodes;
    computedNodesRef.current = computedNodes;
  }, [nodes, computedNodes]);

  const handlePointerDown = useCallback((e, nodeId) => {
    if (activeLinkSource) {
       e.preventDefault();
       e.stopPropagation();
       if (nodeId !== activeLinkSource && typeof onConnect === 'function') {
           onConnect(activeLinkSource, nodeId);
       }
       setActiveLinkSource(null);
       return;
    }
    
    if (onNodeSelect) onNodeSelect(nodeId);
    
    const dragTargetId = nodeId;
    
    const svg = svgRef.current;
    const viewport = viewportRef.current;
    if (!svg || !viewport) return;
    
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    
    try {
      const svgP = pt.matrixTransform(viewport.getScreenCTM().inverse());
      const node = computedNodesRef.current.find(n => n.id === dragTargetId);
      if (!node) return;

      setDragState({
        id: dragTargetId,
        startSvgP: { x: svgP.x, y: svgP.y },
        initialNodes: nodesRef.current.map(n => {
            if (n.x === undefined || n.y === undefined) {
               const comp = computedNodesRef.current.find(cn => cn.id === n.id);
               return { ...n, x: comp?.x || 0, y: comp?.y || 0 };
            }
            return n;
        })
      });
      
      e.stopPropagation();
      e.target.setPointerCapture(e.pointerId);
    } catch { /* ignore DOM exceptions */ }
  }, [onNodeSelect, svgRef, activeLinkSource, onConnect]);

  const handleDoubleClick = useCallback((e, nodeId) => {
    e.stopPropagation();
    setEditingNodeId(nodeId);
  }, []);

  const handleEditComplete = useCallback((nodeId, newLabel) => {
    setEditingNodeId(null);
    if (newLabel === null) return; // Cancelled
    setNodes(prev => {
      const updated = prev.map(n => n.id === nodeId ? { ...n, label: newLabel } : n);
      if (onNodesChange) onNodesChange(updated);
      return updated;
    });
  }, [onNodesChange]);

  const handleEdgeDoubleClick = useCallback((edgeId) => {
    setEditingEdgeId(edgeId);
  }, []);

  const handleEdgeEditComplete = useCallback((edgeId, newLabel) => {
    setEditingEdgeId(null);
    if (newLabel === null) return; // Cancelled
    setEdges(prev => {
      const updated = prev.map(e => e.id === edgeId ? { ...e, label: newLabel } : e);
      if (onEdgesChange) onEdgesChange(updated);
      return updated;
    });
  }, [onEdgesChange]);

  const handleGroupEditComplete = useCallback((groupId, newLabel) => {
    setEditingGroupId(null);
    if (newLabel === null) return; // Cancelled
    if (onGroupLabelChange) onGroupLabelChange(groupId, newLabel);
  }, [onGroupLabelChange]);

  const handleHoverChange = useCallback((nodeId, isHovered) => {
    if (isHovered) {
      setHoveredNodeId(nodeId);
    } else if (hoveredNodeId === nodeId) {
      setHoveredNodeId(null);
    }
  }, [hoveredNodeId]);

  const handleStartConnection = useCallback((nodeId, port, pointerId) => {
    const node = nodesRef.current.find(n => n.id === nodeId);
    if (!node) return;
    
    setConnectionState({
      sourceId: nodeId,
      startX: node.x + port.cx,
      startY: node.y + port.cy,
      x: node.x + port.cx,
      y: node.y + port.cy
    });

    const handleWindowMove = (e) => {
       if (!svgRef.current) return;
       const svg = svgRef.current;
       const pt = svg.createSVGPoint();
       pt.x = e.clientX;
       pt.y = e.clientY;
       
       let finalX, finalY;
       try {
           if (viewportRef.current) {
               const svgP = pt.matrixTransform(viewportRef.current.getScreenCTM().inverse());
               finalX = svgP.x;
               finalY = svgP.y;
           } else { throw new Error(); }
       } catch (err) {
           // Fallback to manual panning math natively based on the svg component
           try {
               const rawP = pt.matrixTransform(svg.getScreenCTM().inverse());
               // viewport transform is translate(pan.x, pan.y) scale(zoom)
               // rawP.x = pan.x + finalX * zoom => finalX = (rawP.x - pan.x)/zoom
               finalX = (rawP.x - pan.x) / zoom;
               finalY = (rawP.y - pan.y) / zoom;
           } catch (e2) { return; }
       }
       
       setConnectionState(prev => prev ? ({ ...prev, x: finalX, y: finalY }) : null);

       // Hit testing
       let foundTarget = null;
       for (const n of computedNodesRef.current) {
          if (n.id === nodeId) continue;
          const dim = getNodeDim(n);
          let hit = false;
          if (n.type === 'circle') {
             const r = Math.min(dim.width, dim.height) / 2;
             const cx = n.x;
             const cy = n.y;
             const dx = finalX - cx;
             const dy = finalY - cy;
             if (dx*dx + dy*dy <= r*r) hit = true;
          } else {
             if (finalX >= n.x - dim.width / 2 && finalX <= n.x + dim.width / 2 &&
                 finalY >= n.y - dim.height / 2 && finalY <= n.y + dim.height / 2) {
                 hit = true;
             }
          }
          if (hit) { foundTarget = n.id; break; }
       }
       setHoveredNodeId(prev => prev !== foundTarget ? foundTarget : prev);
    };

    const handleWindowUp = (e) => {
       window.removeEventListener('pointermove', handleWindowMove);
       window.removeEventListener('pointerup', handleWindowUp);
       setConnectionState(prev => {
          if (prev) {
             setHoveredNodeId(currentHover => {
                 if (currentHover && currentHover !== prev.sourceId) {
                    if (typeof onConnect === 'function') onConnect(prev.sourceId, currentHover);
                 }
                 return null;
             });
          }
          return null;
       });
    };

    window.addEventListener('pointermove', handleWindowMove);
    window.addEventListener('pointerup', handleWindowUp);

  }, [onConnect, pan, zoom]);



  const getAxisGroup = (startId, allNodes, axisType) => {
    let visited = new Set();
    let queue = [startId];
    visited.add(startId);
    
    while(queue.length > 0) {
      let currentId = queue.shift();
      const current = allNodes.find(n => n.id === currentId);
      
      allNodes.forEach(n => {
        if (!visited.has(n.id)) {
           let connected = false;
           if (n.bindTo === currentId && (n.type === 'text' || getAxisDir(n.bindDir) === axisType)) connected = true;
           if (current && current.bindTo === n.id && (current.type !== 'text' && getAxisDir(current.bindDir) === axisType)) connected = true;
           
           if (connected) {
             visited.add(n.id);
             queue.push(n.id);
           }
        }
      });
    }
    return Array.from(visited);
  };

  const handlePointerMove = (e) => {
    if (isPanning) {
      const svg = svgRef.current;
      if (svg) {
        const pt = svg.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());
        setPan({
          x: svgP.x - panStart.x,
          y: svgP.y - panStart.y
        });
      }
      return;
    }

    if (!dragState) return;
    const svg = svgRef.current;
    const viewport = viewportRef.current;
    if (!svg || !viewport) return;

    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    
    try {
      const svgP = pt.matrixTransform(viewport.getScreenCTM().inverse());
      // Calculate continuous offset
      const dxContinuous = svgP.x - dragState.startSvgP.x;
      const dyContinuous = svgP.y - dragState.startSvgP.y;
      
      // Calculate true grid snap: we snap the cumulative shift, NOT the absolute unrounded coordinate.
      // But we MUST ensure that the final coordinates n.x and n.y are clean multiples of 20.
      const dxSnap = Math.round(dxContinuous / 20) * 20;
      const dySnap = Math.round(dyContinuous / 20) * 20;
      
      const draggedNode = dragState.initialNodes.find(n => n.id === dragState.id);
      if (!draggedNode) return;

      const movingXIds = [...getAxisGroup(dragState.id, dragState.initialNodes, 'vertical')];
      const movingYIds = [...getAxisGroup(dragState.id, dragState.initialNodes, 'horizontal')];
      
      // Cascade movement to logically connected text nodes
      dragState.initialNodes.filter(n => n.type === 'text').forEach(tn => {
          const isConnectedToX = edges.some(e => 
             (e.lineStyle === 'none' || e.lineStyle === 'hidden') &&
             ((e.from === tn.id && movingXIds.includes(e.to)) ||
              (e.to === tn.id && movingXIds.includes(e.from)))
          );
          if (isConnectedToX && !movingXIds.includes(tn.id)) movingXIds.push(tn.id);
          
          const isConnectedToY = edges.some(e => 
             (e.lineStyle === 'none' || e.lineStyle === 'hidden') &&
             ((e.from === tn.id && movingYIds.includes(e.to)) ||
              (e.to === tn.id && movingYIds.includes(e.from)))
          );
          if (isConnectedToY && !movingYIds.includes(tn.id)) movingYIds.push(tn.id);
      });
      
      setNodes(dragState.initialNodes.map(n => {
        // Enforce strong 20px grid lock on final coordinates!
        let base_nx = Math.round((n.x || 0) / 20) * 20;
        let base_ny = Math.round((n.y || 0) / 20) * 20;
        let nx = base_nx;
        let ny = base_ny;

        if (movingXIds.includes(n.id)) nx += dxSnap;
        if (movingYIds.includes(n.id)) ny += dySnap;
        
        return { ...n, x: nx, y: ny };
      }));
    } catch { /* ignore */ }
  };

  const handlePointerUp = (e) => {
    if (isPanning) {
      setIsPanning(false);
    }
    if (dragState) {
      // Allow completely unrestricted grid-snapped movement
      setDragState(null);
      if (onNodesChange) onNodesChange(nodes);
      
      try { e.target.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    }
  };

  const handleBackgroundDown = (e) => {
    if (activeLinkSource) setActiveLinkSource(null);
    if (!connectionState && onNodeSelect) onNodeSelect(null);
    if (!connectionState && onEdgeSelect) onEdgeSelect(null);
    setIsPanning(true);
    const svg = svgRef.current;
    if (svg) {
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());
      setPanStart({ x: svgP.x - pan.x, y: svgP.y - pan.y });
    } else {
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
    e.target.setPointerCapture(e.pointerId);
  };
  
  const handleWheel = (e) => {
    const svg = svgRef.current;
    if (!svg) return;
    
    const zoomSensitivity = 0.0015;
    const delta = -e.deltaY * zoomSensitivity;
    const newZoom = Math.min(Math.max(0.1, zoom + delta), 4);
    
    if (newZoom !== zoom) {
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());
      
      const zoomRatio = newZoom / zoom;
      
      setPan({
        x: svgP.x - (svgP.x - pan.x) * zoomRatio,
        y: svgP.y - (svgP.y - pan.y) * zoomRatio
      });
      setZoom(newZoom);
    }
  };

  const handleZoomCenter = useCallback((newZoom) => {
    if (newZoom === zoom) return;
    const svg = svgRef.current;
    if (!svg) {
      setZoom(newZoom);
      return;
    }
    const rect = svg.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    
    const pt = svg.createSVGPoint();
    pt.x = cx;
    pt.y = cy;
    const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());
    
    const zoomRatio = newZoom / zoom;
    setPan({
      x: svgP.x - (svgP.x - pan.x) * zoomRatio,
      y: svgP.y - (svgP.y - pan.y) * zoomRatio
    });
    setZoom(newZoom);
  }, [zoom, pan, svgRef]);
  const prevPathsRef = useRef({});

  const engineEdges = useMemo(() => {
    const schema = DIAGRAM_SCHEMAS[diagramType];
    if (schema && !schema.features.allowConnections) return [];

    if (diagramType !== 'timeline') return edges;
    return edges.filter(edge => {
       const srcId = String(edge.sourceId || edge.from);
       const tgtId = String(edge.targetId || edge.to);
       const src = computedNodes.find(n => String(n.id) === srcId);
       const tgt = computedNodes.find(n => String(n.id) === tgtId);
       return !(src?.isTimelineSpine && tgt?.isTimelineSpine);
    });
  }, [edges, computedNodes, diagramType]);

  const computedPaths = useMemo(() => {
    const newPaths = calculateAllPaths(engineEdges, computedNodes, { diagramType }, dragState?.id, prevPathsRef.current);
    if (!dragState?.id) {
       prevPathsRef.current = newPaths;
    }
    return newPaths;
  }, [engineEdges, computedNodes, dragState, diagramType]);


  const { vMinX, vMinY, vW, vH, titleCx, titleY } = useMemo(() => {
     if (computedNodes.length === 0) return { vMinX: 0, vMinY: 0, vW: 1600, vH: 900, titleCx: 800, titleY: 0 };
     let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
     let txtMinX = Infinity, txtMinY = Infinity, txtMaxX = -Infinity, txtMaxY = -Infinity;
     computedNodes.forEach(n => {
        const dim = getNodeDim(n);
        const nw = n.type === 'pie_slice' ? dim.width : (n.w || dim.width);
        const nh = n.type === 'pie_slice' ? dim.height : (n.h || dim.height);
        const calloutPad = n.type === 'pie_slice' ? 140 : 0;
        const l = n.x - nw / 2 - calloutPad, r = n.x + nw / 2 + calloutPad;
        const t = n.y - nh / 2 - calloutPad, b = n.y + nh / 2 + calloutPad;
        if (n.type === 'text' || n.type === 'title') {
           if (l < txtMinX) txtMinX = l; if (r > txtMaxX) txtMaxX = r;
           if (t < txtMinY) txtMinY = t; if (b > txtMaxY) txtMaxY = b;
        } else {
           if (l < minX) minX = l; if (r > maxX) maxX = r;
           if (t < minY) minY = t; if (b > maxY) maxY = b;
        }
     });

     // Expand boundaries by Edge Paths
     if (computedPaths) {
        Object.values(computedPaths).forEach(p => {
           if (p && p.pts) {
              p.pts.forEach(pt => {
                 if (pt.x < minX) minX = pt.x; if (pt.x > maxX) maxX = pt.x;
                 if (pt.y < minY) minY = pt.y; if (pt.y > maxY) maxY = pt.y;
              });
           }
        });
     }

     // Expand boundaries by Matrix/Sequence Groups
     if ((diagramType === 'matrix' || diagramType === 'sequence') && initialData?.groups?.length > 1) {
        const realNodes = computedNodes.filter(n => n.type !== 'text' && n.type !== 'title');
        initialData.groups.forEach(g => {
           const gNodes = realNodes.filter(n => getGroupId(n) === g.id);
           if (gNodes.length === 0) return;
           const pad = 30; // Matches rendering logic padding for matrix boxes
           gNodes.forEach(n => {
              const dim = getNodeDim(n);
              const nw = n.w || dim.width;
              const nh = n.h || dim.height;
              const l = n.x - nw / 2 - pad - 60; // Extra left padding for Sequence labels
              const r = n.x + nw / 2 + pad + 8;
              const t = n.y - nh / 2 - pad - 8;
              const b = n.y + nh / 2 + pad + 8;
              if (l < minX) minX = l; if (r > maxX) maxX = r;
              if (t < minY) minY = t; if (b > maxY) maxY = b;
           });
        });
     }
     if (minX === Infinity) {
        minX = 600; minY = 420; maxX = 1000; maxY = 480;
     }

     const titleCx = (minX + maxX) / 2;
     let titleY = minY;

     if (diagramTitle) {
        minY -= (diagramType === 'piechart' ? 140 : 204);
     }

     if (diagramType === 'piechart') {
         maxX += 330; // Room specifically for the 1.25x legend on the right
         const pSlicesCount = computedNodes.filter(n => n.type === 'pie_slice').length;
         if (pSlicesCount > 0) {
             const approxLegendH = pSlicesCount * 40 + 24;
             maxY += (approxLegendH / 2) + 40; // Expand bottom boundary so legend doesn't overlap off canvas
         }
     }

     if (maxX - minX < 200) { minX -= 100; maxX += 100; }
     if (maxY - minY < 200) { minY -= 100; maxY += 100; }
     
     const graphW = maxX - minX;
     const graphH = maxY - minY;

     // Regular nodes: 10% padding each side (or 5% for pie charts to keep them huge)
     const padFactor = diagramType === 'piechart' ? 0.9 : 0.8;
     let pW = graphW / padFactor;
     let pH = graphH / padFactor;

     // Text nodes: expand paper if they fall outside 3% margin
     if (txtMinX < Infinity) {
        const textPadFraction = 0;
        const cx0 = (minX + maxX) / 2;
        const cy0 = (minY + maxY) / 2;
        const neededW = Math.max(pW, (Math.max(Math.abs(txtMinX - cx0), Math.abs(txtMaxX - cx0)) * 2) / (1 - textPadFraction * 2));
        const neededH = Math.max(pH, (Math.max(Math.abs(txtMinY - cy0), Math.abs(txtMaxY - cy0)) * 2) / (1 - textPadFraction * 2));
        pW = neededW;
        pH = neededH;
     }
     
     let targetRatio = null;
     if (aspectRatio && aspectRatio.includes(':')) {
       const [wRatio, hRatio] = aspectRatio.split(':').map(Number);
       if (!isNaN(wRatio) && !isNaN(hRatio) && hRatio !== 0) {
         targetRatio = wRatio / hRatio;
       }
     }
     
     if (targetRatio) {
        if (pW / pH > targetRatio) {
            pH = pW / targetRatio;
        } else {
            pW = pH * targetRatio;
        }
     }
     
     const cx = (minX + maxX) / 2;
     const cy = (minY + maxY) / 2;
     
     const sysTitle = computedNodes.find(n => n.id === '__SYSTEM_TITLE__');
     if (sysTitle) {
        // Note: computeBindings() creates fresh node objects, so these assignments are safe
        if (sysTitle.x === undefined) sysTitle.x = cx; // center on canvas
        if (sysTitle.y === undefined) {
           const titleSpacing = NODE_REGISTRY.title.layoutSpacing?.[sysTitle.size || 'M'] ?? 80;
           sysTitle.y = titleY - (diagramTitle ? titleSpacing : 0);
        }

     }
     
     return {
        vMinX: cx - pW / 2,
        vMinY: cy - pH / 2,
        vW: pW,
        vH: pH,
        titleCx,
        titleY
     };
   }, [computedNodes, aspectRatio, diagramTitle, computedPaths, initialData]);

  const handleZoomFit = useCallback(() => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const paddingMultiplier = 0.95;
    const newZoom = Math.min((rect.width * paddingMultiplier) / vW, (rect.height * paddingMultiplier) / vH, 4);
    const boxCx = vMinX + vW / 2;
    const boxCy = vMinY + vH / 2;
    setZoom(newZoom);
    setPan({ x: rect.width / 2 - boxCx * newZoom, y: rect.height / 2 - boxCy * newZoom });
  }, [vW, vH, vMinX, vMinY, setZoom, setPan]);

  const [pendingZoom, setPendingZoom] = useState(null);
  const prevLayoutTrigger = useRef(null);

  useEffect(() => {
    const trigger = initialData?.layoutTrigger;
    if (trigger && trigger !== prevLayoutTrigger.current) {
      prevLayoutTrigger.current = trigger;
      if (initialData?.nodes?.length > 0) {
        setPendingZoom(trigger);
      }
    }
  }, [initialData?.layoutTrigger, initialData?.nodes]);

  useEffect(() => {
    if (pendingZoom && vW > 0 && vH > 0 && svgRef.current) {
      const timer = setTimeout(() => {
        handleZoomFit();
        setPendingZoom(null);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [pendingZoom, vW, vH, handleZoomFit]);

  const ct = getCanvasColors(bgColor);
  const fillStr            = ct.canvasFill;
  const gridColorStr       = ct.gridColor;
  const isCanvasDark       = ct.isDark;
  const dEdge              = ct.diagramEdge;
  const dText              = ct.diagramText;
  const dGroup             = ct.diagramGroup;
  const resolvedCanvasColor = ct.resolvedBg;
  const resolvedLegendBg   = ct.legendBg;
  const resolvedLegendStroke = ct.legendStroke;



  return (
    <>
      {toolboxProps && (
        <LeftToolbox 
          {...toolboxProps}
          setDiagramType={setDiagramType}
          onAutoLayout={() => {
            if (onAutoLayout) onAutoLayout();
          }}
          activeLinkSource={activeLinkSource}
          toggleConnectionMode={() => {
             if (activeLinkSource) setActiveLinkSource(null);
             else if (selectedNodeId) setActiveLinkSource(selectedNodeId);
          }}
        />
      )}

      <div className="zoom-controls">
         <button className="toolbox-btn" onClick={() => handleZoomCenter(Math.max(0.1, Math.round((zoom - 0.1)*10)/10))}><Icon name="minus" size={18} /></button>
         <button className="toolbox-btn" onClick={handleZoomFit}><Icon name="fit" size={20} /></button>
         <button className="toolbox-btn" onClick={() => handleZoomCenter(Math.min(4, Math.round((zoom + 0.1)*10)/10))}><Icon name="plus" size={18} /></button>
      </div>

      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <svg 
        ref={svgRef}
        width="100%" 
        height="100%" 
        xmlns="http://www.w3.org/2000/svg"
        onPointerDown={handleBackgroundDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onWheel={handleWheel}
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: 'var(--desk-bg)', /* Desk background */
          touchAction: 'none',
          '--diagram-edge': dEdge,
          '--diagram-text': dText,
          '--diagram-group': dGroup
        }}
      >
        <defs>
          <pattern id="desk-grid" x="-10" y="-10" width="20" height="20" patternUnits="userSpaceOnUse" patternTransform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            <circle cx="10" cy="10" r="1.5" fill="var(--desk-grid)" />
          </pattern>
          <pattern id="canvas-grid" x="-10" y="-10" width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="10" cy="10" r="1.5" fill={gridColorStr} />
          </pattern>
          <pattern id="checkerboard-light" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
            <rect width="20" height="20" fill="#ffffff" />
            <rect width="10" height="10" fill="#e5e5e5" />
            <rect x="10" y="10" width="10" height="10" fill="#e5e5e5" />
          </pattern>
          <pattern id="checkerboard-dark" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
            <rect width="20" height="20" fill="#0f172a" />
            <rect width="10" height="10" fill="#1e293b" />
            <rect x="10" y="10" width="10" height="10" fill="#1e293b" />
          </pattern>
        </defs>
        
        {/* Infinite Desk Grid */}
        <rect width="100%" height="100%" fill="url(#desk-grid)" pointerEvents="none" />
        
        {/* Viewport Transform Group */}
        <g id="diagram-viewport" ref={viewportRef} transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          
          {/* Paper Canvas */}
          <g id="canvas-paper">
             <rect 
               x={vMinX} y={vMinY} width={vW} height={vH} 
               fill={fillStr} 
               rx="8" ry="8"
               style={{ filter: 'drop-shadow(0 20px 40px rgba(0,0,0,0.15))' }}
             />
             <rect className="canvas-grid-rect" x={vMinX} y={vMinY} width={vW} height={vH} fill="url(#canvas-grid)" pointerEvents="none" rx="8" ry="8" />
          </g>

          {/* ─── Topology Overlays Layer ─────────────────────── */}

             {/* ─── Matrix Grid Backdrop ─────────────────────── */}
          {activeSchema?.engineManifest?.matrixGridOverlays && initialData.groups && initialData.groups.length > 1 && (() => {
            const realNodes = computedNodes.filter(n => n.type !== 'text' && n.type !== 'title');
            if (realNodes.length === 0) return null;

            // ── Параметры рендеринга из engineManifest (с fallback) ──────────
            const ov = activeSchema.engineManifest.overlay || {};
            const groupPad         = ov.groupPad         ?? 30;
            const globalLeftMargin = ov.globalLeftMargin  ?? 50;
            const globalRightMargin= ov.globalRightMargin ?? 30;
            // matrix
            const mStroke   = ov.stroke || {};
            const mLabel    = ov.label  || {};
            const mStrokeW  = mStroke.width   ?? 2;
            const mStrokeDash = mStroke.dash  ?? '6, 6';
            const mStrokeOp = mStroke.opacity ?? 0.6;
            const mLabelFs  = mLabel.fontSize  ?? 20;
            const mLabelFw  = mLabel.fontWeight ?? 700;
            const mLabelOp  = mLabel.opacity    ?? 0.85;
            // sequence
            const lane      = ov.lane  || {};
            const laneStroke= lane.stroke || {};
            const sLabel    = ov.label  || {};
            const laneFillOp  = lane.fillOpacity ?? 0.04;
            const laneStW   = laneStroke.width ?? 2;
            const laneStDash= laneStroke.dash  ?? '4 4';
            const laneRx    = laneStroke.rx    ?? 4;
            const sLabelFs  = sLabel.fontSize  ?? 15;
            const sLabelFw  = sLabel.fontWeight ?? 600;
            const sLabelOp  = sLabel.opacity    ?? 0.8;

            // Compute group bounding boxes
            const groupBoxes = {};
            initialData.groups.forEach(g => {
              const gNodes = realNodes.filter(n => getGroupId(n) === g.id);
              if (gNodes.length === 0) return;
              const dims = gNodes.map(n => { const d = getNodeDim(n); return { x: n.x||0, y: n.y||0, w: d.width, h: d.height }; });
              groupBoxes[g.id] = {
                id: String(g.id || ''),
                left: Math.min(...dims.map(d => d.x - d.w/2)) - groupPad,
                right: Math.max(...dims.map(d => d.x + d.w/2)) + groupPad,
                top: Math.min(...dims.map(d => d.y - d.h/2)) - groupPad,
                bottom: Math.max(...dims.map(d => d.y + d.h/2)) + groupPad,
                label: String(g.label || g.id || ''),
                color: g.color
              };
            });
            const boxes = Object.values(groupBoxes);
            if (boxes.length < 2) return null;
            
            const globalLeft = Math.min(...boxes.map(b => b.left)) - globalLeftMargin;
            const globalRight = Math.max(...boxes.map(b => b.right)) + globalRightMargin;
            
            return (
              <g className="matrix-grid">
                {boxes.map((box, i) => (
                  <g key={`mbox-${i}`}>
                    {diagramType === 'sequence' ? (
                      <g>
                        <rect
                          x={globalLeft} y={box.top}
                          width={globalRight - globalLeft} height={box.bottom - box.top}
                          fill="var(--diagram-group)" fillOpacity={laneFillOp}
                          stroke="var(--diagram-group)" strokeWidth={laneStW} strokeDasharray={laneStDash} rx={laneRx}
                        />
                        {(!box.label.toLowerCase().startsWith('void')) && (
                          <foreignObject
                             x={globalLeft + 10} y={box.bottom - 10}
                             width={box.bottom - box.top - 20} height={40}
                             transform={`rotate(-90 ${globalLeft + 10} ${box.bottom - 10})`}
                             style={{ overflow: 'visible' }}
                          >
                             <div xmlns="http://www.w3.org/1999/xhtml" style={{
                                width: '100%', height: '100%',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: 'var(--diagram-group)',
                                fontSize: `${sLabelFs}px`, fontWeight: sLabelFw, opacity: sLabelOp,
                                textAlign: 'center',
                                cursor: 'text', pointerEvents: 'all', userSelect: 'none',
                                lineHeight: '1.2'
                             }}
                             onDoubleClick={(e) => { e.stopPropagation(); setEditingGroupId(box.id); }}>
                               {box.label.replace(/_/g, ' ')}
                             </div>
                          </foreignObject>
                        )}
                      </g>
                    ) : (
                      <g>
                        <path
                          d={`M ${(box.left + box.right) / 2 + Math.min((box.right - box.left - 16) / 2, box.label.length * 5.5 + 16)} ${box.top} L ${box.right - 8} ${box.top} Q ${box.right} ${box.top} ${box.right} ${box.top + 8} L ${box.right} ${box.bottom - 8} Q ${box.right} ${box.bottom} ${box.right - 8} ${box.bottom} L ${box.left + 8} ${box.bottom} Q ${box.left} ${box.bottom} ${box.left} ${box.bottom - 8} L ${box.left} ${box.top + 8} Q ${box.left} ${box.top} ${box.left + 8} ${box.top} L ${(box.left + box.right) / 2 - Math.min((box.right - box.left - 16) / 2, box.label.length * 5.5 + 16)} ${box.top}`}
                          fill="none" stroke="var(--diagram-group)" strokeWidth={mStrokeW} strokeDasharray={mStrokeDash}
                          opacity={mStrokeOp}
                        />
                        {(!box.label.toLowerCase().startsWith('void')) && (
                          <text
                            id={`group_text_${box.id.replace(/[^a-zA-Z0-9_-]/g, '_')}`}
                            x={(box.left + box.right) / 2} y={box.top + 6}
                            fontSize={mLabelFs} fill="var(--diagram-group)" opacity={mLabelOp}
                            fontWeight={mLabelFw} textAnchor="middle"
                            style={{ cursor: 'text', pointerEvents: 'all', userSelect: 'none' }}
                            onDoubleClick={(e) => { e.stopPropagation(); setEditingGroupId(box.id); }}
                          >
                            {box.label.replace(/_/g, ' ')}
                          </text>
                        )}
                      </g>
                    )}
                  </g>
                ))}
              </g>
            );
          })()}
          {diagramType === 'piechart' && showLegend && computedNodes.filter(n => n.type === 'pie_slice').length > 0 && (() => {
             const slices = computedNodes.filter(n => n.type === 'pie_slice');
             // Параметры из engineManifest (с fallback на безопасные дефолты)
             const lg = activeSchema?.engineManifest?.legend || {};
             const gapFromPie  = lg.gapFromPie  ?? 160;
             const rowHeight   = lg.rowHeight   ?? 40;
             const boxPadding  = lg.boxPadding  ?? 24;
             const boxWidth    = lg.boxWidth    ?? 325;
             const cornerRadius= lg.cornerRadius ?? 8;
             const sw          = lg.swatch      || {};
             const swW = sw.width ?? 24, swH = sw.height ?? 18, swRx = sw.cornerRadius ?? 2;
             const tx          = lg.text        || {};
             const textFs  = tx.fontSize ?? 20;
             const textXOff= tx.xOffset  ?? 38;
             // Радиус пирога + отступ для L-explode
             const PIE_RADIUS = 200;
             const hasExploded = slices.some(s => s.size === 'L');
             const pieBaseRadius = hasExploded ? PIE_RADIUS + 30 : PIE_RADIUS;
             const legendX = pieBaseRadius + gapFromPie;
             const legendBoxHeight = slices.length * rowHeight + boxPadding;
             // Центрировано по Y относительно центра пирога
             const legendY = -(legendBoxHeight / 2);
             return (
               <g transform={`translate(${legendX}, ${legendY})`}>
                 <rect x={0} y={0} width={boxWidth} height={legendBoxHeight} fill={resolvedLegendBg} stroke={resolvedLegendStroke} rx={cornerRadius} />
                 {slices.map((slice, i) => (
                    <g key={i} transform={`translate(20, ${boxPadding / 2 + 8 + i * rowHeight})`}>
                       <rect x={0} y={-swH/2} width={swW} height={swH} fill={`var(--color-${slice.color || 5})`} rx={swRx} />
                       <text x={textXOff} y={0} fontSize={textFs} fill="var(--diagram-text)" dominantBaseline="central">
                         {`${slice.label || 'Item'}${(slice.value !== undefined && slice.value !== null) ? ` (${slice.value})` : ''}`}
                       </text>
                    </g>
                 ))}
               </g>
             );
          })()}

          {/* ─── Universal Group Legend (non-piechart) ───────── */}
          {showLegend && diagramType !== 'piechart' && activeSchema?.features?.supportsLegend && (() => {
            const legendGroups = (initialData.groups || [])
              .filter(g => g.label && g.id && g.type !== 'title')
              .slice(0, 16);
            if (legendGroups.length < 2) return null;

            // Размеры легенды: текст = M-нода (16px)
            const FONT_SIZE  = 16;
            const ROW_H      = 36;
            const SWATCH     = 20;
            const SWATCH_GAP = 10;
            const PAD_X      = 16;
            const PAD_Y      = 12;
            const TEXT_OFFSET = SWATCH + SWATCH_GAP;
            // ~9px per char at 16px font
            const maxLabelLen = Math.max(...legendGroups.map(g => (g.label || '').length));
            const lgW = PAD_X * 2 + TEXT_OFFSET + Math.min(maxLabelLen * 9, 220);
            const lgH = PAD_Y * 2 + legendGroups.length * ROW_H;

            // Позиция: прямо под нодами (не в углу viewBox)
            const contentNodes = computedNodes.filter(n =>
              n.type !== 'text' && n.type !== 'title' && n.id !== '__SYSTEM_TITLE__'
            );
            const nodesRight  = contentNodes.length
              ? Math.max(...contentNodes.map(n => (n.x || 0) + getNodeDim(n).width  / 2))
              : vMinX + vW;
            const nodesBottom = contentNodes.length
              ? Math.max(...contentNodes.map(n => (n.y || 0) + getNodeDim(n).height / 2))
              : vMinY + vH;

            // Легенда: нижний правый угол кластера нод + небольшой отступ
            const lgX = nodesRight - lgW;
            const lgY = nodesBottom + 24;

            return (
              <g transform={`translate(${lgX}, ${lgY})`}>
                <rect
                  x={0} y={0} width={lgW} height={lgH}
                  fill={resolvedLegendBg} stroke={resolvedLegendStroke}
                  rx={8} opacity={0.97}
                />
                {legendGroups.map((g, i) => {
                  const color = g.color || 1;
                  const isHex = String(color).startsWith('#');
                  const fill  = isHex ? color : `var(--color-${color})`;
                  return (
                    <g key={g.id} transform={`translate(${PAD_X}, ${PAD_Y + i * ROW_H + ROW_H / 2})`}>
                      <rect x={0} y={-SWATCH/2} width={SWATCH} height={SWATCH}
                        fill={fill} rx={4}
                      />
                      <text
                        x={TEXT_OFFSET} y={0}
                        dominantBaseline="central"
                        fontSize={FONT_SIZE} fontWeight={500} fill="var(--diagram-text)"
                      >
                        {(g.label || g.id).replace(/_/g, ' ')}
                      </text>
                    </g>
                  );
                })}
              </g>
            );
          })()}

          {/* Edges Layer */}
        <g>
          {engineEdges.map((edge) => (
              <DiagramEdge
                key={edge.id}
                edge={edge}
                pathData={computedPaths[edge.id]}
                isSelected={selectedEdgeId === edge.id}
                theme={theme}
                diagramType={diagramType}
                onEdgeSelect={onEdgeSelect}
                onEdgeDoubleClick={handleEdgeDoubleClick}
              />
          ))}
      </g>

        <g>
            {computedNodes.filter(n => n.type !== 'text').map(node => {
              const matchedGroup = initialData.groups?.find(gx => gx.id === getGroupId(node));
              const injectedNode = { ...node, color: matchedGroup?.color || node.color || 1, outlined: matchedGroup?.outlined };
              return (
                <DiagramNode
                  key={injectedNode.id}
                  node={injectedNode}
                  isActiveLinkSource={activeLinkSource === injectedNode.id}
                  isSelected={selectedNodeId === injectedNode.id}
                  theme={theme}
                  activeTheme={appTheme}
                  resolvedCanvasColor={resolvedCanvasColor}
                  diagramType={diagramType}
                  dragStateId={dragState?.id}
                  onPointerDown={handlePointerDown}
                  onDoubleClick={handleDoubleClick}
                  isHovered={hoveredNodeId === injectedNode.id || connectionState?.sourceId === injectedNode.id}
                  isTargetHovered={hoveredNodeId === injectedNode.id && connectionState && connectionState.sourceId !== injectedNode.id}
                  onHoverChange={handleHoverChange}
                  onStartConnection={handleStartConnection}
                />
              );
            })}
        </g>
        
        {/* Text Annotations Top Layer */}
        <g>
            {computedNodes.filter(n => n.type === 'text').map(node => {
              const matchedGroup = initialData.groups?.find(gx => gx.id === getGroupId(node));
              const injectedNode = { ...node, color: matchedGroup?.color || node.color || 1, outlined: matchedGroup?.outlined };
              return (
                <DiagramNode
                  key={injectedNode.id}
                  node={injectedNode}
                  isActiveLinkSource={activeLinkSource === injectedNode.id}
                  isSelected={selectedNodeId === injectedNode.id}
                  theme={theme}
                  activeTheme={appTheme}
                  resolvedCanvasColor={resolvedCanvasColor}
                  diagramType={diagramType}
                  dragStateId={dragState?.id}
                  onPointerDown={handlePointerDown}
                  onDoubleClick={handleDoubleClick}
                  isHovered={hoveredNodeId === injectedNode.id || connectionState?.sourceId === injectedNode.id}
                  isTargetHovered={hoveredNodeId === injectedNode.id && connectionState && connectionState.sourceId !== injectedNode.id}
                  onHoverChange={handleHoverChange}
                  onStartConnection={handleStartConnection}
                />
              );
            })}
        </g>

        {connectionState && (
           <line 
             x1={connectionState.startX} y1={connectionState.startY}
             x2={connectionState.x} y2={connectionState.y}
             stroke="#007BFF" strokeWidth="3" strokeDasharray="4 4"
             pointerEvents="none"
           />
        )}



      </g>
      

    </svg>

      {/* Inline text editing overlay */}
      {editingNodeId && (() => {
        const node = computedNodes.find(n => n.id === editingNodeId);
        if (!node) return null;
        const dim = getNodeDim(node);
        const svg = svgRef.current;
        if (!svg) return null;
        const pt = svg.createSVGPoint();
        pt.x = (node.x || 0) - dim.width / 2;
        pt.y = (node.y || 0) - dim.height / 2;
        const viewport = viewportRef.current;
        if (!viewport) return null;
        const ctm = viewport.getScreenCTM();
        if (!ctm) return null;
        const svgRect = svg.getBoundingClientRect();
        const topLeft = pt.matrixTransform(ctm);
        pt.x += dim.width;
        pt.y += dim.height;
        const botRight = pt.matrixTransform(ctm);
        const left = topLeft.x - svgRect.left;
        const top = topLeft.y - svgRect.top;
        const w = botRight.x - topLeft.x;
        const h = botRight.y - topLeft.y;
        return (
          <textarea
            autoFocus
            defaultValue={node.label || ''}
            style={{
              position: 'absolute',
              left: `${left}px`,
              top: `${top}px`,
              width: `${w}px`,
              height: `${h}px`,
              border: '2px solid #3b82f6',
              borderRadius: '4px',
              background: 'rgba(255,255,255,0.95)',
              color: '#1a1a1a',
              fontSize: `${dim.fontSize * zoom}px`,
              fontFamily: "'Inter', sans-serif",
              textAlign: 'center',
              padding: '4px',
              resize: 'none',
              outline: 'none',
              zIndex: 9999,
              boxSizing: 'border-box',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center'
            }}
            onFocus={(e) => e.target.select()}
            onBlur={(e) => handleEditComplete(editingNodeId, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleEditComplete(editingNodeId, e.target.value);
              } else if (e.key === 'Escape') {
                e.preventDefault();
                handleEditComplete(editingNodeId, null);
              }
              e.stopPropagation();
            }}
          />
        );
      })()}

      {/* Inline text editing overlay for edges */}
      {editingEdgeId && (() => {
        const edge = edges.find(e => e.id === editingEdgeId);
        if (!edge) return null;
        const svg = svgRef.current;
        if (!svg) return null;
        const pathEl = svg.querySelector(`#${edge.id}_path`);
        if (!pathEl) return null;
        let pt;
        try {
           pt = pathEl.getPointAtLength(pathEl.getTotalLength() / 2);
        } catch(e) {
           return null;
        }
        const viewport = viewportRef.current;
        if (!viewport) return null;
        const ctm = viewport.getScreenCTM();
        if (!ctm) return null;
        const svgRect = svg.getBoundingClientRect();
        pt = pt.matrixTransform(ctm);
        const left = pt.x - svgRect.left;
        const top = pt.y - svgRect.top;
        const w = 150;
        const h = 40;
        return (
          <textarea
            autoFocus
            defaultValue={edge.label || ''}
            style={{
              position: 'absolute',
              left: `${left - w/2}px`,
              top: `${top - h/2}px`,
              width: `${w}px`,
              height: `${h}px`,
              border: '2px solid #3b82f6',
              borderRadius: '4px',
              background: 'rgba(255,255,255,0.95)',
              color: '#1a1a1a',
              fontSize: `${16 * zoom}px`,
              fontFamily: "'Inter', sans-serif",
              textAlign: 'center',
              padding: '4px',
              resize: 'none',
              outline: 'none',
              zIndex: 9999,
              boxSizing: 'border-box',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center'
            }}
            onFocus={(e) => e.target.select()}
            onBlur={(e) => handleEdgeEditComplete(editingEdgeId, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleEdgeEditComplete(editingEdgeId, e.target.value);
              } else if (e.key === 'Escape') {
                e.preventDefault();
                handleEdgeEditComplete(editingEdgeId, null);
              }
              e.stopPropagation();
            }}
          />
        );
      })()}

      {/* Inline text editing overlay for groups */}
      {editingGroupId && (() => {
        const group = initialData?.groups?.find(g => g.id === editingGroupId);
        if (!group) return null;
        const svg = svgRef.current;
        if (!svg) return null;
        
        // Reconstruct the bounding box mathematically instead of querying DOM
        const groupNodes = computedNodes.filter(n => n.type !== 'text' && n.type !== 'title' && getGroupId(n) === editingGroupId);
        if (groupNodes.length === 0) return null;
        
        const dims = groupNodes.map(n => { const d = getNodeDim(n); return { x: n.x||0, y: n.y||0, w: d.width, h: d.height }; });
        const pad = 30;
        const leftBox = Math.min(...dims.map(d => d.x - d.w/2)) - pad;
        const rightBox = Math.max(...dims.map(d => d.x + d.w/2)) + pad;
        const topBox = Math.min(...dims.map(d => d.y - d.h/2)) - pad;
        const bottomBox = Math.max(...dims.map(d => d.y + d.h/2)) + pad;
        
        let pt = svg.createSVGPoint();
        if (diagramType === 'sequence') {
            const allRealNodes = computedNodes.filter(n => n.type !== 'text' && n.type !== 'title');
            const allDims = allRealNodes.map(n => { const d = getNodeDim(n); return { x: n.x||0, w: d.width }; });
            const globalLeft = Math.min(...allDims.map(d => d.x - d.w/2)) - 80;
            pt.x = globalLeft + 30; // Centered on the title rotated vertically
            pt.y = (topBox + bottomBox) / 2;
        } else {
            pt.x = (leftBox + rightBox) / 2;
            pt.y = topBox - 4; // Equivalent to top + 6 - 10
        }
        
        const viewport = viewportRef.current;
        if (!viewport) return null;
        const ctm = viewport.getScreenCTM();
        if (!ctm) return null;
        const svgRect = svg.getBoundingClientRect();
        pt = pt.matrixTransform(ctm);
        const left = pt.x - svgRect.left;
        const top = pt.y - svgRect.top;
        const w = 200;
        const h = 40;
        return (
          <textarea
            autoFocus
            defaultValue={group.label || group.id}
            style={{
              position: 'absolute',
              left: `${left - w/2}px`,
              top: `${top - h/2}px`,
              width: `${w}px`,
              height: `${h}px`,
              border: '2px solid #3b82f6',
              borderRadius: '4px',
              background: 'rgba(255,255,255,0.95)',
              color: '#1a1a1a',
              fontSize: `${20 * zoom}px`,
              fontFamily: "'Inter', sans-serif",
              textAlign: 'center',
              fontWeight: '700',
              padding: '4px',
              resize: 'none',
              outline: 'none',
              zIndex: 9999,
              boxSizing: 'border-box',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center'
            }}
            onFocus={(e) => e.target.select()}
            onBlur={(e) => handleGroupEditComplete(editingGroupId, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleGroupEditComplete(editingGroupId, e.target.value);
              } else if (e.key === 'Escape') {
                e.preventDefault();
                handleGroupEditComplete(editingGroupId, null);
              }
              e.stopPropagation();
            }}
          />
        );
      })()}
      </div>


    </>
  );
}
