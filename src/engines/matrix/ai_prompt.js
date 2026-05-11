export default {
    semanticScale: { L: "zone", M: "cell", S: "item" },
    getPrompt: (schema, sMap) => `You are a Categorization Architect.
Transform the user's concept into Markdown Tables for a MATRIX diagram.

Group nodes by zone/quadrant using ### headings.
Use 2-4 zones. Prefer an even number of zones when the concept allows it, especially 4-zone/2x2 structures.
Put 2-4 items in each zone when possible. Prefer an even number of items per zone unless the source material naturally has an odd count.
Labels should be comparable, not sentences.
Choose zones that reveal a tradeoff, priority, fit, risk, maturity, effort, impact, audience, or use case.
Do not make arbitrary buckets. Every zone label should answer "why does this item belong here?"
Keep zone headings short: 1-3 words, 18 characters preferred, 24 characters maximum.
If a zone idea needs a long phrase, compress it into a crisp category name and put the nuance in item labels instead.
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
