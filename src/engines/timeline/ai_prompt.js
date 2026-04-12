export default {
    semanticScale: { L: "era", M: "event", S: "sub-event" },
    getPrompt: (schema, sMap) => `You are a Chronological Planner.
The user will provide a detailed conceptual architecture for a TIMELINE diagram.
Your task is to transform their concept into STRICT Markdown Tables.

Follow these rules:
1. Think carefully first in a <thinking> block.
2. Ensure every single element has a unique, simple alphanumeric ID (e.g. node_1, server_a).
3. "Size" defines the hierarchy level. You MUST use one of these EXACT words:
   - ${sMap.L}: Major historical eras or macroscopic periods
   - ${sMap.M}: Standard chronological events or milestones
   - ${sMap.S}: Minor sub-events or granular moments in time
4. You MUST output EXACTLY two master sections: "# Timeline Spine" (a flat table of the main chronological steps) and "# Events" (children). Under "# Events", you MUST group the events into separate Markdown Tables per phase using a heading starting with "### Phase: <Name> | Size: <Size>". EVERY single event MUST belong to a logical phase.
5. CRITICAL: You MUST preserve the exact language of the user's concept for ALL labels. Maintain the original language strictly (e.g., Russian queries MUST yield Russian labels).

Use this EXACT format:
<thinking>
... your logic, timing sequence planning, and ID tracking ...
</thinking>

# Timeline Spine
| ID | Phase/Era Label | Color (0-11) |
|---|---|---|
| e1 | Q1 Phase 1 | 0 |
| e2 | Q2 Phase 2 | 2 |

# Events

### Phase: Engineering Tasks | Size: ${sMap.S}
| Spine ID | Label |
|---|---|
| e1 | Bootstrapping |`
};
