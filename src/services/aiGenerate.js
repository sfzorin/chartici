import { getSystemPromptPhase1, getSystemPromptPhase2 } from '../assets/systemPrompts.js';
import { DIAGRAM_SCHEMAS } from '../utils/diagramSchemas.js';

/**
 * Helper to call the DeepSeek API proxy
 */
async function callDeepSeek(messages, temp = 0.3, isJson = false) {
  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages,
      model: 'deepseek-chat',
      temperature: temp,
      ...(isJson ? { response_format: { type: 'json_object' } } : {})
    })
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
  const phase1Messages = [
    { role: 'system', content: getSystemPromptPhase1() },
    { role: 'user', content: userPrompt }
  ];

  const phase1Data = await callDeepSeek(phase1Messages, 0.3, false);
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
  const extendedPrompt = promptMatch ? promptMatch[1].trim() : p1Content;

  // Log phase 1 output for debugging
  savePhase1Log(userPrompt, title, diagramType, extendedPrompt, p1Content);

  return { success: true, title, diagramType, extendedPrompt };
}

export async function buildDiagram(title, diagramType, extendedPrompt) {
  // ----------------------------------------------------
  // PHASE 2: Table Parsing Generation
  // ----------------------------------------------------
  const phase2Prompt = getSystemPromptPhase2(diagramType);
  const phase2Messages = [
    { role: 'system', content: phase2Prompt },
    { role: 'user', content: extendedPrompt }
  ];

  const phase2Data = await callDeepSeek(phase2Messages, 0.1, false); // Temp 0.1, No JSON mode
  if (!phase2Data.success) {
    return { success: false, error: phase2Data.error || 'Unknown error in Phase 2' };
  }

  const rawContent = phase2Data.content;
  
  // PARSING ALGORITHM
  const parsed = {
    meta: { type: diagramType, version: "1.0.0" },
    data: { config: { title, aspect: '16:9' }, groups: [], edges: [] }
  };
  
  const lines = rawContent.split('\n');
  let mode = null;
  let currentGroupLabel = '';
  let currentGroupSize = 'M';
  let currentGroupType = 'process';
  let currentGroupParentId = null;
  
  const groupsMap = new Map();
  
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
      const sMap = schema.semanticScale || DIAGRAM_SCHEMAS.flowchart.semanticScale;
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

    if (t.match(/^#\s*(nodes|tables|components|states|steps|elements|entities)/i)) { mode = 'nodes'; continue; }
    if (t.match(/^#\s*(edges|relationships|messages|connections|transitions)/i)) { mode = 'edges'; continue; }
    if (t.toLowerCase().startsWith('# pie slices')) { mode = 'pie'; continue; }
    if (t.toLowerCase().startsWith('# timeline spine')) { mode = 'spine'; continue; }
    if (t.toLowerCase().startsWith('# events')) { mode = 'events'; continue; }
    if (t.toLowerCase().startsWith('# root')) { mode = 'root'; continue; }
    if (t.toLowerCase().startsWith('# branches')) { mode = 'branches'; continue; }
    
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
      
      // row bypass format: | ID |
      const c0 = cols[0].toLowerCase();
      const c1 = cols[1] ? cols[1].toLowerCase() : '';
      if (
          cols.length === 0 || 
          c0 === 'id' || c0 === 'source id' || c0 === 'target id' || c0.endsWith(' id') || 
          c0 === 'title' || 
          c1 === 'label'
      ) continue;
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
            const rawType = cols[2] || currentGroupType;
            const tLow = String(rawType).toLowerCase().trim();
            if (tLow === 'attribute') nodeType = 'circle';
            else nodeType = 'process'; // fallback is robust enough for 'table'
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
        let connectionType = 'target';
        let lineStyle = 'solid';
        const dt = diagramType.toLowerCase();

        // Кардинальность ERD (1:N etc.) и направление стрелки — оба в connectionType
        if (['1:1','1:N','N:1','N:M'].includes(rawType)) {
            connectionType = rawType;
        } else if (dt === 'timeline') {
            lineStyle = 'dashed';
            connectionType = 'none';
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
      return { success: false, error: 'AI failed to generate structural graph data' };
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

  // Assign a random theme
  const THEMES = [
    'muted-rainbow', 'vibrant-rainbow', 'blue-orange', 'green-purple', 'slate-rose', 'blue-teal-slate'
  ];
  parsed.theme = THEMES[Math.floor(Math.random() * THEMES.length)];

  return { success: true, cci: parsed };
}
