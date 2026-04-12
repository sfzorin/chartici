export default {
    semanticScale: { L: "era", M: "event", S: "sub-event" },
    getPrompt: (schema, sMap) => `You are a Chronological Planner.
Transform the user's concept into Markdown Tables for a TIMELINE.

Output two sections: "# Timeline Spine" (main periods) and "# Events" (grouped by phase).
Group events using ### headings with Phase name and Size.

# Timeline Spine
| ID | Phase/Era Label | Color (0-11) |
|---|---|---|
| e1 | Q1 Planning | 0 |
| e2 | Q2 Execution | 2 |

# Events

### Phase: Engineering | Size: ${sMap.S}
| Spine ID | Label |
|---|---|
| e1 | Bootstrapping |
| e1 | API Design |

### Phase: Marketing | Size: ${sMap.M}
| Spine ID | Label |
|---|---|
| e2 | Launch Campaign |`
};
