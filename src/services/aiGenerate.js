import { DIAGRAM_SCHEMAS } from '../utils/diagramSchemas.js';

const DEFAULT_PALETTE = 'basic';

function flattenGeneratedNodes(cci) {
  return (cci?.data?.groups || []).flatMap(group =>
    (group.nodes || []).map(node => ({
      ...node,
      groupType: group.type,
      groupLabel: group.label,
    }))
  );
}

function parseNextStepIds(nextSteps) {
  if (!nextSteps || nextSteps === '-') return [];
  return String(nextSteps)
    .split(',')
    .map(step => step.trim())
    .filter(Boolean)
    .map(step => step.match(/^([^\[]+)/)?.[1]?.trim())
    .filter(Boolean);
}

function promptSuggestsChoices(extendedPrompt) {
  const text = String(extendedPrompt || '').toLowerCase();
  return /\([^)]*[,;/][^)]*\)/.test(text) || /\b(choose|pick|choice|choices|option|options|either|or)\b/.test(text);
}

function describeNodeCountBudget(diagramType) {
  const dt = String(diagramType || '').toLowerCase();
  if (dt === 'tree') return '40 nodes max; preserve useful category levels and summarize only repetitive leaves';
  if (dt === 'flowchart') return '30 nodes max; compress repeated options into 3-5 category nodes';
  if (dt === 'timeline') return '28 nodes max; summarize only repetitive minor events';
  if (dt === 'sequence') return '28 nodes max; keep actors and handoffs readable';
  if (dt === 'radial') return '32 nodes max; preserve category and leaf levels';
  if (dt === 'erd') return '18 entities max; keep only meaningful domain entities';
  if (dt === 'piechart') return '10 slices max; merge tiny slices into an Other slice';
  if (dt === 'matrix') return 'keep matrix zones compact; summarize repeated items';
  return '26 nodes max; compress long option lists into category nodes';
}

function getMaxReadableNodes(diagramType) {
  const dt = String(diagramType || '').toLowerCase();
  if (dt === 'matrix') return Infinity;
  if (dt === 'tree') return 40;
  if (dt === 'flowchart') return 30;
  if (dt === 'timeline') return 28;
  if (dt === 'sequence') return 28;
  if (dt === 'radial') return 32;
  if (dt === 'erd') return 18;
  if (dt === 'piechart') return 10;
  return 26;
}

