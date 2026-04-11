import { getGroupId } from './groupUtils';

export async function downloadCharticiFile(projectName, diagramData, config) {
  // Group nodes by groupId
  const exportGroups = [];
  const gMap = {};

  (diagramData.groups || []).forEach(g => {
    // Clone group properties except nodes to avoid circulars
    const safeLabel = g.label || g.groupLabel || g.text;
    gMap[g.id] = { ...g, nodes: [] };
    if (safeLabel) gMap[g.id].label = safeLabel;
    else delete gMap[g.id].label;
    delete gMap[g.id].text;
    delete gMap[g.id].groupLabel;
    delete gMap[g.id].id;
    exportGroups.push(gMap[g.id]);
  });

  (diagramData.nodes || []).forEach(n => {
    const parentId = n.groupId || `g_${n.id}`; // Give it a group if it lacks one
    if (!gMap[parentId]) {
      gMap[parentId] = { 
         color: n.color, 
         type: n.type, 
         size: n.size, 
         nodes: [] 
      };
      exportGroups.push(gMap[parentId]);
    }
    const nodeExport = { id: n.id };
    const safeNodeLabel = n.label || n.nodeLabel || n.text;
    if (safeNodeLabel) nodeExport.label = safeNodeLabel;
    if (n.lockPos) { nodeExport.x = n.x; nodeExport.y = n.y; nodeExport.lockPos = true; }
    gMap[parentId].nodes.push(nodeExport);
  });

  const { diagramType, ...configRoot } = (config || {});
  
  const payload = {
    meta: {
      type: diagramType || 'flowchart',
      version: "3.0.0"
    },
    title: {
       text: configRoot.title || '',
       size: configRoot.titleSize || 'L',
       ...(configRoot.titleX !== undefined ? { x: configRoot.titleX } : {}),
       ...(configRoot.titleY !== undefined ? { y: configRoot.titleY } : {})
    },
    data: {
      groups: exportGroups,
      edges: (diagramData.edges || []).map(e => {
        const edgeExport = { ...e, label: e.label || e.edgeLabel || e.text };
        delete edgeExport.edgeLabel;
        delete edgeExport.text;
        delete edgeExport.id;
        if (!edgeExport.label) delete edgeExport.label;
        if (edgeExport.sourcelabel) delete edgeExport.sourcelabel;
        if (edgeExport.targetlabel) delete edgeExport.targetlabel;
        if (edgeExport.from) { edgeExport.sourceId = edgeExport.sourceId || edgeExport.from; delete edgeExport.from; }
        if (edgeExport.to) { edgeExport.targetId = edgeExport.targetId || edgeExport.to; delete edgeExport.to; }
        return edgeExport;
      })
    }
  };
  
  if (diagramType === 'piechart') {
     // Pie chart spec: strictly omit groups/edges, output pure flat nodes with size mappings
     const flatNodes = [];
     exportGroups.forEach(g => {
        g.nodes.forEach(n => {
           flatNodes.push({
              id: n.id,
              label: n.label,
              size: n.size || g.size,
              value: n.value
           });
        });
     });
     delete payload.data.groups;
     delete payload.data.edges;
     payload.data.nodes = flatNodes;
  }


  const jsonStr = JSON.stringify(payload, null, 2);

  try {
    if (window.showSaveFilePicker) {
      const handle = await window.showSaveFilePicker({
        suggestedName: projectName ? `${projectName}.cci` : 'diagram.cci',
        types: [{
          description: 'Chartici Document',
          accept: { 'application/json': ['.cci', '.json'] },
        }],
      });
      const writable = await handle.createWritable();
      await writable.write(jsonStr);
      await writable.close();
      return handle.name.replace(/\.cci$/, '');
    } else {
      // Fallback
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const safeName = projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      link.download = `${safeName || 'diagram'}.cci`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return safeName || 'diagram';
    }
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.error('Save failed:', err);
    }
    return null;
  }
}

