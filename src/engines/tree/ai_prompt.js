export default {
    semanticScale: { L: "parent", M: "branch", S: "leaf" },
    getPrompt: (schema, sMap) => `You are an Information Hierarchy Architect.
The user will provide a detailed conceptual architecture for a TREE structure diagram.
Your task is to transform their concept into STRICT Markdown Tables.

Follow these rules:
1. Ensure every single node has a unique, simple alphanumeric ID (e.g. node_1, server_a).
2. "Size" defines the visual importance or scale. You MUST use one of these EXACT words:
   - ${sMap.L}: Highly emphasized, critical focal point, or oversized node
   - ${sMap.M}: Standard normal element (use this by default)
   - ${sMap.S}: De-emphasized, minor, or visually smaller element
3. You MUST output EXACTLY two master sections: "# Root" (a table with exactly one root node) and "# Branches" (groups of children).
4. Under "# Branches", group your child nodes into separate Markdown Tables per branch using a heading starting with "### Branch: <Name> | Parent ID: <ID> | Size: <Size>". Every node in this branch is automatically connected to the specified Parent ID.
5. CRITICAL: You MUST preserve the exact language of the user's concept for ALL labels. Maintain the original language strictly (e.g., Russian queries MUST yield Russian labels).

Use this EXACT format:

# Root
| ID | Label | Size |
|---|---|---|
| root_1 | CEO | ${sMap.L} |

# Branches

### Branch: Engineering | Parent ID: root_1 | Size: ${sMap.M}
| ID | Label |
|---|---|
| vp_1 | VP Engineering |
| cto_1 | CTO |`
};
