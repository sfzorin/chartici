import { SYSTEM_PROMPT_PHASE_1, getSystemPromptPhase2 } from '../assets/systemPrompts';

/**
 * Helper to call the Moonshot API proxy
 */
async function callMoonshot(messages, phase2 = false) {
  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages,
      model: 'moonshot-v1-128k',
      temperature: phase2 ? 0.1 : 0.3,
      ...(phase2 ? { response_format: { type: 'json_object' } } : {})
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
    { role: 'system', content: SYSTEM_PROMPT_PHASE_1 },
    { role: 'user', content: userPrompt }
  ];

  const phase1Data = await callMoonshot(phase1Messages, false);
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
  // PHASE 2: JSON Generation
  // ----------------------------------------------------
  const phase2Prompt = getSystemPromptPhase2(diagramType);
  const phase2Messages = [
    { role: 'system', content: phase2Prompt },
    { role: 'user', content: extendedPrompt }
  ];

  const phase2Data = await callMoonshot(phase2Messages, true);
  if (!phase2Data.success) {
    return { success: false, error: phase2Data.error || 'Unknown error in Phase 2' };
  }

  const rawContent = phase2Data.content;
  let parsed;

  try {
    // Try direct JSON parse first
    parsed = JSON.parse(rawContent);
  } catch {
    // Try extracting from markdown code block
    const match = rawContent.match(/\`\`\`(?:json)?\s*([\s\S]*?)\`\`\`/);
    if (match) {
      try {
        parsed = JSON.parse(match[1].trim());
      } catch {
        return { success: false, error: 'AI returned invalid JSON in Phase 2' };
      }
    } else {
      return { success: false, error: 'AI returned invalid JSON in Phase 2' };
    }
  }

  // Basic validation
  if (!parsed.data || !parsed.data.groups || !parsed.data.edges) {
    return { success: false, error: 'AI returned incomplete diagram data' };
  }

  // Assign sequential colors to groups
  parsed.data.groups.forEach((group, index) => {
    group.color = (index % 9) + 1; // Maps 0-8 to 1-9
  });

  // Inject the title and diagramType calculated in Phase 1
  parsed.title = title;
  parsed.diagramType = diagramType;
  parsed.aspect = '16:9';

  // Assign a random theme
  const THEMES = [
    'muted-rainbow', 'vibrant-rainbow', 'grey', 'red', 'green', 'blue', 
    'brown', 'purple', 'blue-orange', 'green-purple', 'slate-rose', 'blue-teal-slate'
  ];
  if (!parsed.theme) {
    parsed.theme = THEMES[Math.floor(Math.random() * THEMES.length)];
  } else {
    parsed.theme = THEMES[Math.floor(Math.random() * THEMES.length)];
  }

  return { success: true, cci: parsed };
}
