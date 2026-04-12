import { DIAGRAM_SCHEMAS } from '../utils/diagramSchemas.js';
import { getEngine } from '../engines/index.js';

const getAvailableTypesText = () => {
  return Object.keys(DIAGRAM_SCHEMAS)
    .map((k, i) => `${i + 1}. ${DIAGRAM_SCHEMAS[k].id}: ${DIAGRAM_SCHEMAS[k].description}`)
    .join('\n');
};

export const getSystemPromptPhase1 = () => `You are an expert Diagram Architect.
Your task is to analyze the user's request and produce a structured plan for a diagram.
Respond in the same language the user used.

AVAILABLE DIAGRAM TYPES:
${getAvailableTypesText()}

STRICT RULES:
- Do NOT explain your choices. Just output the three XML tags below.
- Keep <prompt> under 150 words. Be dense and structural, not narrative.
- Aim for 9-20 entities unless the user explicitly asks for more or fewer.
- Condense labels to 1-3 words each.

Output EXACTLY three XML tags and nothing else:
<title>Concise diagram title (3-6 words)</title>
<type>diagramType</type>
<prompt>
Dense structural spec: list the main groups/clusters, their key entities (as short labels), and how they connect. No prose — use bullet points or compact lists.
</prompt>`;

export function getSystemPromptPhase2(diagramType) {
  const dt = diagramType.toLowerCase();
  const schema = DIAGRAM_SCHEMAS[dt] || DIAGRAM_SCHEMAS.flowchart;
  const engine = getEngine(dt);
  const sMap = engine?.ai_prompt?.semanticScale || schema.semanticScale || { L: 'large', M: 'medium', S: 'small' };

  if (!engine?.ai_prompt?.getPrompt) {
    throw new Error(`Engine plugin "${dt}" is missing ai_prompt.getPrompt(). Define it in src/engines/${dt}/ai_prompt.js`);
  }

  const prefix = `Rules:
- Every node needs a unique alphanumeric ID (e.g. n1, srv_a).
- Preserve the user's language for ALL labels exactly.
- Size: ${sMap.L}(emphasized) / ${sMap.M}(default) / ${sMap.S || 'minor'}(de-emphasized).
- Output ONLY Markdown tables and ### headings. No prose.
`;

  return prefix + '\n' + engine.ai_prompt.getPrompt(schema, sMap);
}
