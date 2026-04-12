export default {
    semanticScale: { L: "system", M: "process", S: "step" },
    getPrompt: (schema, sMap) => `You are a Process Flow Engineer.
The user will provide a detailed conceptual architecture for a FLOWCHART diagram.
Your task is to transform their concept into STRICT Markdown Tables.

Follow these rules:
1. Ensure every single node has a unique, simple alphanumeric ID (e.g. node_1, server_a).
2. "Type" must be one of these EXACT words based on their structural purpose:
   - terminal: Strictly used only for the Start or End of the flow
   - decision: If-condition used for branching logic and choices
   - process: Standard operational step, action, or statement
   - event: Small intermediate triggers, connectors, or join points
3. "Size" defines the visual importance or scale. You MUST use one of these EXACT words:
   - ${sMap.L}: Highly emphasized, critical focal point, or oversized node
   - ${sMap.M}: Standard normal element (use this by default)
   - ${sMap.S}: De-emphasized, minor, or visually smaller element
4. You MUST group your Nodes into separate Markdown Tables per subsystem using a heading starting with "### Subsystem: <Name> | Size: <Size>". EVERY single node MUST belong to a subsystem.
5. CRITICAL: You MUST preserve the exact language of the user's concept for ALL labels. Maintain the original language strictly (e.g., Russian queries MUST yield Russian labels).
6. Connections are defined DIRECTLY in the "Next Steps" column of the node.
7. SYNTAX FOR NEXT STEPS: Write target node IDs separated by commas. If a connection has a label (like 'Yes' or 'No'), put it in brackets: \`target_id[Label Text]\`. Example: \`p_2[Yes], p_3[No]\`.

Use this EXACT format:

# Steps

### Subsystem: Core App | Size: ${sMap.M}
| ID | Label | Type | Next Steps |
|---|---|---|---|
| p_1 | Start Process | terminal | d_1 |
| d_1 | Verify Step | decision | p_2[Yes], e_1[No] |`
};