export function parseCharticiFile(fileContent) {
  try {
    const data = JSON.parse(fileContent);
    
    // Helper function to resolve nested nodes from groups or legacy flat nodes
    const resolveNodesAndGroups = (rawNodes, rawGroups) => {
      const flatNodes = [];
      const cleanGroups = [];
      
      // 1. Process nested groups (New schema)
      (rawGroups || []).forEach(g => {
        const { nodes: childNodes, ...groupStyles } = g;
        groupStyles.id = groupStyles.id || `group_${Math.random().toString(36).substr(2, 9)}`;
        cleanGroups.push(groupStyles);
        
        if (Array.isArray(childNodes)) {
           childNodes.forEach(n => {
             flatNodes.push({
               ...n,
               label: n.label || n.nodeLabel || n.text,
               groupId: groupStyles.id,
               type: groupStyles.type,
               size: (n.size !== undefined) ? n.size : groupStyles.size,
               lockPos: n.lockPos,
               x: n.x,
               y: n.y
             });
           });
        }
      });

      // 2. Process legacy flat nodes (Fallback for old files)
      if (Array.isArray(rawNodes)) {
          rawNodes.forEach(n => {
            const gId = getGroupId(n) || `g_${n.id}`;
            let g = cleanGroups.find(cg => cg.id === gId);
            
            // Migrate legacy node color to group level
            if (!g) {
               g = { id: gId, color: n.color || 1, lockColor: !!n.lockColor };
               cleanGroups.push(g);
            } else if (n.lockColor && n.color) {
               g.color = n.color;
               g.lockColor = true;
            }

            flatNodes.push({
               ...n,
               label: n.label || n.nodeLabel || n.text,
               groupId: gId,
               type: g.type,
               size: (n.size !== undefined) ? n.size : g.size,
               lockPos: n.lockPos,
               x: n.x,
               y: n.y
            });
            
            // Clean purely visual traits from the node record so it behaves statelessly
            delete flatNodes[flatNodes.length - 1].color;
            delete flatNodes[flatNodes.length - 1].lockColor;
         });
      }

      return { flatNodes, cleanGroups };
    };

    // Helper function to resolve and deduplicate edges
    const resolveEdges = (rawEdges) => {
      const edges = (rawEdges || []).map(e => {
        const source = e.sourceId || e.from || e.sourcelabel || e.sourceLabel;
        const target = e.targetId || e.to || e.targetlabel || e.targetLabel;
        return { 
          ...e,
          id: e.id || `edge_${Math.random().toString(36).substr(2, 9)}`,
          label: e.label || e.edgeLabel || e.text,
          from: String(source), 
          to: String(target) 
        };
      });
      const seen = new Set();
      return edges.filter(e => {
        if (!e.from || !e.to || e.from === e.to) return false;
        const min = e.from < e.to ? e.from : e.to;
        const max = e.from > e.to ? e.from : e.to;
        const key = `${min}::${max}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    };

    // Handle payload either wrapped in cci_project structure or raw root objects
    const isProjectWrapped = data.type === 'cci_project' || data.type === 'chartici_project' || data.data;
    const coreData = isProjectWrapped ? (data.data || {}) : data;
    const configFromData = coreData.config || {};
    const metaData = data.meta || coreData.meta || {};

    const { flatNodes, cleanGroups } = resolveNodesAndGroups(coreData.nodes, coreData.groups);
    const { type, data: _d, version, meta, ...restConfig } = data;
    let finalConfig = { ...configFromData, ...restConfig };
    
    // Convert new root title object format into flat config schema expected by App state
    if (finalConfig.title && typeof finalConfig.title === 'object') {
       finalConfig.titleText = finalConfig.title.text || finalConfig.title.label || '';
       if (finalConfig.title.size) finalConfig.titleSize = finalConfig.title.size;
       if (finalConfig.title.x !== undefined) finalConfig.titleX = finalConfig.title.x;
       if (finalConfig.title.y !== undefined) finalConfig.titleY = finalConfig.title.y;
       finalConfig.titleLock = finalConfig.title.x !== undefined;
       finalConfig.title = finalConfig.titleText; // Replace the object reference with string for compat
    }
    
    // Old format uses 'header' instead of 'title'
    if (data.header && !finalConfig.title) finalConfig.title = data.header;
    
    if (metaData.type && !finalConfig.diagramType) {
       finalConfig.diagramType = metaData.type;
    }

    return {
      groups: cleanGroups,
      nodes: flatNodes,
      edges: resolveEdges(coreData.edges),
      config: finalConfig
    };
  } catch (error) {
    throw new Error(`Failed to parse .cci file: ${error.message}`);
  }
}
