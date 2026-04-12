export default {
    semanticScale: { L: "zone", M: "cell", S: "item" },
    getPrompt: (schema, sMap) => `You are a Categorization Architect.
Transform the user's concept into Markdown Tables for a MATRIX diagram.

Group nodes by zone/quadrant using ### headings.

# Elements

### Zone: High Priority | Size: ${sMap.M}
| ID | Label |
|---|---|
| t_1 | Fix Database |
| t_2 | Patch Auth |

### Zone: Low Priority | Size: ${sMap.S}
| ID | Label |
|---|---|
| t_3 | Update CSS |
| t_4 | Refactor Logs |`
};
