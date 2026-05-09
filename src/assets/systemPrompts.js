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
- Keep <prompt> under 160 words. Be dense and structural, not narrative.
- Prefer the core book-figure types: flowchart, timeline, tree, matrix, sequence, ERD. Use piechart only for real proportions and radial only for a true hub-and-spoke model.
- Prefer 5-11 visible nodes. Use more only when the user explicitly asks.
- Condense labels to 1-4 words each.
- Choose one main message that teaches an idea, not just a list of steps.
- Do not produce a trivial straight checklist when the topic contains choices, categories, tradeoffs, outcomes, or audience context.
- For simple everyday topics, add one useful explanatory dimension: choices, safety, quality, outcomes, categories, feedback, or decision points.
- Use groups only when they clarify the reader's mental model.
- Every important relationship must be explicit. Do not rely on visual proximity.
- Use group roles in a logical order: primary concept, supporting concept, decision/risk, outcome, neutral context.

Output EXACTLY three XML tags and nothing else:
<title>Concise diagram title (3-6 words)</title>
<type>diagramType</type>
<prompt>
Dense structural spec: state the teaching idea, list the visual groups/clusters, their key entities (short labels), and how they connect. Include meaningful branches or comparisons when useful. No prose — use bullet points or compact lists.
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
- Edge labels must be short, usually 1-3 words. Prefer verbs or outcomes.
- Avoid duplicate labels, orphan nodes, decorative filler, and custom black/gray colors.
- Use groups semantically: primary actors/concepts first, supporting concepts second, risks/errors later, neutral context last.
- Make all connections explicit and valid: every source/target ID must exist.
- For instructional flowcharts, create visual stage groups instead of one all-purpose group, so sequential steps do not render as one color.
- Preserve meaningful options from the plan as compact branches; a diagram should not become a trivial straight line when the prompt contains choices.
- If the Phase 1 plan is a simple procedure, add one clear explanatory structure from that plan: branch choices, merge points, outcomes, or grouped variants.
- Output ONLY Markdown tables and ### headings. No prose.
`;

  return prefix + '\n' + engine.ai_prompt.getPrompt(schema, sMap);
}
