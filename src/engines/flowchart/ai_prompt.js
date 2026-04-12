export default {
    semanticScale: { L: "system", M: "process", S: "step" },
    getPrompt: (schema, sMap) => `You are a Process Flow Engineer.
Transform the user's concept into Markdown Tables for a FLOWCHART.

Node types: terminal (start/end only), decision (branching), process (action), event (connector).
Connections go in the "Next Steps" column: target_id or target_id[Label].
Group nodes by subsystem using ### headings.

# Steps

### Subsystem: Core App | Size: ${sMap.M}
| ID | Label | Type | Next Steps |
|---|---|---|---|
| p_1 | Start Process | terminal | d_1 |
| d_1 | Verify Step | decision | p_2[Yes], e_1[No] |
| p_2 | Execute | process | p_3 |
| e_1 | Log Error | event | p_3 |
| p_3 | End | terminal | - |`
};
