export default {
    semanticScale: { L: "zone", M: "cell", S: "item" },
    getPrompt: (schema, sMap) => `You are a Categorization Architect.
Transform the user's concept into Markdown Tables for a MATRIX diagram.

Group nodes by zone/quadrant using ### headings.
Use 2-4 zones. Put 2-5 items in each zone. Labels should be comparable, not sentences.
Choose zones that reveal a tradeoff, priority, fit, risk, maturity, effort, impact, audience, or use case.
Do not make arbitrary buckets. Every zone label should answer "why does this item belong here?"
For broad topics, prefer a 2x2 logic with contrasting meanings over a plain category list.
Each zone should contain representative items, not exhaustive lists.

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
