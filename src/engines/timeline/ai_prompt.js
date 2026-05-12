export default {
    semanticScale: { L: "era", M: "event", S: "sub-event" },
    getPrompt: (schema, sMap) => `You are a Chronological Planner.
Transform the user's concept into Markdown Tables for a TIMELINE.
Color rule for Phase 2 output:
Use semantic color names only.
Allowed colors:
green = safe / good / pass / OK
yellow = warning / caution / hold / medium risk
red = danger / fail / stop / critical
blue = information / data / neutral process
gray = neutral / background / unknown
teal = system / control / operational
navy = source / primary / anchor
purple = exception / alternate / special
brown = material / physical / legacy
orange = action / energy / intervention
Never color a failure, stop, defect, rejection, or critical risk green.
If a label explicitly says Green/Yellow/Red/Blue Zone, the color must match that word.
When a visual group has clear semantics, add "| Color: green" or another allowed color to its ### heading.


Output exactly two sections: "# Timeline Spine" (main periods) and "# Events" (grouped by phase).
Group events using ### headings with Phase name and Size.
Use 4-6 spine phases. Put 1-3 events on each phase. Every event row MUST use an ID from "# Timeline Spine". Hard maximum 24 visible nodes.
Make the timeline tell an arc: context → trigger → change → consequence → next state.
Prefer phases that explain causality or maturity, not just calendar buckets.
Events should be turning points, decisions, discoveries, releases, or consequences. Avoid filler milestones.
If exact dates are not provided, use conceptual phases rather than inventing dates.

# Timeline Spine
| ID | Phase/Era Label | Color |
|---|---|---|
| e1 | Q1 Planning | navy |
| e2 | Q2 Execution | teal |

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
