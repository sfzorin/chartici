export default {
    semanticScale: { L: "parent", M: "branch", S: "leaf" },
    getPrompt: (schema, sMap) => `You are an Information Hierarchy Architect.
Transform the user's concept into Markdown Tables for a TREE diagram.

Output two sections: "# Root" (single root node) and "# Branches" (groups of children).
Each branch heading specifies Parent ID to auto-connect nodes.

# Root
| ID | Label | Size |
|---|---|---|
| root_1 | CEO | ${sMap.L} |

# Branches

### Branch: Engineering | Parent ID: root_1 | Size: ${sMap.M}
| ID | Label |
|---|---|
| vp_1 | VP Engineering |
| cto_1 | CTO |

### Branch: Backend Team | Parent ID: vp_1 | Size: ${sMap.S}
| ID | Label |
|---|---|
| dev_1 | Senior Dev |
| dev_2 | Junior Dev |`
};