function validateGeneratedCci(cci, diagramType, extendedPrompt = '') {
  const dt = diagramType.toLowerCase();
  const groups = cci?.data?.groups || [];
  const nodes = flattenGeneratedNodes(cci);
  const explicitEdges = [
    ...(cci?.data?.edges || []),
    ...(cci?.data?.messages || []),
    ...(cci?.data?.relationships || []),
  ];
  const realNodes = nodes.filter(n => n.type !== 'title' && n.type !== 'text');
  const ids = new Set();
  const errors = [];

  if (groups.length === 0) errors.push('no groups');
  if (realNodes.length < 2) errors.push('too few nodes');
  const maxReadableNodes = getMaxReadableNodes(dt);
  if (realNodes.length > maxReadableNodes) errors.push(`too many nodes for a readable book figure (${describeNodeCountBudget(dt)})`);

  for (const node of realNodes) {
    const id = String(node.id || '').trim();
    const label = String(node.label || '').trim();
    if (!id) errors.push('node without id');
    if (ids.has(id)) errors.push(`duplicate id: ${id}`);
    ids.add(id);
    if (!label) errors.push(`node ${id || '?'} has no label`);
    if (label.length > 42) errors.push(`label too long: ${label}`);
  }

  if (dt === 'flowchart') {
    const outgoingCounts = realNodes.map(node => parseNextStepIds(node.nextSteps).length);
    const incomingCounts = new Map(realNodes.map(node => [String(node.id), 0]));
    realNodes.forEach(node => {
      parseNextStepIds(node.nextSteps).forEach(targetId => {
        incomingCounts.set(String(targetId), (incomingCounts.get(String(targetId)) || 0) + 1);
      });
    });
    const edgeCount = outgoingCounts.reduce((sum, count) => sum + count, 0);
    if (edgeCount === 0) errors.push('flowchart has no nextSteps');
    if (realNodes.length >= 5 && groups.filter(g => (g.nodes || []).length > 0).length <= 1) {
      errors.push('flowchart needs multiple visual stage groups for color variety');
    }
    if (promptSuggestsChoices(extendedPrompt) && !outgoingCounts.some(count => count > 1)) {
      errors.push('prompt contains choices, but flowchart is a straight line; preserve choices as branches');
    }
    for (const node of realNodes) {
      const outgoing = parseNextStepIds(node.nextSteps);
      if (node.type === 'rhombus' && outgoing.length > 6) {
        errors.push(`decision "${node.label || node.id}" has ${outgoing.length} outgoing links; split choices into category nodes`);
      }
    }
    for (const node of realNodes) {
      for (const targetId of parseNextStepIds(node.nextSteps)) {
        if (!ids.has(targetId)) errors.push(`unknown nextSteps target: ${targetId}`);
      }
    }
  }

  if (dt === 'timeline') {
    const spineIds = new Set(realNodes.filter(n => n.type === 'chevron' || n.groupType === 'chevron').map(n => String(n.id)));
    const eventNodes = realNodes.filter(n => !spineIds.has(String(n.id)));
    if (spineIds.size < 2) errors.push('timeline needs at least two spine phases');
    for (const event of eventNodes) {
      if (!event.spineId) errors.push(`timeline event missing spineId: ${event.id}`);
      else if (!spineIds.has(String(event.spineId))) errors.push(`unknown timeline spineId: ${event.spineId}`);
    }
  }

  if (dt === 'tree') {
    const rootCount = groups.filter(g => (g.label || '').toLowerCase() === 'root' || g.nodes?.some(n => String(n.id).startsWith('root'))).length;
    if (rootCount === 0) errors.push('tree has no clear root');
  }

  if (['sequence', 'erd'].includes(dt)) {
    if (explicitEdges.length === 0) errors.push(`${dt} has no relationships`);
    for (const edge of explicitEdges) {
      const sourceId = String(edge.sourceId || edge.from || '').trim();
      const targetId = String(edge.targetId || edge.to || '').trim();
      if (!ids.has(sourceId)) errors.push(`unknown relationship source: ${sourceId}`);
      if (!ids.has(targetId)) errors.push(`unknown relationship target: ${targetId}`);
    }
  }

  if (dt === 'matrix' && groups.length < 2) {
    errors.push('matrix needs at least two zones');
  }

  return errors;
}

function applyGeneratedPieSliceColors(parsed, diagramType) {
  if (String(diagramType || '').toLowerCase() !== 'piechart') return;
  const slices = (parsed?.data?.groups || [])
    .flatMap(group => group.nodes || [])
    .filter(node => node.type === 'pie_slice');
  slices.forEach((slice, index) => {
    slice.color = (index % 9) + 1;
  });
}

function getExplicitEdgeKey(diagramType) {
  const dt = diagramType.toLowerCase();
  if (dt === 'sequence') return 'messages';
  if (dt === 'erd') return 'relationships';
  return null;
}

