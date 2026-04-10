import { useState, useRef, useEffect, useCallback } from 'react';
import { useDiagramHistory } from './hooks/useDiagramHistory';
import DiagramRenderer from './components/DiagramRenderer';
import AppHeader from './components/AppHeader';
import HelpModal from './components/HelpModal';
import LoadModal from './components/LoadModal';
import DialogModal from './components/DialogModal';
import LeftToolbox from './components/LeftToolbox';
import WelcomeScreenModal from './components/WelcomeScreenModal';

import { downloadCharticiFile, parseCharticiFile } from './utils/charticiFormat';
import { downloadSVG } from './utils/exportSVG';

import { SIZES, PALETTES, getNodeDim } from './utils/constants';
import { DIAGRAM_SCHEMAS, DIAGRAM_TYPES } from './utils/diagramSchemas';
import { smartAlign } from './utils/layout';
import { layoutNodesHeuristically } from './utils/nodeLayouter';
import { getTrueBox, checkCollision } from './utils/engine/geometry';
import { getGroupId } from './utils/groupUtils';
import { sanitizeColors } from './utils/sanitizeColors';
import LogoUrl from './assets/chartici-logo.svg';

function App() {
  const [appTheme, setAppTheme] = useState(() => localStorage.getItem('appTheme') || 'dark');
  const [paletteTheme, setPaletteTheme] = useState('muted-rainbow');
  const { state: diagramData, setState: setDiagramData, undo, redo, canUndo, canRedo } = useDiagramHistory({ nodes: [], edges: [], groups: [] });
  const [aspect, setAspect] = useState('16:9');
  const [diagramType, setDiagramType] = useState('flowchart');
  const [bgColor, setBgColor] = useState('transparent-dark');
  const [diagramTitle, setDiagramTitle] = useState('Untitled Project');
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [panToNodeId, setPanToNodeId] = useState(null);
  const [helpTab, setHelpTab] = useState('about');
  const [dialogConfig, setDialogConfig] = useState(null);
  
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState(null);
  const [fitTrigger, setFitTrigger] = useState(0);
  const svgRef = useRef(null);
  const welcomeRef = useRef(null);
  const sessionStartTime = useRef(Date.now());
  const lastGenerationTimeMs = useRef(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const activeSchema = DIAGRAM_SCHEMAS[diagramType] || DIAGRAM_SCHEMAS.flowchart;

  const filteredData = React.useMemo(() => {
    let outNodes = diagramData.nodes || [];
    let outEdges = diagramData.edges || [];
    
    if (activeSchema) {
        // Hide nodes that are not supported by the current schema (except title/text attachments if applicable)
        outNodes = outNodes.filter(n => activeSchema.allowedNodes.includes(n.type) || n.type === 'title' || n.type === 'text');
        
        // Hide edges if the diagram does not support connections, or if they connect to unsupported hidden nodes
        if (!activeSchema.features.allowConnections) {
            outEdges = [];
        } else {
            const allowedIds = new Set(outNodes.map(n => n.id));
            outEdges = outEdges.filter(e => allowedIds.has(e.from) && allowedIds.has(e.to));
        }

        // Enforce maximum node limits (e.g. piechart)
        if (activeSchema.features.enforceMaxNodes !== undefined) {
            const max = activeSchema.features.enforceMaxNodes;
            let count = 0;
            outNodes = outNodes.filter(n => {
                if (n.type === 'title' || n.type === 'text') return true;
                if (count < max) { count++; return true; }
                return false;
            });
        }
    }
    
    return { ...diagramData, nodes: outNodes, edges: outEdges };
  }, [diagramData, activeSchema]);

  useEffect(() => {
    document.documentElement.setAttribute('data-app-theme', appTheme);
    localStorage.setItem('appTheme', appTheme);
  }, [appTheme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', paletteTheme);
    const themeObj = PALETTES[paletteTheme] || PALETTES['muted-rainbow'];
    
    document.documentElement.style.setProperty('--unfilled-text-color', themeObj.unfilledText);
    
    themeObj.colors.forEach((c, idx) => {
      document.documentElement.style.setProperty(`--color-${idx}`, c.bg);
      document.documentElement.style.setProperty(`--text-color-${idx}`, c.text);
      if (c.border) {
         document.documentElement.style.setProperty(`--border-color-${idx}`, c.border);
      } else {
         document.documentElement.style.setProperty(`--border-color-${idx}`, 'transparent');
      }
    });
  }, [paletteTheme]);

  const groupSignature = diagramData.nodes.map(n => n.groupId).join(',');
  useEffect(() => {
    setDiagramData(prev => {
      const gIds = new Set(prev.nodes.map(n => n.groupId).filter(Boolean));
      if (!prev.groups) return prev;
      
      const nextGroups = prev.groups.filter(g => gIds.has(g.id));
      if (nextGroups.length !== prev.groups.length) {
         return { ...prev, groups: nextGroups };
      }
      return prev;
    });
  }, [groupSignature]);





  const handleSmartAlign = () => {
    const alignedNodes = smartAlign(diagramData.nodes);
    setDiagramData(prev => ({ 
      ...prev, 
      nodes: alignedNodes
    }));
  };

  const handleDownloadChartici = async () => {
    // Only save the actively filtered data, effectively stripping out hidden nodes/edges from the .cci payload
    const savedName = await downloadCharticiFile(diagramTitle, filteredData, { 
      aspect, bgColor, theme: paletteTheme, diagramType, title: diagramTitle 
    });
    if (savedName) {
      setDiagramTitle(savedName);
    }
  };

  
  const loadParsedData = (parsed, fallbackName = 'Imported Project') => {
    const dt = parsed.meta?.type || parsed.config?.diagramType || 'flowchart';
    const layedOutNodes = layoutNodesHeuristically(parsed.nodes, parsed.edges, { diagramType: dt, groups: parsed.groups });
    const activeTheme = (parsed.config && parsed.config.theme && PALETTES[parsed.config.theme]) 
      ? parsed.config.theme : 'muted-rainbow';
      
    let totalElements = 0;
    if (parsed.groups && parsed.groups.length > 0) {
      totalElements = parsed.groups.length;
    } else {
      totalElements = layedOutNodes.length;
    }
    
    const safeIndices = PALETTES[activeTheme].rules[totalElements] || [1, 2, 3, 4, 5, 6, 7, 8, 9];
    
    const sharedColorMap = {};
    setDiagramData({
      groups: parsed.groups || [],
      nodes: sanitizeColors(layedOutNodes, true, parsed.groups || [], safeIndices, sharedColorMap),
      edges: sanitizeColors(parsed.edges, false, parsed.groups || [], safeIndices, sharedColorMap),
      config: parsed.config || {},
      layoutTrigger: Date.now()
    });
    
    if (parsed.config && Object.keys(parsed.config).length > 0) {
      if (parsed.config.aspect) setAspect(parsed.config.aspect);
      if (parsed.config.diagramType) setDiagramType(parsed.config.diagramType);
      
      let incomingBg = parsed.config.bgColor || (appTheme === 'dark' ? 'black' : 'white');
      if (incomingBg === 'transparent' || incomingBg === 'transparent-dark' || incomingBg === 'solid-dark') incomingBg = 'black';
      if (incomingBg === 'transparent-light' || incomingBg === 'solid-light') incomingBg = 'white';
      setBgColor(incomingBg);
    } else {
      setAspect('16:9');
      setDiagramType('flowchart');
      setBgColor(appTheme === 'dark' ? 'black' : 'white');
    }

    const resolvedTitle = parsed.config?.title || parsed.header || '';
    setDiagramTitle(resolvedTitle !== 'Untitled Project' ? resolvedTitle : '');
    setPaletteTheme(activeTheme);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setFitTrigger(Date.now());
    sessionStartTime.current = Date.now();
  };

  const handleCharticiUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const fileNameWithoutExtension = file.name.replace(/\.[^/.]+$/, "");

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = parseCharticiFile(e.target.result);
        loadParsedData(parsed, fileNameWithoutExtension);
      } catch (err) {
        setDialogConfig({
          type: 'alert',
          title: 'Error loading file',
          message: err.message,
          onConfirm: () => setDialogConfig(null),
          onCancel: () => setDialogConfig(null)
        });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleHeuristicLayout = () => {
    setDiagramData(prev => {
      const startT = performance.now();
      const nextConfig = { ...prev.config };
      const newNodes = layoutNodesHeuristically(prev.nodes, prev.edges, { diagramType, groups: prev.groups });
      
      if (!nextConfig.titleLock) {
         nextConfig.titleX = undefined;
         nextConfig.titleY = undefined;
      } else if (nextConfig.titleX !== undefined && nextConfig.titleY !== undefined && prev.nodes.length > 0 && newNodes.length > 0) {
         const getCenterPoint = (arr) => {
             let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
             arr.forEach(n => {
                 if (n.type === 'text' || n.type === 'title') return;
                 if (n.x < minX) minX = n.x;
                 if (n.y < minY) minY = n.y;
                 if (n.x > maxX) maxX = n.x;
                 if (n.y > maxY) maxY = n.y;
             });
             return { cx: (minX + maxX)/2, cy: (minY + maxY)/2 };
         };
         const oldC = getCenterPoint(prev.nodes);
         const newC = getCenterPoint(newNodes);
         if (isFinite(oldC.cx) && isFinite(newC.cx)) {
             nextConfig.titleX += (newC.cx - oldC.cx);
             nextConfig.titleY += (newC.cy - oldC.cy);
         }
      }

      const endT = performance.now();
      lastGenerationTimeMs.current = Math.round(endT - startT);

      return {
        ...prev,
        nodes: newNodes,
        layoutTrigger: Date.now(),
        config: nextConfig
      };
    });
  };

  const updateGroupFromSelection = (key, value) => {
    if (!selectedNodeId) return;
    setDiagramData(prev => {
       const node = prev.nodes.find(n => n.id === selectedNodeId);
       if (!node) return prev;
       let gId = getGroupId(node);
       let nextNodes = prev.nodes;
       let nextGroups = prev.groups || [];
       
       if (!gId) {
          gId = `g_${node.id}`;
          nextNodes = nextNodes.map(n => n.id === selectedNodeId ? { ...n, groupId: gId } : n);
       }
       
       const groupIndex = nextGroups.findIndex(g => g.id === gId);
       if (groupIndex >= 0) {
          nextGroups = nextGroups.map(g => g.id === gId ? { ...g, [key]: value } : g);
       } else {
          nextGroups = [...nextGroups, { id: gId, [key]: value }];
       }
       
       return { ...prev, nodes: nextNodes, groups: nextGroups };
    });
  };

  const handleDownloadSVG = () => {
    if (!svgRef.current) return;
    const oldSelection = selectedNodeId;
    const oldEdgeSelection = selectedEdgeId;
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setTimeout(() => {
      downloadSVG(svgRef.current, paletteTheme, diagramTitle, lastGenerationTimeMs.current);
      setSelectedNodeId(oldSelection);
      setSelectedEdgeId(oldEdgeSelection);
    }, 0);
  };

  const generateSimpleId = (items) => {
    let max = 0;
    items.forEach(item => {
      const num = parseInt(item.id, 10);
      if (!isNaN(num) && num > max) max = num;
    });
    return String(max + 1);
  };

  const addNewNode = (type) => {
    let cx = 800, cy = 450;
    if (diagramData.nodes.length > 0) {
      const lastNode = diagramData.nodes[diagramData.nodes.length - 1];
      cx = lastNode.x || 800;
      cy = lastNode.y || 450;
    }

    let inheritedSize = 'M';
    let inheritedColor = 1;
    if (activeSchema?.features?.autoIncrementColors && diagramData.nodes.length > 0) {
        let lastColor = diagramData.nodes[diagramData.nodes.length - 1].color;
        if (typeof lastColor !== 'number') lastColor = 0;
        inheritedColor = (lastColor % 9) + 1;
    }
    
    // Find highest 'New Group N' to increment, or just create a unique one
    let maxNewGroupNum = 0;
    if (diagramData.groups) {
      diagramData.groups.forEach(g => {
        const match = g.id.match(/^New Group (\d+)$/i);
        if (match) {
           const num = parseInt(match[1], 10);
           if (num > maxNewGroupNum) maxNewGroupNum = num;
        }
      });
    }
    const newGroupId = `New Group ${maxNewGroupNum + 1}`;

    const newNode = {
      id: generateSimpleId(diagramData.nodes),
      groupId: newGroupId,
      type: type,
      label: type === 'text' ? 'Text' : 'New Node',
      size: inheritedSize,
      color: inheritedColor,
      x: Math.round(cx / 20) * 20,
      y: Math.round(cy / 20) * 20
    };
    
    if (diagramData.nodes.length > 0) {
      const [wRatio, hRatio] = aspect.split(':').map(Number);
      const targetAspect = (wRatio / hRatio) || 1.77;
      
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      
      diagramData.nodes.forEach(n => {
        const nx = n.x || 0;
        const ny = n.y || 0;
        const dim = getNodeDim(n);
        if (nx - dim.width / 2 < minX) minX = nx - dim.width / 2;
        if (ny - dim.height / 2 < minY) minY = ny - dim.height / 2;
        if (nx + dim.width / 2 > maxX) maxX = nx + dim.width / 2;
        if (ny + dim.height / 2 > maxY) maxY = ny + dim.height / 2;
      });

      if (minX === Infinity) { minX = 0; minY = 0; maxX = 160; maxY = 80; }
      
      const currentWidth = maxX - minX;
      const currentHeight = Math.max(1, maxY - minY);
      const currentAspect = currentWidth / currentHeight;

      // Auto-collision resolver: shift until free
      let attempts = 0;
      while (checkCollision(newNode, diagramData.nodes) && attempts < 100) {
          if (currentAspect < targetAspect) {
              newNode.x += 40;
          } else {
              newNode.y += 40;
          }
          attempts++;
      }
    }
    
    setDiagramData(prev => {
        const nextGroups = [...(prev.groups || [])];
        if (!nextGroups.find(g => g.id === newNode.groupId)) {
            nextGroups.push({ 
                id: newNode.groupId, 
                label: newNode.groupId, 
                color: newNode.color,
                type: newNode.type,
                size: newNode.size
            });
        }
        
        let nextNodes = [...prev.nodes, newNode];
        if (activeSchema?.features?.recalculateOnEdit) {
            nextNodes = layoutNodesHeuristically(nextNodes, prev.edges, { diagramType, groups: prev.groups });
        }

        return { 
            ...prev, 
            groups: nextGroups,
            nodes: nextNodes 
        };
    });
    setSelectedNodeId(newNode.id);
    setPanToNodeId(newNode.id);
    setSelectedEdgeId(null);
  };
  
  const connectToNode = (targetId) => {
    if (!selectedNodeId || !targetId || selectedNodeId === targetId) return;
    handleConnectionDrag(selectedNodeId, targetId);
  };

  const handleConnectionDrag = (sourceId, targetId) => {
    if (!sourceId || !targetId || sourceId === targetId) return;
    
    const duplicateExists = diagramData.edges.some(e => 
      (e.from === sourceId && e.to === targetId) || 
      (e.from === targetId && e.to === sourceId)
    );
    if (duplicateExists) return;

    // --- TEXT NODE BINDING INTERCEPT ---
    const sourceNode = diagramData.nodes.find(n => n.id === sourceId);
    const targetNode = diagramData.nodes.find(n => n.id === targetId);
    if (!sourceNode || !targetNode) return;

    if (sourceNode.type === 'text' || targetNode.type === 'text') {
        const textNodeId = sourceNode.type === 'text' ? sourceId : targetId;
        const parentNodeId = sourceNode.type === 'text' ? targetId : sourceId;

        setDiagramData(prev => {
            // Remove any old edges connected to this text node (ensure 1-to-1 cardinality)
            const filteredEdges = prev.edges.filter(e => e.from !== textNodeId && e.to !== textNodeId);
            const newEdgeId = generateSimpleId(filteredEdges);
            const newEdge = { 
                id: newEdgeId, 
                from: textNodeId, 
                to: parentNodeId, 
                label: '', 
                lineStyle: 'none',
                connectionType: 'target'
            };
            return { ...prev, edges: [...filteredEdges, newEdge], layoutTrigger: Date.now() };
        });
        return; // Edge created, stop propagation
    }
    // -----------------------------------
    
    // Attempt to inherit style from the very last edge in the graph
    let inheritedStyles = {};
    if (diagramData.edges.length > 0) {
       let template = diagramData.edges.find(e => e.id === selectedEdgeId);
       if (!template) template = diagramData.edges[diagramData.edges.length - 1];
       
       if (template.type) inheritedStyles.type = template.type;
       if (template.color) inheritedStyles.color = template.color;
       if (template.strokeType) inheritedStyles.strokeType = template.strokeType;
       if (template.thickness) inheritedStyles.thickness = template.thickness;
       if (template.animated !== undefined) inheritedStyles.animated = template.animated;
    }
    
    const newEdgeId = generateSimpleId(diagramData.edges);
    const newEdge = { id: newEdgeId, from: sourceId, to: targetId, label: '', ...inheritedStyles };
    
    setDiagramData(prev => ({
      ...prev,
      edges: [...prev.edges, newEdge],
      layoutTrigger: Date.now() // Trigger auto-layout update for A* router
    }));
  };

  const updateSelectedNode = (field, value) => {
    if (!selectedNodeId) return;
    
    // Intercept updates for the special system title node
    if (selectedNodeId === '__SYSTEM_TITLE__') {
      if (field === 'lockPos') {
          if (value === false) {
              // Unlocking should not clear current position coordinates.
              // Auto-centering is now strictly bound to the 'Auto Layout' button.
              setDiagramData(prev => ({...prev, config: { ...prev.config, titleLock: false }}));
          } else {
              // Locking
              setDiagramData(prev => {
                  let curX = prev.config?.titleX;
                  let curY = prev.config?.titleY;
                  
                  // Use visual DOM position only if it was never dragged
                  if (curX === undefined || curY === undefined) {
                      const domNode = document.querySelector('[data-node-id="__SYSTEM_TITLE__"]');
                      if (domNode) {
                          const logicalX = domNode.getAttribute('data-logical-x');
                          const logicalY = domNode.getAttribute('data-logical-y');
                          if (logicalX && logicalY) {
                             curX = parseFloat(logicalX);
                             curY = parseFloat(logicalY);
                          }
                      }
                  }
                  return {...prev, config: { ...prev.config, titleLock: true, titleX: curX, titleY: curY }};
              });
          }
          return;
      }
      if (field === 'label') {
          setDiagramTitle(value);
          if (value === '') {
              setSelectedNodeId(null); // Deselect if it vanishes
          }
      } else {
          setDiagramData(prev => ({
            ...prev,
            config: {
              ...prev.config,
              [field === 'size' ? 'titleSize' : field]: value
            }
          }));
      }
      if (field === 'bindTo' && value === null) {
          // Unbinding the title (legacy support)
          setDiagramData(prev => ({...prev, config: { ...prev.config, titleX: undefined, titleY: undefined, titleLock: false }}));
      }
      return;
    }
    setDiagramData(prev => {
      let newNodes = [...(prev.nodes || [])];
      let newGroups = [...(prev.groups || [])];
      const targetIndex = newNodes.findIndex(n => n.id === selectedNodeId);
      if (targetIndex === -1) return prev;
      
      let targetNode = { ...newNodes[targetIndex] };
      const gId = getGroupId(targetNode);

      if (field === 'size') {
         const applySize = (n, newVal) => {
             return { ...n, size: newVal };
         };
         
         if (gId) {
             const groupNodesOrig = newNodes.filter(n => getGroupId(n) === gId);
             const groupNodesNew = groupNodesOrig.map(n => applySize(n, value));
             // Allow overlapping sizes by default without blocking user

             
             newNodes = newNodes.map(n => groupNodesNew.find(x => x.id === n.id) || n);
             const gIdx = newGroups.findIndex(g => g.id === gId);
             if (gIdx > -1) newGroups[gIdx] = { ...newGroups[gIdx], size: value };
             else newGroups.push({ id: gId, size: value });
             
         } else {
             const proposedNode = applySize(targetNode, value);
             newNodes[targetIndex] = proposedNode;
         }
         return { ...prev, nodes: newNodes, groups: newGroups, layoutTrigger: Date.now() };
      }

      targetNode[field] = value;
      newNodes[targetIndex] = targetNode;

      if (field === 'groupId' && value) {
        const existingGroup = newGroups.find(g => g.id === value);
        if (existingGroup) {
          if (existingGroup.color !== undefined) targetNode.color = existingGroup.color;
          if (existingGroup.type !== undefined) targetNode.type = existingGroup.type;
          if (existingGroup.size !== undefined) targetNode.size = existingGroup.size;
        } else {
          let newNameCount = 1;
          while(newGroups.some(g => g.label === `New Group ${newNameCount}`)) newNameCount++;
          newGroups.push({ id: value, color: targetNode.color, type: targetNode.type, size: targetNode.size, label: `New Group ${newNameCount}` });
        }
      } else if (gId && ['color', 'type', 'fillStyle'].includes(field)) {
         newNodes = newNodes.map(n => getGroupId(n) === gId ? { ...n, [field]: value } : n);
         const gIdx = newGroups.findIndex(g => g.id === gId);
         if (gIdx > -1) newGroups[gIdx] = { ...newGroups[gIdx], [field]: value };
         else newGroups.push({ id: gId, [field]: value });
      }

      // Garbage collect empty groups
      const usedGroupIds = new Set(newNodes.map(n => getGroupId(n)));
      newGroups = newGroups.filter(g => usedGroupIds.has(g.id));

      if (activeSchema?.features?.recalculateOnEdit && ['value', 'size'].includes(field)) {
          newNodes = layoutNodesHeuristically(newNodes, prev.edges, { diagramType, groups: prev.groups });
      }

      return { ...prev, nodes: newNodes, groups: newGroups, layoutTrigger: Date.now() };
    });
  };

  const updateSelectedEdge = (field, value) => {
    if (!selectedEdgeId) return;
    setDiagramData(prev => ({
      ...prev,
      edges: prev.edges.map(e => e.id === selectedEdgeId ? { ...e, [field]: value } : e)
    }));
  };

  const reverseSelectedEdge = () => {
    if (!selectedEdgeId) return;
    setDiagramData(prev => ({
      ...prev,
      edges: prev.edges.map(e => {
        if (e.id !== selectedEdgeId) return e;
        return { ...e, from: e.to, to: e.from, sourceId: e.targetId, targetId: e.sourceId };
      })
    }));
  };
  
  const removeEdge = (edgeId) => {
    setDiagramData(prev => ({
      ...prev,
      edges: prev.edges.filter(e => e.id !== edgeId)
    }));
    if (selectedEdgeId === edgeId) setSelectedEdgeId(null);
  };

  const deleteSelectedElement = useCallback(() => {
    if (selectedNodeId) {
      setDiagramData(prev => {
        let newNodes = prev.nodes.filter(n => n.id !== selectedNodeId);
        let newEdges = prev.edges.filter(e => e.from !== selectedNodeId && e.to !== selectedNodeId);
        const usedGroupIds = new Set(newNodes.map(n => getGroupId(n)));
        
        if (activeSchema?.features?.recalculateOnEdit) {
           newNodes = layoutNodesHeuristically(newNodes, newEdges, { diagramType, groups: prev.groups });
        }
        
        return {
          ...prev,
          nodes: newNodes,
          edges: newEdges,
          groups: (prev.groups || []).filter(g => usedGroupIds.has(g.id))
        };
      });
      setSelectedNodeId(null);
    } else if (selectedEdgeId) {
      setDiagramData(prev => ({
        ...prev,
        edges: prev.edges.filter(e => e.id !== selectedEdgeId)
      }));
      setSelectedEdgeId(null);
    }
  }, [selectedNodeId, selectedEdgeId, diagramType]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA' || document.activeElement.tagName === 'SELECT') {
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'z') {
        e.preventDefault();
        redo();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        undo();
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        deleteSelectedElement();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deleteSelectedElement, undo, redo]);

  const handleSelectNode = useCallback((id) => {
    setSelectedNodeId(id);
    if(id) setSelectedEdgeId(null);
  }, []);
  
  const handleSelectEdge = useCallback((id) => {
    setSelectedEdgeId(id);
    if(id) setSelectedNodeId(null);
  }, []);

  let selectedNode = diagramData.nodes.find(n => n.id === selectedNodeId);
  if (selectedNodeId === '__SYSTEM_TITLE__') {
     selectedNode = {
        id: '__SYSTEM_TITLE__',
        type: 'title',
        label: diagramTitle,
        size: diagramData.config?.titleSize || 'AUTO',
        x: diagramData.config?.titleX,
        y: diagramData.config?.titleY,
        lockPos: diagramData.config?.titleLock || false
     };
  }
  
  const selectedEdge = diagramData.edges.find(e => e.id === selectedEdgeId);

  const toggleAppTheme = () => {
    setAppTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  return (
    <div className="app-container" style={{ display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      
      {/* 1. Unified Single-Line Header */}
      <AppHeader
        appTheme={appTheme}
        toggleAppTheme={toggleAppTheme}
        diagramTitle={diagramTitle}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
        handleDownloadSVG={handleDownloadSVG}
        handleDownloadChartici={handleDownloadChartici}
        setDiagramData={setDiagramData}
        setDiagramTitle={setDiagramTitle}
        setBgColor={setBgColor}
        setDialogConfig={setDialogConfig}
        setHelpTab={setHelpTab}
        setIsHelpOpen={setIsHelpOpen}
        LogoUrl={LogoUrl}
        onLogoClick={() => welcomeRef.current?.show()}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        resetSessionTimer={() => { sessionStartTime.current = Date.now(); }}
      />
      <input id="native-file-upload" type="file" accept=".cci,.json" style={{display: 'none'}} onChange={handleCharticiUpload} />

      {/* 2. Main Area: Workspace + Sidebar */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
        
        {/* Canvas Area */}
        <section className="app-canvas-area" style={{ flex: 1, position: 'relative' }}>
          <DiagramRenderer 
            initialData={filteredData} 
            theme={paletteTheme}
            svgRef={svgRef} 
            aspectRatio={aspect} 
            bgColor={bgColor} 
            selectedNodeId={selectedNodeId}
            onNodeSelect={handleSelectNode}
            selectedEdgeId={selectedEdgeId}
            onEdgeSelect={handleSelectEdge}
            fitTrigger={fitTrigger}
            onNodesChange={(nodes) => {
                const sysTitleIndex = nodes.findIndex(n => n.id === '__SYSTEM_TITLE__');
                let nextNodes = [...nodes];
                let nextConfig = { ...diagramData.config };
                if (sysTitleIndex > -1) {
                    const sysTitle = nextNodes.splice(sysTitleIndex, 1)[0];
                    // Always preserve manual drag, but let Auto Layout reset it if not locked
                    nextConfig.titleX = sysTitle.x;
                    nextConfig.titleY = sysTitle.y;
                    nextConfig.titleSize = sysTitle.size;
                    nextConfig.title = sysTitle.label;
                    setDiagramTitle(sysTitle.label || '');
                }
                setDiagramData({ ...diagramData, nodes: nextNodes, config: nextConfig });
            }}
            onEdgesChange={(newEdges) => setDiagramData(prev => ({ ...prev, edges: newEdges, layoutTrigger: Date.now() }))}
            onSmartAlign={handleSmartAlign}
            onAutoLayout={handleHeuristicLayout}
            diagramTitle={diagramTitle}
            diagramType={diagramType}
            setDiagramType={setDiagramType}
            onConnect={handleConnectionDrag}
            onAddNode={addNewNode}
            onGroupLabelChange={(groupId, newLabel) => {
              setDiagramData(prev => {
                const groupIndex = prev.groups.findIndex(g => g.id === groupId);
                if (groupIndex >= 0) {
                  return { ...prev, groups: prev.groups.map(g => g.id === groupId ? { ...g, label: newLabel } : g) };
                } else {
                  return { ...prev, groups: [...prev.groups, { id: groupId, label: newLabel }] };
                }
              });
            }}
            panToNodeId={panToNodeId}
            toolboxProps={{
              selectedNode,
              selectedEdge,
              updateSelectedNode,
              updateSelectedEdge,
              reverseSelectedEdge,
              updateGroupFromSelection,
              connectToNode,
              deleteSelectedElement,
              nodesList: filteredData.nodes,
              edgesList: filteredData.edges,
              groupsList: filteredData.groups,
              removeEdge,
              currentPaletteInfo: PALETTES[paletteTheme],
              diagramTitle,
              setDiagramTitle,
              diagramType,
              setDiagramType: (newType) => {
                 setDiagramData(prev => ({...prev, config: {...prev.config, layoutType: newType}}));
              },
              bgColor,
              onChangeBgColor: (newBg) => {
                 setBgColor(newBg);
                 setDiagramData(prev => ({...prev, config: {...prev.config, bgColor: newBg}}));
              },
              aspect,
              onChangeAspect: (newAspect) => {
                 setAspect(newAspect);
                 setDiagramData(prev => ({...prev, config: {...prev.config, aspect: newAspect}}));
              },
              onAddNode: (type) => addNewNode(type),
              paletteTheme,
              onChangeTheme: (newTheme) => {
                 setPaletteTheme(newTheme);
                 setDiagramData(prev => ({...prev, config: {...prev.config, theme: newTheme}}));
              }
            }}
          />

        </section>
      </div>



      {/* Modals */}
      {isHelpOpen && <HelpModal onClose={() => setIsHelpOpen(false)} initialTab={helpTab} />}
      {dialogConfig && <DialogModal {...dialogConfig} />}
      <WelcomeScreenModal ref={welcomeRef} onDataLoaded={(data) => loadParsedData(data)} />
    </div>
  );
}

export default App;
