import { DIAGRAM_SCHEMAS } from '../utils/diagramSchemas.js';

const getAvailableTypesText = () => {
  return Object.keys(DIAGRAM_SCHEMAS)
    .filter(k => k !== 'default')
    .map((k, i) => `${i + 1}. ${DIAGRAM_SCHEMAS[k].id}: ${DIAGRAM_SCHEMAS[k].description}`)
    .join('\n');
};

export const getSystemPromptPhase1 = () => `You are an expert Diagram Architect.
Your task is to analyze the user's request and structure a detailed plan for a diagram.
Respond in the same language the user used.

AVAILABLE DIAGRAM TYPES:
${getAvailableTypesText()}

Output EXACTLY three XML tags:
<title>Concise title for the diagram</title>
<type>Exact diagramType (one of the types listed above)</type>
<prompt>
Write a detailed conceptual specification for the diagram. Focus on WHAT to show, not HOW to format it.
Scale the diagram's detail level according to the user's request (e.g., if they ask for a "simple" or "detailed" diagram, obey that). If not specified, match the natural complexity of the topic: do not overcomplicate simple concepts, and do not oversimplify complex architectures.
Keep the diagram readable: aim for 9-20 total entities unless the user explicitly demands a massive architecture.
Condense long text into punchy 1-3 word conceptual entities. Avoid using full sentences for the core entities.
If the user asks for an unsupported graphic (like a Pie Chart or Gantt Chart), map it to the closest conceptual type (e.g., radial or timeline).
Describe the core narrative, the main logical clusters (groups), the essential entities (nodes), and the critical dependencies or relationships between them. 
Identify what is important to highlight and what details can be omitted.
Be highly descriptive about the structure and logic so a code-generator can build the final output.
You may use a <thinking> section inside the <prompt> to outline the concept first.
</prompt>`;

export function getSystemPromptPhase2(diagramType) {
  const schema = DIAGRAM_SCHEMAS[diagramType.toLowerCase()] || DIAGRAM_SCHEMAS.default;
  const allowedTypes = schema.allowedNodes.join(', ');
  const allowedConnectionTypes = schema.features.allowConnections ? "target, both, reverse, none" + (diagramType.toLowerCase() === 'erd' ? ", 1:1, 1:N, N:1, N:M" : "") : "none";
  const specificRules = schema.promptRule || "";
  const includeEdgeLabel = schema.features.allowConnections;
  const hasNodeValue = schema.features.hasNodeValue;
  const egType1 = schema.allowedNodes[0];
  const egType2 = schema.allowedNodes.length > 1 ? schema.allowedNodes[1] : schema.allowedNodes[0];
  const isPie = diagramType.toLowerCase() === 'piechart';
  const sMap = schema.semanticScale || DIAGRAM_SCHEMAS.default.semanticScale;
  const allowedSizes = Object.values(sMap).join(', ');
  
  let exampleText = `
# Nodes

### Group: ${isPie ? 'Data' : 'Backend'} | Size: ${sMap.M} | Type: ${egType1}
| ID | Label |${hasNodeValue ? ' Value |' : ''}
|---|---|${hasNodeValue ? '---|' : ''}
| item_1 | ${isPie ? 'Revenue' : 'API Server'} |${hasNodeValue ? ' 25 |' : ''}
| item_2 | ${isPie ? 'Profit' : 'Database'} |${hasNodeValue ? ' 50 |' : ''}
`;

  if (!isPie) {
    exampleText += `
### Group: Orphans | Size: ${sMap.XL} | Type: ${egType2}
| ID | Label |${hasNodeValue ? ' Value |' : ''}
|---|---|${hasNodeValue ? '---|' : ''}
| client | Web App |${hasNodeValue ? ' 10 |' : ''}
`;
  }

  if (schema.features.allowConnections) {
    exampleText += `
# Edges
| Source ID | Target ID | Label | LineStyle | ConnectionType |
|---|---|---|---|---|
| item_1 | item_2 | ${includeEdgeLabel ? 'Query' : '-'} | solid | target |
`;
  }

  const connectionRulesStr = schema.connectionRules
    ? `\n5. STRICT CONNECTION RULES:\n${schema.connectionRules.map(r => `   - ${r}`).join('\n')}`
    : `\n5. "Size" defines the hierarchy level of the group. You MUST use one of these EXACT words (${allowedSizes}):
   - ${sMap.XL}: Top overarching parent / absolute domain
   - ${sMap.L}: Major sub-system or primary category
   - ${sMap.M}: Standard feature or operational component
   - ${sMap.S}: Sub-feature or child element
   - ${sMap.XS}: Micro-detail or isolated property`;

  return `You are a Diagram Topology Engineer.
The user will provide a detailed conceptual architecture for a ${diagramType.toUpperCase()} diagram.
Your task is to transform their concept into STRICT Markdown Tables.
You MUST output EXACTLY two tables: "# Nodes" and "# Edges".

Follow these rules:
1. Think carefully first in a <thinking> block: which entities belong to which clusters? What are the precise source and target IDs for every edge?
2. Ensure every single node has a unique, simple alphanumeric ID (e.g. node_1, server_a).
3. Ensure every relationship explicitly specifies the source and target IDs that EXACTLY match the defined nodes.
4. "Type" must be one of: ${allowedTypes}.
${specificRules}${connectionRulesStr}
6. "LineStyle" must be one of: solid, dashed, dotted, bold, bold-dashed, hidden.
7. "ConnectionType" must be one of: ${allowedConnectionTypes}.
8. You MUST group your Nodes into separate Markdown Tables per group using a heading starting with "### Group: ". If nodes don't belong to a group, put them under "### Group: Orphans".
9. "Size" and "Type" are properties of the GROUP, not the individual node. Specify them in the group heading exactly as shown below: "### Group: [Label] | Size: [size] | Type: [type]".
10. CRITICAL: You MUST preserve the exact language of the user's concept for ALL labels and group names. If the input is in Russian, all Labels MUST be in Russian. Do NOT translate labels to English!

Use this EXACT format:
<thinking>
... your logic, topology planning, and ID tracking ...
</thinking>
${exampleText}`;
}