function cleanPhase2Content(content) {
  return String(content || '')
    .replace(/<\s*(?:thinking|reasoning|analysis)[^>]*>[\s\S]*?<\s*\/\s*(?:thinking|reasoning|analysis)\s*>/gi, '')
    .replace(/<\s*(?:thinking|reasoning|analysis)[^>]*>[\s\S]*$/gi, '')
    .replace(/<\s*\/?\s*(?:output|response|result)\s*[^>]*>/gi, '')
    .replace(/```[\w-]*\n?/g, '')
    .trim();
}

function inferModeFromTableHeader(cols, diagramType, currentMode) {
  const dt = diagramType.toLowerCase();
  const normalized = cols.map(col => String(col || '').toLowerCase().replace(/\s+/g, ' ').trim());
  const joined = normalized.join(' | ');

  if (normalized.includes('source id') && normalized.includes('target id')) return 'edges';
  if (joined.includes('next steps')) return 'nodes';
  if (joined.includes('phase/era label')) return 'spine';
  if (joined.includes('spine id') && joined.includes('label')) return currentMode === 'spine' ? 'events' : 'events';
  if (joined.includes('value') && (joined.includes('title') || joined.includes('label'))) return 'pie';

  if (['flowchart', 'sequence', 'erd', 'matrix'].includes(dt)) return 'nodes';
  if (dt === 'piechart') return 'pie';
  if (dt === 'timeline') return currentMode || 'spine';
  if (['tree', 'radial'].includes(dt)) return currentMode || 'root';
  return currentMode;
}

function inferModeFromDataRow(diagramType, currentMode) {
  if (currentMode) return currentMode;
  const dt = diagramType.toLowerCase();
  if (['flowchart', 'sequence', 'erd', 'matrix'].includes(dt)) return 'nodes';
  if (dt === 'piechart') return 'pie';
  if (dt === 'timeline') return 'spine';
  if (['tree', 'radial'].includes(dt)) return 'root';
  return currentMode;
}

/**
 * Helper to call the backend-owned generation proxy.
 * The browser never sends raw system/user message arrays; the backend builds them.
 */
async function callGenerationTask(payload) {
  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return res.json();
}

/**
 * Saves the last 10 Phase 1 results to localStorage for debugging
 */
function savePhase1Log(userInput, title, type, promptStr, rawResponse) {
  try {
    const logs = JSON.parse(localStorage.getItem('phase1_logs') || '[]');
    logs.unshift({
      timestamp: new Date().toISOString(),
      userInput,
      title,
      type,
      promptStr,
      rawResponse
    });
    if (logs.length > 10) logs.length = 10;
    localStorage.setItem('phase1_logs', JSON.stringify(logs));
  } catch (e) {
    console.error('Failed to save phase1 log', e);
  }
}

export async function planDiagram(userPrompt) {
  // ----------------------------------------------------
  // PHASE 1: Planning and Prompt Expansion
  // ----------------------------------------------------
  const phase1Data = await callGenerationTask({ task: 'plan', userPrompt });
  if (!phase1Data.success) {
    return { success: false, error: phase1Data.error || 'Unknown error in Phase 1' };
  }

  const p1Content = phase1Data.content;
  
  // Extract XML tags safely
  const titleMatch = p1Content.match(/<title>([\s\S]*?)<\/title>/i);
  const typeMatch = p1Content.match(/<type>([\s\S]*?)<\/type>/i);
  const promptMatch = p1Content.match(/<prompt>([\s\S]*?)<\/prompt>/i);

  const title = titleMatch ? titleMatch[1].trim() : 'Generated Diagram';
  const diagramType = typeMatch ? typeMatch[1].trim().toLowerCase() : 'flowchart';
  // Strip any <thinking> blocks that DeepSeek may inject
  const rawPrompt = promptMatch ? promptMatch[1].trim() : p1Content;
  const extendedPrompt = rawPrompt.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '').trim();

  // Log phase 1 output for debugging
  savePhase1Log(userPrompt, title, diagramType, extendedPrompt, p1Content);

  return { success: true, title, diagramType, extendedPrompt };
}

export async function buildDiagram(title, diagramType, extendedPrompt) {
  // ----------------------------------------------------
  // PHASE 2: Table Parsing Generation
  // ----------------------------------------------------
  let requestPayload = { task: 'build', diagramType, extendedPrompt };
  let lastFailure = { error: 'AI returned unexpected format — try again' };

  for (let attempt = 0; attempt < 2; attempt++) {
  const phase2Data = await callGenerationTask(requestPayload);
  if (!phase2Data.success) {
    return { success: false, error: phase2Data.error || 'Unknown error in Phase 2' };
  }

  const rawContent = cleanPhase2Content(phase2Data.content);
  
  // PARSING ALGORITHM
  const parsed = {
    meta: { type: diagramType, version: "1.0.0" },
    title: { text: title, size: 'M' },
    data: { config: { titleText: title, aspect: '16:9' }, groups: [], edges: [] }
  };
  
  const lines = rawContent.split('\n');
  let mode = null;
  let currentGroupLabel = '';
  let currentGroupSize = 'M';
  let currentGroupType = 'process';
  let currentGroupParentId = null;
  
  const groupsMap = new Map();
  const inferNodeModeFromGroupHeading = () => {
    const dt = diagramType.toLowerCase();
    if (['flowchart', 'sequence', 'erd', 'matrix'].includes(dt)) return 'nodes';
    if (dt === 'timeline') return 'events';
    if (['tree', 'radial'].includes(dt)) return 'branches';
    return mode;
  };
  
  const getOrCreateGroup = (gLabel, gSize, gType) => {
    let lbl = gLabel.trim();
    if (!lbl || lbl === '-' || lbl.toLowerCase() === 'orphans') lbl = '';
    
    if (!groupsMap.has(lbl)) {
      const newGroup = { 
        label: lbl || undefined, 
        type: gType, 
        size: gSize,
        color: Math.floor(Math.random() * 8), // Random palette index [0-7]
        nodes: [] 
      };
      parsed.data.groups.push(newGroup);
      groupsMap.set(lbl, newGroup);
    }
    return groupsMap.get(lbl);
  };
  
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    const matchSize = (rawSizeStr) => {
      if (!rawSizeStr) return 'M';
      const schema = DIAGRAM_SCHEMAS[diagramType.toLowerCase()] || DIAGRAM_SCHEMAS.flowchart;
      const sMap = schema.semanticScale || DIAGRAM_SCHEMAS.flowchart.semanticScale || { L: 'L', M: 'M', S: 'S' };
      const rawLow = String(rawSizeStr).trim().toLowerCase();
      let matched = 'M';
      for (const [coreSize, mappedWord] of Object.entries(sMap)) {
          if (mappedWord.toLowerCase() === rawLow || coreSize.toLowerCase() === rawLow) {
              matched = coreSize;
              break;
          }
      }
      return matched;
    };

    if (t.match(/^#{1,4}\s*(?:.*\b)?(?:nodes|tables|components|states|steps|elements|entities)\b/i)) { mode = 'nodes'; continue; }
    if (t.match(/^#{1,4}\s*(?:.*\b)?(?:edges|relationships|messages|connections|transitions)\b/i)) { mode = 'edges'; continue; }
    if (t.match(/^#{1,4}\s*(?:.*\b)?pie slices\b/i)) { mode = 'pie'; continue; }
    if (t.match(/^#{1,4}\s*(?:.*\b)?timeline spine\b/i)) { mode = 'spine'; continue; }
    if (t.match(/^#{1,4}\s*(?:.*\b)?events\b/i)) { mode = 'events'; continue; }
    if (t.match(/^#{1,4}\s*(?:.*\b)?root\b/i)) { mode = 'root'; continue; }
    if (t.match(/^#{1,4}\s*(?:.*\b)?branches\b/i)) { mode = 'branches'; continue; }
    
    if (t.startsWith('### ') && !mode) {
      mode = inferNodeModeFromGroupHeading();
    }

    if ((mode === 'nodes' || mode === 'events' || mode === 'branches') && t.startsWith('### ')) {
      const lineWithoutHash = t.substring(4).trim();
      const parts = lineWithoutHash.split('|').map(s => s.trim());
      const rawLabelPart = parts[0];
      
      const colonIdx = rawLabelPart.indexOf(':');
      if (colonIdx !== -1) {
          currentGroupLabel = rawLabelPart.substring(colonIdx + 1).trim();
      } else {
          currentGroupLabel = rawLabelPart;
      }
      currentGroupSize = 'M';
      currentGroupType = 'process';
      currentGroupParentId = null;
      
      parts.slice(1).forEach(p => {
        if (p.toLowerCase().startsWith('size:')) currentGroupSize = matchSize(p.substring(5));
        if (p.toLowerCase().startsWith('type:')) currentGroupType = p.substring(5).trim();
        if (p.toLowerCase().startsWith('parent id:')) currentGroupParentId = p.substring(10).trim();
      });
      continue;
    }
    
    if (t.startsWith('|') && !t.includes('---')) {
      const cols = t.split('|').map(s => s.trim());
      // remove first and last empty elements caused by framing pipes |...|
      if (cols[0] === '') cols.shift();
      if (cols[cols.length - 1] === '') cols.pop();
      
      // Skip rows with < 2 real columns
      if (cols.length < 2) continue;

      // Skip header rows — detect by common header keywords in first two columns
      const c0 = cols[0].toLowerCase();
      const c1 = cols[1] ? cols[1].toLowerCase() : '';
      const headerWords = ['id', 'source id', 'target id', 'spine id', 'title', 'title (label)'];
      if (headerWords.includes(c0) || c0.endsWith(' id') || c1 === 'label' || c1 === 'phase/era label') {
        mode = inferModeFromTableHeader(cols, diagramType, mode);
        continue;
      }

      // Skip rows where first column is empty or whitespace
      if (!cols[0] || !cols[0].trim()) continue;
      mode = inferModeFromDataRow(diagramType, mode);
      if (mode === 'nodes' && cols.length >= 2) {
        const id = cols[0];
        const label = cols[1];
        
        let nodeType = currentGroupType;
        let val = undefined;
        let nextSteps = null;
        
        if (diagramType === 'flowchart') {
            const rawType = cols[2] || currentGroupType;
            const tLow = String(rawType).toLowerCase().trim();
            if (tLow === 'terminal') nodeType = 'oval';
            else if (tLow === 'decision') nodeType = 'rhombus';
            else if (tLow === 'event') nodeType = 'circle';
            else nodeType = 'process'; // fallback
            
            nextSteps = cols[3];
        } else if (diagramType === 'erd') {
            nodeType = 'process';
        } else {
            val = cols[2] ? Number(cols[2]) : undefined;
        }

        const group = getOrCreateGroup(currentGroupLabel, currentGroupSize, currentGroupType);
        const nodeObj = { id, label, type: nodeType, size: currentGroupSize };
        if (val !== undefined && !isNaN(val)) nodeObj.value = val;
        group.nodes.push(nodeObj);
        
        if (diagramType === 'flowchart' && nextSteps && nextSteps !== '-') {
            nodeObj.nextSteps = nextSteps;
        }
      }
      
      if (mode === 'root' && cols.length >= 2) {
        const id = cols[0];
        const label = cols[1];
        const rawSize = cols[2];
        const group = getOrCreateGroup('Root', 'L', 'process');
        group.nodes.push({ id, label, type: 'process', size: matchSize(rawSize) });
      }

      if (mode === 'branches' && cols.length >= 2) {
        const id = cols[0];
        const label = cols[1];
        
        const group = getOrCreateGroup(currentGroupLabel || 'Branch', currentGroupSize || 'M', 'process');
        group.nodes.push({ id, label, type: 'process', size: currentGroupSize || 'M' });
        
        if (currentGroupParentId) {
             group.parentId = currentGroupParentId;
        }
      }
      
      if (mode === 'pie' && cols.length >= 2) {
        const title = cols[0];
        const rawSize = cols[1];
        const val = cols[2] ? Number(cols[2]) : undefined;
        
        const group = getOrCreateGroup('Data', 'M', 'pie_slice');
        const nodeObj = { 
           id: `pie_${Math.random().toString(36).substr(2, 9)}`, 
           label: title, 
           type: 'pie_slice', 
           size: matchSize(rawSize) 
        };
        if (val !== undefined && !isNaN(val)) nodeObj.value = val;
        group.nodes.push(nodeObj);
      }

      if (mode === 'spine' && cols.length >= 2) {
        const id = cols[0];
        const label = cols[1];
        const rawColor = cols[2];
        
        const group = getOrCreateGroup('Spine', 'L', 'chevron');
        const nodeObj = { id, label, type: 'chevron', size: 'L' };
        if (rawColor && rawColor !== '-' && !isNaN(Number(rawColor))) {
            nodeObj.color = Number(rawColor);
        }
        group.nodes.push(nodeObj);
      }

      if (mode === 'events' && cols.length >= 2) {
        const spineId = cols[0];
        const label = cols[1];
        const id = `ev_${Math.random().toString(36).substr(2, 9)}`;
        const type = 'process';
        
        // Relies on the standard currentGroupLabel parsed just above!
        const group = getOrCreateGroup(currentGroupLabel || 'Events', currentGroupSize || 'M', 'process');
        group.nodes.push({ id, label, type, size: currentGroupSize || 'M' });
        
        // Link event to spine inherently
        group.nodes[group.nodes.length - 1].spineId = spineId;
      }

      if (mode === 'edges' && cols.length >= 4) {
        const sourceId = cols[0];
        const targetId = cols[1];
        const label = cols[2];
        
        const rawType = cols[3] || 'target';
        const rawTypeLow = String(rawType).toLowerCase();
        let connectionType = 'target';
        let lineStyle = 'solid';
        const dt = diagramType.toLowerCase();

        // Кардинальность ERD (1:N etc.) и направление стрелки — оба в connectionType
        if (['1:1','1:N','N:1','N:M'].includes(rawType)) {
            connectionType = rawType;
        } else if (dt === 'timeline') {
            lineStyle = 'dashed';
            connectionType = 'none';
        } else if (dt === 'sequence' && ['solid', 'dashed'].includes(rawTypeLow)) {
            lineStyle = rawTypeLow;
            connectionType = 'target';
        } else if (dt === 'radial' || dt === 'tree') {
            connectionType = 'none';
        } else {
            connectionType = rawType;
        }
        
        const edge = { sourceId, targetId, connectionType, lineStyle };
        if (label && label !== '-') edge.label = label;
        parsed.data.edges.push(edge);
      }
    }
  }
  
  if (parsed.data.groups.length === 0) {
      console.error('Phase 2 parse failure. Raw content:', rawContent.substring(0, 500));
      const parseErrors = ['no parseable Markdown tables or groups'];
      lastFailure = { error: 'AI returned unexpected format — try again' };
      if (attempt === 0) {
        requestPayload = { task: 'repair', diagramType, extendedPrompt, rawContent, errors: parseErrors };
        continue;
      }
      return lastFailure;
  }

  // Debug local log
  try {
     const logs = JSON.parse(localStorage.getItem('phase2_md_logs') || '[]');
     logs.unshift({ timestamp: new Date().toISOString(), rawContent });
     if (logs.length > 5) logs.length = 5;
     localStorage.setItem('phase2_md_logs', JSON.stringify(logs));
  } catch (e) {}

  // Assign sequential colors to groups
  parsed.data.groups.forEach((group, index) => {
    group.color = (index % 9) + 1; // Maps 0-8 to 1-9
  });

  const explicitEdgeKey = getExplicitEdgeKey(diagramType);
  if (explicitEdgeKey) {
    parsed.data[explicitEdgeKey] = parsed.data.edges || [];
    delete parsed.data.edges;
  }

  const qualityErrors = validateGeneratedCci(parsed, diagramType, extendedPrompt);
  if (qualityErrors.length > 0) {
    console.error('Phase 2 quality failure:', qualityErrors);
    lastFailure = { error: `AI returned a low-quality diagram: ${qualityErrors.slice(0, 3).join('; ')}` };
    if (attempt === 0) {
      requestPayload = { task: 'repair', diagramType, extendedPrompt, rawContent, errors: qualityErrors.slice(0, 8) };
      continue;
    }
    return lastFailure;
  }

  parsed.theme = DEFAULT_PALETTE;
  applyGeneratedPieSliceColors(parsed, diagramType);
  parsed.data.config = {
    ...(parsed.data.config || {}),
    bgColor: 'white',
    ...(diagramType.toLowerCase() === 'piechart' ? { showLegend: true } : {}),
  };

  return { success: true, cci: parsed };
  }

  return { success: false, ...lastFailure };
}
