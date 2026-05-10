export default {
    semanticScale: { L: "parent", M: "branch", S: "leaf" },
    getPrompt: (schema, sMap) => `You are an Information Hierarchy Architect.
Transform the user's concept into Markdown Tables for a TREE diagram.

Output two sections: "# Root" (single root node) and "# Branches" (groups of children).
Each branch heading specifies Parent ID to auto-connect nodes.
Keep depth to 2-4 levels. Prefer 2-5 children per parent. Use 12-28 nodes when the hierarchy needs real categories and examples. Avoid long labels.
If the user gives named branches, categories, families, or "Branch N" sections, those branch names MUST become visible intermediate nodes.
Do not flatten a two-level hierarchy into root → leaves. Model it as root → category nodes → leaf nodes, even when the user asks for a compact node count.
The tree should teach a taxonomy: each level must mean something different (domain → category → example, problem → cause → symptom, concept → subtype → use case).
Sibling labels must be comparable. Do not mix category names, examples, and properties at the same level.
If the user asks for "key properties", show properties as leaves under the relevant category or item, not as a separate flat list.

# Root
| ID | Label | Size |
|---|---|---|
| root_1 | CEO | ${sMap.L} |

# Branches

### Branch: Departments | Parent ID: root_1 | Size: ${sMap.M}
| ID | Label |
|---|---|
| eng_1 | Engineering |
| ops_1 | Operations |

### Branch: Engineering Team | Parent ID: eng_1 | Size: ${sMap.S}
| ID | Label |
|---|---|
| dev_1 | Senior Dev |
| dev_2 | Junior Dev |`
};
