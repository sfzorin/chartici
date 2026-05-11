import { DIAGRAM_SCHEMAS } from '../utils/diagramSchemas.js';
import { getEngine } from '../engines/index.js';

const getAvailableTypesText = () => {
  return Object.keys(DIAGRAM_SCHEMAS)
    .map((k, i) => `${i + 1}. ${DIAGRAM_SCHEMAS[k].id}: ${DIAGRAM_SCHEMAS[k].description}`)
    .join('\n');
};

export const isSupportedDiagramType = (diagramType) => (
  Object.prototype.hasOwnProperty.call(DIAGRAM_SCHEMAS, String(diagramType || '').toLowerCase())
);

export const getSystemPromptPhase1 = () => `You are an expert Diagram Architect.
Your task is to analyze the user's request and produce a structured plan for a polished, memorable diagram.
Respond in the same language the user used.

AVAILABLE DIAGRAM TYPES:
${getAvailableTypesText()}

STRICT RULES:
- Do NOT explain your choices. Just output the three XML tags below.
- Keep <prompt> under 160 words. Be dense and structural, not narrative.
- Prefer the core book-figure types: flowchart, timeline, tree, matrix, sequence, ERD. Use piechart only for real proportions and radial only for a true hub-and-spoke model.
- Prefer 8-18 visible nodes for most diagrams. Flowcharts, timelines, sequences, radial diagrams, and trees may be larger when the structure genuinely benefits from it.
- Complexity budget is generous but not unlimited: if the topic has many examples, compress long lists into 3-6 categories instead of listing every item.
- Condense labels to 1-4 words each.
- Choose one main message that teaches an idea, not just a list of steps.
- Make the result interesting for a curious first-time visitor: reveal a pattern, tension, choice, tradeoff, cycle, failure mode, hierarchy, or before/after transformation.
- Prefer diagrams with an honest second dimension when useful: option vs consequence, role vs responsibility, layer vs failure mode, stage vs cost, risk vs control, or cause vs symptom.
- Prefer a "smart angle" over a literal restatement. For mundane topics, add a useful twist that makes the reader think: what can go wrong, how choices affect outcomes, how categories converge, or what separates good from bad.
- Do not produce a trivial straight checklist when the topic contains choices, categories, tradeoffs, outcomes, or audience context.
- Avoid the default "five boxes in a row" diagram. Use it only when sequence itself is the lesson and a second dimension would be artificial.
- For simple everyday topics, add one useful explanatory dimension: choices, safety, quality, outcomes, categories, feedback, or decision points.
- If the user's request is broad or casual, infer a concrete audience and purpose, then make the diagram teach that purpose.
- Use groups only when they clarify the reader's mental model.
- Every important relationship must be explicit. Do not rely on visual proximity.
- Use group roles in a logical order: primary concept, supporting concept, decision/risk, outcome, neutral context.
- For tree and radial diagrams, preserve hierarchy levels from the request: named categories/branches/clusters must be visible intermediate nodes, not just group colors.

TYPE-SPECIFIC SEMANTIC STRATEGIES:
- Flowchart: show decisions, checks, branches, merges, feedback, and recovery. Avoid a plain procedure unless the request is strictly linear. If the idea is mainly comparison, hierarchy, ownership, layers, or roles, choose matrix/tree/radial/sequence instead.
- Tree: build a taxonomy with real abstraction levels. Preserve categories as intermediate nodes and include enough representative leaves to feel complete.
- Matrix: choose meaningful axes that reveal tradeoffs, fit, risk, priority, or comparison. Do not use weak labels like "high/low" unless the dimensions are clear.
- Timeline: show an arc: setup, turning points, consequences, and current/future state. Prefer causality over a flat list of dates.
- Sequence: show responsibility and handoffs between actors, including retries, errors, confirmations, or async callbacks when useful.
- ERD: show domain meaning through entities and relationships, not generic tables. Relationship labels should explain the business rule.
- Radial: use center → visible category nodes → concrete leaves. Avoid a flat flower unless the topic truly has one level.
- Piechart: only use for real proportions. Slices should represent a meaningful distribution, not arbitrary categories.

Output EXACTLY three XML tags and nothing else:
<title>Concise diagram title (3-6 words)</title>
<type>diagramType</type>
<prompt>
Dense structural spec: state "central insight: ..." and "interesting angle: ...", list the inferred audience/purpose, visual groups/clusters, their key entities (short labels), and how they connect. Include meaningful branches, comparisons, feedback loops, checks, or outcomes when useful. No prose — use bullet points or compact lists.
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
- Prefer 8-18 visible nodes for most diagrams. Flowcharts may use up to 30 nodes when meaningful branches, checks, or recovery paths are needed. Timelines and sequences may use up to 28 nodes when the arc or handoffs need room. Radial diagrams may use up to 32 nodes when category and leaf levels are meaningful. Trees may use up to 40 nodes when they preserve real hierarchy. ERD should stay under 18 entities and piechart under 10 slices unless explicitly requested.
- Labels must be short noun/verb phrases, ideally 1-4 words.
- Edge labels must be short, usually 1-3 words. Prefer verbs or outcomes.
- Avoid duplicate labels, orphan nodes, decorative filler, floating notes, detached callouts, legend-only nodes, and custom black/gray colors.
- Every visible node must belong to the main conceptual structure. Do not turn side facts, annotations, examples, or explanatory notes into disconnected nodes.
- Use groups semantically: primary actors/concepts first, supporting concepts second, risks/errors later, neutral context last.
- Prefer multiple meaningful groups when the diagram has distinct roles, stages, causes, checks, outcomes, or risk levels. Avoid one generic group that makes everything the same color.
- Assign group/color roles intentionally so the diagram has visual contrast: main path, choices/categories, cautions, outcomes, and supporting context should not all share one group.
- Build the diagram from the central insight in the plan. Every node should either support the idea, create a meaningful choice, explain a consequence, or clarify a category.
- Avoid same-shape repetition. If the concept would produce a row of same-role blocks, choose or express a stronger structure: comparison, layered model, fork/merge, decision, cause/effect, or before/after contrast.
- Use node types truthfully but actively: terminal for start/end or final states, decision for real branching questions, event for consequences/alerts/failures/connectors, process for actions or checks.
- If the topic is casual or broad, honor the inferred audience/purpose from the plan instead of producing a generic encyclopedia entry.
- Make all connections explicit and valid: every source/target ID must exist.
- For instructional flowcharts, create visual stage groups instead of one all-purpose group, so sequential steps do not render as one color.
- Preserve meaningful options from the plan as compact branches; a diagram should not become a trivial straight line when the prompt contains choices.
- Keep decision fan-out readable: max 6 outgoing choices from any decision. Convert larger choice lists into category nodes or a sequence of smaller decisions.
- Stay inside the node budget by summarizing long example lists into 3-5 categories.
- If the Phase 1 plan is a simple procedure, add one clear explanatory structure from that plan: branch choices, merge points, outcomes, grouped variants, quality checks, or failure/recovery paths.
- Prefer diagrams with a visible conceptual shape: fork-and-join, funnel, loop, layered hierarchy, comparison grid, timeline arc, or cause-effect chain. Avoid plain left-to-right chains unless the topic is inherently linear.
- Do an "obvious-only" self-check before final output: if the result is just a list of obvious steps or categories, revise it to include one useful layer of decisions, criteria, risks, outcomes, or tradeoffs.
- Output ONLY Markdown tables and ### headings. No prose.
`;

  return prefix + '\n' + engine.ai_prompt.getPrompt(schema, sMap);
}
