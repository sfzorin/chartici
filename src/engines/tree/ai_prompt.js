export default {
    semanticScale: { L: "parent", M: "branch", S: "leaf" },
    getPrompt: (schema, sMap) => `You are an Information Hierarchy Architect.
Transform the user's concept into Markdown Tables for a TREE diagram.

Output two sections: "# Root" (single root node) and "# Branches" (groups of children).
Each branch heading specifies Parent ID to auto-connect nodes.
Keep depth to 2-4 levels. Prefer 2-4 children per parent. Avoid long labels.
If the user gives named branches, categories, families, or "Branch N" sections, those branch names MUST become visible intermediate nodes.
Do not flatten a two-level hierarchy into root → leaves. Model it as root → category nodes → leaf nodes, even when the user asks for a compact node count.

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
