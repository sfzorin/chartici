import { getSystemPromptPhase1, getSystemPromptPhase2 } from '../assets/systemPrompts';
import { DIAGRAM_SCHEMAS } from '../utils/diagramSchemas.js';

/**
 * Helper to call the Moonshot API proxy
 */
async function callMoonshot(messages, temp = 0.3, isJson = false) {
  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages,
      model: 'moonshot-v1-128k',
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

  const phase1Data = await callMoonshot(phase1Messages, 0.3, false);
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

  const phase2Data = await callMoonshot(phase2Messages, 0.1, false); // Temp 0.1, No JSON mode
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
  
  const groupsMap = new Map();
  
  const getOrCreateGroup = (gLabel, gSize, gType) => {
    let lbl = gLabel.trim();
    if (!lbl || lbl === '-' || lbl.toLowerCase() === 'orphans') lbl = '';
    
    if (!groupsMap.has(lbl)) {
      const newGroup = { label: lbl || undefined, type: gType, size: gSize, nodes: [] };
      parsed.data.groups.push(newGroup);
      groupsMap.set(lbl, newGroup);
    }
    return groupsMap.get(lbl);
  };
  
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t.toLowerCase().startsWith('# nodes')) { mode = 'nodes'; continue; }
    if (t.toLowerCase().startsWith('# edges')) { mode = 'edges'; continue; }
    
    if (mode === 'nodes' && t.toLowerCase().startsWith('### group:')) {
      const parts = t.substring(10).split('|').map(s => s.trim());
      currentGroupLabel = parts[0];
      currentGroupSize = 'M';
      currentGroupType = 'process';
      
      const schema = DIAGRAM_SCHEMAS[diagramType.toLowerCase()] || DIAGRAM_SCHEMAS.default;
      const sMap = schema.semanticScale || DIAGRAM_SCHEMAS.default.semanticScale;

      parts.slice(1).forEach(p => {
        if (p.toLowerCase().startsWith('size:')) {
            const rawSize = p.substring(5).trim();
            const rawLow = rawSize.toLowerCase();
            let matched = 'M';
            for (const [coreSize, mappedWord] of Object.entries(sMap)) {
                if (mappedWord.toLowerCase() === rawLow || coreSize.toLowerCase() === rawLow) {
                    matched = coreSize;
                    break;
                }
            }
            currentGroupSize = matched;
        }
        if (p.toLowerCase().startsWith('type:')) currentGroupType = p.substring(5).trim();
      });
      continue;
    }
    
    if (t.startsWith('|') && !t.includes('---')) {
      const cols = t.split('|').map(s => s.trim());
      // remove first and last empty elements caused by framing pipes |...|
      if (cols[0] === '') cols.shift();
      if (cols[cols.length - 1] === '') cols.pop();
      
      if (cols.length === 0 || cols[0].toLowerCase() === 'id' || cols[0].toLowerCase() === 'source id') continue;
      
      if (mode === 'nodes' && cols.length >= 2) {
        const id = cols[0];
        const label = cols[1];
        const val = cols[2] ? Number(cols[2]) : undefined;
        
        const group = getOrCreateGroup(currentGroupLabel, currentGroupSize, currentGroupType);
        const nodeObj = { id, label, type: currentGroupType, size: currentGroupSize };
        if (val !== undefined && !isNaN(val)) nodeObj.value = val;
        group.nodes.push(nodeObj);
      }
      
      if (mode === 'edges' && cols.length >= 5) {
        const sourceId = cols[0];
        const targetId = cols[1];
        const label = cols[2];
        const lineStyle = cols[3] || 'solid';
        const connectionType = cols[4] || 'target';
        
        parsed.data.edges.push({
           sourceId, targetId,
           label: (label && label !== '-') ? label : undefined,
           lineStyle, connectionType
        });
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
    'muted-rainbow', 'vibrant-rainbow', 'grey', 'red', 'green', 'blue', 
    'brown', 'purple', 'blue-orange', 'green-purple', 'slate-rose', 'blue-teal-slate'
  ];
  parsed.theme = THEMES[Math.floor(Math.random() * THEMES.length)];

  return { success: true, cci: parsed };
}
