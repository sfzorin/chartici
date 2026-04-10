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
  const dt = diagramType.toLowerCase();
  const schema = DIAGRAM_SCHEMAS[dt] || DIAGRAM_SCHEMAS.default;
  const sMap = schema.semanticScale || DIAGRAM_SCHEMAS.default.semanticScale;
  const sDesc = schema.semanticDescription || DIAGRAM_SCHEMAS.default.semanticDescription;
  const allowedSizes = Object.values(sMap).join(', ');
  const allowedTypesStr = schema.allowedNodes.join(', ');

  if (dt === 'piechart') {
      return `You are a Diagram Topology Engineer.
The user will provide a detailed conceptual architecture for a PIECHART diagram.
Your task is to transform their concept into STRICT Markdown Tables.

Follow these rules:
1. Think carefully first in a <thinking> block.
2. "Type" must be one of: ${allowedTypesStr}.
3. You MUST output exactly ONE Markdown Table called "# Pie Slices". Do not output anything else.
4. "Size" defines the hierarchy level. You MUST use one of these EXACT words (${allowedSizes}):
   - ${sMap.L}: ${sDesc.L}
   - ${sMap.M}: ${sDesc.M}
   - ${sMap.S}: ${sDesc.S}
5. CRITICAL: You MUST preserve the exact language of the user's concept for ALL labels. If the input is in Russian, all Labels MUST be in Russian. Do NOT translate labels to English!

Use this EXACT format:
<thinking>
... your logic, topology planning ...
</thinking>

# Pie Slices
| Title (Label) | Size | Value |
|---|---|---|
| Revenue | ${sMap.L} | 45.5 |
| Costs | ${sMap.M} | 30 |`;
  }

  if (dt === 'timeline') {
      return `You are a Diagram Topology Engineer.
The user will provide a detailed conceptual architecture for a TIMELINE diagram.
Your task is to transform their concept into STRICT Markdown Tables.

Follow these rules:
1. Think carefully first in a <thinking> block.
2. Ensure every single element has a unique, simple alphanumeric ID (e.g. node_1, server_a).
3. "Type" must be one of: ${allowedTypesStr}.
4. "Size" defines the hierarchy level. You MUST use one of these EXACT words (${allowedSizes}):
   - ${sMap.L}: ${sDesc.L}
   - ${sMap.M}: ${sDesc.M}
   - ${sMap.S}: ${sDesc.S}
5. You MUST output EXACTLY two master sections: "# Timeline Spine" (a flat table of the main chronological steps) and "# Events" (children). Under "# Events", you MUST group the events into separate Markdown Tables per group using a heading starting with "### Group: ". EVERY single event MUST belong to a logical group.
6. CRITICAL: You MUST preserve the exact language of the user's concept for ALL labels. If the input is in Russian, all Labels MUST be in Russian. Do NOT translate labels to English!

Use this EXACT format:
<thinking>
... your logic, topology planning, and ID tracking ...
</thinking>

# Timeline Spine
| ID | Phase/Era Label | Size |
|---|---|---|
| e1 | Q1 Phase 1 | ${sMap.L} |
| e2 | Q2 Phase 2 | ${sMap.M} |

# Events

### Group: Engineering Tasks | Size: ${sMap.S} | Type: process
| ID | Spine ID | Label | Size | Type |
|---|---|---|---|---|
| ev_1 | e1 | Bootstrapping | ${sMap.S} | process |`;
  }

  // Base Logic for (flowchart, erd, radial, tree, matrix, sequence, etc...)
  const hasNodeValue = schema.features.hasNodeValue;
  const includeEdgeLabel = schema.features.allowConnections;
  const egType1 = schema.allowedNodes[0];
  const egType2 = schema.allowedNodes.length > 1 ? schema.allowedNodes[1] : schema.allowedNodes[0];
  const connTypesStr = schema.features.allowConnections ? "target, both, reverse, none" + (dt === 'erd' ? ", 1:1, 1:N, N:1, N:M" : "") : "none";

  let promptStr = `You are a Diagram Topology Engineer.
The user will provide a detailed conceptual architecture for a ${dt.toUpperCase()} diagram.
Your task is to transform their concept into STRICT Markdown Tables.

Follow these rules:
1. Think carefully first in a <thinking> block.
2. Ensure every single node has a unique, simple alphanumeric ID (e.g. node_1, server_a).
3. "Type" must be one of: ${allowedTypesStr}.
4. "Size" defines the hierarchy level. You MUST use one of these EXACT words (${allowedSizes}):
   - ${sMap.L}: ${sDesc.L}
   - ${sMap.M}: ${sDesc.M}
   - ${sMap.S}: ${sDesc.S}
5. You MUST group your Nodes into separate Markdown Tables per group using a heading starting with "### Group: ". EVERY single node MUST belong to a logical group. Do not leave any nodes ungrouped.
6. CRITICAL: You MUST preserve the exact language of the user's concept for ALL labels. If the input is in Russian, all Labels MUST be in Russian. Do NOT translate labels to English!`;

  if (schema.features.allowConnections) {
      promptStr += `
7. Ensure every relationship under # Edges explicitly specifies target IDs that EXACTLY match.
8. "ConnectionType" must be one of: ${connTypesStr}.`;
      
      if (schema.connectionRules) {
          promptStr += `
9. STRICT CONNECTION RULES:
${schema.connectionRules.map(r => `   - ${r}`).join('\n')}`;
      }
  }

  promptStr += `

Use this EXACT format:
<thinking>
... your logic, topology planning, and ID tracking ...
</thinking>

# Nodes

### Group: Backend | Size: ${sMap.M} | Type: ${egType1}
| ID | Label |${hasNodeValue ? ' Value |' : ''}
|---|---|${hasNodeValue ? '---|' : ''}
| item_1 | API Server |${hasNodeValue ? ' 25 |' : ''}
| item_2 | Database |${hasNodeValue ? ' 50 |' : ''}

### Group: Web Interface | Size: ${sMap.L} | Type: ${egType2}
| ID | Label |${hasNodeValue ? ' Value |' : ''}
|---|---|${hasNodeValue ? '---|' : ''}
| client | Web App |${hasNodeValue ? ' 10 |' : ''}
`;

  if (schema.features.allowConnections) {
      promptStr += `
# Edges
| Source ID | Target ID | Label | ConnectionType |
|---|---|---|---|
| item_1 | item_2 | ${includeEdgeLabel ? 'Query' : '-'} | target |
`;
  }

  return promptStr;
}
