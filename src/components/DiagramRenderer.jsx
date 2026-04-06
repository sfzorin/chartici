import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { SIZES, getNodeDim } from '../utils/constants';
import { calculateAllPaths } from '../utils/engine/index.js';
import { getTrueBox, checkCollision } from '../utils/engine/geometry';
import { getGroupId } from '../utils/groupUtils';
import DiagramNode from './shapes/DiagramNode';
import DiagramEdge from './shapes/DiagramEdge';

import { computeBindings, getAxisDir } from '../utils/layout';

export default function DiagramRenderer({ 
  initialData, 
  theme,
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
  onConnect,
  onAddNode,
  panToNodeId
}) {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  
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
             size: config.titleSize || 'AUTO',
             x: config.titleX, // Can be undefined, DiagramRenderer will compute fallback
             y: config.titleY
         });
      }

      setNodes(newNodes);
      setEdges(initialData.edges || []);

      const regularNodes = newNodes.filter(n => n.id !== '__SYSTEM_TITLE__');
      if (regularNodes.length === 0) {
        // Use requestAnimationFrame to ensure DOM is painted and rect has dimensions
        const centerCanvas = () => {
          if (!svgRef.current) return;
          const rect = svgRef.current.getBoundingClientRect();
          if (rect.width === 0) {
             requestAnimationFrame(centerCanvas);
             return;
          }
          setZoom(1);
          setPan({ 
             x: (rect.width / 2) - 800, 
             y: (rect.height / 2) - 450 
          });
        };
        requestAnimationFrame(centerCanvas);
      }
    }
  }, [initialData, diagramTitle]);

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

  const prevLayoutTrigger = useRef(null);
  useEffect(() => {
    const trigger = initialData?.layoutTrigger;
    if (trigger && trigger !== prevLayoutTrigger.current) {
      prevLayoutTrigger.current = trigger;
      const newNodes = initialData.nodes || [];
      
      // Auto-centering
      if (newNodes.length > 0 && svgRef.current) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        newNodes.forEach(n => {
          const dim = getNodeDim(n);
          if (n.x - dim.width / 2 < minX) minX = n.x - dim.width / 2;
          if (n.y - dim.height / 2 < minY) minY = n.y - dim.height / 2;
          if ((n.x + dim.width / 2) > maxX) maxX = n.x + dim.width / 2;
          if ((n.y + dim.height / 2) > maxY) maxY = n.y + dim.height / 2;
        });
        
        if (diagramTitle) {
          minY -= 80; // Offset for diagram title
        }
        
        const boundsW = maxX - minX;
        const boundsH = maxY - minY;
        
        setTimeout(() => {
          if (!svgRef.current) return;
          const rect = svgRef.current.getBoundingClientRect();
          const pad = 100;
          
          if (rect.width > 0 && boundsW > 0) {
            const scaleX = (rect.width - pad*2) / boundsW;
            const scaleY = (rect.height - pad*2) / boundsH;
            let bestZoom = Math.min(scaleX, scaleY, 1);
            if (!isFinite(bestZoom) || bestZoom <= 0) bestZoom = 1;

            const cx = minX + boundsW / 2;
            const cy = minY + boundsH / 2;
            
            setZoom(bestZoom);
            setPan({
              x: (rect.width / 2) - (cx * bestZoom),
              y: (rect.height / 2) - (cy * bestZoom)
            });
          }
        }, 10);
      }
    }
  }, [initialData?.layoutTrigger, initialData?.nodes, svgRef, diagramTitle]);

  const computedNodes = useMemo(() => computeBindings(nodes), [nodes]);
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

      const movingXIds = getAxisGroup(dragState.id, dragState.initialNodes, 'vertical');
      const movingYIds = getAxisGroup(dragState.id, dragState.initialNodes, 'horizontal');
      
      setNodes(dragState.initialNodes.map(n => {
        // Enforce strong 20px grid lock on final coordinates!
        let base_nx = Math.round((n.x || 0) / 20) * 20;
        let base_ny = Math.round((n.y || 0) / 20) * 20;
        let nx = base_nx;
        let ny = base_ny;

        if (movingXIds.includes(n.id)) nx += dxSnap;
        if (movingYIds.includes(n.id)) ny += dySnap;
        
        if (n.id === dragState.id && n.type === 'text' && n.bindTo) {
           return { ...n, offsetX: (n.offsetX || 0) + dxSnap, offsetY: (n.offsetY || 0) + dySnap };
        }
        
        return { ...n, x: nx, y: ny };
      }));
    } catch { /* ignore */ }
  };

  const handlePointerUp = (e) => {
    if (isPanning) {
      setIsPanning(false);
    }
    if (dragState) {
      let isInvalid = false;
      
      // Compute which nodes were actually moved
      const movedIds = new Set(nodes.filter((n, i) => n.x !== dragState.initialNodes[i].x || n.y !== dragState.initialNodes[i].y).map(n => n.id));
      
      if (movedIds.size > 0) {
          for (let mNode of nodes) {
              if (!movedIds.has(mNode.id)) continue;
              if (mNode.type === 'text' || mNode.type === 'title') continue; // Text annotations NEVER collide
              // Check this moved node against ALL non-moved nodes
              const stationaryNodes = nodes.filter(n => !movedIds.has(n.id) && n.type !== 'text' && n.type !== 'title');
              if (checkCollision(mNode, stationaryNodes)) {
                  isInvalid = true;
                  break;
              }
          }
      }

      setDragState(null);
      
      if (isInvalid) {
          // Snap back
          setNodes(dragState.initialNodes);
          if (onNodesChange) onNodesChange(dragState.initialNodes);
      } else {
          // Commit
          if (onNodesChange) onNodesChange(nodes);
      }
      
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

  const computedPaths = useMemo(() => {
    const newPaths = calculateAllPaths(edges, computedNodes, { diagramType }, dragState?.id, prevPathsRef.current);
    if (!dragState?.id) {
       prevPathsRef.current = newPaths;
    }
    return newPaths;
  }, [edges, computedNodes, dragState, diagramType]);


  const { vMinX, vMinY, vW, vH, titleCx, titleY } = useMemo(() => {
     if (computedNodes.length === 0) return { vMinX: 0, vMinY: 0, vW: 1600, vH: 900, titleCx: 800, titleY: 0 };
     let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
     let txtMinX = Infinity, txtMinY = Infinity, txtMaxX = -Infinity, txtMaxY = -Infinity;
     computedNodes.forEach(n => {
        const dim = getNodeDim(n);
        const l = n.x - dim.width / 2, r = n.x + dim.width / 2;
        const t = n.y - dim.height / 2, b = n.y + dim.height / 2;
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

     // Expand boundaries by Matrix Groups
     if (initialData?.diagramType === 'matrix' && initialData?.groups?.length > 1) {
        const realNodes = computedNodes.filter(n => n.type !== 'text' && n.type !== 'title');
        initialData.groups.forEach(g => {
           const gNodes = realNodes.filter(n => getGroupId(n) === g.id);
           if (gNodes.length === 0) return;
           const pad = 30; // Matches rendering logic padding for matrix boxes
           gNodes.forEach(n => {
              const dim = getNodeDim(n);
              const l = n.x - dim.width / 2 - pad - 8;
              const r = n.x + dim.width / 2 + pad + 8;
              const t = n.y - dim.height / 2 - pad - 8;
              const b = n.y + dim.height / 2 + pad + 8;
              if (l < minX) minX = l; if (r > maxX) maxX = r;
              if (t < minY) minY = t; if (b > maxY) maxY = b;
           });
        });
     }
     if (minX === Infinity) {
        minX = 600; minY = 420; maxX = 1000; maxY = 480;
     }

     const titleCx = (minX + maxX) / 2;
     const titleY = minY;


     if (diagramTitle) {
        minY -= 124;
     }

     if (maxX - minX < 200) { minX -= 100; maxX += 100; }
     if (maxY - minY < 200) { minY -= 100; maxY += 100; }
     
     const graphW = maxX - minX;
     const graphH = maxY - minY;

     // Regular nodes: 10% padding each side
     let pW = graphW / 0.8;
     let pH = graphH / 0.8;

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
        if (sysTitle.x === undefined) sysTitle.x = titleCx;
        if (sysTitle.y === undefined) sysTitle.y = titleY - (diagramTitle ? 100 : 0);
        
        if (sysTitle.size === 'AUTO') {
            const lines = (sysTitle.label || "").split('\n');
            const longestLine = Math.max(...lines.map(line => line.length));
            const targetFontSize = (pW - 120) / Math.max(longestLine * 0.62, 1);
            
            if (targetFontSize < 36) sysTitle.size = 'S';
            else if (targetFontSize < 56) sysTitle.size = 'M';
            else sysTitle.size = 'L';
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

  let fillStr = 'var(--canvas-bg)';
  let gridColorStr = 'var(--grid-line-color)';
  let dEdge = 'var(--edge-color)';
  let dText = 'var(--color-text-main)';
  let dGroup = 'var(--color-neutral-text)'; // Default secondary/neutral color

  let previewFillStr = null;

  if (bgColor === 'white') {
    fillStr = '#FFFFFF';
    gridColorStr = 'rgba(0, 0, 0, 0.05)';
    dEdge = '#475569';
    dText = '#0f172a';
    dGroup = '#94a3b8'; // Slate 400 (lighter than edge on white)
  } else if (bgColor === 'black') {
    fillStr = '#000000';
    gridColorStr = 'rgba(255, 255, 255, 0.03)';
    dEdge = '#cbd5e1';
    dText = '#f8fafc';
    dGroup = '#64748b'; // Slate 500 (darker than edge on black)
  } else if (bgColor === 'transparent-dark') {
    fillStr = 'transparent';
    previewFillStr = 'url(#checkerboard-light)';
    dEdge = '#111827';
    dText = '#111827';
    dGroup = '#64748b';
  } else if (bgColor === 'transparent-light') {
    fillStr = 'transparent';
    previewFillStr = 'url(#checkerboard-dark)';
    dEdge = '#f8fafc';
    dText = '#f8fafc';
    dGroup = '#94a3b8';
  } else if (bgColor === 'theme') {
    fillStr = 'var(--canvas-bg)';
    gridColorStr = 'var(--grid-line-color)';
  }


  return (
    <>
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
             {previewFillStr && (
               <rect className="preview-bg-rect" x={vMinX} y={vMinY} width={vW} height={vH} fill={previewFillStr} rx="8" ry="8" />
             )}
             <rect 
               x={vMinX} y={vMinY} width={vW} height={vH} 
               fill={fillStr} 
               rx="8" ry="8"
               style={{ filter: !previewFillStr ? 'drop-shadow(0 20px 40px rgba(0,0,0,0.15))' : 'none' }}
             />
             {!previewFillStr && (
               <rect className="canvas-grid-rect" x={vMinX} y={vMinY} width={vW} height={vH} fill="url(#canvas-grid)" pointerEvents="none" rx="8" ry="8" />
             )}
          </g>

          {/* ─── Topology Overlays Layer ─────────────────────── */}
          {diagramType === 'sequence' && (
            <g className="sequence-lifelines" opacity={0.3}>
              {computedNodes.filter(n => n.type !== 'text' && n.type !== 'title').map(node => {
                const dim = getNodeDim(node);
                const nx = (node.x || 0);
                const ny = (node.y || 0) + dim.height / 2;
                return (
                  <line
                    key={`lifeline-${node.id}`}
                    x1={nx} y1={ny}
                    x2={nx} y2={ny + 2000}
                    stroke="var(--diagram-edge)"
                    strokeWidth="1.5"
                    strokeDasharray="6, 4"
                  />
                );
              })}
            </g>
          )}



          {diagramType === 'matrix' && initialData.groups && initialData.groups.length > 1 && (() => {
            const realNodes = computedNodes.filter(n => n.type !== 'text' && n.type !== 'title');
            if (realNodes.length === 0) return null;
            // Compute group bounding boxes
            const groupBoxes = {};
            initialData.groups.forEach(g => {
              const gNodes = realNodes.filter(n => getGroupId(n) === g.id);
              if (gNodes.length === 0) return;
              const dims = gNodes.map(n => { const d = getNodeDim(n); return { x: n.x||0, y: n.y||0, w: d.width, h: d.height }; });
              const pad = 30;
              groupBoxes[g.id] = {
                id: String(g.id || ''),
                left: Math.min(...dims.map(d => d.x - d.w/2)) - pad,
                right: Math.max(...dims.map(d => d.x + d.w/2)) + pad,
                top: Math.min(...dims.map(d => d.y - d.h/2)) - pad,
                bottom: Math.max(...dims.map(d => d.y + d.h/2)) + pad,
                label: String(g.label || g.id || ''),
                color: g.color
              };
            });
            const boxes = Object.values(groupBoxes);
            if (boxes.length < 2) return null;
            return (
              <g className="matrix-grid">
                {boxes.map((box, i) => (
                  <g key={`mbox-${i}`}>
                    <path
                      d={`M ${(box.left + box.right) / 2 + Math.min((box.right - box.left - 16) / 2, box.label.length * 5.5 + 16)} ${box.top} L ${box.right - 8} ${box.top} Q ${box.right} ${box.top} ${box.right} ${box.top + 8} L ${box.right} ${box.bottom - 8} Q ${box.right} ${box.bottom} ${box.right - 8} ${box.bottom} L ${box.left + 8} ${box.bottom} Q ${box.left} ${box.bottom} ${box.left} ${box.bottom - 8} L ${box.left} ${box.top + 8} Q ${box.left} ${box.top} ${box.left + 8} ${box.top} L ${(box.left + box.right) / 2 - Math.min((box.right - box.left - 16) / 2, box.label.length * 5.5 + 16)} ${box.top}`}
                      fill="none" stroke="var(--diagram-group)" strokeWidth="2" strokeDasharray="6, 6"
                      opacity="0.6"
                    />
                    {(!box.label.toLowerCase().startsWith('void')) && (
                      <text
                        id={`group_text_${box.id.replace(/[^a-zA-Z0-9_-]/g, '_')}`}
                        x={(box.left + box.right) / 2} y={box.top + 6}
                        fontSize="20" fill="var(--diagram-group)" opacity="0.85"
                        fontWeight="700" textAnchor="middle"
                        style={{ cursor: 'text', pointerEvents: 'all', userSelect: 'none' }}
                        onDoubleClick={(e) => { e.stopPropagation(); setEditingGroupId(box.id); }}
                      >
                        {box.label.replace(/_/g, ' ')}
                      </text>
                    )}
                  </g>
                ))}
              </g>
            );
          })()}

          {/* Edges Layer */}
        <g>
          {edges.map((edge) => (
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
              const injectedNode = { ...node, color: matchedGroup?.color || 1, outlined: matchedGroup?.outlined };
              return (
                <DiagramNode
                  key={injectedNode.id}
                  node={injectedNode}
                  isActiveLinkSource={activeLinkSource === injectedNode.id}
                  isSelected={selectedNodeId === injectedNode.id}
                  theme={theme}
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
              const injectedNode = { ...node, color: matchedGroup?.color || 1, outlined: matchedGroup?.outlined };
              return (
                <DiagramNode
                  key={injectedNode.id}
                  node={injectedNode}
                  isActiveLinkSource={activeLinkSource === injectedNode.id}
                  isSelected={selectedNodeId === injectedNode.id}
                  theme={theme}
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
        
        let pt = svg.createSVGPoint();
        pt.x = (leftBox + rightBox) / 2;
        pt.y = topBox - 4; // Equivalent to top + 6 - 10
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

      {/* Unified Canvas Toolbar */}
      <div className="canvas-unified-toolbar">
         {/* Add Node Group */}
         <div className="toolbar-group">
            <button className="canvas-panel-btn" style={{ width: '40px', height: '40px', padding: 0, background: 'transparent', border: 'none', borderRadius: 'var(--radius-sm)' }} onClick={() => onAddNode('process')} data-tooltip="Rectangle">
               <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="6" width="18" height="12" rx="0"/></svg>
            </button>
            <button className="canvas-panel-btn" style={{ width: '40px', height: '40px', padding: 0, background: 'transparent', border: 'none', borderRadius: 'var(--radius-sm)' }} onClick={() => onAddNode('oval')} data-tooltip="Oval">
               <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="6" width="22" height="12" rx="6"/></svg>
            </button>
            <button className="canvas-panel-btn" style={{ width: '40px', height: '40px', padding: 0, background: 'transparent', border: 'none', borderRadius: 'var(--radius-sm)' }} onClick={() => onAddNode('circle')} data-tooltip="Circle">
               <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="8"/></svg>
            </button>
            <button className="canvas-panel-btn" style={{ width: '40px', height: '40px', padding: 0, background: 'transparent', border: 'none', borderRadius: 'var(--radius-sm)' }} onClick={() => onAddNode('rhombus')} data-tooltip="Rhombus">
               <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 3 21 12 12 21 3 12"/></svg>
            </button>
            <button className="canvas-panel-btn" style={{ width: '40px', height: '40px', padding: 0, background: 'transparent', border: 'none', borderRadius: 'var(--radius-sm)' }} onClick={() => onAddNode('text')} data-tooltip="Text Only">
               <span style={{ fontWeight: '500', fontSize: '16px', fontFamily: 'Inter, -apple-system, sans-serif', letterSpacing: '-0.5px' }}>Тт</span>
            </button>
         </div>

         <div className="toolbar-separator" />

         {/* Tools Group */}
         <div className="toolbar-group">
            <button
                className={`canvas-panel-btn ${activeLinkSource ? 'tool-btn-active' : ''}`}
                onPointerDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    if (activeLinkSource) setActiveLinkSource(null);
                    else if (selectedNodeId) setActiveLinkSource(selectedNodeId);
                }}
                style={{ 
                    width: '40px', height: '40px', padding: 0, 
                    background: 'transparent', 
                    border: 'none', borderRadius: 'var(--radius-sm)', 
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    opacity: (!selectedNodeId && !activeLinkSource) ? 0.3 : 1,
                    pointerEvents: (!selectedNodeId && !activeLinkSource) ? 'none' : 'all'
                }}
                data-tooltip={activeLinkSource ? "Cancel Connection" : "Connect (Select a node first)"}
            >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
            </button>

            <button 
                className="canvas-panel-btn"
                onClick={onAutoLayout}
                style={{ width: '40px', height: '40px', padding: 0, background: 'transparent', border: 'none', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                data-tooltip="Auto Layout"
            >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
            </button>
         </div>
         
         <div className="toolbar-separator" />
         
         {/* Zoom Group */}
         <div className="toolbar-group">
            <button className="canvas-panel-btn" style={{ width: '32px', height: '32px', padding: 0, background: 'transparent', border: 'none', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => handleZoomCenter(Math.max(0.1, Math.round((zoom - 0.1)*10)/10))} data-tooltip="Zoom Out">
               <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            </button>
            <button className="canvas-panel-btn" onClick={() => {
                if (!svgRef.current) return;
                const rect = svgRef.current.getBoundingClientRect();
                if (rect.width === 0 || rect.height === 0) return;
                const paddingMultiplier = 0.95;
                const newZoom = Math.min((rect.width * paddingMultiplier) / vW, (rect.height * paddingMultiplier) / vH, 4);
                const boxCx = vMinX + vW / 2;
                const boxCy = vMinY + vH / 2;
                setZoom(newZoom);
                setPan({ x: rect.width / 2 - boxCx * newZoom, y: rect.height / 2 - boxCy * newZoom });
            }} style={{ width: '36px', height: '32px', fontWeight: 600, fontSize: '13px', padding: 0, background: 'transparent', border: 'none', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-neutral-text)' }} data-tooltip="Fit to Screen">
               FIT
            </button>
            <button className="canvas-panel-btn" style={{ width: '32px', height: '32px', padding: 0, background: 'transparent', border: 'none', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => handleZoomCenter(Math.min(4, Math.round((zoom + 0.1)*10)/10))} data-tooltip="Zoom In">
               <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            </button>
         </div>
      </div>
    </>
  );
}
