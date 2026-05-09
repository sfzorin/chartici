import { DIAGRAM_SCHEMAS } from '../utils/diagramSchemas.js';
import { getEngine } from '../engines/index.js';

const getAvailableTypesText = () => {
  return Object.keys(DIAGRAM_SCHEMAS)
    .map((k, i) => `${i + 1}. ${DIAGRAM_SCHEMAS[k].id}: ${DIAGRAM_SCHEMAS[k].description}`)
    .join('\n');
};

export const getSystemPromptPhase1 = () => `You are an expert Diagram Architect.
Your task is to analyze the user's request and produce a structured plan for a polished book figure.
Respond in the same language the user used.

AVAILABLE DIAGRAM TYPES:
${getAvailableTypesText()}

STRICT RULES:
- Do NOT explain your choices. Just output the three XML tags below.
- Keep <prompt> under 130 words. Be dense and structural, not narrative.
- Prefer 5-11 visible nodes. Use more only when the user explicitly asks.
- Condense labels to 1-4 words each.
- Choose one main message. Remove side details that do not support it.
- Use groups only when they clarify the reader's mental model.

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
- Make this suitable for a book figure: compact, readable, and not crowded.
- Prefer 5-11 visible nodes. Hard maximum 14 unless explicitly requested.
- Labels must be short noun/verb phrases, ideally 1-4 words.
- Avoid duplicate labels, orphan nodes, and decorative filler.
- Output ONLY Markdown tables and ### headings. No prose.
`;

  return prefix + '\n' + engine.ai_prompt.getPrompt(schema, sMap);
}
