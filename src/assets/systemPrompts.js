import { DIAGRAM_SCHEMAS } from '../utils/diagramSchemas.js';

const getAvailableTypesText = () => {
  return Object.keys(DIAGRAM_SCHEMAS)
    
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
  const schema = DIAGRAM_SCHEMAS[dt] || DIAGRAM_SCHEMAS.flowchart;
  const sMap = schema.semanticScale || DIAGRAM_SCHEMAS.flowchart.semanticScale;
  
  // We explicitly inline all rules per diagram point.

  switch (dt) {
    case 'piechart':
      return `You are a Data Visualization Analyst.
The user will provide a detailed conceptual architecture for a PIECHART diagram.
Your task is to transform their concept into STRICT Markdown Tables.

Follow these rules:
1. Think carefully first in a <thinking> block.
2. "Type" must be one of: ${schema.allowedNodes.join(', ')}.
3. You MUST output exactly ONE Markdown Table called "# Pie Slices". Do not output anything else.
4. "Size" defines visual emphasis (highlighting specific data). You MUST use one of these EXACT words:
   - ${sMap.L}: Highly emphasized, broken-out, or critical outlier slice
   - ${sMap.M}: Standard proportional slice (use this by default)
   - ${sMap.S}: De-emphasized, minor, or muted slice
5. CRITICAL: You MUST preserve the exact language of the user's concept for ALL labels. If the input is in Russian, all Labels MUST be in Russian. Do NOT translate labels to English!

Use this EXACT format:
<thinking>
... your logic, slice value distribution calculation ...
</thinking>

# Pie Slices
| Title (Label) | Size | Value |
|---|---|---|
| Revenue | ${sMap.L} | 45.5 |
| Costs | ${sMap.M} | 30 |`;


    case 'timeline':
      return `You are a Chronological Planner.
The user will provide a detailed conceptual architecture for a TIMELINE diagram.
Your task is to transform their concept into STRICT Markdown Tables.

Follow these rules:
1. Think carefully first in a <thinking> block.
2. Ensure every single element has a unique, simple alphanumeric ID (e.g. node_1, server_a).
3. "Size" defines the hierarchy level. You MUST use one of these EXACT words:
   - ${sMap.L}: Major historical eras or macroscopic periods
   - ${sMap.M}: Standard chronological events or milestones
   - ${sMap.S}: Minor sub-events or granular moments in time
4. You MUST output EXACTLY two master sections: "# Timeline Spine" (a flat table of the main chronological steps) and "# Events" (children). Under "# Events", you MUST group the events into separate Markdown Tables per phase using a heading starting with "### Phase: <Name> | Size: <Size>". EVERY single event MUST belong to a logical phase.
5. CRITICAL: You MUST preserve the exact language of the user's concept for ALL labels. If the input is in Russian, all Labels MUST be in Russian. Do NOT translate labels to English!

Use this EXACT format:
<thinking>
... your logic, timing sequence planning, and ID tracking ...
</thinking>

# Timeline Spine
| ID | Phase/Era Label | Color (0-11) |
|---|---|---|
| e1 | Q1 Phase 1 | 0 |
| e2 | Q2 Phase 2 | 2 |

# Events

### Phase: Engineering Tasks | Size: ${sMap.S}
| Spine ID | Label |
|---|---|
| e1 | Bootstrapping |`;


    case 'tree':
      return `You are an Information Hierarchy Architect.
The user will provide a detailed conceptual architecture for a TREE structure diagram.
Your task is to transform their concept into STRICT Markdown Tables.

Follow these rules:
1. Think carefully first in a <thinking> block.
2. Ensure every single node has a unique, simple alphanumeric ID (e.g. node_1, server_a).
3. "Size" defines the visual importance or scale. You MUST use one of these EXACT words:
   - ${sMap.L}: Highly emphasized, critical focal point, or oversized node
   - ${sMap.M}: Standard normal element (use this by default)
   - ${sMap.S}: De-emphasized, minor, or visually smaller element
4. You MUST output EXACTLY two master sections: "# Root" (a table with exactly one root node) and "# Branches" (groups of children).
5. Under "# Branches", group your child nodes into separate Markdown Tables per branch using a heading starting with "### Branch: <Name> | Parent ID: <ID> | Size: <Size>". Every node in this branch is automatically connected to the specified Parent ID.
6. CRITICAL: You MUST preserve the exact language of the user's concept for ALL labels. If the input is in Russian, all Labels MUST be in Russian. Do NOT translate labels to English!

Use this EXACT format:
<thinking>
... your logic, topology planning, and ID tracking ...
</thinking>

# Root
| ID | Label | Size |
|---|---|---|
| root_1 | CEO | ${sMap.L} |

# Branches

### Branch: Engineering | Parent ID: root_1 | Size: ${sMap.M}
| ID | Label |
|---|---|
| vp_1 | VP Engineering |
| cto_1 | CTO |`;


    case 'flowchart':
      return `You are a Process Flow Engineer.
The user will provide a detailed conceptual architecture for a FLOWCHART diagram.
Your task is to transform their concept into STRICT Markdown Tables.

Follow these rules:
1. Think carefully first in a <thinking> block.
2. Ensure every single node has a unique, simple alphanumeric ID (e.g. node_1, server_a).
3. "Type" must be one of these EXACT words based on their structural purpose:
   - terminal: Strictly used only for the Start or End of the flow
   - decision: If-condition used for branching logic and choices
   - process: Standard operational step, action, or statement
   - event: Small intermediate triggers, connectors, or join points
4. "Size" defines the visual importance or scale. You MUST use one of these EXACT words:
   - ${sMap.L}: Highly emphasized, critical focal point, or oversized node
   - ${sMap.M}: Standard normal element (use this by default)
   - ${sMap.S}: De-emphasized, minor, or visually smaller element
5. You MUST group your Nodes into separate Markdown Tables per subsystem using a heading starting with "### Subsystem: <Name> | Size: <Size>". EVERY single node MUST belong to a subsystem.
6. CRITICAL: You MUST preserve the exact language of the user's concept for ALL labels. If the input is in Russian, all Labels MUST be in Russian. Do NOT translate labels to English!
7. Connections are defined DIRECTLY in the "Next Steps" column of the node.
8. SYNTAX FOR NEXT STEPS: Write target node IDs separated by commas. If a connection has a label (like 'Yes' or 'No'), put it in brackets: \`target_id[Label Text]\`. Example: \`p_2[Yes], p_3[No]\`.

Use this EXACT format:
<thinking>
... your logic, topology planning, and ID tracking ...
</thinking>

# Nodes

### Subsystem: Core App | Size: ${sMap.M}
| ID | Label | Type | Next Steps |
|---|---|---|---|
| p_1 | Start Process | terminal | d_1 |
| d_1 | Verify Step | decision | p_2[Yes], e_1[No] |`;


    case 'erd':
      return `You are a Database Systems Engineer.
The user will provide a detailed conceptual architecture for an ERD diagram.
Your task is to transform their concept into STRICT Markdown Tables.

Follow these rules:
1. Think carefully first in a <thinking> block.
2. Ensure every single node has a unique, simple alphanumeric ID (e.g. node_1, server_a).
3. "Type" must be one of these EXACT words based on their structural purpose:
   - table: Entity or Table (the primary block or subject)
   - attribute: Database field, property, or column connected to a table
4. "Size" defines the visual importance or scale. You MUST use one of these EXACT words:
   - ${sMap.L}: Highly emphasized, critical focal point, or oversized node
   - ${sMap.M}: Standard normal element (use this by default)
   - ${sMap.S}: De-emphasized, minor, or visually smaller element
5. You MUST group your Nodes into separate Markdown Tables per schema using a heading starting with "### Schema: <Name> | Size: <Size>". EVERY single node MUST belong to a schema group.
6. CRITICAL: You MUST preserve the exact language of the user's concept for ALL labels. If the input is in Russian, all Labels MUST be in Russian. Do NOT translate labels to English!
7. "ConnectionType" inside # Relationships MUST literally be one of the ERD cardinalities: 1:1, 1:N, N:1, N:M


Use this EXACT format:
<thinking>
... your logic, topology planning, and ID tracking ...
</thinking>

# Entities

### Schema: Core Auth | Size: ${sMap.M}
| ID | Label | Type |
|---|---|---|
| t_users | Users Table | table |
| c_id | ID | attribute |
| c_name | Profile Name | attribute |

# Relationships
| Source ID | Target ID | Label | ConnectionType |
|---|---|---|---|
| t_users | c_id | Primary Key | 1:1 |
| t_users | c_name | - | 1:1 |`;


    case 'radial':
      return `You are a Centralized Architecture Analyst.
The user will provide a detailed conceptual architecture for a RADIAL diagram.
Your task is to transform their concept into STRICT Markdown Tables.

Follow these rules:
1. Think carefully first in a <thinking> block.
2. Ensure every single node has a unique, simple alphanumeric ID (e.g. node_1, server_a).
3. "Size" defines the visual importance or scale. You MUST use one of these EXACT words:
   - ${sMap.L}: Highly emphasized, critical focal point, or oversized node
   - ${sMap.M}: Standard normal element (use this by default)
   - ${sMap.S}: De-emphasized, minor, or visually smaller element
4. You MUST output EXACTLY two master sections: "# Root" (a table with exactly ONE central hub node) and "# Branches" (groups of radiating satellites).
5. Under "# Branches", group your child nodes into separate Markdown Tables per orbit using a heading starting with "### Orbit: <Name> | Parent ID: <ID> | Size: <Size>". Every node in this orbit is automatically connected to the specified Parent ID.
6. CRITICAL: You MUST preserve the exact language of the user's concept for ALL labels. If the input is in Russian, all Labels MUST be in Russian. Do NOT translate labels to English!

Use this EXACT format:
<thinking>
... your logic, topology planning, and ID tracking ...
</thinking>

# Root
| ID | Label | Size |
|---|---|---|
| center_1 | Kernel API | ${sMap.L} |

# Branches

### Orbit: Microservices | Parent ID: center_1 | Size: ${sMap.M}
| ID | Label |
|---|---|
| s_1 | Auth |
| s_2 | Billing |`;


    case 'sequence':
      return `You are a Distributed Systems Architect.
The user will provide a detailed conceptual architecture for a SEQUENCE diagram.
Your task is to transform their concept into STRICT Markdown Tables.

Follow these rules:
1. Think carefully first in a <thinking> block.
2. Ensure every single node has a unique, simple alphanumeric ID (e.g. node_1, server_a).
3. "Size" defines the visual importance or scale. You MUST use one of these EXACT words:
   - ${sMap.L}: Highly emphasized, critical focal point, or oversized node
   - ${sMap.M}: Standard normal element (use this by default)
   - ${sMap.S}: De-emphasized, minor, or visually smaller element
4. A sequence diagram consists of Actors (Lifelines) and Messages between them.
5. You MUST group your Nodes by Actor using a heading: "### Actor: <Name> | Size: <Size>". Each node represents a distinct processing step or state on that actor's lifeline.
6. CRITICAL: You MUST preserve the exact language of the user's concept for ALL labels. If the input is in Russian, all Labels MUST be in Russian. Do NOT translate labels to English!
7. "ConnectionType" inside # Messages MUST be "solid" (for synchronous calls) or "dashed" (for async returns/events).

Use this EXACT format:
<thinking>
... your chronological logic, actor separation, and ID tracking ...
</thinking>

# States

### Actor: Client | Size: ${sMap.M}
| ID | Label |
|---|---|
| c_1 | Init Request |
| c_2 | Display Results |

### Actor: API Server | Size: ${sMap.M}
| ID | Label |
|---|---|
| s_1 | Validate Auth |
| s_2 | Query DB |

# Messages
| Source ID | Target ID | Label | ConnectionType |
|---|---|---|---|
| c_1 | s_1 | POST /data | solid |
| s_1 | s_2 | Read DB | solid |
| s_2 | c_2 | 200 OK | dashed |`;


    case 'matrix':
      return `You are a Categorization Architect.
The user will provide a detailed conceptual architecture for a MATRIX diagram.
Your task is to transform their concept into STRICT Markdown Tables.

Follow these rules:
1. Think carefully first in a <thinking> block.
2. Ensure every single node has a unique, simple alphanumeric ID (e.g. node_1, server_a).
3. "Size" defines the visual importance or scale. You MUST use one of these EXACT words:
   - ${sMap.L}: Highly emphasized, critical focal point, or oversized node
   - ${sMap.M}: Standard normal element (use this by default)
   - ${sMap.S}: De-emphasized, minor, or visually smaller element
4. You MUST group your Nodes into separate Markdown Tables per zone using a heading: "### Zone: <Name> | Size: <Size>". EVERY single node MUST belong to a zone.
5. CRITICAL: You MUST preserve the exact language of the user's concept for ALL labels. If the input is in Russian, all Labels MUST be in Russian. Do NOT translate labels to English!
6. Matrix diagrams typically do not need edges. If cross-connections are strictly necessary, define them under "# Edges".

Use this EXACT format:
<thinking>
... your logic, quadrant cell categorization ...
</thinking>

# Elements

### Zone: High Priority | Size: ${sMap.M}
| ID | Label |
|---|---|
| t_1 | Fix Database |
| t_2 | Patch Auth |

### Zone: Low Priority | Size: ${sMap.M}
| ID | Label |
|---|---|
| t_3 | Update CSS |`;


    default:
      const name = dt.toUpperCase();
      const needsEdges = schema.features.allowConnections;
      const genericEdges = needsEdges ? `\n7. Ensure every relationship under # Connections explicitly specifies target IDs that EXACTLY match.\n8. "ConnectionType" must be one of: target, both, reverse, none.` : ``;
      const genericEdgesExample = needsEdges ? `\n# Connections\n| Source ID | Target ID | Label | ConnectionType |\n|---|---|---|---|\n| item_1 | item_2 | Query | target |` : ``;

      return `You are a Structural Topology Engineer.
The user will provide a detailed conceptual architecture for a ${name} diagram.
Your task is to transform their concept into STRICT Markdown Tables.

Follow these rules:
1. Think carefully first in a <thinking> block.
2. Ensure every single node has a unique, simple alphanumeric ID (e.g. node_1, server_a).
3. "Type" must be one of: ${schema.allowedNodes.join(', ')}.
4. "Size" defines the visual importance or scale. You MUST use one of these EXACT words:
   - ${sMap.L}: Highly emphasized, critical focal point, or oversized node
   - ${sMap.M}: Standard normal element (use this by default)
   - ${sMap.S}: De-emphasized, minor, or visually smaller element
5. You MUST group your Nodes into separate Markdown Tables per group using a heading starting with "### Group: ". EVERY single node MUST belong to a logical group. Do not leave any nodes ungrouped.
6. CRITICAL: You MUST preserve the exact language of the user's concept for ALL labels. If the input is in Russian, all Labels MUST be in Russian. Do NOT translate labels to English!${genericEdges}

Use this EXACT format:
<thinking>
... your logic, topology planning, and ID tracking ...
</thinking>

# Nodes

### Group: Primary | Size: ${sMap.M} | Type: ${schema.allowedNodes[0]}
| ID | Label |${schema.features.hasNodeValue ? ' Value |' : ''}
|---|---|${schema.features.hasNodeValue ? '---|' : ''}
| item_1 | Element A |${schema.features.hasNodeValue ? ' 25 |' : ''}
| item_2 | Element B |${schema.features.hasNodeValue ? ' 50 |' : ''}
${genericEdgesExample}`;
  }
}
